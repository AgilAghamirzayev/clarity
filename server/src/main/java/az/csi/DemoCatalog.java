package az.csi;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;

/** Ships processed fictional recordings so every visitor can explore the complete product. */
@Component
class DemoCatalog {
  final Database db;
  final AudioStore audio;
  final SupportSummaryController summaries;
  final boolean enabled;

  DemoCatalog(
      Database db,
      AudioStore audio,
      SupportSummaryController summaries,
      @Value("${DEMO_SEED_ENABLED:true}") boolean enabled) {
    this.db = db;
    this.audio = audio;
    this.summaries = summaries;
    this.enabled = enabled;
  }

  @SuppressWarnings("unchecked")
  List<Map<String, Object>> rows(Map<String, Object> catalog, String key) {
    return (List<Map<String, Object>>) catalog.getOrDefault(key, List.of());
  }

  void ensure(UUID tenant) {
    if (!enabled) return;
    db.tenant(
        tenant,
        () -> {
          try {
            var source = new ClassPathResource("demo/catalog.json");
            Map<String, Object> catalog;
            try (var input = source.getInputStream()) {
              catalog = db.decode(new String(input.readAllBytes(), StandardCharsets.UTF_8));
            }
            String version = catalog.get("version").toString();
            String seeded =
                db.sql.queryForObject(
                    "select demo_seed_version from tenants where id=? for update",
                    String.class,
                    tenant);
            // Preserve a visitor's decisions and uploads across refreshes and catalog updates.
            if (seeded != null) {
              if (version.equals(seeded)) refreshPreparedData(catalog, tenant);
              return null;
            }
            Instant now = Instant.now();
            Map<String, String> references = new HashMap<>();
            for (String table : List.of("calls", "issues", "recommendations"))
              for (var row : rows(catalog, table))
                references.put(
                    row.get("id").toString(),
                    UUID.nameUUIDFromBytes(
                            (tenant + ":" + row.get("id")).getBytes(StandardCharsets.UTF_8))
                        .toString());
            for (var row : rows(catalog, "calls")) {
              UUID id = UUID.fromString(references.get(row.get("id").toString()));
              String key = tenant + "/" + id + "/audio";
              try (var file =
                  new ClassPathResource(row.get("audioResource").toString()).getInputStream()) {
                byte[] bytes = file.readAllBytes();
                audio.put(key, new java.io.ByteArrayInputStream(bytes), bytes.length, "audio/wav");
              }
              var metadata = db.decode(db.encode(row.get("metadata")));
              Instant date =
                  now.minus(((Number) row.get("daysAgo")).longValue(), ChronoUnit.DAYS)
                      .minus(1, ChronoUnit.HOURS);
              metadata.put("date", date.toString());
              metadata.put("demoSeedVersion", version);
              metadata.put("sample", true);
              metadata.put(
                  "customerLabel",
                  "Customer "
                      + metadata
                          .get("customer")
                          .toString()
                          .substring(metadata.get("customer").toString().lastIndexOf('-') + 1));
              Long number =
                  db.sql.queryForObject(
                      "insert into"
                          + " calls(id,tenant_id,import_key,audio_key,sha256,content_type,status,stage,metadata,transcript,analysis,created_at)"
                          + " values"
                          + " (?,?,?,?,?,'audio/wav','COMPLETED','complete',?::jsonb,?::jsonb,?::jsonb,?)"
                          + " returning display_number",
                      Long.class,
                      id,
                      tenant,
                      "seed:" + version + ":" + row.get("import_key"),
                      key,
                      row.get("sha256"),
                      db.encode(metadata),
                      db.encode(row.get("transcript")),
                      db.encode(row.get("analysis")),
                      java.sql.Timestamp.from(date));
              references.put("CALL-" + row.get("display_number"), "CALL-" + number);
            }
            for (var row : rows(catalog, "issues"))
              db.sql.update(
                  "insert into issues(id,tenant_id,data,centroid,model) values"
                      + " (?,?,?::jsonb,?::vector,?)",
                  UUID.fromString(references.get(row.get("id").toString())),
                  tenant,
                  db.encode(remap(row.get("data"), references)),
                  row.get("centroid").toString(),
                  row.get("model"));
            for (var row : rows(catalog, "call_issues"))
              db.sql.update(
                  "insert into call_issues(tenant_id,call_id,issue_id,mentions,evidence) values"
                      + " (?,?,?,?,?::jsonb)",
                  tenant,
                  UUID.fromString(references.get(row.get("call_id").toString())),
                  UUID.fromString(references.get(row.get("issue_id").toString())),
                  row.get("mentions"),
                  db.encode(remap(row.get("evidence"), references)));
            var recommendations = rows(catalog, "recommendations");
            for (var row : recommendations) {
              db.sql.update(
                  "insert into recommendations(id,tenant_id,issue_id,data) values (?,?,?,?::jsonb)",
                  UUID.fromString(references.get(row.get("id").toString())),
                  tenant,
                  UUID.fromString(references.get(row.get("issue_id").toString())),
                  db.encode(remap(row.get("data"), references)));
              db.sql.update(
                  "insert into notifications(id,tenant_id,title,resource) values (?,?,?,?)",
                  UUID.randomUUID(),
                  tenant,
                  "New recommendation ready for review",
                  references.get(row.get("id").toString()));
            }
            for (int index = 0; index < Math.min(3, recommendations.size()); index++) {
              var row = recommendations.get(index);
              UUID recommendation = UUID.fromString(references.get(row.get("id").toString()));
              String status = List.of("Approved", "In progress", "Completed").get(index);
              var history = new ArrayList<Map<String, Object>>();
              history.add(
                  Map.of(
                      "status",
                      "Approved",
                      "at",
                      now.minus(10, ChronoUnit.DAYS).toString(),
                      "actor",
                      "Demo review team"));
              if (index > 0)
                history.add(
                    Map.of(
                        "status",
                        "In progress",
                        "at",
                        now.minus(9, ChronoUnit.DAYS).toString(),
                        "actor",
                        "Demo review team"));
              if (index > 1)
                history.add(
                    Map.of(
                        "status",
                        "Completed",
                        "at",
                        now.minus(8, ChronoUnit.DAYS).toString(),
                        "actor",
                        "Demo review team"));
              UUID decision =
                  UUID.nameUUIDFromBytes(
                      (tenant + ":decision:" + recommendation).getBytes(StandardCharsets.UTF_8));
              var data =
                  Map.of(
                      "id",
                      decision.toString(),
                      "recommendationId",
                      recommendation.toString(),
                      "status",
                      status,
                      "owner",
                      "Customer experience team",
                      "rationale",
                      "Sample review history: investigate the cited customer experience and"
                          + " validate the recommendation. Completion in this demo does not"
                          + " establish business impact.",
                      "version",
                      history.size(),
                      "history",
                      history);
              db.sql.update(
                  "insert into decisions(id,tenant_id,recommendation_id,data,version,completed_at)"
                      + " values (?,?,?,?::jsonb,?,?)",
                  decision,
                  tenant,
                  recommendation,
                  db.encode(data),
                  history.size(),
                  index == 2 ? java.sql.Timestamp.from(now.minus(8, ChronoUnit.DAYS)) : null);
            }
            for (var row : rows(catalog, "summaries")) {
              int days = ((Number) row.get("days")).intValue();
              db.sql.update(
                  "insert into"
                      + " support_summaries(id,tenant_id,request_key,days,include_samples,status,snapshot,report,is_demo_seed)"
                      + " values (?,?,?,?,true,'COMPLETED',?::jsonb,?::jsonb,true)",
                  UUID.randomUUID(),
                  tenant,
                  "seed:" + version + ":" + days,
                  days,
                  db.encode(summaries.snapshot(days, true, now)),
                  db.encode(remap(row.get("report"), references)));
            }
            db.sql.update("update tenants set demo_seed_version=? where id=?", version, tenant);
            db.sql.update(
                "insert into audit(tenant_id,actor,action,resource) values"
                    + " (?,'demo-catalog','demo.seeded',?)",
                tenant,
                version);
            return null;
          } catch (java.io.IOException error) {
            throw new IllegalStateException("Demo catalog could not be loaded", error);
          }
        });
  }

  Object remap(Object value, Map<String, String> references) {
    if (value instanceof String text) return references.getOrDefault(text, text);
    if (value instanceof Map<?, ?> map) {
      var result = new LinkedHashMap<String, Object>();
      map.forEach((key, item) -> result.put(key.toString(), remap(item, references)));
      return result;
    }
    if (value instanceof List<?> list)
      return list.stream().map(item -> remap(item, references)).toList();
    return value;
  }

  @SuppressWarnings("unchecked")
  void refreshPreparedData(Map<String, Object> catalog, UUID tenant) {
    Map<String, String> issueTitles = new HashMap<>();
    Map<String, String> references = new HashMap<>();
    for (String table : List.of("calls", "issues", "recommendations"))
      for (var row : rows(catalog, table))
        references.put(
            row.get("id").toString(),
            UUID.nameUUIDFromBytes((tenant + ":" + row.get("id")).getBytes(StandardCharsets.UTF_8))
                .toString());
    for (var row : rows(catalog, "calls")) {
      UUID id = UUID.fromString(references.get(row.get("id").toString()));
      Long number =
          db.sql.queryForObject("select display_number from calls where id=?", Long.class, id);
      references.put("CALL-" + row.get("display_number"), "CALL-" + number);
      // Only published, authored samples are refreshed. Uploaded recordings are excluded.
      db.sql.update(
          "update calls set transcript=?::jsonb,analysis=?::jsonb where id=? and"
              + " metadata->>'demoSeedVersion'=? and (transcript<>?::jsonb or analysis<>?::jsonb)",
          db.encode(row.get("transcript")),
          db.encode(row.get("analysis")),
          id,
          catalog.get("version"),
          db.encode(row.get("transcript")),
          db.encode(row.get("analysis")));
    }
    for (String table : List.of("issues", "recommendations")) {
      for (var row : rows(catalog, table)) {
        UUID id =
            UUID.nameUUIDFromBytes((tenant + ":" + row.get("id")).getBytes(StandardCharsets.UTF_8));
        String title = ((Map<String, Object>) row.get("data")).get("title").toString();
        if (table.equals("issues")) issueTitles.put(id.toString(), title);
        db.sql.update(
            "update "
                + table
                + " set data=jsonb_set(data,'{title}',?::jsonb) where id=? and data->>'title'<>?",
            db.encode(title),
            id,
            title);
        if (table.equals("recommendations")) {
          var data = (Map<String, Object>) row.get("data");
          db.sql.update(
              "update recommendations set data=jsonb_set(data,'{proposedAction}',?::jsonb) where"
                  + " id=? and data->>'proposedAction'<>?",
              db.encode(data.get("proposedAction")),
              id,
              data.get("proposedAction"));
        }
      }
    }
    for (var row :
        db.sql.queryForList("select id,days,snapshot from support_summaries where is_demo_seed")) {
      var snapshot = db.decode(row.get("snapshot"));
      var issues = (List<Map<String, Object>>) snapshot.get("issues");
      boolean changed = false;
      for (var issue : issues) {
        String title = issueTitles.get(issue.get("id").toString());
        if (title != null && !title.equals(issue.get("title"))) {
          issue.put("title", title);
          changed = true;
        }
      }
      if (changed)
        db.sql.update(
            "update support_summaries set snapshot=?::jsonb where id=?",
            db.encode(snapshot),
            row.get("id"));
      rows(catalog, "summaries").stream()
          .filter(item -> item.get("days").equals(row.get("days")))
          .findFirst()
          .ifPresent(
              item -> {
                String report = db.encode(remap(item.get("report"), references));
                db.sql.update(
                    "update support_summaries set report=?::jsonb where id=? and report<>?::jsonb",
                    report,
                    row.get("id"),
                    report);
              });
    }
  }
}
