const MAX_SIZE = 5 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 10_000;

export const DEFAULT_USER_AGENT =
  "Mozilla/5.0 (compatible; Defuddle/1.0; +https://defuddle.md)";
export const BOT_USER_AGENT = `${DEFAULT_USER_AGENT} bot`;

const BOT_USER_AGENT_DOMAINS = ["github.com"];

export type FetchedPage = {
  html: string;
  finalUrl: string;
};

export function getInitialUserAgent(targetUrl: string): string {
  try {
    const { hostname } = new URL(targetUrl);

    if (
      BOT_USER_AGENT_DOMAINS.some(
        (domain) => hostname === domain || hostname.endsWith(`.${domain}`),
      )
    ) {
      return BOT_USER_AGENT;
    }
  } catch {
    return DEFAULT_USER_AGENT;
  }

  return DEFAULT_USER_AGENT;
}

export async function fetchPage(
  targetUrl: string,
  language?: string,
  userAgent = getInitialUserAgent(targetUrl),
): Promise<FetchedPage> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const headers: Record<string, string> = {
      Accept: "text/html,application/xhtml+xml",
      "User-Agent": userAgent,
    };

    if (language) {
      headers["Accept-Language"] = language;
    }

    const response = await fetch(targetUrl, {
      headers,
      redirect: "follow",
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(
        `Failed to fetch ${targetUrl}: ${response.status} ${response.statusText}`,
      );
    }

    const contentType = response.headers.get("content-type") ?? "";

    if (
      !contentType.includes("text/html") &&
      !contentType.includes("application/xhtml+xml")
    ) {
      throw new Error(`Not an HTML page (content-type: ${contentType})`);
    }

    const contentLength = response.headers.get("content-length");

    if (contentLength) {
      const bytes = Number.parseInt(contentLength, 10);

      if (bytes > MAX_SIZE) {
        throw new Error(
          `Page too large (${Math.round(bytes / 1024 / 1024)}MB, max 5MB)`,
        );
      }
    }

    const buffer = await response.arrayBuffer();

    if (buffer.byteLength > MAX_SIZE) {
      throw new Error(
        `Page too large (${Math.round(buffer.byteLength / 1024 / 1024)}MB, max 5MB)`,
      );
    }

    return {
      html: decodeHtml(buffer, contentType),
      finalUrl: response.url || targetUrl,
    };
  } catch (error: unknown) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(
        `Timed out fetching page after ${FETCH_TIMEOUT_MS / 1000}s`,
      );
    }

    throw error;
  } finally {
    clearTimeout(timer);
  }
}

function decodeHtml(buffer: ArrayBuffer, contentType: string): string {
  const charset = detectCharset(buffer, contentType);

  if (
    charset === "windows-1252" ||
    charset === "iso-8859-1" ||
    charset === "latin1"
  ) {
    return decodeWindows1252(buffer);
  }

  try {
    return new TextDecoder(charset).decode(buffer);
  } catch {
    return new TextDecoder("utf-8").decode(buffer);
  }
}

function detectCharset(buffer: ArrayBuffer, contentType: string): string {
  const headerMatch = contentType.match(/charset=["']?([^\s;,"']+)/i);

  if (headerMatch?.[1]) {
    return headerMatch[1].toLowerCase();
  }

  const head = new TextDecoder("latin1").decode(buffer.slice(0, 1024));
  const metaCharset = head.match(/<meta[^>]+charset=["']?([^\s"';>]+)/i);

  if (metaCharset?.[1]) {
    return metaCharset[1].toLowerCase();
  }

  const metaHttpEquiv = head.match(
    /<meta[^>]+content=["'][^"']*charset=([^\s"';]+)/i,
  );

  if (metaHttpEquiv?.[1]) {
    return metaHttpEquiv[1].toLowerCase();
  }

  return "utf-8";
}

function decodeWindows1252(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const chunks: string[] = [];
  const chunkSize = 8192;

  for (let index = 0; index < bytes.length; index += chunkSize) {
    const slice = bytes.subarray(index, Math.min(index + chunkSize, bytes.length));
    const mapped = new Uint16Array(slice.length);

    for (let sliceIndex = 0; sliceIndex < slice.length; sliceIndex += 1) {
      mapped[sliceIndex] = windows1252CodePoint(slice[sliceIndex] ?? 0);
    }

    chunks.push(String.fromCharCode(...mapped));
  }

  return chunks.join("");
}

function windows1252CodePoint(byte: number): number {
  const overrides: Record<number, number> = {
    0x80: 0x20ac,
    0x82: 0x201a,
    0x83: 0x0192,
    0x84: 0x201e,
    0x85: 0x2026,
    0x86: 0x2020,
    0x87: 0x2021,
    0x88: 0x02c6,
    0x89: 0x2030,
    0x8a: 0x0160,
    0x8b: 0x2039,
    0x8c: 0x0152,
    0x8e: 0x017d,
    0x91: 0x2018,
    0x92: 0x2019,
    0x93: 0x201c,
    0x94: 0x201d,
    0x95: 0x2022,
    0x96: 0x2013,
    0x97: 0x2014,
    0x98: 0x02dc,
    0x99: 0x2122,
    0x9a: 0x0161,
    0x9b: 0x203a,
    0x9c: 0x0153,
    0x9e: 0x017e,
    0x9f: 0x0178,
  };

  return overrides[byte] ?? byte;
}
