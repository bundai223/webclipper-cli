import { Defuddle } from "defuddle/node";
import type {
  ClipContext,
  WebClipperProperty,
  WebClipperTemplate,
} from "./types.js";

export async function renderTemplate(
  template: WebClipperTemplate,
  context: ClipContext,
): Promise<{
  markdown: string;
  noteName: string;
  properties: Record<string, unknown>;
}> {
  const properties: Record<string, unknown> = {};

  for (const property of template.properties) {
    properties[property.name] = coercePropertyValue(
      await renderString(property.value, context),
      property,
    );
  }

  return {
    markdown: await renderString(template.noteContentFormat, context),
    noteName: await renderString(template.noteNameFormat, context),
    properties,
  };
}

async function renderString(input: string, context: ClipContext): Promise<string> {
  const matches = Array.from(input.matchAll(/\{\{\s*([^}]+?)\s*\}\}/g));
  let output = input;

  for (const match of matches) {
    const expression = match[1] ?? "";
    const rendered = await evaluateExpression(expression, context);
    output = output.replace(match[0], rendered);
  }

  return output;
}

async function evaluateExpression(
  expression: string,
  context: ClipContext,
): Promise<string> {
  const [source = "", ...filterParts] = expression.split("|").map((part) => part.trim());
  let value: unknown;

  if (source.startsWith("selectorHtml:")) {
    value = selectorHtml(context.document, source.slice("selectorHtml:".length));
  } else if (source.startsWith("selector:")) {
    value = selector(context.document, source.slice("selector:".length));
  } else {
    value = variable(source, context);
  }

  for (const filter of filterParts) {
    value = await applyFilter(value, filter, context);
  }

  return stringifyInterpolated(value);
}

function variable(name: string, context: ClipContext): unknown {
  switch (name) {
    case "content":
      return context.defuddle.contentMarkdown ?? context.defuddle.content ?? "";
    case "url":
      return context.url;
    case "date":
      return context.date;
    case "site":
      return context.defuddle.site ?? "";
    default:
      return context.defuddle[name] ?? "";
  }
}

function selector(document: Document, selectorSpec: string): string[] {
  const { cssSelector, attribute } = splitSelectorAttribute(selectorSpec);
  const elements = Array.from(document.querySelectorAll(cssSelector));

  return elements
    .map((element) => {
      if (attribute) {
        return element.getAttribute(attribute) ?? "";
      }

      return element.textContent ?? "";
    })
    .map(normalizeText)
    .filter((value) => value.length > 0);
}

function selectorHtml(document: Document, selectorSpec: string): string[] {
  const { cssSelector } = splitSelectorAttribute(selectorSpec);

  return Array.from(document.querySelectorAll(cssSelector))
    .map((element) => element.outerHTML ?? "")
    .filter((value) => value.length > 0);
}

function splitSelectorAttribute(selectorSpec: string): {
  cssSelector: string;
  attribute?: string;
} {
  const trimmed = selectorSpec.trim();
  const attributeIndex = trimmed.lastIndexOf("?");

  if (attributeIndex === -1) {
    return { cssSelector: trimmed };
  }

  return {
    cssSelector: trimmed.slice(0, attributeIndex).trim(),
    attribute: trimmed.slice(attributeIndex + 1).trim(),
  };
}

async function applyFilter(
  value: unknown,
  filter: string,
  context: ClipContext,
): Promise<unknown> {
  const [name = "", rawArgs = ""] = filter.split(":", 2).map((part) => part.trim());
  const args = parseFilterArgs(rawArgs);

  switch (name) {
    case "":
      return value;
    case "first":
      return Array.isArray(value) ? value[0] ?? "" : value;
    case "join":
      return toArray(value).join(args[0] ?? "");
    case "split":
      return String(value).split(args[0] ?? ",");
    case "slice": {
      const [start, end] = args.map((arg) => Number.parseInt(arg, 10));
      return toArray(value).slice(start, Number.isNaN(end) ? undefined : end);
    }
    case "markdown":
      return markdownFromHtml(value, context);
    default:
      return value;
  }
}

function parseFilterArgs(rawArgs: string): string[] {
  if (!rawArgs) {
    return [];
  }

  return rawArgs
    .split(",")
    .map((arg) => arg.trim())
    .map((arg) => arg.replace(/^["']|["']$/g, ""));
}

async function markdownFromHtml(value: unknown, context: ClipContext): Promise<string> {
  const html = toArray(value).join("\n");
  const result = await Defuddle(`<html><body>${html}</body></html>`, context.finalUrl, {
    markdown: true,
    separateMarkdown: true,
    removeLowScoring: false,
  } as Parameters<typeof Defuddle>[2] & { removeLowScoring: boolean });

  return String(result.contentMarkdown ?? result.content ?? "");
}

function coercePropertyValue(value: string, property: WebClipperProperty): unknown {
  if (property.type === "multitext") {
    return value
      .split(",")
      .map((item) => item.trim())
      .filter((item) => item.length > 0);
  }

  return value;
}

function stringifyInterpolated(value: unknown): string {
  if (Array.isArray(value)) {
    if (value.length === 1) {
      return String(value[0]);
    }

    return value.map((item) => String(item)).join(", ");
  }

  return String(value ?? "");
}

function toArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => String(item));
  }

  return [String(value ?? "")];
}

function normalizeText(value: string): string {
  return value.replace(/[ \t\r\n\f\v]+/g, " ").trim();
}
