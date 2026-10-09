package az.csi;

import java.util.*;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/v1")
class WorkspaceController {
  final Database db;

  WorkspaceController(Database db) {
    this.db = db;
  }

  @GetMapping("/workspace")
  Object workspace(Authentication auth) {
    var u = Security.identity(auth);
    return db.tenant(
        u.tenant(),
        () -> {
          var calls =
              db.sql.query(
                  "select c.*, (select min(other.display_number) from calls other where"
                      + " other.tenant_id=c.tenant_id and"
                      + " other.metadata->>'customer'=c.metadata->>'customer') customer_number,"
                      + " (select issue_id from call_issues where call_id=c.id order by mentions"
                      + " desc limit 1) issue_id from calls c where status='COMPLETED' order by"
                      + " created_at desc limit 500",
                  (r, n) -> {
                    var meta = db.decode(r.getObject("metadata"));
                    var analysis = db.decode(r.getObject("analysis"));
                    var transcript = db.decode(r.getObject("transcript"));
                    var c = new LinkedHashMap<>(meta);
                    c.put(
                        "issueIds",
                        db.sql.queryForList(
                            "select issue_id::text from call_issues where call_id=?",
                            String.class,
                            r.getObject("id")));
                    c.put("id", r.getString("id"));
                    c.put("reference", "CALL-" + r.getLong("display_number"));
                    c.put(
                        "customer",
                        meta.containsKey("demoSeedVersion")
                            ? meta.get("customerLabel")
                            : "Customer " + r.getLong("customer_number"));
                    c.put("duration", transcript.get("duration"));
                    c.put("language", transcript.get("language"));
                    c.put("sentiment", analysis.get("sentiment"));
                    c.put("topic", analysis.get("topic"));
                    c.put("issueId", r.getString("issue_id"));
                    c.put("summary", analysis.get("summary"));
                    c.put("transcript", transcript.get("segments"));
                    return c;
                  });
          db.audit(u, "workspace.read", "workspace");
          return Map.of(
              "conversations",
              calls,
              "issues",
              db.documents("select data from issues order by created_at desc"),
              "recommendations",
              db.documents("select data from recommendations order by created_at desc"),
              "decisions",
              db.documents("select data from decisions order by created_at desc"),
              "projection",
              Map.of(
                  "limit",
                  500,
                  "totalCompleted",
                  db.sql.queryForObject(
                      "select count(*) from calls where status='COMPLETED'", Long.class)));
        });
  }

  @GetMapping("/issues")
  Object issues(Authentication auth) {
    var u = Security.identity(auth);
    return db.tenant(
        u.tenant(), () -> db.documents("select data from issues order by created_at desc"));
  }

  @GetMapping("/issues/{id}")
  Object issue(Authentication auth, @PathVariable UUID id) {
    var u = Security.identity(auth);
    return db.tenant(
        u.tenant(),
        () -> {
          var rows = db.documents("select data from issues where id=?", id);
          if (rows.isEmpty()) throw new ResponseStatusException(HttpStatus.NOT_FOUND);
          var issue = rows.getFirst();
          issue.put(
              "evidence",
              db.sql.query(
                  "select call_id,mentions,evidence from call_issues where issue_id=?",
                  (r, n) ->
                      Map.of(
                          "callId",
                          r.getString(1),
                          "mentions",
                          r.getInt(2),
                          "segments",
                          db.decode(r.getObject(3))),
                  id));
          return issue;
        });
  }

  @GetMapping("/recommendations")
  Object recommendations(Authentication auth) {
    var u = Security.identity(auth);
    return db.tenant(
        u.tenant(),
        () -> db.documents("select data from recommendations order by created_at desc"));
  }

  @GetMapping("/analytics/overview")
  Object analytics(Authentication auth) {
    var u = Security.identity(auth);
    return db.tenant(
        u.tenant(),
        () ->
            db.sql.queryForMap(
                "select count(*) as calls,count(*) filter(where status='COMPLETED') as"
                    + " completed,count(*) filter(where status='FAILED') as failed,count(distinct"
                    + " metadata->>'customer') as customers from calls"));
  }

  @GetMapping("/insights/trends")
  Object trends(Authentication auth, @RequestParam(defaultValue = "7") int days) {
    if (days < 1 || days > 90) throw new ResponseStatusException(HttpStatus.BAD_REQUEST);
    var u = Security.identity(auth);
    return db.tenant(
        u.tenant(),
        () -> {
          var rows =
              db.sql.queryForList(
                  """
                  with periods as (
                    select ci.issue_id,ci.call_id,ci.mentions,c.metadata->>'customer' customer,
                      (c.metadata->>'date')::timestamptz >= now()-(? * interval '1 day') current_period
                    from call_issues ci join calls c on c.id=ci.call_id
                    where (c.metadata->>'date')::timestamptz >= now()-(? * interval '1 day')
                      and (c.metadata->>'date')::timestamptz <= now()
                  ) select i.id,i.data->>'title' title,
                    count(distinct p.call_id) filter(where current_period) affected_calls,
                    count(distinct p.call_id) filter(where not current_period) previous_calls,
                    coalesce(sum(p.mentions) filter(where current_period),0) mentions,
                    count(distinct p.customer) filter(where current_period) customers
                  from issues i left join periods p on p.issue_id=i.id group by i.id
                  order by affected_calls desc
                  """,
                  days,
                  days * 2);
          for (var row : rows) {
            long current = ((Number) row.get("affected_calls")).longValue();
            long previous = ((Number) row.get("previous_calls")).longValue();
            row.put(
                "changePercent", previous == 0 ? null : 100.0 * (current - previous) / previous);
          }
          return rows;
        });
  }

  @GetMapping("/notifications")
  Object notifications(Authentication auth) {
    var u = Security.identity(auth);
    return db.tenant(
        u.tenant(),
        () ->
            db.sql.queryForList(
                "select id,title,resource,read_at,created_at from notifications order by created_at"
                    + " desc limit 100"));
  }

  @PostMapping("/notifications/{id}/read")
  void read(Authentication auth, @PathVariable UUID id) {
    var u = Security.identity(auth);
    db.tenant(
        u.tenant(), () -> db.sql.update("update notifications set read_at=now() where id=?", id));
  }

  @GetMapping("/audit")
  Object audit(Authentication auth) {
    var u = Security.identity(auth);
    Security.require(u, "ADMIN");
    return db.tenant(
        u.tenant(),
        () ->
            db.sql.queryForList(
                "select actor,action,resource,created_at from audit order by id desc limit 200"));
  }
}
