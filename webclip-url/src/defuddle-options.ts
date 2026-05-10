import type { ClipOptions, DefuddleRuntimeOptions } from "./types.js";

export function buildDefuddleOptions(
  url: string,
  options: ClipOptions,
): DefuddleRuntimeOptions {
  const contentSelector =
    options.contentSelector ??
    firstSelectorHtmlMarkdownSelector(options.template.noteContentFormat);

  return {
    url,
    markdown: true,
    separateMarkdown: true,
    ...(options.language ? { language: options.language } : {}),
    ...(contentSelector ? { contentSelector } : {}),
    ...(options.removeImages !== undefined ? { removeImages: options.removeImages } : {}),
    ...(options.debug !== undefined ? { debug: options.debug } : {}),
  };
}

function firstSelectorHtmlMarkdownSelector(format: string): string | undefined {
  const matches = format.matchAll(/\{\{\s*selectorHtml:([^|}]+)\|[^}]*markdown[^}]*\}\}/g);
  const first = matches.next();

  if (first.done) {
    return undefined;
  }

  return first.value[1]?.trim();
}
