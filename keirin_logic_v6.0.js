// --- 華耀天輪 真・自在律 V6.0 ロジック (天雲指数実装済み) ---

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
    if (logArea) {
        logArea.innerHTML += `[${timestamp}] ${message}<br>`;
        logArea.scrollTop = logArea.scrollHeight;
    }
}

function getPlayerData() {
    const players = [];
    const playerRows = document.querySelectorAll('.player-row');
    
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
    
    // 計算実行後にも結果エリアに表示されるため、ここではHTMLタグは付けない
    // ※ 実行後の表示は displayResults() の中で更新されます
    displayArea.innerHTML = message;
    logMessage(`[BANK] ${bankName} の展開傾向: ${message.replace(/<[^>]*>?/gm, '')}`);
}

// ページロード時にデータ読み込みを実行
(async function() {
    await loadBankData();
})();


// ライン強度を視覚的に表示するロジック
function calculateLineCoeffs(players, settings) {
    const lineInput = document.getElementById('line-input').value;
    const lines = []; 
    const playerToLineMap = {}; 
    const allPlayerIds = new Set(players.map(p => p.id));
    let assignedPlayerIds = new Set();
    
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
    soloPlayers.forEach(id => playerToLineMap[id] = 0); 

    // C_L係数計算 (省略)
    if (settings.IS_GIRLS) {
        logMessage(`[C_L] ガールズ競輪モード。エースマーク係数 $C_{mark}$ を評価。`);
        const ace = players.reduce((max, p) => (p.score > max.score ? p : max), { score: -Infinity });
        let aceMarkPlayers = new Set();
        
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
            }

            for (let i = 2; i < line.length; i++) {
                const pNId = line[i];
                const pN = players.find(p => p.id === pNId);
                if (pN) {
                    pN.c_l = 1.0 + (0.02 * coopWeight);
                }
            }
        });
    }

    // ライン強度の視覚化出力
    const lineDisplay = document.getElementById('line-display');
    if (lineDisplay) {
        let displayHtml = '';
        const allPlayerIdsSorted = Array.from(allPlayerIds).sort((a, b) => a - b);
        
        allPlayerIdsSorted.forEach(id => {
            const lineId = playerToLineMap[id];
            let className = '';
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
    
    // 三連単 3点: 1-2-3, 1-3-2, 2-1-3 (ランキング順)
    const tritan = [
        `${top3[0]}-${top3[1]}-${top3[2]}`,
        `${top3[0]}-${top3[2]}-${top3[1]}`,
        `${top3[1]}-${top3[0]}-${top3[2]}`
    ].join(', ');
    
    // 三連複 2点: 1=2=3, 1=2=4 (昇順ソートを適用)
    const top4 = results.slice(0, 4).map(p => p.id);
    
    const tri1 = [...top4.slice(0, 3)].sort((a, b) => a - b).join('='); // 1, 2, 3
    let tri2 = '';
    if (top4.length >= 4) {
        tri2 = [top4[0], top4[1], top4[3]].sort((a, b) => a - b).join('='); // 1, 2, 4
    }
    
    const trifuku = [tri1, tri2].filter(t => t.length > 0).join(', ');

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
            
            if (scoreDiff >= (range / 1000) * 1) { 
                p.strength_mark = '↑';
            } else if (scoreDiff >= (range / 1000) * 0.1) { 
                p.strength_mark = '↗';
            } else { 
                p.strength_mark = '→';
            }
        }
    });
}


// ----------------------------------------------------------------------
// ★ 新規ロジック関数: calculate_koutenrei_bias の追加 ★
// ----------------------------------------------------------------------
/**
 * 荒天令モード専用の非実力リスクバイアス (C係数) を計算し、スコア減点を適用する
 * @param {Array<Object>} players - 選手データ配列 (c_l, c_eなどが既に計算済み)
 * @param {Array<Array<number>>} lines - ライン構成
 * @param {string} scenario - 現在のシミュレーション展開 (先行有利/捲り有利/差し有利)
 * @param {Object} bankData - バンクデータ
 * @returns {Array<Object>} C係数適用後の選手データ配列
 */
function calculate_koutenrei_bias(players, lines, scenario, bankData) {
    
    // NOTE: この関数は applyKoutenrei が true の場合のみ呼び出されます。

    logMessage("[KOUTENREI] 荒天令リスクバイアス (C係数) の計算を開始...");

    // 係数適用前の基礎スコアを保持
    let tempPlayers = JSON.parse(JSON.stringify(players));
    
    // レース全体のスコア範囲を計算 (C_split、C_mentalの相対値基準に必要)
    const allScores = players.map(p => p.score);
    const scoreMax = Math.max(...allScores);
    const scoreMin = Math.min(...allScores);
    const scoreRange = scoreMax - scoreMin;

    // --- C係数の計算と適用 ---

    tempPlayers.forEach(p => {
        let C_TOTAL = 1.0; 
        
        // 1. C_short (走路距離補正)
        if (bankData.length === 333) {
            C_TOTAL *= 0.985;
            logMessage(`[C_short] 短走路(${bankData.length}m)ブースト適用。`);
        }

        // 2. C_risk (接触・落車リスク)
        const avgScore = allScores.reduce((a, b) => a + b, 0) / allScores.length;
        const recentAvg = p.recent.split('').map(Number).reduce((a, b) => a + b, 0) / p.recent.length || 4.0;
        
        if (p.score < avgScore - 2.0 && recentAvg >= 4.0) {
             C_TOTAL *= 0.97; 
             logMessage(`[C_risk] 選手ID ${p.id} は不安定指数が高いため減点。`);
        }

        // 3. C_mental (メンタル・疲労減衰)
        const raceGrade = document.getElementById('race-type').value;
        const isHighPressure = ['s-kyu'].includes(raceGrade) || (p.score === scoreMax);
        
        if (isHighPressure && p.recent.startsWith('1')) {
            C_TOTAL *= 0.96; 
            logMessage(`[C_mental] 選手ID ${p.id} はプレッシャー減点適用 (${raceGrade})。`);
        }

        // 4. C_recovery (位置取り回復力)
        if (p.style === '両' || p.style === '追') {
             const scoreDiffRatio = (p.score - scoreMin) / scoreRange;
             if (scoreDiffRatio > 0.8) {
                 C_TOTAL *= 1.03 + (scoreDiffRatio - 0.8) * 0.1;
                 logMessage(`[C_recovery] 選手ID ${p.id} は実力回復力で増点 (${scoreDiffRatio.toFixed(2)})。`);
             }
        }
        
        // 最終的なC係数をスコアに乗算
        p.final_score = p.final_score * C_TOTAL;
    });

    // 5. C_target (ターゲット・包囲網)
    const targetPlayer = tempPlayers.find(p => p.score === scoreMax);
    if (targetPlayer) {
        let rivalAutos = 0;
        tempPlayers.forEach(p => {
            if (p.id !== targetPlayer.id && (p.style === '自' || p.style === '両')) {
                rivalAutos++;
            }
        });
        
        if (rivalAutos >= 2) {
            targetPlayer.final_score *= 0.95;
            logMessage(`[C_target] ターゲット選手ID ${targetPlayer.id} は包囲網リスクで減点。`);
        }
    }

    // 6. C_split (ライン不均衡リスク)
    lines.forEach(line => {
        const p1 = tempPlayers.find(p => p.id === line[0]);
        const p2 = tempPlayers.find(p => p.id === line[1]);
        
        if (p1 && p2) {
            const scoreDiff = p1.score - p2.score;
            const relativeDiff = scoreDiff / scoreRange;
            
            if (relativeDiff >= 0.30) {
                const penalty = 1.0 - (relativeDiff - 0.30) * 0.15;
                p2.final_score *= penalty; 
                logMessage(`[C_split] ライン ${line.join('-')} は不均衡リスク(${relativeDiff.toFixed(2)})で番手(${p2.id})に減点。`);
            }
        }
    });

    // 7. C_pace (序盤速度・燃焼リスク)
    const leaderPlayer = tempPlayers.find(p => p.style === '自' || p.style === '両');
    if (leaderPlayer) {
        const rivalsCount = lines.length - 1;
        const baseScore = leaderPlayer.score;

        if (baseScore >= 105.0 && rivalsCount >= 2) {
             leaderPlayer.final_score *= 0.94;
             logMessage(`[C_pace] 逃げ選手ID ${leaderPlayer.id} はライバルが多く燃焼リスクで減点。`);
        }
    }


    // 8. C_timing (仕掛け位置補正)
    tempPlayers.forEach(p => {
        if (p.style === '両') {
            const line = lines.find(l => l.includes(p.id));
            if (line && line.indexOf(p.id) >= 1) {
                p.final_score *= 0.97;
                logMessage(`[C_timing] 選手ID ${p.id} は捲りにもかかわらず不利な位置で減点。`);
            }
        }
    });


    // 9. C_guard (番手防衛能力係数)
    lines.forEach(line => {
        const p2 = tempPlayers.find(p => p.id === line[1]);
        if (p2) {
            const lowScoreThreshold = scoreMin + scoreRange * 0.4;
            let baseRisk = 1.0;
            if (p2.score < lowScoreThreshold) {
                baseRisk = 0.95;
            }
            
            const attackers = tempPlayers.filter(p => p.id !== p2.id && (p.style === '自' || p.style === '両')).length;
            if (attackers >= 2) {
                baseRisk *= 0.95;
            }
            
            p2.final_score *= baseRisk;
            logMessage(`[C_guard] 番手選手ID ${p2.id} に防衛リスク (${(1.0-baseRisk).toFixed(2)}) を適用。`);
        }
    });

    logMessage("[KOUTENREI] C係数計算が完了しました。");
    return tempPlayers;
}


// ----------------------------------------------------------------------
// ★ 新規ヘルパー関数: runScenarioSimulation (計算ロジックの本体) ★
// ----------------------------------------------------------------------
/**
 * 展開シミュレーションを実行し、結果と統合スコアを返す。
 * @param {Array<Object>} basePlayers - 基礎係数適用済みの選手データ
 * @param {Array<Array<number>>} lines - ライン構成
 * @param {Object} settings - 級班設定
 * @param {Object} bankData - バンクデータ
 * @param {boolean} applyKoutenrei - 荒天令バイアス (C係数) を適用するかどうか
 * @returns {{allScenarioResults: Array, integratedScores: Object}}
 */
function runScenarioSimulation(basePlayers, lines, settings, bankData, applyKoutenrei) {
    
    const scenarios = ['先行有利', '捲り有利', '差し有利'];
    const allScenarioResults = [];
    const integratedScores = {}; 

    basePlayers.forEach(p => integratedScores[p.id] = 0);

    scenarios.forEach(scenario => {
        const cDCoeffs = getScenarioCoeffs(scenario);
        
        let scenarioPlayers = JSON.parse(JSON.stringify(basePlayers));

        // 基礎スコア (C係数適用前のスコア)
        scenarioPlayers.forEach(p => {
            p.final_score = p.score * p.c_score_adj * p.c_wmark * p.c_recent * p.c_s1 * p.c_b1 * p.c_l * p.c_e;
        });

        // 荒天令モードの場合、C係数バイアスを適用
        if (applyKoutenrei) {
            scenarioPlayers = calculate_koutenrei_bias(scenarioPlayers, lines, scenario, bankData);
        }

        scenarioPlayers.forEach(p => {
            // C係数適用後の final_score に cDCoeffs (展開係数) を乗算する
            const cD = cDCoeffs[p.style] || 1.0;
            p.final_score = p.final_score * cD; 
            
            integratedScores[p.id] += p.final_score; 
        });

        scenarioPlayers.sort((a, b) => b.final_score - a.final_score);
        
        assignFinalGrades(scenarioPlayers);

        allScenarioResults.push({ scenario, results: scenarioPlayers });
    });

    return { allScenarioResults, integratedScores };
}


// ----------------------------------------------------------------------
// ★ 修正後のロジック関数: calculateTenunIndex (一致率に基づく) ★
// ----------------------------------------------------------------------
/**
 * 晴天令と荒天令のランキング上位3名の一致率を計算し、天雲指数 (0, 33, 67, 100) とメッセージを返す。
 * @param {Object} seitenreiScores - 晴天令の統合スコア
 * @param {Object} koutenreiScores - 荒天令の統合スコア
 * @returns {{tenunIndex: number, message: string}} 0〜100の天雲指数と対応するメッセージ
 */
function calculateTenunIndex(seitenreiScores, koutenreiScores) {
    // 1. スコアをランキングに変換
    const seitenreiRanking = Object.keys(seitenreiScores).map(id => ({ id: Number(id), score: seitenreiScores[id] })).sort((a, b) => b.score - a.score);
    const koutenreiRanking = Object.keys(koutenreiScores).map(id => ({ id: Number(id), score: koutenreiScores[id] })).sort((a, b) => b.score - a.score);
    
    // 2. 上位3名の選手IDを取得 (7車立て未満の場合は処理しない)
    if (seitenreiRanking.length < 3 || koutenreiRanking.length < 3) {
        return { tenunIndex: 50, message: 'データ不足のため指数算出不可' };
    }
    const seitenTop3 = new Set(seitenreiRanking.slice(0, 3).map(p => p.id));
    const koutenTop3 = koutenreiRanking.slice(0, 3).map(p => p.id); // Setと比較するためArrayのまま

    // 3. 一致選手数をカウント
    let matchCount = 0;
    koutenTop3.forEach(id => {
        if (seitenTop3.has(id)) {
            matchCount++;
        }
    });

    // 4. 一致選手数に基づき天雲指数 (0, 33, 67, 100) とメッセージを算出
    let tenunIndex;
    let message = '';

    switch (matchCount) {
        case 3:
            tenunIndex = 0; // 絶対安定
            message = '☀️ **これは稀に見る大安吉日！晴天令の信頼度、揺るぎなしと見ますぞ！**';
            break;
        case 2:
            tenunIndex = 33; // 比較安定
            message = '🔮 **なるほど、比較的穏やかな気配ですじゃ。軸は堅いが紐は広めに。**';
            break;
        case 1:
            tenunIndex = 67; // 波乱注意
            message = '⛈️ **天の気配に乱れあり！荒天令の特異点を強く警戒すべきでしょう。**';
            break;
        case 0:
            tenunIndex = 100; // 強い荒天
            message = '💥 **うむむ…これは強い荒天の気が出ておる…何かが起こりますぞ！**';
            break;
        default:
            tenunIndex = 50;
            message = '算出ロジックエラー';
    }

    logMessage(`[TENUN] 晴天/荒天 上位3名一致数: ${matchCount}名。天雲指数: ${tenunIndex}`);
    return { tenunIndex, message };
}


// ----------------------------------------------------------------------
// ★ 新規ヘルパー関数: runScenarioSimulation (計算ロジックの本体) ★
// ----------------------------------------------------------------------
/**
 * 展開シミュレーションを実行し、結果と統合スコアを返す。
 * @param {Array<Object>} basePlayers - 基礎係数適用済みの選手データ
 * @param {Array<Array<number>>} lines - ライン構成
 * @param {Object} settings - 級班設定
 * @param {Object} bankData - バンクデータ
 * @param {boolean} applyKoutenrei - 荒天令バイアス (C係数) を適用するかどうか
 * @returns {{allScenarioResults: Array, integratedScores: Object}}
 */
function runScenarioSimulation(basePlayers, lines, settings, bankData, applyKoutenrei) {
    
    const scenarios = ['先行有利', '捲り有利', '差し有利'];
    const allScenarioResults = [];
    const integratedScores = {}; 

    basePlayers.forEach(p => integratedScores[p.id] = 0);

    scenarios.forEach(scenario => {
        const cDCoeffs = getScenarioCoeffs(scenario);
        
        let scenarioPlayers = JSON.parse(JSON.stringify(basePlayers));

        // 基礎スコア (C係数適用前のスコア)
        scenarioPlayers.forEach(p => {
            p.final_score = p.score * p.c_score_adj * p.c_wmark * p.c_recent * p.c_s1 * p.c_b1 * p.c_l * p.c_e;
        });

        // 荒天令モードの場合、C係数バイアスを適用
        if (applyKoutenrei) {
            scenarioPlayers = calculate_koutenrei_bias(scenarioPlayers, lines, scenario, bankData);
        }

        scenarioPlayers.forEach(p => {
            // C係数適用後の final_score に cDCoeffs (展開係数) を乗算する
            const cD = cDCoeffs[p.style] || 1.0;
            p.final_score = p.final_score * cD; 
            
            integratedScores[p.id] += p.final_score; 
        });

        scenarioPlayers.sort((a, b) => b.final_score - a.final_score);
        
        assignFinalGrades(scenarioPlayers);

        allScenarioResults.push({ scenario, results: scenarioPlayers });
    });

    return { allScenarioResults, integratedScores };
}


// ----------------------------------------------------------------------
// ★ 3. メイン計算関数: calculatePrediction の置換 (両モード実行ロジックへ) ★
// ----------------------------------------------------------------------
// メイン計算関数
async function calculatePrediction() {
    
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

    // UIから現在の選択モードを取得
    const modeSelector = document.getElementById('mode-selector');
    const koutenreiModeSelected = modeSelector ? modeSelector.value === 'koutenrei' : false;

    let players = getPlayerData();
    
    logMessage(`[CALC START] ${raceType} / バンク: ${bankName} で計算開始。モード: ${koutenreiModeSelected ? '荒天令' : '晴天令'}`);

    // --- I. C_L (ライン・連係係数) の計算とライン強度の表示 ---
    const lines = calculateLineCoeffs(players, settings); 

    // --- II. 選手固有係数 C_W, C_R, C_S1, C_B1 & C_E の計算 (基礎係数) ---
    // この係数は両モードで共通して使用される
    let basePlayers = JSON.parse(JSON.stringify(players));
    basePlayers.forEach(p => {
        p.c_score_adj = 1.0 + (p.score / 100 - 1) * settings.R_BIAS; 
        const recentScores = p.recent.split('').map(Number);
        const avgRank = recentScores.length > 0 ? recentScores.reduce((a, b) => a + b, 0) / recentScores.length : 4.0; 
        p.c_recent = (1.0 + (4 - avgRank) * 0.05) * settings.RECENT_WEIGHT; 

        if (p.wmark === '◎') p.c_wmark = 1.04;
        else if (p.wmark === '〇') p.c_wmark = 1.02;
        else if (p.wmark === '✕') p.c_wmark = 1.015; 
        else if (p.wmark === '△') p.c_wmark = 1.01;
        else p.c_wmark = 1.0; 

        p.c_s1 = p.is_s1 ? 1.005 : 1.0; 
        p.c_b1 = p.is_b1 ? 1.015 : 1.0; 

        let c_e = 1.0;
        let biasKey = '';
        if (p.style === '自') biasKey = '先行';
        else if (p.style === '両') biasKey = '捲り'; 
        else if (p.style === '追') biasKey = '差し'; 

        const keirinBias = bankData.keirin_bias[biasKey] || 1.0;
        c_e *= keirinBias;
        p.c_e = c_e;
    });


    // --- III. シミュレーション実行 (晴天令と荒天令の同時実行) ---

    // 1. ☀️ 晴天令シミュレーション (C係数適用なし)
    const seitenreiResults = runScenarioSimulation(basePlayers, lines, settings, bankData, false);
    logMessage("[CALC] 晴天令 (安定) シミュレーションが完了しました。");

    // 2. ⛈️ 荒天令シミュレーション (C係数適用あり)
    const koutenreiResults = runScenarioSimulation(basePlayers, lines, settings, bankData, true);
    logMessage("[CALC] 荒天令 (波乱) シミュレーションが完了しました。");


    // --- IV. 最終結果の統合と表示 ---
    
    // 詳細テーブル (scenario-output) に表示する結果は、UIで選択されたモードに合わせる
    const detailedScenarioResults = koutenreiModeSelected ? 
                                    koutenreiResults.allScenarioResults : 
                                    seitenreiResults.allScenarioResults;

    displayResults(
        detailedScenarioResults,
        seitenreiResults.integratedScores,
        koutenreiResults.integratedScores,
        bankName
    ); 
    
    const resultsContainer = document.getElementById('results-container');
    if (resultsContainer) {
        resultsContainer.classList.add('visible');
    }
    
    logMessage('[CALC END] 予想計算が完了し、結果が表示されました。');
}


// ----------------------------------------------------------------------
// ★ 修正後の表示関数: displayResults (メッセージ出力ロジックを追加) ★
// ----------------------------------------------------------------------
// ★修正: 統合スコアを晴天令用と荒天令用の2つ受け取る
function displayResults(detailedScenarioResults, seitenreiIntegratedScores, koutenreiIntegratedScores, bankName) { 
    
    // バンク展開傾向の再表示（実行結果エリアの先頭）
    displayBankTendency();

    // ----------------------------------------------------------
    // ★ 天雲指数 (占い師メッセージ) の計算と表示 ★
    // ----------------------------------------------------------
    // ★修正: 新しいロジックで天雲指数とメッセージを取得
    const tenunIndexData = calculateTenunIndex(seitenreiIntegratedScores, koutenreiIntegratedScores);
    const tenunIndex = tenunIndexData.tenunIndex; 
    const oracleMessage = tenunIndexData.message;

    // 1. メッセージに応じてクラスを割り当ててデザインを分岐させる
    let messageClass = '';
    if (tenunIndex === 0) messageClass = 'tenun-stable';
    else if (tenunIndex === 33) messageClass = 'tenun-mild';
    else if (tenunIndex === 67) messageClass = 'tenun-alert';
    else if (tenunIndex === 100) messageClass = 'tenun-severe';

    // 2. 占い師メッセージの生成 (数値は小さく表示)
    // 既存の天雲指数計算ロジック（scoreDiffに基づくもの）を完全に削除しました。
    const tenunHtml = `
        <div class="tenun-index-container ${messageClass}">
            <h4>⚫ 天雲指数（てんうんしすう）</h4>
            <p class="fortune-teller-message">
                <strong>🔮🐢</strong>＜${oracleMessage}＞
            </p>
            <p class="index-value-small">（内部スコア: ${tenunIndex}）</p>
        </div>
    `;

    const tenunOutput = document.getElementById('tenun-index-output');
    if (tenunOutput) {
        tenunOutput.innerHTML = tenunHtml;
    }
    // ----------------------------------------------------------
    
    // シナリオ詳細 (三連複は generateScenarioWagers 内でソート済み)
    const scenarioOutput = document.getElementById('scenario-output');
    if (scenarioOutput) {
        scenarioOutput.innerHTML = detailedScenarioResults.map(s => {
            const wagers = generateScenarioWagers(s.results); 
            
            return `
                <div class="scenario-detail">
                    <h4>${s.scenario}シミュレーション</h4>
                    <p><strong>三連単 (3点):</strong> ${wagers.tritan}</p>
                    <p><strong>三連複 (2点):</strong> ${wagers.trifuku}</p>
                    <table>
                        <tr><th>選手ID</th><th>評価</th><th class="hide-score-rank">スコア</th><th class="hide-score-rank">順位</th></tr>
                        ${s.results.map((p) => `
                            <tr>
                                <td>${p.id}</td>
                                <td><strong>${p.grade}${p.strength_mark}</strong></td>
                                <td class="hide-score-rank">${p.final_score.toFixed(3)}</td>
                                <td class="hide-score-rank">${p.id === s.results[0].id ? '1位' : ''}</td>
                            </tr>
                        `).join('')}
                    </table>
                </div>
            `;
        }).join('');
    }

    // --- ☀️ 晴天令 (安定推奨) の表示 ---
    
    const seitenreiRanking = Object.keys(seitenreiIntegratedScores).map(id => ({
        id: Number(id),
        score: seitenreiIntegratedScores[id] / detailedScenarioResults.length
    })).sort((a, b) => b.score - a.score); 

    const seitenTop3 = seitenreiRanking.slice(0, 3).map(p => p.id);
    const seitenTop4 = seitenreiRanking.slice(0, 4).map(p => p.id);
    
    const seitenTritan = [
        `${seitenTop3[0]}-${seitenTop3[1]}-${seitenTop3[2]}`,
        `${seitenTop3[0]}-${seitenTop3[2]}-${seitenTop3[1]}`,
        `${seitenTop3[1]}-${seitenTop3[0]}-${seitenTop3[2]}`
    ].join(', ');

    // ★修正: 三連複の組み合わせを昇順ソートする
    const triSeiten1 = [...seitenTop4.slice(0, 3)].sort((a, b) => a - b).join('='); // 1, 2, 3
    let triSeiten2;
    if (seitenTop4.length >= 4) {
        triSeiten2 = [seitenTop4[0], seitenTop4[1], seitenTop4[3]].sort((a, b) => a - b).join('='); // 1, 2, 4
    } else {
        triSeiten2 = 'データ不足';
    }
    const seitenTrifuku = [triSeiten1, triSeiten2].join(', ');
        
    const seitenreiOutput = document.getElementById('seitenrei-output');
    if (seitenreiOutput) {
        seitenreiOutput.innerHTML = `
            三連単 (3点): <strong>${seitenTritan}</strong><br>
            三連複 (2点): <strong>${seitenTrifuku}</strong>
        `;
    }


    // --- ⛈️ 荒天令 (高配当狙い) の表示 ---
    
    const koutenreiRanking = Object.keys(koutenreiIntegratedScores).map(id => ({
        id: Number(id),
        score: koutenreiIntegratedScores[id] / detailedScenarioResults.length
    })).sort((a, b) => b.score - a.score); 

    const koutenTop3 = koutenreiRanking.slice(0, 3).map(p => p.id);
    const koutenTop4 = koutenreiRanking.slice(0, 4).map(p => p.id);
    
    // 荒天令の軸 (C係数適用後のランキングで4位)
    const koutenLeader = koutenTop4.length >= 4 ? koutenTop4[3] : null; 
    
    let koutenTrifuku = '';
    if (koutenLeader) {
        // ★修正: 荒天令の三連複3点の組み合わせをそれぞれ昇順ソートする
        const koutenComb1 = [koutenLeader, koutenTop3[0], koutenTop3[1]].sort((a, b) => a - b).join('='); // 4=1=2
        const koutenComb2 = [koutenLeader, koutenTop3[0], koutenTop3[2]].sort((a, b) => a - b).join('='); // 4=1=3
        const koutenComb3 = [koutenLeader, koutenTop3[1], koutenTop3[2]].sort((a, b) => a - b).join('='); // 4=2=3

        koutenTrifuku = [koutenComb1, koutenComb2, koutenComb3].join(', ');
    } else {
        koutenTrifuku = 'データ不足のため生成不可';
    }

    const koutenreiOutput = document.getElementById('koutenrei-output');
    if (koutenreiOutput) {
        koutenreiOutput.innerHTML = `
            ⚫ 特異点 : **${koutenLeader ? koutenLeader : 'N/A'}**<br>
            三連複 (3点): <strong>${koutenTrifuku}</strong>
        `;
    }
}
