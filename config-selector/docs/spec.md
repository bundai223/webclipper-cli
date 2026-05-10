# config-selector 仕様

## 背景

`tools/webclip-url` は URL と Web Clipper config JSON を明示的に受け取り、Markdown note を生成する。
ただし実運用では、ユーザーが毎回 config を選ぶよりも、URL から適した config を自動選択できる方が自然である。

Obsidian Web Clipper の config には `triggers` が含まれているため、`config-selector` はこの値を使って URL に合う config JSON を選択する。

## 目的

`tools/webclip-url` と並列する独立ツールとして `tools/config-selector` を作り、次の責務を持たせる。

- 複数の Web Clipper config JSON を読み込む
- 各 config の `triggers` と入力 URL を照合する
- 一致する config のうち、最も適したものを 1 つ選ぶ
- 一致する config がない場合に、明示された fallback config を選べるようにする
- CLI と library API の両方から利用できるようにする

## 非目的

- URL の fetch や HTML 解析はしない
- clipping 処理や Markdown 生成はしない
- Obsidian vault への保存はしない
- config JSON の完全な schema validation はしない
- 複数 config の merge はしない

## 入力

### URL

選択対象となる URL 文字列を 1 つ受け取る。

### Config

JSON ファイルまたは JSON ファイルを含むディレクトリを受け取る。
ディレクトリ指定時は再帰的に `.json` ファイルを探索する。

config は少なくとも次の形を想定する。

```json
{
  "name": "Zenn",
  "triggers": ["https://zenn.dev/*/articles/*"]
}
```

`triggers` がない config は選択対象にならない。

### Fallback Config

CLI では `--fallback <config-json>` により fallback config を 1 つ指定できる。
通常の `triggers` に一致する config がない場合のみ fallback config を選ぶ。

fallback config は trigger match の対象にはしない。
選択時の match kind は `fallback`、score は `0` とする。

## Trigger の解釈

`triggers` の各要素は文字列として扱う。
空白だけの trigger は無視する。

### Regex trigger

先頭が `/` で、末尾側に閉じる `/` がある文字列は正規表現として扱う。
閉じる `/` 以降は JavaScript `RegExp` の flags として扱う。

例:

```text
/^https:\/\/.*.hatenadiary\.jp\/.*$/
```

不正な正規表現は一致なしとして扱い、処理全体は失敗させない。

### Glob trigger

`*` を含む trigger は glob として扱う。
`*` は任意の文字列に一致する。
glob は URL 全体に対して一致判定する。

例:

```text
https://zenn.dev/*/articles/*
```

### Exact trigger

正規表現でも glob でもない trigger が URL と完全一致した場合は exact match とする。

### Prefix trigger

正規表現でも glob でもない trigger が URL の prefix として一致した場合は prefix match とする。

例:

```text
https://www.amazon.co.jp/
```

## 選択ルール

1 つの config が複数 trigger を持つ場合、その config 内で最も score が高い trigger を採用する。

複数の config が一致した場合は、次の優先順位で 1 つを選ぶ。

1. score が高いもの
2. score が同じ場合、trigger 文字列が長いもの
3. それでも同じ場合、config file path の辞書順で早いもの

score は match 種別の重みと具体性を足して計算する。

| 種別 | 重み |
| --- | ---: |
| exact | 40000 |
| glob | 30000 |
| regex | 20000 |
| prefix | 10000 |
| fallback | 0 |

具体性は、trigger から正規表現や glob の記号を除いた文字数で評価する。
prefix と exact は trigger の長さを具体性として使う。

## CLI

### 基本形

```bash
config-selector [--configs <dir-or-json>] [--fallback <config-json>] [--json|--match-json|--all] <url>
```

### Options

- `--configs <dir-or-json>`: config を探索するディレクトリまたは JSON ファイル。複数回指定できる
- `--config-dir <dir-or-json>`: `--configs` の alias
- `--fallback <config-json>`: match しなかった場合に選ぶ config JSON
- `--json`: 選択された config JSON の内容を出力する
- `--path`: 後方互換用。通常出力と同じく、選択された config JSON の path だけを出力する
- `--match-json`: 選択された config の metadata と match 情報を JSON で出力する
- `--all`: 一致した候補を score 順にすべて出力する

`--configs` が指定されない場合は、既定で `../webclip-url/fixtures` を探索する。

### 出力

通常出力は、bash pipeline や command substitution で扱いやすいように、選択された config JSON の path だけを 1 行で返す。

```text
/path/to/zenn-clipper.json
```

match 情報が必要な場合は `--match-json` を使う。

```json
{
  "path": "/path/to/zenn-clipper.json",
  "name": "Zenn",
  "trigger": "https://zenn.dev/*/articles/*",
  "kind": "glob",
  "score": 30026
}
```

一致する config がなく、`--fallback` が指定されている場合は fallback config の path を出力し、exit code を `0` にする。
一致する config がなく、fallback もない場合は stderr に error message を出し、exit code を `1` にする。

### Pipeline Usage

選択された path を `webclip-url` へ渡す例:

```bash
template=$(npm run --silent select -- \
  --fallback ../webclip-url/fixtures/default-clipper.json \
  'https://zenn.dev/example/articles/hello')

cd ../webclip-url
npm run clip -- --template "$template" 'https://zenn.dev/example/articles/hello'
```

`xargs` でつなぐ例:

```bash
npm run --silent select -- \
  --fallback ../webclip-url/fixtures/default-clipper.json \
  'https://zenn.dev/example/articles/hello' \
  | xargs -I{} npm --prefix ../webclip-url run clip -- --template "{}" 'https://zenn.dev/example/articles/hello'
```

## Library API

`src/index.ts` から次を export する。

- `loadConfigCandidates(paths)`
- `selectConfig(url, candidates)`
- `findConfigMatches(url, candidates)`
- `bestTriggerMatch(url, triggers)`
- `matchTrigger(url, trigger)`

将来的に `webclip-url` と統合する場合は、`selectConfig` で config path を選択し、その JSON を `webclip-url` の `--template` 相当へ渡す。

## Acceptance Criteria

- `https://zenn.dev/example/articles/hello` は `https://zenn.dev/*/articles/*` に glob match する
- `https://www.amazon.co.jp/books/dp/example` は `https://www.amazon.co.jp/` に prefix match する
- `https://memo.hatenadiary.jp/entry/hello` は `/^https:\/\/.*.hatenadiary\.jp\/.*$/` に regex match する
- prefix と glob が両方一致する場合、glob の config を優先する
- 一致する config がない場合は `undefined` を返す library API と、失敗する CLI の両方を提供する
- 一致する config がなく `--fallback` が指定されている場合、CLI は fallback config path を stdout に出す
- 通常 CLI 出力は config path だけにし、後続コマンドへ渡しやすくする
- match metadata は `--match-json` で確認できる
- `npm test` で matching rule の主要ケースを検証できる

## 今後の拡張余地

- config schema validation を追加する
- trigger の優先順位を config 側で上書きできるようにする
- `webclip-url` CLI に `--auto-template` のような option を追加し、selector を内部利用する
- URL 正規化を入れ、末尾 slash や tracking query の影響を抑える
