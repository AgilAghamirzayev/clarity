package az.csi;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import java.util.*;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest
@AutoConfigureMockMvc
@EnabledIfEnvironmentVariable(named = "CSI_INTEGRATION_TESTS", matches = "true")
class PlatformTest {
  @Autowired MockMvc mvc;
  @Autowired Database db;
  UUID a = UUID.randomUUID(), b = UUID.randomUUID(), call = UUID.randomUUID();
  Security.Identity admin;

  @BeforeEach
  void seed() {
    db.sql.update(
        "insert into tenants(id,slug) values (?,?),(?,?)", a, "test-" + a, b, "test-" + b);
    admin = new Security.Identity(UUID.randomUUID(), a, "test@example.test", "ADMIN");
    db.tenant(
        a,
        () ->
            db.sql.update(
                "insert into calls(id,tenant_id,import_key,audio_key,sha256,content_type,metadata)"
                    + " values (?,?,?,'test','hash','audio/wav','{}')",
                call,
                a,
                UUID.randomUUID().toString()));
  }

  org.springframework.test.web.servlet.request.RequestPostProcessor as(Security.Identity user) {
    return authentication(
        new UsernamePasswordAuthenticationToken(
            user, null, List.of(new SimpleGrantedAuthority("ROLE_" + user.role()))));
  }

  @Test
  void postgresEnforcesIsolationEvenWithoutTenantWhereClause() {
    assertEquals(
        1,
        db.tenant(
            a,
            () ->
                db.sql.queryForObject(
                    "select count(*) from calls where id=?", Integer.class, call)));
    assertEquals(
        0,
        db.tenant(
            b,
            () ->
                db.sql.queryForObject(
                    "select count(*) from calls where id=?", Integer.class, call)));
    assertEquals(
        0, db.sql.queryForObject("select count(*) from calls where id=?", Integer.class, call));
  }

  @Test
  void cannotReadAnotherTenantsCall() throws Exception {
    var other = new Security.Identity(UUID.randomUUID(), b, "other@example.test", "ADMIN");
    mvc.perform(get("/api/v1/calls/" + call).with(as(other))).andExpect(status().isNotFound());
  }

  @Test
  void authAndCsrfAreRequired() throws Exception {
    mvc.perform(get("/api/v1/workspace")).andExpect(status().isUnauthorized());
    mvc.perform(post("/api/v1/calls/" + call + "/retry").with(as(admin)))
        .andExpect(status().isForbidden());
  }

  @Test
  void viewerCannotRetryEvenWithCsrf() throws Exception {
    var viewer = new Security.Identity(UUID.randomUUID(), a, "viewer@example.test", "VIEWER");
    mvc.perform(post("/api/v1/calls/" + call + "/retry").with(as(viewer)).with(csrf()))
        .andExpect(status().isForbidden());
  }

  @Test
  void retryAndOutboxAreAtomicAndOnlyFailedCallsRetry() throws Exception {
    mvc.perform(post("/api/v1/calls/" + call + "/retry").with(as(admin)).with(csrf()))
        .andExpect(status().isConflict());
    db.tenant(a, () -> db.sql.update("update calls set status='FAILED' where id=?", call));
    mvc.perform(post("/api/v1/calls/" + call + "/retry").with(as(admin)).with(csrf()))
        .andExpect(status().isOk());
    assertEquals(
        1,
        db.sql.queryForObject(
            "select count(*) from outbox where resource_id=?", Integer.class, call));
  }

  @Test
  void auditIsAppendOnlyForApplicationRole() {
    db.tenant(
        a,
        () -> {
          db.audit(admin, "test", call.toString());
          return null;
        });
    assertThrows(
        org.springframework.dao.DataAccessException.class,
        () ->
            db.tenant(
                a, () -> db.sql.update("delete from audit where resource=?", call.toString())));
  }

  @Test
  void measuredOutcomeKeepsDenominatorsAndDoesNotClaimCausality() throws Exception {
    UUID issue = UUID.randomUUID(), rec = UUID.randomUUID(), decision = UUID.randomUUID();
    String vector = "[" + String.join(",", Collections.nCopies(768, "0.1")) + "]";
    db.tenant(
        a,
        () -> {
          db.sql.update(
              "insert into issues(id,tenant_id,data,centroid,model) values"
                  + " (?,?,'{}',?::vector,'test')",
              issue,
              a,
              vector);
          db.sql.update(
              "insert into recommendations(id,tenant_id,issue_id,data) values (?,?,?,'{}')",
              rec,
              a,
              issue);
          db.sql.update(
              "insert into decisions(id,tenant_id,recommendation_id,data,version,completed_at)"
                  + " values (?,?,?,'{}',1,now()-interval '8 days')",
              decision,
              a,
              rec);
          for (int day : List.of(10, 11, 5, 6)) {
            UUID sample = UUID.randomUUID();
            db.sql.update(
                "insert into"
                    + " calls(id,tenant_id,import_key,audio_key,sha256,content_type,status,metadata)"
                    + " values"
                    + " (?,?,?,'test','hash','audio/wav','COMPLETED',jsonb_build_object('date',now()-(?"
                    + " * interval '1 day')))",
                sample,
                a,
                sample.toString(),
                day);
            if (day == 10)
              db.sql.update(
                  "insert into call_issues(tenant_id,call_id,issue_id,mentions,evidence) values"
                      + " (?,?,?,1,'{}')",
                  a,
                  sample,
                  issue);
          }
          return null;
        });
    mvc.perform(get("/api/v1/decisions/" + decision + "/outcomes").with(as(admin)))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.causal").value(false))
        .andExpect(jsonPath("$.baseline.total_calls").value(2))
        .andExpect(jsonPath("$.baseline.rate").value(0.5))
        .andExpect(jsonPath("$.followUp.total_calls").value(2))
        .andExpect(jsonPath("$.followUp.rate").value(0.0));
  }
}
