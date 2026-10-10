# simple_register_26

| <img src="https://github.com/user-attachments/assets/f9e9bd6a-bec1-477a-a302-6d6a76477c05"  /> | <img src="https://github.com/user-attachments/assets/45fbd080-a5e0-438f-9079-5874836921c1" /> |
|---|---|

Tauri + React + TypeScript で作った、ローカルで動く「かんたんなレジ・受付番号」アプリです。軽く、速く、そして安心して使えるように設計しています。

この README は「使い方・はじめ方」を中心にまとめています。設計やコーディングの詳しい指針は `AGENTS.md` をご覧ください。

## 特徴（このプロジェクトならでは）

- デスクトップ一体型: Tauri v2 でマルチプラットフォームなデスクトップアプリを提供
- ファイルベースルーティング: React Router v7 の FS Routes を採用（`src/routes` 直下）
- とても軽い状態管理: nanostores（`persistentAtom` で localStorage 永続化）
- 型と検証を同時に: ArkType で「型」と「実行時バリデーション」を一元化
- 例外ではなく結果で扱う: neverthrow の `Result` で失敗を安全にハンドリング
- 表現力の高い分岐: ts-pattern で網羅チェックつきの安全な分岐
- スタイルは設計から: PandaCSS（tokens / cva / sva、レシピ的スタイル）

## 前提ツール（macOS）

- Mise（開発環境セットアップに使用.  以下のものが自動的に入ります.）
- Rust と Cargo（Tauri のビルドに必要）
- Tauri CLI v2
- Bun（スクリプトに `bun` を使用しています）
- Node.js（エディタやツールの互換用。Bun を使うので必須ではありませんが推奨）

開発用の推奨拡張:

- VS Code + Tauri 拡張 + rust-analyzer

## 開発環境（mise で一発セットアップ）

このプロジェクトは mise を使っています。`.mise.toml` により、次のツールが固定バージョンでセットアップされます。

- bun 1.2.22
- rust 1.84.1
- lefthook 1.12.2（npm 由来）

一発セットアップは以下のコマンドで実行できます。

```zsh
# mise が導入済みであることが前提です
mise run setup
```

実際に行われる処理（`.mise.toml` より）

- `.vscode/settings.example.json` → `.vscode/settings.json` にコピー（VS Code の推奨設定が適用されます）
- `mise i` で bun/rust/lefthook をインストール
- `lefthook install` で Git フックをセットアップ（pre-commit で `bun run check` を実行）
- `bun i` で依存パッケージをインストール

補足（VS Code 設定の中身）

- Prettier は無効、ESLint の自動修正（保存時）を有効化
- ArkType ドキュメント推奨の Quick Suggestions などを設定
- 拡張機能は `.vscode/extensions.json` で Tauri と rust-analyzer を推奨

注意：bun の「ランタイム設定」を VS Code 側で特別に入れる必要はありません。bun 自体は mise によりインストール・パス解決され、ターミナル経由で `bun run ...` を実行します。

## セットアップ

1. 依存関係をインストールします。

```zsh
bun install
```

1. 開発サーバ（Web）を起動します。

```zsh
bun run dev
```

1. デスクトップアプリ（Tauri）として起動します。

```zsh
bun run tauri dev
```

1. ビルド（配布用バイナリを作成）

```zsh
bun run tauri build
```

補足:

- `bun run check` でスペルチェック・型チェック・Lint をまとめて実行できます（Bun 必須）。
- Tauri の dev サーバは 1420/1421 番ポートを使います（`vite.config.ts`）。

## フォルダ構成（主要）

- `src/routes/` ルーティング（React Router v7 FS Routes）
- `src/components/` UI コンポーネント（`atomic/`, `overlays/` など）
- `src/lib/` ドメインロジック・状態管理・ユーティリティ
- `src/styles/` PandaCSS のグローバル・アニメ・レイヤ構成
- `panda.config.ts` PandaCSS 設定（トークンやキーフレーム拡張）

## ルーティングの追加

React Router v7 の FS Routes を使っています。`src/routes` 配下にファイルを置くと自動でルートになります。

- `src/routes/_index.tsx` ルート（`/`）
- `src/routes/main._index/route.tsx` のようなディレクトリでレイアウト/ページを構成
- 本プロジェクトは SSR を無効化しています（`react-router.config.ts`）。

## スタイル設計（PandaCSS）

このプロジェクトでは「レシピ的」スタイルを基本にしています。

- 単一要素のバリアントは `cva` を使用
- 複数スロット（タイトル/グリッド/カードなど）は `sva` を使用
- デザイントークンは `panda.config.ts` で定義・拡張
- `panda/tokens` の `token()` でトークン値を安全に参照

例: 注文ステータスの表示は `cva` でサイズバリアントを定義し、色はセマンティックトークン（`orderStatus.*`）から取得しています。

```ts
// 例: src/components/OrderStatusLabel.tsx（抜粋）
const orderStatusLabelStyles = cva({ /* ...variants... */ })
const OrderStatusLabelContainer = p("div", orderStatusLabelStyles)

// 色は panda.config.ts の semanticTokens → token() で解決
const color = OrderStatusImpl(orderStatus).toColor()
```

また、`src/styles/highlight.ts` では `data-highlight-*` 属性で点滅/ハイライトを制御するアニメをグローバルに定義しています。表示側はデータ属性を付けるだけで動きます。

## 型・バリデーション（ArkType + neverthrow）

- ドメイン型は ArkType で宣言（例: `Order`, `OrderStatus`, `ReceiptNumber`）
- 入力値の検証結果は `wrapValidation()` で neverthrow の `Result` に変換
- 例外を投げずに UI 側で安全に分岐できます

```ts
// 例: src/lib/arktype.ts
export function wrapValidation<D>(out: D | ArkErrors): Result<D, ArkErrors> { /* ... */ }
```

```ts
// 例: src/lib/stores/current-order.ts（要点）
const itemNumberResult = wrapValidation(ItemNumberType(parseInt(row.productCode, 10)))
if (itemNumberResult.isErr()) continue
```

## 分岐の表現（ts-pattern）

`ts-pattern` を使って、ドメインに対する分岐を「漏れなく・安全に」記述します。

- `.exhaustive()` を付けることでパターン漏れを型で検出
- キー入力→オーバーレイ表示の切替などに活用

```ts
// 例: src/lib/order.ts（要点）
match(status)
  .with("UNCONFIRMED", () => /* ... */)
  .with("WAITING_COOKING", () => /* ... */)
  .with("WAITING_PICKUP", () => /* ... */)
  .with("PICKED_UP", () => /* ... */)
  .with("REFUNDED", () => /* ... */)
  .with("CANCELED", () => /* ... */)
  .exhaustive()
```

## データと保存

アプリ内の一部の状態（現在の注文、入力行、預かり金など）は localStorage に保存されます。nanostores の `persistentAtom` を使っており、ブラウザ再読込やアプリ再起動でも残ります。

## よくある質問

- Web でも動きますか？

  はい。`bun run dev` でブラウザから使えます。デスクトップ機能（ウィンドウ/OS連携）は Tauri 実行時のみ有効です。

- 依存する外部サービスはありますか？

  ありません。すべてローカルで完結します。

- 受付番号が重複した場合の調理待ち・受取待ちはどう動きますか？

  受付番号が重複して登録された場合でも、古い注文から順に（FIFO）「調理待ち」→「受取待ち」→「受取済」と遷移します。該当ステータスの注文のみが遷移対象となるため、番号が消えずに残ることはありません。

- モニタ3枚に main, order-queue, pickup-monitor をそれぞれ出力するには？

  以下のいずれかの方法で行えます。状態は localStorage（nanostores）で同期されるため、どの画面で行った操作も即座に全画面へ反映されます。

  1. **ブラウザを使用する場合（推奨・最も簡単）**:
     `bun run dev`（またはビルド後に `bun run preview`）で起動し、ブラウザで以下の各画面を開いてそれぞれのモニタへ配置・全画面表示します。
     - モニタ1（レジ）: `http://localhost:1420/main`
     - モニタ2（調理キュー）: `http://localhost:1420/order-queue`
     - モニタ3（受取モニター）: `http://localhost:1420/pickup-monitor`
  2. **Tauri（デスクトップアプリ）で複数ウィンドウを開く場合**:
     `src-tauri/tauri.conf.json` の `app.windows` に各画面のウィンドウ定義を追加して `bun run tauri dev` で起動し、各ウィンドウをそれぞれのモニタへ配置します。

- Windows のデスクトップアプリ（Tauri）でレイアウトが重なって崩れます

  本アプリは 1280×720 以上の解像度を想定して設計されています。`tauri.conf.json` のウィンドウサイズを 1280×800（最小 1024×700）に制限し、画面解像度が不足している場合は最下部ステータスバーに警告が表示されます。ウィンドウを最大化または全画面表示（F11）にしてご利用ください。
---

詳しい開発指針やコード例は `AGENTS.md` にまとめています。新しく機能を足す前に一読いただくとスムーズです。

## 来年度に開発に入る方へ（フォークして「26 → 27」にする手順）

まずは引き継ぎありがとうございます。来年度はメニューも年号も変わる前提で、最短で安全に差し替えるためのポイントをまとめました。困ったら `AGENTS.md` の設計方針も合わせて見てください。

### 1. リポジトリをフォーク（または新しいブランチ/リポジトリを作成）

ファイル: `src/lib/consts.ts`

- 変更内容: アプリ名の末尾にある年号を 2026 → 2027 に置き換えます。

```ts
// src/lib/consts.ts（抜粋）
export const INFO = {
  name: {
   ja: "シス研シンプルレジ ver. 2027", // ← 2026 から変更
   en: "Sysken Simple Register ver. 2027", // ← 2026 から変更
  },
  config: {
   localStorageVersion: 1, // 破壊的変更を入れる場合は 2,3... と上げてください
  },
} as const;
```

- 破壊的なデータ構造変更（localStorage に保存している内容が変わる等）を入れる場合は、`localStorageVersion` をインクリメントすると古いデータを安全に切り離せます。

### 2. メニュー（商品）を差し替える

ファイル: `public/data/item_groups.json`

- `children`: グループ（例: ポップコーン/飲料）の配列。各グループの `children` に商品を並べます。
- `price` の上限は現在 `src/types/item.ts` の `Price` が 500 になっています。500 円を超える価格にしたい場合は `Price` を見直してください。
- 商品番号（ItemNumber）は `src/lib/stores/items.ts` で `groupIdx * 10 + itemIdx` で自動採番しています。
  - 1 グループあたり 10 品目以内にすると安全です（重複回避）。

- それ以上に増やす場合は、採番ロジック（例: `groupIdx * 100 + itemIdx`）と `ItemNumber` の上限（`src/types/item.ts`）を一緒に引き上げてください。

### 3. 割引の定義を差し替える

- ファイル: `public/data/discount.json`
`amount` のキーは「商品ID」です。商品を入れ替えた場合、対応する ID を必ず更新してください。
メイン画面では、定義された割引の番号と名称が入力欄の横に小さく一覧表示されます（未入力時は「未入力: 割引なし」、番号入力時は該当割引がハイライト表示されます）。
スキーマは ArkType で検証され、問題があると起動時にエラーになります（どの項目が不正かをメッセージで示します）。
### 4. レシート番号や各種上限を見直す（必要な場合）

- `src/types/order.ts`
- `MAX_RECEIPT_NUMBER`（受付番号の最大値: デフォルト 50）
- `OrderItemAmount`（各商品の最大数量）
営業形態に合わせて調整してください。

### 5. 動作確認

Web で確認: `bun run dev`

- デスクトップで確認: `bun run tauri dev`
- まとめてチェック: `bun run check`（スペル/型/ESLint）

### 6. よくあるつまづき

- 起動時に落ちる/真っ白: メニューや割引 JSON のキー（商品ID）が合っているか、型の上限を超えていないかを確認してください（ArkType の assert が失敗すると止まります）。
- 値が更新されない: localStorage の影響かもしれません。`localStorageVersion` を上げるか、ブラウザ/Tauri の localStorage をクリアしてください。

### ひとこと

来年の運用も、なるべく「変更しやすい・壊れにくい」作りにしています。数字を変えるだけ・JSON を入れ替えるだけで、だいぶ対応できるはずです。焦らず、少しずつ確かめながら進めてください。困ったら `AGENTS.md` を検索して、該当の章（PandaCSS/ArkType/ts-pattern/nanostores）を見つけてみてください。応援しています。
