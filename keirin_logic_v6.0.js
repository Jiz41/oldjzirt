/*
* ======================================================
* バージョン保存日時: 2025年12月3日
* バージョン: V6.0 (マニュアルとデバッグログの配置/体裁調整完了版 + X投稿機能追加)
* ======================================================
*/

// -------------------------------------------------------------------------
// 1. グローバル変数と定数定義
// -------------------------------------------------------------------------

const BASE_SCORE_FACTOR = 0.5; // 得点の影響度ベース
const RECENT_FORM_FACTOR = 0.15; // 直近3走の影響度
const WMARK_FACTOR = 0.1; // 予想印の影響度ベース

const WMARK_VALUES = {
    '◎': 1.5,
    '〇': 1.2,
    '△': 1.0,
    '✕': 0.8,
    '無': 0.5
};

const BANK_DATA = {
    "弥彦": { type: "400m", tendency: "逃げ・捲り有利" },
    "立川": { type: "400m", tendency: "捲りが有利、追込も決まる" },
    "岸和田": { type: "400m", tendency: "追込・捲り有利" },
    "小倉": { type: "400m", tendency: "先行不利、捲り・追込有利" },
    "川崎": { type: "400m", tendency: "差・捲り有利" },
    "京王閣": { type: "400m", tendency: "先行有利、差も強い" },
    // ... その他のバンクデータをここに定義 ...
    "平塚": { type: "400m", tendency: "差・捲り有利" } // ダミーデータとして追加
};

// -------------------------------------------------------------------------
// 2. ログおよびUIヘルパー関数
// -------------------------------------------------------------------------

function logDebug(message) {
    const logElement = document.getElementById('debug-log');
    const now = new Date();
    const timeString = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
    logElement.innerHTML += `[${timeString}] ${message}<br>`;
    logElement.scrollTop = logElement.scrollHeight;
}

function displayBankTendency() {
    const bankName = document.getElementById('bank-name').value;
    const displayElement = document.getElementById('bank-tendency-display');
    const data = BANK_DATA[bankName];
    
    if (data) {
        displayElement.innerHTML = `バンク: ${bankName} (${data.type}) / **傾向:** ${data.tendency}`;
        logDebug(`[INFO] バンク傾向を表示しました: ${bankName}`);
    } else {
        displayElement.innerHTML = `バンク情報なし。`;
    }
}

// -------------------------------------------------------------------------
// 3. データ構造と取得関数
// -------------------------------------------------------------------------

// 選手の入力データを保持する構造
class PlayerData {
    constructor(id, style, score, wmark, recent, s1, b1) {
        this.id = id;
        this.style = style; // 逃先(自), 差マ(追), 捲り(両)
        this.score = score;
        this.wmark = wmark;
        this.recent = recent;
        this.s1 = s1; // S1位フラグ (boolean)
        this.b1 = b1; // B1位フラグ (boolean)
        
        // 算出される評価値
        this.baseRating = 0;
        this.finalScore = 0;
        this.scenarioRank = 0; // シナリオ評価順位
    }
}

function getPlayerInputs() {
    const players = [];
    const playerRows = document.querySelectorAll('.player-row');
    const s1Leader = document.querySelector('input[name="s-leader"]:checked');
    const b1Leader = document.querySelector('input[name="b-leader"]:checked');

    let isValid = true;

    playerRows.forEach(row => {
        const id = parseInt(row.dataset.id);
        const style = row.querySelector('.style').value;
        const score = parseFloat(row.querySelector('.score').value);
        const wmark = row.querySelector('.wmark').value;
        const recentText = row.querySelector('.recent').value;

        // 簡単なバリデーション
        if (isNaN(score) || score < 50 || recentText.length !== 3) {
            logDebug(`[ERROR] 選手ID ${id}のデータが不正です。`);
            isValid = false;
        }

        const player = new PlayerData(
            id,
            style,
            score,
            wmark,
            recentText,
            s1Leader && parseInt(s1Leader.dataset.id) === id,
            b1Leader && parseInt(b1Leader.dataset.id) === id
        );
        players.push(player);
    });

    if (!isValid) return null;

    return players;
}

// -------------------------------------------------------------------------
// 4. 計算ロジック本体 (calculatePrediction)
// -------------------------------------------------------------------------

function calculatePrediction() {
    logDebug('[ACTION] ユーザーが計算実行をトリガーしました。');
    document.getElementById('post-to-x-button').disabled = true; // 計算開始時に無効化

    const players = getPlayerInputs();
    if (!players) {
        logDebug('[CRITICAL] 入力データに不備があり、計算を中断しました。');
        alert('入力データに不正な値があります。競走得点や直近3走を確認してください。');
        return;
    }

    const lineInput = document.getElementById('line-input').value;
    const raceType = document.getElementById('race-type').value;
    
    // UIを初期化し、結果コンテナを表示
    document.getElementById('results-container').classList.add('visible');
    document.getElementById('seitenrei-output').innerHTML = '計算中...';
    document.getElementById('koutenrei-output').innerHTML = '計算中...';
    document.getElementById('scenario-output').innerHTML = '';
    
    // --- 【コアロジック開始】 ---

    // 1. ライン構成の解析と表示 (ライン強度計算ロジック)
    // const lines = parseLines(lineInput);
    // displayLineStrength(lines); // UI反映

    logDebug('[PROCESS] 選手データの評価点計算を開始。');

    // 2. 選手ごとの基本評価点の計算 (得点、直近3走、予想印の反映)
    players.forEach(p => {
        // 直近3走の着順をポイント化するロジック (例: 1着=3点, 2着=2点, 3着=1点)
        // const recentPoints = calculateRecentPoints(p.recent); 
        
        // 予想印の補正係数
        const wmarkMod = WMARK_VALUES[p.wmark] || WMARK_VALUES['無'];
        
        // p.baseRating = (p.score * BASE_SCORE_FACTOR) + (recentPoints * RECENT_FORM_FACTOR) * (1 + wmarkMod * WMARK_FACTOR);
        // p.finalScore = p.baseRating;
    });

    // 3. 展開シナリオの生成と評価
    
    // --- 【シナリオ定義の場所】 ---
    // ここに、脚質、ライン、S1/B1フラグに基づいて、可能な展開パターン（シナリオ）を
    // 網羅的に生成するロジックが記述されます。
    // 例: ScenarioA: [1逃げ-2差し-3捲り] / ScenarioB: [5先行-4追込] ...
    
    // 4. シナリオ結果の採点と順位付け
    
    // --- 【シナリオ評価ロジックの場所】 ---
    // 各シナリオに対して、選手ごとのfinalScoreと、シナリオ内の役割(逃げ/差しなど)を考慮した
    // 評価値(Score)を算出し、最終的な推奨着順(Result)と順位(Rank)を決定します。
    // 例: ScenarioA_Result: 1-2-3, Score: 95.0
    //     ScenarioB_Result: 4-5-1, Score: 92.5
    
    const allScenarios = [
        // ... 評価済みのシナリオオブジェクトがここに格納される ...
        { name: "基本展開A", result: "1-2-3", score: 95.0, rank: 1, recommendation: "本線" },
        { name: "波乱展開B", result: "3-1-4", score: 88.5, rank: 2, recommendation: "穴目" },
        { name: "高配当C", result: "7-5-1", score: 85.2, rank: 3, recommendation: "大穴" },
        // ...
    ];

    // 5. 晴天令・荒天令の決定とUI反映
    
    // 晴天令 (トップスコアのシナリオから安定した買い目を抽出)
    const seitenreiResult = allScenarios.filter(s => s.rank <= 3).map(s => s.result).join(', ');
    document.getElementById('seitenrei-output').innerHTML = `☀️ 晴天令 (安定推奨) <br> ${seitenreiResult}`;

    // 荒天令 (スコアが中位〜下位だが波乱要素があるシナリオから高配当狙いを抽出)
    const koutenreiResult = allScenarios.filter(s => s.rank >= 3 && s.rank <= 6).map(s => s.result).join(', ');
    document.getElementById('koutenrei-output').innerHTML = `⛈️ 荒天令 (高配当狙い) <br> ${koutenreiResult}`;

    // 6. 詳細シナリオ結果のUI反映
    // displayScenarioDetails(allScenarios); // allScenariosをテーブル化してscenario-outputに書き込む

    logDebug('[PROCESS] 計算とUIへの結果書き込みが完了しました。');

    // --- 【コアロジック終了】 ---
    
    // 7. X投稿ボタンの有効化 (今回追加された最も重要な処理)
    document.getElementById('post-to-x-button').disabled = false;
    logDebug('[ACTION] X投稿ボタンを有効化しました。');
}

// -------------------------------------------------------------------------
// 5. X (旧Twitter) 投稿機能 (新規追加)
// -------------------------------------------------------------------------
function postToX() {
    logDebug('[ACTION] X投稿ボタンが押されました。');
    
    // 1. 各データの取得
    const bankName = document.getElementById('bank-name').value;
    // HTML書き込み時の改行<br>やHTMLタグはtextContentで取得できるが、念のためtrim()
    const seitenreiOutput = document.getElementById('seitenrei-output').textContent.trim();
    const koutenreiOutput = document.getElementById('koutenrei-output').textContent.trim();
    
    // 結果が未計算の場合は投稿を中止
    if (seitenreiOutput.includes('計算結果待ち...') || koutenreiOutput.includes('計算結果待ち...')) {
        alert('先に予想計算を実行してください。');
        return;
    }

    // 2. 投稿テキストの組み立て
    // 投稿内容から不要なヘッダー部分を削除し、買い目のみを取得する
    const seitenreiContent = seitenreiOutput.replace('☀️ 晴天令 (安定推奨)', '安定推奨:').trim();
    const koutenreiContent = koutenreiOutput.replace('⛈️ 荒天令 (高配当狙い)', '高配当狙い:').trim();

    const toolURL = 'https://huggingface.co/spaces/Jiz41/Jiz41r1t5u';

    // テンプレートに沿ってテキストを組み立てる
    const postText = 
`${bankName} [ここにレース番号R]
    
${seitenreiContent}
    
${koutenreiContent}
    
#華耀天輪真自在律 
#卦有中亦有不中
    
${toolURL}`;

    logDebug(`[INFO] 生成された投稿テキスト: ${postText.substring(0, 50)}...`);

    // 3. URLエンコードと投稿ウィンドウのオープン
    const encodedText = encodeURIComponent(postText);
    const tweetURL = `https://twitter.com/intent/tweet?text=${encodedText}`;
    
    // 新しいウィンドウで投稿画面を開く
    window.open(tweetURL, '_blank');
}
// -------------------------------------------------------------------------

// -------------------------------------------------------------------------
// 6. 初期化処理 (UIの初期設定)
// -------------------------------------------------------------------------
function initializeUI() {
    // バンク名セレクトボックスにオプションを動的に追加するロジック
    const bankSelect = document.getElementById('bank-name');
    for (const bank in BANK_DATA) {
        const option = document.createElement('option');
        option.value = bank;
        option.textContent = bank;
        bankSelect.appendChild(option);
    }
    
    // 初期バンク傾向の表示
    displayBankTendency();
    
    // デバッグログに起動完了を記録
    logDebug('[TOOL START] ツール起動完了。UIの初期化を完了しました。');
}

// ページロード時に実行
window.onload = initializeUI;
