// --- 華耀天輪 真・自在律 V6.0 ロジック ---

// 1. 🗃️ 係数設定オブジェクトの分離 (ロジック分離)
const COEFFICIENT_SETTINGS = {
    's-kyu': { R_BIAS: 1.15, RECENT_WEIGHT: 0.90, COOP_WEIGHT: 1.20, IS_GIRLS: false },
    'a-kyu': { R_BIAS: 1.00, RECENT_WEIGHT: 1.00, COOP_WEIGHT: 1.00, IS_GIRLS: false },
    'a-chal': { R_BIAS: 0.90, RECENT_WEIGHT: 1.20, COOP_WEIGHT: 0.80, IS_GIRLS: false },
    'girls': { R_BIAS: 1.00, RECENT_WEIGHT: 1.10, COOP_WEIGHT: 1.00, IS_GIRLS: true },
};

// ガールズエースマーク係数の具体的な値
const C_MARK_VALUES = {
    HIGH: 1.12,  // R >= 105.00
    MEDIUM: 1.08, // 102.00 <= R < 105.00
    LOW: 1.03   // R < 102.00
};

// --- CORE FUNCTIONS ---

// ロギング関数
function logMessage(message) {
    const logArea = document.getElementById('debug-log');
    const timestamp = new Date().toLocaleTimeString('ja-JP', { hour12: false });
    logArea.innerHTML += `[${timestamp}] ${message}<br>`;
    logArea.scrollTop = logArea.scrollHeight;
}

// プレイヤーデータをDOMから取得
function getPlayerData() {
    // 選手ID 1から7のデータを取得
    const players = [];
    for (let id = 1; id <= 7; id++) {
        const row = document.querySelector(`input[data-id="${id}"]`)?.closest('tr');
        if (!row) continue;

        players.push({
            id: id,
            score: parseFloat(row.querySelector(`.score`).value) || 0,
            style: row.cells[1].querySelector('select').value,
            wmark: row.querySelector(`.wmark`).value.trim(),
            recent: row.querySelector(`.recent`).value.trim(),
            sb1: row.querySelector(`.sb1`).checked,
            // 係数初期値
            c_score_adj: 1.0, c_recent: 1.0, c_wmark: 1.0, c_sb1: 1.0, c_l: 1.0, c_e: 1.0,
            final_score: 0
        });
    }
    return players;
}

// 2. 🛡️ フェイルセーフなライン解析とC_L計算 (クラッシュ対策最優先)
function calculateLineCoeffs(players, settings) {
    const lineInput = document.getElementById('line-input').value;
    const lines = []; // 連係メンバーの配列
    let aceMarkPlayers = new Set(); // C_markが適用される選手ID

    // --- (A) ライン解析とフェイルセーフ ---
    if (lineInput && lineInput.includes(',')) {
        // 並び入力 (例: 123,45,67) を解析
        lineInput.split(',').forEach(lineStr => {
            const members = lineStr.split('').map(Number);
            if (members.length >= 2) {
                lines.push(members);
            }
        });
    }
    
    // --- (B) C_L係数計算の分岐 ---

    // 1. 🚴‍♀️ ガールズ競輪の場合 (C_markロジック)
    if (settings.IS_GIRLS) {
        logMessage(`[C_L] ガールズ競輪モード。エースマーク係数 $C_{mark}$ を評価。`);
        
        // エースの特定 (最高得点選手)
        const ace = players.reduce((max, p) => (p.score > max.score ? p : max), { score: -Infinity });
        
        lines.forEach(line => {
            // エースがこのラインの先頭か2番手以降にいるかを確認
            const aceIndex = line.indexOf(ace.id);
            if (aceIndex !== -1 && aceIndex < line.length - 1) {
                // エースの直後にいる選手 (マーク選手)
                const markerId = line[aceIndex + 1];
                aceMarkPlayers.add(markerId);
            }
        });

        // C_mark値の決定
        let cMarkValue = 1.0;
        if (ace.score >= 105.0) cMarkValue = C_MARK_VALUES.HIGH;
        else if (ace.score >= 102.0) cMarkValue = C_MARK_VALUES.MEDIUM;
        else cMarkValue = C_MARK_VALUES.LOW;
        
        // 選手ごとにC_Lを適用
        players.forEach(p => {
            if (aceMarkPlayers.has(p.id)) {
                p.c_l = cMarkValue;
                logMessage(`[C_L] 選手ID ${p.id} に $C_{mark}=${cMarkValue.toFixed(3)}$ を適用 (エースマーク)。`);
            } else if (lines.some(l => l.includes(p.id))) {
                // C_mark対象外でも、連係には僅かなボーナス (1.005)
                p.c_l = 1.005; 
            }
        });

    } 
    // 2. 🚴‍♂️ 一般競輪の場合 (C_coopロジック)
    else {
        logMessage(`[C_L] 一般競輪 (${settings.R_BIAS.toFixed(2)}) モード。ライン結束力係数 $C_{coop}$ を評価。`);
        
        const coopWeight = settings.COOP_WEIGHT; // 級班別重み
        
        lines.forEach(line => {
            // 2番手 (マーク選手): 重み付けされた標準ボーナス
            const p2Id = line[1];
            const p2 = players.find(p => p.id === p2Id);
            if (p2) {
                p2.c_l = 1.0 + (0.06 * coopWeight); // 例: 1.0 + 0.06 * 1.20 = 1.072 (S級)
                logMessage(`[C_L] 選手ID ${p2Id} に $C_{coop}$ (2番手) ${p2.c_l.toFixed(3)}$ を適用。`);
            }

            // 3番手以降: 重み付けされた小ボーナス
            for (let i = 2; i < line.length; i++) {
                const pNId = line[i];
                const pN = players.find(p => p.id === pNId);
                if (pN) {
                    pN.c_l = 1.0 + (0.02 * coopWeight);
                    logMessage(`[C_L] 選手ID ${pNId} に $C_{coop}$ (3番手以降) ${pN.c_l.toFixed(3)}$ を適用。`);
                }
            }
        });
        
    }

    return lines; // 解析されたライン情報を返す (結果表示用)
}

// 展開別係数 C_D の設定 (シミュレーション)
function getScenarioCoeffs(scenario) {
    if (scenario === '先行有利') return { 自: 1.05, 追: 1.02, 両: 1.03 };
    if (scenario === '捲り有利') return { 自: 1.00, 追: 1.05, 両: 1.04 };
    if (scenario === '差し有利') return { 自: 0.90, 追: 1.08, 両: 1.05 };
    return { 自: 1.0, 追: 1.0, 両: 1.0 };
}


// 3. 🛡️ メイン計算関数
function calculatePrediction() {
    const raceType = document.getElementById('race-type').value;
    const settings = COEFFICIENT_SETTINGS[raceType];
    let players = getPlayerData();
    
    logMessage(`[CALC START] ${raceType} / 係数重み設定 ${settings.R_BIAS.toFixed(2)} をロードしました。`);

    // --- I. C_L (ライン・連係係数) の計算 ---
    const lines = calculateLineCoeffs(players, settings);
    const hasLines = lines.length > 0;
    
    // UIフィードバック更新
    if (settings.IS_GIRLS) {
        document.getElementById('line-strength').innerText = `連係評価: ガールズ競輪（${hasLines ? '連係あり' : '単騎戦'}）。エースマーク係数 $C_{mark}$ 適用評価済。`;
    } else {
        document.getElementById('line-strength').innerText = `連係評価: ${raceType}（${hasLines ? lines.length + 'ライン構成' : '単騎戦'}）。結束力重み ${settings.COOP_WEIGHT.toFixed(2)}。`;
    }

    // --- II. 選手固有係数 C_W, C_R, C_SB の計算 ---
    players.forEach(p => {
        // C_R (直近着順): ここでsettings.RECENT_WEIGHTを適用
        const recentScores = p.recent.split('').map(Number);
        const avgRank = recentScores.reduce((a, b) => a + b, 0) / recentScores.length;
        p.c_recent = (1.0 + (4 - avgRank) * 0.05) * settings.RECENT_WEIGHT; 

        // C_W (W印): 簡易的に処理
        if (p.wmark === '◎') p.c_wmark = 1.04;
        else if (p.wmark === '〇') p.c_wmark = 1.02;

        // C_SB (S/B 1位): 静的ボーナス
        if (p.sb1) p.c_sb1 = 1.005;
        
        // C_R (競走得点): R自体を補正（R_BIAS）
        p.c_score_adj = 1.0 + (p.score / 100 - 1) * settings.R_BIAS; 

        // C_E (環境): 簡易的に無補正で1.0 (実際はバンク/風で計算)
        p.c_e = 1.0; 
    });

    // --- III. 展開別シミュレーションと最終スコア算出 ---
    const scenarios = ['先行有利', '捲り有利', '差し有利'];
    const allScenarioResults = [];

    scenarios.forEach(scenario => {
        const cDCoeffs = getScenarioCoeffs(scenario);
        
        let scenarioPlayers = JSON.parse(JSON.stringify(players)); // Deep copy
        
        scenarioPlayers.forEach(p => {
            const cD = cDCoeffs[p.style] || 1.0; // 脚質別展開係数
            
            // 最終スコア $S_{final} = R \times C_{W} \times C_{R} \times C_{SB} \times C_{L} \times C_{E} \times C_{D}$
            p.final_score = p.score * p.c_score_adj * p.c_wmark * p.c_recent * p.c_sb1 * p.c_l * p.c_e * cD;
            
            // C_R*R の重み付けを確認するためのログ
            if (scenario === '先行有利' && p.id === 1) {
                logMessage(`[選手ID ${p.id}] $R \times C_{R\_BIAS}$: ${p.score.toFixed(2)} $\\times$ ${p.c_score_adj.toFixed(3)} = ${(p.score * p.c_score_adj).toFixed(2)}`);
                logMessage(`[選手ID ${p.id}] $C_{L}$ (連係): ${p.c_l.toFixed(3)}`);
            }
        });

        scenarioPlayers.sort((a, b) => b.final_score - a.final_score);
        allScenarioResults.push({ scenario, results: scenarioPlayers });
    });

    // --- IV. 最終結果の統合と表示 ---
    displayResults(allScenarioResults, players);
    logMessage('[CALC END] 予想計算が完了し、結果が表示されました。');
}

// 結果表示関数
function displayResults(allScenarioResults, players) {
    // 展開別詳細の表示
    const scenarioOutput = document.getElementById('scenario-output');
    scenarioOutput.innerHTML = allScenarioResults.map(s => `
        <div class="scenario-detail">
            <h4>${s.scenario}シミュレーション</h4>
            <p><strong>推奨買い目:</strong> ${s.results[0].id}-${s.results[1].id}-${s.results[2].id}</p>
            <table>
                <tr><th>選手ID</th><th>最終スコア</th><th>順位</th></tr>
                ${s.results.map((p, index) => `
                    <tr><td>${p.id}</td><td>${p.final_score.toFixed(3)}</td><td>${index + 1}位</td></tr>
                `).join('')}
            </table>
        </div>
    `).join('');

    // 晴天令・荒天令の統合 (簡易的なデモ表示)
    const integratedScores = {};
    players.forEach(p => integratedScores[p.id] = 0);
    allScenarioResults.forEach(s => s.results.forEach((p, index) => {
        // 3つの展開の平均スコアを統合
        integratedScores[p.id] += p.final_score; 
    }));

    const finalRanking = Object.keys(integratedScores).map(id => ({
        id: Number(id),
        score: integratedScores[id] / allScenarioResults.length
    })).sort((a, b) => b.score - a.score);

    const top3 = finalRanking.slice(0, 3);
    const top4 = finalRanking.slice(0, 4);

    document.getElementById('seitenrei-output').innerHTML = `
        三連単 (安定): <strong>${top3[0].id}-${top3[1].id}-${top3[2].id}</strong> (スコア: ${top3[0].score.toFixed(2)}), <strong>${top3[0].id}-${top3[2].id}-${top3[1].id}</strong><br>
        三連複 (BOX): <strong>${top3[0].id}=${top3[1].id}=${top3[2].id}</strong>
    `;

    document.getElementById('koutenrei-output').innerHTML = `
        穴狙い (期待値): **${top4[3].id}** が絡む買い目（例: ${top3[0].id}-${top4[3].id}-${top3[1].id}）
    `;
}
