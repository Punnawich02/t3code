import * as Option from "effect/Option";
import type * as Path from "effect/Path";

export function normalizeCustomProviderBaseUrl(raw: string): Option.Option<string> {
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    return Option.none();
  }
  if (trimmed.includes("'") || trimmed.includes(String.fromCharCode(34))) {
    return Option.none();
  }
  try {
    const url = new URL(trimmed);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return Option.none();
    }
    if (url.href.includes("'") || url.href.includes(String.fromCharCode(34))) {
      return Option.none();
    }
    const normalized = trimmed.replace(/\/+$/, "");
    return Option.some(normalized);
  } catch {
    return Option.none();
  }
}

export function customProviderLaunchArgs(input: {
  readonly baseUrl: string;
  readonly hasApiKey: boolean;
}): string {
  const values: string[] = [
    'model_provider="t3_custom"',
    'model_providers.t3_custom.name="Custom Provider"',
    `model_providers.t3_custom.base_url="${input.baseUrl}"`,
    'model_providers.t3_custom.wire_api="responses"',
    "model_providers.t3_custom.requires_openai_auth=false",
    "model_providers.t3_custom.supports_websockets=false",
    "features.multi_agent=false",
    "features.multi_agent_v2=false",
  ];
  if (input.hasApiKey) {
    values.push('model_providers.t3_custom.env_key="T3_CUSTOM_PROVIDER_API_KEY"');
  }
  return values.map((value) => `-c '${value}'`).join(" ");
}

export function customProviderEnvironment(input: {
  readonly base: NodeJS.ProcessEnv;
  readonly homePath: string;
  readonly apiKey: string;
}): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {
    ...input.base,
    CODEX_HOME: input.homePath,
  };
  delete env.OPENAI_API_KEY;
  delete env.OPENAI_BASE_URL;
  delete env.T3CODE_CODEX_LAUNCH_ARGS;
  delete env.ACCESS_TOKEN;
  if (input.apiKey.length > 0) {
    env.T3_CUSTOM_PROVIDER_API_KEY = input.apiKey;
  } else {
    delete env.T3_CUSTOM_PROVIDER_API_KEY;
  }
  return env;
}

export function customProviderHomePath(
  path: Path.Path["Service"],
  stateDir: string,
  instanceId: string,
): string {
  return path.join(stateDir, "providers", "customProvider", instanceId, "codex-home");
}
