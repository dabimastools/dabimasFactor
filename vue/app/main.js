/**
 * このファイルの役割:
 * - root app（new Vue）を実際に生成するエントリポイント。
 * - 実機デバッグ用のグローバルエラーハンドラ（error / unhandledrejection）
 *   を登録し、window.__debugAppInstance.notifyHorseDetailError に
 *   橋渡しする。
 *
 * このファイルに置かない処理:
 * - オプションオブジェクトの組み立て（vue/app/app-options.js の仕事）。
 *
 * 分けている理由:
 * - index.html に new Vue({...}) を直接書くと変更箇所が広がるため、
 *   起動そのものだけをここにまとめる
 *   （docs/index-split-completion-plan.md Phase 4-11）。
 */
(function (window, Vue) {
  // 実機デバッグ用の一時計測: 通常は捕まえていない例外/rejectionも
  // 画面上部の赤いメッセージ欄（horseDetailError）に出して、devtoolsが無い
  // 端末でも原因文言を直接読めるようにする。
  window.addEventListener("error", function (event) {
    if (window.__debugAppInstance && typeof window.__debugAppInstance.notifyHorseDetailError === "function") {
      window.__debugAppInstance.notifyHorseDetailError(
        "DEBUG error: " + (event.message || "unknown") + " @ " + (event.filename || "") + ":" + (event.lineno || "")
      );
    }
  });
  window.addEventListener("unhandledrejection", function (event) {
    if (window.__debugAppInstance && typeof window.__debugAppInstance.notifyHorseDetailError === "function") {
      var reason = event.reason;
      var msg = reason && reason.message ? reason.message : String(reason);
      window.__debugAppInstance.notifyHorseDetailError("DEBUG rejection: " + msg);
    }
  });
  // Vueが自前で捕まえて握りつぶす系（コンポーネントのメソッド/ライフサイクル/
  // レンダー内の同期例外）は上の window "error" では拾えないため、
  // Vue.config.errorHandler からも同じ通知先へ橋渡しする。
  Vue.config.errorHandler = function (err, vm, info) {
    console.error(err);
    if (window.__debugAppInstance && typeof window.__debugAppInstance.notifyHorseDetailError === "function") {
      window.__debugAppInstance.notifyHorseDetailError(
        "DEBUG vue-error: " + (err && err.message ? err.message : String(err)) + (info ? " @ " + info : "")
      );
    }
  };

  window.__debugAppInstance = new Vue(window.Dabimas.app.createAppOptions());
})(window, window.Vue);
