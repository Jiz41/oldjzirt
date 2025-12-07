// --- 華耀天輪 真・自在律 V6.0 ロジック (天雲指数実装済み) ---
// (最終確認: 2025年12月7日)

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

// ★修正: 競り情報格納用のグローバル変数を追加 (メイン計算時にリセットされる)★
let PLAYERS_FACING_SERI = []; 
let SERI_ATTACKERS = []; 

// ロギング関数
function logMessage(message) {
    const logArea = document.getElementById('debug-log');
    const timestamp = new Date().toLocaleTimeString('ja-JP', { hour12: false });
    if (logArea) {
        // メッセージをHTMLとして追加する前に、エスケープ処理を行う
        const escapedMessage = message.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        logArea.innerHTML += `[${timestamp}] ${escapedMessage}<br>`;
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

            // 係数初期値
            c_score_adj: 1.0, c_recent: 1.0, c_wmark: 1.0, c_s1: 1.0, c_b1: 1.0, c_l: 1.0, c_e: 1.0,
            final_score: 0 // シミュレーション中のスコア
        });
    });
    return players;
}

// 銀行データの非同期読み込み (★修正: パスの堅牢性を向上★)
async function loadBankData() {
    try {
        logMessage("[INIT] bankdata.jsonの読み込みを開始します...");
        
        // ★修正: 相対パスの前に './' を追加し、読み込み失敗リスクを低減 (Hugging Face対応)★
        const response = await fetch('./bankdata.json'); 
        
        if (!response.ok) {
            logMessage(`[ERROR] bankdata.jsonの読み込みに失敗しました: HTTP status ${response.status}`);
            throw new Error(`ファイル読み込みエラー (Status: ${response.status})`);
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
            
            displayBankTendency();
        }

    } catch (error) {
        logMessage(`[FATAL ERROR] データ読み込み処理中に重大なエラーが発生: ${error.message}`);
        // 読み込み失敗時も、計算を続行できるようダミーデータを確実に設定する
        BANK_DATA = { 'データ読み込み失敗': { length: 400, keirin_bias: { '先行': 1.0, '捲り': 1.0, '差し': 1.0 }, wind_or_position: {} } };
        const bankSelect = document.getElementById('bank-name');
        if (bankSelect) {
            bankSelect.innerHTML = '<option value="データ読み込み失敗">データ読み込み失敗</option>';
        }
    }
}

// バンク展開傾向の表示関数
function displayBankTendency() {
    const bankName = document.getElementById('bank-name').value;
    const bankData = BANK_DATA[bankName];
    const tendencyDisplay = document.getElementById('bank-tendency');

    if (!bankData || !tendencyDisplay) return;

    let html = `
        走路: ${bankData.length}m &nbsp;|&nbsp; 
        先行: ${Math.round(bankData.keirin_bias['先行'] * 100)}% &nbsp;|&nbsp; 
        捲り: ${Math.round(bankData.keirin_bias['捲り'] * 100)}% &nbsp;|&nbsp; 
        差し: ${Math.round(bankData.keirin_bias['差し'] * 100)}%
    `;
    tendencyDisplay.innerHTML = html;
}

// ページロード時にデータ読み込みを実行
(async function() {
    await loadBankData();
    document.getElementById('bank-name').addEventListener('change', displayBankTendency);
})();


// ライン強度を視覚的に表示し、競り情報を解析するロジック
function calculateLineCoeffs(players, settings) {
    const lineInput = document.getElementById('line-input').value;
    const lines = []; 
    const playerToLineMap = {}; 
    const allPlayerIds = new Set(players.map(p => p.id));
    let assignedPlayerIds = new Set();
    
    // ★重要: グローバル変数は calculatePredictionでリセットされていることを前提とする★
    // PLAYERS_FACING_SERI = []; 
    // SERI_ATTACKERS = []; 

    if (lineInput && lineInput.includes(',')) {
        let lineCounter = 1;
        
        lineInput.split(',').forEach(part => { 
            let tempPart = part;
            let match;

            // ★修正: 競り情報 (X(Y)) の解析ロジックを追加★
            const seriRegex = /\((\d+)\)/g;
            
            while ((match = seriRegex.exec(part)) !== null) {
                const attackerId = Number(match[1]); 
                if (!SERI_ATTACKERS.includes(attackerId)) { // 重複防止
                    SERI_ATTACKERS.push(attackerId);
                }
                assignedPlayerIds.add(attackerId);
                
                // 競りを受けている選手（括弧の直前）を特定する
                const indexBeforeParen = match.index - 1;
                if (indexBeforeParen >= 0) {
                    const defenderIdStr = part[indexBeforeParen];
                    const defenderId = Number(defenderIdStr); 
                    
                    if (!isNaN(defenderId) && defenderId > 0 && !PLAYERS_FACING_SERI.includes(defenderId)) {
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

    // C_L係数計算 (ライン結束力/エースマーク)
    players.forEach(p => {
        const lineId = playerToLineMap[p.id];
        let c_l = 1.0;

        if (lineId === 0) {
            c_l = 0.95; // 単騎ペナルティ
        } else {
            const lineMembers = lines.find(l => l.includes(p.id));
            if (lineMembers && lineMembers.length >= 2) {
                const leaderId = lineMembers[0];
                const leader = players.find(pl => pl.id === leaderId);

                // 番手選手か、3番手以降の選手か
                const positionInLine = lineMembers.indexOf(p.id);
                
                if (positionInLine === 1) { // 番手
                    const c_l_bias = 1.0 + (p.score / 100 - 1.0) * settings.COOP_WEIGHT;
                    c_l *= c_l_bias; 
                } else if (positionInLine >= 2) { // 3番手以降
                    c_l *= 1.01; // 軽微な恩恵
                }

                // エースマーク補正 (ライン内の最高得点者に対する追走)
                const lineScores = lineMembers.map(id => players.find(pl => pl.id === id).score);
                const maxLineScore = Math.max(...lineScores);
                if (p.score < maxLineScore * 0.9) { 
                     // エースを追走している場合は、更に結束力ボーナス
                     if (leaderId !== p.id && leader.score === maxLineScore) {
                        c_l *= 1.015;
                     }
                }
            }
        }
        p.c_l = c_l;
    });

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

// 展開別係数
function getScenarioCoeffs(scenario) {
    const coeffs = {
        '先行': { win: 1.00, second: 0.95, third: 0.85 },
        '捲り': { win: 1.00, second: 0.90, third: 0.80 },
        '差し': { win: 1.05, second: 1.00, third: 0.90 }, 
        '単騎': { win: 0.90, second: 0.85, third: 0.80 },
    };
    return coeffs[scenario] || { win: 1.0, second: 0.95, third: 0.90 };
}

// シミュレーション結果からオッズを生成するロジック
function generateScenarioWagers(results) {
    const totalScore = results.reduce((sum, r) => sum + r.final_score, 0);
    if (totalScore === 0) return []; // ゼロ除算ガード

    const wagers = results.map(r => ({
        id: r.id,
        score: r.final_score,
        probability: r.final_score / totalScore
    }));
    
    // 確率の高い順にソート
    wagers.sort((a, b) => b.probability - a.probability);

    return wagers;
}

// 選手に最終的なグレードを割り当てる (A, B, C...)
function assignFinalGrades(scenarioPlayers) {
    // スコア降順にソート (クラッシュ防止のため、スコアがNaNやInfinityでないことを確認)
    scenarioPlayers.sort((a, b) => {
        const scoreA = isFinite(a.final_score) ? a.final_score : -Infinity;
        const scoreB = isFinite(b.final_score) ? b.final_score : -Infinity;
        return scoreB - scoreA;
    });

    if (scenarioPlayers.length === 0) return;

    // グレード割り当て
    const topScore = scenarioPlayers[0].final_score;
    
    scenarioPlayers.forEach((p, index) => {
        let grade = '';
        if (index === 0) {
            grade = 'A+';
        } else {
            const ratio = topScore > 0 ? p.final_score / topScore : 0;
            
            if (ratio >= 0.90) grade = 'A';
            else if (ratio >= 0.80) grade = 'B';
            else if (ratio >= 0.70) grade = 'C';
            else grade = 'D';
        }
        p.final_grade = grade;
    });
}


// ----------------------------------------------------------------------
// ★ 修正ロジック関数: calculate_koutenrei_bias (荒天令C係数適用) ★
// ----------------------------------------------------------------------
function calculate_koutenrei_bias(players, lines, scenario, bankData) {
    
    logMessage("[KOUTENREI] 荒天令リスクバイアス (C係数) の計算を開始...");

    let tempPlayers = JSON.parse(JSON.stringify(players));
    
    const allScores = players.map(p => p.score);
    const scoreMax = Math.max(...allScores);
    const scoreMin = Math.min(...allScores);
    const scoreRange = scoreMax - scoreMin;
    
    // ★修正: ゼロ除算ガードを強化★
    const isScoreRangeZero = scoreRange <= 0 || allScores.length <= 1;
    if (isScoreRangeZero) {
        logMessage("[KOUTENREI: WARNING] スコア範囲がゼロ (0) または選手数が少ないため、相対評価に基づくC係数の適用をスキップします。");
    }

    // --- C係数の計算と適用 ---
    
    // 1. C_guard (競りによる消耗・防衛ペナルティ) (競り表記がある場合を優先) 
    tempPlayers.forEach(p => {
        let seriRisk = 1.0;
        
        if (SERI_ATTACKERS.includes(p.id)) {
            seriRisk *= 0.93; // 競り仕掛け -7%
            logMessage(`[C_guard] 選手ID ${p.id} は競り仕掛け中（-7%減点）。`);
        } 
        
        if (PLAYERS_FACING_SERI.includes(p.id)) {
            seriRisk *= 0.97; // 競り防衛 -3%
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
        }

        // 2. C_risk (接触・落車リスク)
        const avgScore = allScores.reduce((a, b) => a + b, 0) / allScores.length;
        const recentAvg = p.recent.split('').map(Number).reduce((a, b) => a + b, 0) / p.recent.length || 4.0;
        
        if (p.score < avgScore - 2.0 && recentAvg >= 4.0) {
             C_TOTAL *= 0.97; 
        }

        // 3. C_mental (メンタル・疲労減衰) 
        const raceGrade = document.getElementById('race-type').value;
        const isHighPressure = ['s-kyu'].includes(raceGrade) || (p.score === scoreMax);
        
        if (isHighPressure && p.recent.startsWith('1')) {
            C_TOTAL *= 0.96; 
        }

        // 4. C_recovery (位置取り回復力)
        if (!isScoreRangeZero && (p.style === '両' || p.style === '追')) {
             const scoreDiffRatio = (p.score - scoreMin) / scoreRange;
             if (scoreDiffRatio > 0.8) {
                 C_TOTAL *= 1.03 + (scoreDiffRatio - 0.8) * 0.1;
             }
        }
        
        // 最終的なC係数をスコアに乗算 (元のロジック)
        p.final_score = p.final_score * C_TOTAL;
    });

    // 5. C_target (ターゲット・包囲網) 
    const targetPlayer = tempPlayers.find(p => p.score === scoreMax);
    if (targetPlayer) {
        // ... (省略: 前回のコードのターゲットロジックを維持)
        tempPlayers.forEach(p => {
            if (p.id !== targetPlayer.id && p.score > targetPlayer.score * 0.9) {
                targetPlayer.final_score *= 0.97;
            }
        });
    }

    // 6. C_split (ライン不均衡リスク)
    lines.forEach(line => {
        const p1 = tempPlayers.find(p => p.id === line[0]);
        const p2 = tempPlayers.find(p => p.id === line[1]);
        
        if (p1 && p2 && !isScoreRangeZero) { 
            const scoreDiff = p1.score - p2.score;
            const relativeDiff = scoreDiff / scoreRange;
            
            if (relativeDiff >= 0.30) {
                const penalty = 1.0 - (relativeDiff - 0.30) * 0.15;
                p2.final_score *= penalty; 
            }
        }
    });

    // 7. C_pace (序盤速度・燃焼リスク)
    const leaderPlayer = tempPlayers.find(p => p.style === '自' || p.style === '両');
    if (leaderPlayer && bankData.length < 400 && leaderPlayer.score < scoreMin + scoreRange * 0.3) {
        leaderPlayer.final_score *= 0.95; 
    }

    // 8. C_timing (仕掛け位置補正) 
    tempPlayers.forEach(p => {
        if (p.style === '両' && p.score > scoreMax * 0.95) {
            p.final_score *= 1.02;
        }
    });


    // 9. C_guard (番手防衛能力係数) (競り表記がない場合のロジック)
    lines.forEach(line => {
        const p2 = tempPlayers.find(p => p.id === line[1]);
        if (p2 && !PLAYERS_FACING_SERI.includes(p2.id)) { // 競りを受けている選手には適用しない
            
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
        }
    });

    logMessage("[KOUTENREI] C係数計算が完了しました。");
    return tempPlayers;
}


// 展開シミュレーション実行関数 (晴天令/荒天令 共通)
function runScenarioSimulation(initialPlayers, lines, settings, bankData, isKoutenrei) {
    let players = JSON.parse(JSON.stringify(initialPlayers));
    let allScenarioResults = [];
    let integratedScores = {};
    
    // 基礎係数の適用
    players.forEach(p => {
        p.final_score = p.score * p.c_score_adj * p.c_recent * p.c_wmark * p.c_s1 * p.c_b1 * p.c_l * p.c_e;
    });
    
    // 荒天令C係数の適用
    if (isKoutenrei) {
        players = calculate_koutenrei_bias(players, lines, null, bankData); // nullは未使用のscenario引数
    }
    
    const scenarios = ['先行', '捲り', '差し', '単騎']; // 展開シナリオ

    scenarios.forEach(scenario => {
        let scenarioPlayers = JSON.parse(JSON.stringify(players));
        const scenarioCoeffs = getScenarioCoeffs(scenario);
        
        // 展開係数 (Scenario Coeffs) の適用
        scenarioPlayers.forEach(p => {
            let styleKey = '単騎';
            if (p.style === '自') styleKey = '先行';
            else if (p.style === '両') styleKey = '捲り';
            else if (p.style === '追') styleKey = '差し';

            // 展開と脚質のマッチング
            let posCoeff = 1.0;
            if (scenario === styleKey) {
                posCoeff = scenarioCoeffs.win; // 展開が一致
            } else if (scenario === '差し' && styleKey === '追') {
                posCoeff = scenarioCoeffs.win; // 差し展開で追込
            } else if (scenario === '先行' && styleKey === '追') {
                posCoeff = scenarioCoeffs.second; // 先行展開で追込
            } else if (scenario === '捲り' && styleKey === '自') {
                posCoeff = scenarioCoeffs.third; // 捲り展開で先行
            } else if (scenario === '単騎' && styleKey === '追') {
                posCoeff = scenarioCoeffs.second; // 単騎展開で追込
            }
            
            p.final_score *= posCoeff; 
        });

        // 展開内の相対評価によるグレード付け
        assignFinalGrades(scenarioPlayers);

        // 結果を格納
        allScenarioResults.push({
            scenario: scenario,
            players: scenarioPlayers,
            wagers: generateScenarioWagers(scenarioPlayers)
        });
    });

    // 天雲指数の算出 (統合スコア)
    players.forEach(p => {
        let totalWeightedScore = 0;
        allScenarioResults.forEach(res => {
            const finalScore = res.players.find(pl => pl.id === p.id).final_score;
            totalWeightedScore += finalScore; 
        });
        
        // 天雲指数 (統合スコア) を計算
        integratedScores[p.id] = totalWeightedScore / allScenarioResults.length;
    });

    return { allScenarioResults, integratedScores };
}

// 天雲指数 (統合スコア) の計算
function calculateTenunIndex(seitenreiScores, koutenreiScores) {
    const playerIds = Object.keys(seitenreiScores).map(Number);
    const tenunIndex = {};

    playerIds.forEach(id => {
        const S = seitenreiScores[id] || 0;
        const K = koutenreiScores[id] || 0;
        
        // 天雲指数 = (安定スコア * 0.6) + (波乱スコア * 0.4)
        tenunIndex[id] = (S * 0.6) + (K * 0.4); 
    });
    
    // スコアの最大値を基準に正規化 (100点満点)
    const maxIndex = Math.max(...Object.values(tenunIndex));
    if (maxIndex > 0) {
        playerIds.forEach(id => {
            tenunIndex[id] = (tenunIndex[id] / maxIndex) * 100;
        });
    }

    return tenunIndex;
}


// ----------------------------------------------------------------------
// ★ 4. 結果表示関数: displayResults の修正 (競りマーク、天雲指数表示) ★
// ----------------------------------------------------------------------
function displayResults(detailedScenarioResults, seitenreiScores, koutenreiScores, bankName) {
    const outputContainer = document.getElementById('scenario-output');
    const integratedContainer = document.getElementById('integrated-output');
    
    if (!outputContainer || !integratedContainer) return;

    // 1. 統合結果 (天雲指数) の計算と表示
    const tenunIndex = calculateTenunIndex(seitenreiScores, koutenreiScores);
    let integratedHtml = `
        <h3>🌌 天雲指数 (統合スコア) - ${bankName}</h3>
        <table class="integrated-table">
            <thead>
                <tr>
                    <th>選手ID</th>
                    <th>天雲指数</th>
                    <th>晴天令スコア (安定)</th>
                    <th>荒天令スコア (波乱)</th>
                </tr>
            </thead>
            <tbody>
    `;
    
    const sortedIntegrated = Object.keys(tenunIndex).map(id => ({
        id: Number(id),
        tenun: tenunIndex[id],
        seitenrei: seitenreiScores[id],
        koutenrei: koutenreiScores[id]
    })).sort((a, b) => b.tenun - a.tenun); // 天雲指数で降順ソート

    sortedIntegrated.forEach(item => {
        const t_class = item.tenun >= 90 ? 'high' : item.tenun >= 80 ? 'medium' : 'low';
        integratedHtml += `
            <tr>
                <td>${item.id}</td>
                <td class="tenun-index ${t_class}"><strong>${item.tenun.toFixed(1)}</strong></td>
                <td>${item.seitenrei.toFixed(2)}</td>
                <td>${item.koutenrei.toFixed(2)}</td>
            </tr>
        `;
    });
    integratedHtml += '</tbody></table>';
    integratedContainer.innerHTML = integratedHtml;


    // 2. 詳細シナリオ結果の表示
    let detailedHtml = '<h3>詳細展開シミュレーション (選択モード: ' + (document.getElementById('mode-selector').value === 'koutenrei' ? '荒天令' : '晴天令') + ')</h3>';
    
    detailedScenarioResults.forEach(scenarioResult => {
        detailedHtml += `
            <div class="scenario-block">
                <h4>展開: ${scenarioResult.scenario}</h4>
                <table class="scenario-table">
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>脚質</th>
                            <th>スコア</th>
                            <th>グレード</th>
                            <th>確率</th>
                        </tr>
                    </thead>
                    <tbody>
        `;

        scenarioResult.players.sort((a, b) => {
            const scoreA = isFinite(a.final_score) ? a.final_score : -Infinity;
            const scoreB = isFinite(b.final_score) ? b.final_score : -Infinity;
            return scoreB - scoreA;
        });

        scenarioResult.players.forEach(p => {
            const wager = scenarioResult.wagers.find(w => w.id === p.id);
            const prob = wager ? (wager.probability * 100).toFixed(1) : '0.0';
            
            // ★修正: 競りマークの再表示★
            let seriMark = '';
            if (SERI_ATTACKERS.includes(p.id)) {
                 seriMark = '⚔️'; 
            } else if (PLAYERS_FACING_SERI.includes(p.id)) {
                 seriMark = '🛡️';
            }
            
            detailedHtml += `
                <tr>
                    <td>${p.id}${seriMark}</td>
                    <td>${p.style}</td>
                    <td>${p.final_score.toFixed(2)}</td>
                    <td class="grade-${p.final_grade ? p.final_grade.toLowerCase() : 'd'}">${p.final_grade || 'D'}</td>
                    <td>${prob}%</td>
                </tr>
            `;
        });

        detailedHtml += '</tbody></table></div>';
    });

    outputContainer.innerHTML = detailedHtml;
}


// ----------------------------------------------------------------------
// ★ 5. メイン計算関数: calculatePrediction の修正 (競りリセットと堅牢性) ★
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
        logMessage(`[LINE] 解析ライン数: ${lines.length}。競り仕掛け: ${SERI_ATTACKERS.length}名。`); 

        // --- II. 選手固有係数 C_W, C_R, C_S1, C_B1 & C_E の計算 (基礎係数) ---
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

        // ★修正: displayResults 関数を呼び出し、詳細な結果と統合結果を表示する★
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
        logMessage(`スタック: ${error.stack ? error.stack.split('\n')[1].trim() : 'N/A'}`);
        logMessage("----------------------------------");
        logMessage(`【重要】原因特定のため、上記の**エラー名**と**メッセージ**の全文を共有してください。`);
    }
}
