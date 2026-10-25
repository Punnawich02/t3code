import * as NodeServices from "@effect/platform-node/NodeServices";
import { describe, expect, it } from "@effect/vitest";
import { ClaudeSettings, ProviderInstanceId } from "@t3tools/contracts";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Schema from "effect/Schema";

import * as ServerConfig from "../../config.ts";
import { claudeUsageReader, parseClaudeLine } from "./claudeUsage.ts";

const decodeClaudeSettings = Schema.decodeSync(ClaudeSettings);

function claudeLine(overrides: {
  messageId: string;
  contentType: string;
  model?: string;
  outputTokens?: number;
  speed?: string;
}): string {
  return JSON.stringify({
    type: "assistant",
    timestamp: "2026-08-07T04:05:13.944Z",
    sessionId: "5a128faa-8253-489e-b935-6c08e8e670c0",
    cwd: "/home/theo/project",
    message: {
      id: overrides.messageId,
      role: "assistant",
      model: overrides.model ?? "claude-fable-5",
      content: [{ type: overrides.contentType }],
      usage: {
        input_tokens: 2,
        cache_creation_input_tokens: 66818,
        cache_read_input_tokens: 1000,
        output_tokens: overrides.outputTokens ?? 286,
        ...(overrides.speed === undefined ? {} : { speed: overrides.speed }),
      },
    },
  });
}

describe("parseClaudeLine", () => {
  it("extracts token totals and a dedupe key", () => {
    const record = parseClaudeLine(claudeLine({ messageId: "msg_1", contentType: "text" }));

    expect(record).not.toBeNull();
    expect(record?.provider).toBe("claude");
    expect(record?.model).toBe("claude-fable-5");
    expect(record?.totals).toEqual({
      uncachedInputTokens: 2,
      cachedInputTokens: 1000,
      cacheCreationTokens: 66818,
      outputTokens: 286,
      reasoningTokens: 0,
    });
    expect(record?.dedupeKey).toBe("msg_1:");
    expect(record?.speed).toBe("standard");
  });

  it("marks fast-mode requests", () => {
    const line = (speed: string) =>
      parseClaudeLine(claudeLine({ messageId: "msg_1", contentType: "text", speed }));

    expect(line("fast")?.speed).toBe("fast");
    expect(line("standard")?.speed).toBe("standard");
  });

  it("gives every content block of one message the same dedupe key", () => {
    // T3 Code writes one record per content block, each repeating the parent
    // message's full usage. Summing them would overcount ~2.4x on real data.
    const text = parseClaudeLine(claudeLine({ messageId: "msg_2", contentType: "text" }));
    const toolUse = parseClaudeLine(claudeLine({ messageId: "msg_2", contentType: "tool_use" }));

    expect(text?.dedupeKey).toBe(toolUse?.dedupeKey);
    expect(text?.totals).toEqual(toolUse?.totals);
  });

  it("ignores records that are not assistant messages", () => {
    expect(parseClaudeLine(JSON.stringify({ type: "user", message: {} }))).toBeNull();
    expect(parseClaudeLine("not json")).toBeNull();
  });
});

const transcriptReader = claudeUsageReader;
if (transcriptReader.kind !== "transcripts")
  throw new Error("Claude usage comes from transcripts.");

describe("claudeUsageReader.directories", () => {
  const testLayer = ServerConfig.layerTest(process.cwd(), { prefix: "t3-claude-usage-" }).pipe(
    Layer.provideMerge(NodeServices.layer),
  );

  it.effect("reads an API-key instance's transcripts from its own config dir", () =>
    Effect.gen(function* () {
      const { stateDir } = yield* ServerConfig.ServerConfig;
      const directories = yield* transcriptReader.directories({
        instanceId: ProviderInstanceId.make("claude_api"),
        config: decodeClaudeSettings({ apiKey: "sk-ant-test" }),
        environment: {},
        configured: true,
      });
      expect(directories).toEqual([
        { dir: `${stateDir}/providers/claudeAgent/claude_api/config/projects` },
      ]);
    }).pipe(Effect.provide(testLayer)),
  );

  it.effect("keeps a user-set CLAUDE_CONFIG_DIR for an API-key instance", () =>
    Effect.gen(function* () {
      const directories = yield* transcriptReader.directories({
        instanceId: ProviderInstanceId.make("claude_api"),
        config: decodeClaudeSettings({ apiKey: "sk-ant-test" }),
        environment: { CLAUDE_CONFIG_DIR: "/custom/claude" },
        configured: true,
      });
      expect(directories).toEqual([{ dir: "/custom/claude/projects" }]);
    }).pipe(Effect.provide(testLayer)),
  );
});
