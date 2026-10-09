package az.csi;

import java.util.*;
import java.util.concurrent.TimeUnit;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
class OutboxPublisher {
  final Database db;
  final KafkaTemplate<String, String> kafka;

  OutboxPublisher(Database db, KafkaTemplate<String, String> kafka) {
    this.db = db;
    this.kafka = kafka;
  }

  @Scheduled(fixedDelay = 2000)
  void publish() {
    db.tx.execute(
        s -> {
          var rows =
              db.sql.queryForList(
                  "select * from outbox where published_at is null and next_attempt<=now() order by"
                      + " created_at limit 20 for update skip locked");
          for (var r : rows) {
            try {
              var event =
                  Map.of(
                      "id",
                      r.get("id").toString(),
                      "tenant",
                      r.get("tenant_id").toString(),
                      "type",
                      r.get("type"),
                      "resource",
                      r.get("resource_id").toString(),
                      "generation",
                      r.get("generation"));
              kafka
                  .send("csi.events", r.get("tenant_id").toString(), db.encode(event))
                  .get(12, TimeUnit.SECONDS);
              db.sql.update(
                  "update outbox set published_at=now(),error_code=null where id=?", r.get("id"));
            } catch (Exception e) {
              if (e instanceof InterruptedException) Thread.currentThread().interrupt();
              db.sql.update(
                  "update outbox set"
                      + " attempts=attempts+1,error_code='BROKER_UNAVAILABLE',next_attempt=now()+least(300,power(2,least(attempts,8)))"
                      + " * interval '1 second' where id=?",
                  r.get("id"));
            }
          }
          return null;
        });
  }
}
