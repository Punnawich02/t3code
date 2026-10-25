import type { ProviderInstanceEnvironment } from "@t3tools/contracts";
import type * as Path from "effect/Path";

const CLAUDE_CONFIG_DIR = "CLAUDE_CONFIG_DIR";

/**
 * An API-key instance must never read or write the login of the Claude CLI on
 * the same machine, so it gets its own config dir unless the user chose one.
 * The key goes in as a process env var rather than argv, and the caller keeps
 * it out of settings.json through `secretSetting`.
 */
export function withClaudeApiKeyEnvironment(input: {
  readonly apiKey: string;
  readonly homePath: string;
  readonly environment: ProviderInstanceEnvironment;
  readonly defaultConfigDir: string;
}): ProviderInstanceEnvironment {
  if (input.apiKey.length === 0) return input.environment;

  const hasConfigDir = input.environment.some(
    (variable) => variable.name === CLAUDE_CONFIG_DIR && variable.value.trim().length > 0,
  );
  const usesConfigDir = input.homePath.trim().length === 0 && !hasConfigDir;

  return [
    ...input.environment,
    { name: "ANTHROPIC_API_KEY", value: input.apiKey, sensitive: true },
    ...(usesConfigDir
      ? [{ name: CLAUDE_CONFIG_DIR, value: input.defaultConfigDir, sensitive: false }]
      : []),
  ];
}

export const claudeApiKeyConfigDir = (path: Path.Path, stateDir: string, instanceId: string) =>
  path.join(stateDir, "providers", "claudeAgent", instanceId, "config");
