export type WebClipperPropertyType = "text" | "multitext" | "date" | string;

export type WebClipperProperty = {
  name: string;
  value: string;
  type: WebClipperPropertyType;
};

export type WebClipperTemplate = {
  schemaVersion: string;
  name: string;
  behavior?: string;
  noteContentFormat: string;
  properties: WebClipperProperty[];
  triggers?: string[];
  noteNameFormat: string;
  path?: string;
};

export type ClipOptions = {
  template: WebClipperTemplate;
  language?: string;
  contentSelector?: string;
  removeImages?: boolean;
  debug?: boolean;
  html?: string;
};

export type DefuddleRuntimeOptions = {
  url: string;
  markdown: true;
  separateMarkdown: true;
  language?: string;
  contentSelector?: string;
  removeImages?: boolean;
  debug?: boolean;
};

export type ClipResult = {
  url: string;
  finalUrl: string;
  title: string;
  description?: string;
  author?: string;
  siteName?: string;
  published?: string;
  image?: string;
  noteName: string;
  path?: string;
  properties: Record<string, unknown>;
  markdown: string;
  noteMarkdown: string;
};

export type ClipContext = {
  document: Document;
  url: string;
  finalUrl: string;
  date: string;
  defuddle: Record<string, unknown>;
};
