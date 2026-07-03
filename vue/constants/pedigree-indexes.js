// 血統表の「行位置」に関する定数だけを置くファイル。
// index.html から丸ごと移しただけで、値・並び順は一切変えていない。
(function (window) {
  window.Dabimas = window.Dabimas || {};
  window.Dabimas.constants = window.Dabimas.constants || {};

  // 種牡馬側16行＋繁殖牝馬側16行、という構造の「16」。
  // onChangeMain の targetIndex 計算や row-configs の offset 計算で
  // 同じ数字がハードコードされて散らばっていたため、ここに1本化する。
  var ROWS_PER_SIDE = 16;

  // 各 index（0〜31）が何代目（①〜⑤）かを表す表示ラベル。
  var INDEX_GENERATION_ASSIGNMENTS = [
    '①',' ②',' ③',' ③',' ④',' ④',' ④',' ④',' ⑤',' ⑤',' ⑤',' ⑤',' ⑤',' ⑤',' ⑤',' ⑤',
    '①',' ②',' ③',' ③',' ④',' ④',' ④',' ④',' ⑤',' ⑤',' ⑤',' ⑤',' ⑤',' ⑤',' ⑤',' ⑤',
  ];
  Object.freeze(INDEX_GENERATION_ASSIGNMENTS);

  // 上から①〜⑯の連番をindex番号にマッピング
  // rowConfigs の表示順: [0, 1, 2, 4, 8, 9, 5, 10, 11, 3, 6, 12, 13, 7, 14, 15]
  var INDEX_TO_ROW_NUMBER = [
    '①', '②', '③', '⑩', '④', '⑦', '⑪', '⑭', '⑤', '⑥', '⑧', '⑨', '⑫', '⑬', '⑮', '⑯',
    '①', '②', '③', '⑩', '④', '⑦', '⑪', '⑭', '⑤', '⑥', '⑧', '⑨', '⑫', '⑬', '⑮', '⑯',
  ];
  Object.freeze(INDEX_TO_ROW_NUMBER);

  window.Dabimas.constants.pedigreeIndexes = Object.freeze({
    ROWS_PER_SIDE: ROWS_PER_SIDE,
    INDEX_GENERATION_ASSIGNMENTS: INDEX_GENERATION_ASSIGNMENTS,
    INDEX_TO_ROW_NUMBER: INDEX_TO_ROW_NUMBER,
  });
})(window);
