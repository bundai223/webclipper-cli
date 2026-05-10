# webclip-url 仕様

Status: draft
Updated: 2026-05-11

## 目的

`webclip-url`は、Vaultに依存しない小さなWeb Clipping CLIである。

URLを1つ受け取り、Obsidian Web Clipperのtemplate JSONに従ってページを取得・抽出・レンダリングし、Markdown noteを返す。

このツールの責務はWeb Clippingだけに限定する。URLリスト処理、LINE同期形式の解析、Obsidian Vaultへの保存は別コンポーネントの責務にする。

## SDDルール

今後の変更は、この仕様を先に、またはコード変更と同時に更新する。

機能追加時は次を明確にする。

- 受け取る入力
- 返す出力
- やらないこと
- 検証方法

## スコープ

### やること

- URLを1つ受け取る。
- Obsidian Web Clipper template JSONを1つ受け取る。
- HTTPでHTMLを取得する。
- Defuddleで本文とmetadataを抽出する。
- 対応済みのWeb Clipper変数、selector、filterを評価する。
- frontmatterと本文を組み合わせてMarkdown noteを生成する。
- MarkdownまたはJSONを返す。
- 期待Markdownとの差分比較を行えるようにする。

### やらないこと

- URL配列の処理。
- `HH:mm:ss: {{url}}`のようなLINE notes sync形式の解析。
- Obsidian Vaultへの保存。
- `ingest-pending`の付与。
- 重複note検出。
- `triggers`によるtemplate自動選択。
- ブラウザJavaScriptの実行。
- ブラウザ操作。

## CLI

通常利用ではbuildしない。

```bash
npm run clip -- --template <clipper-template.json> <url>
```

例:

```bash
npm run clip -- --template fixtures/default-clipper.json https://example.com/article
npm run clip -- --template fixtures/amazon-book-clipper.json https://www.amazon.co.jp/.../dp/4815636591
```

対応オプション:

```bash
--template <path>          必須。Obsidian Web Clipper template JSON。
--json                     MarkdownではなくClipResult JSONを出力する。
--output <path>            出力をファイルに書き込む。
--expected <path>          生成Markdownと期待Markdownをdiffする。
--html <path>              URL取得ではなく保存済みHTMLを使う。
--language <tag>           fetchとDefuddleへ渡す優先言語。
--content-selector <css>   Defuddleのcontent selectorを上書きする。
--remove-images            Defuddleに画像除去を依頼する。
--debug                    Defuddle debug modeを有効にする。
--defuddle-options         生成したDefuddle optionsだけを表示して終了する。
```

終了コード:

- 通常成功時は`0`。
- `--expected`指定時は、差分なしなら`0`、差分ありなら`1`。
- 引数不正、取得失敗、parse失敗は`1`。

## npm scripts

```bash
npm run clip
npm run clip:amazon
npm run compare:amazon
npm run build
```

- `clip`: メイン入口。`node --import tsx`でTypeScriptソースを直接実行する。
- `clip:amazon`: Amazon fixture URLを実行し、JSONを出力する。
- `compare:amazon`: `generated/amazon-book.md`を書き出し、Obsidian Web Clipperの取得結果とdiffする。
- `build`: 任意。型確認や配布用に使う。

## Library interface

```ts
clipUrl(url: string, options: ClipOptions): Promise<ClipResult>
```

```ts
type ClipOptions = {
  template: WebClipperTemplate;
  language?: string;
  contentSelector?: string;
  removeImages?: boolean;
  debug?: boolean;
  html?: string;
};
```

```ts
type ClipResult = {
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
```

## Template JSON

現在対応するObsidian Web Clipper template項目:

- `schemaVersion`
- `name`
- `behavior`
- `noteContentFormat`
- `properties`
- `triggers`
- `noteNameFormat`
- `path`

`triggers`はfixtureに保持するが、template自動選択にはまだ使わない。

## Template変数

対応する変数:

- `{{content}}`
- `{{url}}`
- `{{date}}`
- `{{site}}`
- Defuddleが返すfield。例: `{{title}}`, `{{description}}`, `{{author}}`, `{{published}}`, `{{image}}`
- `{{selector:<css>}}`
- `{{selector:<css>?<attribute>}}`
- `{{selectorHtml:<css>}}`

selector式は、Defuddleで整理されたDOMではなく、取得直後の元HTML DOMに対して評価する。これにより、本文抽出では消える可能性がある`#ASIN`などの値を取得できる。

## Filter

対応済みfilter:

- `first`
- `join`
- `split`
- `slice`
- `markdown`

未対応filterは現在無視し、値をそのまま通す。たとえば`{{author|split:", "|wikilink|join}}`の`wikilink`はまだ適用されない。

## Property変換

template propertiesはfrontmatterへ変換する。

- `multitext`はカンマ区切りで分割し、YAML listとして出力する。
- それ以外の型はYAML scalar stringとして出力する。
- `date`の検証や再フォーマットはまだしない。
- `created_at`や`updated_at`のようなVault固有propertyは付与しない。

## 処理フロー

1. CLI引数をparseする。
2. template JSONを読み込む。
3. `--html`があれば保存済みHTMLを読む。なければURLからHTMLを取得する。
4. 元HTMLを2つのDOMにparseする。
   - selector評価用DOM
   - Defuddle抽出用DOM
5. Defuddleで本文とmetadataを抽出する。
6. fetchした結果のword countが0なら、bot user agentで1回だけ再取得する。
7. template properties、note name、note contentをレンダリングする。
8. frontmatterと本文を組み合わせて`noteMarkdown`を作る。
9. stdoutまたは`--output`へ出力する。
10. `--expected`があればline diffを表示する。

## Fetch仕様

HTTP fetchでは次を使う。

- `User-Agent: Mozilla/5.0 (compatible; Defuddle/1.0; +https://defuddle.md)`
- `Accept: text/html,application/xhtml+xml`
- optional `Accept-Language`
- redirect follow
- timeout 10秒
- response size上限 5MB
- headerとmeta tagによるcharset検出

受け付けるcontent typeは`text/html`と`application/xhtml+xml`のみ。

## アーキテクチャ

```text
src/cli.ts
  CLI引数parse、出力書き込み、期待ファイルとの差分比較

src/clip.ts
  fetch、DOM parse、Defuddle抽出、template renderingを統合する

src/fetch-page.ts
  HTTP fetch、user agent、timeout、size limit、charset decode

src/dom.ts
  linkedom parserとDefuddle向けDOM patch

src/defuddle-options.ts
  CLI optionsとtemplate contentからDefuddle optionsを作る

src/template.ts
  Web Clipper templateの変数、selector、filterを評価する

src/frontmatter.ts
  YAML frontmatterを生成する

src/diff.ts
  regression比較用のline diff
```

## Fixtures

現在のfixture template:

- `fixtures/default-clipper.json`
- `fixtures/amazon-book-clipper.json`
- `fixtures/twitter-tweet-clipper.json`
- `fixtures/zenn-clipper.json`

現時点の主なregression対象はAmazon書籍template。

## 既知の差分

- JavaScriptは実行しないため、ブラウザ実行後DOMの値はObsidian Web Clipperと異なる場合がある。
- Amazonの画像URLはブラウザベースのclipper結果と一致しない場合がある。
- YAML formattingは単純で、Obsidian Web Clipperのquote styleと異なる場合がある。
- `created_at`と`updated_at`は、保存処理側の責務なので付与しない。
- `wikilink`など一部Web Clipper filterは未実装。
- `triggers`によるtemplate選択は未実装。

## 検証方法

依存関係を入れる。

```bash
npm install
```

buildなしでCLIを実行する。

```bash
npm run clip -- --template fixtures/default-clipper.json https://example.com
```

Amazon fixtureを実行する。

```bash
npm run clip:amazon
```

Amazonの出力を既存のObsidian Web Clipper noteと比較する。

```bash
npm run compare:amazon
```

任意で型確認する。

```bash
npm run build
```
