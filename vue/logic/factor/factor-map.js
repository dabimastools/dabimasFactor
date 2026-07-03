/**
 * このファイルの役割:
 * - 因子名（短・速・底...）から2桁コードへ変換する Map を1つだけ作る。
 * - 元の index.html では `mounted()` から呼ばれる `c3()` の中で
 *   factorMap.set(...) を15回呼んでいたが、Promise の実行関数は
 *   new Promise() の時点で同期的に走るコードだったため、
 *   スクリプト読み込み時に作っても実行タイミングの実害はない。
 *
 * このファイルに置かない処理:
 * - 因子数の集計、セルへのCSS割り当てなど。factor-counts.js 側の仕事。
 */
(function (window) {
  window.Dabimas = window.Dabimas || {};
  window.Dabimas.logic = window.Dabimas.logic || {};
  window.Dabimas.logic.factor = window.Dabimas.logic.factor || {};

  var entries = window.Dabimas.constants.factorDefinitions.FACTOR_CODE_ENTRIES;
  var factorMap = new Map(entries);

  window.Dabimas.logic.factor.factorMap = factorMap;
})(window);
