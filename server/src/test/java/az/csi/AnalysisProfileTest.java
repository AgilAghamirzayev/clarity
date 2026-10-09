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
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

@SpringBootTest
@AutoConfigureMockMvc
@Transactional
@EnabledIfEnvironmentVariable(named = "CSI_INTEGRATION_TESTS", matches = "true")
class AnalysisProfileTest {
  @Autowired Database db;
  @Autowired MockMvc mvc;
  @Autowired AnalysisProfiles profiles;
  @Autowired IngestionController sources;
  UUID tenant = UUID.randomUUID();
  Security.Identity admin;

  @BeforeEach
  void seed() {
    db.sql.update("insert into tenants(id,slug) values (?,?)", tenant, "profile-" + tenant);
    admin = new Security.Identity(UUID.randomUUID(), tenant, "test@example.test", "ADMIN");
  }

  UsernamePasswordAuthenticationToken auth(String role) {
    return new UsernamePasswordAuthenticationToken(
        new Security.Identity(admin.id(), tenant, admin.email(), role), null, List.of());
  }

  String body(int version) {
    return db.encode(
        Map.of(
            "providerId",
            "local",
            "context",
            "Retail support",
            "rules",
            "Check refund clarity",
            "language",
            "English",
            "temperature",
            0,
            "maxOutputTokens",
            1800,
            "externalAllowed",
            false,
            "version",
            version));
  }

  @Test
  void savesVersionedTenantProfileAndRejectsStaleUpdate() throws Exception {
    mvc.perform(
            put("/api/v1/analysis-profile")
                .with(authentication(auth("ADMIN")))
                .with(csrf())
                .contentType("application/json")
                .content(body(0)))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.version").value(1));
    mvc.perform(
            put("/api/v1/analysis-profile")
                .with(authentication(auth("ADMIN")))
                .with(csrf())
                .contentType("application/json")
                .content(body(0)))
        .andExpect(status().isConflict());
    assertEquals("Check refund clarity", db.tenant(tenant, profiles::snapshot).get("rules"));
    assertEquals(0, db.tenant(UUID.randomUUID(), profiles::current).get("version"));
    mvc.perform(get("/api/v1/analysis-profile/skill").with(authentication(auth("ADMIN"))))
        .andExpect(status().isOk())
        .andExpect(
            jsonPath("$.systemPrompt")
                .value(org.hamcrest.Matchers.containsString("Check refund clarity")));
  }

  @Test
  void viewersCannotEditAndSessionChangesStillNeedCsrf() throws Exception {
    mvc.perform(
            put("/api/v1/analysis-profile")
                .with(authentication(auth("VIEWER")))
                .with(csrf())
                .contentType("application/json")
                .content(body(0)))
        .andExpect(status().isForbidden());
    mvc.perform(
            put("/api/v1/analysis-profile")
                .with(authentication(auth("ADMIN")))
                .contentType("application/json")
                .content(body(0)))
        .andExpect(status().isForbidden());
    mvc.perform(
            post("/api/v1/ingestion/sources")
                .with(authentication(auth("DEMO")))
                .with(csrf())
                .contentType("application/json")
                .content("{\"name\":\"Recorder\"}"))
        .andExpect(status().isForbidden());
  }

  @Test
  void sourceTokensAreScopedRevocableAndCannotUseSessions() throws Exception {
    var response =
        (Map<?, ?>)
            sources
                .create(auth("ADMIN"), new IngestionController.Source("Contact center"))
                .getBody();
    String token = response.get("token").toString();
    assertNotEquals(
        token,
        db.tenant(
            tenant,
            () ->
                db.sql.queryForObject(
                    "select token_hash from ingestion_sources where id=?",
                    String.class,
                    response.get("id"))));
    // A valid token reaches request validation without CSRF; no file is ingested in this test.
    mvc.perform(
            post("/api/v1/ingestion/recordings")
                .servletPath("/api/v1/ingestion/recordings")
                .header("Authorization", "Bearer " + token))
        .andExpect(status().isUnsupportedMediaType());
    mvc.perform(get("/api/v1/analysis-profile").header("Authorization", "Bearer " + token))
        .andExpect(status().isUnauthorized());
    mvc.perform(
            post("/api/v1/ingestion/recordings")
                .servletPath("/api/v1/ingestion/recordings")
                .with(authentication(auth("ADMIN"))))
        .andExpect(status().isUnauthorized());
    sources.revoke(auth("ADMIN"), (UUID) response.get("id"));
    mvc.perform(
            post("/api/v1/ingestion/recordings")
                .servletPath("/api/v1/ingestion/recordings")
                .header("Authorization", "Bearer " + token))
        .andExpect(status().isUnauthorized());
  }
}
