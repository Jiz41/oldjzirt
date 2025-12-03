// --- 華耀天輪 真・自在律 V6.0 ロジック ---

// 1. 🗃️ 係数設定オブジェクトの分離
const COEFFICIENT_SETTINGS = {
    's-kyu': { R_BIAS: 1.15, RECENT_WEIGHT: 0.90, COOP_WEIGHT: 1.20, IS_GIRLS: false },
    'a-kyu': { R_BIAS: 1.00, RECENT_WEIGHT: 1.00, COOP_WEIGHT: 1.00, IS_GIRLS: false },
    'a-chal': { R_BIAS: 0.90, RECENT_WEIGHT: 1.20, COOP_WEIGHT: 0.80, IS_GIRLS: false },
    'girls': { R_BIAS: 1.00, RECENT_WEIGHT: 1.10, COOP_WEIGHT: 1.00, IS_GIRLS: true },
};

const C_MARK_VALUES = {
    HIGH: 1.12, 
    MEDIUM: 1.08,
    LOW: 1.03
};

// バンクデータを格納するグローバル変数
let BANK_DATA = {};

// ロギング関数
function logMessage(message) {
    const logArea = document.getElementById('debug-log');
    const timestamp = new Date().toLocaleTimeString('ja-JP', { hour12: false });
    // logAreaがnullでないことを確認
    if (logArea) {
        logArea.innerHTML += `[${timestamp}] ${message}<br>`;
        logArea.scrollTop = logArea.scrollHeight;
    }
}

// ★★★ 修正点4, 5: 選手データ取得ロジックの修正 (W印のselect対応、S/B分離対応) ★★★
function getPlayerData() {
    const players = [];
    const playerRows = document.querySelectorAll('.player-row');
    
    // S/B 1位の情報をラジオボタンから取得
    const s1Leader = document.querySelector('input[name="s-leader"]:checked');
    const b1Leader = document.querySelector('input[name="b-leader"]:checked');
    const s1Id = s1Leader ? parseInt(s1Leader.getAttribute('data-id')) : null;
    const b1Id = b1Leader ? parseInt(b1Leader.getAttribute('data-id')) : null;

    playerRows.forEach(row => {
        const id = parseInt(row.getAttribute('data-id'));
        if (isNaN(id)) return;

        players.push({
            id: id,
            score: parseFloat(row.querySelector('.score').value) || 0,
            style: row.querySelector('.style').value,
            wmark: row.querySelector('.wmark').value.trim(), // W印をselectから取得
            recent: row.querySelector('.recent').value.trim(),
            
            // S/B 1位の情報を分離して取得
            is_s1: id === s1Id,
            is_b1: id === b1Id,

            // 係数初期値
            c_score_adj: 1.0, c_recent: 1.0, c_wmark: 1.0, c_s1: 1.0, c_b1: 1.0, c_l: 1.0, c_e: 1.0,
            final_score: 0
        });
    });
    return players;
}

// ★★★ 修正点1: 銀行データの非同期読み込みとUIの動的構築を修正 ★★★
async function loadBankData() {
    try {
        logMessage("[INIT] bankdata.jsonの読み込みを開始します...");
        const response = await fetch('bankdata.json');
        
        // ファイルが存在しない場合やHTTPエラーの場合の対応を強化
        if (!response.ok) {
            logMessage(`[ERROR] bankdata.jsonの読み込みに失敗しました: HTTP status ${response.status}`);
            throw new Error('Bank data failed to load.');
        }
        
        BANK_DATA = await response.json();
        logMessage(`[SUCCESS] bankdata.jsonを正常に読み込みました。 ${Object.keys(BANK_DATA).length}件のバンクデータをロード。`);
        
        // UIの動的構築 (バンク名選択肢の生成)
        const bankSelect = document.getElementById('bank-name');
        if (bankSelect) { // bankSelectが存在することを確認
            bankSelect.innerHTML = ''; 
            Object.keys(BANK_DATA).forEach(bankName => {
                const option = document.createElement('option');
                option.value = bankName;
                option.textContent = bankName;
                bankSelect.appendChild(option);
            });
            logMessage("[UI] バンク名の選択肢を動的に構築しました。");
        } else {
            logMessage("[UI ERROR] バンク名セレクタ (id='bank-name') が見つかりません。");
        }


    } catch (error) {
        logMessage(`[FATAL ERROR] データ読み込み処理中に重大なエラーが発生: ${error.message}`);
        // データ読み込み失敗時のフォールバック処理 (計算可能にするための最低限のダミーデータ)
        BANK_DATA = { 'ダミーバンク': { length: 400, keirin_bias: { '先行': 1.0, '捲り': 1.0, '差し': 1.0 }, wind_or_position: {} } };
        const bankSelect = document.getElementById('bank-name');
        if (bankSelect) {
            bankSelect.innerHTML = '<option value="ダミーバンク">データ読み込み失敗</option>';
        }
    }
}

// ページロード時にデータ読み込みを実行
(async function() {
    await loadBankData();
})();


// 2. 🛡️ フェイルセーフなライン解析とC_L計算 (変更なし)
function calculateLineCoeffs(players, settings) {
    // ... (ライン解析とC_L計算ロジックは変更なし) ...
    const lineInput = document.getElementById('line-input').value;
    const lines = []; 
    let aceMarkPlayers = new Set(); 
    
    // --- (A) ライン解析とフェイルセーフ ---
    if (lineInput && lineInput.includes(',')) {
        lineInput.split(',').forEach(lineStr => {
            const members = lineStr.split('').map(Number);
            if (members.length >= 2) {
                lines.push(members);
            }
        });
    }
    
    // --- (B) C_L係数計算の分岐 ---

    if (settings.IS_GIRLS) {
        logMessage(`[C_L] ガールズ競輪モード。エースマーク係数 $C_{mark}$ を評価。`);
        const ace = players.reduce((max, p) => (p.score > max.score ? p : max), { score: -Infinity });
        
        lines.forEach(line => {
            const aceIndex = line.indexOf(ace.id);
            if (aceIndex !== -1 && aceIndex < line.length - 1) {
                const markerId = line[aceIndex + 1];
                aceMarkPlayers.add(markerId);
            }
        });

        let cMarkValue = 1.0;
        if (ace.score >= 105.0) cMarkValue = C_MARK_VALUES.HIGH;
        else if (ace.score >= 102.0) cMarkValue = C_MARK_VALUES.MEDIUM;
        else cMarkValue = C_MARK_VALUES.LOW;
        
        players.forEach(p => {
            if (aceMarkPlayers.has(p.id)) {
                p.c_l = cMarkValue;
                logMessage(`[C_L] 選手ID ${p.id} に $C_{mark}=${cMarkValue.toFixed(3)}$ を適用 (エースマーク)。`);
            } else if (lines.some(l => l.includes(p.id))) {
                p.c_l = 1.005; 
            }
        });

    } 
    else {
        logMessage(`[C_L] 一般競輪 (${settings.R_BIAS.toFixed(2)}) モード。ライン結束力係数 $C_{coop}$ を評価。`);
        
        const coopWeight = settings.COOP_WEIGHT; 
        
        lines.forEach(line => {
            const p2Id = line[1];
            const p2 = players.find(p => p.id === p2Id);
            if (p2) {
                p2.c_l = 1.0 + (0.06 * coopWeight); 
                logMessage(`[C_L] 選手ID ${p2Id} に $C_{coop}$ (2番手) ${p2.c_l.toFixed(3)}$ を適用。`);
            }

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

    const hasLines = lines.length > 0;
    const raceType = document.getElementById('race-type').value;
    const lineStrengthElement = document.getElementById('line-strength');
    if (lineStrengthElement) {
        if (settings.IS_GIRLS) {
            lineStrengthElement.innerText = `連係評価: ガールズ競輪（${hasLines ? '連係あり' : '単騎戦'}）。エースマーク係数 $C_{mark}$ 適用評価済。`;
        } else {
            lineStrengthElement.innerText = `連係評価: ${raceType}（${hasLines ? lines.length + 'ライン構成' : '単騎戦'}）。結束力重み ${settings.COOP_WEIGHT.toFixed(2)}。`;
        }
    }

    return lines;
}

// 展開別係数 C_D の設定 (変更なし)
function getScenarioCoeffs(scenario) {
    if (scenario === '先行有利') return { '自': 1.05, '追': 1.02, '両': 1.03 };
    if (scenario === '捲り有利') return { '自': 1.00, '追': 1.05, '両': 1.04 };
    if (scenario === '差し有利') return { '自': 0.90, '追': 1.08, '両': 1.05 };
    return { '自': 1.0, '追': 1.0, '両': 1.0 };
}


// 3. 🛡️ メイン計算関数 (修正点5: 係数計算エラーの解消と S/B 分離ロジックの追加)
async function calculatePrediction() {
    // データ読み込みチェック... 
    if (Object.keys(BANK_DATA).length === 0) {
        logMessage("[WAIT] バンクデータの読み込みを待機します...");
        await loadBankData(); 
        if (Object.keys(BANK_DATA).length === 0) {
            logMessage("[FATAL] バンクデータが利用できません。計算を中止します。");
            return;
        }
    }

    const raceType = document.getElementById('race-type').value;
    const settings = COEFFICIENT_SETTINGS[raceType];
    const bankName = document.getElementById('bank-name').value; 
    
    const bankData = BANK_DATA[bankName]; 
    if (!bankData) {
        logMessage(`[ERROR] バンク名 "${bankName}" のデータが見つかりません。計算を中止します。`);
        return;
    }

    let players = getPlayerData();
    
    logMessage(`[CALC START] ${raceType} / バンク: ${bankName} で計算開始。特殊条件の影響はオミットされています。`);

    // --- I. C_L (ライン・連係係数) の計算... (省略) ---
    calculateLineCoeffs(players, settings);

    // --- II. 選手固有係数 C_W, C_R, C_SB & C_E の計算 ---
    players.forEach(p => {
        // C_R (得点調整係数) の計算
        p.c_score_adj = 1.0 + (p.score / 100 - 1) * settings.R_BIAS; 

        // C_R (直近着順係数) の計算
        const recentScores = p.recent.split('').map(Number);
        // recentScoresが空でないことを確認
        const avgRank = recentScores.length > 0 ? recentScores.reduce((a, b) => a + b, 0) / recentScores.length : 4.0; 
        p.c_recent = (1.0 + (4 - avgRank) * 0.05) * settings.RECENT_WEIGHT; 

        // C_W (W印係数) の計算
        if (p.wmark === '◎') p.c_wmark = 1.04;
        else if (p.wmark === '〇') p.c_wmark = 1.02;
        else if (p.wmark === '△') p.c_wmark = 1.01;
        else p.c_wmark = 1.0;

        // ★★★ C_S1 (S1位係数) / C_B1 (B1位係数) の計算 ★★★
        p.c_s1 = p.is_s1 ? 1.005 : 1.0; 
        p.c_b1 = p.is_b1 ? 1.015 : 1.0; 
        // 以前の p.c_sb1 は p.c_s1 と p.c_b1 に分離された

        // C_E (環境係数: バンクバイアス) の計算
        let c_e = 1.0;
        
        let biasKey = '';
        if (p.style === '自') biasKey = '先行';
        else if (p.style === '両') biasKey = '捲り'; 
        else if (p.style === '追') biasKey = '差し'; 

        const keirinBias = bankData.keirin_bias[biasKey] || 1.0;
        c_e *= keirinBias;
        
        // 特殊条件バイアスはオミットされたまま (修正なし)
        
        p.c_e = c_e;
        
        // ログメッセージの更新
        logMessage(`[C_E] 選手ID ${p.id} (${p.style}/${biasKey}): バンク脚質バイアス ${keirinBias.toFixed(3)} を適用。C_B1=${p.c_b1.toFixed(3)}。`);
    });

    // --- III. 展開別シミュレーションと最終スコア算出 ---
    const scenarios = ['先行有利', '捲り有利', '差し有利'];
    const allScenarioResults = [];

    players.forEach(p => {
        // ログ: 係数チェック
        logMessage(`[COEFF] ID ${p.id}: R_Adj=${p.c_score_adj.toFixed(3)}, W=${p.c_wmark.toFixed(3)}, R=${p.c_recent.toFixed(3)}, S1=${p.c_s1.toFixed(3)}, B1=${p.c_b1.toFixed(3)}, L=${p.c_l.toFixed(3)}, E=${p.c_e.toFixed(3)}`);
    });

    scenarios.forEach(scenario => {
        const cDCoeffs = getScenarioCoeffs(scenario);
        
        let scenarioPlayers = JSON.parse(JSON.stringify(players));
        
        scenarioPlayers.forEach(p => {
            const cD = cDCoeffs[p.style] || 1.0;
            
            // 最終スコア $S_{final}$ 計算式を更新 (c_sb1 を c_s1 と c_b1 に分離)
            // $$S_{final} = R \times C_{R\_BIAS} \times C_{W} \times C_{R} \times C_{S1} \times C_{B1} \times C_{L} \times C_{E} \times C_{D}$$
            p.final_score = p.score * p.c_score_adj * p.c_wmark * p.c_recent * p.c_s1 * p.c_b1 * p.c_l * p.c_e * cD;
        });

        scenarioPlayers.sort((a, b) => b.final_score - a.final_score);
        allScenarioResults.push({ scenario, results: scenarioPlayers });
    });

    // --- IV. 最終結果の統合と表示... (省略) ---
    displayResults(allScenarioResults, players);
    logMessage('[CALC END] 予想計算が完了し、結果が表示されました。');
}

// 結果表示関数 (変更なし)
function displayResults(allScenarioResults, players) {
    const scenarioOutput = document.getElementById('scenario-output');
    if (scenarioOutput) {
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
    }

    const integratedScores = {};
    players.forEach(p => integratedScores[p.id] = 0);
    allScenarioResults.forEach(s => s.results.forEach((p, index) => {
        integratedScores[p.id] += p.final_score; 
    }));

    const finalRanking = Object.keys(integratedScores).map(id => ({
        id: Number(id),
        score: integratedScores[id] / allScenarioResults.length
    })).sort((a, b) => b.score - a.score); // スコア順にソートを修正

    const top3 = finalRanking.slice(0, 3);
    const top4 = finalRanking.slice(0, 4);

    const seitenreiOutput = document.getElementById('seitenrei-output');
    if (seitenreiOutput) {
        seitenreiOutput.innerHTML = `
            三連単 (安定): <strong>${top3[0].id}-${top3[1].id}-${top3[2].id}</strong> (スコア: ${top3[0].score.toFixed(2)}), <strong>${top3[0].id}-${top3[2].id}-${top3[1].id}</strong><br>
            三連複 (BOX): <strong>${top3[0].id}=${top3[1].id}=${top3[2].id}</strong>
        `;
    }

    const koutenreiOutput = document.getElementById('koutenrei-output');
    if (koutenreiOutput) {
        koutenreiOutput.innerHTML = `
            穴狙い (期待値): **${top4[3] ? top4[3].id : 'N/A'}** が絡む買い目（例: ${top3[0].id}-${top4[3] ? top4[3].id : 'X'}-${top3[1].id}）
        `;
    }
}
