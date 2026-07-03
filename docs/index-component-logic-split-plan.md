# index.html コンポーネント・ロジック分割設計

> **本計画の残タスク（root app の `data`/`computed`/`watch`/lifecycle/`methods` 分割、service worker precache 整合を含む）は [`index-split-completion-plan.md`](./index-split-completion-plan.md) により完了（2026-07-03）。index.html は 4,611 行から 362 行へ縮小し、統合版仕様が参照するメソッドの実際の移動先は同ドキュメント §10 の対応表を参照。**

## 目的

`index.html` に同居している画面テンプレート、Vue コンポーネント、血統計算、保存処理、モバイル表示調整を段階的に分割し、今後の機能追加時に変更箇所を特定しやすくする。

最優先の設計目標は `pedigree-row` を汎用的な行コンポーネントにすること。種牡馬側、繁殖牝馬側、将来の別表示でも同じ `pedigree-row` を使い回せる状態をゴールにする。

## 現状の主な問題

- `index.html` が約 6,400 行（2026-06 時点で 6,366 行）あり、HTML、`text/x-template`、`Vue.component`、`new Vue` が 1 ファイルに混在している。
- `pedigree-row` は存在するが、親から配列と関数を大量に受け取っており、root app の状態構造に強く依存している。
- `common-autocomplete` が PC 用 autocomplete、スマホ用検索ダイアログ、メモ入力、検索ロジック、スクリーンショット補助処理まで抱えている。
- root app の `methods` に、血統表構築、インブリード判定、因子集計、配合理論、localStorage、IndexedDB、スクリーンショット、モバイル viewport 調整が同居している。
- `rowConfigs` と `rowConfigsBloodmare` がほぼ同じ構造を別配列として持っており、血統表の行定義を再利用しにくい。

## 前提と制約

- 当面は Vue 2 + script tag 構成を維持する。ビルドツール導入は今回の分割の必須条件にしない。
- 新規 JS は `window.Dabimas` 名前空間にぶら下げる IIFE 形式を基本にする。ES module 化や Vite 化は次段階の改善として扱う。
- 対象ファイルは `index.html` のみ。`index.exp.html` は `feature/json-split-initial-load` ブランチで削除済みのため、本ドキュメントの「`index.exp.html`」への言及はすべて読み替え不要（対象外）とする。以降の手順・ゴール・検証も `index.html` 単独で判断する。
- `index.html` を編集する場合は AGENTS.md のルールに従い、事前に `backup-index-exp`、編集後に `verify-index-exp` を実行する。編集は `apply_patch` のみ。
  - 注意: `scripts/codex-powershell.ps1` の `backup-index-exp` / `verify-index-exp` は引数を省略すると既定で削除済みの `index.exp.html` を探して `Target file not found` で失敗する。必ず対象パスを明示し、`... verify-index-exp .\index.html`（backup も同様）として実行する。AGENTS.md / 同スクリプトの既定値も将来 `index.html` へ寄せるのが望ましい（本分割とは別作業）。
- 文字コードは UTF-8、BOM なしを維持する。

## 推奨フォルダ構成

```text
vue/
  app/
    main.js
    app-options.js
    app-state.js
    app-lifecycle.js
  components/
    layout/
      app-header.js
      factor-summary-header.js
      mobile-factor-summary.js
    pedigree/
      pedigree-card.js
      pedigree-table.js
      pedigree-row.js
      pedigree-head-cells.js
      horse-cell.js
      horse-autocomplete.js
      mobile-horse-picker.js
      memo-cell.js
      generation-cell.js
      parent-line-cell.js
      inbreed-button-cell.js
      factor-cells.js
    dialogs/
      factor-dialog.js
      combination-dialog.js
  constants/
    factor-definitions.js
    pedigree-indexes.js
    parent-lines.js
  logic/
    pedigree/
      row-configs.js
      pedigree-builder.js
      pedigree-selection.js
      pedigree-css.js
    horses/
      horse-loader.js
      horse-search.js
      horse-format.js
    factor/
      factor-map.js
      factor-counts.js
      manual-factors.js
    inbreed/
      inbreed-detector.js
      inbreed-counts.js
      inbreed-exceptions.js
    theory/
      compatibility.js
    storage/
      local-storage.js
      combination-storage.js
      manual-inbreed-storage.js
    ui/
      mobile-viewport.js
      screenshot.js
css/
  components/
    pedigree.css
    mobile-picker.css
```

既存の `vue/CombinationDialog.js`、`vue/factor-dialog.js` は、最初はそのままでもよい。移行が安定した後に `vue/components/dialogs/` へ移す。

すでに外部化済みのファイル（2026-06 時点）:

- `vue/CombinationDialog.js` … 配合保存ダイアログ（`combination-dialog` 相当）。
- `vue/factor-dialog.js` … 因子選択ダイアログ（`factor-dialog` 相当）。
- `vue/combinationDB.js` … IndexedDB の低レベル処理。**ただし注意: このファイルは ES module（`export`）で書かれており、`index.html` からは読み込まれていない（実行時は dead code）。** 実際に動いている DB open 処理は、`CombinationDialog.js` 内のインライン `openDB()` と、`index.html` root app の `ensureCustomHorseDb()` の 2 箇所にある。つまり同じ `DabifacCombinationDB` v2 の open / スキーマ定義が **3 箇所に重複**している。`logic/storage/combination-storage.js` を作る際は、combinationDB.js を「そのまま使う」のではなく IIFE / `window.Dabimas` 形式へ書き直して 1 箇所へ集約し、`DB_VERSION` 定数も単一の定義に寄せる（version 不一致は VersionError の原因になる — 各ファイルのコメントにも同旨の警告あり）。

つまり「ダイアログ 2 種」はすでに `index.html` の外にある。IndexedDB アクセス層は「外にあるが使われていない」状態なので、集約作業が必要。分割の起点は、これら既存ファイルを前提に、計算ロジック（factor / pedigree / inbreed）と `pedigree-row` 周りに絞ると効率がよい。

## PC版・ケータイ版の切り分け方針

PC版とケータイ版は、見た目や入力方法が大きく違う部分だけコンポーネントを分ける。血統計算、因子集計、インブリード判定、保存処理は共通ロジックを使い、PC用とケータイ用で二重実装しない。

基本方針:

- `pedigree-row`、`pedigree-card`、`pedigree-table` はできるだけ共通にする。
- PC / ケータイで分けるのは、画面幅や操作方法の都合で UI が変わる小さい部品に限定する。
- PC用部品とケータイ用部品は、親へ返す event 名と payload 形式を同じにする。
- 親コンポーネントや root app は、PCから来た操作かケータイから来た操作かを意識しない。

分けてよい部品:

```text
components/
  layout/
    factor-summary-header.js   # PC 用集計ヘッダー（旧称 desktop-factor-summary。本ドキュメントでは factor-summary-header に統一）
    mobile-factor-summary.js
  pedigree/
    horse-autocomplete.js
    mobile-horse-picker.js
    desktop-inbreed-button.js
    mobile-inbreed-button.js
```

共通にする処理:

```text
logic/
  horses/horse-search.js
  factor/factor-counts.js
  pedigree/pedigree-builder.js
  inbreed/inbreed-detector.js
  theory/compatibility.js
  storage/local-storage.js
```

例:

```html
<horse-cell
  :is-mobile="isMobile"
  :row="row"
  :row-state="rowState"
  :horse-options="horseOptions"
  @horse-change="$emit('horse-change', $event)"
></horse-cell>
```

階層は 2 段にする（後述のコンポーネント別方針と一致させる）。

1. `horse-cell` は `mode`（`factor` / `memo`）で「馬を選ぶ」か「メモを書く」かを切り替える。PC / ケータイの差は意識しない。
2. `factor` モードのとき描画する `horse-autocomplete` が、`is-mobile` で PC 入力とケータイ入力を切り替える。

```html
<!-- horse-cell の中: モードで入口を分ける -->
<horse-autocomplete
  v-if="mode === 'factor'"
  :is-mobile="isMobile"
  :row="row"
  :row-state="rowState"
  :horse-options="horseOptions"
  @horse-change="$emit('horse-change', $event)"
></horse-autocomplete>
<memo-cell
  v-else
  :row="row"
  :row-state="rowState"
  @memo-change="$emit('memo-change', $event)"
></memo-cell>
```

```html
<!-- horse-autocomplete の中: 画面幅で入力 UI を分ける -->
<desktop-horse-autocomplete
  v-if="!isMobile"
  :row="row"
  :row-state="rowState"
  :horse-options="horseOptions"
  @horse-change="$emit('horse-change', $event)"
></desktop-horse-autocomplete>
<mobile-horse-picker
  v-else
  :row="row"
  :row-state="rowState"
  :horse-options="horseOptions"
  @horse-change="$emit('horse-change', $event)"
></mobile-horse-picker>
```

どちらの入力 UI も、親へ返す event は同じにする。

```text
horse-change { index, sex, localIndex, horse }
```

> 補足（payload の整合）: `onChangeMain(sex, id, horseData)` は内部で `targetIndex = Number(id) + Number(sex) * 16` を計算している（`index.html` 現行実装）。したがって `horse-change` の payload は最低でも `sex` と `localIndex`（= `id`）を含める。`index` を一緒に渡す場合は「`selected` 配列上の global index（`sex*16 + localIndex`）」の意味で統一し、本ドキュメント内で `{ index, horse }` だけを渡している擬似コード例（後述の emit 例）も、実装時はこの 4 値に合わせる。

この形にすると、PCでは autocomplete、ケータイでは検索ダイアログを使いながら、親側の `onChangeMain`、血統展開、保存処理は 1 つだけで済む。

## Script 読み込み方針

ビルドなしで分割するため、依存順に classic script として読み込む。

```html
<script src="./vue/vue.min.js"></script>
<script src="./vue/vuetify.js"></script>

<script src="./vue/constants/factor-definitions.js"></script>
<script src="./vue/constants/pedigree-indexes.js"></script>

<script src="./vue/logic/factor/factor-map.js"></script>
<script src="./vue/logic/factor/factor-counts.js"></script>
<script src="./vue/logic/horses/horse-search.js"></script>
<script src="./vue/logic/pedigree/row-configs.js"></script>

<script src="./vue/components/pedigree/mobile-horse-picker.js"></script>
<script src="./vue/components/pedigree/horse-autocomplete.js"></script>
<script src="./vue/components/pedigree/pedigree-row.js"></script>
<script src="./vue/components/pedigree/pedigree-table.js"></script>
<script src="./vue/components/pedigree/pedigree-card.js"></script>

<script src="./vue/components/dialogs/factor-dialog.js"></script>
<script src="./vue/components/dialogs/combination-dialog.js"></script>
<script src="./vue/app/app-options.js"></script>
<script src="./vue/app/main.js"></script>
```

各ファイルは次の形を基本にする。

```js
(function (window, Vue) {
  window.Dabimas = window.Dabimas || {};
  window.Dabimas.components = window.Dabimas.components || {};

  const PedigreeRow = {
    name: "pedigree-row",
    props: {},
    template: `...`
  };

  window.Dabimas.components.PedigreeRow = PedigreeRow;
  Vue.component("pedigree-row", PedigreeRow);
})(window, window.Vue);
```

## コンポーネント分割方針

### `pedigree-card`

血統表 1 枚分の外枠を担当する。

- `v-col` / `v-card` / `.pedigree-card-table-wrap` を持つ。
- `side="stallion"` または `side="broodmare"` を受け取る。
- 行の描画は `pedigree-table` に委譲する。
- モバイル高さ調整のため、既存 CSS クラス `.pedigree-card-col` / `.pedigree-card-shell` / `.pedigree-card-table-wrap` は維持する。

使用イメージ:

```html
<pedigree-card
  side="stallion"
  :rows="stallionRows"
  :view-state="pedigreeViewState"
  @horse-change="handleHorseChange"
  @memo-change="memoChange"
  @inbreed-toggle="handleInbreedButtonClick"
  @manual-factor-update="applyManualFactors"
></pedigree-card>

<pedigree-card
  side="broodmare"
  :rows="broodmareRows"
  :view-state="pedigreeViewState"
  @horse-change="handleHorseChange"
  @memo-change="memoChange"
  @inbreed-toggle="handleInbreedButtonClick"
  @manual-factor-update="applyManualFactors"
></pedigree-card>
```

### `pedigree-table`

`table.table_main` と `colgroup`、`tbody` を担当する。

- `rows` を `v-for` し、各行を `pedigree-row` に渡す。
- `colgroup` の重複を 1 箇所に閉じ込める。
- どの行を何行目に出すかは `row-configs.js` の責務にする。

### `pedigree-row`

使い回し対象の中心。1 行の構造だけを担当し、root app の配列構造を直接知らないようにする。

新しい props の目標:

```js
props: {
  row: { type: Object, required: true },
  rowState: { type: Object, required: true },
  mode: { type: String, required: true },
  horseOptions: { type: Array, required: true },
  displayOptions: { type: Object, default: () => ({}) }
}
```

`rowState` の例:

```js
{
  index: 17,
  selectedHorse: {},
  categoryText: "",
  memoText: "",
  generationLabel: "2",
  parentLineText: "Ne",
  parentLineClass: "factor_omoshiro styleParentLine",
  inbreedButtonState: -1,
  inbreedButtonClass: "factor_omoshiro styleInbreedButton",
  rowColorClass: "",
  factorTexts: ["短", "", ""],
  factorClasses: ["f01 styleFactorClassMain", "...", "..."],
  canEditManualFactors: true
}
```

emit の目標:

```text
horse-change         { index, sex, localIndex, horse }
memo-change          { index, value }
inbreed-toggle       { index }
manual-factor-update { index, factors }
toggle-category      {}
```

`pedigree-row` から root app のメソッドを prop で直接呼ばない。親はイベントを受けて既存の `onChangeMain`、`memoChange`、`handleInbreedButtonClick`、`applyManualFactors` に接続する。

### `horse-cell`

馬名選択セルを担当する。

- `mode === "factor"` のとき `horse-autocomplete` を表示する。
- `mode === "memo"` のとき `memo-cell` を表示する。
- 既存の `common-autocomplete` から馬選択とメモ入力を分離する。

### `horse-autocomplete`

PC の `v-autocomplete` とスマホ用 picker の切り替えだけを担当する。

- 検索ロジックは `logic/horses/horse-search.js` に移す。
- スマホ dialog の内部は `mobile-horse-picker` に委譲する。
- 選択確定時は `input` ではなく `horse-change` を emit する。

### `mobile-horse-picker`

スマホ検索ダイアログを担当する。

- IME composition 対応、検索文字列同期、候補リスト表示、クリア、先頭候補選択を持つ。
- 馬データ整形は `horse-format.js` に寄せる。
- viewport 高さ調整や screenshot は持たない。

### `factor-cells`

因子 3 セルと手動因子編集ボタンを担当する。

- 表示因子、CSS class、手動因子編集可否を props で受け取る。
- `factor-dialog` を開く判断はこのコンポーネントに閉じる。
- 確定時は `manual-factor-update` を emit する。

### `inbreed-button-cell`

インブリードボタンの PC / mobile 表示差分を担当する。

- `state` は `-1`、`0`、`1` のみ受け取る。
- click 時は `inbreed-toggle` を emit する。
- root app の `reload` や `size` に依存しない形を目指す。必要なら `displayOptions.buttonSize` として渡す。

## 実装コメント方針

分割後のコンポーネントは、レビュワーが Vue、血統表、配合理論を知らない前提で読めるようにコメントを書く。目安は「小学生でも、画面のどの部品で、何を受け取り、何を親へ返すのかが追える」こと。

コメントは「コードを日本語に直訳する」ためではなく、「なぜこの部品が存在するか」「なぜ親ではなく子で処理するか」「この props / emit がどの事故を防ぐか」を説明するために書く。

### 全コンポーネント共通のコメント必須項目

各 component ファイルの先頭に、次を必ず書く。

```js
/**
 * このコンポーネントの役割:
 * - 画面のどの部品を担当するかを書く。
 * - 親コンポーネントから何を受け取るかを書く。
 * - ユーザー操作があったとき、親へ何を知らせるかを書く。
 *
 * このコンポーネントに置かない処理:
 * - 保存、fetch、IndexedDB、localStorage、血統計算など、持たせない責務を書く。
 *
 * 分けている理由:
 * - index.html に全部書くと変更箇所が広がるため、この部品だけ見れば直せるようにする。
 */
```

`props` には「何の値か」「誰が作る値か」「なぜこの粒度で渡すか」を書く。

```js
props: {
  /**
   * row は「この行が血統表のどこにあるか」を表す設定。
   * 例: index 17 なら繁殖牝馬側の 2 行目を意味する。
   * ここには表示順や結合セルの情報だけを入れ、選択中の馬など変化する値は入れない。
   */
  row: { type: Object, required: true },

  /**
   * rowState は「今この行に表示する値」をまとめたもの。
   * 親が selected / factorName / styleFactorClasses などの大きな配列から作る。
   * 子が親の配列名を知らないようにして、後で配列構造を変えてもこの行を壊しにくくする。
   */
  rowState: { type: Object, required: true }
}
```

`emit` 直前には「子で処理せず親へ返す理由」を書く。

```js
methods: {
  selectHorse(horse) {
    // 馬を選んだ後は、血統展開、因子集計、保存など多くの処理が必要になる。
    // この部品で全部やると再利用できなくなるため、ここでは「何が選ばれたか」だけ親に伝える。
    this.$emit("horse-change", {
      index: this.row.index,
      horse
    });
  }
}
```

computed には「計算結果が画面のどこに出るか」を書く。

```js
computed: {
  /**
   * ハートボタンの見た目を決める。
   * -1: 押せる
   *  0: 押せない
   *  1: 押されている
   * 数字のままだと意味が分かりにくいので、ここで画面用の状態に読み替える。
   */
  inbreedButtonKind() {
    return this.rowState.inbreedButtonState;
  }
}
```

### コンポーネント別コメント指示

#### `app-header`

コメントで説明すること:

- 画面上部の因子数、クロス数、配合理論、リセット、配合保存ボタンをまとめる部品であること。
- ヘッダーは計算しないこと。表示する数字や class は親から受け取るだけにすること。
- リセットや配合保存を直接実行せず、親へ event を返す理由。
- PC とスマホでヘッダー構造が違う場合、どちらの表示を担当しているか。

必ず入れるコメント例:

```js
// ヘッダーは「結果を見せる場所」なので、因子数の計算はここでは行わない。
// 計算をここに置くと、血統表本体とヘッダーの両方を同時に直す必要が出るため、親から完成済みの値を受け取る。
```

#### `factor-summary-header`

コメントで説明すること:

- PC 用の横長集計表であること。
- `factorCounts` と `inbreedFactorCounts` の並び順が画面の列順と一致していること。
- 配列の index が因子コードとずれやすいので、並び順を変える時はヘッダー文字と数字を同時に確認する必要があること。

必ず入れるコメント例:

```js
// factorCounts[0] は画面では「短」の列に出る。
// 配列の 0 番目が因子コード 01 に対応するため、表示順を変える時はこの対応を崩さない。
```

#### `mobile-factor-summary`

コメントで説明すること:

- スマホ用にヘッダーを縦方向へ圧縮していること。
- PC と同じ値を使うが、画面幅の都合で行の組み方だけ変えていること。
- スクリーンショットボタンを持つ場合、保存処理自体は親か `logic/ui/screenshot.js` に渡すこと。

必ず入れるコメント例:

```js
// スマホでは横幅が足りないため、PC の表をそのまま縮めず、同じ数字を別の行配置で見せる。
// ここで数字を作り直すと PC とスマホで結果がずれるので、表示だけを担当する。
```

#### `pedigree-card`

コメントで説明すること:

- 血統表 1 枚の外枠で、種牡馬側と繁殖牝馬側のどちらにも使うこと。
- `.pedigree-card-*` の class 名はモバイル高さ調整が探しているため消してはいけないこと。
- 行そのものは `pedigree-table` に任せること。

必ず入れるコメント例:

```js
// この class は見た目だけでなく、mobile-viewport が高さ計算の目印として使う。
// 名前を変えるとスマホで血統表の高さが崩れるため、CSS を整理する時も残す。
```

#### `pedigree-table`

コメントで説明すること:

- `table_main`、`colgroup`、`tbody` をまとめるだけの部品であること。
- `rows` の順番が血統表の見た目を決めること。
- `colgroup` は PC / mobile の列幅 CSS と連動しているため、列数を変える場合は CSS も確認すること。

必ず入れるコメント例:

```js
// rows は「上から何行目に何を出すか」の完成済みリスト。
// この部品では並べ替えず、親または row-configs が作った順番をそのまま描画する。
```

#### `pedigree-row`

コメントで説明すること:

- 血統表の 1 行だけを担当すること。
- 種牡馬側か繁殖牝馬側かを内部で判断しないこと。
- root app の `selected`、`factorName`、`styleFactorClasses` を直接知らないこと。
- クリックや選択は全部 event で親へ返すこと。
- `row` は変わりにくい行定義、`rowState` は変わる表示状態、という違い。

必ず入れるコメント例:

```js
// row は「この行の形」を表す。例: 先頭に父母セルが何個あるか、馬名セルを何列分にするか。
// rowState は「この行の中身」を表す。例: 選ばれている馬、因子名、ハートボタンの状態。
// 形と中身を分けると、同じ行の部品を種牡馬側と繁殖牝馬側で使い回せる。
```

#### `pedigree-head-cells`

コメントで説明すること:

- 父・母などの左側セルだけを描画する部品であること。
- `rowspan` / `colspan` は血統表の段差を作る重要な値で、見た目だけの飾りではないこと。
- ここでは馬名や因子を扱わないこと。

必ず入れるコメント例:

```js
// rowspan と colspan は血統表の階段形状を作るための値。
// 1 つ変えるだけで下の行まで位置がずれるため、row-configs 側の定義とセットで確認する。
```

#### `horse-cell`

コメントで説明すること:

- 「馬を選ぶ表示」と「メモを入力する表示」を切り替える入口であること。
- 切り替え条件は `mode` または `dispCategory` から親が決めること。
- 馬検索の詳しい処理は `horse-autocomplete` に渡すこと。

必ず入れるコメント例:

```js
// このセルは、通常モードでは馬を選ぶ場所、メモモードでは文字を書く場所になる。
// ただし、どちらのモードかをここで勝手に決めると親の表示切替とずれるため、親から mode を受け取る。
```

#### `horse-autocomplete`

コメントで説明すること:

- PC では `v-autocomplete`、スマホでは `mobile-horse-picker` を使う橋渡しであること。
- 候補の絞り込みは `horse-search.js` に任せること。
- 選択結果だけ親へ返し、血統展開はしないこと。

必ず入れるコメント例:

```js
// PC とスマホでは入力 UI が違うが、親から見ると「馬が 1 頭選ばれた」という結果は同じ。
// そのため、この部品で UI 差分を吸収し、親へは同じ horse-change event を返す。
```

#### `mobile-horse-picker`

コメントで説明すること:

- スマホ専用の検索ダイアログであること。
- IME 入力中は文字が確定していないため、すぐ検索に使うと欠落しやすいこと。
- `compositionstart` / `compositionend` / debounce の意図。
- 選択後すぐ親処理を走らせず、dialog を閉じた後に実行する理由。

必ず入れるコメント例:

```js
// 日本語入力では、文字を打っている途中と確定後が別イベントになる。
// 入力途中の値で検索すると最後の文字が抜けることがあるため、少し待って DOM の実際の値と同期する。
```

#### `memo-cell`

コメントで説明すること:

- メモ文字列を表示・入力するだけの部品であること。
- 保存はこの部品では行わず、入力内容を親へ返すこと。
- `index` と `value` を一緒に返す理由。

必ず入れるコメント例:

```js
// メモは行ごとに保存場所が違うため、文字だけでなく「何行目のメモか」も親へ返す。
// この部品で localStorage に保存すると、保存形式を変えたい時に UI 部品まで直す必要が出る。
```

#### `generation-cell`

コメントで説明すること:

- 何代目かを表示するだけの部品であること。
- `INDEX_GENERATION_ASSIGNMENTS` 由来の値を受け取ること。
- ここで世代を計算し直さないこと。

必ず入れるコメント例:

```js
// 世代の数字は血統表全体の index から親が作る。
// この小さなセルで計算し直すと、他のセルと世代表示がずれる可能性があるため、完成済みの文字だけを表示する。
```

#### `parent-line-cell`

コメントで説明すること:

- 親系統の文字と背景 class を表示する部品であること。
- 空文字の場合も、セルの背景を保つため fallback class が必要なこと。
- 親系統の判定自体は `logic/pedigree` または親で行うこと。

必ず入れるコメント例:

```js
// 親系統が空でも、セルの色は血統表の段ごとに必要。
// 文字がないから class も消す、という作りにすると表の色分けが崩れる。
```

#### `inbreed-button-cell`

コメントで説明すること:

- ハートボタンの見た目だけを担当すること。
- `state` の `-1` / `0` / `1` の意味を必ず書くこと。
- クリック後の因子集計や保存は親で行うこと。
- PC とスマホでタグが違っても意味は同じであること。

必ず入れるコメント例:

```js
// state は小さな数字だが、画面では 3 つの意味に分かれる。
// -1 は押せる、0 は押せない、1 は押されている。
// ボタンを押した後の再計算は親の仕事なので、ここでは index だけを返す。
```

#### `factor-cells`

コメントで説明すること:

- 因子 3 枠の表示と、星付き自作馬の手動編集入口を担当すること。
- 因子名と CSS class は親で計算済みのものを受け取ること。
- 手動因子は最大 2 個で、どの列に入るかを明記すること。
- `factor-dialog` の結果をそのまま保存せず、親へ返すこと。

必ず入れるコメント例:

```js
// 手動で選べる因子は 2 つまでで、画面では 2 枠目と 3 枠目に入れる。
// 1 枠目は元の馬が持つ因子として扱うため、ここで上書きしない。
```

#### `factor-dialog`

コメントで説明すること:

- 因子を選ぶ dialog であり、血統表の行を直接変更しないこと。
- 最大 2 個までに制限する理由。
- `visible` と `update:visible` の関係。
- `confirm` で親へ選択結果を返すこと。

必ず入れるコメント例:

```js
// dialog は「選んだ結果」を返すだけにする。
// どの行に反映するかは dialog だけでは分からないため、血統表の更新は親コンポーネントに任せる。
```

#### `combination-dialog`

コメントで説明すること:

- 配合保存と復元の入口であること。
- IndexedDB を使う理由。
- 復元時は localStorage へ戻した後、親へ restore event を返して画面再読込を促すこと。
- DB version と store 名を他ファイルと合わせる必要があること。

必ず入れるコメント例:

```js
// IndexedDB は localStorage より大きなデータを保存しやすい。
// 配合履歴は増える可能性があるため、この dialog では IndexedDB を使う。
// 復元後の画面再計算は親の責務なので、ここでは restore event で知らせる。
```

### コメントの濃さの基準

次の場所は必ず細かくコメントを書く。

- 親へ event を emit する直前。
- `row` と `rowState` のように似た名前の値を扱う場所。
- `index`、`sex`、`localIndex`、`rowIndex` の変換をする場所。
- `rowspan` / `colspan` / CSS class のように、値の意味を間違えると画面が崩れる場所。
- PC とスマホで表示を分ける場所。
- IME、スクリーンショット、viewport 高さ調整など、ブラウザ固有の事情を扱う場所。
- 保存処理を子でやらず親へ返す場所。

逆に、次のような「見れば分かるだけ」のコメントは避ける。

```js
// index を代入する
const index = row.index;
```

代わりに、意図を書く。

```js
// 親へ返す index は、画面上の行番号ではなく selected 配列の位置。
// ここを間違えると別の行の馬や因子を更新してしまう。
const index = row.index;
```

## ロジック分割方針

### `logic/pedigree/row-configs.js`

`rowConfigs` と `rowConfigsBloodmare` を生成関数にする。

```js
window.Dabimas.logic.pedigree.createPedigreeRowConfigs = function (side) {
  const offset = side === "broodmare" ? 16 : 0;
  const theme = side === "broodmare" ? "Broodmare" : "Stallion";
  return baseRows.map((row) => ({
    ...row,
    index: row.localIndex + offset,
    autoClass: resolveAutoClass(row, side),
    key: `${side}-${row.localIndex}`
  }));
};
```

これにより `pedigree-row` は種牡馬側と繁殖牝馬側の差分を知らず、`row.index` と `row.headCells` だけで描画できる。

### `logic/factor/*`

移動対象:

- `factorMap` 初期化
- `manualFactorOptions`
- `dispFactorCounts`
- `fillInFactorCells`
- `applyManualFactors` の sanitize 部分

root app には Vue state への反映だけを残す。

### `logic/horses/*`

移動対象:

- `normalizeSearchText`
- `getHorseKey`
- `getHorseBaseText`
- `getHorseSearchIndexText`
- `getHorseFactorBadges`
- `filterHorse`
- `getValueByKey`

Vue コンポーネントからは `window.Dabimas.logic.horses.*` を呼ぶ。

### `logic/pedigree/pedigree-builder.js`

移動対象:

- `setDataForPedigree` の純粋変換部分
- `getCellIdQue`
- `isEven`
- `replaceHalfToFull`

最初の移行では、既存処理をほぼそのまま関数に移す。挙動変更や最適化は別 PR / 別コミットにする。

注意（JSON 分割との整合 / `feature/json-split-initial-load` 反映）:

- 現行の `onChangeMain` は `async` で、血統展開の前に `ensureHorseDetail(horseData)` を `await` して `descendants`（15 件）を確定させてから state を更新する（取得失敗時は state を変えず return）。
- `pedigree-builder.js` には「`descendants` が確定済みの馬」を入力とする純粋関数だけを置く。detail chunk の fetch / cache（`fetchHorseDetailChunk`・`ensureHorseDetail`・失敗時リトライ通知）は非同期かつ通信都合なので、root app のオーケストレーション側に残す。
- 詳細は `docs/json-split-initial-load-design.md` を参照。本ドキュメント（コンポーネント分割）と JSON 分割は別軸なので、`pedigree-builder` 抽出時に detail 取得処理まで巻き込まないこと。

### `logic/inbreed/inbreed-detector.js`

移動対象:

- `judgeInbreed`
- 例外ルール判定の helper
- `performInbreedFactorCounts` の集計ロジック

この領域は巨大で壊れやすいため、コンポーネント分割の後に移す。最初は root app に残してよい。

### `logic/theory/compatibility.js`

移動対象:

- `countCommonElements`
- `countUniqueElements`
- `compatibility`
- `dispTheory` の判定部分

Vue state への `styleThoeryClass` 代入だけ root app に残す。

### `logic/storage/*`

移動対象:

- localStorage key 定義
- `setOrRemoveLocalStorage`
- `persistManualInbreedState`
- `clearManualInbreedForIndex`
- `restoreManualInbreedState` の parse / validate 部分
- 配合保存 IndexedDB の低レベル処理

root app は保存・復元結果を Vue state に反映するだけにする。

### `logic/ui/*`

移動対象:

- `getStableViewportHeight`
- `getStableViewportWidth`
- `applyMobileViewportLayout`
- `markPedigreeStairEdges`
- screenshot 関連処理

ただし DOM class に依存するため、コンポーネント分割後も `.pedigree-card-*` の class 名を維持する。

## 移行順

### Phase 1: ファイルを増やしても挙動を変えない

- `constants/` と `logic/factor/` から開始する。
- `factorMap`、`manualFactorOptions`、因子カウントを外部化する。
- `index.html` 側は script 読み込み追加と参照差し替えだけにする。

完了条件:

- 因子数表示が変更前と一致する。
- 手動因子付与が保存、復元、インブリード因子集計に反映される。

### Phase 2: `row-configs` を生成関数化する

- `rowConfigs` と `rowConfigsBloodmare` を `createPedigreeRowConfigs("stallion")` / `createPedigreeRowConfigs("broodmare")` に置き換える。
- 行順、`headCells`、`autoClass`、`autoColspan` が変更前と一致することを確認する。

完了条件:

- PC とスマホで血統表の行数、結合セル、色分けが変更前と一致する。
- 種牡馬側、繁殖牝馬側とも同じ row config 生成ロジックを使う。

### Phase 3: `pedigree-card` / `pedigree-table` を導入する

- `v-col` から `table.table_main` までを component 化する。
- `index.html` の main 部分は `pedigree-card` 2 個だけに近づける。
- 既存の `.pedigree-card-col`、`.pedigree-card-shell`、`.pedigree-card-table-wrap` は残す。

完了条件:

- PC / mobile のスクリーンショットで、2 枚の血統表の配置が変更前と一致する。
- `applyMobileViewportLayout` が引き続き対象 DOM を取得できる。

### Phase 4: `pedigree-row` の props を整理する

- root app の配列群をそのまま渡すのをやめ、`rowState` に整形して渡す。
- root app の関数 prop 呼び出しを event emit に置き換える。
- `pedigree-row` は `selected`、`factorName`、`styleFactorClasses` などの root 配列名を知らない状態にする。

完了条件:

- `pedigree-row` の props が `row`、`rowState`、`mode`、`horseOptions`、`displayOptions` 程度に収まる。
- `pedigree-row` が `this.$parent`、root app の method、localStorage、DOM query を使わない。
- 同じ `pedigree-row` が種牡馬側と繁殖牝馬側で使われている。

### Phase 5: `common-autocomplete` を分割する

- PC 馬選択を `horse-autocomplete` へ移す。
- スマホ検索ダイアログを `mobile-horse-picker` へ移す。
- メモ表示を `memo-cell` へ移す。
- 検索・表示整形 helper を `logic/horses/` へ移す。

完了条件:

- PC の autocomplete 検索、選択、クリアが変更前と同じ。
- スマホの検索、IME 入力、候補選択、クリア、閉じるが変更前と同じ。
- メモ入力と localStorage 保存が変更前と同じ。

### Phase 6: 大きなロジックを外部化する

- `pedigree-builder.js` に血統展開処理を移す。
- `inbreed-detector.js` にインブリード判定を移す。
- `compatibility.js` に配合理論判定を移す。
- Vue state mutation と純粋計算を分ける。

完了条件:

- `onChangeMain` は「入力を受ける、（必要なら）detail を `await` で確定する、ロジック関数を呼ぶ、Vue state に反映する、保存する」という流れだけになる。detail 取得自体の実装は storage / loader 側に置き、`onChangeMain` は呼ぶだけにする。
- `judgeInbreed` 相当の判定は Vue インスタンスに依存せず、引数と戻り値でテストできる。

### Phase 7: root app を薄くする

- `app-state.js` に初期 state 作成を移す。
- `app-lifecycle.js` に mounted / beforeDestroy の処理を移す。
- `app-options.js` は Vue option object を組み立てるだけにする。
- `main.js` は `new Vue(createAppOptions())` だけに近づける。

完了条件:

- `index.html` にはアプリの HTML shell と script 読み込みだけが残る。
- root app の `methods` は orchestration 中心になり、巨大な計算ロジックを持たない。

## `pedigree-row` の再利用条件

`pedigree-row` は以下を満たしたら「使い回せる」と判断する。

- 行番号、表示テキスト、CSS class、馬候補、因子表示、インブリード状態を props で受け取る。
- ユーザー操作はすべて event emit で親へ返す。
- 種牡馬側 / 繁殖牝馬側の判定を内部に持たない。差分は `row.index`、`row.side`、`rowState` によって外から与える。
- localStorage、IndexedDB、fetch、DOM query を直接呼ばない。
- `factor-dialog` を使う場合も、確定結果は `manual-factor-update` として emit する。
- `common-autocomplete` のような複数責務の子コンポーネントに依存しない。

## index.html の最終イメージ

最終的な `index.html` の body は次の程度まで薄くする。

```html
<v-app id="app" :class="{ 'exp-mobile-layout': isCompactMobileLayout }">
  <app-header
    :factor-counts="factorNumtoString"
    :inbreed-factor-counts="inbreedFactorNumtoString"
    :category-count="categoryNumtoString"
    :disp-category="dispCategory"
    :combination-cell-style="combinationCellStyle"
    :is-capturing-screenshot="isCapturingScreenshot"
    @toggle-category="handleClick"
    @open-combinations="handleCombinationCellClick"
    @reset="initializer"
    @capture-mobile-screenshot="captureMobileScreenshot"
  ></app-header>

  <combination-dialog
    v-model="combinationDialogVisible"
    :all-horses-set="allHorsesSet"
    @restore="onCombinationRestore"
  ></combination-dialog>

  <main ref="appMain">
    <v-container fluid>
      <v-row class="mx-1" align-content="center">
        <pedigree-card side="stallion" ...></pedigree-card>
        <pedigree-card side="broodmare" ...></pedigree-card>
      </v-row>
    </v-container>
  </main>
</v-app>
```

## 検証項目

PC:

- 初期表示で 2 枚の血統表が表示される。
- 種牡馬を選択すると 16 行の血統が展開される。
- 繁殖牝馬を選択すると 16 行の血統が展開される。
- 途中セルへの選択、削除、再選択ができる。
- 因子数、クロス因子数、子系統数、配合理論表示が変更前と一致する。
- ハートボタンによる手動インブリード指定ができる。
- 星付き自作馬の手動因子編集ができる。
- 配合保存ダイアログの保存・復元ができる。
- リロード後に localStorage から復元される。
- リセットで表示と localStorage が初期化される。

スマホ:

- 初期表示でヘッダーと 2 枚の血統表が画面内に収まる。
- 馬選択ダイアログが開く。
- 日本語 IME 入力中に検索文字列が欠落しない。
- 候補選択、クリア、閉じるができる。
- スクリーンショット保存ボタンが動く。
- 回転、リサイズ、アドレスバー表示変化後も行高さが破綻しない。

ファイル・構造:

- `index.html` に UTF-8 BOM がない。
- `verify-index-exp .\index.html` が成功する（引数なしだと削除済み `index.exp.html` を探して失敗するため必ずパスを渡す）。
- `pedigree-row` の props と emits がこのドキュメントの方針に沿っている。
- root app に残るロジックが orchestration 中心になっている。

## ゴール条件

この分割は、以下をすべて満たした時点で完了とする。

- `index.html` から `pedigree-row-template`、`Vue.component("common-autocomplete")`、`Vue.component("pedigree-row")`、主要な計算ロジックが外部 JS に移っている。
- `index.html` の血統表部分が `pedigree-card` 2 個の使用に整理されている。
- `pedigree-row` が root app の配列名や method 名に依存せず、props と emits だけで動く。
- `rowConfigs` / `rowConfigsBloodmare` の重複がなくなり、共通の row config 生成関数から作られている。
- 馬検索、スマホ picker、因子セル、インブリードボタン、親系統セル、メモセルが個別コンポーネントとして分かれている。
- 因子集計、馬検索、血統展開、インブリード判定、配合理論、保存処理のいずれかが少なくとも `logic/` 配下に分離され、今後テストを書ける形になっている。
- PC とスマホの検証項目がすべて通る。
- `powershell -ExecutionPolicy Bypass -File .\scripts\codex-powershell.ps1 verify-index-exp .\index.html` が成功する。

## より効率的に分割するための補足

本筋（Phase 1〜7）は妥当だが、手戻りを減らすために次を足す。

1. すでに外に出ているものを起点にする。`vue/CombinationDialog.js` / `vue/factor-dialog.js` / `vue/combinationDB.js` は分割済みなので、`logic/storage/combination-storage.js` 等を新規に書き起こさず、これらを「移動・薄いラッパ化」する作業に置き換える。`json/inbreed-exceptions.json` も外部化済みなので、`logic/inbreed/inbreed-exceptions.js` は「JSON を読むローダ」だけにする。

2. 純粋データ・定数を最優先で出す（Phase 1 と同じ理由だが範囲を広げる）。`factor-definitions` / `pedigree-indexes` / `parent-lines` は値が変わらないため、最初に切り出しても挙動が変わらず差分が読みやすい。リスク最小で件数を稼げる。

3. `row-configs.js` の `offset = side === "broodmare" ? 16 : 0` をハードコードしない。「種牡馬 16 行 + 繁殖 16 行 = 32」という前提は `pedigree-indexes.js` の定数（1 側の行数）から導出する。`onChangeMain` の `targetIndex = id + sex * 16` と同じ「16」が複数箇所に散らばっているので、定数 1 つに寄せると後の事故を防げる。

4. 変化しないリーフセルは functional component にする。`generation-cell` / `parent-line-cell` / `pedigree-head-cells` / 表示専用の `factor-cells` は状態を持たない表示部品。Vue 2 の `functional: true` にすると、1 画面で「32 行 × 2 表 × 複数セル」のインスタンス生成と再描画が軽くなる。分割の副産物として速くなる典型例で、挙動は変わらない。

5. `rowState` を行ごとの小さなオブジェクトに分け、`:key` を安定させる。最近 `:key` 重複（種牡馬リスト）を直したコミットがある通り、この表は key 設計が弱点。1 セル変更で全行が再描画されない形にすると、操作時のもたつきが減る。`row`（変わらない形）と `rowState`（変わる中身）を分ける方針はこの最適化と相性が良い。

6. PC / ケータイの二重実装は「葉の入力 UI」だけに限定する（本文の方針通り）。`desktop-*` / `mobile-*` を作るのは autocomplete・picker・inbreed ボタンに限り、集計・判定・保存は共通ロジックへ。ここを広げると二重メンテに戻る。

7. Phase 2（`row-configs` 生成関数化）は Phase 3（card / table）より先に固める。table の `v-for` と `:key` を一度で確定でき、Phase 4 の `rowState` 整形ともつながる。

8. `rowConfigs` / `rowConfigsBloodmare` を Vue のリアクティブ管理から外す（実測可能な高速化）。現状この 2 配列は root app の `data()` に定義されているため、Vue 2 が起動時に 32 行 × `headCells` 配列まで再帰的に getter/setter 化している。行定義は起動後に変化しない値なので、Phase 2 の生成関数化のとき `Object.freeze()` した結果を返し、`data()` ではなく `created()` で非リアクティブなプロパティとして持つ（`this.rowConfigs = Object.freeze(create...)`）。初期化コストと変更検知の walk コストが両方消える。`buildHorseLists` が馬リストに `Object.freeze` を使っているのと同じ手法。

9. hot path の `console.time` / `console.log` を外部化と同時に取り除く。現行 `onChangeMain` には `console.time('setDataForPedigree')`・`console.time('クロス')` などの計測ログ、`c2` にも `console.log` が残っている。ロジックを `logic/` へ移す際にそのまま持ち込まず、デバッグフラグ（例: `window.Dabimas.debug`）で gate するか削除する。1 回あたりのコストは小さいが、選択のたびに走る経路なので分割のついでに掃除する。

10. `rowState` は side ごとの computed で配列として一括生成し、変わっていない行のオブジェクト参照を維持する工夫を入れる（補足 5 の具体化）。毎レンダーで 32 行分の `rowState` を新規オブジェクトとして作り直すと、`pedigree-row` 側の props 比較がすべて「変更あり」になり、functional 化（補足 4）の効果を打ち消す。実装は「行単位の computed 結果をキャッシュする」か、最低限「1 セル変更時に全 32 行の再描画が起きていないか Vue devtools で確認する」を Phase 4 の完了条件に加える。

11. `applyMobileViewportLayout` 相当の処理が 2 箇所にある（`common-autocomplete` 内 1342 行付近と root app 2560 行付近）。`logic/ui/mobile-viewport.js` へ移す際に 2 つの差分を確認して一本化する。重複したままだと、resize / 回転のたびに同種の DOM 計測（`getBoundingClientRect` → reflow 誘発）が二重に走り得る。

12. メモ入力（`memoChange`）は input イベントごとに `JSON.stringify(this.inputed)` + `localStorage.setItem` を実行している。`logic/storage/local-storage.js` へ移す際に短い debounce（100〜300ms）を入れると、長文メモ入力時の引っかかりを防げる。挙動変更にあたるため、入れる場合は独立コミットにする。

## 統合版（dabifaku_unified_spec_draft.md）との関係

「ダビふぁく統合版」（`docs/dabifaku_unified_spec_draft.md`）は本分割とは別軸だが、次の 2 点で本ドキュメントに依存する。

- 統合版の新規ファイル（`logic/storage/unified-db.js`、`logic/workspace-sync.js`、`components/home/*` 等）は本ドキュメントのフォルダ構成・IIFE / `window.Dabimas` 規約に従う。
- 統合版は localStorage の 6 キー（`dabimasFactor` 等）を「アクティブ作業枠のバッファ」として使うため、**localStorage キー名・保存形式・保存メソッド（`persistSelectedToStorage` / `memoChange` / `persistManualInbreedState` 等）のシグネチャを本分割で変えないこと**。`logic/storage/` の外部化（移動のみ・挙動不変）は統合版着手前に済ませると、統合版の dirty 通知挿入箇所（統合版仕様 §12.4）が安定する。

## 現行処理を一切変えずに高速表示する案（任意）

> 本ドキュメントは md の更新のみ。以下は「計算ロジックを変えずに初期表示を速くする」候補で、採用時は本分割とは別の小さな変更（`index.html` の `<head>` / `service-worker.js` / CSS / サーバ設定）になる。

まず前提: 初期ロードの軽量化（summary + detail 遅延ロード）は本ブランチ `feature/json-split-initial-load` で**実装済み**。詳細は `docs/json-split-initial-load-design.md`。

- 通常経路は `json/dabimasFactor.summary.json`（約 1.0MB）を取得し、`json/dabimasFactor.json`（約 4.8MB）は summary 取得失敗時のフォールバックのみ（`index.html` の `dbinitializer`）。
- 選択時に `dabimasFactor-details/dabimasFactor.details.NNN.json` を必要分だけ取得し、idle で先読みする。
- `buildHorseLists` で `Object.freeze` 済みのためリアクティブ変換コストも避けている。

つまり一番効く部分は済んでいる。上乗せできる、計算を変えない案:

1. リソースヒント。`index.html` の `<head>` に `<link rel="preload" as="fetch" crossorigin href="./json/dabimasFactor.summary.json">` を追加。fetch する内容は同じで、取得開始を前倒しできる（先頭 detail chunk も同様に preload 可）。

2. 転送圧縮の確認。`summary.json` 約 1.0MB は gzip/brotli で実質 1/4〜1/5。ホスティング（GitHub Pages / CDN）で JSON に圧縮が効いているか確認するだけで、処理は不変。効いていなければ事前圧縮配信を検討。

3. service worker の precache 範囲。現状 detail は runtime cache（json-split doc 指摘 C）。`summary.json` を install 時 precache（同 doc「案 B」）にすると 2 回目以降の初期表示が即時化する。表示結果は同じ。

4. `content-visibility`。画面外（スクロール下）の血統表カードに CSS `content-visibility: auto; contain-intrinsic-size: <概算>` を当てると初期レイアウト/描画が軽くなる。JS 処理は不変。ただし `applyMobileViewportLayout` の高さ計測と干渉しないか要検証（干渉するなら PC 限定で適用）。

5. 確定後に変化しない構造への `v-once`。`colgroup`・`pedigree-head-cells`・世代ラベルなど展開後に変わらない部分へ `v-once`。表示は同じで再描画だけ減る（上の「分割」補足 4・5 と重複する話）。

6. 退避経路の固定。`dabimasFactor.json`（4.8MB）を通常表示で絶対に取得しないことを回帰チェック項目に入れる。現状は通常経路が summary なので、ここが崩れないことの保証が実質的な速度維持になる。

これらは「速くする案の提示」であり、本分割（コンポーネント / ロジック分離）の完了条件には含めない。採用するなら 1 案ずつ独立 PR にし、本分割と混ぜない。

## やらないこと

- 最初の分割で Vue 3 化しない。
- 最初の分割で Vite / npm build 前提にしない。
- `judgeInbreed` の仕様変更や高速化をコンポーネント分割と同時にしない。
- CSS class 名を大きく変更しない。特にモバイル viewport 調整が参照する `.pedigree-card-*` は維持する。
- （`index.exp.html` は削除済みのため「片方だけ完成状態にしない」制約は対象外。`index.html` 単独で整合を取る。）
