export type WebClipperConfig = {
  schemaVersion?: string;
  name?: string;
  triggers?: string[];
  [key: string]: unknown;
};

export type ConfigCandidate = {
  path: string;
  config: WebClipperConfig;
};

export type TriggerMatchKind = "exact" | "prefix" | "glob" | "regex" | "fallback";

export type TriggerMatch = {
  trigger: string;
  kind: TriggerMatchKind;
  score: number;
};

export type ConfigMatch = ConfigCandidate & {
  match: TriggerMatch;
};
