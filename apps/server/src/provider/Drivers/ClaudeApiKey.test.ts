import { describe, expect, it } from "vite-plus/test";

import { withClaudeApiKeyEnvironment } from "./ClaudeApiKey.ts";

const defaultConfigDir = "/state/providers/claudeAgent/claude-api/config";
const base = { apiKey: "", homePath: "", environment: [], defaultConfigDir };

describe("withClaudeApiKeyEnvironment", () => {
  it("returns the same environment when there is no API key", () => {
    const environment = [{ name: "FOO", value: "bar", sensitive: false }];

    expect(withClaudeApiKeyEnvironment({ ...base, environment })).toBe(environment);
  });

  it("adds the key as a sensitive variable and a dedicated config dir", () => {
    expect(withClaudeApiKeyEnvironment({ ...base, apiKey: "sk-ant-test" })).toEqual([
      { name: "ANTHROPIC_API_KEY", value: "sk-ant-test", sensitive: true },
      { name: "CLAUDE_CONFIG_DIR", value: defaultConfigDir, sensitive: false },
    ]);
  });

  it("leaves the config dir alone when homePath is set", () => {
    expect(
      withClaudeApiKeyEnvironment({ ...base, apiKey: "sk-ant-test", homePath: "~/.claude-work" }),
    ).toEqual([{ name: "ANTHROPIC_API_KEY", value: "sk-ant-test", sensitive: true }]);
  });

  it("keeps a CLAUDE_CONFIG_DIR the user set on the instance", () => {
    const environment = [{ name: "CLAUDE_CONFIG_DIR", value: "/custom", sensitive: false }];

    expect(withClaudeApiKeyEnvironment({ ...base, apiKey: "sk-ant-test", environment })).toEqual([
      ...environment,
      { name: "ANTHROPIC_API_KEY", value: "sk-ant-test", sensitive: true },
    ]);
  });

  it("replaces a blank CLAUDE_CONFIG_DIR with the dedicated config dir", () => {
    const environment = [{ name: "CLAUDE_CONFIG_DIR", value: " ", sensitive: false }];

    expect(
      withClaudeApiKeyEnvironment({ ...base, apiKey: "sk-ant-test", environment }).at(-1),
    ).toEqual({ name: "CLAUDE_CONFIG_DIR", value: defaultConfigDir, sensitive: false });
  });
});
