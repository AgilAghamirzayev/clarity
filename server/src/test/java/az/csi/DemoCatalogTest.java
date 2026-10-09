package az.csi;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

import java.time.Instant;
import java.util.*;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.web.server.ResponseStatusException;

@SpringBootTest
@EnabledIfEnvironmentVariable(named = "CSI_INTEGRATION_TESTS", matches = "true")
class DemoCatalogTest {
  @Autowired Database db;
  @Autowired AnalysisProfiles profiles;
  @Autowired SupportSummaryController summaries;
  final List<UUID> createdTenants = new ArrayList<>();

  @AfterEach
  void expireTestWorkspaces() {
    for (UUID tenant : createdTenants) {
      db.sql.update("delete from outbox where tenant_id=?", tenant);
      db.sql.update(
          "update tenants set demo_expires_at=now()-interval '25 hours' where id=?", tenant);
    }
  }

  UUID guest() {
    UUID id = UUID.randomUUID();
    createdTenants.add(id);
    db.sql.update(
        "insert into tenants(id,slug,demo_expires_at) values (?,?,now()+interval '24 hours')",
        id,
        "catalog-test-" + id);
    return id;
  }

  @Test
  void catalogIsCompleteIsolatedIdempotentAndHasValidEvidence() {
    var audio = mock(AudioStore.class);
    var catalog = new DemoCatalog(db, audio, summaries, true);
    UUID a = guest(), b = guest();
    catalog.ensure(a);
    catalog.ensure(b);
    catalog.ensure(a);
    verify(audio, times(16)).put(anyString(), any(), anyLong(), eq("audio/wav"));
    var ids = db.tenant(a, () -> db.sql.queryForList("select id from calls", UUID.class));
    assertEquals(8, ids.size());
    db.tenant(
        b,
        () -> {
          assertEquals(8, db.sql.queryForObject("select count(*) from calls", Integer.class));
          for (UUID id : ids)
            assertEquals(
                0,
                db.sql.queryForObject("select count(*) from calls where id=?", Integer.class, id));
          return null;
        });
    db.tenant(
        a,
        () -> {
          assertEquals(
              0,
              db.sql.queryForObject(
                  "select count(*) from outbox where tenant_id=?", Integer.class, a));
          assertEquals(3, db.sql.queryForObject("select count(*) from decisions", Integer.class));
          assertEquals(
              5, db.sql.queryForObject("select count(*) from recommendations", Integer.class));
          var calls =
              db.sql.queryForList("select 'CALL-' || display_number from calls", String.class);
          for (var row : db.sql.queryForList("select snapshot,report from support_summaries")) {
            var snapshot = db.decode(row.get("snapshot"));
            var report = db.decode(row.get("report"));
            @SuppressWarnings("unchecked")
            var advice = (List<Map<String, Object>>) report.get("advice");
            @SuppressWarnings("unchecked")
            var evidence = (List<Map<String, Object>>) snapshot.get("evidence");
            var refs = evidence.stream().map(e -> e.get("reference")).toList();
            assertTrue(calls.containsAll(refs));
            for (var finding : advice)
              assertTrue(refs.containsAll((List<?>) finding.get("evidenceRefs")));
          }
          return null;
        });
  }

  @Test
  void preparedRecordingsDoNotConsumeGuestUploadAllowance() throws Exception {
    var audio = mock(AudioStore.class);
    UUID tenant = guest();
    new DemoCatalog(db, audio, summaries, true).ensure(tenant);
    var controller = new CallController(db, audio, profiles);
    var auth =
        new UsernamePasswordAuthenticationToken(
            new Security.Identity(
                UUID.randomUUID(), tenant, "Demo visitor", "DEMO", Instant.now().plusSeconds(3600)),
            null,
            List.of());
    byte[] header = new byte[32];
    System.arraycopy("RIFF".getBytes(java.nio.charset.StandardCharsets.US_ASCII), 0, header, 0, 4);
    System.arraycopy("WAVE".getBytes(java.nio.charset.StandardCharsets.US_ASCII), 0, header, 8, 4);
    var file = new MockMultipartFile("audio", "test.wav", "audio/wav", header);
    var metadata =
        new CallController.ImportMetadata(
            "Test upload", false, "customer", "Advisor", "Support", Instant.now(), "en", 2, 0);
    for (int i = 0; i < 5; i++)
      assertEquals(
          202, controller.upload(auth, "quota-test-" + i, metadata, file).getStatusCode().value());
    var error =
        assertThrows(
            ResponseStatusException.class,
            () -> controller.upload(auth, "quota-test-six", metadata, file));
    assertEquals(429, error.getStatusCode().value());
  }

  @Test
  void interruptedSeedRollsBackAndCanBeRetried() {
    UUID tenant = guest();
    var audio = mock(AudioStore.class);
    doThrow(new IllegalStateException("Storage unavailable"))
        .when(audio)
        .put(anyString(), any(), anyLong(), anyString());
    var catalog = new DemoCatalog(db, audio, summaries, true);
    assertThrows(IllegalStateException.class, () -> catalog.ensure(tenant));
    assertNull(
        db.sql.queryForObject(
            "select demo_seed_version from tenants where id=?", String.class, tenant));
    assertEquals(
        0,
        db.tenant(
            tenant, () -> db.sql.queryForObject("select count(*) from calls", Integer.class)));
    reset(audio);
    catalog.ensure(tenant);
    UUID upload = UUID.randomUUID();
    db.tenant(
        tenant,
        () ->
            db.sql.update(
                "insert into"
                    + " calls(id,tenant_id,import_key,audio_key,sha256,content_type,metadata,transcript)"
                    + " values"
                    + " (?,?,?,?,'hash','audio/wav','{\"sample\":true}','{\"segments\":[{\"text\":\"Keep"
                    + " [PII] root cause masked in a user upload\"}]}')",
                upload,
                tenant,
                "user-owned-upload",
                tenant + "/" + upload + "/audio"));
    catalog.ensure(tenant);
    assertTrue(
        db.tenant(
                tenant,
                () ->
                    db.sql.queryForObject(
                        "select transcript::text from calls where id=?", String.class, upload))
            .contains("Keep [PII] root cause masked"));
    assertEquals(
        9,
        db.tenant(
            tenant, () -> db.sql.queryForObject("select count(*) from calls", Integer.class)));
  }
}
