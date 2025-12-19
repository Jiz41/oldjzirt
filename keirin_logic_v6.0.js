// 真自在律 実質Ver7.3 - 日本語コメント & ログ機密保持強化版
// 競りライン追加版
// 【V7.3 最終修正】消耗ペナルティ適用拡大 ＆ 複数競り表示修正

// ------------------------------------------------------------------------------------
// 🗃️ 係数設定オブジェクト (COEFFICIENT SETTINGS)
// ------------------------------------------------------------------------------------
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

const SERI_STYLE_BONUS = { 
    '追': 1.05, 
    '両': 1.00, 
    '自': 0.95  
};
const SERI_FATIGUE_PENALTY_IN = 0.15;  
const SERI_FATIGUE_PENALTY_OUT = 0.25; 
const SERI_WIN_BONUS = 0.05;           

let BANK_DATA = {}; 

const SUPERIORITY_THRESHOLD_RATE = 0.0206;
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
        const score = parseFloat(row.querySelector('.score').value) || 0;
        const style = row.querySelector('.style').value;
        const wmark = row.querySelector('.wmark').value.trim();
        const isScratchCheckbox = row.querySelector('.is-scratch');
        const is_scratch = isScratchCheckbox ? isScratchCheckbox.checked : false;
        
        players.push({ 
            id: id, score: score, style: style, wmark: wmark, 
            recent: row.querySelector('.recent').value.trim(), 
            is_s1: id === s1Id, is_b1: id === b1Id, is_scratch: is_scratch,
            c_score_adj: 1.0, c_recent: 1.0, c_wmark: 1.0, c_s1: 1.0, c_b1: 1.0, c_l: 1.0, c_e: 1.0, final_score: 0,
            seri_coef: score * (SERI_STYLE_BONUS[style] || 1.00) * (wmark === '◎' ? 1.04 : 1.0)
        }); 
    }); 
    return players;
} 

async function loadBankData() { 
    try { 
        logMessage("[INIT] bankdata.jsonの読み込みを開始します..."); 
        const response = await fetch('bankdata.json'); 
        if (!response.ok) throw new Error('Bank data failed to load.'); 
        BANK_DATA = await response.json(); 
        logMessage(`[SUCCESS] bankdata.jsonを正常に読み込みました。`); 
        const bankSelect = document.getElementById('bank-name'); 
        if (bankSelect) { 
            bankSelect.innerHTML = ''; 
            Object.keys(BANK_DATA).forEach(bankName => { 
                const option = document.createElement('option'); 
                option.value = bankName; option.textContent = bankName; 
                bankSelect.appendChild(option); 
            }); 
            displayBankTendency(); 
        } 
    } catch (error) { 
        logMessage(`[FATAL ERROR] ${error.message}`); 
        BANK_DATA = { 'ダミーバンク': { length: 400, keirin_bias: { '先行': 1.0, '捲り': 1.0, '差し': 1.0 }, wind_or_position: {} } }; 
    }
} 

function displayBankTendency() { 
    const bankName = document.getElementById('bank-name').value; 
    const displayArea = document.getElementById('bank-tendency-display'); 
    if (!bankName || !BANK_DATA[bankName] || !displayArea) return; 
    const bias = BANK_DATA[bankName].keirin_bias; 
    const biasMap = { '先行': bias['先行'] || 1.0, '捲り': bias['捲り'] || 1.0, '差し': bias['差し'] || 1.0 }; 
    let maxBias = -Infinity; let strongestTendency = ''; 
    const styleMap = { '先行': '逃先', '捲り': '捲り', '差し': '差マ' }; 
    Object.keys(biasMap).forEach(key => { if (biasMap[key] > maxBias) { maxBias = biasMap[key]; strongestTendency = key; } }); 
    let message = maxBias > 1.03 ? `⚠️ **${bankName}**は**${styleMap[strongestTendency]}**が**出やすい**傾向があります。` : `ℹ️ 大きな傾向差はありません。`;
    displayArea.innerHTML = message; 
} 

(async function() { await loadBankData(); })(); 

function parseLineInput(lineInput, allPlayers) {
    const processedLineInput = lineInput.replace(/\s/g, '');
    const segments = processedLineInput.split(',');
    const lines = []; let orderedPlayerIds = []; const allSeriInfos = []; const displayLineSegments = []; const allParsedIds = new Set();
    const seriPattern = /(\d)\((\d)\)/; 

    segments.forEach(seg => {
        let currentLine = []; let segOrderedIds = []; let remainingSeg = seg; 
        while (remainingSeg.length > 0) {
            let seriMatch = remainingSeg.match(seriPattern);
            if (seriMatch) {
                const seriStart = seriMatch.index; const seriEnd = seriStart + seriMatch[0].length;
                if (seriStart > 0) {
                    remainingSeg.substring(0, seriStart).split('').map(Number).filter(id => id > 0).forEach(id => {
                        if (!allParsedIds.has(id)) { segOrderedIds.push(id); allParsedIds.add(id); }
                        displayLineSegments.push({ type: 'single', id: id }); currentLine.push(id);
                    });
                }
                const follower = parseInt(seriMatch[1]); const contender = parseInt(seriMatch[2]);
                const followerCoef = allPlayers.find(p => p.id === follower)?.seri_coef || 0;
                const contenderCoef = allPlayers.find(p => p.id === contender)?.seri_coef || 0;
                let winnerId = (followerCoef >= contenderCoef) ? follower : contender;
                let loserId = (followerCoef >= contenderCoef) ? contender : follower;
                allSeriInfos.push({ exists: true, follower, contender, winner: winnerId, loser: loserId });
                currentLine.push(winnerId); lines.push([loserId]); 
                if (!allParsedIds.has(follower)) { segOrderedIds.push(follower); allParsedIds.add(follower); }
                if (!allParsedIds.has(contender)) { segOrderedIds.push(contender); allParsedIds.add(contender); }
                displayLineSegments.push({ type: 'seri', follower, contender });
                remainingSeg = remainingSeg.substring(seriEnd);
            } else {
                remainingSeg.split('').map(Number).filter(id => id > 0).forEach(id => {
                    if (!allParsedIds.has(id)) { segOrderedIds.push(id); allParsedIds.add(id); }
                    displayLineSegments.push({ type: 'single', id: id }); currentLine.push(id);
                });
                remainingSeg = "";
            }
        }
        if (currentLine.length > 0) lines.push(currentLine);
        orderedPlayerIds.push(...segOrderedIds);
    });
    return { lines, allSeriInfos, orderedPlayerIds: Array.from(new Set(orderedPlayerIds)), displayLineSegments };
}

function calculateLineCoeffs(players, settings) { 
    const participatingPlayers = players.filter(p => !p.is_scratch);
    if (participatingPlayers.length === 0) return { players: [], allSeriInfos: [], finalOrderedPlayerIds: [], displayLineSegments: [] }; 
    const lineInput = document.getElementById('line-input').value; 
    const { lines: initialLines, allSeriInfos, orderedPlayerIds, displayLineSegments } = parseLineInput(lineInput, participatingPlayers); 
    
    let lines = [...initialLines]; 
    let finalOrderedPlayerIds = [...orderedPlayerIds]; 
    let finalSegments = [...displayLineSegments];
    const playerIdsSet = new Set(orderedPlayerIds);
    const allRidersInLines = new Set();
    lines.forEach(line => line.forEach(id => allRidersInLines.add(id)));

    participatingPlayers.forEach(p => {
        if (!playerIdsSet.has(p.id)) { finalOrderedPlayerIds.push(p.id); finalSegments.push({ type: 'single', id: p.id }); }
        if (!allRidersInLines.has(p.id)) lines.push([p.id]); 
    });

    participatingPlayers.forEach(p => { 
        if (!settings.IS_GIRLS) {
            lines.forEach(line => { 
                if (line.length >= 2) {
                    for (let i = 1; i < line.length; i++) { if (line[i] === p.id) p.c_l = settings.COOP_WEIGHT || 1.0; }
                }
            });
        }
    }); 
    return { players: participatingPlayers, allSeriInfos, finalOrderedPlayerIds, displayLineSegments: finalSegments };
} 

function applySeriCorrection(scoredPlayers, allSeriInfos) {
    allSeriInfos.forEach(info => {
        const winner = scoredPlayers.find(p => p.id === info.winner);
        if (winner) winner.final_score = winner.final_score * (1 + SERI_WIN_BONUS) * (1 - SERI_FATIGUE_PENALTY_IN);
        const loser = scoredPlayers.find(p => p.id === info.loser);
        if (loser) loser.final_score *= (1 - SERI_FATIGUE_PENALTY_OUT);
    });
    return scoredPlayers;
}

function getScenarioCoeffs(scenario) {
    if (scenario === '先行有利') return { '自': 1.05, '追': 1.02, '両': 1.03 }; 
    if (scenario === '捲り有利') return { '自': 1.00, '追': 1.05, '両': 1.04 }; 
    if (scenario === '差し有利') return { '自': 0.90, '追': 1.08, '両': 1.05 }; 
    return { '自': 1.0, '追': 1.0, '両': 1.0 };
} 

function generateScenarioWagers(results) {
    const top3 = results.slice(0, 3).map(p => p.id); 
    const tritan = [`${top3[0]}-${top3[1]}-${top3[2]}`, `${top3[0]}-${top3[2]}-${top3[1]}`, `${top3[1]}-${top3[0]}-${top3[2]}`].join(', '); 
    const top4 = results.slice(0, 4).map(p => p.id); 
    const tri1 = [...top4.slice(0, 3)].sort((a, b) => a - b).join('='); 
    let tri2 = top4.length >= 4 ? [top4[0], top4[1], top4[3]].sort((a, b) => a - b).join('=') : ''; 
    return { tritan, trifuku: [tri1, tri2].filter(t => t.length > 0).join(', ') };
} 

function assignFinalGrades(scenarioPlayers) {
    if (scenarioPlayers.length === 0) return; 
    const scores = scenarioPlayers.map(p => p.final_score); 
    const maxScore = scores[0]; const minScore = scores[scores.length - 1]; const range = maxScore - minScore; 
    scenarioPlayers.forEach(p => { 
        p.grade = range > 0 ? Math.ceil(1 + 9 * (p.final_score - minScore) / range) : 1; 
        p.grade = Math.min(10, Math.max(1, p.grade)); 
    }); 
    scenarioPlayers.forEach((p, i) => { 
        if (i === scenarioPlayers.length - 1) { p.strength_mark = '→'; return; }
        const next = scenarioPlayers[i+1]; const diff = p.final_score - next.final_score;
        p.strength_mark = diff >= (range/1000) ? '↑' : (diff >= (range/10000) ? '↗' : '→');
    });
} 

function calculate_koutenrei_bias(players, scenario, bankData) { 
    let tempPlayers = JSON.parse(JSON.stringify(players)); 
    const allScores = players.map(p => p.score); 
    const scoreMax = Math.max(...allScores); const scoreMin = Math.min(...allScores); const scoreRange = scoreMax - scoreMin; 
    const lineInput = document.getElementById('line-input').value;
    const { lines } = parseLineInput(lineInput, tempPlayers); 

    tempPlayers.forEach(p => { 
        if (bankData.length === 333) p.final_score *= 0.985; 
        const avgScore = allScores.reduce((a,b)=>a+b,0)/allScores.length;
        if (p.score < avgScore - 2.0) p.final_score *= 0.97; 
        if (p.score === scoreMax && p.recent.startsWith('1')) p.final_score *= 0.96; 
        if ((p.style === '両' || p.style === '追') && (p.score - scoreMin)/scoreRange > 0.6) p.final_score *= 1.05;
        if (p.score === scoreMax && tempPlayers.filter(x=>x.id!==p.id&&(x.style==='自'||x.style==='両')).length >= 2) p.final_score *= 0.95; 
        lines.forEach(l => { if(l[0] && l[1] === p.id && (tempPlayers.find(x=>x.id===l[0]).score - p.score)/scoreRange >= 0.3) p.final_score *= 0.92; });
    }); 

    const lineEvaluations = {};
    lines.forEach((line, index) => {
        let totalWeightScore = 0; let hasSelfStarter = false;
        line.forEach(id => {
            const player = tempPlayers.find(p => p.id === id); 
            if (player && (player.wmark === '◎' || player.wmark === '〇' || player.wmark === '△')) totalWeightScore += 1;
            if (player && (player.style === '自' || player.style === '両')) hasSelfStarter = true;
        });
        lineEvaluations[index] = { lineLength: line.length, totalWeightScore, hasSelfStarter, members: line };
    });
    
    Object.keys(lineEvaluations).forEach(idx => {
        const ev = lineEvaluations[idx];
        if (ev.lineLength >= 3 && ev.totalWeightScore === 3 && ev.hasSelfStarter) {
            tempPlayers.forEach(p => { 
                if (ev.members.includes(p.id)) p.final_score *= 0.90; 
                else p.final_score *= 1.05;
            });
        }
    });
    return tempPlayers;
} 

function runScenarioSimulation(basePlayers, allSeriInfos, settings, bankData, applyKoutenrei) { 
    const scenarios = ['先行有利', '捲り有利', '差し有利']; 
    const allScenarioResults = []; const integratedScores = {}; 
    basePlayers.forEach(p => integratedScores[p.id] = 0);
    scenarios.forEach(scenario => { 
        const cDCoeffs = getScenarioCoeffs(scenario); 
        let scenarioPlayers = JSON.parse(JSON.stringify(basePlayers)); 
        scenarioPlayers.forEach(p => { p.final_score = p.score * p.c_score_adj * p.c_wmark * p.c_recent * p.c_s1 * p.c_b1 * p.c_l * p.c_e; }); 
        scenarioPlayers = applySeriCorrection(scenarioPlayers, allSeriInfos);
        if (applyKoutenrei) scenarioPlayers = calculate_koutenrei_bias(scenarioPlayers, scenario, bankData); 
        scenarioPlayers.forEach(p => { 
            p.final_score *= (cDCoeffs[p.style] || 1.0); 
            integratedScores[p.id] += p.final_score; 
        }); 
        scenarioPlayers.sort((a, b) => b.final_score - a.final_score); 
        assignFinalGrades(scenarioPlayers); 
        allScenarioResults.push({ scenario, results: scenarioPlayers }); 
    }); 
    return { allScenarioResults, integratedScores };
} 

function calculateTenunIndex(seitenreiScores, koutenreiScores, allScenarioResults, participatingPlayers) { 
    const seitenreiRanking = Object.keys(seitenreiScores).map(id => ({ id: Number(id), score: seitenreiScores[id] })).sort((a, b) => b.score - a.score); 
    const koutenreiRanking = Object.keys(koutenreiScores).map(id => ({ id: Number(id), score: koutenreiScores[id] })).sort((a, b) => b.score - a.score); 
    if (seitenreiRanking.length < 3 || koutenreiRanking.length < 3) return { tenunIndex: 50, superiorHtml: '' }; 
    
    const seitenTop3 = new Set(seitenreiRanking.slice(0, 3).map(p => p.id)); 
    const koutenTop3 = koutenreiRanking.slice(0, 3).map(p => p.id); 
    let matchCount = 0; koutenTop3.forEach(id => { if (seitenTop3.has(id)) matchCount++; }); 

    let tenunIndex; 
    switch (matchCount) { 
        case 3: tenunIndex = 0; break; 
        case 2: tenunIndex = 33; break; 
        case 1: tenunIndex = 67; break; 
        case 0: tenunIndex = 100; break; 
        default: tenunIndex = 50; 
    } 

    let superiorHtml = ''; 
    if (tenunIndex === 0) {
        const axisPlayer = participatingPlayers.find(p => p.style === '追' && (p.wmark === '◎' || p.wmark === '〇'));
        if (axisPlayer && SUPERIOR_PATTERNS_FINAL_LIST.includes(`${tenunIndex}_差し`)) {
            const sashi = allScenarioResults.find(s => s.scenario === '差し有利');
            if (sashi && sashi.results.length >= 2 && (axisPlayer.id === sashi.results[0].id || axisPlayer.id === sashi.results[1].id)) {
                logMessage(`[ICHIOU] 壱耀晴乾ノ象 発動条件クリア: 選手ID ${axisPlayer.id}`);
                superiorHtml = window.generateTamakiTenunHTML(tenunIndex, true, axisPlayer.id);
            }
        }
    }
    return { tenunIndex, superiorHtml }; 
} 

async function calculatePrediction() { 
    const tenunOutputArea = document.getElementById('tenun-index-output');
    if (tenunOutputArea && typeof window.generateTamakiObservingHTML === 'function') tenunOutputArea.innerHTML = window.generateTamakiObservingHTML();
    await new Promise(resolve => setTimeout(resolve, 100));

    if (Object.keys(BANK_DATA).length === 0) await loadBankData(); 

    const raceType = document.getElementById('race-type').value; 
    const settings = COEFFICIENT_SETTINGS[raceType]; 
    const bankName = document.getElementById('bank-name').value; 
    const bankData = BANK_DATA[bankName]; 
    if (!bankData) return; 

    const modeSelector = document.getElementById('mode-selector'); 
    const koutenreiModeSelected = modeSelector ? modeSelector.value === 'koutenrei' : false; 
    let players = getPlayerData(); 
    const { players: participatingPlayers, allSeriInfos, finalOrderedPlayerIds, displayLineSegments } = calculateLineCoeffs(players, settings); 
    if (participatingPlayers.length === 0) return;

    let basePlayers = JSON.parse(JSON.stringify(participatingPlayers)); 
    basePlayers.forEach(p => { 
        p.c_score_adj = 1.0 + (p.score / 100 - 1) * settings.R_BIAS; 
        const recentScores = p.recent.split('').map(Number); 
        const avgRank = recentScores.length > 0 ? recentScores.reduce((a, b) => a + b, 0) / recentScores.length : 4.0; 
        p.c_recent = (1.0 + (4 - avgRank) * 0.05) * settings.RECENT_WEIGHT; 
        p.c_wmark = p.wmark === '◎' ? 1.04 : (p.wmark === '〇' ? 1.02 : (p.wmark === '✕' ? 1.015 : (p.wmark === '△' ? 1.01 : 1.0))); 
        p.c_s1 = p.is_s1 ? 1.005 : 1.0; p.c_b1 = p.is_b1 ? 1.015 : 1.0; 
        let biasKey = p.style === '自' ? '先行' : (p.style === '両' ? '捲り' : '差し'); 
        p.c_e = bankData.keirin_bias[biasKey] || 1.0; 
    }); 

    const seitenreiResults = runScenarioSimulation(basePlayers, allSeriInfos, settings, bankData, false); 
    const koutenreiResults = runScenarioSimulation(basePlayers, allSeriInfos, settings, bankData, true); 

    displayResults( 
        koutenreiModeSelected ? koutenreiResults.allScenarioResults : seitenreiResults.allScenarioResults, 
        seitenreiResults.integratedScores, koutenreiResults.integratedScores, bankName,
        allSeriInfos, finalOrderedPlayerIds, seitenreiResults.allScenarioResults, participatingPlayers, displayLineSegments 
    ); 
    const resultsContainer = document.getElementById('results-container'); 
    if (resultsContainer) resultsContainer.classList.add('visible'); 
} 

function getStrengthColor(score, minScore, maxScore) {
    if (maxScore === minScore) return 'rgb(142, 142, 142)';
    const n = (score - minScore) / (maxScore - minScore);
    const r = Math.round(52 + (231 - 52) * n);
    const g = Math.round(152 + (76 - 152) * n);
    const b = Math.round(219 + (60 - 219) * n);
    return `rgb(${r}, ${g}, ${b})`;
}
function getTextColor(rgbColor) {
    const m = rgbColor.match(/\d+/g);
    const l = (0.2126 * m[0] + 0.7152 * m[1] + 0.0722 * m[2]) / 255;
    return l > 0.5 ? '#333' : '#fff';
}

function displayResults(detailedScenarioResults, seitenreiIntegratedScores, koutenreiIntegratedScores, bankName, allSeriInfos, finalOrderedPlayerIds, allScenarioResults, participatingPlayers, displayLineSegments) { 
    displayBankTendency(); 
    const finalScores = Object.keys(seitenreiIntegratedScores).map(id => ({ id: Number(id), score: seitenreiIntegratedScores[id] / detailedScenarioResults.length }));
    const allScores = finalScores.map(p => p.score);
    const maxScore = Math.max(...allScores); const minScore = Math.min(...allScores); 
    const playerIdToScore = {}; finalScores.forEach(p => playerIdToScore[p.id] = p.score);

    const lineDisplay = document.getElementById('line-display'); 
    let displayHtml = ''; 
    displayLineSegments.forEach((seg) => {
        if (seg.type === 'single') {
            const rgb = getStrengthColor(playerIdToScore[seg.id], minScore, maxScore);
            displayHtml += `<span class="line-box strength-color" style="background-color: ${rgb}; color: ${getTextColor(rgb)};">${seg.id}</span>`;
        } else if (seg.type === 'seri') {
            const rgbF = getStrengthColor(playerIdToScore[seg.follower], minScore, maxScore);
            const rgbC = getStrengthColor(playerIdToScore[seg.contender], minScore, maxScore);
            displayHtml += `<span class="seri-segment">(<span class="line-box strength-color" style="background-color: ${rgbF}; color: ${getTextColor(rgbF)};">${seg.follower}</span><span class="seri-arrow">←</span><span class="line-box strength-color" style="background-color: ${rgbC}; color: ${getTextColor(rgbC)};">${seg.contender}</span>)</span>`;
        }
    });
    if (lineDisplay) lineDisplay.innerHTML = displayHtml; 

    let seriSummaryHtml = '';
    if (allSeriInfos.length > 0) {
        seriSummaryHtml += `<div style="padding: 10px; margin-bottom: 15px; border: 2px solid #c07777; background-color: #fcf0f0; border-radius: 6px;"><h4>⚠️ 競り発生！</h4>`;
        allSeriInfos.forEach((info, idx) => { seriSummaryHtml += `<p>${idx === 0 ? '最初の競りは、' : '<strong>さらに、</strong>'}選手${info.follower} vs 選手${info.contender}。予測勝者: **選手${info.winner}**</p>`; });
        seriSummaryHtml += `<p style="font-size: 0.9em; color: #c07777;">※体力消耗減点適用済</p></div>`;
    }

    const tenunData = calculateTenunIndex(seitenreiIntegratedScores, koutenreiIntegratedScores, allScenarioResults, participatingPlayers); 
    const tenunHtml = window.generateTamakiTenunHTML(tenunData.tenunIndex, false, null); 
    const tenunOutput = document.getElementById('tenun-index-output'); 
    if (tenunOutput) tenunOutput.innerHTML = tenunHtml + tenunData.superiorHtml; 

    const scenarioOutput = document.getElementById('scenario-output'); 
    if (scenarioOutput) { 
        scenarioOutput.innerHTML = seriSummaryHtml + detailedScenarioResults.map(s => { 
            const wagers = generateScenarioWagers(s.results); 
            return `<div class="scenario-detail"><h4>${s.scenario}シミュレーション</h4><p><strong>三連単:</strong> ${wagers.tritan}</p><p><strong>三連複:</strong> ${wagers.trifuku}</p><table><tr><th>選手ID</th><th>評価</th><th class="hide-score-rank">スコア</th></tr>${s.results.map(p => `<tr><td>${p.id}</td><td><strong>${p.grade}${p.strength_mark}</strong></td><td class="hide-score-rank">${p.final_score.toFixed(3)}</td></tr>`).join('')}</table></div>`; 
        }).join(''); 
    } 

    const seitenreiRanking = Object.keys(seitenreiIntegratedScores).map(id => ({ id: Number(id), score: seitenreiIntegratedScores[id] / detailedScenarioResults.length })).sort((a, b) => b.score - a.score); 
    const sTop3 = seitenreiRanking.slice(0, 3).map(p => p.id); const sTop4 = seitenreiRanking.slice(0, 4).map(p => p.id);
    const sTri1 = [...sTop4.slice(0, 3)].sort((a,b)=>a-b).join('=');
    const sTri2 = sTop4.length >= 4 ? [sTop4[0], sTop4[1], sTop4[3]].sort((a,b)=>a-b).join('=') : 'N/A';
    const seitenreiOutput = document.getElementById('seitenrei-output'); 
    if (seitenreiOutput) seitenreiOutput.innerHTML = `三連単: <strong>${sTop3[0]}-${sTop3[1]}-${sTop3[2]}, ${sTop3[0]}-${sTop3[2]}-${sTop3[1]}</strong><br>三連複: <strong>${sTri1}, ${sTri2}</strong>`; 

    const koutenreiRanking = Object.keys(koutenreiIntegratedScores).map(id => ({ id: Number(id), score: koutenreiIntegratedScores[id] / detailedScenarioResults.length })).sort((a, b) => b.score - a.score); 
    const kTop4 = koutenreiRanking.slice(0, 4).map(p => p.id); const kLeader = kTop4[3];
    const kTri = kLeader ? [[kLeader, kTop4[0], kTop4[1]], [kLeader, kTop4[0], kTop4[2]], [kLeader, kTop4[1], kTop4[2]]].map(x=>x.sort((a,b)=>a-b).join('=')).join(', ') : 'N/A';
    const koutenreiOutput = document.getElementById('koutenrei-output'); 
    if (koutenreiOutput) koutenreiOutput.innerHTML = `⚫ 特異点 : **${kLeader || 'N/A'}**<br>三連複: <strong>${kTri}</strong>`; 
}