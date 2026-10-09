package az.csi;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.util.*;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/v1/analysis-profile")
class AnalysisProfileController {
  final Database db;
  final AnalysisProfiles profiles;

  AnalysisProfileController(Database db, AnalysisProfiles profiles) {
    this.db = db;
    this.profiles = profiles;
  }

  record Profile(
      @NotBlank @Size(max = 40) String providerId,
      @NotNull @Size(max = 4000) String context,
      @NotNull @Size(max = 4000) String rules,
      @NotNull @Pattern(regexp = "English|Azerbaijani|Turkish|Russian") String language,
      @DecimalMin("0") @DecimalMax("1") double temperature,
      @Min(512) @Max(4096) int maxOutputTokens,
      boolean externalAllowed,
      @Min(0) int version) {}

  @GetMapping
  Object get(Authentication auth) {
    var u = Security.identity(auth);
    return db.tenant(
        u.tenant(),
        () ->
            Map.of(
                "profile",
                profiles.current(),
                "providers",
                profiles.providers.stream()
                    .map(
                        p ->
                            Map.of(
                                "id",
                                p.id(),
                                "label",
                                p.label(),
                                "kind",
                                p.kind(),
                                "model",
                                p.model(),
                                "external",
                                p.external(),
                                "available",
                                !u.role().equals("DEMO") || p.id().equals("local")))
                    .toList()));
  }

  void validate(Security.Identity u, Profile input) {
    Security.require(u, "ADMIN", "DEMO");
    var provider = profiles.provider(input.providerId());
    if (u.role().equals("DEMO") && (!provider.id().equals("local") || input.externalAllowed()))
      throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Demo workspaces use local AI only");
    if (provider.external() && !input.externalAllowed())
      throw new ResponseStatusException(
          HttpStatus.BAD_REQUEST, "Allow external analysis for this provider");
  }

  @PutMapping
  Object save(Authentication auth, @RequestBody @Valid Profile input) {
    var u = Security.identity(auth);
    validate(u, input);
    return db.tenant(
        u.tenant(),
        () -> {
          db.sql.queryForList(
              "select pg_advisory_xact_lock(hashtextextended(?,4))", u.tenant().toString());
          int version = ((Number) profiles.current().get("version")).intValue();
          if (version != input.version())
            throw new ResponseStatusException(
                HttpStatus.CONFLICT, "Settings changed. Reload before saving.");
          db.sql.update(
              "insert into analysis_profiles(tenant_id,version,config) values (?,?,?::jsonb) on"
                  + " conflict(tenant_id) do update set"
                  + " version=excluded.version,config=excluded.config,updated_at=now()",
              u.tenant(),
              version + 1,
              db.encode(input));
          db.audit(u, "analysis-profile.update", "version:" + (version + 1));
          return profiles.current();
        });
  }

  @PostMapping("/preview")
  Object preview(Authentication auth, @RequestBody @Valid Profile input) {
    var u = Security.identity(auth);
    validate(u, input);
    return bundle(db.decode(db.encode(input)), "draft");
  }

  @GetMapping("/skill")
  Object skill(Authentication auth) {
    var u = Security.identity(auth);
    return db.tenant(u.tenant(), () -> bundle(profiles.snapshot(), "saved"));
  }

  Object bundle(Map<String, Object> profile, String status) {
    return Map.of(
        "name",
        profiles.skill.get("name"),
        "skillVersion",
        profiles.skill.get("version"),
        "status",
        status,
        "profile",
        profile,
        "systemPrompt",
        profiles.prompt(profile, "callSystemPrompt"),
        "summarySystemPrompt",
        profiles.prompt(profile, "summarySystemPrompt"),
        "tools",
        profiles.skill.get("tools"),
        "workflow",
        profiles.skill.get("workflow"),
        "outputSchema",
        profiles.skill.get("outputSchema"),
        "summaryOutputSchema",
        profiles.skill.get("summaryOutputSchema"));
  }
}
