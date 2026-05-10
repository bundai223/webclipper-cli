import { readdir, readFile, stat } from "node:fs/promises";
import { resolve } from "node:path";
import type { ConfigCandidate, WebClipperConfig } from "./types.js";

export async function loadConfigCandidates(paths: string[]): Promise<ConfigCandidate[]> {
  const files = await collectJsonFiles(paths);
  const candidates = await Promise.all(files.map(loadConfigCandidate));

  return candidates.filter((candidate): candidate is ConfigCandidate => candidate !== undefined);
}

async function collectJsonFiles(paths: string[]): Promise<string[]> {
  const collected = await Promise.all(paths.map(collectJsonFilesFromPath));
  return collected.flat().sort();
}

async function collectJsonFilesFromPath(path: string): Promise<string[]> {
  const absolutePath = resolve(path);
  const pathStat = await stat(absolutePath);

  if (pathStat.isFile()) {
    return absolutePath.endsWith(".json") ? [absolutePath] : [];
  }

  if (!pathStat.isDirectory()) {
    return [];
  }

  const entries = await readdir(absolutePath, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const entryPath = resolve(absolutePath, entry.name);

    if (entry.isDirectory()) {
      return collectJsonFilesFromPath(entryPath);
    }

    return entry.isFile() && entry.name.endsWith(".json") ? [entryPath] : [];
  }));

  return nested.flat();
}

async function loadConfigCandidate(path: string): Promise<ConfigCandidate | undefined> {
  const parsed = JSON.parse(await readFile(path, "utf8")) as unknown;

  if (!isWebClipperConfig(parsed)) {
    return undefined;
  }

  return {
    path,
    config: parsed,
  };
}

function isWebClipperConfig(value: unknown): value is WebClipperConfig {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const config = value as WebClipperConfig;
  return config.triggers === undefined
    || (Array.isArray(config.triggers) && config.triggers.every((trigger) => typeof trigger === "string"));
}
