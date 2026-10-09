package az.csi;

import jakarta.servlet.*;
import jakarta.servlet.http.*;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.*;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.filter.OncePerRequestFilter;

// Registered only in the security chain, never as a servlet filter bean.
class IngestionAuthenticationFilter extends OncePerRequestFilter {
  final Database db;

  IngestionAuthenticationFilter(Database db) {
    this.db = db;
  }

  @Override
  protected boolean shouldNotFilter(HttpServletRequest request) {
    return !request.getServletPath().equals("/api/v1/ingestion/recordings");
  }

  @Override
  protected void doFilterInternal(
      HttpServletRequest request, HttpServletResponse response, FilterChain chain)
      throws ServletException, IOException {
    SecurityContextHolder.clearContext();
    String header = request.getHeader("Authorization");
    if (header == null || !header.startsWith("Bearer ") || header.length() > 200) {
      response.sendError(401);
      return;
    }
    String token = header.substring(7);
    UUID tenant, source;
    try {
      String[] parts = token.split("\\.");
      if (parts.length != 3 || !parts[2].matches("[A-Za-z0-9_-]{43}"))
        throw new IllegalArgumentException();
      tenant = UUID.fromString(parts[0]);
      source = UUID.fromString(parts[1]);
    } catch (IllegalArgumentException e) {
      response.sendError(401);
      return;
    }
    boolean valid =
        db.tenant(
            tenant,
            () -> {
              var rows =
                  db.sql.queryForList(
                      "select token_hash from ingestion_sources where id=? and enabled", source);
              return !rows.isEmpty()
                  && MessageDigest.isEqual(
                      rows.getFirst().get("token_hash").toString().getBytes(StandardCharsets.UTF_8),
                      IngestionController.hash(token).getBytes(StandardCharsets.UTF_8));
            });
    if (!valid) {
      response.sendError(401);
      return;
    }
    var context = SecurityContextHolder.createEmptyContext();
    context.setAuthentication(
        new UsernamePasswordAuthenticationToken(
            new Security.Identity(source, tenant, "ingestion-source", "INGEST"),
            null,
            List.of(new SimpleGrantedAuthority("ROLE_INGEST"))));
    SecurityContextHolder.setContext(context);
    try {
      chain.doFilter(request, response);
    } finally {
      SecurityContextHolder.clearContext();
    }
  }
}
