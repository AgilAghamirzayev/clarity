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
  void acceptsMp4AndM4aContainers() {
    for (String brand : new String[] {"isom", "mp42", "M4A "}) {
      var header =
          java.nio.ByteBuffer.allocate(16)
              .putInt(24)
              .put("ftyp".getBytes())
              .put(brand.getBytes())
              .putInt(0)
              .array();
      assertEquals("video/mp4", AudioStore.mediaType(header));
    }
  }

  @Test
  void rejectsInvalidMp4Header() {
    var header =
        java.nio.ByteBuffer.allocate(16).putInt(4).put("ftypisom".getBytes()).putInt(0).array();
    assertThrows(IllegalArgumentException.class, () -> AudioStore.mediaType(header));
    header[3] = 24;
    header[8] = 'x';
    assertThrows(IllegalArgumentException.class, () -> AudioStore.mediaType(header));
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
