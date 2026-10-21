import { describe, expect, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as Path from "effect/Path";
import {
  customProviderEnvironment,
  customProviderHomePath,
  customProviderLaunchArgs,
  normalizeCustomProviderBaseUrl,
} from "./CustomProviderRuntime.ts";

describe("CustomProviderRuntime", () => {
  describe("normalizeCustomProviderBaseUrl", () => {
    it("normalizes trailing slash", () => {
      expect(normalizeCustomProviderBaseUrl("http://localhost:11434/v1/")).toEqual(
        Option.some("http://localhost:11434/v1"),
      );
    });

    it("rejects bad base URLs", () => {
      expect(normalizeCustomProviderBaseUrl("")).toEqual(Option.none());
      expect(normalizeCustomProviderBaseUrl("localhost:11434")).toEqual(Option.none());
      expect(normalizeCustomProviderBaseUrl("ftp://x/v1")).toEqual(Option.none());
      expect(normalizeCustomProviderBaseUrl("http://x/v1'evil")).toEqual(Option.none());
    });
  });

  describe("customProviderLaunchArgs", () => {
    it("omits env_key without an API key", () => {
      const args = customProviderLaunchArgs({
        baseUrl: "http://localhost:11434/v1",
        hasApiKey: false,
      });
      expect(args).toContain('base_url="http://localhost:11434/v1"');
      expect(args).toContain('wire_api="responses"');
      expect(args).not.toContain("env_key");
    });

    it("includes env_key with an API key", () => {
      const args = customProviderLaunchArgs({
        baseUrl: "http://localhost:11434/v1",
        hasApiKey: true,
      });
      expect(args).toContain('env_key="T3_CUSTOM_PROVIDER_API_KEY"');
    });
  });

  describe("customProviderEnvironment", () => {
    it("scrubs inherited endpoint variables", () => {
      const base: NodeJS.ProcessEnv = {
        OPENAI_API_KEY: "a",
        OPENAI_BASE_URL: "b",
        T3CODE_CODEX_LAUNCH_ARGS: "c",
        ACCESS_TOKEN: "d",
        T3_CUSTOM_PROVIDER_API_KEY: "e",
        PATH: "/bin",
      };
      const result = customProviderEnvironment({
        base,
        homePath: "/home/user/state/codex-home",
        apiKey: "",
      });
      expect(result).toEqual({
        PATH: "/bin",
        CODEX_HOME: "/home/user/state/codex-home",
      });
    });

    it("sets the API key variable when present", () => {
      const base: NodeJS.ProcessEnv = {
        PATH: "/bin",
      };
      const result = customProviderEnvironment({
        base,
        homePath: "/home/user/state/codex-home",
        apiKey: "sk-1",
      });
      expect(result.T3_CUSTOM_PROVIDER_API_KEY).toBe("sk-1");
    });
  });

  describe("customProviderHomePath", () => {
    it.effect("separate homes per instance", () =>
      Effect.gen(function* () {
        const path = yield* Path.Path;
        const stateDir = "/tmp/t3-state";
        const home1 = customProviderHomePath(path, stateDir, "ollama_local");
        const home2 = customProviderHomePath(path, stateDir, "runpod");

        expect(home1).not.toEqual(home2);
        expect(home1).toBe("/tmp/t3-state/providers/customProvider/ollama_local/codex-home");
        expect(home2).toBe("/tmp/t3-state/providers/customProvider/runpod/codex-home");
        expect(home1.startsWith("/tmp/t3-state/providers/customProvider/")).toBe(true);
        expect(home2.startsWith("/tmp/t3-state/providers/customProvider/")).toBe(true);
      }).pipe(Effect.provide(Path.layer)),
    );
  });
});
