// ----------------------------------------------------
// 華耀天輪 真・自在律 V6.0 - 競輪予測ロジック (統合版)
// ----------------------------------------------------

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

// W印の係数 (乗算係数として再定義)
const W_MARK_COEFFICIENT = {
    '◎': 1.04,
    '〇': 1.02,
    '✕': 1.015,
    '△': 1.01,
    '無': 1.0
};


// バンクデータを格納するグローバル変数
let BANK_DATA = {};

// ----------------------------------------------------
// 2. ログおよびUI操作関数
// ----------------------------------------------------

// ロギング関数
function logMessage(message) {
    const logArea = document.getElementById('debug-log');
    const timestamp = new Date().toLocaleTimeString('ja-JP', { hour12: false });
    if (logArea) {
        logArea.innerHTML += `[${timestamp}] ${message}<br>`;
        logArea.scrollTop = logArea.scrollHeight;
    }
}

// 銀行データの非同期読み込み
async function loadBankData() {
    try {
        logMessage("[INIT] bankdata.jsonの読み込みを開始します...");
        const response = await fetch('bankdata.json');
        
        if (!response.ok) {
            logMessage(`[ERROR] bankdata.jsonの読み込みに失敗しました: HTTP status ${response.status}`);
            throw new Error('Bank data failed to load.');
        }
        
        BANK_DATA = await response.json();
        logMessage(`[SUCCESS] bankdata.jsonを正常に読み込みました。 ${Object.keys(BANK_DATA).length}件のバンクデータをロード。`);
        
        // UIの動的構築 (バンク名選択肢の生成)
        const bankSelect = document.getElementById('bank-name');
        if (bankSelect) { 
            bankSelect.innerHTML = ''; 
            Object.keys(BANK_DATA).forEach(bankName => {
                const option = document.createElement('option');
                option.value = bankName;
                option.textContent = bankName;
                bankSelect.appendChild(option);
            });
            logMessage("[UI] バンク名の選択肢を動的に構築しました。");
            
            // データを読み込んだら、一度展開傾向を表示する
            displayBankTendency();
        }

    } catch (error) {
        logMessage(`[FATAL ERROR] データ読み込み処理中に重大なエラーが発生: ${error.message}`);
        BANK_DATA = { 'ダミーバンク': { length: 400, keirin_bias: { '先行': 1.0, '捲り': 1.0, '差し': 1.0 }, wind_or_position: {} } };
        const bankSelect = document.getElementById('bank-name');
        if (bankSelect) {
            bankSelect.innerHTML = '<option value="ダミーバンク">データ読み込み失敗</option>';
        }
    }
}

// バンク展開傾向の表示関数 (実行前にも表示可能)
function displayBankTendency() {
    const bankName = document.getElementById('bank-name').value;
    const displayArea = document.getElementById('bank-tendency-display');
    
    if (!bankName || !BANK_DATA[bankName] || !displayArea) {
        if(displayArea) displayArea.innerHTML = '';
        return;
    }

    const bias = BANK_DATA[bankName].keirin_bias;
    const biasMap = {
        '先行': bias['先行'] || 1.0,
        '捲り': bias['捲り'] || 1.0,
        '差し': bias['差し'] || 1.0
    };

    let maxBias = -Infinity;
    let strongestTendency = '';

    const styleMap = { '先行': '逃先', '捲り': '捲り', '差し': '差マ' };
    
    Object.keys(biasMap).forEach(key => {
        if (biasMap[key] > maxBias) {
            maxBias = biasMap[key];
            strongestTendency = key;
        }
    });
    
    let message = '';
    if (maxBias > 1.03) { 
        const displayedStyle = styleMap[strongestTendency];
        message = `⚠️ **${bankName}**は**${displayedStyle}**が**出やすい**傾向があります。 (バイアス ${maxBias.toFixed(2)})`;
    } else if (maxBias < 0.97) { 
        const displayedStyle = styleMap[strongestTendency];
        message = `✅ **${bankName}**は**${displayedStyle}**が最も低い傾向です。`;
    } else {
        message = `ℹ️ **${bankName}**は脚質による大きな傾向差は**ありません**。`;
    }
    
    displayArea.innerHTML = message;
    logMessage(`[BANK] ${bankName} の展開傾向: ${message.replace(/<[^>]*>?/gm, '')}`);
}


// ----------------------------------------------------
// 3. データ処理・ロジック関数
// ----------------------------------------------------

function getPlayerData() {
    const players = [];
    const playerRows = document.querySelectorAll('.player-row');
    
    const s1Leader = document.querySelector('input[name="s-leader"]:checked');
    const b1Leader = document.querySelector('input[name="b-leader"]:checked');
    const s1Id = s1Leader ? parseInt(s1Leader.getAttribute('data-id')) : null;
    const b1Id = b1Leader ? parseInt(b1Leader.getAttribute('data-id')) : null;

    if (!s1Leader || !b1Leader) {
        logMessage("[ERROR] S 1位 および B 1位 の選手を必ず選択してください。");
        return null;
    }


    playerRows.forEach(row => {
        const id = parseInt(row.getAttribute('data-id'));
        if (isNaN(id)) return;

        players.push({
            id: id,
            score: parseFloat(row.querySelector('.score').value) || 0,
            style: row.querySelector('.style').value,
            wmark: row.querySelector('.wmark').value.trim(), 
            recent: row.querySelector('.recent').value.trim(),
            
            is_s1: id === s1Id,
            is_b1: id === b1Id,

            c_score_adj: 1.0, c_recent: 1.0, c_wmark: 1.0, c_s1: 1.0, c_b1: 1.0, c_l: 1.0, c_e: 1.0,
            final_score: 0
        });
    });
    return players;
}


// ライン強度を計算し、視覚的に表示するロジック
function calculateLineCoeffs(players, settings) {
    const lineInput = document.getElementById('line-input').value;
    const lines = []; 
    const playerToLineMap = {}; 
    const allPlayerIds = new Set(players.map(p => p.id));
    let assignedPlayerIds = new Set();
    
    // 1. ライン構成をパースし、playerToLineMapを生成
    if (lineInput && lineInput.includes(',')) {
        let lineCounter = 1;
        lineInput.split(',').forEach(lineStr => {
            const members = lineStr.split('').map(Number);
            if (members.length >= 2) {
                lines.push(members);
                members.forEach(id => {
                    playerToLineMap[id] = lineCounter;
                    assignedPlayerIds.add(id);
                });
                lineCounter++;
            }
        });
    }

    const soloPlayers = Array.from(allPlayerIds).filter(id => !assignedPlayerIds.has(id));
    soloPlayers.forEach(id => playerToLineMap[id] = 0); // 0は単騎ライン

    // 2. C_L係数計算
    if (settings.IS_GIRLS) {
        logMessage(`[C_L] ガールズ競輪モード。エースマーク係数 $C_{mark}$ を評価。`);
        const ace = players.reduce((max, p) => (p.score > max.score ? p : max), { score: -Infinity });
        let aceMarkPlayers = new Set();
        
        lines.forEach(line => {
            const aceIndex = line.indexOf(ace.id);
            if (aceIndex !== -1 && aceIndex < line.length - 1) {
                const markerId = line[aceIndex + 1]; // 2番手がマーク
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
            } else if (lines.some(l => l.includes(p.id))) {
                p.c_l = 1.005; 
            }
        });

    } 
    else {
        logMessage(`[C_L] 一般競輪 (${settings.R_BIAS.toFixed(2)}) モード。ライン結束力係数 $C_{coop}$ を評価。`);
        const coopWeight = settings.COOP_WEIGHT; 
        
        lines.forEach(line => {
            // 2番手
            const p2Id = line[1];
            const p2 = players.find(p => p.id === p2Id);
            if (p2) {
                p2.c_l = 1.0 + (0.06 * coopWeight); 
            }

            // 3番手以降
            for (let i = 2; i < line.length; i++) {
                const pNId = line[i];
                const pN = players.find(p => p.id === pNId);
                if (pN) {
                    pN.c_l = 1.0 + (0.02 * coopWeight);
                }
            }
        });
    }

    // 3. ライン強度の視覚化出力
    const lineDisplay = document.getElementById('line-display');
    if (lineDisplay) {
        let displayHtml = '';
        const allPlayerIdsSorted = Array.from(allPlayerIds).sort((a, b) => a - b);
        
        allPlayerIdsSorted.forEach(id => {
            const lineId = playerToLineMap[id];
            let className = '';
            // ラインID (1, 2, 3...) を使って色を割り当て
            if (lineId === 0) {
                className = 'line-solo';
            } else {
                className = `line-color-${lineId}`;
            }
            displayHtml += `<span class="line-box ${className}">${id}</span>`;
        });
        
        lineDisplay.innerHTML = displayHtml;
    }

    return lines;
}

function getScenarioCoeffs(scenario) {
    if (scenario === '先行有利') return { '自': 1.05, '追': 1.02, '両': 1.03 };
    if (scenario === '捲り有利') return { '自': 1.00, '追': 1.05, '両': 1.04 };
    if (scenario === '差し有利') return { '自': 0.90, '追': 1.08, '両': 1.05 };
    return { '自': 1.0, '追': 1.0, '両': 1.0 };
}

function generateScenarioWagers(results) {
    const top3 = results.slice(0, 3).map(p => p.id); 
    
    // 三連単 3点: 1-2-3, 1-3-2, 2-1-3
    const tritan = [
        `${top3[0]}-${top3[1]}-${top3[2]}`,
        `${top3[0]}-${top3[2]}-${top3[1]}`,
        `${top3[1]}-${top3[0]}-${top3[2]}`
    ].join(', ');
    
    // 三連複 2点: 1=2=3, 1=2=4 (4位も使用)
    const top4 = results.slice(0, 4).map(p => p.id);
    const trifuku = [
        `${top4[0]}=${top4[1]}=${top4[2]}`,
        `${top4[0]}=${top4[1]}=${top4[3] ? top4[3] : 'X'}` // 4位がない場合はXを仮に入れる
    ].join(', ');

    return { tritan, trifuku };
}

function assignFinalGrades(scenarioPlayers) {
    if (scenarioPlayers.length === 0) return;

    const scores = scenarioPlayers.map(p => p.final_score);
    const maxScore = scores[0]; 
    const minScore = scores[scores.length - 1]; 
    const range = maxScore - minScore;
    
    scenarioPlayers.forEach(p => {
        let grade = 1;
        if (range > 0) {
            // スコアを0-10に正規化し、四捨五入してグレードを決定 (1-10)
            grade = Math.ceil(1 + 9 * (p.final_score - minScore) / range);
        }
        p.grade = Math.min(10, Math.max(1, grade)); 
    });

    scenarioPlayers.forEach((p, index) => {
        p.strength_mark = '→'; 
        
        if (index === scenarioPlayers.length - 1) return; 

        const nextPlayer = scenarioPlayers[index + 1];
        
        if (p.grade === nextPlayer.grade) {
            const scoreDiff = p.final_score - nextPlayer.final_score;
            
            // スコア差を全体のレンジのパーセンテージと比較して強弱を決定
            if (scoreDiff >= (range / 1000) * 1) { // 0.1%以上の差
                p.strength_mark = '↑';
            } else if (scoreDiff >= (range / 1000) * 0.1) { // 0.01%以上の差
                p.strength_mark = '↗';
            } else { 
                p.strength_mark = '→';
            }
        }
    });
}

// 最終スコアと順位の表示とX投稿テキストの準備
function displayResults(allScenarioResults, players, bankName) { 
    
    // バンク展開傾向の再表示（実行結果エリアの先頭）
    displayBankTendency();

    const scenarioOutput = document.getElementById('scenario-output');
    if (scenarioOutput) {
        scenarioOutput.innerHTML = allScenarioResults.map(s => {
            const wagers = generateScenarioWagers(s.results); 
            
            return `
                <div class="scenario-detail">
                    <h4>${s.scenario}シミュレーション</h4>
                    <p><strong>三連単 (3点):</strong> ${wagers.tritan}</p>
                    <p><strong>三連複 (2点):</strong> ${wagers.trifuku}</p>
                    <table>
                        <tr><th>選手ID</th><th>評価</th><th class="hide-score-rank">スコア</th><th class="hide-score-rank">順位</th></tr>
                        ${s.results.map((p, index) => `
                            <tr>
                                <td>${p.id}</td>
                                <td><strong>${p.grade}${p.strength_mark}</strong></td>
                                <td class="hide-score-rank">${p.final_score.toFixed(3)}</td>
                                <td class="hide-score-rank">${index + 1}位</td>
                            </tr>
                        `).join('')}
                    </table>
                </div>
            `;
        }).join('');
    }

    // 総合評価の計算
    const integratedScores = {};
    players.forEach(p => integratedScores[p.id] = 0);
    allScenarioResults.forEach(s => s.results.forEach((p) => {
        integratedScores[p.id] += p.final_score; 
    }));

    const finalRanking = Object.keys(integratedScores).map(id => ({
        id: Number(id),
        score: integratedScores[id] / allScenarioResults.length
    })).sort((a, b) => b.score - a.score); 

    const top3 = finalRanking.slice(0, 3);
    const top4 = finalRanking.slice(0, 4);

    // 晴天令 (安定推奨)
    const seitenreiOutput = document.getElementById('seitenrei-output');
    let seitenTritan = 'N/A';
    let seitenTrifuku = 'N/A';
    if (top3.length === 3) {
        seitenTritan = [
            `${top3[0].id}-${top3[1].id}-${top3[2].id}`,
            `${top3[0].id}-${top3[2].id}-${top3[1].id}`,
            `${top3[1].id}-${top3[0].id}-${top3[2].id}`
        ].join(', ');
        
        seitenTrifuku = [
            `${top4[0].id}=${top4[1].id}=${top4[2].id}`,
            `${top4[0].id}=${top4[1].id}=${top4[3] ? top4[3].id : top4[2].id}`
        ].join(', ');
    }
    
    if (seitenreiOutput) {
        seitenreiOutput.innerHTML = `
            三連単 (3点): <strong>${seitenTritan}</strong><br>
            三連複 (2点): <strong>${seitenTrifuku}</strong>
        `;
    }

    // 荒天令 (高配当狙い) - 三連複3点を表示
    const koutenreiOutput = document.getElementById('koutenrei-output');
    let koutenTrifuku = 'N/A';
    const koutenLeader = top4.length >= 4 ? top4[3].id : null; 
        
    if (koutenLeader && top3.length === 3) {
        // 荒天令 三連複 3点: 4=1=2, 4=1=3, 4=2=3 (軸4位、相手1,2,3位)
        koutenTrifuku = [
            `${koutenLeader}=${top3[0].id}=${top3[1].id}`, 
            `${koutenLeader}=${top3[0].id}=${top3[2].id}`,
            `${koutenLeader}=${top3[1].id}=${top3[2].id}` 
        ].join(', ');
    } else {
        koutenTrifuku = 'データ不足または上位不足のため生成不可';
    }

    if (koutenreiOutput) {
        koutenreiOutput.innerHTML = `
            推奨軸 (4位): **${koutenLeader ? koutenLeader : 'N/A'}**<br>
            三連複 (3点): <strong>${koutenTrifuku}</strong>
        `;
    }
    
    // ----------------------------------------------------
    // V. X投稿用テキストの格納とボタンの有効化
    // ----------------------------------------------------
    const postText = formatPostText(seitenTritan, seitenTrifuku, koutenLeader, koutenTrifuku, bankName);
    document.getElementById('x-post-text-storage').value = postText;
    document.getElementById('post-to-x-button').disabled = false;
    
    logMessage('[UI] 予想結果の表示とX投稿テキストの準備が完了しました。');
}

/**
 * X投稿用のテキストを整形する
 * @returns {string} 投稿用テキスト
 */
function formatPostText(seitenTritan, seitenTrifuku, koutenLeader, koutenTrifuku, bankName) {
    const raceType = document.getElementById('race-type').value.toUpperCase();
    
    let text = `#華耀天輪_真自在律 V6.0 予想\n`;
    text += `レース: ${bankName} (${raceType})\n\n`;
    text += `☀️【晴天令 (安定推奨)】\n`;
    text += `  三連単(3点): ${seitenTritan}\n`;
    text += `  三連複(2点): ${seitenTrifuku}\n\n`;
    text += `⛈️【荒天令 (高配当狙い)】\n`;
    text += `  推奨軸(4位): ${koutenLeader ? koutenLeader : 'N/A'}\n`;
    text += `  三連複(3点): ${koutenTrifuku}\n\n`;
    text += `#競輪予想 #競輪 #AI予想`;
    
    return text;
}


// ----------------------------------------------------
// 4. メイン処理と初期化
// ----------------------------------------------------

// メイン計算関数
async function calculatePrediction() {
    
    // ログをクリアし、ボタンを無効化
    const log = document.getElementById('debug-log');
    log.innerHTML = "[INFO] 予想計算を開始します...\n";
    document.getElementById('post-to-x-button').disabled = true;

    // バンクデータの読み込み待機と確認
    if (Object.keys(BANK_DATA).length === 0) {
        logMessage("[WAIT] バンクデータの読み込みを待機します...");
        await loadBankData(); 
        if (Object.keys(BANK_DATA).length === 0 || document.getElementById('bank-name').value === 'ダミーバンク') {
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
    if (!players) { // S1/B1未選択エラー
        const resultsContainer = document.getElementById('results-container');
        if (resultsContainer) resultsContainer.classList.remove('visible');
        return;
    }

    logMessage(`[CALC START] ${raceType} / バンク: ${bankName} で計算開始。`);

    // --- I. C_L (ライン・連係係数) の計算とライン強度の表示 ---
    calculateLineCoeffs(players, settings);

    // --- II. 選手固有係数 C_W, C_R, C_S1, C_B1 & C_E の計算 (W印の修正を含む) ---
    players.forEach(p => {
        // C_score_adj (競走得点調整)
        p.c_score_adj = 1.0 + (p.score / 100 - 1) * settings.R_BIAS; 

        // C_recent (直近3走)
        const recentScores = p.recent.split('').map(Number).filter(r => !isNaN(r) && r >= 1 && r <= 7);
        const avgRank = recentScores.length > 0 ? recentScores.reduce((a, b) => a + b, 0) / recentScores.length : 4.0; 
        p.c_recent = (1.0 + (4 - avgRank) * 0.05) * settings.RECENT_WEIGHT; 

        // C_wmark (W印) - 乗算係数を使用
        p.c_wmark = W_MARK_COEFFICIENT[p.wmark] || 1.0;

        // C_s1 / C_b1 (S/B 1位係数)
        p.c_s1 = p.is_s1 ? 1.005 : 1.0; 
        p.c_b1 = p.is_b1 ? 1.015 : 1.0; 

        // C_e (バンク展開係数)
        let biasKey = '';
        if (p.style === '自') biasKey = '先行';
        else if (p.style === '両') biasKey = '捲り'; 
        else if (p.style === '追') biasKey = '差し'; 

        const keirinBias = bankData.keirin_bias[biasKey] || 1.0;
        p.c_e = keirinBias;
    });

    // --- III. 展開別シミュレーションと最終スコア算出 ---
    const scenarios = ['先行有利', '捲り有利', '差し有利'];
    const allScenarioResults = [];

    scenarios.forEach(scenario => {
        const cDCoeffs = getScenarioCoeffs(scenario);
        
        let scenarioPlayers = JSON.parse(JSON.stringify(players));
        
        scenarioPlayers.forEach(p => {
            const cD = cDCoeffs[p.style] || 1.0;
            
            // 最終スコア算出ロジック: 得点 * 各種係数の乗算
            p.final_score = p.score * p.c_score_adj * p.c_wmark * p.c_recent * p.c_s1 * p.c_b1 * p.c_l * p.c_e * cD;
            
        });

        scenarioPlayers.sort((a, b) => b.final_score - a.final_score);
        
        assignFinalGrades(scenarioPlayers);

        allScenarioResults.push({ scenario, results: scenarioPlayers });
    });

    // --- IV. 最終結果の統合と表示 ---
    displayResults(allScenarioResults, players, bankName); 
    
    // 計算完了後、結果コンテナを表示する
    const resultsContainer = document.getElementById('results-container');
    if (resultsContainer) {
        resultsContainer.classList.add('visible');
    }
    
    logMessage('[CALC END] 予想計算が完了し、結果が表示されました。');
}


/**
 * X (旧Twitter) に投稿するためのウィンドウを開く
 */
function postToX() {
    const postText = document.getElementById('x-post-text-storage').value;
    if (!postText) {
        alert('投稿内容が準備されていません。先に「予想を計算」を実行してください。');
        return;
    }
    
    // URLエンコード
    const encodedText = encodeURIComponent(postText);
    const twitterUrl = `https://twitter.com/intent/tweet?text=${encodedText}`;

    // 新しいウィンドウ/タブで開く
    window.open(twitterUrl, '_blank');
}


// ページロード時にデータ読み込みを実行
(async function() {
    await loadBankData();
})();
