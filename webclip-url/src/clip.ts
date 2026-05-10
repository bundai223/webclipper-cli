import { readFile } from "node:fs/promises";
import { Defuddle } from "defuddle/node";
import { buildDefuddleOptions } from "./defuddle-options.js";
import { parseHtmlDocument } from "./dom.js";
import { BOT_USER_AGENT, fetchPage } from "./fetch-page.js";
import { renderNoteMarkdown } from "./frontmatter.js";
import { renderTemplate } from "./template.js";
import type { ClipOptions, ClipResult, WebClipperTemplate } from "./types.js";

export async function loadTemplate(path: string): Promise<WebClipperTemplate> {
  return JSON.parse(await readFile(path, "utf8")) as WebClipperTemplate;
}

export async function clipUrl(
  url: string,
  options: ClipOptions,
): Promise<ClipResult> {
  const page = options.html
    ? { html: options.html, finalUrl: url }
    : await fetchPage(url, options.language);
  const { html, finalUrl } = page;
  const document = parseHtmlDocument(html, finalUrl);
  const defuddleDocument = parseHtmlDocument(html, finalUrl);
  const defuddleOptions = buildDefuddleOptions(finalUrl, options);
  let defuddleResult = await Defuddle(
    defuddleDocument,
    finalUrl,
    defuddleOptions as Parameters<typeof Defuddle>[2],
  );

  if (!options.html && Number(defuddleResult.wordCount ?? 0) === 0) {
    const botPage = await fetchPage(url, options.language, BOT_USER_AGENT);
    const botDocument = parseHtmlDocument(botPage.html, botPage.finalUrl);
    const botResult = await Defuddle(
      botDocument,
      botPage.finalUrl,
      buildDefuddleOptions(botPage.finalUrl, options) as Parameters<
        typeof Defuddle
      >[2],
    );

    if (Number(botResult.wordCount ?? 0) > 0) {
      defuddleResult = botResult;
    }
  }

  const rendered = await renderTemplate(options.template, {
    document,
    url,
    finalUrl,
    date: new Date().toISOString().slice(0, 10),
    defuddle: defuddleResult as unknown as Record<string, unknown>,
  });
  const noteMarkdown = renderNoteMarkdown(rendered.properties, rendered.markdown);

  return {
    url,
    finalUrl,
    title: String(defuddleResult.title ?? rendered.properties.title ?? ""),
    description: optionalString(defuddleResult.description),
    author: optionalString(defuddleResult.author),
    siteName: optionalString(defuddleResult.site),
    published: optionalString(defuddleResult.published),
    image: optionalString(defuddleResult.image ?? rendered.properties.image),
    noteName: rendered.noteName,
    path: options.template.path,
    properties: rendered.properties,
    markdown: rendered.markdown,
    noteMarkdown,
  };
}

function optionalString(value: unknown): string | undefined {
  if (value === null || value === undefined || value === "") {
    return undefined;
  }

  return String(value);
}
