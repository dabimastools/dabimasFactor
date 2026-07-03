/**
 * このファイルの役割:
 * - インブリード判定の例外ルール（inbreed-exceptions.json）を fetch する。
 * - レスポンスが ok でない場合は空配列を返す（ルールなし扱い）。
 *
 * このファイルに置かない処理:
 * - 取得失敗（fetch 自体の reject・JSON parse 失敗）時のフォールバックや
 *   this.inbreedExceptions への代入。呼び出し側（root app の
 *   loadInbreedExceptions）が catch して処理する。
 */
(function (window) {
  window.Dabimas = window.Dabimas || {};
  window.Dabimas.logic = window.Dabimas.logic || {};
  window.Dabimas.logic.inbreed = window.Dabimas.logic.inbreed || {};

  window.Dabimas.logic.inbreed.loadInbreedExceptions = function () {
    return fetch('./json/inbreed-exceptions.json')
      .then(response => {
        if (!response.ok) {
          console.warn('inbreed-exceptions.json not found, using empty rules');
          return [];
        }
        return response.json();
      });
  };
})(window);
