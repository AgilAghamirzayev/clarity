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
  final AnalysisProfiles profiles;

  CallController(Database db, AudioStore audio, AnalysisProfiles profiles) {
    this.db = db;
    this.audio = audio;
    this.profiles = profiles;
  }

  record ImportMetadata(
      @Size(max = 120) String title,
      boolean sample,
      @NotBlank @Size(max = 128) String customerId,
      @NotBlank @Size(max = 80) String agent,
      @NotBlank @Size(max = 80) String department,
      @NotNull Instant recordedAt,
      @Pattern(regexp = "[a-z]{2}") String language,
      @Min(1) @Max(8) Integer speakers,
      @Min(0) @Max(1) Integer customerChannel) {}

  @PostMapping(
      value = {"/calls/import", "/ingestion/recordings"},
      consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
  ResponseEntity<Map<String, Object>> upload(
      Authentication auth,
      @RequestHeader("Idempotency-Key") @Size(min = 8, max = 128) String key,
      @RequestPart("metadata") @Valid ImportMetadata metadata,
      @RequestPart("audio") MultipartFile file)
      throws Exception {
    var user = Security.identity(auth);
    Security.require(user, "ADMIN", "ANALYST", "DEMO", "INGEST");
    if (key.length() < 8
        || key.length() > 128
        || file.isEmpty()
        || file.getSize() > 100 * 1024 * 1024)
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST);
    if (user.role().equals("DEMO") && file.getSize() > 25 * 1024 * 1024)
      throw new ResponseStatusException(
          HttpStatus.BAD_REQUEST, "Live demo files must be at most 25 MB");
    final String importKey = user.role().equals("INGEST") ? user.id() + ":" + key : key;
    String type;
    String digest;
    try (var stream = file.getInputStream()) {
      type = AudioStore.mediaType(stream.readNBytes(32));
    }
    try (var stream = file.getInputStream()) {
      var hash = MessageDigest.getInstance("SHA-256");
      byte[] block = new byte[65536];
      int n;
      while ((n = stream.read(block)) != -1) hash.update(block, 0, n);
      digest = HexFormat.of().formatHex(hash.digest());
    }
    String fingerprint = IngestionController.hash(digest + db.encode(metadata));
    var replay = replay(user, importKey, digest, fingerprint);
    if (replay != null) return replay;
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
    data.put("requestFingerprint", fingerprint);
    if (user.role().equals("INGEST")) data.put("sourceId", user.id().toString());
    data.put("title", metadata.title());
    data.put("sample", metadata.sample());
    if (user.role().equals("DEMO")) data.put("maxAudioSeconds", 300);
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
            if (user.role().equals("DEMO")) {
              db.sql.queryForList(
                  "select pg_advisory_xact_lock(hashtextextended(?,2))", user.tenant().toString());
              if (db.sql.queryForObject(
                      "select count(*) from calls where metadata->>'demoSeedVersion' is null",
                      Integer.class)
                  >= 5)
                throw new ResponseStatusException(
                    HttpStatus.TOO_MANY_REQUESTS,
                    "This demo workspace allows up to five recordings");
            }
            data.put("analysisProfile", profiles.snapshot());
            db.sql.update(
                "insert into calls(id,tenant_id,import_key,audio_key,sha256,content_type,metadata)"
                    + " values (?,?,?,?,?,?,?::jsonb)",
                id,
                user.tenant(),
                importKey,
                object,
                digest,
                type,
                db.encode(data));
            if (user.role().equals("INGEST"))
              db.sql.update(
                  "update ingestion_sources set last_received_at=now() where id=? and enabled",
                  user.id());
            db.event(user.tenant(), "call.imported", id, 1);
            db.audit(user, "call.import", id.toString());
            return null;
          });
    } catch (RuntimeException error) {
      audio.delete(object);
      // A concurrent delivery may have committed this event while the object was uploading.
      if (error instanceof org.springframework.dao.DuplicateKeyException) {
        var concurrent = replay(user, importKey, digest, fingerprint);
        if (concurrent != null) return concurrent;
      }
      throw error;
    }
    return ResponseEntity.accepted().body(Map.of("id", id, "status", "QUEUED"));
  }

  ResponseEntity<Map<String, Object>> replay(
      Security.Identity user, String key, String digest, String fingerprint) {
    var rows =
        db.tenant(
            user.tenant(),
            () ->
                db.sql.queryForList(
                    "select id,status,sha256,metadata from calls where import_key=?", key));
    if (rows.isEmpty()) return null;
    var row = rows.getFirst();
    var metadata = db.decode(row.get("metadata"));
    if (!digest.equals(row.get("sha256"))
        || (metadata.containsKey("requestFingerprint")
            && !fingerprint.equals(metadata.get("requestFingerprint"))))
      throw new ResponseStatusException(
          HttpStatus.CONFLICT, "Import key belongs to different audio or metadata");
    return ResponseEntity.ok(Map.of("id", row.get("id"), "status", row.get("status")));
  }

  @GetMapping("/calls")
  Object calls(Authentication auth) {
    var u = Security.identity(auth);
    return db.tenant(
        u.tenant(),
        () ->
            db.sql.query(
                "select"
                    + " id,display_number,status,stage,error_code,attempts,metadata,analysis->>'topic'"
                    + " topic,created_at from calls order by created_at desc limit 500",
                (r, n) -> {
                  var row = new LinkedHashMap<String, Object>();
                  for (String key :
                      List.of(
                          "id", "status", "stage", "error_code", "attempts", "topic", "created_at"))
                    row.put(key, r.getObject(key));
                  row.put("reference", "CALL-" + r.getLong("display_number"));
                  row.put("metadata", db.decode(r.getObject("metadata")));
                  return row;
                }));
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
          var metadata = db.decode(row.get("metadata"));
          for (String key : List.of("transcript", "analysis"))
            if (row.get(key) != null) row.put(key, db.decode(row.get(key)));
          row.put("reference", "CALL-" + row.get("display_number"));
          metadata.put(
              "customer",
              metadata.containsKey("demoSeedVersion")
                  ? metadata.get("customerLabel")
                  : "Customer "
                      + db.sql.queryForObject(
                          "select min(display_number) from calls where metadata->>'customer'=?",
                          Long.class,
                          metadata.get("customer")));
          row.put("metadata", metadata);
          row.put(
              "issueIds",
              db.sql.queryForList(
                  "select issue_id::text from call_issues where call_id=? order by mentions desc",
                  String.class,
                  id));
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
    Security.require(u, "ADMIN", "ANALYST", "DEMO");
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
    Security.require(u, "ADMIN", "ANALYST", "DEMO");
    return db.tenant(
        u.tenant(),
        () -> {
          if (u.role().equals("DEMO") && ((Number) find(id).get("generation")).intValue() >= 3)
            throw new ResponseStatusException(
                HttpStatus.TOO_MANY_REQUESTS, "Demo retry limit reached");
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
