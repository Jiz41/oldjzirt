/*
* ======================================================
* バージョン保存日時: 2025年12月3日
* バージョン: V6.0 (マニュアルとデバッグログの配置/体裁調整完了版 + X投稿機能追加)
* ======================================================
*/

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
    // ※ 実行後の表示は displayResults() の中で更新します
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
        `${top4[0]}=${top4[1]}=${top4[3]}`
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


// メイン計算関数
async function calculatePrediction() {
    
    // 【追加】計算開始時にX投稿ボタンを無効化
    document.getElementById('post-to-x-button').disabled = true;

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
    
    logMessage(`[CALC START] ${raceType} / バンク: ${bankName} で計算開始。`);

    // --- I. C_L (ライン・連係係数) の計算とライン強度の表示 ---
    calculateLineCoeffs(players, settings);

    // --- II. 選手固有係数 C_W, C_R, C_S1, C_B1 & C_E の計算 (W印の修正を含む) ---
    players.forEach(p => {
        p.c_score_adj = 1.0 + (p.score / 100 - 1) * settings.R_BIAS; 
        const recentScores = p.recent.split('').map(Number);
        const avgRank = recentScores.length > 0 ? recentScores.reduce((a, b) => a + b, 0) / recentScores.length : 4.0; 
        p.c_recent = (1.0 + (4 - avgRank) * 0.05) * settings.RECENT_WEIGHT; 

        // W印の係数
        if (p.wmark === '◎') p.c_wmark = 1.04;
        else if (p.wmark === '〇') p.c_wmark = 1.02;
        else if (p.wmark === '✕') p.c_wmark = 1.015; 
        else if (p.wmark === '△') p.c_wmark = 1.01;
        else p.c_wmark = 1.0; // 無

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

    // --- III. 展開別シミュレーションと最終スコア算出 ---
    const scenarios = ['先行有利', '捲り有利', '差し有利'];
    const allScenarioResults = [];

    scenarios.forEach(scenario => {
        const cDCoeffs = getScenarioCoeffs(scenario);
        
        let scenarioPlayers = JSON.parse(JSON.stringify(players));
        
        scenarioPlayers.forEach(p => {
            const cD = cDCoeffs[p.style] || 1.0;
            p.final_score = p.score * p.c_score_adj * p.c_wmark * p.c_recent * p.c_s1 * p.c_b1 * p.c_l * p.c_e * cD;
        });

        scenarioPlayers.sort((a, b) => b.final_score - a.final_score);
        
        assignFinalGrades(scenarioPlayers);

        allScenarioResults.push({ scenario, results: scenarioPlayers });
    });

    // --- IV. 最終結果の統合と表示 ---
    displayResults(allScenarioResults, players, bankName); 
    
    // ★修正点2: 計算完了後、結果コンテナを表示する
    const resultsContainer = document.getElementById('results-container');
    if (resultsContainer) {
        resultsContainer.classList.add('visible');
    }

    // 【追加】計算完了後、X投稿ボタンを有効化
    document.getElementById('post-to-x-button').disabled = false;
    logMessage('[CALC END] 予想計算が完了し、結果が表示されました。X投稿ボタンを有効化しました。');
}

// 最終スコアと順位の表示を削除
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

    // 総合評価の計算 (買い目生成に必要なため維持)
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
    if (seitenreiOutput) {
        const seitenTritan = [
            `${top3[0].id}-${top3[1].id}-${top3[2].id}`,
            `${top3[0].id}-${top3[2].id}-${top3[1].id}`,
            `${top3[1].id}-${top3[0].id}-${top3[2].id}`
        ].join(', ');
        
        const seitenTrifuku = [
            `${top4[0].id}=${top4[1].id}=${top4[2].id}`,
            `${top4[0].id}=${top4[1].id}=${top4[3] ? top4[3].id : 'X'}`
        ].join(', ');
        
        // 【修正】X投稿時に内容を取得しやすいようヘッダーとHTMLタグを追加
        seitenreiOutput.innerHTML = `☀️ 晴天令 (安定推奨) <br>
            三連単 (3点): <strong>${seitenTritan}</strong><br>
            三連複 (2点): <strong>${seitenTrifuku}</strong>
        `;
    }

    // 荒天令 (高配当狙い) - 三連複3点を表示
    const koutenreiOutput = document.getElementById('koutenrei-output');
    if (koutenreiOutput) {
        
        // 荒天令の軸 (通常4位)
        const koutenLeader = top4[3] ? top4[3].id : null; 
        
        let koutenTrifuku = '';
        if (koutenLeader) {
            // 荒天令 三連複 3点: 4=1=2, 4=1=3, 4=2=3 (軸4位、相手1,2,3位)
            koutenTrifuku = [
                `${koutenLeader}=${top3[0].id}=${top3[1].id}`, 
                `${koutenLeader}=${top3[0].id}=${top3[2].id}`,
                `${koutenLeader}=${top3[1].id}=${top3[2].id}` 
            ].join(', ');
        } else {
            koutenTrifuku = 'データ不足のため生成不可';
        }

        // 【修正】X投稿時に内容を取得しやすいようヘッダーとHTMLタグを追加
        koutenreiOutput.innerHTML = `⛈️ 荒天令 (高配当狙い) <br>
            推奨軸 (4位): **${koutenLeader ? koutenLeader : 'N/A'}**<br>
            三連複 (3点): <strong>${koutenTrifuku}</strong>
        `;
    }
}

// -------------------------------------------------------------------------
// 5. X (旧Twitter) 投稿機能 (新規追加)
// -------------------------------------------------------------------------
function postToX() {
    logMessage('[ACTION] X投稿ボタンが押されました。');
    
    // 1. 各データの取得
    const bankName = document.getElementById('bank-name').value;
    const seitenreiOutput = document.getElementById('seitenrei-output').textContent.trim();
    const koutenreiOutput = document.getElementById('koutenrei-output').textContent.trim();
    
    // 結果が未計算の場合は投稿を中止
    if (seitenreiOutput.includes('計算中...') || koutenreiOutput.includes('計算中...')) {
        alert('先に予想計算を実行してください。');
        return;
    }

    // 2. 投稿テキストの組み立て
    
    // ★★★ 改行制御ロジック (点数と買い目の間に改行を挿入) ★★★
    
    const cleanAndFormat = (text, prefix) => {
        // 1. ヘッダーを必要な形に置換し、全ての空白文字を単一のスペースに統一
        let cleaned = text
            .replace(prefix, prefix.split(' ')[0] + ':') // "☀️ 晴天令 (安定推奨)" -> "☀️ 晴天令:"
            .replace(/(\s\s*|\n|\r|\t)/g, ' ') // 全ての空白文字を単一スペースに置換
            .trim();

        // 2. 目的の項目の前に改行、そして点数表記の直後（閉じ括弧 ")" の後）に改行を挿入して整形
        cleaned = cleaned
            // ヘッダー直後を改行
            .replace(/: /, ':\n') 
            // 三連単/三連複/推奨軸の前に改行
            .replace(/三連単/g, '\n三連単')
            .replace(/三連複/g, '\n三連複')
            .replace(/推奨軸/g, '\n推奨軸')
            // 点数表記の閉じ括弧 ")" の直後に改行を挿入 (例: (3点) の後に \n)
            .replace(/\) /g, ')\n')
            // 推奨軸のコロン ":" の後にも改行を挿入（買い目が次行に来るように）
            .replace(/\*\*\: /g, '**\n') 
            // 行頭のスペースを削除
            .trim();
            
        return cleaned;
    };
    
    const seitenreiContent = cleanAndFormat(seitenreiOutput, '☀️ 晴天令 (安定推奨)');
    const koutenreiContent = cleanAndFormat(koutenreiOutput, '⛈️ 荒天令 (高配当狙い)');

    const toolURL = 'https://huggingface.co/spaces/Jiz41/Jiz41r1t5u';

    // テンプレートに沿ってテキストを組み立てる
    const postText = 
`${bankName} [ここにレース番号R]

${seitenreiContent}

${koutenreiContent}
    
#華耀天輪真自在律 
#卦有中亦有不中
    
${toolURL}`;

    logMessage(`[INFO] 生成された投稿テキスト: ${postText.substring(0, 50).replace(/\n/g, '\\n')}...`);

    // 3. URLエンコードと投稿ウィンドウのオープン
    const encodedText = encodeURIComponent(postText);
    const tweetURL = `https://twitter.com/intent/tweet?text=${encodedText}`;
    
    // 新しいウィンドウで投稿画面を開く
    window.open(tweetURL, '_blank');
}
// -------------------------------------------------------------------------
