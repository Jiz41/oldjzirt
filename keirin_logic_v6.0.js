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

// ★競り情報格納用のグローバル変数を追加 (修正1)★
let PLAYERS_FACING_SERI = []; // 競りを受けている選手ID (防衛側: 例 2, 4)
let SERI_ATTACKERS = [];     // 競りを仕掛けている選手ID (消耗側: 例 3, 5)

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
    
    // ★競り情報をリセット (修正2: 開始)★
    PLAYERS_FACING_SERI = [];
    SERI_ATTACKERS = [];

    const lineInput = document.getElementById('line-input').value;
    const lines = []; 
    const playerToLineMap = {}; 
    const allPlayerIds = new Set(players.map(p => p.id));
    let assignedPlayerIds = new Set();
    
    if (lineInput && lineInput.includes(',')) {
        let lineCounter = 1;
        
        lineInput.split(',').forEach(part => { // lineStr -> part に変更
            let currentLine = [];
            let tempPart = part;
            let match;

            // 括弧内の競り情報を抽出 (例: 12(3)4(5) の中の (3) や (5))
            const seriRegex = /\((\d+)\)/g;
            
            while ((match = seriRegex.exec(part)) !== null) {
                const attackerId = Number(match[1]); // 括弧内の数字 (例: 3, 5)
                SERI_ATTACKERS.push(attackerId);
                assignedPlayerIds.add(attackerId);
                
                // 競りを受けている選手（括弧の直前）を特定する
                const indexBeforeParen = match.index - 1;
                if (indexBeforeParen >= 0) {
                    const defenderIdStr = part[indexBeforeParen];
                    const defenderId = Number(defenderIdStr);
                    
                    if (!isNaN(defenderId) && defenderId > 0) {
                        PLAYERS_FACING_SERI.push(defenderId);
                    }
                }
                
                // 処理を簡単にするため、競り情報部分は一時的に削除する
                tempPart = tempPart.replace(match[0], '');
            }

            // 競り情報を取り除いた後の確定ラインの選手を解析 (例: 124)
            const members = tempPart.split('').map(Number).filter(id => id > 0);
            
            if (members.length >= 2) { // 競り選手を除いたラインメンバーが2名以上
                lines.push(members);
                members.forEach(id => {
                    playerToLineMap[id] = lineCounter;
                    assignedPlayerIds.add(id);
                });
                lineCounter++;
            } else if (members.length === 1) { // 競り選手を除いたラインメンバーが1名の場合 (単騎扱い)
                 const id = members[0];
                 playerToLineMap[id] = 0; // 単騎はラインID 0
                 assignedPlayerIds.add(id);
            }
        });
    }

    // 単騎選手を特定
    const soloPlayers = Array.from(allPlayerIds).filter(id => !assignedPlayerIds.has(id));
    soloPlayers.forEach(id => playerToLineMap[id] = 0); 
    // ★修正2: 終了★

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
            // 競り選手も単騎またはラインカラーで表示される
            if (lineId === 0) {
                className = 'line-solo';
            } else {
                className = `line-color-${lineId}`;
            }
            // 競り発生中の選手は特別なマークを付ける
            let seriMark = '';
            if (SERI_ATTACKERS.includes(id)) {
                 seriMark = '⚔️'; 
            } else if (PLAYERS_FACING_SERI.includes(id)) {
                 seriMark = '🛡️';
            }

            displayHtml += `<span class="line-box ${className}">${id}${seriMark}</span>`;
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
// ★ 修正ロジック関数: calculate_koutenrei_bias の追加 ★
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

    // 1. C_guard (競りによる消耗・防衛ペナルティ) ★修正3: 競りペナルティの統合★
    tempPlayers.forEach(p => {
        let seriRisk = 1.0;
        
        // 🚨 競りを仕掛けている選手 (消耗側: 例 3, 5) へのペナルティ
        if (SERI_ATTACKERS.includes(p.id)) {
            // 仕掛けによる激しい体力消耗と不利な状況を反映し、重く減点
            seriRisk *= 0.93; // 7%減点 (ユーザー要望)
            logMessage(`[C_guard] 選手ID ${p.id} は競り仕掛け中（-7%減点）。`);
        } 
        
        // 🚨 競りを受けている選手 (防衛側: 例 2, 4) へのペナルティ
        if (PLAYERS_FACING_SERI.includes(p.id)) {
            // 防衛行動による消耗、集中力低下を反映し、軽く減点
            seriRisk *= 0.97; // 3%減点
            logMessage(`[C_guard] 選手ID ${p.id} は競りを防衛中（-3%減点）。`);
        }
        
        // C_guard 係数に競りリスクを適用 (他のC係数に先立って適用)
        p.final_score = p.final_score * seriRisk;
    });

    // --- その他のC係数の計算と適用 (スコープ外の変数に依存しないよう、処理をループ分け) ---

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
             if (scoreDiffRatio > 0.6) { 
                 C_TOTAL *= 1.04 + (scoreDiffRatio - 0.6) * 0.1; 
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
             leaderPlayer.final_score *= 0.96; 
             logMessage(`[C_pace] 逃げ選手ID ${leaderPlayer.id} はライバルが多く燃焼リスクを緩和。`);
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


    // 9. C_guard (番手防衛能力係数) (競り表記がない場合のロジック)
    // NOTE: 競り表記によるペナルティは既にループ外で適用済み。ここでは競り表記がないラインの番手を評価。
    lines.forEach(line => {
        const p2 = tempPlayers.find(p => p.id === line[1]);
        
        if (p2 && !PLAYERS_FACING_SERI.includes(p2.id)) { // 競り表記がない番手のみを評価
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
            logMessage(`[C_guard] 番手選手ID ${p2.id} に防衛リスク (${(1.0-baseRisk).toFixed(2)}) を適用 (競り表記なし)。`);
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
            // C_guard (競りペナルティ) の適用を calculate_koutenrei_bias 内で最初に行うため、
            // 競りペナルティ適用前のスコアを final_score に保持したまま関数を呼び出す
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
