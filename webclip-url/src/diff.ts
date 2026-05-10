export type DiffResult = {
  equal: boolean;
  diff: string;
};

export function diffLines(expected: string, actual: string): DiffResult {
  const expectedLines = normalizeEndings(expected).split("\n");
  const actualLines = normalizeEndings(actual).split("\n");
  const rows = lcsRows(expectedLines, actualLines);
  const diff: string[] = [];

  let i = expectedLines.length;
  let j = actualLines.length;

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && expectedLines[i - 1] === actualLines[j - 1]) {
      diff.push(` ${expectedLines[i - 1]}`);
      i -= 1;
      j -= 1;
    } else if (j > 0 && (i === 0 || rows[i][j - 1] >= rows[i - 1][j])) {
      diff.push(`+${actualLines[j - 1]}`);
      j -= 1;
    } else if (i > 0) {
      diff.push(`-${expectedLines[i - 1]}`);
      i -= 1;
    }
  }

  const rendered = diff.reverse().join("\n");
  return {
    equal: expectedLines.join("\n") === actualLines.join("\n"),
    diff: rendered,
  };
}

function lcsRows(left: string[], right: string[]): number[][] {
  const rows = Array.from({ length: left.length + 1 }, () =>
    Array.from({ length: right.length + 1 }, () => 0),
  );

  for (let i = 1; i <= left.length; i += 1) {
    for (let j = 1; j <= right.length; j += 1) {
      rows[i][j] =
        left[i - 1] === right[j - 1]
          ? rows[i - 1][j - 1] + 1
          : Math.max(rows[i - 1][j], rows[i][j - 1]);
    }
  }

  return rows;
}

function normalizeEndings(value: string): string {
  return value.replace(/\r\n/g, "\n").trimEnd();
}
