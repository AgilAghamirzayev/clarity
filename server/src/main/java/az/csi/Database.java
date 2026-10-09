package az.csi;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.*;
import java.util.function.Supplier;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionTemplate;

@Component
public class Database {
  final JdbcTemplate sql;
  final TransactionTemplate tx;
  final ObjectMapper json;

  public Database(JdbcTemplate sql, TransactionTemplate tx, ObjectMapper json) {
    this.sql = sql;
    this.tx = tx;
    this.json = json;
  }

  public <T> T tenant(UUID tenant, Supplier<T> body) {
    return tx.execute(
        s -> {
          sql.queryForObject(
              "select set_config('app.tenant_id',?,true)", String.class, tenant.toString());
          return body.get();
        });
  }

  public <T> T tenantSnapshot(UUID tenant, Supplier<T> body) {
    var snapshot = new TransactionTemplate(Objects.requireNonNull(tx.getTransactionManager()));
    snapshot.setIsolationLevel(
        org.springframework.transaction.TransactionDefinition.ISOLATION_REPEATABLE_READ);
    return snapshot.execute(
        s -> {
          sql.queryForObject(
              "select set_config('app.tenant_id',?,true)", String.class, tenant.toString());
          return body.get();
        });
  }

  public String encode(Object value) {
    try {
      return json.writeValueAsString(value);
    } catch (Exception e) {
      throw new IllegalArgumentException("Invalid JSON");
    }
  }

  public Map<String, Object> decode(Object value) {
    try {
      return json.readValue(value.toString(), new TypeReference<Map<String, Object>>() {});
    } catch (Exception e) {
      throw new IllegalStateException("Invalid stored data", e);
    }
  }

  public List<Map<String, Object>> documents(String query, Object... args) {
    return sql.query(query, (r, n) -> decode(r.getObject(1)), args);
  }

  public void audit(Security.Identity user, String action, String resource) {
    sql.update(
        "insert into audit(tenant_id,actor,action,resource) values (?,?,?,?)",
        user.tenant(),
        user.id().toString(),
        action,
        resource);
  }

  public void event(UUID tenant, String type, UUID resource, int generation) {
    sql.update(
        "insert into outbox(id,tenant_id,type,resource_id,generation) values (?,?,?,?,?)",
        UUID.randomUUID(),
        tenant,
        type,
        resource,
        generation);
  }
}
