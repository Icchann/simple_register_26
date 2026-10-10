# 開発者ガイド（AGENTS）

このドキュメントは、貢献者・開発メンバー向けの「設計方針」と「実装パターン」をまとめたものです。README は利用者/新規参加者向け、本書は実装の深掘りと判断基準にフォーカスします。

- 想定読者: コンポーネントやストアを増やす人、ロジックを改善する人、レビューする人
- 目標: 迷わず同じ方向で手を動かせること。安全に変更できること。

## 設計原則

- ローカル完結 / シンプル優先
  - 外部サービスに依存しません。状態は nanostores の `persistentAtom` で localStorage に保存します。
- 型は「信頼できる仕様」
  - ArkType でドメイン型と実行時バリデーションを同一ソースで管理します。
- 失敗は例外ではなく値で扱う
  - neverthrow の `Result` を使い、UI まで安全に伝播させます。
- スタイルは「レシピ化」
  - PandaCSS の tokens/cva/sva と JSX ファクトリで、再利用と一貫性を保ちます。
- 分岐は宣言的に・漏れなく
  - ts-pattern の `.exhaustive()` を基本に、将来の列挙値追加にも強くします。

## ディレクトリ指針（抜粋）

- `src/types/` ドメイン型（ArkType）
- `src/lib/` ドメインロジック・ユーティリティ・stores（nanostores）
- `src/components/` UI（`atomic/`, `overlays/` など。原則プレゼンテーション）
- `src/styles/` PandaCSS のグローバルスタイル・アニメーション
- `src/routes/` 画面/ページの構成（React Router FS Routes）

## ArkType と neverthrow の使い方

ArkType のスキーマは「型の宣言」と「実行時チェック」を一箇所で提供します。検証結果は `wrapValidation()` で neverthrow の `Result` に変換して扱います。

```ts
// src/lib/arktype.ts
export function wrapValidation<D>(
  out: D | ArkErrors,
): Result<D, ArkErrors> {
  if (out instanceof type.errors) {
    return err(out);
  }

  return ok(out);
}
```

使い方の要点:

- ユーザー入力や外部からくる値は、なるべく早く ArkType で検証する
- `wrapValidation` → `Result` にしてから `.isOk()/.isErr()` で分岐
- 例外は使わず、UI に近い層でユーザ向けメッセージに変換

アンチパターン:

- 例外でコントロールフローを書く
- ArkType をすり抜けて `as` で型を確定させる

## ts-pattern（分岐・状態遷移）

状態やキー入力など、列挙値に対する分岐は ts-pattern を使います。`.exhaustive()` を最後に置き、網羅漏れを型で検出します。

```ts
// 例: 注文ステータスの表示ラベル
match(status)
  .with("UNCONFIRMED", () => "注文前")
  .with("WAITING_COOKING", () => "調理待ち")
  .with("WAITING_PICKUP", () => "受取待ち")
  .with("PICKED_UP", () => "受取済")
  .with("REFUNDED", () => "返金済")
  .with("CANCELED", () => "取消済")
  .exhaustive()
```

注文ステータスの変更（`src/lib/stores/orders.ts` の `changeOrderStatus`）でも `ts-pattern` で各ステータスに対する有効な遷移元（例: `WAITING_PICKUP` は `WAITING_COOKING` からのみ）を網羅的に解決しています。受付番号が重複した場合でも、作成日時昇順（FIFO）かつ有効な遷移元ステータスを持つ注文を順に遷移させることで、重複時に「調理待ち」から消えなくなる不具合を防いでいます。

キー操作→オーバーレイ表示の切替（`src/routes/main._index/ActiveArea.tsx`）でも同様です。副作用（イベント停止等）は最小限で、UI の状態管理はストアへ委譲します。
## PandaCSS の方針（tokens / cva / sva / jsx）

- tokens
  - `panda.config.ts` でフォントや `orderStatus.*` のセマンティックカラーを定義
  - 参照は `panda/tokens` の `token("colors....")` を使う
- cva（コンポーネント/単一要素のバリアント）
  - `src/components/atomic/Button.tsx` など。`p("button", cvaButton)` のように JSX ファクトリ化
- sva（複数スロットのスタイル）
  - `PickupMonitor` や `OrderQueue` のように `slots: [...]` で各部位のスタイルをまとめる
- グローバルスタイル/アニメ
  - `src/styles/highlight.ts` で `data-highlight-*` をトリガにしたハイライト/点滅を提供

レシピ追加の指針:

- 再利用の見込みがあるか（画面横断の粒度か）
- バリアント（size, color, intent など）が明確か
- デザイントークン参照で表現できるか

アンチパターン:

- インライン style で都度ハードコード
- 同じ見た目をファイルごとにバラバラ実装

## nanostores（状態・永続化）

- `persistentAtom` を基本にして localStorage に保存します
- 初期化やサニタイズはストア層で完結させ、UI では気にしない
- `computed` を使って派生状態を作る（例: `$normalizedCurrentOrderItems`）

例: 数字入力のサニタイズ（`src/lib/stores/current-order.ts`）

```ts
function sanitizeNumericString(value: string): string {
  if (value === "") return ""
  return value.replace(/\D/g, "")
}
```

## ドメイン補助: `lib/order.ts`

- `OrderStatusImpl` で表示ラベルやセマンティックカラーの解決を一箇所に集約
- `ReceiptNumberImpl` で "?" 表示や桁詰めなど UI 仕様を閉じ込めます

これにより、UI コンポーネントは見た目に集中でき、ドメイン仕様は `lib` に寄せられます。

## コンポーネントの分け方

- `atomic/` は小さな UI パーツ（Button, NumberInput, Card, Content など）
- 大きめの UI（例: `PickupMonitor`）は `sva` でスロット化しつつ、状態はストアから読む
- ドメイン処理（集計/正規化）は `lib/` に寄せ、コンポーネントは呼び出すだけ
- メイン画面の割引入力（`src/routes/main._index/active-area/AmountSection.tsx`）では、`$discounts` から割引番号と名称を取得して一覧表示し、未入力時は「未入力: 割引なし」の案内を表示します。
- メイン画面レイアウト（`src/routes/main._index/`）では、`route.tsx` のグリッド行を `repeat(5, minmax(0, 1fr)) auto` とし、`StatusBar` を最下部に固定しています。商品登録行（`OrderTable`）は `MiddleArea`（`overflowY="auto"`, `minH="0"`）内でスクロールし、ヘッダを固定表示します。また、解像度不足による要素重なりを防ぐため、Tauri ウィンドウの最小サイズ（1024x700）および `StatusBar` での解像度バリデーション警告を設けています。
## エラーハンドリングの約束

- ユーザー入力/外部入出力 → ArkType + `wrapValidation` → `Result`
- `Result.isErr()` の場合は UI で控えめな表示（トーストやラベル）。ログは `console` レベルで十分（ローカル完結のため）
- 例外を投げるのは、どうしても処理継続不能なプログラマブルエラーのみ

## パフォーマンスの小技

- `computed` で派生をキャッシュ
- `useMemo` でフィルタ/変換の再計算を抑制（例: `PickupMonitor` の待機リスト）
- `panda/jsx` の `styled` 要素に `className` を渡し、`cva/sva` のクラス合成を活用

## コーディング規約（最小）

- TypeScript は `@tsconfig/strictest` ベース
- `ts-pattern` の分岐は `.exhaustive()` を付ける
- `panda/tokens` の直値ハードコードを避ける（必ず token() 経由）
- `lib/` にドメイン変換ヘルパを寄せる（UI は呼ぶだけ）

## 開発環境（mise）メモ

- `.mise.toml` にツールと `tasks.setup` が定義されています。
  - bun `1.2.22` / rust `1.84.1` / npm:lefthook `1.12.2`
  - `mise run setup` で以下が自動実行されます：
    - `.vscode/settings.example.json` を `.vscode/settings.json` にコピー（ArkType/ESLint 推奨設定が有効化）
    - `mise i` でツールをインストール
    - `lefthook install` で Git フックを設定（pre-commit: `bun run check`）
    - `bun i` で依存パッケージを導入

- VS Code の推奨拡張は `.vscode/extensions.json` に定義（`tauri-apps.tauri-vscode`, `rust-lang.rust-analyzer`）。
- bun の PATH は mise が面倒を見ます。VS Code 内からもターミナルで `bun run ...` を呼べば OK です。

## レビュー観点チェックリスト

- [ ] ArkType に型/検証が追加されたか（`src/types/`）
- [ ] neverthrow の `Result` で失敗が扱われているか
- [ ] ts-pattern の分岐に漏れがないか（`.exhaustive()`）
- [ ] PandaCSS の `cva/sva`/tokens を使って一貫性があるか
- [ ] nanostores の初期化・サニタイズ・永続化が UI から分離されているか

## 参考リンク

- ArkType: <https://arktype.io/>
- neverthrow: <https://github.com/supermacro/neverthrow>
- ts-pattern: <https://github.com/gvergnaud/ts-pattern>
- PandaCSS: <https://panda-css.com/>
- nanostores: <https://github.com/nanostores/nanostores>
