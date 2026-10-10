# Fork元（upstream/main）からの変更点一覧（Edit.md）

本ドキュメントは、Fork元リポジトリ（`upstream/main`）と比較して、本リポジトリに加えられたすべての変更点・機能追加・設計改善をまとめたものです。

---

## 1. 概要（主要な変更点まとめ）

1. **商品・メニュー構成の刷新（2026年向け・だんご＆ドリンク）**:
   - 旧商品マスター（ポップコーン等）を全廃し、2026年度仕様の「だんご（5味＋増量）」および「ドリンク（缶ジュース・ペットボトル）」へ全面刷新。
   - 商品画像、価格、割引マスターの更新。
2. **だんごの味選択システム（2種掛け・味なし対応）**:
   - テンキーによる味選択ダイアログ（`1〜4: きなこ/みたらし/あんこ/のり醤油`、`0: 味なし`）の実装。
   - ハーフ＆ハーフ（2種類掛け）の正規化・集計と、注文キューでの味別バッジ表示。
3. **売り切れ（Sold-out / ✕印）機能の設計・実装**:
   - `localStorage`（nanostores `persistentAtom`）による売り切れ状態の安全な永続化。
   - メニュー画面での赤色✕印（バツ印SVG）オーバーレイ表示。
   - テンキー `+`（商品修正）による全画面・スクロールゼロの番号指定売り切れ切り替えUI。
   - 売り切れ商品の入力・会計確定の二重ブロック。
4. **ドリンク専用の調理スキップ（受取待ち直行）**:
   - 缶・ペットボトル等のドリンクのみの注文時は調理待ち（`WAITING_COOKING`）をスキップし、直接受取待ち（`WAITING_PICKUP`）として登録。調理者画面（`/order-queue`）へのドリンク混入を完全防止。
5. **0個入力の許容と調理待ち非表示**:
   - 誤入力行を即座に消去できるよう数量 `0` の入力を許容。伝票プレビューには取消状態を残しつつ、調理待ち画面・確定データからは0個商品を除外。
   - 最大数量の上限を 10個 から 100個 へ拡大。
6. **UI/UX・フォーカス・安定性の強化**:
   - カーソル未フォーカス時の画面下中央「次項目を押してください」バナー表示とワンタッチ復帰。
   - ポップアップ操作時の「もう一度同じボタンを押すと戻ります」案内追加。
   - 初期画面（`/`）のTauri判定をOS非依存にし、Macでも3画面同時起動ボタンが正常に利用可能。
   - 受付番号重複時のFIFO遷移（詰まり防止）、解像度警告、レイアウト崩れ・縦改行の防止。

---

## 2. ファイル別の詳細変更内容

### ① ドメイン型・データ層 (`src/types/`, `public/data/`)

| ファイル | 変更内容 |
| :--- | :--- |
| `public/data/item_groups.json` | だんご（だんご・きなこ・みたらし・あんこ・のり醤油・増量）、缶ジュース（ファンタ・コーラ）、ペットボトル（チルソン・アクエリ・水・麦茶・なっちゃん）に刷新。 |
| `public/data/discount.json` | 2026年度メニューに合わせた割引額・適用対象商品の再定義（お手伝い者割引の適用時0円化等）。 |
| `src/types/item.ts` | `Item` スキーマに `"isSoldOut?": "boolean"` を追加。 |
| `src/types/order.ts` | `MAX_ORDER_ITEM_AMOUNT = 100` を定数化し、`OrderItemAmount` の範囲を `0〜100` に拡大。 |

### ② ストア・ロジック層 (`src/lib/`)

| ファイル | 変更内容 |
| :--- | :--- |
| `src/lib/order.ts` | だんごの味定義（`DANGO_FLAVORS`: 0:味なし, 1:きなこ, 2:みたらし, 3:あんこ, 4:のり醤油）とセマンティックカラー定義（`DangoFlavorImpl`）を追加。<br>ドリンクのみの注文かを判定する `orderRequiresCooking()` を追加。 |
| `src/lib/stores/items.ts` | 売り切れ状態（`$soldOutItemIds`）を `persistentAtom` で永続化。<br>破損JSONや型不整合を防ぐ `safeDecode` / `safeEncode` を実装。<br>`toggleItemSoldOut`, `toggleItemSoldOutByNumber`, `setItemSoldOut` を実装。 |
| `src/lib/stores/current-order.ts` | `validateExtraPortion`（だんご数量 ≧ 増量数量）で数量0のアイテムを除外して正しく集計。<br>味の正規化（最大2種、重複排除）の強化。 |
| `src/lib/stores/status.ts` | `ITEM_SOLD_OUT` ステータスを追加。 |
| `src/lib/stores/orders.ts` | 受付番号が重複した場合でも、作成日時昇順（FIFO）で `WAITING_COOKING` → `WAITING_PICKUP` → `PICKED_UP` へ順次遷移させるロジックを実装。 |
| `src/lib/focus-manager.ts` | `restoreAppFocus()`, `registerDiscountFocusHelper()`, `registerPaymentFocusHelper()` を追加し、全フェーズでの一元的なフォーカス復帰を可能に。 |

### ③ コンポーネント・ダイアログ層 (`src/components/`)

| ファイル | 変更内容 |
| :--- | :--- |
| `src/components/atomic/Dialog.tsx` | `fullScreen?: boolean` プロパティを追加し、全画面モーダルに対応。 |
| `src/components/overlays/MenuDialog.tsx` | 調理完了・受取完了ポップアップに「もう一度同じボタンを押すと戻ります」を追加。<br>`ITEM_EDIT` を全画面・スクロールゼロの3カラムレイアウトに刷新し、商品番号の大型入力欄（自動フォーカス）と視認性の高い参照番号バッジを配置。 |
| `src/components/overlays/DangoFlavorDialog.tsx` | テンキーによる味選択モーダルの新設（1〜4: 味選択、0: 味なし単一確定、売り切れ味の選択無効化＆✕表示、BS戻る、Enter確定）。 |
| `src/components/OrderQueue.tsx` | 調理者画面用コンポーネント。`filterGroupId` 指定時にドリンク商品を明細から完全除外（だんごのみ表示）。`amount === 0` のアイテムを除外。 |

### ④ メイン画面・ルーティング層 (`src/routes/`)

| ファイル | 変更内容 |
| :--- | :--- |
| `src/routes/_index.tsx` | 初期メニュー画面。Tauri判定をOS非依存（`isTauri()` のみ）に変更し、Macでも「3画面を同時に開く」ボタンが使用可能に。 |
| `src/routes/main._index/route.tsx` | レイアウトグリッドの最適化（縦改行防止、最下部StatusBar固定）、`UnfocusedNotice` コンポーネントの配置。 |
| `src/routes/main._index/UnfocusedNotice.tsx` | **新設**。入力欄からフォーカスが外れた際に画面下中央へ「次項目を押してください」を表示し、クリックやキー入力でカーソルを復帰。 |
| `src/routes/main._index/ActiveArea.tsx` | テンキーショートカット（`/`: 調理完了, `*`: 受取完了, `-`: 注文修正, `+`: 商品修正）の整理、`Dialog` への `fullScreen` 適用。 |
| `src/routes/main._index/StatusBar.tsx` | `ITEM_SOLD_OUT` の案内通知、画面解像度不足時の警告表示、数量範囲外エラーの修正。 |
| `src/routes/main._index/active-area/Information.tsx` | メニュー表に売り切れ商品の赤✕印オーバーレイ・赤枠・`(売切)` ラベルを追加、クリックでのトグル対応。 |
| `src/routes/main._index/active-area/OrderTable.tsx` | 売り切れ商品の番号入力を遮断。個数の上限バリデーションを 10個 から 100個 に拡大（0個の入力も許容）。 |
| `src/routes/main._index/active-area/AmountSection.tsx` | 会計直前に売り切れ商品が含まれていないか再検証。<br>ドリンクのみの注文時は `WAITING_PICKUP` として登録。<br>0個の商品を確定注文から除外。 |
| `src/routes/main._index/OrderQueue.tsx` | レジ画面の注文履歴。未確定プレビュー（`UNCONFIRMED`）では0個を表示維持し、確定後は0個を非表示。だんごの味別カラーバッジ表示。 |
| `src/routes/order-queue._index/route.tsx` | 調理者専用画面。だんごグループ（`filterGroupId`）に絞り込んで大画面表示。 |

### ⑤ ドキュメント・テスト (`AGENTS.md`, `*.test.ts`)

| ファイル | 変更内容 |
| :--- | :--- |
| `AGENTS.md` | 「増量」から汎用的な「トッピング」設計へ移行する際のリファクタリング指針（4つの注意点）を明記。 |
| `src/lib/stores/items.test.ts` | 売り切れ管理（ID指定トグル、番号指定トグル、破損localStorageデータの安全な復元・フィルタリング）のテストスイートを新設。 |
| `src/lib/stores/orders.test.ts` | 受付番号FIFO遷移、数量上限（0〜100）、ドリンクのみ注文判定（`orderRequiresCooking`）、味なし（`0: 味なし`）の単体テストを追加。 |

---

## 3. キーバインド仕様一覧（テンキー対応表）

現行コードで実装されているキーバインドは以下の通りです：

| キー | 画面・状態 | 割り当て機能 | 動作詳細 |
| :---: | :--- | :--- | :--- |
| **`/`** | メインレジ | **調理完了** (`COOKING_COMPLETE`) | 受付番号入力ポップアップを開く（もう一度 `/` で閉じる） |
| **`*`** | メインレジ | **受取完了** (`PICKUP_COMPLETE`) | 受付番号入力ポップアップを開く（もう一度 `*` で閉じる） |
| **`-`** | メインレジ | **注文修正** (`ORDER_EDIT`) | 注文修正ポップアップを開く（※現状スタブ枠） |
| **`+`** | メインレジ | **商品修正** (`ITEM_EDIT`) | 全画面の売り切れ切替画面を開く（もう一度 `+` で閉じる） |
| **`.` (長押し)** | メインレジ | **注文リセット** (`RESET`) | プログレスバー表示後、現在の注文伝票を初期化 |
| **`Enter`** | 入力時全般 | **決定 / 次へ** | 受付番号確定 → 伝票行追加 → 割引入力 → 預かり金入力 → 注文確定 |
| **`Backspace`** | 入力時全般 | **戻る / クリア** | 空のセルで押すと前のセル・前フェーズへフォーカス移動 |
| **`0`** | 味選択ダイアログ | **味なし** | 素焼きプレーンだんご（単一確定） |
| **`1〜4`** | 味選択ダイアログ | **味選択** | 1: きなこ, 2: みたらし, 3: あんこ, 4: のり醤油（最大2種まで） |
