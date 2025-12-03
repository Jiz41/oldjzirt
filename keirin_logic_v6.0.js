// ... (COEFFICIENT_SETTINGS, C_MARK_VALUES, logMessage, getPlayerData, calculateLineCoeffs, getScenarioCoeffs は省略/変更なし) ...

// バンクデータを格納するグローバル変数
let BANK_DATA = {};

// 銀行データの非同期読み込み
async function loadBankData() {
    try {
        logMessage("[INIT] bankdata.jsonの読み込みを開始します...");
        const response = await fetch('bankdata.json');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        BANK_DATA = await response.json();
        logMessage(`[SUCCESS] bankdata.jsonを正常に読み込みました。 ${Object.keys(BANK_DATA).length}件のバンクデータをロード。`);
        
        // UIのバンク名を動的に更新するための簡易的な処理（ここではログに留める）
        logMessage(`[INFO] ロードされたバンク: ${Object.keys(BANK_DATA).slice(0, 5).join(', ')}...`);
    } catch (error) {
        logMessage(`[ERROR] bankdata.jsonの読み込みに失敗しました: ${error.message}`);
        logMessage("[INFO] 計算は継続しますが、C_E係数は1.0として扱われます。");
        // データ読み込み失敗時もクラッシュしないよう、ダミーデータで初期化
        BANK_DATA = { 'ダミー': { length: 400, keirin_bias: { '先行': 1.0, '捲り': 1.0, '差し': 1.0 }, wind_or_position: {} } };
    }
}

// ページロード時にデータ読み込みを実行
(async function() {
    await loadBankData();
})();


// 3. 🛡️ メイン計算関数 (async化とC_E適用)
async function calculatePrediction() {
    // データが読み込まれているか確認
    if (Object.keys(BANK_DATA).length === 0) {
        await loadBankData(); 
        if (Object.keys(BANK_DATA).length === 0) {
            logMessage("[FATAL] バンクデータが利用できません。計算を中止します。");
            return;
        }
    }

    const raceType = document.getElementById('race-type').value;
    const settings = COEFFICIENT_SETTINGS[raceType];
    const bankName = document.getElementById('bank-name').value; // UIからバンク名を取得
    const windOrPosition = document.getElementById('wind-direction').value; // UIから特殊状況を取得
    const bankData = BANK_DATA[bankName] || BANK_DATA['ダミー']; // フェイルセーフ

    let players = getPlayerData();
    
    logMessage(`[CALC START] ${raceType} / バンク: ${bankName} / 特殊条件: ${windOrPosition} で計算開始。`);

    // --- I. C_L (ライン・連係係数) の計算 ---
    const lines = calculateLineCoeffs(players, settings);
    // ... (UIフィードバックは省略)

    // --- II. 選手固有係数 C_W, C_R, C_SB & C_E の計算 ---
    players.forEach(p => {
        // ... (C_R, C_W, C_SB, C_score_adj の計算は省略) ...
        const recentScores = p.recent.split('').map(Number);
        const avgRank = recentScores.reduce((a, b) => a + b, 0) / recentScores.length;
        p.c_recent = (1.0 + (4 - avgRank) * 0.05) * settings.RECENT_WEIGHT; 
        if (p.wmark === '◎') p.c_wmark = 1.04;
        else if (p.wmark === '〇') p.c_wmark = 1.02;
        if (p.sb1) p.c_sb1 = 1.005;
        p.c_score_adj = 1.0 + (p.score / 100 - 1) * settings.R_BIAS; 


        // ★ C_E (環境係数) の計算 (新規ロジック)
        let c_e = 1.0;
        
        // 1. バンク脚質バイアスを適用 (keirin_biasを脚質styleにマッピング)
        let biasKey = '';
        if (p.style === '自') biasKey = '先行';
        else if (p.style === '両') biasKey = '捲り'; // 両立は捲りを重視
        else if (p.style === '追') biasKey = '差し'; // 追込は差しを重視

        const keirinBias = bankData.keirin_bias[biasKey] || 1.0;
        c_e *= keirinBias;
        
        // 2. 風・特殊位置バイアスを適用 (wind_or_position)
        const positionBias = bankData.wind_or_position[windOrPosition];
        if (positionBias) {
            c_e *= positionBias;
            logMessage(`[C_E] 選手ID ${p.id}: ${windOrPosition} (${positionBias.toFixed(2)}) 補正適用。`);
        }
        
        p.c_e = c_e;
        logMessage(`[C_E] 選手ID ${p.id} (${p.style}/${biasKey}): バンク ${keirinBias.toFixed(3)} $\\times$ 条件 ${(positionBias || 1.0).toFixed(2)} = 最終 ${p.c_e.toFixed(3)} を適用。`);
    });

    // --- III. 展開別シミュレーションと最終スコア算出 ---
    // ... (計算ロジックは省略/変更なし) ...

    const scenarios = ['先行有利', '捲り有利', '差し有利'];
    const allScenarioResults = [];

    scenarios.forEach(scenario => {
        const cDCoeffs = getScenarioCoeffs(scenario);
        let scenarioPlayers = JSON.parse(JSON.stringify(players));
        
        scenarioPlayers.forEach(p => {
            const cD = cDCoeffs[p.style] || 1.0;
            
            // 最終スコア $S_{final}$ 計算
            p.final_score = p.score * p.c_score_adj * p.c_wmark * p.c_recent * p.c_sb1 * p.c_l * p.c_e * cD;
        });

        scenarioPlayers.sort((a, b) => b.final_score - a.final_score);
        allScenarioResults.push({ scenario, results: scenarioPlayers });
    });

    // --- IV. 最終結果の統合と表示 ---
    displayResults(allScenarioResults, players);
    logMessage('[CALC END] 予想計算が完了し、結果が表示されました。');
}

// ... (displayResults 関数は省略/変更なし) ...
