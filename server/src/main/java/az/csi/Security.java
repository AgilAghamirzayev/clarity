package az.csi;

import jakarta.servlet.http.*;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.io.Serializable;
import java.util.*;
import org.springframework.context.annotation.*;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.context.HttpSessionSecurityContextRepository;
import org.springframework.security.web.csrf.CsrfToken;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

@Configuration
public class Security {
  public record Identity(UUID id, UUID tenant, String email, String role)
      implements Serializable, java.security.Principal {
    @Override
    public String getName() {
      return id.toString();
    }
  }

  @Bean
  BCryptPasswordEncoder passwords() {
    return new BCryptPasswordEncoder(12);
  }

  @Bean
  SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
    return http.authorizeHttpRequests(
            a ->
                a.requestMatchers("/api/v1/auth/csrf", "/api/v1/auth/login", "/health")
                    .permitAll()
                    .anyRequest()
                    .authenticated())
        .exceptionHandling(
            e ->
                e.authenticationEntryPoint((q, s, x) -> s.sendError(401))
                    .accessDeniedHandler((q, s, x) -> s.sendError(403)))
        .logout(
            l ->
                l.logoutUrl("/api/v1/auth/logout")
                    .logoutSuccessHandler((q, s, a) -> s.setStatus(204)))
        .headers(
            h ->
                h.contentSecurityPolicy(
                    c -> c.policyDirectives("default-src 'none'; frame-ancestors 'none'")))
        .build();
  }

  static Identity identity(Authentication auth) {
    return (Identity) auth.getPrincipal();
  }

  static void require(Identity u, String... roles) {
    if (!Arrays.asList(roles).contains(u.role()))
      throw new ResponseStatusException(HttpStatus.FORBIDDEN);
  }
}

@RestController
class AuthController {
  private final Database db;
  private final BCryptPasswordEncoder passwords;
  private final String dummy;

  AuthController(Database db, BCryptPasswordEncoder passwords) {
    this.db = db;
    this.passwords = passwords;
    dummy = passwords.encode(UUID.randomUUID().toString());
  }

  record Login(
      @NotBlank @Size(max = 80) String tenant,
      @Email @NotBlank @Size(max = 254) String email,
      @NotBlank @Size(max = 200) String password) {}

  @GetMapping("/health")
  Map<String, String> health() {
    db.sql.queryForObject("select 1", Integer.class);
    return Map.of("status", "UP");
  }

  @GetMapping("/api/v1/auth/csrf")
  Map<String, String> csrf(CsrfToken token) {
    return Map.of("token", token.getToken(), "headerName", token.getHeaderName());
  }

  @GetMapping("/api/v1/auth/me")
  Security.Identity me(Authentication auth) {
    return Security.identity(auth);
  }

  @PostMapping("/api/v1/auth/login")
  Security.Identity login(
      @Valid @RequestBody Login input, HttpServletRequest request, HttpServletResponse response) {
    String key = input.tenant().toLowerCase() + ":" + input.email().toLowerCase();
    int count =
        db.tx.execute(
            s ->
                db.sql.queryForObject(
                    "insert into login_attempts(identity,attempts,window_start) values (?,1,now())"
                        + " on conflict(identity) do update set attempts=case when"
                        + " login_attempts.window_start < now()-interval '15 minutes' then 1 else"
                        + " login_attempts.attempts+1 end, window_start=case when"
                        + " login_attempts.window_start < now()-interval '15 minutes' then now()"
                        + " else login_attempts.window_start end returning attempts",
                    Integer.class,
                    key));
    if (count > 10)
      throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS, "Try again later");
    var users =
        db.sql.queryForList(
            "select u.* from users u join tenants t on t.id=u.tenant_id where t.slug=? and"
                + " u.email=? and enabled",
            input.tenant().toLowerCase(),
            input.email().toLowerCase());
    boolean ok =
        passwords.matches(
            input.password(),
            users.isEmpty() ? dummy : users.getFirst().get("password_hash").toString());
    if (!ok || users.isEmpty())
      throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid credentials");
    var row = users.getFirst();
    var user =
        new Security.Identity(
            (UUID) row.get("id"),
            (UUID) row.get("tenant_id"),
            row.get("email").toString(),
            row.get("role").toString());
    if (request.getSession(false) != null) request.getSession().invalidate();
    request.getSession(true);
    var context = SecurityContextHolder.createEmptyContext();
    context.setAuthentication(
        new UsernamePasswordAuthenticationToken(
            user, null, List.of(new SimpleGrantedAuthority("ROLE_" + user.role()))));
    SecurityContextHolder.setContext(context);
    new HttpSessionSecurityContextRepository().saveContext(context, request, response);
    db.sql.update("delete from login_attempts where identity=?", key);
    db.tenant(
        user.tenant(),
        () -> {
          db.audit(user, "auth.login", user.id().toString());
          return null;
        });
    return user;
  }
}
