package az.csi;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.*;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import org.springframework.http.*;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/v1")
class CallController {
  final Database db;
  final AudioStore audio;

  CallController(Database db, AudioStore audio) {
    this.db = db;
    this.audio = audio;
  }

  record ImportMetadata(
      @NotBlank @Size(max = 128) String customerId,
      @NotBlank @Size(max = 80) String agent,
      @NotBlank @Size(max = 80) String department,
      @NotNull Instant recordedAt,
      @Pattern(regexp = "[a-z]{2}") String language,
      @Min(1) @Max(8) Integer speakers,
      @Min(0) @Max(1) Integer customerChannel) {}

  @PostMapping(value = "/calls/import", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
  ResponseEntity<Map<String, Object>> upload(
      Authentication auth,
      @RequestHeader("Idempotency-Key") @Size(min = 8, max = 128) String key,
      @RequestPart("metadata") @Valid ImportMetadata metadata,
      @RequestPart("audio") MultipartFile file)
      throws Exception {
    var user = Security.identity(auth);
    Security.require(user, "ADMIN", "ANALYST");
    if (key.length() < 8
        || key.length() > 128
        || file.isEmpty()
        || file.getSize() > 100 * 1024 * 1024)
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST);
    String type;
    String digest;
    try (var stream = file.getInputStream()) {
      type = AudioStore.mediaType(stream.readNBytes(12));
    }
    try (var stream = file.getInputStream()) {
      var hash = MessageDigest.getInstance("SHA-256");
      byte[] block = new byte[65536];
      int n;
      while ((n = stream.read(block)) != -1) hash.update(block, 0, n);
      digest = HexFormat.of().formatHex(hash.digest());
    }
    var existing =
        db.tenant(
            user.tenant(),
            () ->
                db.sql.queryForList("select id,status,sha256 from calls where import_key=?", key));
    if (!existing.isEmpty()) {
      if (!digest.equals(existing.getFirst().get("sha256")))
        throw new ResponseStatusException(
            HttpStatus.CONFLICT, "Import key belongs to different audio");
      return ResponseEntity.ok(
          Map.of("id", existing.getFirst().get("id"), "status", existing.getFirst().get("status")));
    }
    UUID id = UUID.randomUUID();
    String object = user.tenant() + "/" + id + "/audio";
    Mac mac = Mac.getInstance("HmacSHA256");
    mac.init(
        new SecretKeySpec(
            System.getenv("DB_APP_PASSWORD").getBytes(java.nio.charset.StandardCharsets.UTF_8),
            "HmacSHA256"));
    String customer =
        "Customer-"
            + HexFormat.of()
                .formatHex(
                    mac.doFinal(
                        (user.tenant() + ":" + metadata.customerId())
                            .getBytes(java.nio.charset.StandardCharsets.UTF_8)))
                .substring(0, 20);
    Map<String, Object> data = new LinkedHashMap<>();
    data.put("customer", customer);
    data.put("agent", metadata.agent());
    data.put("department", metadata.department());
    data.put("date", metadata.recordedAt().toString());
    data.put("language", metadata.language());
    data.put("speakers", metadata.speakers());
    data.put("customerChannel", metadata.customerChannel());
    try (var stream = file.getInputStream()) {
      audio.put(object, stream, file.getSize(), type);
    }
    try {
      db.tenant(
          user.tenant(),
          () -> {
            db.sql.update(
                "insert into calls(id,tenant_id,import_key,audio_key,sha256,content_type,metadata)"
                    + " values (?,?,?,?,?,?,?::jsonb)",
                id,
                user.tenant(),
                key,
                object,
                digest,
                type,
                db.encode(data));
            db.event(user.tenant(), "call.imported", id, 1);
            db.audit(user, "call.import", id.toString());
            return null;
          });
    } catch (RuntimeException error) {
      audio.delete(object);
      throw error;
    }
    return ResponseEntity.accepted().body(Map.of("id", id, "status", "QUEUED"));
  }

  @GetMapping("/calls")
  Object calls(Authentication auth) {
    var u = Security.identity(auth);
    return db.tenant(
        u.tenant(),
        () ->
            db.sql.queryForList(
                "select id,status,stage,error_code,attempts,metadata,created_at from calls order by"
                    + " created_at desc limit 500"));
  }

  Map<String, Object> find(UUID id) {
    var rows = db.sql.queryForList("select * from calls where id=?", id);
    if (rows.isEmpty()) throw new ResponseStatusException(HttpStatus.NOT_FOUND);
    return rows.getFirst();
  }

  @GetMapping("/calls/{id}")
  Object call(Authentication auth, @PathVariable UUID id) {
    var u = Security.identity(auth);
    return db.tenant(
        u.tenant(),
        () -> {
          var row = find(id);
          row.remove("audio_key");
          row.remove("sha256");
          row.remove("import_key");
          for (String key : List.of("metadata", "transcript", "analysis"))
            if (row.get(key) != null) row.put(key, db.decode(row.get(key)));
          return row;
        });
  }

  @GetMapping("/calls/{id}/transcript")
  Object transcript(Authentication auth, @PathVariable UUID id) {
    var u = Security.identity(auth);
    return db.tenant(
        u.tenant(),
        () -> {
          var row = find(id);
          db.audit(u, "transcript.read", id.toString());
          return row.get("transcript") == null
              ? Map.of("status", row.get("status"))
              : db.decode(row.get("transcript"));
        });
  }

  @GetMapping("/calls/{id}/analysis")
  Object analysis(Authentication auth, @PathVariable UUID id) {
    var u = Security.identity(auth);
    return db.tenant(
        u.tenant(),
        () -> {
          var row = find(id);
          return row.get("analysis") == null
              ? Map.of("status", row.get("status"))
              : db.decode(row.get("analysis"));
        });
  }

  @GetMapping("/calls/{id}/audio")
  ResponseEntity<byte[]> download(Authentication auth, @PathVariable UUID id) {
    var u = Security.identity(auth);
    Security.require(u, "ADMIN", "ANALYST");
    var row =
        db.tenant(
            u.tenant(),
            () -> {
              var r = find(id);
              db.audit(u, "audio.read", id.toString());
              return r;
            });
    return ResponseEntity.ok()
        .contentType(MediaType.parseMediaType(row.get("content_type").toString()))
        .header("Cache-Control", "no-store")
        .header("Content-Disposition", "inline; filename=recording")
        .body(audio.get(row.get("audio_key").toString()));
  }

  @PostMapping("/calls/{id}/retry")
  Object retry(Authentication auth, @PathVariable UUID id) {
    var u = Security.identity(auth);
    Security.require(u, "ADMIN", "ANALYST");
    return db.tenant(
        u.tenant(),
        () -> {
          var rows =
              db.sql.queryForList(
                  "update calls set"
                      + " status='QUEUED',error_code=null,generation=generation+1,updated_at=now()"
                      + " where id=? and status='FAILED' returning generation",
                  id);
          if (rows.isEmpty())
            throw new ResponseStatusException(
                HttpStatus.CONFLICT, "Only failed calls can be retried");
          db.event(
              u.tenant(),
              "call.imported",
              id,
              ((Number) rows.getFirst().get("generation")).intValue());
          db.audit(u, "call.retry", id.toString());
          return Map.of("status", "QUEUED");
        });
  }
}
