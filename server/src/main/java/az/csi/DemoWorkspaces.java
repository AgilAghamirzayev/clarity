package az.csi;

import java.nio.charset.StandardCharsets;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

@Component
class DemoWorkspaces {
  static final UUID SHARED_TENANT =
      UUID.nameUUIDFromBytes("clarity:public-workspace:v1".getBytes(StandardCharsets.UTF_8));
  final boolean shared;
  final int sharedUploadLimit;

  DemoWorkspaces(
      @Value("${DEMO_SHARED_WORKSPACE:false}") boolean shared,
      @Value("${DEMO_SHARED_UPLOAD_LIMIT:50}") int sharedUploadLimit) {
    this.shared = shared;
    this.sharedUploadLimit = Math.max(5, Math.min(500, sharedUploadLimit));
  }

  boolean isShared(Security.Identity user) {
    return shared && user.role().equals("DEMO") && SHARED_TENANT.equals(user.tenant());
  }

  int maxFiles(Security.Identity user) {
    return isShared(user) ? sharedUploadLimit : 5;
  }
}
