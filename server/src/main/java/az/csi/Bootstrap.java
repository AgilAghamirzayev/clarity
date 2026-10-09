package az.csi;

import java.util.*;
import org.springframework.boot.*;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Component;

@Component
class Bootstrap implements ApplicationRunner {
  final Database db;
  final BCryptPasswordEncoder passwords;

  Bootstrap(Database db, BCryptPasswordEncoder passwords) {
    this.db = db;
    this.passwords = passwords;
  }

  public void run(ApplicationArguments args) {
    String password = System.getenv("BOOTSTRAP_PASSWORD");
    if (password == null || password.length() < 16) return;
    String slug = System.getenv().getOrDefault("BOOTSTRAP_TENANT", "local");
    String email = System.getenv().getOrDefault("BOOTSTRAP_EMAIL", "admin@csi.local");
    db.tx.execute(
        s -> {
          db.sql.update(
              "insert into tenants(id,slug) values (?,?) on conflict(slug) do nothing",
              UUID.randomUUID(),
              slug);
          UUID tenant =
              db.sql.queryForObject("select id from tenants where slug=?", UUID.class, slug);
          db.sql.update(
              "insert into users(id,tenant_id,email,password_hash,role) values (?,?,?,?,'ADMIN') on"
                  + " conflict(tenant_id,email) do nothing",
              UUID.randomUUID(),
              tenant,
              email,
              passwords.encode(password));
          return null;
        });
  }
}
