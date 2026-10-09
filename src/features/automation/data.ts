import { z } from "zod";
import { api, apiMode } from "../../data/api";
import skillText from "../../../server/src/main/resources/agent/skill.json?raw";

export const profileSchema = z.object({
  providerId: z.string().min(1).max(40),
  context: z.string().max(4000),
  rules: z.string().max(4000),
  language: z.enum(["English", "Azerbaijani", "Turkish", "Russian"]),
  temperature: z.number().min(0).max(1),
  maxOutputTokens: z.number().int().min(512).max(4096),
  externalAllowed: z.boolean(),
  version: z.number().int().min(0),
});
export type Profile = z.infer<typeof profileSchema>;
export type Provider = {
  id: string;
  label: string;
  model: string;
  kind: string;
  external: boolean;
  available: boolean;
};
export type Configuration = { profile: Profile; providers: Provider[] };
export type Skill = {
  name: string;
  skillVersion: string;
  status: string;
  profile: Profile;
  systemPrompt: string;
  summarySystemPrompt: string;
  tools: { name: string; method: string; path: string; purpose: string }[];
  workflow: string[];
  outputSchema: object;
  summaryOutputSchema: object;
};
export const defaults: Profile = {
  providerId: "local",
  context: "",
  rules: "",
  language: "English",
  temperature: 0,
  maxOutputTokens: 1800,
  externalAllowed: false,
  version: 0,
};
const storageKey = "clarity:analysis-profile:v1";
const contract = JSON.parse(skillText);
function localProfile(): Profile {
  const raw = localStorage.getItem(storageKey);
  if (!raw) return defaults;
  const result = profileSchema.safeParse(JSON.parse(raw));
  if (!result.success)
    throw new Error(
      "Saved analysis settings are invalid. Remove this browser's clarity:analysis-profile:v1 entry to reset them.",
    );
  return result.data;
}
export async function configuration(): Promise<Configuration> {
  if (apiMode) return api("/analysis-profile");
  return {
    profile: localProfile(),
    providers: [
      {
        id: "local",
        label: "Local Ollama",
        model: "qwen3:4b-instruct",
        kind: "ollama",
        external: false,
        available: true,
      },
    ],
  };
}
export async function saveProfile(profile: Profile): Promise<Profile> {
  const valid = profileSchema.parse(profile);
  if (apiMode)
    return api("/analysis-profile", {
      method: "PUT",
      body: JSON.stringify(valid),
    });
  if (localProfile().version !== valid.version)
    throw new Error("Settings changed. Reload before saving.");
  const saved = { ...valid, version: valid.version + 1 };
  localStorage.setItem(storageKey, JSON.stringify(saved));
  return saved;
}
function localBundle(profile: Profile, status: string): Skill {
  const prompt = (base: string) =>
    `${base}\n\nCompany context:\n${profile.context}\n\nAnalysis preferences:\n${profile.rules}\n\nOutput language: ${profile.language}.\n${contract.guardrails}`;
  return {
    name: contract.name,
    skillVersion: contract.version,
    status,
    profile,
    systemPrompt: prompt(contract.callSystemPrompt),
    summarySystemPrompt: prompt(contract.summarySystemPrompt),
    tools: contract.tools,
    workflow: contract.workflow,
    outputSchema: contract.outputSchema,
    summaryOutputSchema: contract.summaryOutputSchema,
  };
}
export async function previewProfile(profile: Profile): Promise<Skill> {
  const valid = profileSchema.parse(profile);
  return apiMode
    ? api("/analysis-profile/preview", {
        method: "POST",
        body: JSON.stringify(valid),
      })
    : localBundle(valid, "draft");
}
export async function exportSkill(): Promise<Skill> {
  return apiMode
    ? api("/analysis-profile/skill")
    : localBundle(localProfile(), "saved");
}
