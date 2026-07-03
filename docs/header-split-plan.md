# ヘッダ（appHeader 内テーブル）分割 詳細設計書

`docs/index-split-completion-plan.md`（全 Phase 完了済み、2026-07-03）の後続タスク。index.html に残っている `<header ref="appHeader">` 内のニトロ／クロス集計テーブル（約 182 行）を Vue コンポーネントへ外部化し、index.html を約 362 行 → 約 195 行まで薄くする。

分割完了計画と同じ原則（逐語移動・検証ゲート・発見メモ）をそのまま適用する。本書の §3〜§7 を読めば、別セッションの作業者がそのまま実装に着手できる状態を目指す。

## 1. 進捗チェックリスト

| Phase | 内容 | 状態 |
|---|---|---|
| H-1 | `factor-summary-header.js` 作成＋index.html 置換 | 完了 |
| H-2 | service worker precache 追加＋総合検証 | 完了 |

### 1.1 進捗ログ（中断・再開用。作業のたびに追記する）

- **2026-07-03**: Phase H-1/H-2 完了。`vue/components/header/factor-summary-header.js` を追加し、`index.html` の `<header ref="appHeader">` 内テーブルを `<factor-summary-header>` 呼び出しへ置換。`<header>` の殻は残し、描画後 DOM が `header > table` になることを `dump-dom` で確認。`service-worker.js` に新コンポーネントを precache 追加し、`CACHE_NAME` を `dabimas-factor-v20260703-25` へ bump。検証: `backup-index-exp .\index.html` 実行済み、`verify-index-exp .\index.html` OK、`node --check` OK、`python -m pytest` 8 passed、PC（1280x800）/モバイル（375x812）スクリーンショットでヘッダ表示確認。

## 2. 対象と現状

- 対象: `index.html` の `<header ref="appHeader">`（52 行目）〜 `</header>`（235 行目）のうち、**内側の `<table>` 全体**（53〜234 行目、約 182 行）。
- `<table>` は 2 つの `<tbody>` を持つ:
  - PC 用（`v-if="$vuetify.breakpoint.mdAndUp"`）: ニトロ／クロスの 2×14 因子ヘッダ＋数値行、理論／子系統数セル、配合保存ボタン（馬アイコン）、リセットボタン（リロードアイコン）。
  - モバイル用（`v-if="$vuetify.breakpoint.smAndDown"`）: スクリーンショットボタン、因子ヘッダ 1 行、ニトロ行・クロス行、理論／子系統セル、リセット／配合保存ボタン。
- `<header ref="appHeader">` 自体と、その外側にある `combination-dialog` / `v-snackbar` / `<main ref="appMain">` は**対象外**（動かさない）。

## 3. 制約の調査結果（設計判断の根拠。実装前に再確認すること）

### 3.1 `$refs.appHeader` は素の DOM 要素でなければならない

`applyMobileViewportLayout()`（`vue/app/methods/ui-viewport.js` 305〜308 行目）:

```js
const headerEl = this.$refs.appHeader;
const headerHeight = headerEl
  ? Math.ceil(headerEl.getBoundingClientRect().height)
  : 0;
```

`ref` を**コンポーネントタグに付けると VueComponent インスタンスが返り**、`getBoundingClientRect` が存在せず高さ計測が壊れる（`headerEl.$el` への書き換えが必要になり、分割完了計画 §3.8 の不変条件「`applyMobileViewportLayout()` の高さ計測方式を変えない」に抵触する）。

→ **設計判断: `<header ref="appHeader">` の殻は index.html に残す。** ref は素の `<header>` 要素に付いたままなので、ui-viewport.js は 1 文字も変えない。

### 3.2 統合版がヘッダ内側にタブバーを挿す予定

`docs/dabifaku_unified_spec_draft.md`（375 行目付近）は作業枠タブバーを「既存の `<header ref="appHeader">` 要素の内側・最上段」に追加する設計。§3.1 の設計判断により `<header>` の殻が index.html に残るため、**タブバーの挿入位置も index.html のまま**で統合版設計に影響しない（`<header>` 内で `<workspace-tab-bar>` → `<factor-summary-header>` の順に並べるだけ）。

### 3.3 CSS は全て子孫セレクタ（直下セレクタなし）

`css/style.css` / `css/mobile.css` のヘッダ関連セレクタを全数確認した結果、`.exp-mobile-layout header table`、`.exp-mobile-layout header .factorNumCell`、`header { ... }` 等の**子孫セレクタのみ**で、Phase 3-4（mobile-horse-picker）で問題になった直下 `>` セレクタは 1 つもない。

→ **設計判断: コンポーネントのルート要素を `<table>` にする。** Vue はコンポーネントタグをルート要素で置き換えるため、描画後の DOM は現状と同じ `header > table` になり、CSS は全て無変更で効く。

### 3.4 guard スクリプトへの影響なし

`scripts/codex-powershell.ps1` の `verify-index-exp` が要求するスニペット（`watch:` / `methods:` / `handleCombinationCellClick: function () {` / `combinationDialog: function () {` / `this.dispButtonName = ...`）は全て `vue/app/**/*.js` 側に存在し、ヘッダ HTML には 1 つも含まれない。guard の結合対象は index.html + `vue/app/**/*.js` のみで、新コンポーネント（`vue/components/` 配下）は結合対象外だが、必要スニペットが無いので問題ない。**guard スクリプトの変更は不要。**

### 3.5 ヘッダテンプレートが root app に依存している値の全数

grep で確認済み（実装時に再確認すること）:

| 参照 | 種別 | 定義場所 |
|---|---|---|
| `factorNumtoString` | data | `vue/app/app-state.js` |
| `inbreedFactorNumtoString` | data | `vue/app/app-state.js` |
| `categoryNumtoString` | data | `vue/app/app-state.js` |
| `styleThoeryClass` | data | `vue/app/app-state.js` |
| `dispCategory` | data | `vue/app/app-state.js` |
| `isCapturingScreenshot` | data | `vue/app/app-state.js` |
| `combinationCellStyle` | computed | `vue/app/app-computed.js` |
| `handleClick()` | method | `vue/app/methods/bootstrap.js` |
| `handleCombinationCellClick` | method | `vue/app/methods/combination.js` |
| `initializer()` | method | `vue/app/methods/bootstrap.js` |
| `captureMobileScreenshot` | method | `vue/app/methods/ui-viewport.js` |
| `$vuetify.breakpoint` | Vuetify | 子コンポーネントでもそのまま使える（root の vuetify インスタンスが注入される） |

data/computed は props 7 本、メソッド 4 つは emit 4 本に置き換える（§4.2）。**これが逐語移動の唯一の構造的例外**（memo-cell / desktop-horse-autocomplete で確立したパターンと同じ）。

## 4. 設計

### 4.1 新ファイル: `vue/components/header/factor-summary-header.js`

- IIFE `(function (window, Vue) { ... })(window, window.Vue);` 形式。
- `window.Dabimas.components.FactorSummaryHeader` に定義を置き、`Vue.component("factor-summary-header", ...)` でグローバル登録（pedigree-card.js の記法に合わせる）。
- ルート要素は `<table width="100%" style="border-collapse: collapse">`（現 53 行目のタグそのまま）。
- テンプレートは index.html 53〜234 行目を**逐語**でテンプレート文字列化。変更してよいのは以下のみ:
  - `this` 由来の値 → props 名（例: `factorNumtoString[0]` → `factorNums[0]`）
  - メソッド呼び出し → `$emit`（例: `@click="handleClick()"` → `@click="$emit('toggle-category')"`）
  - イベント修飾子（`@click.stop.prevent` 等)・`data-html2canvas-ignore="true"`・`<!-- ここから下がいらない -->` コメントを含め、それ以外は 1 文字も変えない。
- props はオブジェクト形式で型を明記（pedigree-card.js に合わせる）。

### 4.2 props / イベント一覧

| props（kebab-case で受け渡し） | 型 | 対応する root の値 |
|---|---|---|
| `factor-nums` | Array | `factorNumtoString` |
| `inbreed-factor-nums` | Array | `inbreedFactorNumtoString` |
| `category-num` | String | `categoryNumtoString` |
| `theory-class` | String | `styleThoeryClass` |
| `disp-category` | Number | `dispCategory` |
| `combination-cell-style` | [Object, String] | `combinationCellStyle` |
| `is-capturing-screenshot` | Boolean | `isCapturingScreenshot` |

| emit | 発火元 | root 側リスナ |
|---|---|---|
| `toggle-category` | PC の「クロス」th クリック | `handleClick`（pedigree-card の既存イベント名と揃える） |
| `combination-open` | 馬アイコンセル（PC・モバイル両方） | `handleCombinationCellClick` |
| `reset` | リロードアイコンセル（PC・モバイル両方） | `initializer` |
| `capture-screenshot` | モバイルのカメラボタン | `captureMobileScreenshot` |

### 4.3 index.html の置き換え後イメージ

```html
<header ref="appHeader">
  <factor-summary-header
    :factor-nums="factorNumtoString"
    :inbreed-factor-nums="inbreedFactorNumtoString"
    :category-num="categoryNumtoString"
    :theory-class="styleThoeryClass"
    :disp-category="dispCategory"
    :combination-cell-style="combinationCellStyle"
    :is-capturing-screenshot="isCapturingScreenshot"
    @toggle-category="handleClick"
    @combination-open="handleCombinationCellClick"
    @reset="initializer"
    @capture-screenshot="captureMobileScreenshot"
  ></factor-summary-header>
</header>
```

約 182 行 → 15 行。index.html は約 362 行 → 約 195 行になる見込み。

### 4.4 script タグの位置

`pedigree-card.js` の直後（`vue/app/*.js` 群より前）に追加:

```html
<script src="./vue/components/pedigree/pedigree-card.js"></script>
<script src="./vue/components/header/factor-summary-header.js"></script>
```

読み込み時依存は `window.Vue` のみ（`Vue.component` 登録だけ行い、`new Vue` は main.js が最後に実行するため）。

### 4.5 service worker

- `urlsToCache` に `BASE_PATH + 'vue/components/header/factor-summary-header.js'` を追加（コンポーネント群の並びの末尾、`pedigree-card.js` の次）。
- `CACHE_NAME` を bump（`dabimas-factor-vYYYYMMDD-NN` 形式で +1）。

## 5. 実装手順（Phase H-1 → H-2）

1. `git switch` 等で作業ブランチを確認（`feature/index-split-completion` の続き、または新ブランチ。コミット境界は分割完了計画と同じく substep 単位）。
2. index.html 53〜234 行目（`<table ...>` 〜 `</table>`）を Python で行番号アサート付きで抽出し、scratchpad に退避（バイト一致確認は分割完了計画 §3 の手順どおり）。**行番号は本書執筆時点のもの。実装時は `grep -n 'header ref="appHeader"' index.html` 等で必ず再特定すること。**
3. `vue/components/header/factor-summary-header.js` を新規作成（§4.1〜4.2）。ファイル冒頭に「このコンポーネントの役割／置かない処理／分けている理由」コメント（既存コンポーネントの様式）を書く。§3.1〜3.3 の設計判断（殻を残す理由・ルートを table にする理由）も冒頭コメントに要約して残す。
4. `node --check` で構文確認。BOM なし・LF のみを確認。
5. index.html の該当範囲を §4.3 の形へ置換（Python アサート付き）。script タグを §4.4 の位置に追加。
6. `powershell -ExecutionPolicy Bypass -File scripts/codex-powershell.ps1 verify-index-exp <index.htmlの絶対パス>` で guard 確認。
7. service worker を §4.5 のとおり更新。
8. §6 の検証を全て実施。
9. 本書 §1 のチェックリストと進捗ログを更新し、コミット（コミットメッセージは分割完了計画の様式: `分割完了 Phase H-1: ...`＋発見メモ）。

## 6. 検証ゲート

ベースラインは既存の `tests/fixtures/split-baseline/`（S1〜S6）をそのまま使う。ヘッダは root の data/computed を**表示するだけ**なので、スナップショット値は変わらないはず。表示側の確認が主になる。

1. キャッシュ全削除（SW unregister ＋ `caches.delete`）→ 2 回リロード → コンソールエラー 0 件・SW 登録成功。
2. S1（ダッシャーゴーゴー×シル）を再実行し、スナップショットがベースラインと一致（uuid 由来の `factor.hash` 不一致は許容。`tests/fixtures/split-baseline/README.md` 発見メモ 4 参照）。
3. **ヘッダ表示の確認（本分割の主眼）**:
   - PC（1280×800。preview の「desktop」プリセットは実際は約 628px でモバイル判定になるため必ず明示指定）: ニトロ行に `factorNumtoString`、クロス行に `inbreedFactorNumtoString` の値が表示されること（S1 なら クロス行 index1・4 が "01"）。
   - `dispCategory` 切替（PC の「クロス」th クリック → `toggle-category` → `handleClick`）で「理論」⇔「子系統数」表示が切り替わり、子系統数に `categoryNumtoString`（S1 なら "17"）が出ること。**この UI クリックは emit 配線の実地検証を兼ねる。**
   - リセットセル（リロードアイコン）クリック → `initializer()` が走り全セルクリア。
   - 馬アイコンセルクリック → 配合保存ダイアログが開く。
   - モバイル（375×812）: 同内容のモバイル用 tbody が表示され、カメラボタンで `captureMobileScreenshot` が発火する（`isCapturingScreenshot` 中は disabled になる）。
4. **`$refs.appHeader` の実測が生きていることの確認**: モバイル表示で `preview_eval` により `getComputedStyle(document.getElementById("app")).getPropertyValue("--exp-mobile-main-height")` が非空であること（`applyMobileViewportLayout` がヘッダ高さを測れている証拠）。
5. PC／モバイル両方のスクリーンショットを撮り、ベースライン記載の見た目の要点（ヘッダの因子ラベル配色・数値表示）と目視比較。
6. `preview_console_logs({level:"error"})` が全操作を通して 0 件。

## 7. スコープ外（やらないこと）

- PC 用／モバイル用 tbody の共通化・`v-for` 化などのテンプレートリファクタ（14 因子セルの重複はそのまま逐語移動する）。
- ヘッダの見た目・文言・クラス名の変更（`.f00_nitro` / `.factorNumCell` / `.exp-mobile-screenshot-*` 等は統合版・CSS が参照するため変えない）。
- `<header ref="appHeader">` の殻、`combination-dialog`、`v-snackbar`、`<main ref="appMain">` の移動。
- 発見した疑わしいコードの修正（発見メモに記録して後回し。分割完了計画 §3 と同じ）。

## 8. 分割完了計画 §3.8 不変条件との整合（実装後に再確認すること）

- `<header ref="appHeader">` の構造: **殻は index.html に残り、描画後 DOM は `header > table` で不変。** ✔
- `applyMobileViewportLayout()` の高さ計測方式: **ui-viewport.js は無変更。** ✔
- localStorage 6 キー・保存メソッド・IndexedDB・CSS クラス名: **一切触らない。** ✔
