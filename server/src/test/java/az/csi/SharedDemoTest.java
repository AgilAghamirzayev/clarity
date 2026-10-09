package az.csi;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import java.time.Instant;
import java.util.*;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

@SpringBootTest(
    properties = {"DEMO_ENABLED=true", "DEMO_SHARED_WORKSPACE=true", "DEMO_SEED_ENABLED=false"})
@AutoConfigureMockMvc
@EnabledIfEnvironmentVariable(named = "CSI_INTEGRATION_TESTS", matches = "true")
class SharedDemoTest {
  @Autowired MockMvc mvc;
  @Autowired Database db;

  MvcResult visit() throws Exception {
    return mvc.perform(
            post("/api/v1/auth/demo")
                .with(csrf())
                .with(
                    r -> {
                      r.setRemoteAddr("2001:db8:" + UUID.randomUUID());
                      return r;
                    }))
        .andExpect(status().isOk())
        .andReturn();
  }

  @Test
  void separateVisitorsShareRecordingsButNotIdentityOrAdminAccess() throws Exception {
    var first = visit();
    var second = visit();
    var a = db.decode(first.getResponse().getContentAsString());
    var b = db.decode(second.getResponse().getContentAsString());
    assertEquals(a.get("tenant"), b.get("tenant"));
    assertNotEquals(a.get("id"), b.get("id"));
    var cookie = second.getResponse().getCookie("SESSION");
    mvc.perform(get("/api/v1/platform/status").cookie(cookie))
        .andExpect(jsonPath("$.sharedWorkspace").value(true))
        .andExpect(jsonPath("$.maxFiles").value(50));
    UUID tenant = UUID.fromString(a.get("tenant").toString());
    UUID call = UUID.randomUUID();
    db.tenant(
        tenant,
        () ->
            db.sql.update(
                "insert into calls(id,tenant_id,import_key,audio_key,sha256,content_type,metadata)"
                    + " values (?,?,?,?,'hash','audio/wav','{}')",
                call,
                tenant,
                UUID.randomUUID().toString(),
                tenant + "/" + call + "/audio"));
    try {
      mvc.perform(get("/api/v1/calls").cookie(cookie))
          .andExpect(jsonPath("$[?(@.id == '" + call + "')]").isNotEmpty());
      mvc.perform(get("/api/v1/calls/" + call).cookie(cookie)).andExpect(status().isOk());
      mvc.perform(get("/api/v1/integrations").cookie(cookie)).andExpect(status().isForbidden());
      mvc.perform(post("/api/v1/auth/demo").cookie(cookie)).andExpect(status().isForbidden());
      assertNull(
          db.sql.queryForObject(
              "select demo_expires_at from tenants where id=?", Object.class, tenant));
    } finally {
      db.tenant(tenant, () -> db.sql.update("delete from calls where id=?", call));
    }
  }

  @Test
  void existingPrivateGuestJoinsSharedWorkspaceWithoutPublishingOldRecordings() throws Exception {
    UUID privateTenant = UUID.randomUUID();
    UUID call = UUID.randomUUID();
    db.sql.update(
        "insert into tenants(id,slug,demo_expires_at) values (?,?,now()+interval '24 hours')",
        privateTenant,
        "test-private-" + privateTenant);
    db.tenant(
        privateTenant,
        () ->
            db.sql.update(
                "insert into calls(id,tenant_id,import_key,audio_key,sha256,content_type,metadata)"
                    + " values (?,?,?,?,'hash','audio/wav','{}')",
                call,
                privateTenant,
                UUID.randomUUID().toString(),
                privateTenant + "/" + call + "/audio"));
    try {
      var old =
          new Security.Identity(
              UUID.randomUUID(), privateTenant, "Visitor", "DEMO", Instant.now().plusSeconds(3600));
      var auth =
          new UsernamePasswordAuthenticationToken(
              old, null, List.of(new SimpleGrantedAuthority("ROLE_DEMO")));
      var joined =
          mvc.perform(post("/api/v1/auth/demo").with(authentication(auth)).with(csrf()))
              .andExpect(status().isOk())
              .andReturn();
      var identity = db.decode(joined.getResponse().getContentAsString());
      assertNotEquals(privateTenant.toString(), identity.get("tenant"));
      mvc.perform(get("/api/v1/calls/" + call).cookie(joined.getResponse().getCookie("SESSION")))
          .andExpect(status().isNotFound());
      var refreshed =
          mvc.perform(
                  post("/api/v1/auth/demo")
                      .cookie(joined.getResponse().getCookie("SESSION"))
                      .with(csrf()))
              .andExpect(status().isOk())
              .andReturn();
      assertEquals(
          identity.get("id"), db.decode(refreshed.getResponse().getContentAsString()).get("id"));
    } finally {
      db.tenant(privateTenant, () -> db.sql.update("delete from calls where id=?", call));
      db.sql.update(
          "update tenants set demo_expires_at=now()-interval '25 hours' where id=?", privateTenant);
    }
  }
}
