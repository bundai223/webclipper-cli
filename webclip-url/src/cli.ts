#!/usr/bin/env node
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { clipUrl, loadTemplate } from "./clip.js";
import { buildDefuddleOptions } from "./defuddle-options.js";
import { diffLines } from "./diff.js";

type CliArgs = {
  template?: string;
  expected?: string;
  output?: string;
  html?: string;
  json: boolean;
  optionsOnly: boolean;
  language?: string;
  contentSelector?: string;
  removeImages?: boolean;
  debug?: boolean;
  url?: string;
};

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  if (!args.template || !args.url) {
    throw new Error("Usage: webclip --template <clipper-template.json> [--json] [--html page.html] [--output generated.md] [--expected expected.md] <url>");
  }

  const template = await loadTemplate(args.template);
  const html = args.html ? await readFile(args.html, "utf8") : undefined;
  const clipOptions = {
    template,
    ...(args.language ? { language: args.language } : {}),
    ...(args.contentSelector ? { contentSelector: args.contentSelector } : {}),
    ...(args.removeImages !== undefined ? { removeImages: args.removeImages } : {}),
    ...(args.debug !== undefined ? { debug: args.debug } : {}),
    ...(html ? { html } : {}),
  };

  if (args.optionsOnly) {
    process.stdout.write(`${JSON.stringify(buildDefuddleOptions(args.url, clipOptions), null, 2)}\n`);
    return;
  }

  const result = await clipUrl(args.url, clipOptions);
  const renderedOutput = args.json
    ? `${JSON.stringify(result, null, 2)}\n`
    : result.noteMarkdown;

  if (args.output) {
    await mkdir(dirname(args.output), { recursive: true });
    await writeFile(args.output, renderedOutput);
  }

  if (args.expected) {
    const expected = await readFile(args.expected, "utf8");
    const diff = diffLines(expected, result.noteMarkdown);
    process.stdout.write(`${diff.diff}\n`);
    process.exitCode = diff.equal ? 0 : 1;
    return;
  }

  if (args.json) {
    process.stdout.write(renderedOutput);
    return;
  }

  process.stdout.write(renderedOutput);
}

function parseArgs(rawArgs: string[]): CliArgs {
  const args: CliArgs = {
    json: false,
    optionsOnly: false,
  };

  for (let index = 0; index < rawArgs.length; index += 1) {
    const arg = rawArgs[index];

    switch (arg) {
      case "--template":
        args.template = requiredValue(rawArgs, ++index, arg);
        break;
      case "--expected":
        args.expected = requiredValue(rawArgs, ++index, arg);
        break;
      case "--output":
        args.output = requiredValue(rawArgs, ++index, arg);
        break;
      case "--html":
        args.html = requiredValue(rawArgs, ++index, arg);
        break;
      case "--json":
        args.json = true;
        break;
      case "--defuddle-options":
        args.optionsOnly = true;
        break;
      case "--language":
        args.language = requiredValue(rawArgs, ++index, arg);
        break;
      case "--content-selector":
        args.contentSelector = requiredValue(rawArgs, ++index, arg);
        break;
      case "--remove-images":
        args.removeImages = true;
        break;
      case "--debug":
        args.debug = true;
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

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
