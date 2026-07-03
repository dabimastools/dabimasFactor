// 因子（短・速・底・長・堅・難 など）に関する定数だけを置くファイル。
// 因子名から2桁コードへの変換表と、手動因子編集で選べる因子名の一覧を持つ。
(function (window) {
  window.Dabimas = window.Dabimas || {};
  window.Dabimas.constants = window.Dabimas.constants || {};

  // 因子名 → 2桁コード の対応表。
  // 元の index.html では factorMap.set(...) の羅列だったものを配列化しただけで、
  // 対応関係・並び順は変えていない。
  var FACTOR_CODE_ENTRIES = [
    ["", "00"],
    ["短", "01"],
    ["速", "02"],
    ["底", "03"],
    ["長", "04"],
    ["適", "05"],
    ["丈", "06"],
    ["早", "07"],
    ["晩", "08"],
    ["堅", "09"],
    ["難", "10"],
    ["走", "11"],
    ["中", "12"],
    ["強", "13"],
    ["雷", "14"],
  ];

  // 星付き自作馬の手動因子編集で選べる因子名（最大2個まで）。
  var MANUAL_FACTOR_OPTIONS = ["短", "速", "底", "長", "堅", "難"];

  window.Dabimas.constants.factorDefinitions = Object.freeze({
    FACTOR_CODE_ENTRIES: FACTOR_CODE_ENTRIES,
    MANUAL_FACTOR_OPTIONS: MANUAL_FACTOR_OPTIONS,
  });
})(window);
