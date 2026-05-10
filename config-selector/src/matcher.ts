import type { ConfigCandidate, ConfigMatch, TriggerMatch, TriggerMatchKind } from "./types.js";

export function selectConfig(
  url: string,
  candidates: ConfigCandidate[],
): ConfigMatch | undefined {
  return findConfigMatches(url, candidates)[0];
}

export function findConfigMatches(
  url: string,
  candidates: ConfigCandidate[],
): ConfigMatch[] {
  const matches = candidates.flatMap((candidate) => {
    const match = bestTriggerMatch(url, candidate.config.triggers ?? []);
    return match ? [{ ...candidate, match }] : [];
  });

  return matches.sort(compareConfigMatches);
}

export function bestTriggerMatch(
  url: string,
  triggers: string[],
): TriggerMatch | undefined {
  return triggers
    .map((trigger) => matchTrigger(url, trigger))
    .filter((match): match is TriggerMatch => match !== undefined)
    .sort(compareTriggerMatches)[0];
}

export function matchTrigger(url: string, rawTrigger: string): TriggerMatch | undefined {
  const trigger = rawTrigger.trim();

  if (!trigger) {
    return undefined;
  }

  const regex = parseRegexTrigger(trigger);
  if (regex) {
    return regex.pattern.test(url)
      ? buildMatch(trigger, "regex", regex.literalLength)
      : undefined;
  }

  if (hasGlobWildcard(trigger)) {
    return globToRegExp(trigger).test(url)
      ? buildMatch(trigger, "glob", literalLength(trigger))
      : undefined;
  }

  if (url === trigger) {
    return buildMatch(trigger, "exact", trigger.length);
  }

  return url.startsWith(trigger)
    ? buildMatch(trigger, "prefix", trigger.length)
    : undefined;
}

function compareConfigMatches(left: ConfigMatch, right: ConfigMatch): number {
  const byMatch = compareTriggerMatches(left.match, right.match);

  if (byMatch !== 0) {
    return byMatch;
  }

  return left.path.localeCompare(right.path);
}

function compareTriggerMatches(left: TriggerMatch, right: TriggerMatch): number {
  return right.score - left.score || right.trigger.length - left.trigger.length;
}

function buildMatch(
  trigger: string,
  kind: TriggerMatchKind,
  specificity: number,
): TriggerMatch {
  return {
    trigger,
    kind,
    score: kindWeight(kind) + specificity,
  };
}

function kindWeight(kind: TriggerMatchKind): number {
  switch (kind) {
    case "exact":
      return 40_000;
    case "glob":
      return 30_000;
    case "regex":
      return 20_000;
    case "prefix":
      return 10_000;
    case "fallback":
      return 0;
  }
}

function parseRegexTrigger(
  trigger: string,
): { pattern: RegExp; literalLength: number } | undefined {
  if (!trigger.startsWith("/")) {
    return undefined;
  }

  const lastSlash = findClosingRegexSlash(trigger);

  if (lastSlash <= 0) {
    return undefined;
  }

  const source = trigger.slice(1, lastSlash);
  const flags = trigger.slice(lastSlash + 1);

  try {
    return {
      pattern: new RegExp(source, flags),
      literalLength: literalLength(source),
    };
  } catch {
    return undefined;
  }
}

function findClosingRegexSlash(trigger: string): number {
  for (let index = trigger.length - 1; index > 0; index -= 1) {
    if (trigger[index] === "/" && trigger[index - 1] !== "\\") {
      return index;
    }
  }

  return -1;
}

function hasGlobWildcard(trigger: string): boolean {
  return trigger.includes("*");
}

function globToRegExp(glob: string): RegExp {
  const source = glob
    .split("*")
    .map(escapeRegExp)
    .join(".*");

  return new RegExp(`^${source}$`);
}

function escapeRegExp(value: string): string {
  return value.replace(/[|\\{}()[\]^$+?.]/g, "\\$&");
}

function literalLength(value: string): number {
  return value.replace(/[\\^$.*+?()[\]{}|]/g, "").length;
}
