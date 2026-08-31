# A2UI UIカタログ

[A2UI（Agent to UI Protocol）](https://github.com/a2ui-project/a2ui) v0.9 のベーシックカタログで表現できるUIコンポーネント全18種を、**「A2UI JSON」と「ライブプレビュー」**を並べて確認できる学習用カタログです。

## 使い方

ビルド不要。`index.html` をブラウザで開くだけです（file:// でも動作します）。

```
index.html をダブルクリック
# または
npx serve .        # など任意の静的サーバー
```

- 各プレビューは、実際に `createSurface` → `updateComponents` → `updateDataModel` のメッセージストリームを送信して描画しています
- プレビュー内のUIはすべて操作可能です。ボタン押下時の `action` メッセージ（client → server）はイベントログで、入力に伴うデータモデルの変化は「データモデル（ライブ）」パネルで確認できます
- 「はじめに」カテゴリにはメッセージを1通ずつ送ってUIが組み上がる様子を見られる**ストリームプレイヤー**があります

## 構成

```
index.html            エントリポイント
css/style.css         カタログUI + レンダラーのスタイル
js/
  icons.js            Iconコンポーネント用 内蔵アイコンセット（58種・インラインSVG）
  markdown.js         Textコンポーネント用 簡易Markdownレンダラー
  functions.js        クライアント側「登録関数」15種の実装
  renderer.js         A2UI v0.9仕様準拠のミニレンダラー（本カタログの核）
  catalog-data.js     各コンポーネントのJSON例・プロパティ表・日本語説明
  app.js              カタログUIの組み立て
.specs/               参照した公式仕様書・スキーマ（取得済みコピー）
```

## ミニレンダラーについて

プレビューの描画には、v0.9仕様書（`a2ui_protocol.md`）とベーシックカタログスキーマ（`catalogs/basic/catalog.json`）に忠実な**自作の学習用レンダラー**を使用しています。実装している仕様動作:

- 4メッセージ型（createSurface / updateComponents / updateDataModel / deleteSurface）
- 隣接リストモデル（フラットなコンポーネントMap + ID参照によるツリー構築）
- rootゲーティング（`id: "root"` 到着までバッファリング）
- プログレッシブレンダリング（未到着の子・データはプレースホルダー）
- Dynamic* プロパティ（リテラル / `{path}` / 関数呼び出し、絶対・相対パス解決）
- ChildListテンプレート（コレクションスコープ）
- 双方向バインディング（入力の即時ローカル反映・リアクティブ再描画）
- checks（TextFieldエラー表示・Button自動無効化）
- action送信（context解決・sendDataModel時のメタデータ同梱）
- テーマ（primaryColor / iconUrl / agentDisplayName）

公式レンダラー（`@a2ui/react`、Lit、Angular、Flutter）とは見た目の細部が異なる場合があります。

## 制限・注意

- 画像・動画・音声デモは外部URLを使用するため、オフラインではフォールバック表示になります
- TextのMarkdownは仕様どおり「HTML・画像・リンクを除く簡単な書式」のサブセット対応です
- `formatDate` は日本語ロケールで整形します（トークンはUnicode TR35風のサブセット）

## 出典

- 仕様: [a2ui-project/a2ui](https://github.com/a2ui-project/a2ui)（Apache-2.0）
- v0.9仕様書・実装ガイド・カタログスキーマは `.specs/` に保存済み
