// 真自在律 実質Ver7.4 - 日本語コメント & ログ機密保持強化版,競りライン追加版
// 【V7.3】消耗ペナルティ適用拡大 ＆ 複数競り表示修正
// 【V7.4】壱耀メッセージ追加 ＆ 買い目変更
//
// ------------------------------------------------------------------------------------
// 🗃️ 係数設定オブジェクトの分離 (COEFFICIENT SETTINGS)
// ------------------------------------------------------------------------------------
const COEFFICIENT_SETTINGS = {
    // R_BIAS: 得点傾斜補正 / RECENT_WEIGHT: 3走着順の影響度 / COOP_WEIGHT: ライン結束力
    's-kyu': { R_BIAS: 1.15, RECENT_WEIGHT: 0.90, COOP_WEIGHT: 1.20, IS_GIRLS: false },
    'a-kyu': { R_BIAS: 1.00, RECENT_WEIGHT: 1.00, COOP_WEIGHT: 1.00, IS_GIRLS: false },
    'a-chal': { R_BIAS: 0.90, RECENT_WEIGHT: 1.20, COOP_WEIGHT: 0.80, IS_GIRLS: false },
    'girls': { R_BIAS: 1.00, RECENT_WEIGHT: 1.10, COOP_WEIGHT: 1.00, IS_GIRLS: true },
}; 

const C_MARK_VALUES = { // ガールズ競輪におけるエースマーク選手（番手）へのライン係数
    HIGH: 1.12, 
    MEDIUM: 1.08, 
    LOW: 1.03
}; 

// ========== 競り専用係数 (SERI-SPECIFIC COEFFICIENTS) ==========
const SERI_STYLE_BONUS = { // 脚質別競り係数 C_style (追込重視: 競り力の基礎値)
    '追': 1.05, 
    '両': 1.00, 
    '自': 0.95  
};
const SERI_FATIGUE_PENALTY_IN = 0.15;  // 競り勝った側（イン）の体力消耗減点 $\Delta_{in}$
const SERI_FATIGUE_PENALTY_OUT = 0.25; // 競り負けた側（アウト）の体力消耗減点 $\Delta_{out}$
const SERI_WIN_BONUS = 0.05;           // 競り勝ち選手への微増補正
// =======================================

let BANK_DATA = {}; 

// --- フリーズ対策: Debounce (入力待ち) の仕組み ---
let calculationTimeout;
function debouncedCalculate() {
    clearTimeout(calculationTimeout);
    calculationTimeout = setTimeout(() => {
        calculate();
    }, 200);
}

// ====================================================================================
// 💥 壱耀晴乾ノ象 (いちようせいかんのしょう) 判定ロジック (事前計算)
// ====================================================================================

// 確定した優位性の閾値 (中立的中率 2.06% 以上)
const SUPERIORITY_THRESHOLD_RATE = 0.0206;

// 複合集計データ（天運指数 x 脚質ごとの三連単3点買い的中率）
const RAW_COMPOSITE_STATS = [
    { pattern_key: "0_差し", hit_rate: 0.0309 },
    { pattern_key: "33_逃げ", hit_rate: 0.0206 },
];

function calculateSuperiorityList() {
    const superiorPatterns = [];
    const targetPatterns = ["0_差し"];
    for (const data of RAW_COMPOSITE_STATS) {
        const key = data.pattern_key;
        const rate = data.hit_rate;
        if (targetPatterns.includes(key) && rate >= SUPERIORITY_THRESHOLD_RATE) {
            superiorPatterns.push(key);
        }
    }
    return superiorPatterns;
}

const SUPERIOR_PATTERNS_FINAL_LIST = calculateSuperiorityList();

// ロギング関数 (メモリ対策版)
function logMessage(message) { 
    const logArea = document.getElementById('debug-log'); 
    if (!logArea) return;

    if (logArea.children.length > 100) {
        logArea.removeChild(logArea.firstChild);
    }

    const timestamp = new Date().toLocaleTimeString('ja-JP', { hour12: false }); 
    logArea.insertAdjacentHTML('beforeend', `[${timestamp}] ${message}<br>`);
    
    requestAnimationFrame(() => {
        logArea.scrollTop = logArea.scrollHeight;
    });
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

        const score = parseFloat(row.querySelector('.score').value) || 0;
        const style = row.querySelector('.style').value;
        const wmark = row.querySelector('.wmark').value.trim();
        const isScratchCheckbox = row.querySelector('.is-scratch');
        const is_scratch = isScratchCheckbox ? isScratchCheckbox.checked : false;
        
        players.push({ 
            id: id, 
            score: score, 
            style: style, 
            wmark: wmark, 
            recent: row.querySelector('.recent').value.trim(), 
            is_s1: id === s1Id, 
            is_b1: id === b1Id,
            is_scratch: is_scratch,
            c_score_adj: 1.0, 
            c_recent: 1.0, 
            c_wmark: 1.0, 
            c_s1: 1.0, 
            c_b1: 1.0, 
            c_l: 1.0, 
            c_e: 1.0, 
            final_score: 0,
            seri_coef: score * (SERI_STYLE_BONUS[style] || 1.00) * (wmark === '◎' ? 1.04 : 1.0)
        }); 
    }); 
    return players;
} 

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
            displayBankTendency(); 
        } 
    } catch (error) { 
        logMessage(`[FATAL ERROR] データ読み込み処理中に重大なエラーが発生: ${error.message}`); 
        BANK_DATA = { 
            'ダミーバンク': { length: 400, keirin_bias: { '先行': 1.0, '捲り': 1.0, '差し': 1.0 }, wind_or_position: {} } 
        }; 
        const bankSelect = document.getElementById('bank-name'); 
        if (bankSelect) { 
            bankSelect.innerHTML = '<option value="ダミーバンク">データ読み込み失敗</option>'; 
        }
    }
} 

function displayBankTendency() { 
    const bankName = document.getElementById('bank-name').value; 
    const displayArea = document.getElementById('bank-tendency-display'); 
    
    if (!bankName || !BANK_DATA[bankName] || !displayArea) { 
        if (displayArea) displayArea.innerHTML = ''; 
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

(async function() { 
    await loadBankData();
})(); 

function parseLineInput(lineInput, allPlayers) {
    logMessage(`[PARSE] ライン入力解析開始: ${lineInput}`);
    const processedLineInput = lineInput.replace(/\s/g, '');
    const segments = processedLineInput.split(',');
    
    const lines = []; 
    let orderedPlayerIds = []; 
    const allSeriInfos = []; 
    const displayLineSegments = [];
    const allParsedIds = new Set();
    
    const seriPattern = /(\d)\((\d)\)/; 

    segments.forEach(seg => {
        let currentLine = []; 
        let segOrderedIds = [];
        let remainingSeg = seg; 
        
        while (remainingSeg.length > 0) {
            let seriMatch = remainingSeg.match(seriPattern);
            if (seriMatch) {
                const seriStart = seriMatch.index;
                if (seriStart > 0) {
                    const numericalPart = remainingSeg.substring(0, seriStart);
                    numericalPart.split('').map(Number).filter(id => id > 0).forEach(id => {
                        if (!allParsedIds.has(id)) {
                            segOrderedIds.push(id);
                            allParsedIds.add(id);
                        }
                        displayLineSegments.push({ type: 'single', id: id });
                        currentLine.push(id);
                    });
                }
                const follower = parseInt(seriMatch[1]); 
                const contender = parseInt(seriMatch[2]); 
                logMessage(`[PARSE] 競り検出: 選手${follower} (イン) vs 選手${contender} (アウト)`);
                const followerCoef = allPlayers.find(p => p.id === follower)?.seri_coef || 0;
                const contenderCoef = allPlayers.find(p => p.id === contender)?.seri_coef || 0;
                const winner = followerCoef >= contenderCoef ? follower : contender;
                const loser = followerCoef >= contenderCoef ? contender : follower;
                allSeriInfos.push({ follower, contender, winner, loser });
                [follower, contender].forEach(id => {
                    if (!allParsedIds.has(id)) {
                        segOrderedIds.push(id);
                        allParsedIds.add(id);
                    }
                });
                displayLineSegments.push({ type: 'seri', follower, contender });
                currentLine.push(winner);
                lines.push([loser]);
                remainingSeg = remainingSeg.substring(seriStart + seriMatch[0].length);
            } else {
                remainingSeg.split('').map(Number).filter(id => id > 0).forEach(id => {
                    if (!allParsedIds.has(id)) {
                        segOrderedIds.push(id);
                        allParsedIds.add(id);
                    }
                    displayLineSegments.push({ type: 'single', id: id });
                    currentLine.push(id);
                });
                remainingSeg = "";
            }
        }
        if (currentLine.length > 0) lines.push(currentLine);
        orderedPlayerIds = orderedPlayerIds.concat(segOrderedIds);
    });
    return { lines, allSeriInfos, orderedPlayerIds, displayLineSegments };
}

function calculate() { 
    logMessage("[CALC START] 予想計算を開始します..."); 
    const raceType = document.getElementById('race-type').value; 
    const settings = COEFFICIENT_SETTINGS[raceType]; 
    const bankName = document.getElementById('bank-name').value; 
    const bankData = BANK_DATA[bankName]; 
    
    if (!bankData) { 
        logMessage("[ERROR] バンクデータが選択されていないか、読み込まれていません。"); 
        return; 
    } 

    const allPlayers = getPlayerData(); 
    const participatingPlayers = allPlayers.filter(p => !p.is_scratch && p.score > 0); 
    
    if (participatingPlayers.length < 2) { 
        logMessage("[ERROR] 出走選手が不足しています (2名以上必要)。"); 
        return; 
    } 

    const lineInput = document.getElementById('line-input').value; 
    const { lines, allSeriInfos, orderedPlayerIds, displayLineSegments } = parseLineInput(lineInput, participatingPlayers); 
    
    const finalOrderedPlayerIds = [...orderedPlayerIds];
    participatingPlayers.forEach(p => {
        if (!finalOrderedPlayerIds.includes(p.id)) {
            finalOrderedPlayerIds.push(p.id);
        }
    });

    logMessage(`[CALC] 級班設定: ${raceType} (R_BIAS: ${settings.R_BIAS})`); 
    logMessage(`[CALC] バンク設定: ${bankName} (${bankData.length}m)`); 

    const basePlayers = JSON.parse(JSON.stringify(participatingPlayers)); 
    basePlayers.forEach(p => { 
        p.c_score_adj = p.score * settings.R_BIAS; 
        const recentArr = p.recent.split('').map(Number).filter(n => !isNaN(n)); 
        const recentAvg = recentArr.length > 0 ? recentArr.reduce((a, b) => a + b, 0) / recentArr.length : 4.0; 
        p.c_recent = (5.0 - recentAvg) * settings.RECENT_WEIGHT; 
        p.c_wmark = p.wmark === '◎' ? 1.10 : p.wmark === '○' ? 1.05 : p.wmark === '△' ? 1.02 : 1.0; 
        p.c_s1 = p.is_s1 ? 1.08 : 1.0; 
        p.c_b1 = p.is_b1 ? 1.05 : 1.0; 
        
        let biasKey = ''; 
        if (p.style === '自') biasKey = '先行'; 
        else if (p.style === '両') biasKey = '捲り'; 
        else if (p.style === '追') biasKey = '差し'; 
        const keirinBias = bankData.keirin_bias[biasKey] || 1.0; 
        p.c_e = keirinBias; 
        
        logMessage(`[C_BASIC] 選手ID ${p.id}: 基礎係数 ($C_{W}, C_{R}, C_{S1}, C_{B1}, C_{E}$) の算出が完了しました。`);
    }); 

    const seitenreiResults = runScenarioSimulation(basePlayers, allSeriInfos, settings, bankData, false); 
    logMessage("[CALC] 晴天令 (安定) シミュレーションが完了しました。"); 
    const koutenreiResults = runScenarioSimulation(basePlayers, allSeriInfos, settings, bankData, true); 
    logMessage("[CALC] 荒天令 (波乱) シミュレーションが完了しました。"); 

    const koutenreiModeSelected = false; 
    const detailedScenarioResults = koutenreiModeSelected ? koutenreiResults.allScenarioResults : seitenreiResults.allScenarioResults; 

    const finalTenunData = calculateTenunIndex(
        seitenreiResults.integratedScores, 
        koutenreiResults.integratedScores, 
        seitenreiResults.allScenarioResults, 
        participatingPlayers
    );

    displayResults( 
        detailedScenarioResults, 
        seitenreiResults.integratedScores, 
        koutenreiResults.integratedScores, 
        bankName,
        allSeriInfos, 
        finalOrderedPlayerIds, 
        seitenreiResults.allScenarioResults, 
        participatingPlayers,
        displayLineSegments,
        finalTenunData 
    ); 
    
    const resultsContainer = document.getElementById('results-container'); 
    if (resultsContainer) { 
        resultsContainer.classList.add('visible'); 
    } 
    
    logMessage('[CALC END] 予想計算が完了し、結果が表示されました。');
} 

function runScenarioSimulation(basePlayers, allSeriInfos, settings, bankData, isKoutenrei) {
    const integratedScores = {}; 
    basePlayers.forEach(p => integratedScores[p.id] = 0); 
    const allScenarioResults = []; 
    
    const scenarios = isKoutenrei ? [
        { name: '荒天・強襲', bias: 1.15 }, 
        { name: '荒天・混戦', bias: 1.05 }
    ] : [
        { name: '晴天・順当', bias: 1.00 }, 
        { name: '晴天・微風', bias: 1.02 }
    ]; 

    scenarios.forEach(scenario => { 
        let scenarioPlayers = JSON.parse(JSON.stringify(basePlayers)); 
        
        scenarioPlayers.forEach(p => { 
            let base = p.c_score_adj + p.c_recent; 
            p.final_score = base * p.c_wmark * p.c_s1 * p.c_b1 * p.c_e * scenario.bias; 
            if (isKoutenrei) { 
                p.final_score *= (0.9 + Math.random() * 0.2); 
            } 
        }); 

        if (isKoutenrei) { 
            calculate_koutenrei_bias(scenarioPlayers, scenario.name, bankData); 
        } 

        scenarioPlayers.sort((a, b) => b.final_score - a.final_score); 
        assignFinalGrades(scenarioPlayers); 
        
        allScenarioResults.push({ 
            scenario: scenario.name, 
            results: scenarioPlayers 
        }); 
        
        scenarioPlayers.forEach(p => { 
            integratedScores[p.id] += p.final_score; 
        }); 
    }); 

    return { integratedScores, allScenarioResults }; 
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
                    logMessage(`[C_split] ライン ${line.join('-')} は不均衡リスクで番手(${p2.id})に減点処理を適用。`); 
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
                    logMessage(`[C_timing] 選手ID ${p.id} は捲りにもかかわらず不利な位置で減点処理を適用。`); 
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
                logMessage(`[C_guard] 番手選手ID ${p2.id} に防衛リスクの処理を適用。`); 
            } 
        }); 
    }); 

    // 10. C_suicide (自滅消耗ペナルティ：Weight印集中リスク) 
    logMessage("[C_suicide] V7.1 自滅消耗ペナルティの計算を開始...");
    const SUICIDE_PENALTY = 0.90; 
    const BOOTY_BONUS = 1.05;      
    let isSuicideRiskDetected = false;
    let suicideRiskLineMembers = new Set();

    lines.forEach(line => {
        if (line.length >= 2) {
            const leader = tempPlayers.find(p => p.id === line[0]);
            const follower = tempPlayers.find(p => p.id === line[1]);
            if (leader && follower && leader.wmark === '◎' && follower.wmark === '◎') {
                isSuicideRiskDetected = true;
                line.forEach(id => suicideRiskLineMembers.add(id));
                logMessage(`[C_suicide] ライン ${line.join('-')} に自滅消耗リスク(◎印重複)を検出。`);
            }
        }
    });

    if (isSuicideRiskDetected) {
        tempPlayers.forEach(p => {
            if (suicideRiskLineMembers.has(p.id)) {
                p.final_score *= SUICIDE_PENALTY;
                logMessage(`[C_suicide] 選手ID ${p.id} に自滅減点(${SUICIDE_PENALTY})を適用。`);
            } else {
                p.final_score *= BOOTY_BONUS;
                logMessage(`[C_suicide] 選手ID ${p.id} は漁夫の利増点(${BOOTY_BONUS})を適用。`);
            }
        });
    }
}

function generateScenarioWagers(results) { 
    const top3 = results.slice(0, 3).map(p => p.id); 
    const tritan = [ 
        `${top3[0]}-${top3[1]}-${top3[2]}`, 
        `${top3[0]}-${top3[2]}-${top3[1]}`, 
        `${top3[1]}-${top3[0]}-${top3[2]}` 
    ].join(', '); 
    
    const top4 = results.slice(0, 4).map(p => p.id); 
    const tri1 = [...top4.slice(0, 3)].sort((a, b) => a - b).join('='); 
    
    let tri2 = ''; 
    if (top4.length >= 4) { 
        tri2 = [top4[0], top4[1], top4[3]].sort((a, b) => a - b).join('='); 
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

function calculateTenunIndex(seitenreiIntegratedScores, koutenreiIntegratedScores, allScenarioResults, participatingPlayers) {
    const sRanking = Object.keys(seitenreiIntegratedScores).map(id => ({ id: Number(id), score: seitenreiIntegratedScores[id] })).sort((a, b) => b.score - a.score);
    const kRanking = Object.keys(koutenreiIntegratedScores).map(id => ({ id: Number(id), score: koutenreiIntegratedScores[id] })).sort((a, b) => b.score - a.score);
    
    const sTop3 = sRanking.slice(0, 3).map(p => p.id).sort().join(',');
    const kTop3 = kRanking.slice(0, 3).map(p => p.id).sort().join(',');
    
    let diffCount = 0;
    const sTop5 = sRanking.slice(0, 5).map(p => p.id);
    const kTop5 = kRanking.slice(0, 5).map(p => p.id);
    sTop5.forEach(id => { if (!kTop5.includes(id)) diffCount++; });

    let index = 0;
    if (sTop3 !== kTop3) index += 40;
    index += diffCount * 12;
    index = Math.min(100, index);

    const isIchiyo = (index >= 30 && kRanking[0].id === sRanking[sRanking.length - 1].id);
    
    if (typeof getTamakiMessage === 'function') {
        return {
            index: index,
            message: getTamakiMessage(index, isIchiyo, kRanking[0].id)
        };
    }
    return { index: index, message: `天雲指数: ${index}` };
}

function displayResults(detailedScenarioResults, seitenreiIntegratedScores, koutenreiIntegratedScores, bankName, allSeriInfos, finalOrderedPlayerIds, allScenarioResults, participatingPlayers, displayLineSegments, tenunIndexData) { 
    displayBankTendency(); 

    const finalScores = Object.keys(seitenreiIntegratedScores).map(id => ({ 
        id: Number(id), 
        score: seitenreiIntegratedScores[id] / detailedScenarioResults.length 
    }));
    
    const allScores = finalScores.map(p => p.score);
    const maxScore = allScores.length > 0 ? Math.max(...allScores) : 0; 
    const minScore = allScores.length > 0 ? Math.min(...allScores) : 0; 
    
    const playerIdToScore = {};
    finalScores.forEach(p => { playerIdToScore[p.id] = p.score; });

    const lineDisplay = document.getElementById('line-display'); 
    let displayHtml = ''; 

    displayLineSegments.forEach((segment) => {
        if (segment.type === 'single') {
            const id = segment.id;
            const score = playerIdToScore[id]; 
            if (score === undefined) return; 
            const rgbColor = getStrengthColor(score, minScore, maxScore);
            const textColor = getTextColor(rgbColor);
            displayHtml += `<span class="line-box strength-color" style="background-color: ${rgbColor}; color: ${textColor};">${id}</span>`;
        } else if (segment.type === 'seri') {
            const followerId = segment.follower; 
            const contenderId = segment.contender; 
            const scoreF = playerIdToScore[followerId];
            const scoreC = playerIdToScore[contenderId];
            if (scoreF === undefined || scoreC === undefined) return; 
            const rgbColorF = getStrengthColor(scoreF, minScore, maxScore);
            const textColorF = getTextColor(rgbColorF);
            const rgbColorC = getStrengthColor(scoreC, minScore, maxScore);
            const textColorC = getTextColor(rgbColorC);
            displayHtml += `<span class="seri-segment">(<span class="line-box strength-color" style="background-color: ${rgbColorF}; color: ${textColorF};">${followerId}</span><span class="seri-arrow">←</span><span class="line-box strength-color" style="background-color: ${rgbColorC}; color: ${textColorC};">${contenderId}</span>)</span>`;
        }
    });
    
    if (lineDisplay) lineDisplay.innerHTML = displayHtml; 

    let seriSummaryHtml = '';
    if (allSeriInfos.length > 0) {
        seriSummaryHtml += `<div style="padding: 10px; margin-bottom: 15px; border: 2px solid #c07777; background-color: #fcf0f0; border-radius: 6px;"><h4>⚠️ 競り発生！</h4>`;
        allSeriInfos.forEach((info, index) => {
            let prefix = (index === 0) ? '最初の競りは、' : '<strong>さらに、</strong>';
            seriSummaryHtml += `<p>${prefix}選手<strong>${info.follower}</strong> vs 選手<strong>${info.contender}</strong>。予測勝者は **選手${info.winner}** です。</p>`;
        });
        seriSummaryHtml += `<p style="font-size: 0.9em; color: #c07777;">※体力消耗による減点補正が適用されています。</p></div>`;
    }

    const tenunOutput = document.getElementById('tenun-index-output'); 
    if (tenunOutput && tenunIndexData) tenunOutput.innerHTML = tenunIndexData.message; 

    const seitenreiRanking = Object.keys(seitenreiIntegratedScores).map(id => ({ id: Number(id), score: seitenreiIntegratedScores[id] })).sort((a, b) => b.score - a.score);
    const seitenreiBets = generateSeitenreiBets(seitenreiRanking);
    const seitenreiBox = document.getElementById('seitenrei-output');
    if (seitenreiBox && seitenreiBets) {
        let html = '<h4>☀️ 晴天令</h4><strong>三連単</strong><ul>';
        seitenreiBets.sanrentan.forEach(b => html += `<li>${formatOrderedBet(b)}</li>`);
        html += '</ul><strong>三連複</strong><ul>';
        seitenreiBets.sanrenpuku.forEach(b => html += `<li>${formatSanrenpuku(b)}</li>`);
        html += '</ul>';
        seitenreiBox.innerHTML = html;
    }

    const koutenreiRanking = Object.keys(koutenreiIntegratedScores).map(id => ({ id: Number(id), score: koutenreiIntegratedScores[id] })).sort((a, b) => b.score - a.score);
    const L = koutenreiRanking.length >= 4 ? koutenreiRanking[3].id : null;
    const koutenreiBets = generateKoutenreiBets(koutenreiRanking, L);
    const koutenreiBox = document.getElementById('koutenrei-output');
    if (koutenreiBox && koutenreiBets) {
        let html = '<h4>⛈️ 荒天令</h4>';
        if (L) html += `<p><strong>⚫ 特異点：</strong>${L}</p>`;
        html += '<strong>三連複</strong><ul>';
        koutenreiBets.sanrenpuku.forEach(b => html += `<li>${formatSanrenpuku(b)}</li>`);
        html += '</ul><strong>二車単</strong><ul>';
        koutenreiBets.nirentan.forEach(b => html += `<li>${formatOrderedBet(b)}</li>`);
        html += '</ul>';
        koutenreiBox.innerHTML = html;
    }
      
    const scenarioOutput = document.getElementById('scenario-output'); 
    if (scenarioOutput) { 
        scenarioOutput.innerHTML = seriSummaryHtml;
        scenarioOutput.innerHTML += detailedScenarioResults.map(s => { 
            const wagers = generateScenarioWagers(s.results); 
            return `<div class="scenario-detail"><h4>${s.scenario}シミュレーション</h4><p><strong>三連単:</strong> ${wagers.tritan}</p><p><strong>三連複:</strong> ${wagers.trifuku}</p><table><tr><th>選手ID</th><th>評価</th></tr>${s.results.map((p) => `<tr><td>${p.id}</td><td><strong>${p.grade}${p.strength_mark}</strong></td></tr>`).join('')}</table></div>`; 
        }).join(''); 
    } 
}

function getStrengthColor(score, minScore, maxScore) {
    if (maxScore === minScore) return 'rgb(142, 142, 142)';
    const normalizedScore = (score - minScore) / (maxScore - minScore);
    const r = Math.round(52 + (231 - 52) * normalizedScore);
    const g = Math.round(152 + (76 - 152) * normalizedScore);
    const b = Math.round(219 + (60 - 219) * normalizedScore);
    return `rgb(${r}, ${g}, ${b})`;
}

function getTextColor(rgbColor) {
    const match = rgbColor.match(/\d+/g);
    if (!match || match.length < 3) return '#fff';
    const luminance = (0.2126 * parseInt(match[0]) + 0.7152 * parseInt(match[1]) + 0.0722 * parseInt(match[2])) / 255;
    return luminance > 0.5 ? '#333' : '#fff';
}

function formatOrderedBet(bet) { return bet.join('-'); }
function formatSanrenpuku(bet) { return bet.slice().sort((a, b) => a - b).join('='); }

function generateSeitenreiBets(ranking) {
    if (!ranking || ranking.length < 3) return null;
    const [r1, r2, r3] = [ranking[0].id, ranking[1].id, ranking[2].id];
    return { sanrentan: [[r1, r2, r3], [r2, r1, r3], [r1, r3, r2], [r2, r3, r1]], sanrenpuku: [[r1, r2, r3]] };
}

function generateKoutenreiBets(ranking, L) {
    if (!ranking || ranking.length < 3 || !L) return null;
    const [r1, r2, r3] = [ranking[0].id, ranking[1].id, ranking[2].id];
    return { sanrenpuku: [[r1, r2, L], [r1, r3, L]], nirentan: [[r1, L], [L, r1], [r1, r3]] };
}

document.querySelectorAll('select').forEach(select => {
    select.addEventListener('change', () => {
        select.blur();
        window.scrollBy(0, 1);
        window.scrollBy(0, -1);
    });
});
