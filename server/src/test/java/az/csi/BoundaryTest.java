package az.csi;

import static org.junit.jupiter.api.Assertions.*;

import java.util.UUID;
import org.junit.jupiter.api.Test;

class BoundaryTest {
  @Test
  void sessionPrincipalFitsPersistentSessionColumn() {
    var user =
        new Security.Identity(
            UUID.randomUUID(), UUID.randomUUID(), "very-long-email@example.test", "ADMIN");
    assertEquals(user.id().toString(), user.getName());
    assertTrue(user.getName().length() <= 100);
  }

  @Test
  void rejectsNonAudioRegardlessOfFilename() {
    assertThrows(
        IllegalArgumentException.class,
        () -> AudioStore.mediaType("<script>evil</script>".getBytes()));
  }

  @Test
  void acceptsWaveSignature() {
    assertEquals("audio/wav", AudioStore.mediaType("RIFF0000WAVE".getBytes()));
  }

  @Test
  void viewerCannotImportOrReview() {
    var user =
        new Security.Identity(
            UUID.randomUUID(), UUID.randomUUID(), "viewer@example.test", "VIEWER");
    assertThrows(
        org.springframework.web.server.ResponseStatusException.class,
        () -> Security.require(user, "ADMIN", "REVIEWER"));
  }
}
