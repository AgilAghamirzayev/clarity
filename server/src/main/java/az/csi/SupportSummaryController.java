package az.csi;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.*;
import org.springframework.http.*;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/v1/support-summary")
class SupportSummaryController {
  final Database db;
  final AnalysisProfiles profiles;

  SupportSummaryController(Database db, AnalysisProfiles profiles) {
    this.db = db;
    this.profiles = profiles;
  }

  record Request(int days, boolean includeSamples) {}

  void validate(int days) {
    if (!Set.of(7, 30, 90).contains(days))
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Choose 7, 30 or 90 days");
  }

  @GetMapping
  Object latest(
      Authentication auth,
      @RequestParam(defaultValue = "7") int days,
      @RequestParam(defaultValue = "false") boolean includeSamples) {
    validate(days);
    var user = Security.identity(auth);
    return db.tenantSnapshot(
        user.tenant(),
        () -> {
          var rows =
              db.sql.queryForList(
                  "select * from support_summaries where days=? and include_samples=? order by"
                      + " created_at desc limit 1",
                  days,
                  includeSamples);
          if (!rows.isEmpty()) return response(rows.getFirst());
          return Map.of(
              "status", "NOT_GENERATED", "snapshot", snapshot(days, includeSamples, Instant.now()));
        });
  }

  @PostMapping
  ResponseEntity<Object> generate(
      Authentication auth,
      @RequestHeader("Idempotency-Key") String key,
      @RequestBody Request input) {
    var user = Security.identity(auth);
    Security.require(user, "ADMIN", "ANALYST", "REVIEWER", "DEMO");
    validate(input.days());
    if (key.length() < 8 || key.length() > 128)
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid request key");
    Object result =
        db.tenantSnapshot(
            user.tenant(),
            () -> {
              db.sql.queryForList(
                  "select pg_advisory_xact_lock(hashtextextended(?,1))", user.tenant().toString());
              var replay =
                  db.sql.queryForList("select * from support_summaries where request_key=?", key);
              if (!replay.isEmpty()) {
                var row = replay.getFirst();
                if (((Number) row.get("days")).intValue() != input.days()
                    || !row.get("include_samples").equals(input.includeSamples()))
                  throw new ResponseStatusException(
                      HttpStatus.CONFLICT, "Request key belongs to another reporting period");
                return response(row);
              }
              var active =
                  db.sql.queryForList(
                      "select * from support_summaries where days=? and include_samples=? and"
                          + " status in ('QUEUED','PROCESSING')",
                      input.days(),
                      input.includeSamples());
              if (!active.isEmpty())
                throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "A summary for this period is already being prepared. Refresh to view it.");
              if (user.role().equals("DEMO")
                  && db.sql.queryForObject(
                          "select count(*) from support_summaries where not is_demo_seed",
                          Integer.class)
                      >= 3)
                throw new ResponseStatusException(
                    HttpStatus.TOO_MANY_REQUESTS,
                    "This demo workspace allows three summary reports");
              var data =
                  new LinkedHashMap<>(
                      snapshot(input.days(), input.includeSamples(), Instant.now()));
              data.put("analysisProfile", profiles.snapshot());
              if (((Number) ((Map<?, ?>) data.get("current")).get("calls")).longValue() == 0)
                throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "No completed recordings in this period. Change the period or include sample"
                        + " recordings.");
              UUID id = UUID.randomUUID();
              db.sql.update(
                  "insert into"
                      + " support_summaries(id,tenant_id,request_key,days,include_samples,snapshot)"
                      + " values (?,?,?,?,?,?::jsonb)",
                  id,
                  user.tenant(),
                  key,
                  input.days(),
                  input.includeSamples(),
                  db.encode(data));
              db.event(user.tenant(), "summary.requested", id, 1);
              db.audit(user, "summary.requested", id.toString());
              return Map.of("id", id, "status", "QUEUED", "snapshot", data);
            });
    return ResponseEntity.accepted().body(result);
  }

  Map<String, Object> response(Map<String, Object> row) {
    var result = new LinkedHashMap<String, Object>();
    for (String key : List.of("id", "status", "created_at", "updated_at", "error_code"))
      result.put(key, row.get(key));
    result.put("snapshot", db.decode(row.get("snapshot")));
    result.put("report", row.get("report") == null ? null : db.decode(row.get("report")));
    return result;
  }

  static final String SCOPE =
      " from calls c where (metadata->>'date')::timestamptz > ?::timestamptz and"
          + " (metadata->>'date')::timestamptz <= ?::timestamptz and (? or"
          + " coalesce(metadata->>'sample','false') <> 'true')";

  Map<String, Object> metrics(Instant start, Instant end, boolean samples) {
    var rows =
        db.sql.queryForMap(
            """
            select count(*) imported,count(*) filter(where status='FAILED') failed,
              count(*) filter(where status='COMPLETED') calls,
              count(distinct metadata->>'customer') filter(where status='COMPLETED') customers,
              count(*) filter(where status='COMPLETED' and analysis->>'sentiment'='Positive') positive,
              count(*) filter(where status='COMPLETED' and analysis->>'sentiment'='Neutral') neutral,
              count(*) filter(where status='COMPLETED' and analysis->>'sentiment'='Negative') negative,
              count(*) filter(where status='COMPLETED' and metadata->>'sample'='true') samples,
              count(*) filter(where status='COMPLETED' and exists(select 1 from call_issues ci where ci.call_id=c.id)) "issueCalls",
              avg((transcript->>'duration')::numeric) filter(where status='COMPLETED') "averageDuration"
            """
                + SCOPE,
            start.toString(),
            end.toString(),
            samples);
    long repeats =
        db.sql.queryForObject(
            "select count(*) from (select metadata->>'customer'"
                + SCOPE
                + " and status='COMPLETED' group by metadata->>'customer' having count(*)>1)"
                + " repeated",
            Long.class,
            start.toString(),
            end.toString(),
            samples);
    rows.put("repeatCustomers", repeats);
    long calls = ((Number) rows.get("calls")).longValue(),
        customers = ((Number) rows.get("customers")).longValue();
    rows.put(
        "negativeRate",
        calls == 0 ? null : 100.0 * ((Number) rows.get("negative")).longValue() / calls);
    rows.put(
        "issueRate",
        calls == 0 ? null : 100.0 * ((Number) rows.get("issueCalls")).longValue() / calls);
    rows.put("repeatRate", customers == 0 ? null : 100.0 * repeats / customers);
    return rows;
  }

  Map<String, Object> snapshot(int days, boolean samples, Instant end) {
    Instant start = end.minus(days, ChronoUnit.DAYS), previous = start.minus(days, ChronoUnit.DAYS);
    var evidence =
        db.sql.query(
            "select c.*"
                + SCOPE
                + " and status='COMPLETED' order by (metadata->>'date')::timestamptz desc,id limit"
                + " 40",
            (r, n) -> {
              var meta = db.decode(r.getObject("metadata"));
              var analysis = db.decode(r.getObject("analysis"));
              String summary = Objects.toString(analysis.get("summary"), "");
              return Map.of(
                  "id",
                  r.getString("id"),
                  "reference",
                  "CALL-" + r.getLong("display_number"),
                  "title",
                  Objects.toString(
                      meta.get("title"), Objects.toString(analysis.get("topic"), "Support call")),
                  "summary",
                  summary.substring(0, Math.min(700, summary.length())),
                  "sentiment",
                  Objects.toString(analysis.get("sentiment"), "Unknown"),
                  "sample",
                  Boolean.TRUE.equals(meta.get("sample")));
            },
            start.toString(),
            end.toString(),
            samples);
    var issues =
        db.sql.queryForList(
            """
            select i.id,i.data->>'title' title,i.data->>'category' category,count(distinct c.id) calls,
              count(distinct c.metadata->>'customer') customers
            from issues i join call_issues ci on ci.issue_id=i.id join calls c on c.id=ci.call_id
            where c.status='COMPLETED' and (c.metadata->>'date')::timestamptz > ?::timestamptz
              and (c.metadata->>'date')::timestamptz <= ?::timestamptz
              and (? or coalesce(c.metadata->>'sample','false') <> 'true')
            group by i.id order by calls desc,i.id limit 12
            """,
            start.toString(),
            end.toString(),
            samples);
    return Map.of(
        "days",
        days,
        "includeSamples",
        samples,
        "start",
        start.toString(),
        "end",
        end.toString(),
        "previousStart",
        previous.toString(),
        "current",
        metrics(start, end, samples),
        "previous",
        metrics(previous, start, samples),
        "evidence",
        evidence,
        "issues",
        issues);
  }
}
