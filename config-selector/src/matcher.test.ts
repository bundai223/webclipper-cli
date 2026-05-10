import test from "node:test";
import assert from "node:assert/strict";
import { matchTrigger, selectConfig } from "./matcher.js";
import type { ConfigCandidate } from "./types.js";

test("matches wildcard triggers", () => {
  const match = matchTrigger(
    "https://zenn.dev/example/articles/hello",
    "https://zenn.dev/*/articles/*",
  );

  assert.equal(match?.kind, "glob");
});

test("matches prefix triggers", () => {
  const match = matchTrigger(
    "https://www.amazon.co.jp/books/dp/example",
    "https://www.amazon.co.jp/",
  );

  assert.equal(match?.kind, "prefix");
});

test("matches regex triggers", () => {
  const match = matchTrigger(
    "https://memo.hatenadiary.jp/entry/hello",
    "/^https:\\/\\/.*.hatenadiary\\.jp\\/.*$/",
  );

  assert.equal(match?.kind, "regex");
});

test("selects the most specific matching config", () => {
  const candidates: ConfigCandidate[] = [
    {
      path: "/configs/zenn-prefix.json",
      config: { name: "Zenn prefix", triggers: ["https://zenn.dev/"] },
    },
    {
      path: "/configs/zenn-article.json",
      config: { name: "Zenn article", triggers: ["https://zenn.dev/*/articles/*"] },
    },
  ];

  const selected = selectConfig("https://zenn.dev/example/articles/hello", candidates);

  assert.equal(selected?.config.name, "Zenn article");
});

test("returns undefined when no trigger matches", () => {
  const selected = selectConfig("https://example.com/", [
    {
      path: "/configs/zenn.json",
      config: { name: "Zenn", triggers: ["https://zenn.dev/*/articles/*"] },
    },
  ]);

  assert.equal(selected, undefined);
});

test("exact matches outrank prefix matches", () => {
  const candidates: ConfigCandidate[] = [
    {
      path: "/configs/prefix.json",
      config: { name: "Prefix", triggers: ["https://example.com/"] },
    },
    {
      path: "/configs/exact.json",
      config: { name: "Exact", triggers: ["https://example.com/page"] },
    },
  ];

  const selected = selectConfig("https://example.com/page", candidates);

  assert.equal(selected?.config.name, "Exact");
});
