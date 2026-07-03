/**
 * このコンポーネントの役割:
 * - table.table_main / colgroup / tbody をまとめるだけの部品。
 * - rows（rowConfigs または rowConfigsBloodmare）を親から受け取り、
 *   1行ずつ pedigree-row として描画する。
 * - rows 以外の props（因子表示・選択状態・各種コールバック等、pedigree-row が
 *   必要とする値）はここでは名前を知らず、$attrs 経由でそのまま pedigree-row へ渡す。
 *
 * このコンポーネントに置かない処理:
 * - 行の並び替え。rows の順番は親（pedigree-card）または row-configs.js が
 *   作った完成済みの順番をそのまま描画する。
 * - 血統計算、保存処理、因子集計。
 *
 * 分けている理由:
 * - 元の index.html では colgroup と tbody の中身（列幅CSSと結び付いた構造）が
 *   種牡馬側・繁殖牝馬側でほぼ丸ごと重複していたため、1つにまとめる。
 */
(function (window, Vue) {
  window.Dabimas = window.Dabimas || {};
  window.Dabimas.components = window.Dabimas.components || {};

  var PedigreeTable = {
    name: "pedigree-table",
    // rows/rowStates 以外の属性（horseOptions・displayOptions等）は、この部品自身の
    // ルート要素（table）には付けず、$attrs / $listeners として下の pedigree-row にだけ渡す。
    inheritAttrs: false,
    props: {
      /**
       * rows は「上から何行目に何を出すか」の完成済みリスト
       * （vue/logic/pedigree/row-configs.js の createPedigreeRowConfigs の戻り値）。
       * この部品では並べ替えず、そのまま描画する。
       */
      rows: { type: Array, required: true },
      /**
       * rowStates は rows と同じ順番・同じ長さで並ぶ「各行の中身」の配列
       * （vue/logic/pedigree/pedigree-selection.js の buildRowStates の戻り値）。
       */
      rowStates: { type: Array, required: true },
    },
    template: `
      <table class="table_main">
        <colgroup>
          <col class="exp-mobile-label-col" />
          <col class="exp-mobile-label-col" />
          <col class="exp-mobile-label-col" />
          <col class="exp-mobile-label-col" />
          <col class="exp-mobile-horse-col" />
          <col class="exp-mobile-generation-col" />
          <col class="exp-mobile-parentline-col" />
          <col class="exp-mobile-inbreed-col" />
          <col class="exp-mobile-factor-col" />
          <col class="exp-mobile-factor-col" />
          <col class="exp-mobile-factor-col" />
        </colgroup>
        <tbody>
          <!-- 最適化: rowsは変更されないためv-onceの代わりにキーを使用 -->
          <tr
            is="pedigree-row"
            v-for="(config, idx) in rows"
            :key="config.index"
            :row="config"
            :row-state="rowStates[idx]"
            v-bind="$attrs"
            v-on="$listeners"
          ></tr>
        </tbody>
      </table>
    `,
  };

  window.Dabimas.components.PedigreeTable = PedigreeTable;
  Vue.component("pedigree-table", PedigreeTable);
})(window, window.Vue);
