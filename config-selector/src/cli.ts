#!/usr/bin/env node
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadConfigCandidates } from "./config-loader.js";
import { findConfigMatches, selectConfig } from "./matcher.js";
import type { ConfigMatch } from "./types.js";

type CliArgs = {
  configPaths: string[];
  fallback?: string;
  json: boolean;
  matchJson: boolean;
  pathOnly: boolean;
  all: boolean;
  url?: string;
};

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  if (!args.url) {
    throw new Error("Usage: config-selector [--configs <dir-or-json>] [--fallback <config-json>] [--json|--match-json|--all] <url>");
  }

  const configPaths = args.configPaths.length > 0
    ? args.configPaths
    : [defaultConfigDirectory()];
  const candidates = await loadConfigCandidates(configPaths);
  const selected = selectConfig(args.url, candidates)
    ?? await loadFallbackConfig(args.fallback);

  if (args.all) {
    process.stdout.write(`${JSON.stringify(findConfigMatches(args.url, candidates).map(formatMatch), null, 2)}\n`);
    return;
  }

  if (!selected) {
    throw new Error(`No matching config found for URL: ${args.url}`);
  }

  if (args.json) {
    process.stdout.write(`${JSON.stringify(selected.config, null, 2)}\n`);
    return;
  }

  if (args.matchJson) {
    process.stdout.write(`${JSON.stringify(formatMatch(selected), null, 2)}\n`);
    return;
  }

  process.stdout.write(`${selected.path}\n`);
}

function parseArgs(rawArgs: string[]): CliArgs {
  const args: CliArgs = {
    configPaths: [],
    json: false,
    matchJson: false,
    pathOnly: false,
    all: false,
  };

  for (let index = 0; index < rawArgs.length; index += 1) {
    const arg = rawArgs[index];

    switch (arg) {
      case "--configs":
      case "--config-dir":
        args.configPaths.push(requiredValue(rawArgs, ++index, arg));
        break;
      case "--fallback":
        args.fallback = requiredValue(rawArgs, ++index, arg);
        break;
      case "--json":
        args.json = true;
        break;
      case "--match-json":
        args.matchJson = true;
        break;
      case "--path":
        args.pathOnly = true;
        break;
      case "--all":
        args.all = true;
        break;
      default:
        if (arg?.startsWith("-")) {
          throw new Error(`Unknown option: ${arg}`);
        }

        args.url = arg;
        break;
    }
  }

  return args;
}

function requiredValue(args: string[], index: number, option: string): string {
  const value = args[index];

  if (!value) {
    throw new Error(`${option} requires a value`);
  }

  return value;
}

function defaultConfigDirectory(): string {
  const cliDirectory = dirname(fileURLToPath(import.meta.url));
  return resolve(cliDirectory, "../../webclip-url/fixtures");
}

async function loadFallbackConfig(path: string | undefined): Promise<ConfigMatch | undefined> {
  if (!path) {
    return undefined;
  }

  const [fallback] = await loadConfigCandidates([path]);

  if (!fallback) {
    throw new Error(`Fallback config is not a readable JSON config: ${path}`);
  }

  return {
    ...fallback,
    match: {
      trigger: "<fallback>",
      kind: "fallback",
      score: 0,
    },
  };
}

function formatMatch(match: ConfigMatch): object {
  return {
    path: match.path,
    name: match.config.name,
    trigger: match.match.trigger,
    kind: match.match.kind,
    score: match.match.score,
  };
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
