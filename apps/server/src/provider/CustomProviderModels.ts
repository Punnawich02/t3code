import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";
import { HttpClient, HttpClientRequest } from "effect/http";

export class CustomProviderEndpointError extends Schema.TaggedError<CustomProviderEndpointError>()(
  "CustomProviderEndpointError",
  {
    message: Schema.String,
  },
) {}

const ModelsResponse = Schema.Struct({
  data: Schema.Array(
    Schema.Struct({
      id: Schema.String,
    }),
  ),
});

export const fetchCustomProviderModels = (input: {
  readonly baseUrl: string;
  readonly apiKey: string;
}): Effect.Effect<ReadonlyArray<string>, CustomProviderEndpointError, HttpClient.HttpClient> =>
  Effect.gen(function* () {
    const http = yield* HttpClient.HttpClient;
    let request = HttpClientRequest.get(`${input.baseUrl}/models`);
    if (input.apiKey.trim().length > 0) {
      request = request.pipe(HttpClientRequest.bearerToken(input.apiKey.trim()));
    }

    const response = yield* http.execute(request).pipe(
      Effect.mapError(
        () =>
          new CustomProviderEndpointError({
            message: `Could not reach ${input.baseUrl}. Check that the server is running and reachable from this machine.`,
          }),
      ),
    );

    if (response.status === 401 || response.status === 403) {
      return yield* new CustomProviderEndpointError({
        message: "The endpoint rejected the API key.",
      });
    }

    if (response.status < 200 || response.status >= 300) {
      return yield* new CustomProviderEndpointError({
        message: `The endpoint returned HTTP ${response.status} for /models.`,
      });
    }

    const catalog = yield* response.json.pipe(
      Effect.flatMap(Schema.decodeUnknownEffect(ModelsResponse)),
      Effect.mapError(
        () =>
          new CustomProviderEndpointError({
            message: "The endpoint did not return an OpenAI-compatible model list.",
          }),
      ),
    );

    const seen = new Set<string>();
    const models: string[] = [];
    for (const item of catalog.data) {
      if (!seen.has(item.id)) {
        seen.add(item.id);
        models.push(item.id);
      }
    }
    return models;
  }).pipe(
    Effect.timeout("10 seconds"),
    Effect.catchTag(
      "TimeoutError",
      () =>
        new CustomProviderEndpointError({
          message: `Could not reach ${input.baseUrl}. Check that the server is running and reachable from this machine.`,
        }),
    ),
  );
