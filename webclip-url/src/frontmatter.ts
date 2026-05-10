export function renderNoteMarkdown(
  properties: Record<string, unknown>,
  body: string,
): string {
  return `${renderFrontmatter(properties)}\n${body}`;
}

export function renderFrontmatter(properties: Record<string, unknown>): string {
  const lines = ["---"];

  for (const [key, value] of Object.entries(properties)) {
    if (Array.isArray(value)) {
      lines.push(`${key}:`);
      for (const item of value) {
        lines.push(`  - ${yamlString(item)}`);
      }
    } else {
      lines.push(`${key}: ${yamlString(value)}`);
    }
  }

  lines.push("---");
  return lines.join("\n");
}

function yamlString(value: unknown): string {
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  if (value === null || value === undefined) {
    return "\"\"";
  }

  return JSON.stringify(String(value));
}
