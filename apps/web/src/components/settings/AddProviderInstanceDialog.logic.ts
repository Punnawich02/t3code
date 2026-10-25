import { ProviderDriverKind } from "@t3tools/contracts";

export type WizardNavigation =
  | { readonly kind: "navigate"; readonly step: number }
  | { readonly kind: "blocked"; readonly step: number; readonly error: string };

export type ProviderConnectionMethod = "signIn" | "apiKey";

export type ApiKeyProviderPresetId =
  | "claude-api"
  | "openai-api"
  | "gemini-api"
  | "openai-compatible";

/**
 * Presets are ordinary instances of existing drivers. Each one is its own draft because
 * OpenAI API and OpenAI-compatible both use `customProvider`.
 */
export interface ApiKeyProviderPreset {
  readonly id: ApiKeyProviderPresetId;
  readonly label: string;
  readonly driverKind: ProviderDriverKind;
  readonly config: Readonly<Record<string, unknown>>;
  readonly requiresApiKey: boolean;
}

export const API_KEY_PROVIDER_PRESETS: readonly ApiKeyProviderPreset[] = [
  {
    id: "claude-api",
    label: "Claude API",
    driverKind: ProviderDriverKind.make("claudeAgent"),
    config: {},
    requiresApiKey: true,
  },
  {
    id: "openai-api",
    label: "OpenAI API",
    driverKind: ProviderDriverKind.make("customProvider"),
    config: { apiFormat: "openai", baseUrl: "https://api.openai.com/v1" },
    requiresApiKey: true,
  },
  {
    id: "gemini-api",
    label: "Gemini API",
    driverKind: ProviderDriverKind.make("antigravity"),
    config: { authMethod: "gemini-api-key" },
    requiresApiKey: true,
  },
  {
    id: "openai-compatible",
    label: "OpenAI-compatible",
    driverKind: ProviderDriverKind.make("customProvider"),
    config: {},
    requiresApiKey: false,
  },
];

export function findApiKeyProviderPreset(id: string): ApiKeyProviderPreset | undefined {
  return API_KEY_PROVIDER_PRESETS.find((preset) => preset.id === id);
}

/**
 * Custom Provider is only offered through an API key preset. ACP Registry has its own
 * section under Sign in, so it is not in the driver list.
 */
export function isSignInDriver(driverKind: string): boolean {
  return driverKind !== "customProvider" && driverKind !== "acpRegistry";
}

export function seedApiKeyPresetConfig(
  configs: Readonly<Record<string, Readonly<Record<string, unknown>>>>,
  preset: ApiKeyProviderPreset,
): Record<string, Readonly<Record<string, unknown>>> {
  if (configs[preset.id] !== undefined) return { ...configs };
  return { ...configs, [preset.id]: { ...preset.config } };
}

export function apiKeyRequiredError(
  preset: ApiKeyProviderPreset,
  config: Readonly<Record<string, unknown>>,
): string | null {
  if (!preset.requiresApiKey) return null;
  const apiKey = config.apiKey;
  return typeof apiKey === "string" && apiKey.trim().length > 0 ? null : "API key is required.";
}

const IDENTITY_STEP = 1;
const ACP_REGISTRY_IDENTITY_STEP = 1;

export const ADD_PROVIDER_WIZARD_STEPS = ["Provider", "Identity", "Config"] as const;
export const ACP_REGISTRY_WIZARD_STEPS = ["Provider", "Identity", "Sign in"] as const;
export const LOCAL_ACP_WIZARD_STEPS = ["Provider", "Identity"] as const;

export interface ProviderIdentityDraft {
  readonly label: string;
  readonly accentColor: string;
  readonly instanceIdOverride: string | null;
}

const EMPTY_PROVIDER_IDENTITY_DRAFT: ProviderIdentityDraft = {
  label: "",
  accentColor: "",
  instanceIdOverride: null,
};

export function getProviderIdentityDraft(
  drafts: Readonly<Record<string, ProviderIdentityDraft>>,
  driver: string,
): ProviderIdentityDraft {
  return drafts[driver] ?? EMPTY_PROVIDER_IDENTITY_DRAFT;
}

export function updateProviderIdentityDraft(
  drafts: Readonly<Record<string, ProviderIdentityDraft>>,
  driver: string,
  update: Partial<ProviderIdentityDraft>,
): Record<string, ProviderIdentityDraft> {
  return {
    ...drafts,
    [driver]: { ...getProviderIdentityDraft(drafts, driver), ...update },
  };
}

export function deriveAvailableInstanceId(
  derive: (label: string) => string,
  label: string,
  existing: ReadonlySet<string>,
): string {
  const base = derive(label);
  if (!base || !existing.has(base)) return base;

  for (let suffix = 2; ; suffix += 1) {
    const suffixText = `_${suffix}`;
    const candidate = `${base.slice(0, 64 - suffixText.length)}${suffixText}`;
    if (!existing.has(candidate)) return candidate;
  }
}

export function isConfiguredAcpRegistryAgent(
  instances: Readonly<Record<string, { readonly driver: string; readonly config?: unknown }>>,
  agentId: string,
): boolean {
  return Object.values(instances).some((instance) => {
    if (
      instance.driver !== "acpRegistry" ||
      !instance.config ||
      typeof instance.config !== "object"
    ) {
      return false;
    }
    const config = instance.config as Record<string, unknown>;
    return config.source !== "local" && config.agentId === agentId;
  });
}

export function resolveWizardNavigation(
  currentStep: number,
  requestedStep: number,
  stepCount: number,
  validation: {
    readonly instanceIdError: string | null;
    readonly identityStep?: number;
    readonly prerequisite?: {
      readonly step: number;
      readonly error: string | null;
    };
  },
): WizardNavigation {
  const lastStep = Math.max(0, stepCount - 1);
  const targetStep = Math.max(0, Math.min(lastStep, requestedStep));
  const identityStep = validation.identityStep ?? IDENTITY_STEP;
  const prerequisite = validation.prerequisite;

  if (prerequisite?.error && currentStep <= prerequisite.step && targetStep > prerequisite.step) {
    return {
      kind: "blocked",
      step: Math.min(prerequisite.step, lastStep),
      error: prerequisite.error,
    };
  }

  const movesForwardPastIdentity = currentStep <= identityStep && targetStep > identityStep;

  if (movesForwardPastIdentity && validation.instanceIdError !== null) {
    return {
      kind: "blocked",
      step: Math.min(identityStep, lastStep),
      error: validation.instanceIdError,
    };
  }

  return { kind: "navigate", step: targetStep };
}

export function resolveAcpRegistryWizardNavigation(
  currentStep: number,
  requestedStep: number,
  validation: {
    readonly instanceIdError: string | null;
    readonly selectionError: string | null;
  },
): WizardNavigation {
  return resolveWizardNavigation(currentStep, requestedStep, ACP_REGISTRY_WIZARD_STEPS.length, {
    instanceIdError: validation.instanceIdError,
    identityStep: ACP_REGISTRY_IDENTITY_STEP,
    prerequisite: { step: 0, error: validation.selectionError },
  });
}
