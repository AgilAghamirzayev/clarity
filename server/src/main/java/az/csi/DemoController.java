package az.csi;

import jakarta.servlet.http.*;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.context.HttpSessionSecurityContextRepository;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/v1")
class DemoController {
  final Database db;
  final boolean enabled;
  final int maxWorkspaces;
  final DemoCatalog catalog;
  final DemoWorkspaces workspaces;

  DemoController(
      Database db,
      DemoCatalog catalog,
      DemoWorkspaces workspaces,
      @Value("${DEMO_ENABLED:false}") boolean enabled,
      @Value("${DEMO_MAX_WORKSPACES:100}") int maxWorkspaces) {
    this.db = db;
    this.catalog = catalog;
    this.workspaces = workspaces;
    this.enabled = enabled;
    this.maxWorkspaces = maxWorkspaces;
  }

  @PostMapping("/auth/demo")
  Security.Identity session(
      Authentication auth, HttpServletRequest request, HttpServletResponse response)
      throws Exception {
    if (!enabled)
      throw new ResponseStatusException(
          HttpStatus.SERVICE_UNAVAILABLE, "Live demo is not enabled on this server");
    if (auth != null
        && auth.getPrincipal() instanceof Security.Identity user
        && user.role().equals("DEMO")
        && workspaces.shared == DemoWorkspaces.SHARED_TENANT.equals(user.tenant())
        && user.expiresAt() != null
        && user.expiresAt().isAfter(Instant.now())) {
      catalog.ensure(user.tenant());
      return user;
    }
    String fingerprint =
        HexFormat.of()
            .formatHex(
                MessageDigest.getInstance("SHA-256")
                    .digest(
                        (request.getRemoteAddr() + ":" + System.getenv("DB_APP_PASSWORD"))
                            .getBytes(StandardCharsets.UTF_8)));
    int attempts =
        db.sql.queryForObject(
            "insert into login_attempts(identity,attempts,window_start) values (?,1,now()) on"
                + " conflict(identity) do update set attempts=case when login_attempts.window_start"
                + " < now()-interval '15 minutes' then 1 else login_attempts.attempts+1 end,"
                + " window_start=case when login_attempts.window_start < now()-interval '15"
                + " minutes' then now() else login_attempts.window_start end returning attempts",
            Integer.class,
            "demo:" + fingerprint);
    if (attempts > 10)
      throw new ResponseStatusException(
          HttpStatus.TOO_MANY_REQUESTS, "Demo session limit reached. Try again in 15 minutes.");
    UUID tenant = workspaces.shared ? DemoWorkspaces.SHARED_TENANT : UUID.randomUUID();
    Instant expires = Instant.now().plus(24, ChronoUnit.HOURS);
    db.tx.execute(
        status -> {
          db.sql.queryForList("select pg_advisory_xact_lock(742901)");
          if (workspaces.shared) {
            // This dedicated public tenant never absorbs previously private visitor data.
            db.sql.update(
                "insert into tenants(id,slug) values (?,?) on conflict(id) do nothing",
                tenant,
                "clarity-public-workspace");
            catalog.ensure(tenant);
            return null;
          }
          if (db.sql.queryForObject(
                  "select count(*) from tenants where demo_expires_at > now()", Integer.class)
              >= maxWorkspaces)
            throw new ResponseStatusException(
                HttpStatus.TOO_MANY_REQUESTS,
                "The live demo is at capacity. Please try again later.");
          db.sql.update(
              "insert into tenants(id,slug,demo_expires_at) values (?,?,?)",
              tenant,
              "demo-" + tenant,
              java.sql.Timestamp.from(expires));
          catalog.ensure(tenant);
          return null;
        });
    var user = new Security.Identity(UUID.randomUUID(), tenant, "Demo visitor", "DEMO", expires);
    if (request.getSession(false) != null) request.getSession().invalidate();
    request.getSession(true).setMaxInactiveInterval(24 * 60 * 60);
    var context = SecurityContextHolder.createEmptyContext();
    context.setAuthentication(
        new UsernamePasswordAuthenticationToken(
            user, null, List.of(new SimpleGrantedAuthority("ROLE_DEMO"))));
    SecurityContextHolder.setContext(context);
    new HttpSessionSecurityContextRepository().saveContext(context, request, response);
    db.tenant(
        tenant,
        () -> {
          db.audit(user, "demo.started", tenant.toString());
          return null;
        });
    return user;
  }

  @GetMapping("/platform/status")
  Map<String, Object> status(Authentication auth) {
    var user = Security.identity(auth);
    boolean worker =
        Boolean.TRUE.equals(
            db.sql.queryForObject(
                "select coalesce(bool_or(ready and updated_at > now()-interval '90 seconds'),false)"
                    + " from service_heartbeats where service='local-ai'",
                Boolean.class));
    var result = new LinkedHashMap<String, Object>();
    result.put("api", "ready");
    result.put("processing", worker ? "ready" : "unavailable");
    result.put("demo", user.role().equals("DEMO"));
    result.put("sharedWorkspace", workspaces.isShared(user));
    if (user.role().equals("DEMO")) {
      result.put(
          "catalogVersion",
          Objects.toString(
              db.sql.queryForObject(
                  "select demo_seed_version from tenants where id=?", String.class, user.tenant()),
              ""));
      result.put("expiresAt", user.expiresAt());
      result.put("maxFiles", workspaces.maxFiles(user));
      result.put("maxFileMb", 25);
      result.put("maxMinutes", 5);
    }
    return result;
  }
}
