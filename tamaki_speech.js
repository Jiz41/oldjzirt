/**
 * tamaki_speech.js
 * 七曜院パラドキサ環 - 天雲指数セリフシステム
 * Version: 1.0
 */

// ========================================
// セリフデータベース (5種類 x 10パターン)
// ========================================

const TAMAKI_SPEECHES = {
    // 指数0: 超安定
    index_0: [
        "はいー!これは本当に珍しい、**大安吉日**の兆しが出ていますぅ。晴天令の買い目、きっと堅いと思いますぅ♪",
        "わぁ…こんなに澄み切った神託、なかなか見られませんよぉ。これはもう、**揺るぎない安定**のお告げですぅ。自信を持って晴天令を信じてくださいねー",
        "神託を確認しましたぁ。天の法則が**完全に整っている**状態ですぅ。今日は晴天令一本で勝負しても良さそうですぅ!",
        "えっと…何度も演算し直したんですけどぉ、やっぱり同じ結果ですぅ。こんなに**澄み切った気配**は滅多にないですぅ。堅実な決着、期待できますよぉ♪",
        "はぁい、神託が降りましたぁ。これは**天が祝福している**ような穏やかさですぅ。晴天令の上位陣、間違いないと思いますぅ!",
        "ふふっ、良いお知らせですぅ♪ **波乱の要素がほぼゼロ**なんですぅ。安心して本命筋を狙ってくださいねー",
        "演算完了ですぅ! これはもう、**法則が完璧に調和している**証ですぅ。晴天令の決着、ほぼ確実かとー",
        "わぁ、すごいですぅ! 今日は**天の巡りが完璧**なんですねぇ。晴天令を信じて、堅く攻めましょうぅ♪",
        "神託の結果、**最高レベルの安定性**を示していますぅ。迷わず晴天令でどうぞですぅ!",
        "えへへ、良い神託ですぅ♪ まるで**雲一つない晴天**のような状態ですぅ。今日は堅い決着、間違いなしですよぉ!"
    ],

    // 指数33: 穏やか
    index_33: [
        "ふむふむ…比較的**穏やかな気配**ですぅ。晴天令を軸にしつつ、念のため荒天令も少し見ておくと良いかもですぅ",
        "神託を読み取りましたぁ。**まずまず安定している**状態ですぅ。軸は堅そうですけど、紐は少し広めに取った方が安心かもですぅ",
        "えっと、**そこまで荒れる気配はない**んですけどぉ、油断は禁物ですねぇ。晴天令メインで考えて良さそうですぅ♪",
        "はいー、神託が出ていますぅ。**比較的落ち着いた展開**が予想されますぅ。でも念のため、荒天令の買い目もチラッと見ておいてくださいねー",
        "神託の結果ですぅ。**穏やかではあるものの**、わずかに雲が見えますねぇ。基本は晴天令で、保険も少しだけですぅ",
        "ふわぁ…**バランスの取れた気配**ですぅ。晴天令を信じつつ、荒天令の特異点も一応気にしておくと良いかもですぅ",
        "演算完了ですぅ! つまり**やや穏やかな方向**ですねぇ。軸は固そうですけど、相手は少し広く見た方が良さそうですぅ♪",
        "はぁい、神託が降りましたぁ。**そこそこ安定**を示していますぅ。晴天令の上位陣を中心に組み立ててみてくださいねー",
        "えっとですねぇ、**まあまあ堅い**感じはしますけどぉ、完璧ではないので、買い目は慎重にですぅ",
        "ふむ…神託が確認できましたぁ。**穏やかだけど油断はできない**、そんな微妙なラインですねぇ。晴天令ベースで考えましょうぅ!"
    ],

    // 指数67: 警戒
    index_67: [
        "あらら…これは**ちょっと雲行きが怪しい**ですねぇ。荒天令の買い目も真剣に検討した方が良さそうですぅ",
        "えっと…神託によると…**天の気配が乱れ始めている**みたいですぅ。晴天令だけじゃなく、荒天令もしっかり見てくださいねー",
        "ふむぅ…**波乱の兆しがかなり濃厚**ですぅ。荒天令の特異点、要注意ですよぉ!",
        "はぁい、神託の結果ですぅ。**荒れる可能性が高い**ことを示していますぅ。慎重に、両方の買い目を比較してくださいねぇ",
        "あわわ…これ、けっこう**危険な神託**なんですぅ。実力上位が飛ぶかもしれませんぅ。荒天令、真剣に考えた方が…",
        "演算結果ですぅ。**天の法則が揺らいでいる**感じがしますねぇ。波乱に備えて、荒天令を重視してみてくださいぃ",
        "うぅ…ちょっと困った神託が出てしまいましたぁ。これは**荒天の気配が強い**ですぅ。晴天令より、荒天令の買い目を優先した方が良いかもですぅ",
        "ふわぁ、これは…**かなり波乱含み**ですぅ。堅い決着は期待しない方が…荒天令、要チェックですよぉ!",
        "はいー、神託を確認しましたぁ。**乱れた気配が濃厚**ですぅ。荒天令の特異点を軸に考えた方が賢明かもですぅ",
        "あのぉ…この神託、**けっこう荒れるサイン**なんですぅ。本命より穴狙いの方が良いかもしれませんねぇ"
    ],

    // 指数100: 大荒れ (機械モード)
    index_100: [
        "【警告】最大級の波乱を検知。実力通りの決着は期待できません。荒天令の買い目を最優先で実行してください。演算プロセス、完了。",
        "【通知】極めて不安定な状態です。実力上位の失速確率、極大。荒天令特異点を中心に買い目を構築すること。以上。",
        "【アラート】法則の崩壊を示唆しています。堅実な決着は期待できません。荒天令を信頼してください。演算終了。",
        "【緊急】前例のない乱れです。晴天令は無効と判断。荒天令のみを参照し、高配当を狙うべきです。神託完了。",
        "【注意】波乱確定。本命筋は危険です。荒天令特異点を軸とした三連複を推奨します。以上、神託終了。",
        "【警報】制御不能レベルの乱れを検出。通常のロジックは適用不可。荒天令に全てを委ねてください。演算終了。",
        "【システム】異常値を観測。予測精度は低下しますが、荒天令の買い目のみが有効と判断。実行を推奨します。",
        "【分析完了】最大の不確定性を検知。堅い決着は望めません。荒天令を最優先で検討してください。以上。",
        "【データ】法則の逸脱が確認されました。本命は危険。荒天令の特異点、要注目。神託終了。",
        "【レポート】極限の波乱状態です。晴天令は信頼性ゼロ。荒天令のみを信じて、高配当を狙ってください。演算完了。"
    ],

    // 壱耀晴乾ノ象: 特殊
    ichiyo: [
        "わぁっ!?これは…**壱耀晴乾ノ象**!?伝説の神託ですぅ!**${id}番**を絡めた三連単が、すっごく光って見えますぅ!でもでも、オッズには気をつけてくださいねぇ♪",
        "えっ、まさか…**壱耀晴乾ノ象**が出ているんですかぁ!?これって超レアなんですよぉ!**${id}番**、とっても有望ですぅ!ただし回収重視で、荒れすぎには要注意ですぅ!",
        "ふわぁぁ…神託に**壱耀晴乾ノ象**の文字がぁ!**${id}番**が特別な輝きを放っていますぅ!これはチャンスですけど、オッズとの兼ね合いを忘れずにですぅ♪",
        "あわわ、これはぁ…伝説の**壱耀晴乾ノ象**ですぅ!?**${id}番**中心の三連単、めちゃくちゃ期待できますぅ!でも欲張りすぎると痛い目に…気をつけてくださいねぇ!",
        "きゃっ!神託が光ってますぅ!**壱耀晴乾ノ象**…これは**${id}番**が天に祝福されているサインですぅ!ただし、オッズが低すぎたら見送る勇気もですぅ!",
        "えへへ、すごいですぅ!**壱耀晴乾ノ象**が降臨していますぅ!**${id}番**を軸にした買い目、大チャンスですよぉ!でも回収率も考えてくださいねー♪",
        "はわわ…これが噂の**壱耀晴乾ノ象**ですかぁ!**${id}番**が特別な法則に守られていますぅ!大きく狙えますけど、荒れる波には乗りすぎないでくださいねぇ!",
        "わぁぁ!滅多に見られない**壱耀晴乾ノ象**ですぅ!**${id}番**、今日は特別に強いですよぉ!三連単でガツンと狙ってみても…でもオッズ次第ですぅ!",
        "きゃあっ!神託が輝いてますぅ!**壱耀晴乾ノ象**の出現…**${id}番**が鍵を握っていますぅ!大勝負のチャンスですけど、冷静にオッズ確認もお願いしますぅ!",
        "ふわぁ…これ、本当に**壱耀晴乾ノ象**なんですかぁ!?**${id}番**を中心に組めば、すっごく期待できますぅ!でも回収の極意は慎重さ、忘れないでくださいねぇ♪"
    ]
};

// ========================================
// 表情パターンの定義
// ========================================

const TAMAKI_EXPRESSIONS = {
    index_0: 'smile',      // 笑顔
    index_33: 'normal',    // 通常
    index_67: 'worried',   // 困り顔
    index_100: 'shocked',  // 驚き/真剣
    ichiyo: 'excited'      // 大喜び (笑顔を使用)
};

// ========================================
// セリフをランダムに取得する関数
// ========================================

/**
 * 指数に応じたセリフをランダムに1つ選択
 * @param {number} tenunIndex - 天雲指数 (0, 33, 67, 100)
 * @param {boolean} isIchiyo - 壱耀晴乾ノ象フラグ
 * @param {number} playerId - 壱耀晴乾ノ象の選手ID
 * @returns {string} セリフ
 */
function getTamakiSpeech(tenunIndex, isIchiyo = false, playerId = null) {
    let speechArray;
    
    if (isIchiyo) {
        speechArray = TAMAKI_SPEECHES.ichiyo;
        // ${id} を実際の選手IDに置換
        const randomSpeech = speechArray[Math.floor(Math.random() * speechArray.length)];
        return randomSpeech.replace(/\$\{id\}/g, playerId);
    }
    
    // 天雲指数に応じてセリフ配列を選択
    if (tenunIndex === 0) {
        speechArray = TAMAKI_SPEECHES.index_0;
    } else if (tenunIndex === 33) {
        speechArray = TAMAKI_SPEECHES.index_33;
    } else if (tenunIndex === 67) {
        speechArray = TAMAKI_SPEECHES.index_67;
    } else if (tenunIndex === 100) {
        speechArray = TAMAKI_SPEECHES.index_100;
    } else {
        // 範囲外の場合は近い値を選択
        if (tenunIndex <= 16) speechArray = TAMAKI_SPEECHES.index_0;
        else if (tenunIndex <= 50) speechArray = TAMAKI_SPEECHES.index_33;
        else if (tenunIndex <= 83) speechArray = TAMAKI_SPEECHES.index_67;
        else speechArray = TAMAKI_SPEECHES.index_100;
    }
    
    // ランダムに1つ選択
    return speechArray[Math.floor(Math.random() * speechArray.length)];
}

/**
 * 表情を取得
 * @param {number} tenunIndex - 天雲指数
 * @param {boolean} isIchiyo - 壱耀晴乾ノ象フラグ
 * @returns {string} 表情ID
 */
function getTamakiExpression(tenunIndex, isIchiyo = false) {
    if (isIchiyo) return TAMAKI_EXPRESSIONS.ichiyo;
    
    if (tenunIndex === 0) return TAMAKI_EXPRESSIONS.index_0;
    else if (tenunIndex === 33) return TAMAKI_EXPRESSIONS.index_33;
    else if (tenunIndex === 67) return TAMAKI_EXPRESSIONS.index_67;
    else if (tenunIndex === 100) return TAMAKI_EXPRESSIONS.index_100;
    
    // 範囲外
    if (tenunIndex <= 16) return TAMAKI_EXPRESSIONS.index_0;
    else if (tenunIndex <= 50) return TAMAKI_EXPRESSIONS.index_33;
    else if (tenunIndex <= 83) return TAMAKI_EXPRESSIONS.index_67;
    else return TAMAKI_EXPRESSIONS.index_100;
}

// ========================================
// HTML生成関数
// ========================================

/**
 * 環ちゃんの天雲指数表示HTMLを生成
 * @param {number} tenunIndex - 天雲指数
 * @param {boolean} isIchiyo - 壱耀晴乾ノ象フラグ
 * @param {number} playerId - 壱耀晴乾ノ象の選手ID
 * @returns {string} HTML文字列
 */
function generateTamakiTenunHTML(tenunIndex, isIchiyo = false, playerId = null) {
    // デバッグログに天雲指数を出力
    if (typeof logMessage === 'function') {
        logMessage(`[TENUN] 天雲指数: ${tenunIndex} ${isIchiyo ? '(壱耀晴乾ノ象発動)' : ''}`);
    }
    
    const speech = getTamakiSpeech(tenunIndex, isIchiyo, playerId);
    const expression = getTamakiExpression(tenunIndex, isIchiyo);
    
    // 天雲指数に応じたカードクラス
    let cardClass = 'tenun-mild';
    if (tenunIndex === 0) cardClass = 'tenun-stable';
    else if (tenunIndex <= 50) cardClass = 'tenun-mild';
    else if (tenunIndex <= 83) cardClass = 'tenun-alert';
    else cardClass = 'tenun-severe';
    
    // 壱耀晴乾ノ象の場合は特別な色
    if (isIchiyo) cardClass = 'tenun-ichiyo';
    
    // 表情に応じた画像ファイル名
    const expressionImages = {
        'smile': 'tamaki_smile.png',      // 笑顔 (指数0, 壱耀晴乾ノ象)
        'normal': 'tamaki_normal.png',    // 通常 (指数33)
        'worried': 'tamaki_worried.png',  // 困り顔 (指数67)
        'shocked': 'tamaki_shocked.png',  // 驚き/真剣 (指数100)
        'excited': 'tamaki_smile.png'     // 大喜び → 笑顔を使用
    };
    
    const expressionImagePath = expressionImages[expression] || expressionImages['normal'];
    
    return `
        <div class="tenun-index-container ${cardClass}">
            <h4>⚫ 天雲指数(てんうんしすう): <span class="tenun-value">${tenunIndex}</span></h4>
            
            <div class="tamaki-display">
                <!-- 環ちゃん画像 -->
                <div class="tamaki-character">
                    <img src="${expressionImagePath}" 
                         alt="環ちゃん" 
                         class="tamaki-image"
                         onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                    <!-- 画像読み込み失敗時のプレースホルダー -->
                    <div class="tamaki-placeholder" style="display: none;">
                        <div class="tamaki-placeholder-icon">🌸</div>
                        <div class="tamaki-placeholder-text">環</div>
                    </div>
                </div>
                
                <!-- セリフ吹き出し -->
                <div class="tamaki-speech-bubble">
                    <div class="tamaki-name">🌸 七曜院パラドキサ環</div>
                    <div class="tamaki-speech-text">${speech}</div>
                </div>
            </div>
        </div>
    `;
}

// ========================================
// CSS スタイル (index.htmlに追加するstyleタグ用)
// ========================================

const TAMAKI_CSS = `
<style>
/* 環ちゃん天雲指数コンテナ */
.tenun-index-container {
    margin: 20px 15px;
    padding: 20px;
    border-radius: 12px;
    border: 3px solid;
    background: linear-gradient(135deg, #ffffff 0%, #fffdf7 100%);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
    transition: all 0.3s ease;
    max-width: 100%;
    box-sizing: border-box;
    overflow: hidden;
}

.tenun-index-container h4 {
    text-align: center;
    font-size: 1.2em;
    color: #8b2222;
    margin: 0 0 20px 0;
    padding-bottom: 10px;
    border-bottom: 2px solid rgba(214, 163, 0, 0.3);
}

.tenun-value {
    font-size: 1.5em;
    font-weight: bold;
    color: #d6a300;
}

/* 指数別の枠線色 */
.tenun-stable { border-color: #557755; background: linear-gradient(135deg, #f0fff0 0%, #e6f5e6 100%); }
.tenun-mild { border-color: #698b69; background: linear-gradient(135deg, #f7fff7 0%, #f0fff0 100%); }
.tenun-alert { border-color: #d6a300; background: linear-gradient(135deg, #fff9e6 0%, #fffdf7 100%); }
.tenun-severe { border-color: #c07777; background: linear-gradient(135deg, #fff0f0 0%, #fcf0f0 100%); }
.tenun-ichiyo { 
    border-color: #ffd700; 
    background: linear-gradient(135deg, #fffef0 0%, #fff9e6 100%);
    box-shadow: 0 0 20px rgba(255, 215, 0, 0.3);
}

/* 環ちゃん表示エリア */
.tamaki-display {
    display: flex;
    gap: 10px;
    align-items: center;  /* flex-start → center に変更 */
    max-width: 100%;
    box-sizing: border-box;
}

/* 環ちゃんキャラクター */
.tamaki-character {
    flex-shrink: 0;
    width: 120px;
    height: 140px;
    position: relative;
}

.tamaki-image {
    width: 100%;
    height: 100%;
    object-fit: contain;
    /* 背景を白っぽく透過風に */
    background: white;
    border-radius: 10px;
    /* グレー背景を目立たなくする */
    filter: brightness(1.1) contrast(0.95);
}

/* プレースホルダー (画像がない場合) */
.tamaki-placeholder {
    width: 100%;
    height: 100%;
    background: linear-gradient(135deg, #fffdf7 0%, #fff9e6 100%);
    border: 2px dashed #d6a300;
    border-radius: 10px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
}

.tamaki-placeholder-icon {
    font-size: 3em;
}

.tamaki-placeholder-text {
    font-size: 1.2em;
    font-weight: bold;
    color: #8b2222;
    margin-top: 5px;
}

/* セリフ吹き出し */
.tamaki-speech-bubble {
    flex: 1;
    min-width: 0;
    background: white;
    border: 2px solid #d6a300;
    border-radius: 15px;
    padding: 12px;  /* 15px → 12px に縮小 */
    position: relative;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    box-sizing: border-box;
    word-wrap: break-word;
}

/* 吹き出しの三角 */
.tamaki-speech-bubble::before {
    content: '';
    position: absolute;
    left: -10px;  /* -12px → -10px */
    top: 20px;
    width: 0;
    height: 0;
    border-style: solid;
    border-width: 8px 10px 8px 0;  /* 少し小さく */
    border-color: transparent #d6a300 transparent transparent;
}

.tamaki-speech-bubble::after {
    content: '';
    position: absolute;
    left: -6px;  /* -8px → -6px */
    top: 22px;
    width: 0;
    height: 0;
    border-style: solid;
    border-width: 6px 8px 6px 0;  /* 少し小さく */
    border-color: transparent white transparent transparent;
}

.tamaki-name {
    font-size: 0.85em;
    font-weight: bold;
    color: #8b2222;
    margin-bottom: 10px;
    display: flex;
    align-items: center;
    gap: 5px;
}

.tamaki-speech-text {
    line-height: 1.6;  /* 1.7 → 1.6 */
    color: #333;
    font-size: 0.9em;  /* 0.95em → 0.9em */
}

/* マークダウン風の強調 */
.tamaki-speech-text strong {
    color: #c07777;
    font-weight: bold;
}

/* モバイル対応 */
@media (max-width: 600px) {
    .tenun-index-container {
        margin: 20px 10px;
        padding: 15px;
    }
    
    .tamaki-display {
        flex-direction: row;  /* 横並びを維持 */
        gap: 10px;
    }
    
    .tamaki-character {
        width: 45px;   /* モバイルではさらに小さく */
        height: 45px;
    }
    
    .tamaki-speech-bubble {
        padding: 12px;
        font-size: 0.9em;
    }
    
    .tamaki-speech-bubble::before,
    .tamaki-speech-bubble::after {
        /* 三角を小さく */
        border-width: 8px 10px 8px 0;
    }
}
</style>
`;

// ========================================
// グローバル公開 (keirin_logic_v6.0.js から呼び出せるように)
// ========================================

window.generateTamakiTenunHTML = generateTamakiTenunHTML;
window.TAMAKI_CSS = TAMAKI_CSS;