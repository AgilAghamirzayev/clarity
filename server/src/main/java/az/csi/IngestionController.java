package az.csi;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.nio.charset.StandardCharsets;
import java.security.*;
import java.util.*;
import org.springframework.http.*;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/v1/ingestion/sources")
class IngestionController {
  final Database db;

  IngestionController(Database db) {
    this.db = db;
  }

  record Source(@NotBlank @Size(max = 80) String name) {}

  static String hash(String token) {
    try {
      return HexFormat.of()
          .formatHex(
              MessageDigest.getInstance("SHA-256").digest(token.getBytes(StandardCharsets.UTF_8)));
    } catch (NoSuchAlgorithmException e) {
      throw new IllegalStateException(e);
    }
  }

  @GetMapping
  Object list(Authentication auth) {
    var u = Security.identity(auth);
    Security.require(u, "ADMIN");
    return db.tenant(
        u.tenant(),
        () ->
            db.sql.queryForList(
                "select id,name,enabled,created_at,last_received_at from ingestion_sources order by"
                    + " created_at desc"));
  }

  @PostMapping
  ResponseEntity<Object> create(Authentication auth, @Valid @RequestBody Source input) {
    var u = Security.identity(auth);
    Security.require(u, "ADMIN");
    UUID id = UUID.randomUUID();
    byte[] secret = new byte[32];
    new SecureRandom().nextBytes(secret);
    String token =
        u.tenant()
            + "."
            + id
            + "."
            + Base64.getUrlEncoder().withoutPadding().encodeToString(secret);
    db.tenant(
        u.tenant(),
        () -> {
          db.sql.update(
              "insert into ingestion_sources(id,tenant_id,name,token_hash) values (?,?,?,?)",
              id,
              u.tenant(),
              input.name(),
              hash(token));
          db.audit(u, "ingestion-source.create", id.toString());
          return null;
        });
    return ResponseEntity.status(201)
        .cacheControl(CacheControl.noStore())
        .body(Map.of("id", id, "token", token, "endpoint", "/api/v1/ingestion/recordings"));
  }

  @DeleteMapping("/{id}")
  Object revoke(Authentication auth, @PathVariable UUID id) {
    var u = Security.identity(auth);
    Security.require(u, "ADMIN");
    return db.tenant(
        u.tenant(),
        () -> {
          if (db.sql.update("update ingestion_sources set enabled=false where id=?", id) != 1)
            throw new ResponseStatusException(HttpStatus.NOT_FOUND);
          db.audit(u, "ingestion-source.revoke", id.toString());
          return Map.of("status", "REVOKED");
        });
  }
}
