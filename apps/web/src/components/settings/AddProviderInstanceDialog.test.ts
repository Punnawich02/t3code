import { describe, expect, it } from "vite-plus/test";

import {
  apiKeyRequiredError,
  deriveAvailableInstanceId,
  findApiKeyProviderPreset,
  getProviderIdentityDraft,
  isConfiguredAcpRegistryAgent,
  isSignInDriver,
  resolveAcpRegistryWizardNavigation,
  resolveWizardNavigation,
  seedApiKeyPresetConfig,
  updateProviderIdentityDraft,
} from "./AddProviderInstanceDialog.logic";

describe("resolveWizardNavigation", () => {
  const invalidId = { instanceIdError: "Instance ID is required." };
  const validId = { instanceIdError: null };

  it("allows moving from Driver to Identity before the instance id is valid", () => {
    expect(resolveWizardNavigation(0, 1, 3, invalidId)).toEqual({ kind: "navigate", step: 1 });
  });

  it("blocks Next from Identity to Config while the instance id is invalid", () => {
    expect(resolveWizardNavigation(1, 2, 3, invalidId)).toEqual({
      kind: "blocked",
      step: 1,
      error: "Instance ID is required.",
    });
  });

  it("stops a direct Driver-to-Config skip at Identity and surfaces its error", () => {
    expect(resolveWizardNavigation(0, 2, 3, invalidId)).toEqual({
      kind: "blocked",
      step: 1,
      error: "Instance ID is required.",
    });
  });

  it("allows advancing and skipping forward once the instance id is valid", () => {
    expect(resolveWizardNavigation(1, 2, 3, validId)).toEqual({ kind: "navigate", step: 2 });
    expect(resolveWizardNavigation(0, 2, 3, validId)).toEqual({ kind: "navigate", step: 2 });
  });

  it("always preserves backward Driver and Identity navigation", () => {
    expect(resolveWizardNavigation(2, 1, 3, invalidId)).toEqual({ kind: "navigate", step: 1 });
    expect(resolveWizardNavigation(2, 0, 3, invalidId)).toEqual({ kind: "navigate", step: 0 });
    expect(resolveWizardNavigation(1, 0, 3, invalidId)).toEqual({ kind: "navigate", step: 0 });
  });

  it("clamps requested steps to the wizard bounds", () => {
    expect(resolveWizardNavigation(2, 8, 3, validId)).toEqual({ kind: "navigate", step: 2 });
    expect(resolveWizardNavigation(0, -1, 3, invalidId)).toEqual({ kind: "navigate", step: 0 });
  });
});

describe("ACP Registry wizard", () => {
  it("requires a prepared result or valid manual configuration before Identity", () => {
    expect(
      resolveAcpRegistryWizardNavigation(0, 1, {
        instanceIdError: null,
        selectionError: "Select an ACP or configure one manually.",
      }),
    ).toEqual({
      kind: "blocked",
      step: 0,
      error: "Select an ACP or configure one manually.",
    });

    expect(
      resolveAcpRegistryWizardNavigation(0, 1, {
        instanceIdError: null,
        selectionError: null,
      }),
    ).toEqual({ kind: "navigate", step: 1 });
  });

  it("derives a collision-free instance id without exceeding the slug limit", () => {
    const derive = (label: string) => `acpRegistry_${label}`;
    const existing = new Set(["acpRegistry_gemini", "acpRegistry_gemini_2"]);

    expect(deriveAvailableInstanceId(derive, "gemini", existing)).toBe("acpRegistry_gemini_3");

    const longBase = `acpRegistry_${"a".repeat(48)}`;
    expect(deriveAvailableInstanceId(() => longBase, "ignored", new Set([longBase]))).toHaveLength(
      62,
    );
  });

  it("only marks matching ACP Registry instances as already added", () => {
    const instances = {
      codex: { driver: "codex", config: { agentId: "gemini" } },
      registry: { driver: "acpRegistry", config: { agentId: "gemini" } },
    };

    expect(isConfiguredAcpRegistryAgent(instances, "gemini")).toBe(true);
    expect(isConfiguredAcpRegistryAgent(instances, "codex")).toBe(false);
  });

  it("keeps registry-prefilled identity separate from other drivers", () => {
    const registryDrafts = updateProviderIdentityDraft({}, "acpRegistry", {
      label: "Gemini CLI",
      instanceIdOverride: "acpRegistry_gemini_cli",
    });

    expect(getProviderIdentityDraft(registryDrafts, "codex")).toEqual({
      label: "",
      accentColor: "",
      instanceIdOverride: null,
    });

    const drafts = updateProviderIdentityDraft(registryDrafts, "codex", {
      label: "Work",
      instanceIdOverride: "codex_work",
    });
    expect(getProviderIdentityDraft(drafts, "acpRegistry")).toMatchObject({
      label: "Gemini CLI",
      instanceIdOverride: "acpRegistry_gemini_cli",
    });
  });
});

describe("Sign in and API key connection methods", () => {
  it("lists every driver for sign-in except Custom Provider and ACP Registry", () => {
    expect(isSignInDriver("codex")).toBe(true);
    expect(isSignInDriver("claudeAgent")).toBe(true);
    expect(isSignInDriver("customProvider")).toBe(false);
    expect(isSignInDriver("acpRegistry")).toBe(false);
  });

  it("seeds each preset with its own draft, even when two presets share a driver", () => {
    const openAi = findApiKeyProviderPreset("openai-api")!;
    const compatible = findApiKeyProviderPreset("openai-compatible")!;
    expect(openAi.driverKind).toBe(compatible.driverKind);

    expect(seedApiKeyPresetConfig({}, openAi)).toEqual({
      "openai-api": { apiFormat: "openai", baseUrl: "https://api.openai.com/v1" },
    });
    expect(seedApiKeyPresetConfig({}, compatible)).toEqual({ "openai-compatible": {} });
    expect(findApiKeyProviderPreset("gemini-api")).toMatchObject({
      driverKind: "antigravity",
      config: { authMethod: "gemini-api-key" },
    });
  });

  it("keeps the user's existing draft when a preset is chosen again", () => {
    const openAi = findApiKeyProviderPreset("openai-api")!;
    const drafts = { "openai-api": { baseUrl: "http://localhost:4000/v1" } };
    expect(seedApiKeyPresetConfig(drafts, openAi)).toEqual(drafts);
  });

  it("requires an API key for Claude, OpenAI, and Gemini but not OpenAI-compatible", () => {
    const claude = findApiKeyProviderPreset("claude-api")!;
    const compatible = findApiKeyProviderPreset("openai-compatible")!;

    expect(apiKeyRequiredError(claude, {})).toBe("API key is required.");
    expect(apiKeyRequiredError(claude, { apiKey: "   " })).toBe("API key is required.");
    expect(apiKeyRequiredError(claude, { apiKey: "sk-ant-test" })).toBeNull();
    expect(apiKeyRequiredError(compatible, {})).toBeNull();
  });
});
