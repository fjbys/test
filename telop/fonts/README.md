# サーバーフォントディレクトリ

このディレクトリにフリーフォント（`.ttf` / `.otf` / `.ttc`）を配置し、`fonts.json` に登録することで、ブラウザからアクセスした際に自動的またはオンデマンドでフォントが読み込まれます。

## `fonts.json` のフォーマット

```json
[
  {
    "id": "noto_sans_jp",
    "name": "Noto Sans JP",
    "file": "NotoSansJP-Regular.ttf",
    "default": true
  },
  {
    "id": "dela_gothic_one",
    "name": "Dela Gothic One",
    "file": "DelaGothicOne-Regular.ttf"
  }
]
```

- `default: true` を設定したフォントは、起動時に最優先でダウンロードされ、初期日本語フォントとして適用されます。
- 推奨フォント（Google Fonts などの SIL Open Font License フリーフォント）:
  - Noto Sans JP
  - Zen Kaku Gothic New
  - Dela Gothic One (YouTube定番の極太ゴシック)
  - Potta One (バラエティ系ポップ体)
