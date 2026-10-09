package az.csi;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.time.Instant;
import java.util.*;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/v1")
class DecisionController {
  final Database db;

  DecisionController(Database db) {
    this.db = db;
  }

  record Review(
      @Pattern(regexp = "Approved|Rejected") @NotNull String action,
      @NotBlank @Size(min = 2, max = 80) String owner,
      @NotBlank @Size(min = 10, max = 1000) String rationale) {}

  record Advance(@Min(1) int version) {}

  @PostMapping("/recommendations/{id}/decisions")
  Object review(Authentication auth, @PathVariable UUID id, @Valid @RequestBody Review input) {
    var u = Security.identity(auth);
    Security.require(u, "ADMIN", "REVIEWER", "DEMO");
    return db.tenant(
        u.tenant(),
        () -> {
          if (db.sql.queryForObject(
                  "select count(*) from recommendations where id=?", Integer.class, id)
              == 0) throw new ResponseStatusException(HttpStatus.NOT_FOUND);
          UUID decision = UUID.randomUUID();
          var data =
              Map.of(
                  "id",
                  decision.toString(),
                  "recommendationId",
                  id.toString(),
                  "status",
                  input.action(),
                  "owner",
                  input.owner(),
                  "rationale",
                  input.rationale(),
                  "version",
                  1,
                  "history",
                  List.of(
                      Map.of(
                          "status",
                          input.action(),
                          "at",
                          Instant.now().toString(),
                          "actor",
                          u.email())));
          db.sql.update(
              "insert into decisions(id,tenant_id,recommendation_id,data,version) values"
                  + " (?,?,?,?::jsonb,1)",
              decision,
              u.tenant(),
              id,
              db.encode(data));
          db.audit(u, "decision." + input.action(), decision.toString());
          if (input.action().equals("Approved") && !u.role().equals("DEMO"))
            db.event(u.tenant(), "decision.approved", decision, 1);
          return data;
        });
  }

  @PostMapping("/recommendations/{id}/advance")
  Object advance(Authentication auth, @PathVariable UUID id, @Valid @RequestBody Advance input) {
    var u = Security.identity(auth);
    Security.require(u, "ADMIN", "REVIEWER", "DEMO");
    return db.tenant(
        u.tenant(),
        () -> {
          var rows =
              db.sql.queryForList(
                  "select * from decisions where recommendation_id=? for update", id);
          if (rows.isEmpty()) throw new ResponseStatusException(HttpStatus.NOT_FOUND);
          var row = rows.getFirst();
          var data = db.decode(row.get("data"));
          if (((Number) row.get("version")).intValue() != input.version())
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Decision changed");
          String next =
              switch (data.get("status").toString()) {
                case "Approved" -> "In progress";
                case "In progress" -> "Completed";
                default ->
                    throw new ResponseStatusException(HttpStatus.CONFLICT, "Invalid transition");
              };
          data.put("status", next);
          data.put("version", input.version() + 1);
          @SuppressWarnings("unchecked")
          var history = (List<Object>) data.get("history");
          history.add(Map.of("status", next, "at", Instant.now().toString(), "actor", u.email()));
          db.sql.update(
              "update decisions set data=?::jsonb,version=version+1,completed_at=case when"
                  + " ?='Completed' then now() else completed_at end where id=?",
              db.encode(data),
              next,
              row.get("id"));
          db.audit(u, "decision." + next, row.get("id").toString());
          return data;
        });
  }

  @GetMapping("/decisions/{id}/outcomes")
  Object outcomes(Authentication auth, @PathVariable UUID id) {
    var u = Security.identity(auth);
    return db.tenant(
        u.tenant(),
        () -> {
          var rows =
              db.sql.queryForList(
                  "select d.completed_at,r.issue_id from decisions d join recommendations r on"
                      + " r.id=d.recommendation_id where d.id=?",
                  id);
          if (rows.isEmpty()) throw new ResponseStatusException(HttpStatus.NOT_FOUND);
          var r = rows.getFirst();
          if (r.get("completed_at") == null)
            return Map.of("status", "Awaiting completion", "causal", false);
          var completed = ((java.sql.Timestamp) r.get("completed_at")).toInstant();
          if (Instant.now().isBefore(completed.plusSeconds(7 * 86400)))
            return Map.of(
                "status",
                "Collecting seven days of follow-up",
                "causal",
                false,
                "completedAt",
                completed);
          var result = new LinkedHashMap<String, Object>();
          result.put("causal", false);
          result.put("status", "Measured");
          for (int phase = 0; phase < 2; phase++) {
            var start = phase == 0 ? completed.minusSeconds(7 * 86400) : completed;
            var end = phase == 0 ? completed : completed.plusSeconds(7 * 86400);
            var metrics =
                db.sql.queryForMap(
                    "select count(*) as total_calls,count(*) filter(where exists(select 1 from"
                        + " call_issues ci where ci.call_id=c.id and ci.issue_id=?)) as"
                        + " affected_calls from calls c where status='COMPLETED' and"
                        + " (metadata->>'date')::timestamptz>=? and"
                        + " (metadata->>'date')::timestamptz<?",
                    r.get("issue_id"),
                    java.sql.Timestamp.from(start),
                    java.sql.Timestamp.from(end));
            long total = ((Number) metrics.get("total_calls")).longValue();
            metrics.put(
                "rate",
                total == 0 ? null : ((Number) metrics.get("affected_calls")).doubleValue() / total);
            result.put(phase == 0 ? "baseline" : "followUp", metrics);
          }
          return result;
        });
  }
}
