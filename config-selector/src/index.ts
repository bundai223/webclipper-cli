export { loadConfigCandidates } from "./config-loader.js";
export {
  bestTriggerMatch,
  findConfigMatches,
  matchTrigger,
  selectConfig,
} from "./matcher.js";
export type {
  ConfigCandidate,
  ConfigMatch,
  TriggerMatch,
  TriggerMatchKind,
  WebClipperConfig,
} from "./types.js";
