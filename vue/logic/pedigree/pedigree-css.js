/**
 * このファイルの役割:
 * - 血統表の index 番号から、どの色テーマ（AliceBlue / SalmonPink / omoshiro / migoto / horse）
 *   を使うかを決めるだけの純粋関数を置く。
 * - Vue の state やコンポーネントには触らない。index を渡したら文字列を返すだけ。
 *
 * このファイルに置かない処理:
 * - 因子の集計や血統展開、保存処理。
 *
 * 分けている理由:
 * - root app のメソッドと pedigree-row の prop 経由の両方から呼ばれており、
 *   計算内容は同じなので1箇所にまとめてズレを防ぐ。
 */
(function (window) {
  window.Dabimas = window.Dabimas || {};
  window.Dabimas.logic = window.Dabimas.logic || {};
  window.Dabimas.logic.pedigree = window.Dabimas.logic.pedigree || {};

  function getCss(i) {
    var css = "";
    switch (i) {
      case 0:
        css = "factor_AliceBlue";
        break;
      // （+ 16）は牝馬のほう
      case 0 + 16:
        css = "factor_SalmonPink";
        break;
      // （+ 16）は牝馬のほう
      case 1:
      case 3:
      case 5:
      case 7:
      case 1 + 16:
      case 3 + 16:
      case 5 + 16:
      case 7 + 16:
        css = "factor_omoshiro";
        break;
      case 9:
      case 11:
      case 13:
      case 15:
        css = "factor_migoto";
        break;
      default:
        css = "factor_horse";
        break;
    }
    return css;
  }

  window.Dabimas.logic.pedigree.getCss = getCss;
})(window);
