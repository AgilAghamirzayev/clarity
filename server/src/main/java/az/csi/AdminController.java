package az.csi;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.net.URI;
import java.util.*;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/v1")
class AdminController {
  final Database db;
  final BCryptPasswordEncoder passwords;

  AdminController(Database db, BCryptPasswordEncoder passwords) {
    this.db = db;
    this.passwords = passwords;
  }

  record User(
      @Email @NotBlank String email,
      @Size(min = 16, max = 72) @NotNull String password,
      @Pattern(regexp = "ADMIN|ANALYST|REVIEWER|VIEWER") @NotNull String role) {}

  @PostMapping("/users")
  Object user(Authentication auth, @Valid @RequestBody User input) {
    var u = Security.identity(auth);
    Security.require(u, "ADMIN");
    return db.tenant(
        u.tenant(),
        () -> {
          UUID id = UUID.randomUUID();
          db.sql.update(
              "insert into users(id,tenant_id,email,password_hash,role) values (?,?,?,?,?)",
              id,
              u.tenant(),
              input.email().toLowerCase(),
              passwords.encode(input.password()),
              input.role());
          db.audit(u, "user.create", id.toString());
          return Map.of("id", id);
        });
  }

  record Integration(
      boolean enabled,
      @NotBlank @Size(max = 300) String endpoint,
      @Size(max = 80) String channel,
      @Size(max = 40) String project,
      @Email @Size(max = 254) String email) {}

  @GetMapping("/integrations")
  Object integrations(Authentication auth) {
    var u = Security.identity(auth);
    Security.require(u, "ADMIN");
    return db.tenant(
        u.tenant(),
        () ->
            db.sql.query(
                "select id,kind,enabled,config from integrations",
                (r, n) ->
                    Map.of(
                        "id",
                        r.getString(1),
                        "kind",
                        r.getString(2),
                        "enabled",
                        r.getBoolean(3),
                        "config",
                        db.decode(r.getObject(4)))));
  }

  @PutMapping("/integrations/{kind}")
  Object configure(
      Authentication auth, @PathVariable String kind, @Valid @RequestBody Integration input) {
    var u = Security.identity(auth);
    Security.require(u, "ADMIN");
    if (!Set.of("slack", "jira", "crm").contains(kind))
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST);
    URI uri = URI.create(input.endpoint());
    String origin = uri.getScheme() + "://" + uri.getAuthority();
    var allowed =
        Set.of(System.getenv().getOrDefault("INTEGRATION_ALLOWED_ORIGINS", "").split(","));
    if (!"https".equals(uri.getScheme())
        || uri.getUserInfo() != null
        || uri.getFragment() != null
        || uri.getQuery() != null
        || !allowed.contains(origin))
      throw new ResponseStatusException(
          HttpStatus.BAD_REQUEST,
          "Endpoint origin must be HTTPS and configured in INTEGRATION_ALLOWED_ORIGINS");
    if (kind.equals("slack") && !input.endpoint().equals("https://slack.com/api/chat.postMessage"))
      throw new ResponseStatusException(
          HttpStatus.BAD_REQUEST, "Use the Slack chat.postMessage endpoint");
    return db.tenant(
        u.tenant(),
        () -> {
          UUID id =
              db.sql.queryForObject(
                  "insert into integrations(id,tenant_id,kind,enabled,config) values"
                      + " (?,?,?,?,?::jsonb) on conflict(tenant_id,kind) do update set"
                      + " enabled=excluded.enabled,config=excluded.config returning id",
                  UUID.class,
                  UUID.randomUUID(),
                  u.tenant(),
                  kind,
                  input.enabled(),
                  db.encode(input));
          db.audit(u, "integration.configure", id.toString());
          return Map.of(
              "id",
              id,
              "credentialEnvironment",
              "CSI_INTEGRATION_" + id.toString().replace('-', '_') + "_TOKEN");
        });
  }

  @PostMapping("/deliveries/{id}/retry")
  Object retryDelivery(Authentication auth, @PathVariable UUID id) {
    var u = Security.identity(auth);
    Security.require(u, "ADMIN");
    return db.tenant(
        u.tenant(),
        () -> {
          var rows =
              db.sql.queryForList(
                  "update deliveries set status='RETRY_QUEUED',updated_at=now() where id=? and"
                      + " status='FAILED' returning event_id",
                  id);
          if (rows.isEmpty())
            throw new ResponseStatusException(
                HttpStatus.CONFLICT, "Only exhausted deliveries can be retried");
          int changed =
              db.sql.update(
                  "update outbox set"
                      + " generation=generation+1,published_at=null,attempts=0,next_attempt=now(),error_code=null"
                      + " where id=? and tenant_id=?",
                  rows.getFirst().get("event_id"),
                  u.tenant());
          if (changed != 1)
            throw new ResponseStatusException(
                HttpStatus.CONFLICT, "Original delivery event is unavailable");
          db.audit(u, "delivery.retry", id.toString());
          return Map.of("status", "RETRY_QUEUED");
        });
  }

  @GetMapping("/deliveries")
  Object deliveries(Authentication auth) {
    var u = Security.identity(auth);
    Security.require(u, "ADMIN");
    return db.tenant(
        u.tenant(),
        () ->
            db.sql.queryForList(
                "select id,integration_id,status,attempts,error_code,external_id,updated_at from"
                    + " deliveries order by updated_at desc limit 100"));
  }
}
