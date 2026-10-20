import {
  CustomProviderSettings,
  CodexSettings,
  ProviderDriverKind,
  ProviderSetupError,
  type ServerProvider,
  type ServerProviderModel,
  type ServerSettings,
  type ServerSettingsError,
} from "@t3tools/contracts";
import {
  type ProviderDriver,
  type ProviderInstance,
  defaultProviderContinuationIdentity,
} from "@t3tools/provider-core/server/driver";
import { withInstanceIdentity } from "@t3tools/provider-core/server/instanceIdentity";
import { makeManagedServerProvider } from "@t3tools/provider-core/server/managedProvider";
import {
  buildServerProvider,
  type ServerProviderDraft,
  providerModelsFromSettings,
} from "@t3tools/provider-core/server/snapshotProbe";
import * as ProviderHost from "@t3tools/provider-core/server/ProviderHost";
import { mergeProviderInstanceEnvironment } from "@t3tools/provider-core/server/instanceEnvironment";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as Result from "effect/Result";
import * as Schema from "effect/Schema";
import * as Scope from "effect/Scope";
import { HttpClient } from "effect/http";
import { ChildProcessSpawner } from "effect/process";
import * as FileSystem from "effect/FileSystem";
import * as Path from "effect/Path";

import { ServerConfig } from "../../config.ts";
import { makeCodexTextGeneration } from "../../textGeneration/CodexTextGeneration.ts";
import * as CodexInstallation from "../CodexInstallation.ts";
import type { CodexEffectiveRuntime } from "../CodexManagedRuntime.ts";
import { fetchCustomProviderModels } from "../CustomProviderModels.ts";
import {
  customProviderEnvironment,
  customProviderHomePath,
  customProviderLaunchArgs,
  normalizeCustomProviderBaseUrl,
} from "../CustomProviderRuntime.ts";
import { ProviderDriverError } from "../Errors.ts";
import {
  createCodexAdapterV2,
  type CodexAdapterV2DriverEnv,
} from "../../orchestration-v2/Adapters/CodexAdapterV2.ts";

const DRIVER_KIND = ProviderDriverKind.make("customProvider");
const decodeCodexSettings = Schema.decodeSync(CodexSettings);
const decodeCustomProviderSettings = Schema.decodeSync(CustomProviderSettings);

import type { CodexDriverEnv } from "./CodexDriver.ts";
export type CustomProviderDriverEnv = CodexDriverEnv;

export const CustomProviderDriver: ProviderDriver<CustomProviderSettings, CustomProviderDriverEnv> =
  {
    driverKind: DRIVER_KIND,
    metadata: {
      displayName: "Custom Provider",
      supportsMultipleInstances: true,
    },
    configSchema: CustomProviderSettings,
    defaultConfig: (): CustomProviderSettings => decodeCustomProviderSettings({}),
    create: (input) =>
      Effect.gen(function* () {
        const { instanceId, displayName, accentColor, enabled, config } = input;
        const installation = yield* CodexInstallation.CodexInstallation;
        const serverConfig = yield* ServerConfig;
        const fileSystem = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const http = yield* HttpClient.HttpClient;
        const host = yield* ProviderHost.ProviderHost;

        const homePath = customProviderHomePath(path, serverConfig.stateDir, instanceId);
        const continuationIdentity = defaultProviderContinuationIdentity({
          driverKind: DRIVER_KIND,
          instanceId,
        });
        const stampIdentity = withInstanceIdentity({
          instanceId,
          driverKind: DRIVER_KIND,
          displayName: displayName || "Custom Provider",
          accentColor,
          continuationGroupKey: continuationIdentity.continuationKey,
        });
        // Install goes through the shared managed Codex installer; there is no login step.
        const stamp = (provider: ServerProviderDraft) =>
          stampIdentity({ ...provider, setup: { canInstall: true, canAuthenticate: false } });

        const resolveRuntime: Effect.Effect<
          CodexEffectiveRuntime,
          ProviderSetupError,
          Scope.Scope
        > = Effect.gen(function* () {
          const normalizedUrl = normalizeCustomProviderBaseUrl(config.baseUrl);
          if (Option.isNone(normalizedUrl)) {
            return yield* new ProviderSetupError({
              instanceId,
              operation: "runtime",
              detail: "Enter a valid http(s) Base URL in provider settings.",
            });
          }

          const executable = yield* installation.acquire().pipe(
            Effect.mapError(
              () =>
                new ProviderSetupError({
                  instanceId,
                  operation: "install",
                  detail: "Set up the Codex runtime to use this provider.",
                }),
            ),
          );

          yield* fileSystem.makeDirectory(homePath, { recursive: true }).pipe(
            Effect.mapError(
              () =>
                new ProviderSetupError({
                  instanceId,
                  operation: "runtime",
                  detail: "Could not prepare the custom provider runtime.",
                }),
            ),
          );

          const launchArgs = customProviderLaunchArgs({
            baseUrl: normalizedUrl.value,
            hasApiKey: config.apiKey.length > 0,
          });

          const baseEnv = yield* mergeProviderInstanceEnvironment(input.environment);
          const environment = customProviderEnvironment({
            base: baseEnv,
            homePath,
            apiKey: config.apiKey,
          });

          const revision = `${normalizedUrl.value}:${config.apiKey.length > 0 ? "key" : "none"}`;

          return {
            config: decodeCodexSettings({
              enabled,
              binaryPath: executable.executablePath,
              homePath,
              launchArgs,
            }),
            environment,
            revision,
          };
        });

        const pending: Effect.Effect<ServerProvider> = Effect.gen(function* () {
          const checkedAt = yield* Effect.map(DateTime.now, DateTime.formatIso);
          return stamp(
            buildServerProvider({
              presentation: {
                displayName: displayName || "Custom Provider",
                showInteractionModeToggle: true,
                reportsContextWindow: true,
              },
              enabled,
              checkedAt,
              models: [],
              skills: [],
              probe: {
                installed: false,
                version: null,
                status: "warning",
                auth: { status: "unknown" },
                message: "Custom Provider status has not been checked in this session yet.",
              },
            }),
          );
        });

        const checkProvider: Effect.Effect<ServerProvider, ServerSettingsError> = Effect.gen(
          function* () {
            const checkedAt = yield* Effect.map(DateTime.now, DateTime.formatIso);

            if (!enabled) {
              return stamp(
                buildServerProvider({
                  presentation: {
                    displayName: displayName || "Custom Provider",
                    showInteractionModeToggle: true,
                    reportsContextWindow: true,
                  },
                  enabled: false,
                  checkedAt,
                  models: [],
                  skills: [],
                  probe: {
                    installed: false,
                    version: null,
                    status: "warning",
                    auth: { status: "unknown" },
                    message: "Custom Provider is disabled in T3 Code settings.",
                  },
                }),
              );
            }

            const normalizedUrl = normalizeCustomProviderBaseUrl(config.baseUrl);
            if (Option.isNone(normalizedUrl)) {
              return stamp(
                buildServerProvider({
                  presentation: {
                    displayName: displayName || "Custom Provider",
                    showInteractionModeToggle: true,
                    reportsContextWindow: true,
                  },
                  enabled: true,
                  checkedAt,
                  models: [],
                  skills: [],
                  probe: {
                    installed: true,
                    version: null,
                    status: "warning",
                    auth: { status: "authenticated" },
                    message: "Enter a valid http(s) Base URL in provider settings.",
                  },
                }),
              );
            }

            const executable = yield* installation.resolve().pipe(Effect.option);
            if (Option.isNone(executable)) {
              // Download the managed runtime in the background so adding the provider is enough;
              // the installation refresh re-checks this instance when it finishes.
              const download = yield* installation.start.pipe(Effect.result);
              const downloadMessage = Result.isSuccess(download)
                ? "Downloading the Codex runtime. The provider is ready when it finishes."
                : download.failure.detail;
              return stamp(
                buildServerProvider({
                  presentation: {
                    displayName: displayName || "Custom Provider",
                    showInteractionModeToggle: true,
                    reportsContextWindow: true,
                  },
                  enabled: true,
                  checkedAt,
                  models: [],
                  skills: [],
                  probe: {
                    installed: false,
                    version: null,
                    status: Result.isSuccess(download) ? "warning" : "error",
                    auth: { status: "unknown" },
                    message: downloadMessage,
                  },
                }),
              );
            }

            const fetchResult = yield* fetchCustomProviderModels({
              baseUrl: normalizedUrl.value,
              apiKey: config.apiKey,
            }).pipe(
              Effect.provideService(HttpClient.HttpClient, http),
              Effect.map((models) => ({ ok: true as const, models })),
              Effect.catch((error) => Effect.succeed({ ok: false as const, error })),
            );

            if (!fetchResult.ok) {
              return stamp(
                buildServerProvider({
                  presentation: {
                    displayName: displayName || "Custom Provider",
                    showInteractionModeToggle: true,
                    reportsContextWindow: true,
                  },
                  enabled: true,
                  checkedAt,
                  models: [],
                  skills: [],
                  probe: {
                    installed: true,
                    version: executable.value.version,
                    status: "error",
                    auth: { status: "authenticated" },
                    message: fetchResult.error.message,
                  },
                }),
              );
            }

            const discoveredModels: ServerProviderModel[] = fetchResult.models.map((id) => ({
              slug: id,
              name: id,
              isCustom: false,
              capabilities: null,
            }));

            const models = providerModelsFromSettings(
              discoveredModels,
              config.customModels ?? [],
              null,
            );

            return stamp(
              buildServerProvider({
                presentation: {
                  displayName: displayName || "Custom Provider",
                  showInteractionModeToggle: true,
                  reportsContextWindow: true,
                },
                enabled: true,
                checkedAt,
                models,
                skills: [],
                probe: {
                  installed: true,
                  version: executable.value.version,
                  status: "ready",
                  auth: { status: "authenticated" },
                },
              }),
            );
          },
        );

        const snapshot = yield* makeManagedServerProvider<ServerSettings>({
          resolveMaintenance: () =>
            Effect.succeed({ provider: DRIVER_KIND, packageName: null, update: null }),
          getSettings: host.settings.get,
          streamSettings: host.settings.changes,
          haveSettingsChanged: (_prev: ServerSettings, _next: ServerSettings) => false,
          initialSnapshot: (_settings: ServerSettings) => pending,
          checkProvider,
        }).pipe(
          Effect.mapError(
            (cause) =>
              new ProviderDriverError({
                driver: DRIVER_KIND,
                instanceId,
                detail: `Failed to build Custom Provider snapshot: ${cause.message ?? String(cause)}`,
                cause,
              }),
          ),
        );

        const orchestrationAdapter = yield* createCodexAdapterV2(
          {
            instanceId,
            displayName,
            accentColor,
            environment: input.environment,
            enabled,
            config: decodeCodexSettings({
              enabled,
              launchArgs: "",
            }),
          },
          {
            resolveRuntime,
            driverKind: DRIVER_KIND,
          },
        ).pipe(
          Effect.mapError(
            (cause) =>
              new ProviderDriverError({
                driver: DRIVER_KIND,
                instanceId,
                detail: `Failed to initialize custom provider orchestration adapter: ${cause.message ?? String(cause)}`,
                cause,
              }),
          ),
        );

        const textGeneration = yield* makeCodexTextGeneration(
          decodeCodexSettings({ enabled, launchArgs: "" }),
          undefined,
          snapshot.getSnapshot.pipe(Effect.map((value) => value.models)),
          resolveRuntime,
        );

        return {
          instanceId,
          driverKind: DRIVER_KIND,
          continuationIdentity,
          displayName,
          accentColor,
          enabled,
          snapshot,
          orchestrationAdapter,
          textGeneration,
          snapshotForCwd: () => snapshot.getSnapshot,
        } satisfies ProviderInstance;
      }),
  };
