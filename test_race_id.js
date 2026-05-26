// race_id ローカル再現テスト
// CalculationSnapshot の退避・復元・sendLog流れを完全再現する

const App = {};

// ─── keirin_logic.js の関連クロージャを最小再現 ───
(function(app) {

  let CalculationSnapshot = {};

  function resetSnapshot() {
    CalculationSnapshot = {
      race_id: "",
      bank: { straight: 0, canto: 0, alpha: 0, beta: 0, keirin_bias: {} },
      line_coop: {},
      scores: { base: {}, final: {} }
    };
  }
  resetSnapshot();

  app.getCurrentCoefficients = () => JSON.parse(JSON.stringify(CalculationSnapshot));
  app.resetSnapshot = resetSnapshot;

  app.setRaceId = function(id) {
    console.log(`  [setRaceId] 受信: "${id}" / 変更前: "${CalculationSnapshot.race_id}"`);
    CalculationSnapshot.race_id = id;
    console.log(`  [setRaceId] 変更後 CalculationSnapshot.race_id: "${CalculationSnapshot.race_id}"`);
  };

  // calculatePrediction の race_id 関連処理のみ抽出
  app.simulateCalculation = function(label) {
    console.log(`\n  [${label}] calculatePrediction 開始`);
    console.log(`  [${label}] ① 開始時 CalculationSnapshot.race_id: "${CalculationSnapshot.race_id}"`);

    const savedRaceId = CalculationSnapshot.race_id;
    console.log(`  [${label}] ② savedRaceId = "${savedRaceId}"`);

    resetSnapshot();
    console.log(`  [${label}] ③ resetSnapshot後 race_id: "${CalculationSnapshot.race_id}"`);

    CalculationSnapshot.race_id = savedRaceId;
    console.log(`  [${label}] ④ 復元後 race_id: "${CalculationSnapshot.race_id}"`);

    // sendLog直前相当
    const snapshotAtSend = app.getCurrentCoefficients();
    console.log(`  [${label}] ⑤ sendLog直前 snapshot.race_id: "${snapshotAtSend.race_id}"`);

    const raceInfoRaceId = CalculationSnapshot.race_id;
    console.log(`  [${label}] ⑥ race_info.race_id: "${raceInfoRaceId}"`);

    return snapshotAtSend;
  };

})(App);

// ─── LogModule.js の sendLog 最小再現 ───
(function(app) {

  app.sendLog = function(raceInfo, _prediction) {
    const snapshot = app.getCurrentCoefficients();
    console.log(`  [LogModule.sendLog] raceInfo.race_id: "${raceInfo.race_id}"`);
    console.log(`  [LogModule.sendLog] snapshot.race_id:  "${snapshot.race_id}"`);
    return { race_info: raceInfo, snapshot };
  };

})(App);

// ═══════════════════════════════════════════
// テスト実行
// ═══════════════════════════════════════════

console.log('=== テスト開始 ===\n');

// ── STEP 1: 1R選択 → 計算 ──
console.log('▶ STEP 1: 1Rボタン押下');
App.setRaceId('202505toride01');

App.simulateCalculation('STEP1:1R');

// sendLog呼び出し（displayResults末尾相当）
console.log('\n  [STEP1] sendLog 呼び出し:');
const result1 = App.sendLog(
  { race_id: App.getCurrentCoefficients().race_id, bank: 'toride', grade: 'a-kyu' },
  {}
);

// ── STEP 2: 2R選択 → 計算 ──
console.log('\n▶ STEP 2: 2Rボタン押下');
App.setRaceId('202505toride02');

App.simulateCalculation('STEP2:2R');

// sendLog呼び出し（displayResults末尾相当）
console.log('\n  [STEP2] sendLog 呼び出し:');
const result2 = App.sendLog(
  { race_id: App.getCurrentCoefficients().race_id, bank: 'toride', grade: 'a-kyu' },
  {}
);

// ─── 結果判定 ───
console.log('\n=== 結果判定 ===');
const r1 = result1.snapshot.race_id;
const r2 = result2.snapshot.race_id;
console.log(`STEP1 snapshot.race_id: "${r1}"`);
console.log(`STEP2 snapshot.race_id: "${r2}"`);

if (r1 === '202505toride01' && r2 === '202505toride02') {
  console.log('\n✅ PASS: 両ステップとも正しいrace_idが記録されている');
  console.log('   → JS側（keirin_logic.js）のクロージャ・退避復元処理は正常');
  console.log('   → バグの原因はGAS側（E列の参照フィールドのズレ）の可能性が高い');
} else if (r2 === r1) {
  console.log('\n❌ FAIL: STEP2のsnapshotが1Rと同一 → JS側にバグあり');
  console.log(`   r1="${r1}" r2="${r2}"`);
} else {
  console.log(`\n⚠ 予期しない結果: r1="${r1}" r2="${r2}"`);
}
