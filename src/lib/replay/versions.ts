import type { EngineVersions } from "./dataset";
declare const __REPLAY_ENGINE_VERSIONS__: EngineVersions;
export const ENGINE_VERSIONS = __REPLAY_ENGINE_VERSIONS__;
export const REPLAY_VERIFIED =
  ENGINE_VERSIONS.vela === "0.8.3" &&
  ENGINE_VERSIONS.bridge === "0.2.15" &&
  ENGINE_VERSIONS.pine === "0.11.0";
