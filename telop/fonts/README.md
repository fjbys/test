# サーバーフォントディレクトリ

このディレクトリにフォント（`.ttf` / `.otf` / `.ttc`）を配置し、`fonts.json` に定義することで、ブラウザからアクセスした際にフォントが自動取得・適用されます。

`fonts.json` は **`fonts/fonts.json`** または Webサーバー直下の **`./fonts.json`** のどちらに置いても自動検出されます。

---

## 推奨ディレクトリ構成（フォルダ分け ＆ 権利表記）

フォントファイルを直下に平置きせず、フォントごとにサブディレクトリを作成してライセンスファイル（`OFL.txt` 等）と一緒に配置することを推奨します。

```text
fonts/
├── fonts.json
├── noto_sans_jp/
│   ├── NotoSansJP-VariableFont_wght.ttf (または Regular.ttf / Bold.ttf)
│   └── OFL.txt (ライセンス表記)
└── dela_gothic/
    ├── DelaGothicOne-Regular.ttf
    └── OFL.txt
```

---

## `fonts.json` の仕様と記述例

### 1. バリアブルフォント（1ファイルで全ウェイトを網羅）を使用する場合
Dr.Telop はバリアブルフォント（`wght` 軸）の自動展開に対応しています。1ファイルを読み込むだけで Thin (100) 〜 Black (900) まで全9段階の太さが自動登録されます。

```json
[
  {
    "name": "Noto Sans JP",
    "file": "noto_sans_jp/NotoSansJP-VariableFont_wght.ttf",
    "ui": true,
    "default": true
  },
  {
    "name": "Dela Gothic One",
    "file": "dela_gothic/DelaGothicOne-Regular.ttf"
  }
]
```

### 2. ウェイトごとに個別ファイルを配置する場合
同じファミリーのフォントは、エディタ内で自動的に1つのファミリーグループにまとめられ、右側の太さドロップダウンで選択できるようになります。

```json
[
  {
    "name": "Noto Sans JP Regular",
    "file": "noto_sans_jp/NotoSansJP-Regular.ttf",
    "ui": true
  },
  {
    "name": "Noto Sans JP Bold",
    "file": "noto_sans_jp/NotoSansJP-Bold.ttf",
    "default": true
  },
  {
    "name": "Noto Sans JP Black",
    "file": "noto_sans_jp/NotoSansJP-Black.ttf"
  }
]
```

### 3. 外部CDN（Google Fonts等）から直接取得する場合
`file` または `url` に `https://` から始まるURLを記載すると、自前サーバーの容量を使わずに直接ダウンロードできます。

```json
[
  {
    "name": "Dela Gothic One (CDN)",
    "url": "https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/delagothicone/DelaGothicOne-Regular.ttf"
  }
]
```

---

## フィールド一覧

| キー | 型 | 説明 |
| :--- | :---: | :--- |
| **`file`** / **`url`** | `string` | **【必須】** ファイルの相対パス、または外部URL（`https://...`） |
| **`ui`** | `boolean` | **`true`** に設定したフォントは最優先でロードされ、操作画面（UI・ボタン・メニュー）の表示フォントとして適用されます |
| **`default`** | `boolean` | **`true`** に設定したフォントは、テロップ文字の初期フォント（キャンバス用）として適用されます |
| **`name`** | `string` | フォントの表示名（省略時はファイル名から自動判定） |

