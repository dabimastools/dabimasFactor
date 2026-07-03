/**
 * このファイルの役割:
 * - root app（new Vue）に渡すオプションオブジェクトを1つだけ組み立てる
 *   （window.Dabimas.app.createAppOptions）。
 * - data / computed / watch / created / mounted / beforeDestroy / methods
 *   は、Phase 4 の各サブフェーズで外部化された window.Dabimas.app.* を
 *   そのまま束ねるだけで、ここでは新しいロジックを持たない。
 *
 * このファイルに置かない処理:
 * - new Vue(...) の実行そのもの（vue/app/main.js の仕事）。
 * - data / computed / watch / lifecycle / methods の中身
 *   （vue/app/app-state.js, app-computed.js, app-lifecycle.js,
 *   methods/*.js の仕事）。
 *
 * 分けている理由:
 * - index.html に new Vue({...}) を直接書くと、この束ね方自体を
 *   変えたいとき（例: 統合版で el や components を追加する）に
 *   index.html を編集する必要が出る。ここに切り出しておくことで、
 *   束ね方の変更がこのファイルだけで完結する
 *   （docs/index-split-completion-plan.md Phase 4-11）。
 */
(function (window, Vue) {
  window.Dabimas = window.Dabimas || {};
  window.Dabimas.app = window.Dabimas.app || {};

  window.Dabimas.app.createAppOptions = function () {
    return {
      el: "#app",
      vuetify: new Vuetify(),

      data() {
        return window.Dabimas.app.createInitialState();
      },
      computed: window.Dabimas.app.computed,
      watch: window.Dabimas.app.watch,

      created: window.Dabimas.app.lifecycle.created,
      mounted: window.Dabimas.app.lifecycle.mounted,
      beforeDestroy: window.Dabimas.app.lifecycle.beforeDestroy,

      methods: Object.assign({}, window.Dabimas.app.methods),
    };
  };
})(window, window.Vue);
