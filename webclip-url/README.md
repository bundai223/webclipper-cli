# webclip-url

URLとObsidian Web Clipperのtemplate JSONを受け取り、Markdown noteを生成する自作CLI。

`fixtures/amazon-book-clipper.json`は、Obsidian Web ClipperからexportしたAmazon書籍用templateを置いたもの。

実装仕様は [docs/spec.md](docs/spec.md) にまとめる。

## Usage

```bash
npm install
```

Markdown noteを生成する。

```bash
npm run clip -- --template fixtures/amazon-book-clipper.json <url>
```

Obsidian Web Clipperで取得したMarkdownとの差分を見る。

```bash
npm run compare:amazon
```
