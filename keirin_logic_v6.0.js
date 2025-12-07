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

// ★修正: 競り情報格納用のグローバル変数を追加★
let PLAYERS_FACING_SERI = []; 
let SERI_ATTACKERS = []; 

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

        // ★修正: HTML要素が存在しない場合にクラッシュしないよう、ガードを追加
        const scoreElement = row.querySelector('.score');
        const styleElement = row.querySelector('.style');
        const wmarkElement = row.querySelector('.wmark');
        const recentElement = row.querySelector('.recent');

        players.push({
            id: id,
            score: scoreElement ? parseFloat(scoreElement.value) || 0 : 0,
            style: styleElement ? styleElement.value : '追', // デフォルト値設定
            wmark: wmarkElement ? wmarkElement.value.trim() : '', 
            recent: recentElement ? recentElement.value.trim() : '44444', // デフォルト値設定
            
            is_s1: id === s1Id,
            is_b1: id === b1Id,

            c_score_adj: 1.0, c_recent: 1.0, c_wmark: 1.0, c_s1: 1.0, c_b1: 1.0, c_l: 1.0, c_e: 1.0,
            final_score: 0
        });
    });
    return players;
}

// 銀行データの非同期読み込み (変更なし)
async function loadBankData() {
// ... (変更なし)
}

// バンク展開傾向の表示関数 (変更なし)
function displayBankTendency() {
// ... (変更なし)
}

// ページロード時にデータ読み込みを実行 (変更なし)
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
        
        lineInput.split(',').forEach(part => { 
            let tempPart = part;
            let match;

            // ★修正: 競り情報 (X(Y)) の解析ロジックを追加★
            // 括弧内の競り情報を抽出 (例: 12(3)4(5) の中の (3) や (5))
            const seriRegex = /\((\d+)\)/g;
            
            while ((match = seriRegex.exec(part)) !== null) {
                // 選手IDを明示的に Number() で変換し、堅牢性を高める
                const attackerId = Number(match[1]); 
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
            const members = tempPart.split('').map(idStr => Number(idStr)).filter(id => id > 0);
            
            if (members.length >= 2) { 
                lines.push(members);
                members.forEach(id => {
                    playerToLineMap[id] = lineCounter;
                    assignedPlayerIds.add(id);
                });
                lineCounter++;
            } else if (members.length === 1) { 
                 const id = members[0];
                 playerToLineMap[id] = 0; // 単騎はラインID 0
                 assignedPlayerIds.add(id);
            }
        });
    }

    // 単騎選手を特定
    const soloPlayers = Array.from(allPlayerIds).filter(id => !assignedPlayerIds.has(id));
    soloPlayers.forEach(id => playerToLineMap[id] = 0); 

    // C_L係数計算 (ライン結束力/エースマーク) (変更なし)
    if (settings.IS_GIRLS) {
// ... (変更なし)
    } 
    else {
// ... (変更なし)
    }

    // ライン強度の視覚化出力 (競りマークの表示を追加)
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
            // ★修正: 競り発生中の選手は特別なマークを付ける★
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
// ... (変更なし)
}

function generateScenarioWagers(results) {
// ... (変更なし)
}

function assignFinalGrades(scenarioPlayers) {
// ... (変更なし)
}


// ----------------------------------------------------------------------
// ★ 修正ロジック関数: calculate_koutenrei_bias ★
// ----------------------------------------------------------------------
function calculate_koutenrei_bias(players, lines, scenario, bankData) {
    
    logMessage("[KOUTENREI] 荒天令リスクバイアス (C係数) の計算を開始...");

    let tempPlayers = JSON.parse(JSON.stringify(players));
    
    const allScores = players.map(p => p.score);
    const scoreMax = Math.max(...allScores);
    const scoreMin = Math.min(...allScores);
    const scoreRange = scoreMax - scoreMin;
    
    // ★修正: ゼロ除算ガードを追加★
    const isScoreRangeZero = scoreRange <= 0 || allScores.length <= 1;
    if (isScoreRangeZero) {
        logMessage("[KOUTENREI: WARNING] スコア範囲がゼロ (0) または選手数が少ないため、相対評価に基づくC係数（C_recovery, C_splitなど）の適用をスキップします。");
    }

    // --- C係数の計算と適用 ---
    
    // 1. C_guard (競りによる消耗・防衛ペナルティ) (競り表記がある場合を優先) ★追加★
    tempPlayers.forEach(p => {
        let seriRisk = 1.0;
        
        if (SERI_ATTACKERS.includes(p.id)) {
            seriRisk *= 0.93; 
            logMessage(`[C_guard] 選手ID ${p.id} は競り仕掛け中（-7%減点）。`);
        } 
        
        if (PLAYERS_FACING_SERI.includes(p.id)) {
            seriRisk *= 0.97; 
            logMessage(`[C_guard] 選手ID ${p.id} は競りを防衛中（-3%減点）。`);
        }
        
        p.final_score = p.final_score * seriRisk;
    });

    // --- その他のC係数の計算と適用 ---

    tempPlayers.forEach(p => {
        let C_TOTAL = 1.0; 
        
        // 1. C_short (走路距離補正)
        if (bankData.length === 333) {
            C_TOTAL *= 0.985;
            logMessage(`[C_short] 短走路(${bankData.length}m)ブースト適用。`);
        }

        // 2. C_risk (接触・落車リスク) (変更なし)
        const avgScore = allScores.reduce((a, b) => a + b, 0) / allScores.length;
        const recentAvg = p.recent.split('').map(Number).reduce((a, b) => a + b, 0) / p.recent.length || 4.0;
        
        if (p.score < avgScore - 2.0 && recentAvg >= 4.0) {
             C_TOTAL *= 0.97; 
             logMessage(`[C_risk] 選手ID ${p.id} は不安定指数が高いため減点。`);
        }

        // 3. C_mental (メンタル・疲労減衰) (変更なし)
        const raceGrade = document.getElementById('race-type').value;
        const isHighPressure = ['s-kyu'].includes(raceGrade) || (p.score === scoreMax);
        
        if (isHighPressure && p.recent.startsWith('1')) {
            C_TOTAL *= 0.96; 
            logMessage(`[C_mental] 選手ID ${p.id} はプレッシャー減点適用 (${raceGrade})。`);
        }

        // 4. C_recovery (位置取り回復力)
        // ★修正: ゼロ除算ガードを適用★
        if (!isScoreRangeZero && (p.style === '両' || p.style === '追')) {
             const scoreDiffRatio = (p.score - scoreMin) / scoreRange;
             if (scoreDiffRatio > 0.8) {
                 C_TOTAL *= 1.03 + (scoreDiffRatio - 0.8) * 0.1;
                 logMessage(`[C_recovery] 選手ID ${p.id} は実力回復力で増点 (${scoreDiffRatio.toFixed(2)})。`);
             }
        }
        
        // 最終的なC係数をスコアに乗算 (元のロジック)
        p.final_score = p.final_score * C_TOTAL;
    });

    // 5. C_target (ターゲット・包囲網) (変更なし)
    const targetPlayer = tempPlayers.find(p => p.score === scoreMax);
    if (targetPlayer) {
// ... (変更なし)
    }

    // 6. C_split (ライン不均衡リスク)
    lines.forEach(line => {
        const p1 = tempPlayers.find(p => p.id === line[0]);
        const p2 = tempPlayers.find(p => p.id === line[1]);
        
        // ★修正: ゼロ除算ガードを適用★
        if (p1 && p2 && !isScoreRangeZero) { 
            const scoreDiff = p1.score - p2.score;
            const relativeDiff = scoreDiff / scoreRange;
            
            if (relativeDiff >= 0.30) {
                const penalty = 1.0 - (relativeDiff - 0.30) * 0.15;
                p2.final_score *= penalty; 
                logMessage(`[C_split] ライン ${line.join('-')} は不均衡リスク(${relativeDiff.toFixed(2)})で番手(${p2.id})に減点。`);
            }
        }
    });

    // 7. C_pace (序盤速度・燃焼リスク) (変更なし)
    const leaderPlayer = tempPlayers.find(p => p.style === '自' || p.style === '両');
    if (leaderPlayer) {
// ... (変更なし)
    }


    // 8. C_timing (仕掛け位置補正) (変更なし)
    tempPlayers.forEach(p => {
// ... (変更なし)
    });


    // 9. C_guard (番手防衛能力係数) (競り表記がない場合のロジック)
    // ★修正: 競り表記がない場合のみ実行するようガードを追加★
    lines.forEach(line => {
        const p2 = tempPlayers.find(p => p.id === line[1]);
        if (p2 && !PLAYERS_FACING_SERI.includes(p2.id)) { // 競りを受けている選手には適用しない
            
            // ★修正: ゼロ除算ガードを適用★
            let lowScoreThreshold = -Infinity;
            if (!isScoreRangeZero) {
                 lowScoreThreshold = scoreMin + scoreRange * 0.4;
            }

            let baseRisk = 1.0;
            if (!isScoreRangeZero && p2.score < lowScoreThreshold) {
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
// runScenarioSimulation, calculateTenunIndex (変更なし)
// ----------------------------------------------------------------------


// ----------------------------------------------------------------------
// ★ 3. メイン計算関数: calculatePrediction の修正 (try...catch と競りリセット) ★
// ----------------------------------------------------------------------
// メイン計算関数
async function calculatePrediction() {
    
    // ★修正: 競り情報グローバル変数を実行前に確実にリセット★
    PLAYERS_FACING_SERI = [];
    SERI_ATTACKERS = [];

    // ★修正: 全体を try...catch で囲み、堅牢性を向上★
    try {
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
        logMessage(`[LINE] 解析ライン数: ${lines.length}。競り仕掛け: ${SERI_ATTACKERS.length}名。`); // ★ログ追加★

        // --- II. 選手固有係数 C_W, C_R, C_S1, C_B1 & C_E の計算 (基礎係数) ---
        // ... (この部分は変更なし)
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

        // ★修正: 元の displayResults 関数が呼び出され、詳細な結果が表示される★
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

    } catch (error) {
        // --- 💥 致命的なエラーが発生した場合、ここに情報が出力されます 💥 ---
        logMessage(" ");
        logMessage("--- 💥 FATAL CRASH CATCHED (V6.0-DB) 💥 ---");
        logMessage(`エラー名: **${error.name}**`);
        logMessage(`メッセージ: **${error.message}**`);
        logMessage(`スタック: ${error.stack ? error.stack.split('\n')[1].trim() : 'N/A'}`); // 詳細な行番号を追記
        logMessage("----------------------------------");
        logMessage(`【重要】原因特定のため、上記の**エラー名**と**メッセージ**の全文を共有してください。`);
    }
}
