(function(app) {
  const GAS_ENDPOINT = "https://script.google.com/macros/s/AKfycbyRy5JST_GWa5lMHnsEiCMn3nbHUghPBzUMz6HAPav8uiMTkowlAPjWSZnz6k8xUWrW/exec";

  function generateLogId() {
    return "log_" + Date.now() + "_" + Math.random().toString(36).slice(2, 7);
  }

  app.sendLog = function(raceInfo, prediction) {
    const snapshot = app.getCurrentCoefficients();
    const payload = {
      log_id: generateLogId(),
      timestamp: new Date().toISOString(),
      app_id: "真・自在律",
      race_info: raceInfo,
      snapshot: snapshot,
      prediction: prediction
    };

    fetch(GAS_ENDPOINT, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    }).catch(err => console.error("LogModule送信エラー:", err));
  };

})(App);
