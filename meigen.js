/**
 * 華耀天輪 真・自在律 用：ランダム格言表示機能
 * ケンさん確定の格言リスト (29個) を使用。
 *
 * 【使用方法】
 * 1. HTMLの表示したい場所に <div id="maxim-display"></div> を追加。
 * 2. このJSコードをHTMLファイルまたは外部JSファイルに組み込む。
 * 3. ページが読み込まれると、ランダムな格言が自動で表示されます。
 */

function displayRandomMaxim() {
    // ケンさん確定の格言リスト (29個)
    const maxims = [
        { maxim: "成功率はなんてのは単なる目安だ、あとは勇気で補えばいい！！", speaker: "大河幸太郎" },
        { maxim: "LUCK(幸運を)&PLUCK(勇気をッ!)", speaker: "ブラフォード" },
        { maxim: "推す者は事実を見て、執着する者は願望を見ている", speaker: "Mushyn Reagan" },
        { maxim: "過去の熱狂に囚われた者は、未来を歪め、そして今を落とす", speaker: "Mushyn Reagan" },
        { maxim: "バンクには数万数億の選手達の判断が堆積している", speaker: "Mushyn Reagan" },
        { maxim: "\"絞る\"のが玄人、\"絞ら\"ないのが素人、\"絞れ\"ないのが俺", speaker: "Mushyn Reagan" },
        { maxim: "脳内ノイズがうるさいから、今日も予想する", speaker: "Mushyn Reagan" },
        { maxim: "絶対なんてあり得ないんだ、絶対に", speaker: "Mushyn Reagan" },
        { maxim: "奇跡なんて望むな！「勝つ」ってことは…そんな神頼みなんかじゃなく…具体的な勝算の彼方にある…現実だ…！勝つべくして勝つ…！", speaker: "伊藤開司" },
        { maxim: "カジノではどう勝つかよりどう負けるかのほうが大切", speaker: "森巣 博" },
        { maxim: "行き詰まると前方に道がないように思うのですが、逃げるのではなく、戻るという選択肢があることを忘れてはいけません", speaker: "桜井章一" },
        { maxim: "勝負に勝ちたければ、ギャンブルするな。つまり、プロギャンブラーはギャンブルしない", speaker: "のぶき" },
        { maxim: "十回勝負すると素人は六勝四敗を狙う。玄人は一勝九敗でも勝つように張る。", speaker: "色川武大" },
        { maxim: "賭博には、人生では決して味わえぬ敗北の味がある", speaker: "寺山修司" },
        { maxim: "成功は、99%の努力と1%のひらめき", speaker: "トーマス・エジソン" },
        { maxim: "私が恐れるのは、千の蹴りを知る者ではなく、一つの蹴りを千回練習した者だ", speaker: "ブルース・リー" },
        { maxim: "他人の意見を聞くことは重要だが、最終決定は自分で行うこと", speaker: "ウォーレン・バフェット" },
        { maxim: "偉大な成功の裏には、必ず偉大な敗北がある", speaker: "ジェームズ・キャメロン" },
        { maxim: "リスクを取るな。さもないと人生に勝てない", speaker: "テネシー・ウィリアムズ" },
        { maxim: "運命を変えるのは、運ではなく決断だ", speaker: "トニー・ロビンス" },
        { maxim: "知識への投資が、最高の利息を生む", speaker: "ベンジャミン・フランクリン" },
        { maxim: "ギャンブルは、人生の縮図である", speaker: "ドストエフスキー" },
        { maxim: "最も重要なのは、自分自身を理解することだ", speaker: "孫正義" },
        { maxim: "賢者は歴史から学ぶ", speaker: "オットー・フォン・ビスマルク" },
        { maxim: "真の勝者は、負けても立ち直れる者だ", speaker: "モハメド・アリ" },
        { maxim: "常に勝てる者はいない。常に勝っていると言う人がいたらそいつは嘘つきかポーカーをやっていないかだ", speaker: "アマリロ・スリム" },
        { maxim: "感情を入れれば必ず負ける", speaker: "升田幸三" },
        { maxim: "成功は、たまたまの幸運ではない。それは訓練と献身の結果である", speaker: "アリ・ファブリエル" },
        { maxim: "最も割安なのは、人々が恐れている株である", speaker: "ウォーレン・バフェット" }
    ];

    // リストからランダムに一つ選ぶ
    const randomIndex = Math.floor(Math.random() * maxims.length);
    const selectedMaxim = maxims[randomIndex];

    // HTMLに表示するための要素を取得
    const displayElement = document.getElementById('maxim-display');

    if (displayElement) {
        // 格言と発言者を整形してHTMLに挿入
        displayElement.innerHTML = `
            <p style="font-size: 1.1em; font-weight: bold; margin-bottom: 5px;">
                『${selectedMaxim.maxim}』
            </p>
            <p style="font-size: 0.9em; text-align: right; color: #666; margin-top: 0;">
                —— ${selectedMaxim.speaker}
            </p>
        `;
    } else {
        // デバッグ用: 要素が見つからない場合のコンソール表示
        console.error("Error: HTML element with id 'maxim-display' not found.");
    }
}

// ページ読み込み完了時に格言を表示する
document.addEventListener('DOMContentLoaded', displayRandomMaxim);
