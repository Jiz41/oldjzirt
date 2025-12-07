// --- 華耀天輪 真・自在律 V6.1 ロジック (競り表示: ボックス維持/カッコ/矢印削除 適用済み) --- //

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

// ========== 競り専用係数 ==========
const SERI_STYLE_BONUS = { // 脚質別競り係数 C_style (追込重視)
    '追': 1.05, 
    '両': 1.00, 
    '自': 0.95  
};
const SERI_FATIGUE_PENALTY_IN = 0.15;  // 競り勝った側（イン）の体力消耗減点 Δ_in
const SERI_FATIGUE_PENALTY_OUT = 0.25; // 競り負けた側（アウト）の体力消耗減点 Δ_out
const SERI_WIN_BONUS = 0.05;           // 競り勝ち選手への微増補正
// =======================================

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

        const score = parseFloat(row.querySelector('.score').value) || 0;
        const style = row.querySelector('.style').value;
        const wmark = row.querySelector('.wmark').value.trim();
        
        players.push({ 
            id: id, 
            score: score, 
            style: style, 
            wmark: wmark, 
            recent: row.querySelector('.recent').value.trim(), 
            is_s1: id === s1Id, 
            is_b1: id === b1Id, 
            c_score_adj: 1.0, 
            c_recent: 1.0, 
            c_wmark: 1.0, 
            c_s1: 1.0, 
            c_b1: 1.0, 
            c_l: 1.0, 
            c_e: 1.0, 
            final_score: 0,
            // 競り係数 C_seri の初期計算
            seri_coef: score * (SERI_STYLE_BONUS[style] || 1.00) * (wmark === '◎' ? 1.04 : 1.0)
        }); 
    }); 
    return players;
} 

// 銀行データの非同期読み込み (変更なし)
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
        BANK_DATA = { 
            'ダミーバンク': { length: 400, keirin_bias: { '先行': 1.0, '捲り': 1.0, '差し': 1.0 }, wind_or_position: {} } 
        }; 
        const bankSelect = document.getElementById('bank-name'); 
        if (bankSelect) { 
            bankSelect.innerHTML = '<option value="ダミーバンク">データ読み込み失敗</option>'; 
        }
    }
} 

// バンク展開傾向の表示関数 (実行前にも表示可能) (変更なし)
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

// ページロード時にデータ読み込みを実行 (変更なし)
(async function() { 
    await loadBankData();
})(); 


// ========== 【修正】競り解析関数 (parseLineInput) ==========
/**
 * ライン入力文字列を解析し、ライン構成と競り情報を取得する
 * 【修正点】orderedPlayerIds に競り選手の並びを正確に格納するように修正
 * @param {string} lineInput - 例: "14(3)2, 567"
 * @param {Array<Object>} allPlayers - 全選手データ
 * @returns {Object} { lines: Array<Array<number>>, seriInfo: Object, orderedPlayerIds: Array<number> }
 */
function parseLineInput(lineInput, allPlayers) {
    logMessage(`[PARSE] ライン入力解析開始: ${lineInput}`);
    const processedLineInput = lineInput.replace(/\s/g, '');
    const segments = processedLineInput.split(',');
    
    const lines = [];
    // 【新規】表示順を格納する配列
    const orderedPlayerIds = []; 
    const seriInfo = { exists: false, leader: null, follower: null, contender: null, winner: null, loser: null };

    segments.forEach(seg => {
        // ルール: 14(3)2 形式を解析
        const seriMatch = seg.match(/^(\d+)(\d+)\((\d+)\)(.*)$/);
        if (seriMatch) {
            // 競り並び検出
            seriInfo.exists = true;
            seriInfo.leader = parseInt(seriMatch[1]);     // 1: 自力選手
            seriInfo.follower = parseInt(seriMatch[2]);   // 4: イン側の選手 (番手本線)
            seriInfo.contender = parseInt(seriMatch[3]);  // 3: アウト側の選手 (競り選手)
            
            logMessage(`[PARSE] 競り検出: 選手${seriInfo.follower} (イン) vs 選手${seriInfo.contender} (アウト)`);
            
            // 競りの勝敗予測 (競り係数 C_seri に基づく)
            const followerCoef = allPlayers.find(p => p.id === seriInfo.follower)?.seri_coef || 0;
            const contenderCoef = allPlayers.find(p => p.id === seriInfo.contender)?.seri_coef || 0;

            if (followerCoef >= contenderCoef) {
                seriInfo.winner = seriInfo.follower;
                seriInfo.loser = seriInfo.contender;
            } else {
                seriInfo.winner = seriInfo.contender;
                seriInfo.loser = seriInfo.follower;
            }
            logMessage(`[PARSE] 競り勝者予測: 選手${seriInfo.winner}`);

            // ライン再構築: 競り勝者のみがラインに残り、敗者は単騎扱い
            lines.push([seriInfo.leader, seriInfo.winner]); 
            
            // 【修正】表示順の構築: 1 -> 4 -> 3 -> 2 -> ... (競り選手も隊列として格納)
            orderedPlayerIds.push(seriInfo.leader);
            orderedPlayerIds.push(seriInfo.follower);  // 競られる側 (イン側)
            orderedPlayerIds.push(seriInfo.contender); // 競り込む側 (アウト側)

            // 競り並びの後ろにいた選手(2)
            const remainingSegment = seriMatch[4]; 
            const remainingMembers = remainingSegment.split('').map(Number);
            
            // 残りの選手をラインと表示順に追加 (競り負けた選手は lines には入れない)
            if (remainingMembers.length > 0) {
                 lines.push(remainingMembers); 
                 orderedPlayerIds.push(...remainingMembers);
            }
            // 競り負けた選手を単独ラインとしてラインに追加 (スコア計算用)
            lines.push([seriInfo.loser]); 
            // orderedPlayerIdsには既に格納されているのでここでは追加しない (重複防止のため)
            
        } else {
            // 通常ライン
            const members = seg.split('').map(Number);
            lines.push(members);
            // 【修正】通常ラインでも隊列順に orderedPlayerIds に格納
            orderedPlayerIds.push(...members);
        }
    });
    
    // ラインに含まれていない選手は単騎扱いとして、orderedPlayerIdsの最後に追加
    const allRidersInInput = new Set(orderedPlayerIds);
    allPlayers.forEach(p => {
        if (!allRidersInInput.has(p.id)) {
            lines.push([p.id]);
            // 【修正】orderedPlayerIdsにも単騎選手を追加
            orderedPlayerIds.push(p.id);
        }
    });

    // 【新規】重複IDを削除し、隊列順を維持
    const uniqueOrderedPlayerIds = [];
    const seenIds = new Set();
    for (const id of orderedPlayerIds) {
        if (!seenIds.has(id)) {
            uniqueOrderedPlayerIds.push(id);
            seenIds.add(id);
        }
    }

    // 【修正】orderedPlayerIdsも戻り値に追加
    return { lines, seriInfo, orderedPlayerIds: uniqueOrderedPlayerIds };
}
// =======================================


// ========== 【修正】ライン強度計算・視覚化関数 (calculateLineCoeffs) ==========
/**
 * ライン強度係数 C_L の計算と、ラインの視覚化表示を行う
 * 【修正点】競り表示にカッコを適用し、矢印を削除する
 */
function calculateLineCoeffs(players, settings) { 
    // 【修正】orderedPlayerIdsも受け取るように変更
    const lineInput = document.getElementById('line-input').value; 
    const { lines, seriInfo: parsedSeriInfo, orderedPlayerIds } = parseLineInput(lineInput, players);

    const playerToLineMap = {}; 
    
    lines.forEach((members, index) => {
        members.forEach(id => {
            playerToLineMap[id] = index + 1;
        });
    });
    
    // C_L係数計算 (省略 - 変更なし) 
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
    } else { 
        logMessage(`[C_L] 一般競輪 (${settings.R_BIAS.toFixed(2)}) モード。ライン結束力係数 $C_{coop}$ を評価。`); 
        const coopWeight = settings.COOP_WEIGHT; 
        
        lines.forEach(line => { 
            if (line.length < 2) return;
            
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

    // ライン強度の視覚化出力ロジック
    const lineDisplay = document.getElementById('line-display'); 
    if (lineDisplay) { 
        let displayHtml = ''; 

        // 【修正】並び替えられた orderedPlayerIds に従って表示を生成
        orderedPlayerIds.forEach((id) => { 
            const lineId = playerToLineMap[id] || 0; 
            let className = ''; 
            if (lineId === 0) { 
                className = 'line-solo'; 
            } else { 
                className = `line-color-${lineId}`; 
            } 
            
            // 選手ボックスを生成
            let playerHtml = `<span class="line-box ${className}">${id}</span>`;
            
            // 競りが発生している場合のカッコ適用
            if (parsedSeriInfo.exists) {
                // イン側の選手 (follower) の後に、カッコでアウト側の選手 (contender) のボックスを囲む
                if (id === parsedSeriInfo.contender) {
                    playerHtml = `(${playerHtml})`;
                }
            }
            
            // 【削除】隊列を示す矢印ロジックはすべて削除
            
            displayHtml += playerHtml;
        }); 
        lineDisplay.innerHTML = displayHtml; 
    } 

    // 【修正】seriInfoを返す
    return { lines, seriInfo: parsedSeriInfo };
} 
// =========================================================


// ========== 競り補正関数 (変更なし) ==========
function applySeriCorrection(scoredPlayers, seriInfo) {
    if (seriInfo.exists) {
        logMessage(`[SERI] 競り補正開始: 選手${seriInfo.winner} vs 選手${seriInfo.loser}`);
        
        // 競り勝者 (Winner): 小さいボーナスと小さい減点
        const winner = scoredPlayers.find(p => p.id === seriInfo.winner);
        if (winner) {
            winner.final_score = winner.final_score * (1 + SERI_WIN_BONUS) * (1 - SERI_FATIGUE_PENALTY_IN);
            logMessage(`[SERI] 競り勝者 選手${winner.id}: スコア微増/体力減点 ${Math.round(SERI_FATIGUE_PENALTY_IN * 100)}%`);
        }

        // 競り敗者 (Loser): アウト側が競り負けた場合の大きな減点
        const loser = scoredPlayers.find(p => p.id === seriInfo.loser);
        if (loser) {
            loser.final_score *= (1 - SERI_FATIGUE_PENALTY_OUT);
            logMessage(`[SERI] 競り敗者 選手${loser.id}: スコア大幅減点 ${Math.round(SERI_FATIGUE_PENALTY_OUT * 100)}%`);
        }
    }

    return scoredPlayers;
}
// =======================================


function getScenarioCoeffs(scenario) { // (変更なし)
    if (scenario === '先行有利') return { '自': 1.05, '追': 1.02, '両': 1.03 }; 
    if (scenario === '捲り有利') return { '自': 1.00, '追': 1.05, '両': 1.04 }; 
    if (scenario === '差し有利') return { '自': 0.90, '追': 1.08, '両': 1.05 }; 
    return { '自': 1.0, '追': 1.0, '両': 1.0 };
} 

function generateScenarioWagers(results) { // (変更なし)
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

function assignFinalGrades(scenarioPlayers) { // (変更なし)
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

// 荒天令モード専用の非実力リスクバイアス (C係数) を計算し、スコア減点を適用する (変更なし)
function calculate_koutenrei_bias(players, scenario, bankData) { 
    logMessage("[KOUTENREI] 荒天令リスクバイアス (C係数) の計算を開始..."); 
    
    let tempPlayers = JSON.parse(JSON.stringify(players)); 
    
    const allScores = players.map(p => p.score); 
    const scoreMax = Math.max(...allScores); 
    const scoreMin = Math.min(...allScores); 
    const scoreRange = scoreMax - scoreMin; 

    // parseLineInputを呼び出し、linesを取得
    const lineInput = document.getElementById('line-input').value;
    const { lines } = parseLineInput(lineInput, players);

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

// 展開シミュレーションを実行し、結果と統合スコアを返す。 (変更なし)
function runScenarioSimulation(basePlayers, seriInfo, settings, bankData, applyKoutenrei) { 
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

        // 競り補正の適用
        scenarioPlayers = applySeriCorrection(scenarioPlayers, seriInfo);

        // 荒天令モードの場合、C係数バイアスを適用 
        if (applyKoutenrei) { 
            scenarioPlayers = calculate_koutenrei_bias(scenarioPlayers, scenario, bankData); 
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

// 天雲指数 (一致率に基づく) (変更なし)
function calculateTenunIndex(seitenreiScores, koutenreiScores) { 
    const seitenreiRanking = Object.keys(seitenreiScores).map(id => ({ id: Number(id), score: seitenreiScores[id] })).sort((a, b) => b.score - a.score); 
    const koutenreiRanking = Object.keys(koutenreiScores).map(id => ({ id: Number(id), score: koutenreiScores[id] })).sort((a, b) => b.score - a.score); 
    
    if (seitenreiRanking.length < 3 || koutenreiRanking.length < 3) { 
        return { tenunIndex: 50, message: 'データ不足のため指数算出不可' }; 
    } 
    
    const seitenTop3 = new Set(seitenreiRanking.slice(0, 3).map(p => p.id)); 
    const koutenTop3 = koutenreiRanking.slice(0, 3).map(p => p.id); 

    let matchCount = 0; 
    koutenTop3.forEach(id => { 
        if (seitenTop3.has(id)) { 
            matchCount++; 
        } 
    }); 

    let tenunIndex; 
    let message = ''; 
    
    switch (matchCount) { 
        case 3: 
            tenunIndex = 0; 
            message = '☀️ **これは稀に見る大安吉日！晴天令の信頼度、揺るぎなしと見ますぞ！**'; 
            break; 
        case 2: 
            tenunIndex = 33; 
            message = '🔮 **なるほど、比較的穏やかな気配ですじゃ。軸は堅いが紐は広めに。**'; 
            break; 
        case 1: 
            tenunIndex = 67; 
            message = '⛈️ **天の気配に乱れあり！荒天令の特異点を強く警戒すべきでしょう。**'; 
            break; 
        case 0: 
            tenunIndex = 100; 
            message = '💥 **うむむ…これは強い荒天の気が出ておる…何かが起こりますぞ！**'; 
            break; 
        default: 
            tenunIndex = 50; 
            message = '算出ロジックエラー'; 
    } 
    
    logMessage(`[TENUN] 晴天/荒天 上位3名一致数: ${matchCount}名。天雲指数: ${tenunIndex}`); 
    return { tenunIndex, message };
} 

// メイン計算関数 (変更なし)
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

    // --- I. ライン解析と C_L (ライン・連係係数) の計算 --- 
    // 【修正】calculateLineCoeffsの戻り値を受け取るように変更
    const { seriInfo } = calculateLineCoeffs(players, settings); 

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
    const seitenreiResults = runScenarioSimulation(basePlayers, seriInfo, settings, bankData, false); 
    logMessage("[CALC] 晴天令 (安定) シミュレーションが完了しました。"); 

    // 2. ⛈️ 荒天令シミュレーション (C係数適用あり) 
    const koutenreiResults = runScenarioSimulation(basePlayers, seriInfo, settings, bankData, true); 
    logMessage("[CALC] 荒天令 (波乱) シミュレーションが完了しました。"); 

    // --- IV. 最終結果の統合と表示 --- 
    // 詳細テーブル (scenario-output) に表示する結果は、UIで選択されたモードに合わせる 
    const detailedScenarioResults = koutenreiModeSelected ? koutenreiResults.allScenarioResults : seitenreiResults.allScenarioResults; 

    displayResults( 
        detailedScenarioResults, 
        seitenreiResults.integratedScores, 
        koutenreiResults.integratedScores, 
        bankName,
        seriInfo // 競り情報を渡す
    ); 
    
    const resultsContainer = document.getElementById('results-container'); 
    if (resultsContainer) { 
        resultsContainer.classList.add('visible'); 
    } 
    
    logMessage('[CALC END] 予想計算が完了し、結果が表示されました。');
} 

// 修正後の表示関数: displayResults (変更なし)
function displayResults(detailedScenarioResults, seitenreiIntegratedScores, koutenreiIntegratedScores, bankName, seriInfo) { 
    displayBankTendency(); 

    // ---------------------------------------------------------- 
    // ★ 競りサマリーの表示 (新規追加) ★ 
    // ----------------------------------------------------------
    let seriSummaryHtml = '';
    if (seriInfo.exists) {
        const followerId = seriInfo.follower;
        const contenderId = seriInfo.contender;
        const winnerId = seriInfo.winner;
        
        seriSummaryHtml = `
            <div style="padding: 10px; margin-bottom: 15px; border: 2px solid #c07777; background-color: #fcf0f0; border-radius: 6px;">
                <h4>⚠️ 競り発生！ (並び: ${document.getElementById('line-input').value})</h4>
                <p><strong>競り選手:</strong> 選手${followerId} (イン) vs 選手${contenderId} (アウト)</p>
                <p><strong>予測結果:</strong> 競り係数に基づき、競り勝つのは **選手${winnerId}** です。</p>
                <p style="font-size: 0.9em; color: #c07777;">※ アウト側（競り敗者）の選手は、体力消耗による大幅な減点を受けています。</p>
            </div>
        `;
    }

    // ---------------------------------------------------------- 
    // ★ 天雲指数 (占い師メッセージ) の計算と表示 ★ 
    // ---------------------------------------------------------- 
    const tenunIndexData = calculateTenunIndex(seitenreiIntegratedScores, koutenreiIntegratedScores); 
    const tenunIndex = tenunIndexData.tenunIndex; 
    const oracleMessage = tenunIndexData.message; 

    let messageClass = ''; 
    if (tenunIndex === 0) messageClass = 'tenun-stable'; 
    else if (tenunIndex === 33) messageClass = 'tenun-mild'; 
    else if (tenunIndex === 67) messageClass = 'tenun-alert'; 
    else if (tenunIndex === 100) messageClass = 'tenun-severe'; 

    const tenunHtml = ` 
        <div class="tenun-index-container ${messageClass}"> 
            <h4>⚫ 天雲指数（てんうんしすう）</h4> 
            <p class="fortune-teller-message"> 
                <strong>🔮🐢</strong>＜${oracleMessage}＞ 
            </p> 
        </div> `; 
        
    const tenunOutput = document.getElementById('tenun-index-output'); 
    if (tenunOutput) { 
        tenunOutput.innerHTML = tenunHtml; 
    } 

    // ---------------------------------------------------------- 
    // シナリオ詳細 
    const scenarioOutput = document.getElementById('scenario-output'); 
    if (scenarioOutput) { 
        scenarioOutput.innerHTML = seriSummaryHtml;
        
        scenarioOutput.innerHTML += detailedScenarioResults.map(s => { 
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
                </div> `; 
        }).join(''); 
    } 

    // --- ☀️ 晴天令 (安定推奨) の表示 --- 
    const seitenreiRanking = Object.keys(seitenreiIntegratedScores).map(id => ({ id: Number(id), score: seitenreiIntegratedScores[id] / detailedScenarioResults.length })).sort((a, b) => b.score - a.score); 
    const seitenTop3 = seitenreiRanking.slice(0, 3).map(p => p.id); 
    const seitenTop4 = seitenreiRanking.slice(0, 4).map(p => p.id); 
    
    const seitenTritan = [ 
        `${seitenTop3[0]}-${seitenTop3[1]}-${seitenTop3[2]}`, 
        `${seitenTop3[0]}-${seitenTop3[2]}-${seitenTop3[1]}`, 
        `${seitenTop3[1]}-${seitenTop3[0]}-${seitenTop3[2]}` 
    ].join(', '); 
    
    const triSeiten1 = [...seitenTop4.slice(0, 3)].sort((a, b) => a - b).join('='); 
    
    let triSeiten2; 
    if (seitenTop4.length >= 4) { 
        triSeiten2 = [seitenTop4[0], seitenTop4[1], seitenTop4[3]].sort((a, b) => a - b).join('='); 
    } else { 
        triSeiten2 = 'データ不足'; 
    } 
    
    const seitenTrifuku = [triSeiten1, triSeiten2].join(', '); 
    
    const seitenreiOutput = document.getElementById('seitenrei-output'); 
    if (seitenreiOutput) { 
        seitenreiOutput.innerHTML = ` 
            三連単 (3点): <strong>${seitenTritan}</strong><br> 
            三連複 (2点): <strong>${seitenTrifuku}</strong> `; 
    } 

    // --- ⛈️ 荒天令 (高配当狙い) の表示 --- 
    const koutenreiRanking = Object.keys(koutenreiIntegratedScores).map(id => ({ id: Number(id), score: koutenreiIntegratedScores[id] / detailedScenarioResults.length, rank: 0 
    })).sort((a, b) => b.score - a.score); 
    
    koutenreiRanking.forEach((p, index) => p.rank = index + 1); 

    const koutenTop3 = koutenreiRanking.slice(0, 3).map(p => p.id); 
    const koutenTop4 = koutenreiRanking.slice(0, 4).map(p => p.id); 
    
    const koutenLeader = koutenTop4.length >= 4 ? koutenTop4[3] : null; 
    let koutenTrifuku = []; 

    if (koutenLeader) { 
        koutenTrifuku.push([koutenLeader, koutenTop3[0], koutenTop3[1]].sort((a, b) => a - b).join('=')); 
        koutenTrifuku.push([koutenLeader, koutenTop3[0], koutenTop3[2]].sort((a, b) => a - b).join('=')); 
        koutenTrifuku.push([koutenLeader, koutenTop3[1], koutenTop3[2]].sort((a, b) => a - b).join('=')); 
    } 

    const middleWaveRiders = koutenreiRanking.filter(p => p.rank === 5 || p.rank === 6).map(p => p.id); 
    
    if (middleWaveRiders.length > 0) { 
        const mainWaveRider = middleWaveRiders[0]; 

        const axis1 = koutenTop3[0]; 
        const axis2 = koutenTop3.length >= 2 ? koutenTop3[1] : null; 
        const firmHimo = koutenLeader; 

        if (axis1 && firmHimo && mainWaveRider) { 
            if (koutenTrifuku.length < 6) { 
                koutenTrifuku.push([mainWaveRider, axis1, firmHimo].sort((a, b) => a - b).join('=')); 
            } 
            if (axis2 && koutenTrifuku.length < 6) { 
                koutenTrifuku.push([mainWaveRider, axis2, firmHimo].sort((a, b) => a - b).join('=')); 
            } 
        } 
    } 

    const finalKoutenTrifuku = koutenTrifuku.slice(0, 6).join(', '); 
    
    const koutenreiOutput = document.getElementById('koutenrei-output'); 
    if (koutenreiOutput) { 
        koutenreiOutput.innerHTML = ` 
            ⚫ 特異点 : **${koutenLeader ? koutenLeader : 'N/A'}**<br> 
            三連複 (${koutenTrifuku.slice(0, 6).length}点): <strong>${finalKoutenTrifuku}</strong> `; 
    }
}
