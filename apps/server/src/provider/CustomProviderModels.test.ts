import { assert, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import { HttpClient, HttpClientError, HttpClientResponse } from "effect/http";
import { fetchCustomProviderModels } from "./CustomProviderModels.ts";

it.effect("discovers models and de-duplicates in response order", () =>
  Effect.gen(function* () {
    const http = HttpClient.make((request) =>
      Effect.sync(() => {
        assert.strictEqual(request.url, "http://localhost:11434/v1/models");
        return HttpClientResponse.fromWeb(
          request,
          new Response(
            JSON.stringify({
              data: [{ id: "qwen3.5:4b" }, { id: "qwen2.5-coder:1.5b" }, { id: "qwen3.5:4b" }],
            }),
          ),
        );
      }),
    );
    const models = yield* fetchCustomProviderModels({
      baseUrl: "http://localhost:11434/v1",
      apiKey: "",
    }).pipe(Effect.provideService(HttpClient.HttpClient, http));
    assert.deepEqual(models, ["qwen3.5:4b", "qwen2.5-coder:1.5b"]);
  }),
);

it.effect("includes Bearer header only when an API key is provided", () =>
  Effect.gen(function* () {
    let capturedHeaderWithKey: string | undefined;
    const httpWithKey = HttpClient.make((request) =>
      Effect.sync(() => {
        capturedHeaderWithKey = request.headers.authorization;
        return HttpClientResponse.fromWeb(
          request,
          new Response(JSON.stringify({ data: [{ id: "model-1" }] })),
        );
      }),
    );
    yield* fetchCustomProviderModels({
      baseUrl: "http://localhost:11434/v1",
      apiKey: "secret-key",
    }).pipe(Effect.provideService(HttpClient.HttpClient, httpWithKey));
    assert.strictEqual(capturedHeaderWithKey, "Bearer secret-key");

    let capturedHeaderWithoutKey: string | undefined;
    const httpWithoutKey = HttpClient.make((request) =>
      Effect.sync(() => {
        capturedHeaderWithoutKey = request.headers.authorization;
        return HttpClientResponse.fromWeb(
          request,
          new Response(JSON.stringify({ data: [{ id: "model-1" }] })),
        );
      }),
    );
    yield* fetchCustomProviderModels({
      baseUrl: "http://localhost:11434/v1",
      apiKey: "",
    }).pipe(Effect.provideService(HttpClient.HttpClient, httpWithoutKey));
    assert.isUndefined(capturedHeaderWithoutKey);
  }),
);

it.effect("reports 401 rejected API key error message", () =>
  Effect.gen(function* () {
    const http = HttpClient.make((request) =>
      Effect.sync(() =>
        HttpClientResponse.fromWeb(request, new Response("Unauthorized", { status: 401 })),
      ),
    );
    const error = yield* Effect.flip(
      fetchCustomProviderModels({
        baseUrl: "http://localhost:11434/v1",
        apiKey: "bad-key",
      }).pipe(Effect.provideService(HttpClient.HttpClient, http)),
    );
    assert.strictEqual(error._tag, "CustomProviderEndpointError");
    assert.strictEqual(error.message, "The endpoint rejected the API key.");
  }),
);

it.effect("reports HTTP status error message for non-2xx status codes", () =>
  Effect.gen(function* () {
    const http = HttpClient.make((request) =>
      Effect.sync(() =>
        HttpClientResponse.fromWeb(request, new Response("Internal Server Error", { status: 500 })),
      ),
    );
    const error = yield* Effect.flip(
      fetchCustomProviderModels({
        baseUrl: "http://localhost:11434/v1",
        apiKey: "",
      }).pipe(Effect.provideService(HttpClient.HttpClient, http)),
    );
    assert.strictEqual(error._tag, "CustomProviderEndpointError");
    assert.strictEqual(error.message, "The endpoint returned HTTP 500 for /models.");
  }),
);

it.effect("reports invalid JSON or incompatible schema error message", () =>
  Effect.gen(function* () {
    const http = HttpClient.make((request) =>
      Effect.sync(() =>
        HttpClientResponse.fromWeb(request, new Response("not-json", { status: 200 })),
      ),
    );
    const error = yield* Effect.flip(
      fetchCustomProviderModels({
        baseUrl: "http://localhost:11434/v1",
        apiKey: "",
      }).pipe(Effect.provideService(HttpClient.HttpClient, http)),
    );
    assert.strictEqual(error._tag, "CustomProviderEndpointError");
    assert.strictEqual(
      error.message,
      "The endpoint did not return an OpenAI-compatible model list.",
    );
  }),
);

it.effect("reports network failure error message", () =>
  Effect.gen(function* () {
    const http = HttpClient.make((request) =>
      Effect.fail(
        new HttpClientError.HttpClientError({
          reason: new HttpClientError.TransportError({ request }),
        }),
      ),
    );
    const error = yield* Effect.flip(
      fetchCustomProviderModels({
        baseUrl: "http://localhost:11434/v1",
        apiKey: "",
      }).pipe(Effect.provideService(HttpClient.HttpClient, http)),
    );
    assert.strictEqual(error._tag, "CustomProviderEndpointError");
    assert.strictEqual(
      error.message,
      "Could not reach http://localhost:11434/v1. Check that the server is running and reachable from this machine.",
    );
  }),
);
