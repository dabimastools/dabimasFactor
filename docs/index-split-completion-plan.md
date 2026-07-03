# index.html 完全分割 完了計画（残タスクの段階的移行）

## 0. このドキュメントの位置づけ

`docs/index-component-logic-split-plan.md`（以下「分割計画」）の実装は 2026-07 時点で大部分が完了したが、リスク判断により以下の 3 領域が未対応のまま残っている。

1. `judgeInbreed` / インブリード判定ロジック（約 880 行）の `vue/logic/inbreed/` への外部化
2. `common-autocomplete` のコンポーネント分割（`horse-cell` / `mobile-horse-picker` / `memo-cell` 等）
3. root app（`new Vue` 約 3,240 行）の `vue/app/`（app-state / app-options / main 等）への分割

本ドキュメントは、この残り 3 領域を **リスクを最小化しながら段階的に完了させるための実装手順書** である。実装者（Sonnet 5 を想定）が単独で、各段階で動作確認をしながら移行できるレベルまで具体化する。

最終ゴールは `docs/dabifaku_unified_spec_draft.md`（統合版）の実装着手前提を整えることであり、そのために **index.html は「HTML shell + script タグ + 最小限の boot スクリプト」だけの状態（目安 350 行以下）まで薄くする**。

分割計画の設計方針（IIFE + `window.Dabimas`、コメント方針、payload 形式、CSS クラス維持）は本ドキュメントでも全て有効。矛盾する場合は本ドキュメントを優先する。

## 1. 進捗チェックリスト

実装時はこの表を更新しながら進める（1 サブステップ = 1 コミット = 検証ゲート 1 回）。

| Phase | 内容 | 状態 |
|---|---|---|
| 0-1 | 回帰ベースライン整備（スナップショット採取） | **完了**（2026-07-03。`tests/fixtures/split-baseline/README.md` 参照。S1〜S6 採取済み、S7 は★馬なし環境のためスキップ） |
| 0-2 | IME シミュレーションスクリプト整備 | **完了**（2026-07-03。`tests/fixtures/split-baseline/README.md` の「IME シミュレーション」節に基準値記録済み） |
| 1-1 | `inbreed-exceptions.js`（例外ルールローダ）外部化 | **完了**（2026-07-03。コミット `107352c`） |
| 1-2 | `inbreed-detector.js`（judgeInbreed 純関数化）＋ shadow 比較 | **完了**（2026-07-03） |
| 1-3 | shadow 比較の撤去（legacy 削除） | **完了**（2026-07-03） |
| 1-4 | `inbreed-counts.js`（クロス因子集計の純粋部分）外部化 | **完了**（2026-07-03） |
| 2-1 | `pedigree-row.js` 外部化（x-template → テンプレート文字列） | **完了**（2026-07-03） |
| 3-1 | `common-autocomplete` を無変更で `horse-cell.js` へファイル移動 | **完了**（2026-07-03） |
| 3-2 | `memo-cell.js` 分離 | **完了**（2026-07-03） |
| 3-3 | `desktop-horse-autocomplete.js` 分離 | **完了**（2026-07-03） |
| 3-4 | `mobile-horse-picker.js` 分離（★実機確認の停止ポイント） | **実装・自動検証完了。実機確認待ち**（2026-07-03） |
| 3-5 | `horse-cell` へのリネーム（任意: emit 化） | **完了**（2026-07-03。emit化は任意のため未実施） |
| 4-0 | `vue/app/` 足場＋guard スクリプト更新（★必須の先行作業） | **完了**（2026-07-03） |
| 4-1 | methods スライス: ui-viewport | **完了**（2026-07-03） |
| 4-2 | methods スライス: combination / storage | **完了**（2026-07-03） |
| 4-3 | methods スライス: horse-loading | **完了**（2026-07-03） |
| 4-4 | methods スライス: bootstrap | **完了**（2026-07-03） |
| 4-5 | methods スライス: selection | **完了**（2026-07-03） |
| 4-6 | methods スライス: inbreed-ui | **完了**（2026-07-03） |
| 4-7 | methods スライス: pedigree-cells | **完了**（2026-07-03。root app の methods 全スライス完了） |
| 4-8 | app-state.js（data 外部化） | **完了**（2026-07-03） |
| 4-9 | app-computed.js（computed / watch 外部化） | 未着手 |
| 4-10 | app-lifecycle.js（created / mounted / beforeDestroy） | 未着手 |
| 4-11 | app-options.js + main.js（new Vue の外部化） | 未着手 |
| 4-12 | boot.js（初期ローダ・SW 登録・iOS viewport）※任意 | 未着手 |
| 5-1 | service worker precache 整合＋総合検証 | 未着手 |
| 5-2 | ドキュメント更新・統合版向け対応表の確定 | 未着手 |

### 1.1 進捗ログ（中断・再開用。作業のたびに追記する）

このセクションは「使用量制限などで途中で中断した場合に、次の担当者（人間または別セッションの Sonnet 5）が § 1 の表を見なくても一目で現在地を把握できる」ことだけを目的にした短いログ。詳細は § 1 の表と各 Phase の本文、コミット履歴を参照する。

- **2026-07-03**: 作業ブランチ `feature/index-split-completion` を `feature/json-split-initial-load` から作成。Phase 0-1 / 0-2 完了（`tests/fixtures/split-baseline/` にベースライン一式をコミット）。
- **2026-07-03**: Phase 1-1 完了（`vue/logic/inbreed/inbreed-exceptions.js` 外部化、コミット `107352c`）。
- **2026-07-03**: Phase 1-2 完了（`vue/logic/inbreed/inbreed-detector.js` へ `judgeInbreed` を純関数として外部化。index.html 側に `judgeInbreedLegacy`（旧実装、逐語のまま）＋ shadow 比較付き新 `judgeInbreed` ラッパーを追加。`window.Dabimas.debug=true` で S1〜S3 を再実行し shadow mismatch 0 件を確認済み）。
- **2026-07-03**: Phase 1-3 完了（`judgeInbreedLegacy` と shadow 比較ブロックを index.html から削除。index.html が約884行減った。S1〜S3・コンソールエラー0件を確認済み）。
- **2026-07-03**: Phase 1-4 完了・Phase 1 全体完了（`vue/logic/inbreed/inbreed-counts.js` へ `performInbreedFactorCounts` のマージ・集計本体を外部化。**設計変更点**: 計画書は `buildInbreedFactorCounts(sameNameGroups, siblingGroups)` の2引数を想定していたが、実装時に確認したところ元実装は「`this.inbreedList` へマージ結果を書き込んでから配列全体（今回のマージ対象外の既存エントリ＝手動クロス等も含む）を読み直して `factorCd` を作る」という、渡された2引数だけでは再現できない依存があった。そのため関数は `(sameNameGroups, siblingGroups, inbreedList)` の3引数とし、内部で `inbreedList` の複製上にマージ結果を反映してから `factorCd` を計算する形にした（挙動は完全に維持、逐語移動原則を優先した設計判断）。末尾の `console.log(this.inbreedFactorNumtoString)` は `if (window.Dabimas.debug)` ゲート化済み（計画書許容の独立変更）。S1・S2（手動クロス押下/解除で因子数が変化するケース）がベースラインと完全一致、コンソールエラー0件を確認。
- **2026-07-03**: Phase 2-1 完了・Phase 2 全体完了（x-template `#pedigree-row-template` をテンプレート文字列化し `vue/components/pedigree/pedigree-row.js` へ移動。index.html から x-template ブロックと `Vue.component('pedigree-row', {...})` を削除、index.htmlはさらに約277行減。S1・S2がベースラインと完全一致、PC/モバイルのスクリーンショットが目視一致、子系統トグル・ハートボタンのUIクリック操作（emit経由）も正常動作を確認）。
- **2026-07-03**: Phase 3-1 完了（`Vue.component("common-autocomplete", {...})` 一式（テンプレート・props・data・computed・watch・methods・beforeDestroy、610行）を無変更で `vue/components/pedigree/horse-cell.js` へ移動。`horseListKeyCache`/`horseListKeySeq` もIIFEスコープへ一緒に移動。コンポーネント登録名は `common-autocomplete` のまま。**気づき**: preview環境の「PC」既定ビューポートは実際には約628px幅で Vuetify の `sm` ブレークポイント（モバイルレイアウト）になっていたため、真の PC（`v-autocomplete`）経路は明示的に 1280×800 にリサイズしないと検証できない。以後の Phase 3 検証では PC 確認時に明示的な width/height 指定が必要。検証: verify-index-exp OK、コンソールエラー0件、S1・S2・S4がベースラインと完全一致、**真のPC幅(1280×800)**でのv-autocomplete検索→選択（オグリキャップへ変更→祖先ツリー再構築を確認）、モバイルのIMEシミュレーション（候補80件・タップ選択・ダイアログクローズ・クエリクリア）が全てベースラインと一致することを確認。**次に着手すべきは Phase 3-2（`memo-cell.js` 分離）。**
- **2026-07-03**: Phase 3-2 完了（`common-autocomplete` の `v-else` 分岐（子系統表示＋メモ入力の `v-row`）と `getWidth` メソッドを `vue/components/pedigree/memo-cell.js` へ分離。メモ確定は `memo-change` イベントを emit し、horse-cell 側で `this.memoChange(index, $event)` を呼ぶ経路にした。検証: verify-index-exp OK、コンソールエラー0件、S1・S4（メモ）がベースラインと完全一致。`dispCategory` を奇数にして子系統＋メモ表示への切り替わりをスクリーンショットで確認、メモ欄の値・placeholder・レイアウト幅もベースラインと目視一致。UIのfill+blur/dispatchEventでは`window.event`が自動設定されずmemoChangeが発火しなかった（既知のwindow.event依存の挙動、Phase 0発見メモの通り）が、memo-cellインスタンスの`handleMemoChange`を`window.event`をセットした状態で直接呼ぶと正しくroot.memoChange→localStorage保存まで動作することを確認し、emit配線自体は正しいことを検証。**次に着手すべきは Phase 3-3（`desktop-horse-autocomplete.js` 分離）。**
- **2026-07-03**: Phase 3-3 完了（`v-autocomplete` 分岐と PC 専用ヘルパー `getHorse`/`getFactor`/`filterHorse` を `vue/components/pedigree/desktop-horse-autocomplete.js` へ分離。選択確定は `horse-change`（`{index, sex, localIndex, horse}`）を emit し、horse-cell 側で `onChange(sex, $event.localIndex, $event.horse)` を呼ぶ。`sex`/`lists`/`placeholderText` は horse-cell 側の computed のまま props で渡す設計にした（モバイル側もまだ同じ computed を使うため horse-cell に残す必要があった）。**気づき**: horse-cell.js の computed に `sex` と `placeholderText` が2重定義されていた（JS オブジェクトリテラルの仕様で後勝ちになり、前者は常に無効。前者の `sex(newValue)`/`placeholderText(newValue)` は computed が引数を受け取らない Vue の仕様上そもそも呼ばれても壊れる書き方で、恐らく過去のリファクタの残骸）。今回のスコープ外のため修正はせず記録のみ（Phase 5-2 の最終報告で改めて触れる）。検証: verify-index-exp OK、コンソールエラー0件、真のPC幅(1280×800)でv-autocomplete検索→選択が正常動作、モバイルIMEシミュレーション（候補80件）もベースライン一致。**次に着手すべきは Phase 3-4（`mobile-horse-picker.js` 分離。★実機確認の停止ポイント）。**
- **2026-07-03**: Phase 3-4 実装完了。モバイルダイアログ一式（data: mobileDialogVisible等5件、methods: clearMobileQuerySyncTimer〜isSelectedHorseの一式、computed: mobileDialogTitle/mobileDialogContextLabel/mobileCurrentSelectionLabel/mobileInputId/filteredMobileLists、horseListKeyCache/horseListKeySeq）を `vue/components/pedigree/mobile-horse-picker.js` へ分離。選択・クリアは `horse-change`（`{index, sex, localIndex, horse}`）をemit。

  **計画書からの意図的な変更点（重要）**: §7.4 は「`exp-mobile-horse-trigger` ボタンと `v-dialog` ブロック全体」を丸ごと mobile-horse-picker へ移す想定だったが、実装時に `css/mobile.css` の `.exp-mobile-autocomplete-root.inbreed > .exp-mobile-horse-trigger` 等が**直下（direct child）セレクタ**であることを発見。Vue 2 のコンポーネントは単一ルート要素が必須なため、ボタン+v-dialog の両方を新コンポーネントのルートにするには何らかの要素で包む必要があり、それをやると直下関係が崩れてクロス発生時の赤字装飾（`color: #ff1744`）が効かなくなる。そのため **v-dialog 自体を mobile-horse-picker の単一ルートにし、トリガーボタンは horse-cell 側に残して `$refs.mobilePicker.openMobileEditor()` で開く**設計に変更した。`mobileTriggerLabel`/`mobilePlaceholderText`（トリガー文言算出に必要）も horse-cell 側に残した。実機確認前に必ずこの設計変更点を把握しておくこと。

  検証: verify-index-exp OK、コンソールエラー0件。モバイル(375×812)で: S1完全一致、`.exp-mobile-autocomplete-root.inbreed .exp-mobile-horse-text` の実算出色が `rgb(255, 23, 68)`（#ff1744）であることを`preview_inspect`で確認（直下セレクタが機能している証拠）、IMEシミュレーション（候補80件・クエリ"き"）がベースライン一致、候補タップ選択・「クリア」ボタンともに動作（クリア確定は`runAfterMobileDialogClose`のrequestAnimationFrame待ちのため反映に最大600ms程度かかることがあるが、これは元実装から変わらない既存の遅延特性であり退行ではない）。真のPC幅(1280×800)でも通しでエラー0件。

  **★停止ポイント: このコミット完了後、ユーザーに実機（iPhone + flick IME）での検索動作確認を依頼し、OK が出るまで Phase 3-5 以降に進まない。** 確認してほしい操作: ダイアログを開く→flickで2文字以上入力→候補が絞り込まれる→候補タップで反映されダイアログが閉じる→クリア→閉じる。加えて、クロス発生セル（バックパサー等）のモバイル表示で馬名が赤字太字になっていることも見た目で確認してほしい（今回の設計変更点の実地検証）。
  → **2026-07-03 ユーザーより実機確認OKの回答を受領。Phase 3-5 以降へ進行可。**
- **2026-07-03**: Phase 3-5 完了・Phase 3 全体完了。コンポーネント登録名を `common-autocomplete` → `horse-cell` にリネームし、`pedigree-row.js` のテンプレートタグ（`<horse-cell>`）と各ファイルの説明コメント（`horseSelectionOptions` 含む）を現状に追随させた。任意項目（function props → event emit 化）は計画書どおり実施しなかった（本計画のゴールに影響しないため）。検証: verify-index-exp OK、コンソールエラー0件、S1・S2がベースラインと完全一致、PC/モバイルの画面表示・モバイルダイアログ開閉ともに正常動作を確認。**次に着手すべきは Phase 4-0（`vue/app/` 足場＋guard スクリプト更新。Phase 4 開始前の必須の先行作業）。**
- **2026-07-03**: Phase 4-0 完了。`scripts/codex-powershell.ps1` の `Test-GuardRules` を「index.html + vue/app/**/*.js を連結した文字列」に対して必須スニペットを検査する方式に変更（BOM/mojibake検査は対象ファイルのみのまま）。`"watch: {"` / `"methods: {"` は `"watch:"` / `"methods:"` に緩和（Phase 4 の途中で `methods: {` → `methods: Object.assign({}, window.Dabimas.app.methods, {` → 最終的に `methods: Object.assign({}, window.Dabimas.app.methods)` と形が変わるため、キー名の存在だけを見る）。AGENTS.md にもクロスファイル検査になったことを追記。

  **重大な落とし穴（要記録）**: guardスクリプトへ追加した日本語コメント入りの新コードを保存した直後、`verify-index-exp` が `The variable '$projectRoot' cannot be retrieved because it has not been set.` という一見無関係なエラーで毎回失敗するようになった。原因はコード自体のバグではなく、`codex-powershell.ps1` が UTF-8 (BOMなし) で日本語コメントを含むように変更されたため、Windows PowerShell 5.1 (`powershell.exe`、pwsh.exe ではない) がこのファイルをシステム既定コードページで読み込み、マルチバイト文字列を誤読して以降のパース位置がずれたこと。**対処**: このファイル（`.ps1`）に追加するコメントは日本語を避け英語で書く（既存の英語オンリーの規約に合わせる）ことで解消した。**今後 `scripts/*.ps1` に手を入れる際は、BOMなしUTF-8で日本語コメントを追加すると同様の現象が再発しうるので、英語コメントを使うか事前にBOM付きで保存すること。**

  index.html 側は `window.Dabimas.app = window.Dabimas.app || {}; window.Dabimas.app.methods = window.Dabimas.app.methods || {};` を boot スクリプトに追加し、root app の `methods: {` を `methods: Object.assign({}, window.Dabimas.app.methods, {` に、閉じ側の `},` を `}),` に変更（全メソッドはこの時点では全部インラインのまま）。検証: 更新後のverify-index-expがBOM仕込みファイルで失敗・スニペット欠落ファイルで失敗・vue/app配下に該当スニペットがあれば成功、という3パターンを手動テストで確認。実アプリはverify-index-exp OK、コンソールエラー0件、S1がベースラインと完全一致。**次に着手すべきは Phase 4-1（methodsスライス: ui-viewport）。**
- **2026-07-03**: Phase 4-1 完了。ビューポート計算・レイアウト固定・スクリーンショット関連17メソッド（getStableViewportHeight〜markPedigreeStairEdges、408行、モジュールスコープ定数への依存なし）を逐語コピーで `vue/app/methods/ui-viewport.js` へ外部化し、`Object.assign(window.Dabimas.app.methods, {...})` として登録。index.htmlからは該当ブロックを削除（コメント「インブリード例外ルールを読み込む」はloadInbreedExceptionsの直前コメントとして元々あった位置に残置、ui-viewport側には持っていかない：このコメントはui-viewportではなくloadInbreedExceptionsの説明だったため）。scriptタグをpedigree-card.jsの後・inline bootスクリプトの前に追加。検証: verify-index-exp OK、コンソールエラー0件、S1完全一致、モバイルで`applyMobileViewportLayout()`・画面表示・スクリーンショット撮影（html2canvas経由、PNG生成まで）が正常動作することを確認。**次に着手すべきは Phase 4-2（methodsスライス: combination / storage）。**
- **2026-07-03**: Phase 4-2 完了。配合保存ダイアログ・手動クロス永続化関連11メソッド（combinationDialog〜refreshLocalDataFromStorage、218行）を逐語コピーで `vue/app/methods/combination.js` へ外部化。モジュールスコープ定数 `MANUAL_INBREED_STORAGE_KEY`（"dabimasManualInbreed"）をIIFE先頭で再宣言。**発見メモ**: `fetchSavedCombinations`/`enforceCombinationLimit` が `COMBINATION_STORE_NAME` という index.html のどこにも宣言されていない変数を参照している（未定義参照。呼ばれればReferenceError）が、両メソッドともコードベースのどこからも呼び出されていない到達不能コードのため実害なし。逐語移動原則によりそのまま移した（修正しない）。検証: verify-index-exp OK、コンソールエラー0件、S1完全一致、手動クロス（`handleInbreedButtonClick`→`persistManualInbreedState`→`dabimasManualInbreed`保存）とリロード後の復元（`restoreInputData`/`restoreManualInbreedState`経由）が正常動作、配合保存ダイアログ（`handleCombinationCellClick`）が正常に開くことを確認。**次に着手すべきは Phase 4-3（methodsスライス: horse-loading）。**
- **2026-07-03**: Phase 4-3 完了。JSON分割ロード（summary + detail chunk）関連15メソッド（normalizeHorseSummary〜dbinitializer、389行、モジュールスコープ定数への依存なし）を逐語コピーで `vue/app/methods/horse-loading.js` へ外部化。検証: verify-index-exp OK、コンソールエラー0件、S1完全一致、Networkログで初期ロードが `dabimasFactor.summary.json` 経由であり4.8MBの `dabimasFactor.json` を取得していないことを確認、選択時のdetail chunk取得（`dabimasFactor-details/*.json`）も正常動作、メモ入力→`persistSelectedToStorage`経由のlocalStorage保存も正常動作。**次に着手すべきは Phase 4-4（methodsスライス: bootstrap）。**
- **2026-07-03**: Phase 4-4 完了。起動シーケンス・復元・リセット関連8メソッド（loadInbreedExceptions, c1, c2, c3, c4, restoreInputData, initializer, handleClick）を `vue/app/methods/bootstrap.js` へ外部化。**この回だけindex.html内で非連続**（handleInbreedButtonClick等の選択系メソッドが間に挟まっていたため）だったので、8つの範囲を個別に検証してから一括削除。モジュールスコープ定数 `factorMap`（restoreInputData用）・`MANUAL_INBREED_STORAGE_KEY`（initializer用）をIIFE先頭で再宣言。**気づき（軽微・その場で解消）**: `methods: Object.assign({}, window.Dabimas.app.methods, {` の直後にあった「// インブリード例外ルールを読み込む」コメントは、実は歴代のPhase 4-1〜4-3のたびに次の外部化で隣接メソッドが変わり続けた結果、本来説明すべき対象（loadInbreedExceptions）から浮いてしまっていた。今回loadInbreedExceptions自体を外部化するタイミングで、このコメントをbootstrap.js側のloadInbreedExceptionsの直前に付け直し、index.html側の孤立コメントは削除した（コメントのみの整理で、コードの意味は一切変えていない）。検証: verify-index-exp OK、コンソールエラー0件、S1完全一致、S4（メモ）→S5（リロード復元、メモ・選択とも正しく復元）→S6（`initializer()`によるリセット。`dabimasFactorCategory`だけクリアされない既知の挙動も含め再現）を順番に確認。**次に着手すべきは Phase 4-5（methodsスライス: selection）。**
- **2026-07-03**: Phase 4-5 完了。セル選択・削除・メモ関連9メソッド（memoChange系3つ, onChange, onChangeMain, deleteHorses, onRowInbreedToggle, onRowManualFactorUpdate, handleInbreedButtonClick）を `vue/app/methods/selection.js` へ外部化。index.html内でgetCssが間に挟まっていた（Phase 4-7候補、そのまま残置）ため2つの非連続範囲として抽出。モジュールスコープ定数 `ROWS_PER_SIDE`（onChangeMain用）をIIFE先頭で再宣言。検証: verify-index-exp OK、コンソールエラー0件、S1（基本クロス）・S2（手動クロス押下/解除）・S3（途中セル上書き・削除、categoryNumtoStringの"11"/"10"変化も含め既知のuuid巻き込み挙動を再現）・S4（メモ3種）が全てベースラインと完全一致。**次に着手すべきは Phase 4-6（methodsスライス: inbreed-ui）。**
- **2026-07-03**: Phase 4-6 完了。インブリード表示の入口4メソッド（dispInbreed, dispInbreedFactorCounts, performInbreedFactorCounts, judgeInbreed（Phase 1純関数への薄いラッパ）、102行、連続ブロック）を逐語コピーで `vue/app/methods/inbreed-ui.js` へ外部化。モジュールスコープ定数への依存なし。検証: verify-index-exp OK、コンソールエラー0件、S1・S2（手動クロス押下/解除）がベースラインと完全一致。**次に着手すべきは Phase 4-7（methodsスライス: pedigree-cells）。**
- **2026-07-03**: Phase 4-7 完了・root appのmethodsスライス全体（Phase 4-1〜4-7）完了。血統表セル反映関連13メソッド（dispTheory, applyManualFactors, dispFactorCounts, dispCategoryCount, judgeSetParentLine, fillInFactorCells, fillInParentLineCells, setFactorName, setFactorCd, setFactorCss, setParentLine, setPedigree, getCss、441行、連続ブロック＝root app methods内の最後のスライス）を逐語コピーで `vue/app/methods/pedigree-cells.js` へ外部化。モジュールスコープ定数 `factorMap` をIIFE先頭で再宣言。この結果index.html側の `methods: Object.assign({}, window.Dabimas.app.methods, {})` は空になった（全メソッドがvue/app/methods/配下の7ファイルへ移動完了）。検証: verify-index-exp OK、コンソールエラー0件、S1〜S6全シナリオ（基本クロス・手動クロス押下解除・途中セル上書き削除・メモ3種・リロード復元・リセット）が全てベースラインと完全一致、PC/モバイル画面表示・モバイルIMEシミュレーション（候補80件）・配合保存ダイアログの表示、全て正常動作を確認。index.htmlは4,611行→786行まで減少。**次に着手すべきは Phase 4-8（app-state.js。data()の外部化）。**
- **2026-07-03**: Phase 4-8 完了。`data()` の戻り値オブジェクト（105行）を `window.Dabimas.app.createInitialState()` として `vue/app/app-state.js` へ外部化。モジュールスコープ定数 `INDEX_GENERATION_ASSIGNMENTS` をIIFE先頭で再宣言。「rowConfigsをあえて宣言しない」等の非リアクティブプロパティに関する注意コメントもファイル冒頭に引き継いだ（data には追加していない）。index.html側は `data() { return window.Dabimas.app.createInitialState(); },` の3行になった。scriptタグをmethods/*.jsより前に追加。検証: verify-index-exp OK、コンソールエラー0件、S1完全一致、S6（`initializer()`によるリセット）も正常動作を確認。**次に着手すべきは Phase 4-9（app-computed.js。computed/watchの外部化）。**



### 2.1 行数と構造

`index.html` は **4,611 行**（`wc -l`。PowerShell の `Measure-Object -Line` は空行を数えないため 4,184 と表示される — 混同しないこと）。

| 行範囲（目安） | 内容 |
|---|---|
| 1–39 | head（meta、CSS リンク） |
| 40–291 | body HTML（header 52–235、main 260–289、ダイアログ配置） |
| 293–313 | 外部 script タグ（読み込み順は §3.5） |
| 316–474 | `pedigree-row-template`（x-template） |
| 476–592 | boot スクリプト（初期ローダ、SW 登録、iOS viewport、モジュールスコープ定数） |
| 615–705 | `Vue.component('pedigree-row')`（本体約 90 行、テンプレは上記 x-template） |
| 708–1345 | `Vue.component('common-autocomplete')`（約 640 行） |
| 1330–1344 | `__debugAppInstance` 宣言＋グローバルエラーハンドラ |
| 1346–4585 | root app `new Vue`（約 3,240 行） |

> **重要: 行番号は本ドキュメント作成時点の目安。各 Phase を進めるたびにずれる。実装時は必ず grep で再特定すること。**

### 2.2 root app 内部の内訳

| 行範囲（目安） | 内容 |
|---|---|
| 1350–1454 | `data()` |
| 1455–1533 | `computed`（rowState 生成系含む） |
| 1534–1541 | `watch`（dispCategory） |
| 1544–1564 | `created`（rowConfigs の非リアクティブ代入） |
| 1566–1610 | `mounted` |
| 1612–1625 | `beforeDestroy` |
| 1629–2036 | methods: viewport / スクリーンショット系（約 410 行） |
| 2037–2054 | methods: `loadInbreedExceptions` |
| 2055–2272 | methods: 配合保存ダイアログ・localStorage・手動クロス永続化 |
| 2273–2511 | methods: 起動シーケンス（c1–c4）、`restoreInputData`、`initializer` ほか |
| 2512–2904 | methods: 馬データロード（summary / detail chunk / 自家製馬 DB / 永続化） |
| 2905–2918 | methods: メモ 3 種 |
| 2919–3092 | methods: `onChange` / `onChangeMain` / `deleteHorses` |
| 3093–3263 | methods: `dispInbreed` / `dispInbreedFactorCounts` / `performInbreedFactorCounts` |
| 3266–4148 | methods: **`judgeInbreed`（約 880 行）** |
| 4149–4249 | methods: `dispTheory` / `applyManualFactors` |
| 4250–4583 | methods: 表示セル設定系（`dispFactorCounts`〜`setPedigree`） |

### 2.3 モジュールスコープの共有物（分割時の最重要注意点）

index.html のインラインスクリプト先頭（570–589 行付近）に、root app と各コンポーネントの両方から参照されるモジュールスコープ定数がある。

```js
const INDEX_GENERATION_ASSIGNMENTS = window.Dabimas.constants.pedigreeIndexes.INDEX_GENERATION_ASSIGNMENTS;
const INDEX_TO_ROW_NUMBER = window.Dabimas.constants.pedigreeIndexes.INDEX_TO_ROW_NUMBER;
const ROWS_PER_SIDE = window.Dabimas.constants.pedigreeIndexes.ROWS_PER_SIDE;
const founder = window.Dabimas.constants.parentLines.FOUNDER;
const factorMap = window.Dabimas.logic.factor.factorMap;
const manualFactorOptions = window.Dabimas.constants.factorDefinitions.MANUAL_FACTOR_OPTIONS;
const MANUAL_INBREED_STORAGE_KEY = "dabimasManualInbreed";
const horseListKeyCache = new WeakMap();   // ← :key 採番用。common-autocomplete 専用
let horseListKeySeq = 0;
```

**メソッドを外部ファイルへ移すと、これらの裸参照（`factorMap` 等）は ReferenceError になる。** 対処は「移動先 IIFE の先頭で同名 const を再宣言する」こと（§3.4）。これによりメソッド本体を一切書き換えずに移動できる。どの定数がどのメソッドから参照されているかは移動前に必ず grep で確認する。

`horseListKeyCache` / `horseListKeySeq` は common-autocomplete の `getHorseListKey` 専用なので、Phase 3-1 でコンポーネントと一緒に移動する。

### 2.4 data() に無い動的プロパティ（罠）

以下は `data()` に宣言されておらず、実行時に `this` へ直接代入される **意図的に非リアクティブ** なプロパティ。分割時に「data に足して整理」してはいけない（リアクティブ化コストが増え、挙動も変わり得る）。

- `this.rowConfigs` / `this.rowConfigsBloodmare`（created で Object.freeze 代入。doc 補足 8）
- `this.horses` / `this.horsesBase`（`buildHorseLists` 等で代入。リアクティブなのは `horseDataLists` 側）
- `this.siblingGroups`（`judgeInbreed` が代入）

### 2.5 検証に使える既存の道具

- **`window.__debugAppInstance`**: root app インスタンスがグローバル公開されている。回帰スナップショットの採取・操作の自動化はこれを使う（§4）。
- `.claude/launch.json` の `static`（`python -m http.server 8766`）。Claude Code の preview ツール（preview_start / preview_eval / preview_snapshot / preview_resize / preview_console_logs）で駆動する。
- `scripts/codex-powershell.ps1`（backup-index-exp / verify-index-exp / screenshot / dump-dom）。
- service worker は localhost でも登録される（`registerServiceWorker()` は protocol http/https で動く）。**検証時に古いキャッシュの JS が配信される罠**に注意（§3.6）。

## 3. 全 Phase 共通の実装ルール

### 3.1 作業ブランチとコミット

- 現在のブランチ（`feature/json-split-initial-load`）から作業ブランチ `feature/index-split-completion` を切って進める。
- **1 サブステップ = 1 コミット**。コミット前に該当 Phase の検証ゲート（§4.4 共通チェック＋Phase 固有チェック）を必ず通す。
- 検証が通らない場合は原因を直すか、直せなければ `git checkout -- <file>` / `git restore` で戻してやり直す。壊れた状態でコミットしない。
- コミットメッセージは `分割完了 Phase X-Y: <内容>` の形式。
- `backup-index-exp` が作る `index.bak.*.html` はコミットに含めない。

### 3.2 index.html 編集の安全規則（AGENTS.md 準拠）

- 編集前: `powershell -ExecutionPolicy Bypass -File .\scripts\codex-powershell.ps1 backup-index-exp .\index.html`
- 編集後: `powershell -ExecutionPolicy Bypass -File .\scripts\codex-powershell.ps1 verify-index-exp .\index.html`
- **引数のパスは必ず明示**（省略すると削除済み `index.exp.html` を探して失敗する）。
- 編集は精密な文字列置換（Claude Code の Edit ツール）のみ。`Set-Content` / `Out-File` / 広域 regex での全書き換えは禁止。
- UTF-8 BOM なしを維持。新規作成する `.js` ファイルも全て UTF-8 BOM なし。

### 3.3 逐語移動原則（verbatim move）

- コードの移動は **空白・改行・コメント込みでそのままコピー** する。移動とリファクタ・修正・整形を同一コミットで行わない。
- 移動中に「壊れて見えるコード」や疑問点（例: `setPedigree` 内の `this.horses` 参照が data 未宣言、`dispInbreed` の else 分岐が代入する `sameNameGroups` の形が judgeInbreed の代入形と異なる、など）を見つけても **直さずそのまま移す**。気づきはコミットメッセージ末尾に「発見メモ」として記録し、修正は本分割完了後の別コミットにする。
- 唯一の例外は「外部化に構造上必要な最小限の置換」（`this.selected` → 引数 `selected` 等）。その場合は置換対応表を本ドキュメントの該当 Phase に定義してあるので、それ以外の置換をしない。

### 3.4 IIFE + `window.Dabimas` 規約とモジュールスコープ定数の再宣言

新規ファイルは全てこの形にする。移動対象メソッドが裸参照している定数は IIFE 先頭で **同名 const として再宣言** し、メソッド本体を無変更に保つ。

```js
(function (window, Vue) {
  "use strict";
  window.Dabimas = window.Dabimas || {};
  window.Dabimas.app = window.Dabimas.app || {};
  window.Dabimas.app.methods = window.Dabimas.app.methods || {};

  // index.html のモジュールスコープにあった定数を同名で再宣言する。
  // これによりメソッド本体を 1 文字も変えずに移動できる（逐語移動原則）。
  const factorMap = window.Dabimas.logic.factor.factorMap;
  const INDEX_TO_ROW_NUMBER = window.Dabimas.constants.pedigreeIndexes.INDEX_TO_ROW_NUMBER;

  Object.assign(window.Dabimas.app.methods, {
    // ここに index.html から逐語コピーしたメソッドを置く
  });
})(window, window.Vue);
```

コンポーネントファイルは分割計画の既存規約どおり `window.Dabimas.components.Xxx` に登録し `Vue.component("xxx", Xxx)` する（`vue/components/pedigree/pedigree-card.js` が実例）。コメントは分割計画「実装コメント方針」に従う。

### 3.5 script 読み込み順

新しい script タグは **依存順** で index.html に追加する。最終形（Phase 4-11 完了時）の全体像:

```html
<script src="./vue/vue.min.js"></script>
<script src="./vue/logic/storage/combination-storage.js"></script>
<script src="./vue/CombinationDialog.js"></script>
<script src="./vue/vuetify.js"></script>
<script src="./vue/factor-dialog.js"></script>

<script src="./vue/constants/pedigree-indexes.js"></script>
<script src="./vue/constants/parent-lines.js"></script>
<script src="./vue/constants/factor-definitions.js"></script>

<script src="./vue/logic/pedigree/pedigree-css.js"></script>
<script src="./vue/logic/factor/factor-map.js"></script>
<script src="./vue/logic/factor/factor-counts.js"></script>
<script src="./vue/logic/factor/manual-factors.js"></script>
<script src="./vue/logic/pedigree/row-configs.js"></script>
<script src="./vue/logic/pedigree/pedigree-selection.js"></script>
<script src="./vue/logic/horses/horse-search.js"></script>
<script src="./vue/logic/storage/local-storage.js"></script>
<script src="./vue/logic/theory/compatibility.js"></script>
<script src="./vue/logic/pedigree/pedigree-builder.js"></script>
<script src="./vue/logic/inbreed/inbreed-exceptions.js"></script>   <!-- Phase 1-1 -->
<script src="./vue/logic/inbreed/inbreed-detector.js"></script>     <!-- Phase 1-2 -->
<script src="./vue/logic/inbreed/inbreed-counts.js"></script>       <!-- Phase 1-4 -->

<script src="./vue/components/pedigree/memo-cell.js"></script>              <!-- Phase 3-2 -->
<script src="./vue/components/pedigree/mobile-horse-picker.js"></script>    <!-- Phase 3-4 -->
<script src="./vue/components/pedigree/desktop-horse-autocomplete.js"></script> <!-- Phase 3-3 -->
<script src="./vue/components/pedigree/horse-cell.js"></script>             <!-- Phase 3-1 -->
<script src="./vue/components/pedigree/pedigree-row.js"></script>           <!-- Phase 2-1 -->
<script src="./vue/components/pedigree/pedigree-table.js"></script>
<script src="./vue/components/pedigree/pedigree-card.js"></script>

<script src="./vue/app/boot.js"></script>                <!-- Phase 4-12（任意） -->
<script src="./vue/app/app-state.js"></script>           <!-- Phase 4-8 -->
<script src="./vue/app/app-computed.js"></script>        <!-- Phase 4-9 -->
<script src="./vue/app/methods/ui-viewport.js"></script> <!-- Phase 4-1 -->
<script src="./vue/app/methods/combination.js"></script> <!-- Phase 4-2 -->
<script src="./vue/app/methods/horse-loading.js"></script> <!-- Phase 4-3 -->
<script src="./vue/app/methods/bootstrap.js"></script>   <!-- Phase 4-4 -->
<script src="./vue/app/methods/selection.js"></script>   <!-- Phase 4-5 -->
<script src="./vue/app/methods/inbreed-ui.js"></script>  <!-- Phase 4-6 -->
<script src="./vue/app/methods/pedigree-cells.js"></script> <!-- Phase 4-7 -->
<script src="./vue/app/app-lifecycle.js"></script>       <!-- Phase 4-10 -->
<script src="./vue/app/app-options.js"></script>         <!-- Phase 4-11 -->
<script src="./vue/app/main.js"></script>                <!-- Phase 4-11 -->
```

各 Phase では自分の担当ファイルのタグだけを正しい位置に挿入する。**`main.js`（および移行中はインラインの `new Vue`）より前に全ての依存が読み込まれていること**が唯一の絶対条件。

### 3.6 service worker と検証時のキャッシュ罠

- 新規 JS ファイルを追加した各コミットで、`service-worker.js` の `urlsToCache` に該当ファイルを追加し、`CACHE_NAME` を bump する（例: `dabimas-factor-v20260703-01` → `-02`）。
- **注意**: 既に外部化済みの `vue/logic/*` / `vue/components/*` / `vue/constants/*` / `vue/factor-dialog.js` / `vue/CombinationDialog.js` は現状 `urlsToCache` に入っていない（runtime cache 頼み）。Phase 5-1 で一括追加する。
- localhost 検証時、SW が古い JS を配信して「直したはずが直らない」状態になり得る。検証前に必ず以下のいずれかを行う:
  - `CACHE_NAME` が bump 済みであることを確認してから 2 回リロード（1 回目で新 SW install、2 回目で反映）
  - または preview_eval で `caches.keys().then(k => Promise.all(k.map(n => caches.delete(n))))` を実行してからリロード

### 3.7 guard スクリプト（codex-powershell.ps1）との整合

`scripts/codex-powershell.ps1` の `Test-GuardRules` は、現状 index.html に以下のスニペットが**存在すること**を要求する:

- `watch: {`
- `methods: {`
- `handleCombinationCellClick: function () {`
- `combinationDialog: function () {`
- `this.dispButtonName = value%2 === 0 ?`

**Phase 4 でこれらは index.html から消えるため、そのままでは verify が恒久的に失敗する。** Phase 4-0（§8.1）で guard スクリプトを「ファイル名ごとの必須スニペット定義」へ更新してから Phase 4 の移動を始めること。Phase 1〜3 の間はこれらのスニペットは index.html に残るので、guard は現状のままでよい。

### 3.8 統合版（dabifaku_unified_spec_draft.md）との不変条件

統合版が依存するため、本分割の全 Phase を通して以下を変えない:

- localStorage の 6 キー（`dabimasFactor` / `dabimasFactorCategory` / `dabimasMemo` / `dabimasMemoStallion` / `dabimasMemoBroodmare` / `dabimasManualInbreed`）のキー名・保存形式・保存タイミング
- 保存メソッド名とシグネチャ: `persistSelectedToStorage()` / `memoChange()` / `memoChangeStallion()` / `memoChangeBroodmare()` / `persistManualInbreedState()` / `clearManualInbreedForIndex()` / `initializer()` / `onCombinationRestore()`（統合版 §12.4 が dirty 通知 1 行をこれらの末尾に足す予定）
- `refreshLocalDataFromStorage()` / `applySavedCombination()` の復元経路
- 既存 IndexedDB `DabifacCombinationDB`（version 2）のスキーマ
- `<header ref="appHeader">` の構造（統合版がタブバーを内側に挿す）と `applyMobileViewportLayout()` の高さ計測方式
- `.pedigree-card-*` ほか mobile-viewport が参照する CSS クラス名

これらのメソッドが Phase 4 でどのファイルへ移ったかは §10 の対応表に**必ず**記録する。

## 4. Phase 0: 回帰ベースライン整備（コード変更なし）

以降の全 Phase の検証ゲートとなるベースラインを、**何も変更していない現時点の挙動から**採取する。成果物はコミットする。

### 4.1 スナップショット採取スクリプト

preview_start で `static`（port 8766）を起動し、`http://localhost:8766/index.html` を開いた状態で preview_eval により実行する。

**基準の組み合わせを決める**: 種牡馬 1 頭＋繁殖牝馬 1 頭を選んで 32 セルが埋まり、かつ **クロスが発生する**（`inbreedFactorNumtoString` が全て "00" ではなくなる）組み合わせを探す。数件試して見つけ、馬名を `tests/fixtures/split-baseline/README.md` に記録する。以後の全 Phase で同じ馬を使う。

```js
// === 選択操作（馬名は Phase 0 で決めたものに置き換える） ===
(async () => {
  const app = window.__debugAppInstance;
  const stallion = app.horseDataLists[1].find(h => h.name === "＜種牡馬名＞");
  const broodmare = app.horseDataLists[2].find(h => h.name === "＜繁殖牝馬名＞");
  await app.onChangeMain(0, 0, stallion);   // 種牡馬側 16 セル展開
  await app.onChangeMain(1, 0, broodmare);  // 繁殖牝馬側 16 セル展開
  await app.$nextTick();
  return "selected";
})()
```

```js
// === スナップショット採取（S1: 基本クロスあり） ===
(() => {
  const app = window.__debugAppInstance;
  const snap = {
    selected: app.selected.map(h => h ? h.name + "|" + (h.subName || "") : null),
    category: app.category,
    parentLines: app.parentLines,
    styleParentLineClasses: app.styleParentLineClasses,
    factorName: app.factorName,
    styleFactorClasses: app.styleFactorClasses,
    factorCd: app.factorCd,
    dispColor: app.dispColor,
    isInbreedButtonClicked: app.isInbreedButtonClicked,
    inbreedList: app.inbreedList.map(e => e ? e.name : null),
    factorNumtoString: app.factorNumtoString,
    inbreedFactorNumtoString: app.inbreedFactorNumtoString,
    categoryNumtoString: app.categoryNumtoString,
    styleThoeryClass: app.styleThoeryClass,
    sameNameGroups: app.sameNameGroups,
    siblingGroups: app.siblingGroups || null,
    sameNameSpecialChecks: app.sameNameSpecialChecks,
    sameNameSpecialChecksByIndex: app.sameNameSpecialChecksByIndex,
    localStorageKeys: {
      factor: localStorage.getItem("dabimasFactor"),
      factorCategory: localStorage.getItem("dabimasFactorCategory"),
      memo: localStorage.getItem("dabimasMemo"),
      memoStallion: localStorage.getItem("dabimasMemoStallion"),
      memoBroodmare: localStorage.getItem("dabimasMemoBroodmare"),
      manualInbreed: localStorage.getItem("dabimasManualInbreed"),
    },
  };
  return JSON.stringify(snap, null, 2);
})()
```

### 4.2 採取シナリオ

各シナリオの結果を `tests/fixtures/split-baseline/S*.json` として保存する（UTF-8 BOM なし）。

| ID | シナリオ | 手順 |
|---|---|---|
| S1 | 基本クロスあり | §4.1 の選択→スナップショット |
| S2 | 手動クロス | S1 の状態から、押下可能なハートボタン（`isInbreedButtonClicked` が -1 の index）を 1 つ `app.handleInbreedButtonClick(index)` で押す→スナップショット→もう一度押して解除→スナップショット（2 ファイル） |
| S3 | 途中セル上書き | S1 の状態から任意の途中セル（例: index 5）に別の馬を `onChangeMain` でセット→スナップショット。その後同セルを `onChangeMain(sex, id, null)` 相当（UI のクリア操作で可）で削除→スナップショット |
| S4 | メモ | S1 の状態から `app.memoChange(0, "テストメモ")`、`app.memoChangeStallion("種牡馬メモ")` →スナップショット（localStorage キー含む） |
| S5 | リロード復元 | S4 の localStorage が入った状態で `window.location.reload()` → 読み込み完了を待つ（`app.horseSummaryLoaded === true` になるまで）→スナップショット。S4 と血統・因子・クロス状態が一致すること |
| S6 | リセット | `app.initializer()` →スナップショット。全配列が初期値・localStorage 6 キーが null であること |
| S7 | 手動因子 | ★付き自作馬がリストに存在する場合のみ: ★馬をセルへ選択→`app.applyManualFactors(index, ["短", "速"])` 相当を UI 経由で実行→スナップショット。★馬が無い環境ではスキップし、README にスキップした旨を記録 |

補足:

- スナップショットは JSON 文字列の完全一致で比較する。`diff` / `git diff --no-index` を使う。
- 意図的に比較から除外するもの: `horseDetailChunks` 等のロード状態、`windowSize` / `size` 等の画面依存値（スナップショットに含めていないので自然に除外される）。
- **コンソールエラー 0 件**も各採取時に確認する（preview_console_logs の error フィルタ）。既存で出ているログ（`console.log(this.inbreedFactorNumtoString)` 等）は「エラーではない」のでベースラインとして記録しておく。
- PC（1280×800）とモバイル（375×812、preview_resize mobile）のスクリーンショットも `tests/fixtures/split-baseline/` に保存する（目視比較用。ピクセル一致までは求めない）。

### 4.3 IME シミュレーションスクリプト（Phase 3 で使用）

**背景（必読）**: ケータイ版検索には過去に IME 起因の重大バグがあった。(1) v-for の `:key` が内容ベースで重複し keyed diff が破綻（候補が更新されない・ダイアログが閉じない）、(2) iOS のサードパーティ IME（flick 等）は `compositionend` を発火しないことがある。現行実装はこれらへの対策として「`:key` は `getHorseListKey`（WeakMap によるインスタンス単位採番）」「クエリ同期は DOM 実値ベースの debounce ＋変換中 700ms フォールバック」「`isComposing === false` の input で合成フラグを自己修復」「Enter 判定は `event.isComposing` 優先・`@keydown.enter.prevent` 不使用」を実装している。**Phase 3 ではこの機構を 1 文字も変えない。**

flick を近似する検証（compositionend を発火させないまま候補が更新されるか）:

```js
// モバイル表示（preview_resize mobile）でダイアログを開いてから実行
(() => {
  const input = document.querySelector(".exp-mobile-search-input");
  if (!input) return "ERROR: dialog not open";
  input.focus();
  input.dispatchEvent(new CompositionEvent("compositionstart", { bubbles: true }));
  input.value = "き";
  input.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertCompositionText", data: "き" }));
  input.value = "きん";
  input.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertCompositionText", data: "きん" }));
  // ここで意図的に compositionend を発火しない（flick 近似）
  return "composed without compositionend";
})()
```

その後 **1 秒待って**（700ms フォールバック同期を跨ぐ）候補リストを確認:

```js
(() => ({
  candidates: document.querySelectorAll(".exp-mobile-option-btn").length,
  query: document.querySelector(".exp-mobile-search-input")?.value,
}))()
```

確認項目: 候補件数が入力に応じて絞り込まれている／候補タップで選択が反映されダイアログが閉じる／「クリア」で入力が消える。この一連の結果（候補件数）もベースラインとして README に記録する。

> このシミュレーションは実機 flick の完全再現ではない。Phase 3 に実機確認の停止ポイントを設けてある（§7）。

### 4.4 各 Phase 共通の検証ゲート

以降の全サブステップで、コミット前に次を実行する。

1. `verify-index-exp .\index.html` が成功する（Phase 4-0 以降は更新後の guard 仕様で）。
2. SW キャッシュを無効化した状態でリロードし、**コンソールエラー 0 件**。
3. S1 スナップショットを再採取し、ベースラインと **JSON 完全一致**。
4. サブステップの内容に応じた追加シナリオ（各 Phase に明記）を再採取し一致。
5. PC / モバイルのスクリーンショットを目視でベースラインと比較（配置崩れがないこと）。

## 5. Phase 1: インブリード判定の外部化

対象: `loadInbreedExceptions`（約 18 行）、`judgeInbreed`（約 880 行）、`performInbreedFactorCounts`（約 113 行）。

方針: judgeInbreed は既に **ほぼ純関数**である。`this` への参照は次の 8 種しかない（2026-07-03 時点の grep 結果）:

| 参照 | 種別 |
|---|---|
| `this.selected` | 読み取り（入力） |
| `this.inbreedExceptions` | 読み取り（入力） |
| `this.sameNameGroups` | 書き込み（出力） |
| `this.siblingGroups` | 書き込み（出力） |
| `this.sameNameSpecialChecks` | 書き込み（出力） |
| `this.sameNameSpecialChecksByIndex` | 書き込み（出力） |
| `this.dispColor`（`this.$set(this.dispColor, element, "inbreed")` 2 箇所、うち 1 つはコメントアウト） | 書き込み（出力） |
| 戻り値（クロス件数） | 出力 |

したがって「入力 2 つ→結果オブジェクト」の純関数に**機械的に**変換できる。

### 5.1 Phase 1-1: `vue/logic/inbreed/inbreed-exceptions.js`

ウォームアップ。root app の `loadInbreedExceptions`（fetch して `this.inbreedExceptions` に代入）のうち fetch 部分を `window.Dabimas.logic.inbreed.loadInbreedExceptions(): Promise<Array>` として外部化し、root 側は

```js
loadInbreedExceptions: function () {
  return window.Dabimas.logic.inbreed.loadInbreedExceptions().then((rules) => {
    this.inbreedExceptions = rules;
  });
},
```

のような「呼んで代入するだけ」にする。失敗時の挙動（現行の catch / デフォルト値）を変えないこと（移動前に現行実装を読んで合わせる）。

検証: 共通ゲート＋ S1 一致（例外ルールはクロス判定に影響するため S1 で担保される）。

### 5.2 Phase 1-2: `vue/logic/inbreed/inbreed-detector.js` ＋ shadow 比較

1. `vue/logic/inbreed/inbreed-detector.js` を作成し、`judgeInbreed` の本体を逐語コピーして次のシグネチャの純関数にする:

```js
window.Dabimas.logic.inbreed.judgeInbreed = function (selected, inbreedExceptions) {
  // ...index.html から逐語コピーした本体...
  return {
    count,                        // 旧戻り値
    sameNameGroups,
    siblingGroups,
    sameNameSpecialChecks,
    sameNameSpecialChecksByIndex,
    inbreedColorIndexes,          // 旧 this.$set(this.dispColor, element, "inbreed") の element を集めた配列
  };
};
```

置換対応表（**これ以外の変更をしない**）:

| 旧（index.html 内） | 新（inbreed-detector.js 内） |
|---|---|
| `this.selected` | 引数 `selected` |
| `this.inbreedExceptions` | 引数 `inbreedExceptions` |
| `this.sameNameGroups = X` | ローカル変数へ代入し戻り値に含める |
| `this.siblingGroups = X` | 同上 |
| `this.sameNameSpecialChecks = X` | 同上 |
| `this.sameNameSpecialChecksByIndex = X` | 同上 |
| `this.dispColor = Array.from(...)`（早期 return 分岐内） | 戻り値 `inbreedColorIndexes: []`（空）で表現 |
| `this.$set(this.dispColor, element, "inbreed")` | `inbreedColorIndexes.push(element)` |
| `return 0` / `return <count>` | `return { count: 0, ... }` / `return { count, ... }` |

注意: judgeInbreed には早期 return 分岐（片側のみ選択時）があり、そこでも出力プロパティ一式を代入している。**全ての return 経路で戻り値オブジェクトのキーが揃っている**ことを確認する。また、`sameNameGroups` は data() の初期値（オブジェクト形）と judgeInbreed が代入する値（配列形）で形が異なる。**戻り値は judgeInbreed が実際に代入している形をそのまま返す**（勝手に統一しない）。

2. root app の `judgeInbreed` を薄いラッパに置き換える。**このコミットでは旧実装を `judgeInbreedLegacy` にリネームして残し、debug 時の shadow 比較を入れる**:

```js
judgeInbreed: function () {
  // 逐語移動した純関数（vue/logic/inbreed/inbreed-detector.js）を呼ぶ。
  const result = window.Dabimas.logic.inbreed.judgeInbreed(
    this.selected,
    this.inbreedExceptions
  );

  // 移行検証用 shadow 比較: 旧実装を先に走らせて state を作らせ、
  // 純関数の結果と一致するか確認する。純関数の結果で上書きするため、
  // 最終 state は新経路のものになる。Phase 1-3 でこのブロックごと削除する。
  if (window.Dabimas.debug) {
    const legacyCount = this.judgeInbreedLegacy();
    const mismatch = [];
    if (legacyCount !== result.count) mismatch.push("count");
    if (JSON.stringify(this.sameNameGroups) !== JSON.stringify(result.sameNameGroups)) mismatch.push("sameNameGroups");
    if (JSON.stringify(this.siblingGroups) !== JSON.stringify(result.siblingGroups)) mismatch.push("siblingGroups");
    if (JSON.stringify(this.sameNameSpecialChecks) !== JSON.stringify(result.sameNameSpecialChecks)) mismatch.push("sameNameSpecialChecks");
    if (JSON.stringify(this.sameNameSpecialChecksByIndex) !== JSON.stringify(result.sameNameSpecialChecksByIndex)) mismatch.push("sameNameSpecialChecksByIndex");
    const legacyColorIndexes = this.dispColor
      .map((v, i) => (v === "inbreed" ? i : -1)).filter((i) => i >= 0);
    if (JSON.stringify(legacyColorIndexes) !== JSON.stringify(result.inbreedColorIndexes)) mismatch.push("dispColor");
    if (mismatch.length) console.error("judgeInbreed shadow mismatch:", mismatch);
  }

  // 結果を Vue state へ反映（旧実装が this へ直接代入していた分）。
  this.sameNameGroups = result.sameNameGroups;
  this.siblingGroups = result.siblingGroups;
  this.sameNameSpecialChecks = result.sameNameSpecialChecks;
  this.sameNameSpecialChecksByIndex = result.sameNameSpecialChecksByIndex;
  result.inbreedColorIndexes.forEach((index) => {
    this.$set(this.dispColor, index, "inbreed");
  });
  return result.count;
},
```

> `dispInbreed` が judgeInbreed 呼び出し前に `dispColor` を全て "" に初期化している前提はそのまま。ラッパ側で dispColor を作り直さず、`$set` で旧実装と同じ差分適用にする（早期 return 分岐だけは旧実装が `dispColor` を全 "" 代入しているので、`result.count === 0` かつ `inbreedColorIndexes` 空のときの挙動が同じになることを dispInbreed 側のコードを読んで確認する）。

検証: 共通ゲート＋ S1〜S3 一致。さらに `window.Dabimas.debug = true` にして S1〜S3 を再実行し、`judgeInbreed shadow mismatch` が **1 件も出ない**ことを確認。

### 5.3 Phase 1-3: shadow 比較の撤去

`judgeInbreedLegacy`（約 880 行）と shadow 比較ブロックを index.html から削除する。これで index.html が約 900 行減る。

検証: 共通ゲート＋ S1〜S3 一致（debug off で）。

### 5.4 Phase 1-4: `vue/logic/inbreed/inbreed-counts.js`

`performInbreedFactorCounts` の純粋部分（sameNameGroups / siblingGroups のマージ→重複除去→`factorMap` による因子コード行列生成）を外部化する:

```js
window.Dabimas.logic.inbreed.buildInbreedFactorCounts = function (sameNameGroups, siblingGroups) {
  // 逐語コピーした集計本体
  return {
    disabledIndexes,   // ボタン非活性化対象の index 配列（旧 allIndexes）
    inbreedEntries,    // 旧 this.inbreedList[element.index] = element の (index, element) ペア配列
    factorCd,          // 32×3 の因子コード行列
  };
};
```

root 側の `performInbreedFactorCounts` は結果を受けて `this.$set(this.isInbreedButtonClicked, ...)`、`this.inbreedList` 反映、`this.inbreedFactorNumtoString = this.dispFactorCounts(factorCd)` を行うだけにする。`factorMap` は inbreed-counts.js の IIFE 先頭で再宣言する（§3.4）。

末尾の `console.log(this.inbreedFactorNumtoString)` はこのコミットで `if (window.Dabimas.debug)` ゲートに変更してよい（分割計画・補足 9 の適用。独立した 1 行変更なのでコミットメッセージに明記）。

検証: 共通ゲート＋ S1・S2 一致（S2 は手動クロス経由の集計を通る）。

## 6. Phase 2: `pedigree-row` の外部ファイル化

対象: x-template `#pedigree-row-template`（316–474 行付近）と `Vue.component('pedigree-row')`（615–705 行付近）。コンポーネント自体は既に props + emit のみで完結しており（分割計画 Phase 4 済み）、残作業は **ファイル移動と x-template → テンプレート文字列変換だけ**。

手順:

1. 移動前に x-template 内にバッククォート（`` ` ``）と `${` が含まれないことを grep で確認する（含まれる場合はエスケープが必要。2026-07 時点では含まれない見込み）。
2. `vue/components/pedigree/pedigree-row.js` を作成。`template: '#pedigree-row-template'` を、x-template の中身（`<script type="text/x-template">` タグ自体は除く）を逐語コピーしたテンプレートリテラルに置き換える。
3. index.html から x-template ブロックとコンポーネント定義を削除し、script タグを `pedigree-table.js` の**前**に挿入する。
4. `service-worker.js` の `urlsToCache` に追加、`CACHE_NAME` bump。

検証: 共通ゲート＋ S1〜S3。PC / モバイル両方のスクリーンショット比較（血統表の階段形状・結合セル・色分け・ハートボタン・因子ボタンの見た目）。ハートボタン押下（S2）と子系統トグル（`dispCategory` 切替→メモ表示に変わる）を UI クリックで確認。

## 7. Phase 3: `common-autocomplete` の分割

**この Phase が最もリスクが高い。** §4.3 冒頭の背景を読み、次の不変条件を全サブステップで守る。

### 7.0 IME まわりの不変条件（変更禁止リスト）

1. v-for の `:key` は `getHorseListKey`（WeakMap + 連番でインスタンス単位に採番）を使う。内容ベースの `getHorseKey` を `:key` に使ってはいけない（重複 key で keyed diff が破綻した前歴がある）。`getHorseKey` は `isSelectedHorse` の内容比較用として残す。
2. `syncMobileQueryFromDom`（DOM 実値ベースの debounce 同期）、変換中 700ms フォールバック、`scheduleMobileQuerySync` の遅延値を変えない。
3. `onMobileSearchInput` 内の「`isComposing === false` の input で合成フラグを自己修復する」ロジックを変えない。
4. Enter 判定は `event.isComposing` を優先する現行実装のまま。`@keydown.enter.prevent` を導入しない（prevent は IME の変換確定 Enter をブロックする）。
5. 検索 input は手動 `:value` バインド。v-model に書き換えない（composing ガードの挙動が変わる）。
6. `runAfterMobileDialogClose`（選択後にダイアログを閉じてから親処理を走らせる遅延実行）の仕組みを変えない。
7. テンプレート内の CSS クラス名（`exp-mobile-*`）を変えない。

### 7.1 Phase 3-1: 無変更のファイル移動

`Vue.component("common-autocomplete", {...})` 全体（テンプレート文字列・props・data・computed・watch・methods・beforeDestroy）を **一切変更せず** `vue/components/pedigree/horse-cell.js` へ移動する。

- コンポーネント登録名は当面 `common-autocomplete` の**まま**にする（pedigree-row.js のテンプレート参照を変えないため）。ファイル名だけ先に最終形にしておく。
- モジュールスコープの `horseListKeyCache` / `horseListKeySeq`（および直前の説明コメント 4 行）も一緒に移動し、IIFE スコープに置く。
- script タグは `pedigree-row.js` の**前**に挿入。
- `urlsToCache` 追加＋ `CACHE_NAME` bump。

検証: 共通ゲート＋ S1〜S4。PC: autocomplete で検索→選択→クリア→再選択。モバイル: ダイアログ開閉・検索・候補タップ・クリア・§4.3 の IME シミュレーション一式。**推奨**: このコミット後にユーザーへ実機確認（iPhone + flick）を一度依頼する（依頼して返答を待つ間、次の Phase に進んでよい。3-4 の停止ポイントとは異なり必須ではない）。

### 7.2 Phase 3-2: `memo-cell.js` 分離

`common-autocomplete` テンプレートの `v-else` 分岐（`v-row` + 子系統表示 `v-text-field` + メモ入力 `v-text-field`）と `getWidth` メソッドを `memo-cell` コンポーネントへ移す。

- props: `index`, `category`, `inputed`（当面は親と同じ配列受け渡しでよい。逐語移動優先）。
- メモ確定は `memo-change` を emit し、horse-cell 側で `this.memoChange(index, $event)` を呼ぶ（function prop の呼び出し位置が horse-cell に残るだけで、root への経路は不変）。
- `getWidth` は memo-cell だけが使うことを grep で確認してから移す。

検証: 共通ゲート＋ S4（メモ入力→ localStorage `dabimasMemo` 反映）＋子系統トグルで表示が切り替わること（PC / モバイル両方）。

### 7.3 Phase 3-3: `desktop-horse-autocomplete.js` 分離

`v-autocomplete` 分岐と PC 専用ヘルパー（`getHorse`, `getFactor`, `filterHorse` ラッパ）を `desktop-horse-autocomplete` へ移す。

- 選択確定は `horse-change` を emit する。payload は分割計画の合意形式 `{ index, sex, localIndex, horse }`（`localIndex = index - sex * 16`）。horse-cell 側で受けて既存どおり `this.onChange(sex, localIndex, horse)` を呼ぶ。
- モバイル分岐・IME 系コードには**触れない**。

検証: 共通ゲート＋ PC の検索・選択・クリア・途中セル上書き（S3）。モバイル側がデグレしていないこと（S1 をモバイル表示でも一巡）。

### 7.4 Phase 3-4: `mobile-horse-picker.js` 分離（★停止ポイント）

モバイルダイアログ一式を `mobile-horse-picker` へ移す。移動対象の境界（2026-07 時点の名前。実装時に grep で再確認）:

- テンプレート: `exp-mobile-horse-trigger` ボタンと `v-dialog` ブロック全体
- data: `mobileDialogVisible`, `mobileQueryInput`, `mobileQuery`, `mobileSearchCompositionActive`, `mobileQuerySyncTimer`
- methods: `clearMobileQuerySyncTimer`, `resetMobileQuery`, `getMobileInputValue`, `syncMobileQueryFromDom`, `scheduleMobileQuerySync`, `runAfterMobileDialogClose`, `openMobileEditor`, `closeMobileEditor`, `clearMobileHorse`, `selectMobileHorse`, `onMobileSearchInput`, `onMobileSearchEnter`, `onMobileCompositionStart`, `onMobileCompositionEnd`, `clearMobileQuery`, `selectFirstMobileHorse`, `isSelectedHorse`, `getHorseListKey`
- computed: `mobilePlaceholderText`, `mobileDialogTitle`, `mobileDialogContextLabel`, `mobileTriggerLabel`, `mobileCurrentSelectionLabel`, `mobileInputId`, `filteredMobileLists`
- beforeDestroy の `clearMobileQuerySyncTimer()` 呼び出し
- `horseListKeyCache` / `horseListKeySeq`（horse-cell.js から mobile-horse-picker.js のIIFEスコープへ移す）

horse-cell 側は `isMobileLayout` で `mobile-horse-picker` と `desktop-horse-autocomplete` を出し分けるだけになる。選択確定・クリアは desktop と同じ `horse-change` payload で emit する。

`normalizeSearchText` / `getHorseKey` / `getHorseBaseText` / `getHorseFactorBadges` 等は `window.Dabimas.logic.horses.*` の薄いラッパなので、必要なコンポーネントごとに同じラッパを持ってよい（重複を嫌って共有モジュール化するより、逐語移動を優先）。

検証: 共通ゲート＋ S1〜S4 をモバイル表示で一巡＋ §4.3 IME シミュレーション（候補件数がベースラインと一致、候補タップで反映＋ダイアログが閉じる、クリア動作）＋回転・リサイズ後の行高さ（preview_resize で幅変更）。

**★停止ポイント: このコミット完了後、ユーザーに実機（iPhone + flick IME）での検索動作確認を依頼し、OK が出るまで Phase 3-5 以降に進まない。** 依頼文には「確認してほしい操作: ダイアログを開く→flick で 2 文字以上入力→候補が絞り込まれる→候補タップで反映されダイアログが閉じる→クリア→閉じる」を明記する。

### 7.5 Phase 3-5: `horse-cell` へのリネーム

1. コンポーネント登録名を `common-autocomplete` → `horse-cell` に変更し、`pedigree-row.js` テンプレートのタグと属性名を追随させる。
2. root app の computed `horseSelectionOptions` のコメント（「Phase5 で分割予定」等の記述）を現状に合わせて更新する。
3. （任意・独立コミット）horse-cell → root の function props（`onChange` / `memoChange`）を event emit に置き換える。**やる場合は** pedigree-row の emit 中継（`horse-change` / `memo-change`）→ pedigree-table → pedigree-card → root の既存 event 経路に合わせる。やらなくても本計画のゴールには影響しない（統合版は localStorage バッファ経由で本体と結合するため、この内部インターフェースに依存しない）。

検証: 共通ゲート＋ S1〜S4（PC / モバイル）。

## 8. Phase 4: root app の分割

残る root app（data / computed / watch / lifecycle / methods 約 2,900 行）を `vue/app/` へ移す。**全サブステップが同じ機械的操作**（メソッド群の逐語移動）なので、リスクはスライスを小さく保つことと §2.3 / §2.4 の罠回避に集約される。

### 8.1 Phase 4-0: 足場と guard スクリプト更新（先にやること）

1. **guard スクリプト更新**: `scripts/codex-powershell.ps1` の `Test-GuardRules` を「ファイル名ごとの必須スニペット定義」に変更する。要件:
   - BOM / mojibake / CRLF 検査は渡されたファイルすべてに適用（現行のまま）。
   - 必須スニペット検査はファイル名で分岐する。例:

```powershell
$requiredSnippetsByFile = @{
  "index.html" = @('id="app"', 'vue/app/');   # shell と script 読み込みが残っていること
  "app-options.js" = @("watch: {", "methods:");
  "combination.js" = @(
    "handleCombinationCellClick: function () {",
    "combinationDialog: function () {"
  );
  "app-computed.js" = @("this.dispButtonName = value%2 === 0 ?");
}
```

   - ただし **Phase 4 の移行中はスニペットがまだ index.html にある**ため、「必須スニペットは `index.html` と `vue/app/**/*.js` を連結した文字列に対して検査する」実装にすると移行中も常に成功する。こちらを推奨。
   - 更新後、`verify-index-exp .\index.html` が現状の index.html で成功すること、BOM を仕込んだテンポラリファイルで失敗することを確認する。
2. **AGENTS.md 更新**: 検査対象に `vue/app/**/*.js` が加わったこと、`verify-index-exp` の必須スニペットが横断検査になったことを追記。
3. **足場**: `vue/app/` を作り、空の `window.Dabimas.app.methods = {}` を定義する最初のグループファイル（Phase 4-1 の `ui-viewport.js`）を追加する準備として、index.html の root app を次のように変える:

```js
// 変更前
methods: {
  ...全メソッド...
},

// 変更後
methods: Object.assign({}, window.Dabimas.app.methods, {
  ...全メソッド（この時点では全部インラインのまま）...
}),
```

以降のスライスは「インライン側からメソッドを削除し、グループファイルの `Object.assign(window.Dabimas.app.methods, {...})` へ逐語移動する」だけになる。メソッドは最終的に同一の options オブジェクトへマージされるため、`this` の束縛・相互呼び出し（`this.xxx()`）は一切変わらない。

検証: 共通ゲート＋ S1（この時点で挙動変化は無いはず）。

### 8.2 Phase 4-1〜4-7: methods のスライス移動

各スライスで: グループファイル新規作成→ script タグ挿入（§3.5 の位置）→対象メソッドを逐語移動→ IIFE 先頭に必要なモジュールスコープ定数を再宣言（§3.4。**移動したメソッド本体を grep して裸参照定数を洗い出す**）→ `urlsToCache` 追加＋ `CACHE_NAME` bump →検証→コミット。

| スライス | ファイル | 対象メソッド（2026-07 時点の名前。grep で再確認） | 追加検証 |
|---|---|---|---|
| 4-1 | `vue/app/methods/ui-viewport.js` | `getStableViewportHeight`, `getStableViewportWidth`, `buildScreenshotFileName`, `canvasToPngBlob`, `downloadScreenshotBlob`, `saveScreenshotBlob`, `loadHtml2Canvas`, `captureMobileScreenshot`, `clearMobileViewportGeometryTimer`, `isEditableElement`, `shouldForceResetMobileViewportLock`, `clearMobileViewportLayoutTimers`, `queueMobileViewportLayoutRetry`, `scheduleInitialMobileViewportLayout`, `refreshMobileViewportLock`, `applyMobileViewportLayout`, `markPedigreeStairEdges` | モバイル表示で血統表が画面内に収まる／リサイズ後に行高さが再計算される／スクリーンショットボタンが動く（ダウンロード発火まで） |
| 4-2 | `vue/app/methods/combination.js` | `combinationDialog`, `handleCombinationCellClick`, `onCombinationRestore`, `fetchSavedCombinations`, `enforceCombinationLimit`, `applySavedCombination`, `setOrRemoveLocalStorage`, `persistManualInbreedState`, `clearManualInbreedForIndex`, `restoreManualInbreedState`, `refreshLocalDataFromStorage` | 配合保存ダイアログの保存・一覧・復元／S2（手動クロス永続化）／S5（リロード復元） |
| 4-3 | `vue/app/methods/horse-loading.js` | `normalizeHorseSummary`, `buildHorseLists`, `fetchHorseDetailChunk`, `hydrateHorseWithDetail`, `findSummaryHorse`, `ensureHorseDetail`, `prefetchHorseDetails`, `ensureCustomHorseDb`, `getCustomHorseDetail`, `loadCustomHorseDetails`, `stripHorseForStorage`, `serializeSelectedForStorage`, `persistSelectedToStorage`, `notifyHorseDetailError`, `dbinitializer` | 初期ロードが summary 経由であること（Network タブで `dabimasFactor.json` 4.8MB を取得**しない**）／選択時に detail chunk 取得／S1 |
| 4-4 | `vue/app/methods/bootstrap.js` | `c1`, `c2`, `c3`, `c4`, `restoreInputData`, `initializer`, `loadInbreedExceptions`（Phase 1-1 のラッパ）, `handleClick` | S5（リロード復元）／S6（リセット） |
| 4-5 | `vue/app/methods/selection.js` | `memoChange`, `memoChangeStallion`, `memoChangeBroodmare`, `onChange`, `onChangeMain`, `deleteHorses`, `onRowInbreedToggle`, `onRowManualFactorUpdate`, `handleInbreedButtonClick` | S1〜S4 全部 |
| 4-6 | `vue/app/methods/inbreed-ui.js` | `dispInbreed`, `dispInbreedFactorCounts`, `performInbreedFactorCounts`, `judgeInbreed`（Phase 1 のラッパ） | S1・S2 |
| 4-7 | `vue/app/methods/pedigree-cells.js` | `dispTheory`, `applyManualFactors`, `dispFactorCounts`, `dispCategoryCount`, `judgeSetParentLine`, `fillInFactorCells`, `fillInParentLineCells`, `setFactorName`, `setFactorCd`, `setFactorCss`, `setParentLine`, `setPedigree`, `getCss` | S1（因子・親系統・理論表示）／S7（実施していれば） |

グループ割りは目安であり、相互参照の都合で 1〜2 個のメソッドを隣のスライスへ動かしてよい（メソッドは全て同じ `methods` にマージされるため技術的制約はない）。動かした場合は §10 の対応表を更新する。

### 8.3 Phase 4-8: `vue/app/app-state.js`

`data()` の戻り値オブジェクトを `window.Dabimas.app.createInitialState()` として外部化し、index.html 側は `data() { return window.Dabimas.app.createInitialState(); }` にする。

- `INDEX_GENERATION_ASSIGNMENTS` が data に入っている現状もそのまま維持（app-state.js の IIFE 先頭で再宣言して参照）。
- **`rowConfigs` / `horses` / `siblingGroups` 等の非リアクティブプロパティを data に追加しない**（§2.4）。
- data() 冒頭の「rowConfigs をあえて宣言しない」コメントも一緒に移す。

検証: 共通ゲート＋ S1・S6。

### 8.4 Phase 4-9: `vue/app/app-computed.js`

computed（`rowConfigsOptimized` 〜 `rowDisplayOptions`）と watch（`dispCategory`）を `window.Dabimas.app.computed` / `window.Dabimas.app.watch` として外部化。index.html 側は `computed: window.Dabimas.app.computed, watch: window.Dabimas.app.watch,` にする。

検証: 共通ゲート＋ S1＋子系統トグル（watch の `dispButtonName` 切替とモバイル高さ再計算）。

### 8.5 Phase 4-10: `vue/app/app-lifecycle.js`

`created` / `mounted` / `beforeDestroy` を `window.Dabimas.app.lifecycle = { created, mounted, beforeDestroy }` として外部化。

- mounted 内の `scheduleInitialLoaderHide()`（2 箇所）は index.html の boot スクリプトのモジュールスコープ関数を参照している。**このままでは外部ファイルから見えない**ので、boot スクリプト側に `window.Dabimas.boot = { scheduleInitialLoaderHide };` を追加し、mounted 側の呼び出しを `window.Dabimas.boot.scheduleInitialLoaderHide()` に置換する（逐語移動の例外。この 2 箇所のみ）。
- created の rowConfigs 非リアクティブ代入・コメントはそのまま移す。

検証: 共通ゲート＋初期表示（ローディングオーバーレイが消えること）＋回転／リサイズハンドラ（preview_resize 後に高さ再計算）。

### 8.6 Phase 4-11: `app-options.js` + `main.js`

1. `vue/app/app-options.js`: options オブジェクトの組み立てだけを行う。

```js
(function (window, Vue) {
  "use strict";
  window.Dabimas = window.Dabimas || {};
  window.Dabimas.app = window.Dabimas.app || {};

  window.Dabimas.app.createAppOptions = function () {
    return {
      el: "#app",
      vuetify: new Vuetify(),
      data() { return window.Dabimas.app.createInitialState(); },
      computed: window.Dabimas.app.computed,
      watch: window.Dabimas.app.watch,
      created: window.Dabimas.app.lifecycle.created,
      mounted: window.Dabimas.app.lifecycle.mounted,
      beforeDestroy: window.Dabimas.app.lifecycle.beforeDestroy,
      methods: Object.assign({}, window.Dabimas.app.methods),
    };
  };
})(window, window.Vue);
```

2. `vue/app/main.js`: `new Vue` と `__debugAppInstance`、グローバルエラーハンドラ（`unhandledrejection` 等、1330–1344 行付近）を移す。`var __debugAppInstance` は `window.__debugAppInstance` への明示代入に変える（検証ハーネスが `window.__debugAppInstance` を参照するため互換）。

```js
(function (window, Vue) {
  "use strict";
  // ...エラーハンドラ（逐語移動、__debugAppInstance → window.__debugAppInstance に置換）...
  window.__debugAppInstance = new Vue(window.Dabimas.app.createAppOptions());
})(window, window.Vue);
```

3. index.html から `new Vue({...})` を含むインラインスクリプトの該当部を削除し、`app-options.js` / `main.js` の script タグを末尾に追加。
4. guard スクリプトの必須スニペット定義を最終配置に合わせて見直す（§8.1 の横断検査ならそのままで通る）。

検証: 共通ゲート＋ S1〜S6 全シナリオ（PC / モバイル）＋配合保存・復元＋スクリーンショット目視。**この時点が Phase 4 の総合検証ポイント。**

### 8.7 Phase 4-12（任意）: `vue/app/boot.js`

index.html に残る boot スクリプト（初期ローダ、SW 登録、iOS viewport 調整、`window.Dabimas.boot` 公開）を `vue/app/boot.js` に移す。初期ローダは load イベント／タイマー駆動なので同期 `<script src>` でも等価だが、**ローダの見え方（表示時間）に差が出ないか**をリロード 5 回程度の目視で確認する。差が気になる場合はこのステップをスキップしてよい（boot スクリプトは 120 行程度で、残しても最終ゴールを損なわない）。

### 8.8 Phase 4 完了時の index.html 最終イメージ

- head（meta / CSS リンク）
- body: `<v-app id="app">` 配下の HTML shell（header / main / pedigree-card ×2 / ダイアログ）
- script タグ列（§3.5）
- （4-12 実施なら）インラインスクリプトなし／（未実施なら）boot スクリプトのみ

目安 300〜350 行。`text/x-template`、`Vue.component`、`new Vue`、計算ロジックは一切含まない。

## 9. Phase 5: 仕上げ

### 9.1 Phase 5-1: service worker precache 整合＋総合検証

1. `urlsToCache` に `vue/` 配下の**全**配信ファイル（constants / logic / components / app / factor-dialog.js / CombinationDialog.js / combination-storage.js）が入っていることを棚卸しする（`Glob vue/**/*.js` と突き合わせ。`vue/combinationDB.js` のような dead code は配信対象外なので入れない。dead code が残っていれば削除は別コミットで提案）。
2. `CACHE_NAME` を bump。
3. 総合検証:
   - S1〜S7 全シナリオ（PC / モバイル）
   - §4.3 IME シミュレーション
   - オフライン動作: 一度オンラインで全読み込み→ DevTools 相当でオフライン化（preview では SW の fetch ハンドラ経由の確認が難しければ、`caches.match` で全 script が hit することを preview_eval で確認する）
   - 分割計画「検証項目」章（PC 10 項目・スマホ 6 項目・ファイル構造 4 項目）を一巡
   - `json/dabimasFactor.json`（4.8MB）が通常経路で取得されないこと（Network 一覧）

### 9.2 Phase 5-2: ドキュメント更新

1. `docs/index-component-logic-split-plan.md` の冒頭に「本計画の残タスクは `index-split-completion-plan.md` により完了（日付）」の追記。
2. 本ドキュメントの進捗チェックリスト（§1）と対応表（§10）を最終状態に更新。
3. **ユーザーへの最終報告**に含めること: index.html の最終行数、実機確認済み項目、統合版着手の前提（§3.8）が全て維持されている旨、発見メモ（逐語移動中に見つけた疑わしいコードの一覧と推奨対応）。

## 10. 統合版が参照するメソッドの所在対応表（実装時に更新）

統合版仕様 §12.4 は以下のメソッド末尾に dirty 通知を挿入する。**Phase 4 完了時点の実際の所在を必ずここへ反映すること**（統合版実装者はこの表だけを見て挿入箇所を特定できる状態にする）。

| メソッド | 移動先（計画） | 移動先（実績） |
|---|---|---|
| `persistSelectedToStorage()` | `vue/app/methods/horse-loading.js` | |
| `memoChange()` | `vue/app/methods/selection.js` | |
| `memoChangeStallion()` | `vue/app/methods/selection.js` | |
| `memoChangeBroodmare()` | `vue/app/methods/selection.js` | |
| `persistManualInbreedState()` | `vue/app/methods/combination.js` | |
| `clearManualInbreedForIndex()` | `vue/app/methods/combination.js` | |
| `initializer()` | `vue/app/methods/bootstrap.js` | |
| `onCombinationRestore()` | `vue/app/methods/combination.js` | |
| （参考）`refreshLocalDataFromStorage()` | `vue/app/methods/combination.js` | |
| （参考）`applySavedCombination()` | `vue/app/methods/combination.js` | |

## 11. やらないこと（本計画のスコープ外）

- Vue 3 化・Vite / npm build 化・ES module 化
- `judgeInbreed` の仕様変更・高速化・リファクタ（移動のみ）
- IME / composition まわりの挙動変更（§7.0）
- CSS クラス名の変更（特に `.pedigree-card-*`、`exp-mobile-*`）
- localStorage 6 キーと保存メソッドのシグネチャ変更（§3.8）
- `DabifacCombinationDB` のスキーマ / version 変更
- メモ保存の debounce 化などの挙動改善（分割計画・補足 12。やるなら分割完了後に独立コミット）
- 逐語移動中に見つけた疑わしいコードの修正（発見メモに記録して後回し）

## 12. 中断・再開時の手引き

- 各サブステップは独立して完結し、**どのコミット時点でもアプリは完全に動作する**。中断・再開はコミット境界で行う。
- 再開時は §1 のチェックリストを見て次のサブステップを特定し、対象コードの現在位置を grep で再特定してから着手する（行番号は信用しない）。
- ベースライン（`tests/fixtures/split-baseline/`）は Phase 0 から変えない。もし途中で「ベースライン自体の間違い」を見つけた場合は、修正理由を README に記録した上で**全シナリオを再採取**し、それ以前のコミットに遡って再検証はしない（以後のゲートにのみ適用）。
