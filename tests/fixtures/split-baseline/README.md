# 回帰ベースライン（Phase 0）

`docs/index-split-completion-plan.md` §4 に基づく回帰ベースライン。以降の全 Phase はここに記録したシナリオ・数値と一致することを検証ゲートとする。

## 基準の組み合わせ

- 種牡馬: `ダッシャーゴーゴー`（`horseDataLists[1]` の name 完全一致で取得）
- 繁殖牝馬: `シル`（`horseDataLists[2]` の name 完全一致で取得）
- 選択手順は §4.1 のスクリプトどおり（`onChangeMain(0,0,stallion)` → `onChangeMain(1,0,broodmare)`）。
- この組み合わせは 32 セル全展開後にクロスが発生する（`inbreedFactorNumtoString` の index1・index4 が `"01"`、`バックパサー` の同名交配が index13/17 で検出される）。

## スナップショット形式について（分割計画からの実務上の変更点）

`docs/index-split-completion-plan.md` §4.1 のスクリプト例は `localStorageKeys` として `dabimasFactor` / `dabimasFactorCategory` の生の JSON 文字列全体を含める想定だが、これは 32 セル分の馬データを含むため 1 スナップショットあたり数千〜1 万文字になる。エージェント作業用の会話コンテキストを圧迫するため、本実装では以下のように変更した:

- `dabimasFactor` / `dabimasFactorCategory` は生文字列の代わりに `{ length, hash }`（FNV-1a 32bit）のフィンガープリントを保存する（`localStorageFingerprint` フィールド）。
- `dabimasMemo` / `dabimasMemoStallion` / `dabimasMemoBroodmare` / `dabimasManualInbreed` は元々小さいので生文字列のまま保存する。
- 比較時は「フィンガープリントの完全一致」をもって「生文字列が完全一致するはず」の代替根拠とする（FNV-1a の衝突は本用途では無視できるレベル）。

フィンガープリント計算用のヘルパー（ブラウザの devtools / preview_eval で毎回再定義して使う）:

```js
window.__fnv1a = function (str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16);
};
window.__lsFingerprint = function (k) {
  const v = localStorage.getItem(k);
  return v === null ? null : { length: v.length, hash: window.__fnv1a(v) };
};
window.__captureSnapshot = function () {
  const app = window.__debugAppInstance;
  return {
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
    localStorageFingerprint: {
      factor: window.__lsFingerprint("dabimasFactor"),
      factorCategory: window.__lsFingerprint("dabimasFactorCategory"),
      memo: localStorage.getItem("dabimasMemo"),
      memoStallion: localStorage.getItem("dabimasMemoStallion"),
      memoBroodmare: localStorage.getItem("dabimasMemoBroodmare"),
      manualInbreed: localStorage.getItem("dabimasManualInbreed"),
    },
  };
};
```

比較は `JSON.stringify(window.__captureSnapshot())` を対応する `S*.json` と突き合わせる（要 `JSON.parse` して再 stringify するか、キー順を合わせて比較する）。

## スクリーンショットについて（分割計画からの実務上の変更点）

`preview_screenshot` ツールはインライン画像を返すのみで、ファイルパスへの保存手段を提供しない。そのため PC/モバイルのスクリーンショットは PNG としてこのフォルダにコミットしていない。代わりに、各 Phase の検証ゲートのたびに `preview_screenshot`（PC: リサイズ無し / モバイル: `preview_resize mobile`）でその場でキャプチャし、直前に確認した内容（本 README に記載する見た目の要点）と目視比較する運用とする。

Phase 0 時点の PC 画面: 血統表（ダッシャーゴーゴー×シル）が正しく階段状に表示され、`バックパサー` の行にハートアイコン（クロス検出）が表示され、右上「クロス」行の index1・4 が "01" になっている。子系統バッジ（Ns/Na/Ne/St/He/To/Ro/Ma/Ec 等）が各セル右側に表示されている。

Phase 0 時点のモバイル画面（375×812）: 同内容が 1 カラムの縦長レイアウトで表示され、`バックパサー` 行がハイライトされている。

## S1〜S7 シナリオ結果

| ID | 内容 | ファイル |
|---|---|---|
| S1 | 基本クロスあり（ダッシャーゴーゴー×シル） | `S1.json` |
| S2 | 手動クロス（index5 を押下） | `S2_pressed.json`（押下後） / `S2_released.json`（解除後、`S1.json` と完全一致） |
| S3 | 途中セル上書き（index5 をオグリキャップに変更→削除） | `S3_overwritten.json` / `S3_cleared.json` |
| S4 | メモ入力（index0 に「テストメモ」、種牡馬メモに「種牡馬メモ」） | `S4.json` |
| S5 | リロード復元（S4 の localStorage が入った状態でリロード） | `S5.json`（`S4.json` と完全一致） |
| S6 | リセット（`initializer()`） | `S6.json` |
| S7 | 手動因子（★付き自作馬） | **スキップ**。この環境の `horseDataLists[0]` に `nature` へ `★` を含む自作馬が 0 件のため実施不可。 |

コンソールエラー: 各シナリオ実行後 `preview_console_logs({level:"error"})` で 0 件を確認済み（通常ログ・`console.log(this.inbreedFactorNumtoString)` 等の既存出力は許容）。

## 発見メモ（既存の挙動。分割では直さずそのまま維持する）

1. **`onChangeMain` は同一 `uuid` を共有する側全体を巻き込んで消去する。**
   `onChangeMain(sex, id, horseData)` は、対象セルの現在値が `uuid` を持つ場合 `this.deleteHorses(sex, id)` を先に呼ぶ。`deleteHorses` は同じ `uuid` を持つ全エントリを削除するため、ルート選択（`onChangeMain(0,0,stallion)`）由来で 0〜15 が同一 `uuid` を共有していると、途中セル（例: index5）を書き換えただけで **stallion 側 0〜15 全体が null になる**（新しくセットしたセルとその祖先だけが再構築される）。S3 のスナップショットはこの挙動をそのまま記録している。バグの疑いはあるが、分割計画のスコープ外（§11「やらないこと」）としてそのまま維持する。
2. **`initializer()`（リセット）は `dabimasFactorCategory` を消さない。**
   `initializer()` は `dabimasFactor` / `dabimasMemo` / `dabimasMemoStallion` / `dabimasMemoBroodmare` / `dabimasManualInbreed` の 5 キーを `removeItem` するが `dabimasFactorCategory` は対象外。S6 ではリセット後も `dabimasFactorCategory` が直前の値のまま残ることを確認済み（`localStorageFingerprint.factorCategory` が null にならない）。分割計画 §3.8 の「localStorage の 6 キー」という記述とは実際の挙動が食い違うが、これは分割前から存在する既存挙動であり、分割時に「直す」対象ではない。
3. **`memoChange(index, input)` の第二引数 `input` は使われず、グローバルの `event.target.value` を読む。**
   実際の UI（`@change="memoChange(index, $event)"`）ではブラウザが `window.event` を同期的にセットするため問題なく動作するが、コンソール等から `app.memoChange(0, "テキスト")` と直接呼ぶと `event is not defined` 相当のエラーになる（`window.event` が未設定のため）。本ベースライン採取では `window.event = { target: { value: "..." } }` を一時的にセットしてから呼び出すことで回避した（S4）。Phase 4-5 で `memoChange` を `vue/app/methods/selection.js` へ逐語移動する際もこの参照はそのまま移す（直さない）。

## IME シミュレーション（Phase 3 で使用する基準値）

`docs/index-split-completion-plan.md` §4.3 の手順をモバイル表示（375×812）・index1（サクラバクシンオーのセル）で実施。

1. `.exp-mobile-horse-trigger` をクリックしてダイアログを開く。
2. `compositionstart` → `input(き)` → `input(きん)` を発火（`compositionend` は発火しない＝flick 近似）。
3. 1 秒待機後:
   - `document.querySelectorAll(".exp-mobile-option-btn").length` → **80**（候補リストの表示上限件数と一致。全件ではなく絞り込み結果の先頭 80 件が表示される仕様）
   - 検索欄の実 DOM 値は `"き"` に戻っていた（2 文字目の合成中断分は `isComposing` が実ブラウザの flick と異なり synthetic `InputEvent` では既定で `false` になるため、自己修復ロジックが早期に確定させたと推測される。分割計画 §4.3 が明記するとおりこのシミュレーションは実機 flick の完全再現ではない）。
   - コンポーネント内部状態（`mobileQuery` / `mobileQueryInput`）も `"き"` で一致。
4. 候補の 1 件目（`アグネスタキオン`）をタップ → `app.selected[1].name` が `"アグネスタキオン"` に変化し選択が反映される。数百 ms 後 `mobileDialogVisible` が `false` に戻り `mobileQuery` が `""` にクリアされる（ダイアログが閉じ、クエリがリセットされることを確認）。DOM 上の `.exp-mobile-search-input` はトランジション中しばらく残る（Vuetify の閉じアニメーションによる遅延であり、論理的な `mobileDialogVisible` は即座に `false` になっている）。

この一連の候補件数（80）・クリア/クローズ挙動を Phase 3 各サブステップ後の回帰基準とする。

## 検証後の状態復元

本 README 作成時点で preview サーバー上のアプリ状態は S1 相当（ダッシャーゴーゴー×シル選択、メモなし）に復元済み。次の作業者は改めて選択し直す必要はないが、`localStorage` の内容は複数回のシナリオ実行で上書きされているため、**S1 と完全一致させたい場合は `app.initializer()` 後に §4.1 の選択手順を再実行すること**。
