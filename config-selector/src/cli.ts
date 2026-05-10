#!/usr/bin/env node
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadConfigCandidates } from "./config-loader.js";
import { findConfigMatches, selectConfig } from "./matcher.js";

type CliArgs = {
  configPaths: string[];
  json: boolean;
  pathOnly: boolean;
  all: boolean;
  url?: string;
};

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  if (!args.url) {
    throw new Error("Usage: config-selector [--configs <dir-or-json>] [--json|--path|--all] <url>");
  }

  const configPaths = args.configPaths.length > 0
    ? args.configPaths
    : [defaultConfigDirectory()];
  const candidates = await loadConfigCandidates(configPaths);
  const selected = selectConfig(args.url, candidates);

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

  if (args.pathOnly) {
    process.stdout.write(`${selected.path}\n`);
    return;
  }

  process.stdout.write(`${JSON.stringify(formatMatch(selected), null, 2)}\n`);
}

function parseArgs(rawArgs: string[]): CliArgs {
  const args: CliArgs = {
    configPaths: [],
    json: false,
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
      case "--json":
        args.json = true;
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

function formatMatch(match: ReturnType<typeof selectConfig> extends infer T ? NonNullable<T> : never): object {
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
