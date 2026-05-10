# config-selector

URL と Obsidian Web Clipper config JSON 群を受け取り、`triggers` に一致する最適な config を選ぶ CLI。

`tools/webclip-url` と組み合わせる前段として使う想定です。

## Usage

デフォルトでは `../webclip-url/fixtures` の JSON を見に行きます。

```bash
npm run select -- 'https://zenn.dev/example/articles/hello'
```

config ディレクトリを指定する場合:

```bash
npm run select -- --configs ../webclip-url/fixtures --path 'https://zenn.dev/example/articles/hello'
```

選択された JSON の中身を出力する場合:

```bash
npm run select -- --json 'https://zenn.dev/example/articles/hello'
```

一致した候補をすべて確認する場合:

```bash
npm run select -- --all 'https://zenn.dev/example/articles/hello'
```

## Trigger matching

- `/^https:\/\/example\.com\/.*$/` のような `/.../flags` は正規表現として扱う
- `https://zenn.dev/*/articles/*` のように `*` を含むものは glob として扱う
- `https://www.amazon.co.jp/` のような wildcard なし URL は prefix として扱う

複数一致した場合は、exact、glob、regex、prefix の順と、trigger の具体性から score を付けて最も高いものを選びます。
