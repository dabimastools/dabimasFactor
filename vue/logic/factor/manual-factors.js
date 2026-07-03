/**
 * このファイルの役割:
 * - 星付き自作馬向けの手動因子編集で、ダイアログから返ってきた値を
 *   「有効な因子名のみ・重複なし・最大2個・足りない分は空文字で埋める」形に整える。
 * - この結果を Vue state（factorName / factorCd / styleFactorClasses 等）に
 *   反映する処理は root app 側に残す（ここでは配列を返すだけ）。
 *
 * このファイルに置かない処理:
 * - Vue state への反映、localStorage への保存。
 */
(function (window) {
  window.Dabimas = window.Dabimas || {};
  window.Dabimas.logic = window.Dabimas.logic || {};
  window.Dabimas.logic.factor = window.Dabimas.logic.factor || {};

  // 手動で選べる因子は最大2つ。画面では2枠目・3枠目に入れる（1枠目は元の馬の因子のまま）。
  function sanitizeManualFactors(factors) {
    var manualFactorOptions =
      window.Dabimas.constants.factorDefinitions.MANUAL_FACTOR_OPTIONS;
    var picked = Array.isArray(factors) ? factors : [];
    var normalized = [];
    picked.forEach(function (value) {
      var text = typeof value === "string" ? value.trim() : "";
      if (
        text &&
        manualFactorOptions.indexOf(text) !== -1 &&
        normalized.indexOf(text) === -1
      ) {
        normalized.push(text);
      }
    });

    var sanitized = normalized.slice(0, 2);
    while (sanitized.length < 2) {
      sanitized.push("");
    }
    return sanitized;
  }

  window.Dabimas.logic.factor.sanitizeManualFactors = sanitizeManualFactors;
})(window);
