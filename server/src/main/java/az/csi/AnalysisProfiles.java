package az.csi;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.*;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;

@Component
class AnalysisProfiles {
  record Provider(
      String id,
      String label,
      String kind,
      String baseUrl,
      String model,
      boolean external,
      String tokenEnvironment) {}

  final Database db;
  final List<Provider> providers;
  final Map<String, Object> skill;

  AnalysisProfiles(Database db, ObjectMapper json) throws Exception {
    this.db = db;
    var list = new ArrayList<Provider>();
    list.add(
        new Provider(
            "local",
            "Local Ollama",
            "ollama",
            System.getenv().getOrDefault("OLLAMA_URL", "http://127.0.0.1:11434"),
            System.getenv().getOrDefault("LLM_MODEL", "qwen3:4b-instruct"),
            false,
            null));
    String configured = System.getenv().getOrDefault("CSI_AI_PROVIDERS", "[]");
    List<Provider> custom = json.readValue(configured, new TypeReference<List<Provider>>() {});
    for (var p : custom) {
      if (p.id() == null
          || !p.id().matches("[a-z0-9-]{1,40}")
          || list.stream().anyMatch(x -> x.id().equals(p.id()))
          || p.label() == null
          || p.model() == null
          || p.model().isBlank()
          || !"openai-compatible".equals(p.kind()))
        throw new IllegalArgumentException("Invalid CSI_AI_PROVIDERS entry");
      var uri = java.net.URI.create(p.baseUrl());
      if (uri.getHost() == null
          || uri.getUserInfo() != null
          || uri.getQuery() != null
          || uri.getFragment() != null
          || !("https".equals(uri.getScheme())
              || (!p.external() && "http".equals(uri.getScheme()))))
        throw new IllegalArgumentException("Invalid AI provider URL");
      list.add(p);
    }
    providers = List.copyOf(list);
    try (var stream = getClass().getResourceAsStream("/agent/skill.json")) {
      skill = json.readValue(stream, new TypeReference<Map<String, Object>>() {});
    }
  }

  Provider provider(String id) {
    return providers.stream()
        .filter(p -> p.id().equals(id))
        .findFirst()
        .orElseThrow(
            () ->
                new ResponseStatusException(
                    HttpStatus.BAD_REQUEST, "Choose a configured AI provider"));
  }

  Map<String, Object> current() {
    var rows = db.sql.queryForList("select version,config from analysis_profiles limit 1");
    var result = new LinkedHashMap<String, Object>();
    if (rows.isEmpty()) {
      result.putAll(
          Map.of(
              "providerId",
              "local",
              "context",
              "",
              "rules",
              "",
              "language",
              "English",
              "temperature",
              0,
              "maxOutputTokens",
              1800,
              "externalAllowed",
              false,
              "version",
              0));
    } else {
      result.putAll(db.decode(rows.getFirst().get("config")));
      result.put("version", rows.getFirst().get("version"));
    }
    return result;
  }

  Map<String, Object> snapshot() {
    var result = current();
    var p = provider(result.get("providerId").toString());
    result.put("model", p.model());
    result.put("skillVersion", skill.get("version"));
    result.put("callSystemPrompt", prompt(result, "callSystemPrompt"));
    result.put("summarySystemPrompt", prompt(result, "summarySystemPrompt"));
    return result;
  }

  String prompt(Map<String, Object> profile, String kind) {
    return skill.get(kind)
        + "\n\nCompany context:\n"
        + profile.get("context")
        + "\n\nAnalysis preferences:\n"
        + profile.get("rules")
        + "\n\nOutput language: "
        + profile.get("language")
        + ".\n"
        + skill.get("guardrails");
  }
}
