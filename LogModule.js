(function(app) {
  // ログ送信は廃止（2026-10-16）。送信先URLも削除済み。
  // リプレイ台（replay/harness.mjs）が呼び出し口 app.sendLog を前提にするため、空の関数のみ残す。
  app.sendLog = function() {};
})(App);
