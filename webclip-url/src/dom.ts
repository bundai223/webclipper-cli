import { parseHTML } from "linkedom";

type LinkedomDocumentPatch = {
  styleSheets?: unknown[];
  defaultView?: {
    getComputedStyle?: () => { display: string };
  };
  URL?: string;
};

export function parseHtmlDocument(html: string, url?: string): Document {
  const { document } = parseHTML(html);
  const patchableDocument = document as unknown as LinkedomDocumentPatch;

  if (!patchableDocument.styleSheets) {
    patchableDocument.styleSheets = [];
  }

  if (
    patchableDocument.defaultView &&
    !patchableDocument.defaultView.getComputedStyle
  ) {
    patchableDocument.defaultView.getComputedStyle = () => ({ display: "" });
  }

  if (url) {
    patchableDocument.URL = url;
  }

  return document as unknown as Document;
}
