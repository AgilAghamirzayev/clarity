package az.csi;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import java.time.Instant;
import java.util.*;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest(
    properties = {"DEMO_ENABLED=true", "DEMO_SEED_ENABLED=false", "DEMO_MAX_WORKSPACES=100000"})
@AutoConfigureMockMvc
@EnabledIfEnvironmentVariable(named = "CSI_INTEGRATION_TESTS", matches = "true")
class DemoTest {
  @Autowired MockMvc mvc;
  @Autowired Database db;
  final List<UUID> createdTenants = new ArrayList<>();

  @AfterEach
  void expireTestWorkspaces() {
    for (UUID tenant : createdTenants)
      db.sql.update(
          "update tenants set demo_expires_at=now()-interval '25 hours' where id=?", tenant);
  }

  @Test
  void guestSessionIsIsolatedPersistentAndCannotAdminister() throws Exception {
    String ip = "192.0.2." + (10 + new Random().nextInt(200));
    var first =
        mvc.perform(
                post("/api/v1/auth/demo")
                    .with(csrf())
                    .with(
                        r -> {
                          r.setRemoteAddr(ip);
                          return r;
                        }))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.role").value("DEMO"))
            .andReturn();
    var a = db.decode(first.getResponse().getContentAsString());
    createdTenants.add(UUID.fromString(a.get("tenant").toString()));
    var session = first.getResponse().getCookie("SESSION");
    assertNotNull(session);
    mvc.perform(post("/api/v1/auth/demo").cookie(session).with(csrf()))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.tenant").value(a.get("tenant")));
    mvc.perform(get("/api/v1/integrations").cookie(session)).andExpect(status().isForbidden());
    mvc.perform(get("/api/v1/audit").cookie(session)).andExpect(status().isForbidden());
    mvc.perform(get("/api/v1/workspace").cookie(session))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.conversations").isEmpty());
    var second =
        mvc.perform(
                post("/api/v1/auth/demo")
                    .with(csrf())
                    .with(
                        r -> {
                          r.setRemoteAddr(ip);
                          return r;
                        }))
            .andExpect(status().isOk())
            .andReturn();
    var b = db.decode(second.getResponse().getContentAsString());
    createdTenants.add(UUID.fromString(b.get("tenant").toString()));
    assertNotEquals(a.get("tenant"), b.get("tenant"));
    UUID call = UUID.randomUUID();
    db.tenant(
        UUID.fromString(a.get("tenant").toString()),
        () ->
            db.sql.update(
                "insert into calls(id,tenant_id,import_key,audio_key,sha256,content_type,metadata)"
                    + " values (?,?,?,?,'hash','audio/wav','{}')",
                call,
                UUID.fromString(a.get("tenant").toString()),
                UUID.randomUUID().toString(),
                a.get("tenant") + "/" + call + "/audio"));
    mvc.perform(get("/api/v1/calls/" + call).cookie(second.getResponse().getCookie("SESSION")))
        .andExpect(status().isNotFound());
  }

  @Test
  void guestCreationNeedsCsrfAndRateLimitIsPersistent() throws Exception {
    mvc.perform(post("/api/v1/auth/demo")).andExpect(status().isForbidden());
    String ip =
        "2001:db8:"
            + UUID.randomUUID()
                .toString()
                .replace("-", "")
                .substring(0, 24)
                .replaceAll("(.{4})(?!$)", "$1:");
    for (int i = 0; i < 10; i++) {
      var response =
          mvc.perform(
                  post("/api/v1/auth/demo")
                      .with(csrf())
                      .with(
                          r -> {
                            r.setRemoteAddr(ip);
                            return r;
                          }))
              .andExpect(status().isOk())
              .andReturn();
      createdTenants.add(
          UUID.fromString(
              db.decode(response.getResponse().getContentAsString()).get("tenant").toString()));
    }
    mvc.perform(
            post("/api/v1/auth/demo")
                .with(csrf())
                .with(
                    r -> {
                      r.setRemoteAddr(ip);
                      return r;
                    }))
        .andExpect(status().isTooManyRequests());
  }

  @Test
  void expiredGuestCannotAccessRecords() throws Exception {
    var user =
        new Security.Identity(
            UUID.randomUUID(),
            UUID.randomUUID(),
            "Demo visitor",
            "DEMO",
            Instant.now().minusSeconds(1));
    var auth =
        new UsernamePasswordAuthenticationToken(
            user, null, List.of(new SimpleGrantedAuthority("ROLE_DEMO")));
    mvc.perform(get("/api/v1/workspace").with(authentication(auth)))
        .andExpect(status().isUnauthorized());
  }
}
