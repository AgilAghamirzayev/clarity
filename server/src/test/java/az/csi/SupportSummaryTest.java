package az.csi;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.*;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

@SpringBootTest
@AutoConfigureMockMvc
@Transactional
@EnabledIfEnvironmentVariable(named = "CSI_INTEGRATION_TESTS", matches = "true")
class SupportSummaryTest {
  @Autowired Database db;
  @Autowired SupportSummaryController controller;
  @Autowired MockMvc mvc;
  UUID tenant = UUID.randomUUID(), other = UUID.randomUUID();
  Security.Identity user;
  Instant end = Instant.now().truncatedTo(ChronoUnit.SECONDS);

  @BeforeEach
  void seed() {
    db.sql.update(
        "insert into tenants(id,slug) values (?,?),(?,?)",
        tenant,
        "summary-" + tenant,
        other,
        "summary-" + other);
    user = new Security.Identity(UUID.randomUUID(), tenant, "summary@example.test", "ADMIN");
    call(tenant, "customer-a", end.minus(1, ChronoUnit.DAYS), false, "Negative", 60);
    call(tenant, "customer-a", end.minus(2, ChronoUnit.DAYS), false, "Positive", 120);
    call(tenant, "sample-customer", end.minus(1, ChronoUnit.DAYS), true, "Negative", 30);
    call(tenant, "customer-b", end.minus(7, ChronoUnit.DAYS), false, "Positive", 90);
    call(tenant, "future-customer", end.plus(1, ChronoUnit.DAYS), false, "Negative", 30);
    call(other, "other-customer", end.minus(1, ChronoUnit.DAYS), false, "Negative", 30);
  }

  void call(UUID t, String customer, Instant date, boolean sample, String sentiment, int duration) {
    db.tenant(
        t,
        () ->
            db.sql.update(
                "insert into"
                    + " calls(id,tenant_id,import_key,audio_key,sha256,content_type,status,metadata,transcript,analysis)"
                    + " values"
                    + " (?,?,?,'test','test','audio/wav','COMPLETED',?::jsonb,?::jsonb,?::jsonb)",
                UUID.randomUUID(),
                t,
                UUID.randomUUID().toString(),
                db.encode(Map.of("customer", customer, "date", date.toString(), "sample", sample)),
                db.encode(Map.of("duration", duration)),
                db.encode(
                    Map.of(
                        "summary",
                        "Customer requested support.",
                        "sentiment",
                        sentiment,
                        "topic",
                        "Account support"))));
  }

  @Test
  void periodsUseRecordedTimeAndSeparateSamplesAndTenants() {
    var snapshot = db.tenant(tenant, () -> controller.snapshot(7, false, end));
    var current = (Map<?, ?>) snapshot.get("current");
    var previous = (Map<?, ?>) snapshot.get("previous");
    assertEquals(2L, current.get("calls"));
    assertEquals(1L, current.get("customers"));
    assertEquals(50.0, current.get("negativeRate"));
    assertEquals(100.0, current.get("repeatRate"));
    assertEquals(90.0, ((Number) current.get("averageDuration")).doubleValue());
    assertEquals(1L, previous.get("calls"));
    assertEquals(2, ((List<?>) snapshot.get("evidence")).size());
    var withSamples = db.tenant(tenant, () -> controller.snapshot(7, true, end));
    assertEquals(3L, ((Map<?, ?>) withSamples.get("current")).get("calls"));
  }

  @Test
  void emptyPeriodsHaveNoInventedRates() {
    var snapshot =
        db.tenant(tenant, () -> controller.snapshot(7, false, end.minus(90, ChronoUnit.DAYS)));
    var current = (Map<?, ?>) snapshot.get("current");
    assertEquals(0L, current.get("calls"));
    assertNull(current.get("negativeRate"));
    assertNull(current.get("repeatRate"));
    assertNull(current.get("averageDuration"));
  }

  @Test
  void reportRequestIsIdempotentAndTenantIsolated() {
    var auth = new UsernamePasswordAuthenticationToken(user, null, List.of());
    String key = UUID.randomUUID().toString();
    var input = new SupportSummaryController.Request(90, true);
    var first = (Map<?, ?>) controller.generate(auth, key, input).getBody();
    var replay = (Map<?, ?>) controller.generate(auth, key, input).getBody();
    assertEquals(first.get("id").toString(), replay.get("id").toString());
    assertEquals(
        1L,
        db.tenant(
            tenant,
            () ->
                db.sql.queryForObject(
                    "select count(*) from outbox where type='summary.requested' and resource_id=?",
                    Long.class,
                    first.get("id"))));
    assertEquals(
        0L,
        db.tenant(
            other,
            () -> db.sql.queryForObject("select count(*) from support_summaries", Long.class)));
    assertThrows(
        org.springframework.web.server.ResponseStatusException.class,
        () -> controller.generate(auth, UUID.randomUUID().toString(), input));
    assertThrows(
        org.springframework.web.server.ResponseStatusException.class,
        () -> controller.generate(auth, key, new SupportSummaryController.Request(7, false)));
  }

  @Test
  void viewersCannotGenerateAndWritesRequireCsrf() throws Exception {
    var viewer = new Security.Identity(UUID.randomUUID(), tenant, "viewer@example.test", "VIEWER");
    var auth = new UsernamePasswordAuthenticationToken(viewer, null, List.of());
    mvc.perform(
            post("/api/v1/support-summary")
                .with(authentication(auth))
                .with(csrf())
                .header("Idempotency-Key", UUID.randomUUID().toString())
                .contentType("application/json")
                .content("{\"days\":7,\"includeSamples\":true}"))
        .andExpect(status().isForbidden());
    mvc.perform(
            post("/api/v1/support-summary")
                .with(
                    authentication(new UsernamePasswordAuthenticationToken(user, null, List.of())))
                .header("Idempotency-Key", UUID.randomUUID().toString())
                .contentType("application/json")
                .content("{\"days\":7}"))
        .andExpect(status().isForbidden());
  }

  @Test
  void evidenceDetailsAreReadableAndTenantScoped() throws Exception {
    UUID own =
        db.tenant(tenant, () -> db.sql.queryForObject("select id from calls limit 1", UUID.class));
    UUID foreign =
        db.tenant(other, () -> db.sql.queryForObject("select id from calls limit 1", UUID.class));
    var auth = new UsernamePasswordAuthenticationToken(user, null, List.of());
    mvc.perform(get("/api/v1/calls/" + own).with(authentication(auth)))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.reference").value(org.hamcrest.Matchers.startsWith("CALL-")))
        .andExpect(
            jsonPath("$.metadata.customer").value(org.hamcrest.Matchers.startsWith("Customer ")))
        .andExpect(jsonPath("$.issueIds").isArray());
    mvc.perform(get("/api/v1/calls/" + foreign).with(authentication(auth)))
        .andExpect(status().isNotFound());
  }
}
