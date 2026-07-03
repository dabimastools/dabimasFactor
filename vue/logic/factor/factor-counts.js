/**
 * このファイルの役割:
 * - 因子コードの二次元配列から「因子ごとの合計本数」を数える処理。
 * - 1セル分の因子コードから、そのセルに付けるCSSクラス文字列を作る処理。
 * - どちらも root app の Vue state を直接読み書きしない純粋関数。
 *
 * このファイルに置かない処理:
 * - Vue state（factorNumtoString 等）への代入は root app 側で行う。
 *   ここでは計算結果を返すだけにする。
 */
(function (window) {
  window.Dabimas = window.Dabimas || {};
  window.Dabimas.logic = window.Dabimas.logic || {};
  window.Dabimas.logic.factor = window.Dabimas.logic.factor || {};

  // 因子コードの二次元配列（32行 × 3列）から、因子01〜14それぞれの
  // 合計本数を数えて "00"〜"99" の文字列14個の配列にする。
  function dispFactorCounts(factorCdArray) {
    var count = {};
    for (var i = 0; i < factorCdArray.length; i++) {
      for (var j = 0; j < factorCdArray[i].length; j++) {
        var elm = factorCdArray[i][j];
        count[elm] = (count[elm] || 0) + 1;
      }
    }

    var factorNumtoString = Array.from(new Array(14).fill("00"));
    for (var k = 0; k < factorNumtoString.length; k++) {
      var ret = ("00" + (k + 1)).slice(-2);
      if (count[ret]) {
        factorNumtoString[k] = ("00" + count[ret]).slice(-2);
      } else {
        factorNumtoString[k] = "00";
      }
    }
    return factorNumtoString;
  }

  // 1セル分の因子コードから、そのセルの表示CSSクラスを作る。
  // "00"（因子なし）のときは行位置ごとの既定色（pedigree-css.js）にフォールバックする。
  function fillInFactorCells(str, cellId) {
    if (str == "00") {
      return window.Dabimas.logic.pedigree.getCss(cellId) + " styleFactorClassMain";
    }
    return "f" + str + " styleFactorClassMain";
  }

  window.Dabimas.logic.factor.dispFactorCounts = dispFactorCounts;
  window.Dabimas.logic.factor.fillInFactorCells = fillInFactorCells;
})(window);
