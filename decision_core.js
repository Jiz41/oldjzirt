// decision_core.js — 「買い/見」ティア・買い目8点（三連単6点＋二車単2点）・的中確率・配分計算の純粋ロジック。
// keirin_logic.js のスコア計算・買い目生成ロジックは一切呼び出さない／変更しない。
// ブラウザ（グローバル DecisionCore）・Node（CommonJS/ESM の require/import）の両方で使えるようにする。
//
// 出典:
// - ラベル定義(s1,s2,s3,L,o1)・買い目8点（三連単6点＋二車単2点）・ティア条件・確率モデル・配分方針は
//   /root/oldjzirt/replay/explore/common.mjs, replay/prob_calibration.mjs,
//   replay/result_prob_calibration.json（T値）を根拠に実装。
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.DecisionCore = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // --- 的中確率モデルの温度T（replay/result_prob_calibration.json の gradeT / overallT と同値） ---
  var GRADE_T = {
    's-kyu': 2.21,
    'a-kyu': 1.56,
    'a-chal': 1.68,
    'girls': 1.055,
  };
  var OVERALL_T = 1.585;

  // --- チケット定義（三連単6点、ラベル順=着順） ---
  var TICKETS = [
    ['o1', 's2', 'L'],
    ['s2', 's3', 's1'],
    ['o1', 's3', 'L'],
    ['s2', 's1', 'L'],
    ['o1', 's2', 's1'],
    ['L', 'o1', 's2'],
  ];

  // --- チケット定義（二車単2点、ラベル順=1着,2着） ---
  var NITAN_TICKETS = [
    ['s1', 'L'],
    ['L', 's1'],
  ];

  // --- ティア別の過去回収率・件数（出典表示用。将来を保証しない） ---
  // A/B/C表示への移行（2026-10-16）。C は旧「見寄り」と「見」を合算した数値。
  // 2026-10-16 実効風速(×beta)基準で再計算。重複race_idはkeep-last除去
  var TIER_HISTORY = {
    'A': {
      label: 'A',
      rows: [
        { period: 'K2後学習', n: 224, roi: 283 },
        { period: 'K2前', n: 201, roi: 180 },
        { period: '封印検証', n: 26, roi: 229 },
      ],
    },
    'B': {
      label: 'B',
      rows: [
        { period: 'K2後学習', n: 56, roi: 160 },
        { period: 'K2前', n: 98, roi: 112 },
        { period: '封印検証', n: 9, roi: 43 },
      ],
    },
    'C': {
      label: 'C',
      rows: [
        { period: 'K2後学習', n: 306, roi: 55 },
        { period: 'K2前', n: 497, roi: 46 },
        { period: '封印検証', n: 47, roi: 71 },
      ],
    },
  };

  // --- レース間の目安倍率（現在UI未使用。将来の目安計算用に定数のみ保持） ---
  var TIER_MULTIPLIER = {
    '買い（強）': 1.5,
    '買い': 1.0,
    '見寄り': 0.5,
    '見': 0,
  };

  /**
   * ラベル割り当て（s1,s2,s3,L,o1 -> 車番）。
   * @param {Object} opts
   * @param {number[]} opts.activePlayerIds 出走（欠場除く）選手の車番一覧
   * @param {Object<string,number>} opts.seitenScores 車番(文字列可)->晴天令スコア（engine_final.seiten 相当、無補正）
   * @param {number[]} opts.top3CarIds 晴天令三連複の対象3車番（順不同）
   * @param {number|null} opts.lCarId 荒天令・特異点の車番（存在しなければ null）
   * @returns {{s1:?number,s2:?number,s3:?number,L:?number,o1:?number}}
   */
  function deriveLabels(opts) {
    var activePlayerIds = opts.activePlayerIds || [];
    var seitenScores = opts.seitenScores || {};
    var top3CarIds = (opts.top3CarIds || []).filter(function (v) { return v !== null && v !== undefined; });
    var lCarId = (opts.lCarId === undefined) ? null : opts.lCarId;

    function scoreOf(carId) {
      var v = seitenScores[String(carId)];
      return (typeof v === 'number') ? v : -Infinity;
    }

    var sortedTop3 = top3CarIds.slice().sort(function (a, b) { return scoreOf(b) - scoreOf(a); });
    var s1 = sortedTop3[0] !== undefined ? sortedTop3[0] : null;
    var s2 = sortedTop3[1] !== undefined ? sortedTop3[1] : null;
    var s3 = sortedTop3[2] !== undefined ? sortedTop3[2] : null;
    var L = lCarId;

    var specialSet = {};
    [s1, s2, s3, L].forEach(function (id) { if (id !== null && id !== undefined) specialSet[id] = true; });

    var remaining = activePlayerIds
      .filter(function (id) { return !specialSet[id]; })
      .sort(function (a, b) { return scoreOf(b) - scoreOf(a); });

    var o1 = remaining.length > 0 ? remaining[0] : null;

    return { s1: s1, s2: s2, s3: s3, L: L, o1: o1 };
  }

  /**
   * 8点チケット（三連単6点＋二車単2点）をラベル->車番で展開する。
   * 成立しないチケット（ラベル未解決／車番重複）は除外。
   * @param {{s1:?number,s2:?number,s3:?number,L:?number,o1:?number}} labelToCar
   * @returns {Array<{labels:string[], cars:number[], type:string}>} 成立したチケットのみ
   */
  function buildTickets(labelToCar) {
    function expand(ticketLabelsList, type) {
      var out = [];
      ticketLabelsList.forEach(function (labels) {
        var cars = labels.map(function (l) { return labelToCar[l]; });
        var resolved = cars.every(function (c) { return c !== null && c !== undefined; });
        if (!resolved) return;
        var uniq = {};
        var dup = false;
        cars.forEach(function (c) { if (uniq[c]) dup = true; uniq[c] = true; });
        if (dup) return;
        out.push({ labels: labels, cars: cars, type: type });
      });
      return out;
    }
    return expand(TICKETS, 'sanrentan').concat(expand(NITAN_TICKETS, 'nisyatan'));
  }

  /**
   * ティア判定。
   * @param {Object} opts
   * @param {string} opts.s1Style s1選手の脚質（'追'/'自'/'逃'）
   * @param {boolean} opts.lIsSingle Lが単騎（Lのラインの人数が1）か
   * @param {string} opts.grade 's-kyu'|'a-kyu'|'a-chal'|'girls'
   * @param {number} opts.numLines ライン数
   * @param {number} opts.windSpeed 実効風速(風速欄の値×場のbeta)(m/s)
   * @returns {{tier:string, conditionC:boolean, reasons:string[]}}
   */
  function judgeTier(opts) {
    var s1Style = opts.s1Style;
    var lIsSingle = !!opts.lIsSingle;
    var grade = opts.grade;
    var numLines = opts.numLines;
    var windSpeed = opts.windSpeed;

    var reasons = [];
    var conditionC = true;

    if (s1Style !== '追') { conditionC = false; reasons.push('s1の脚質が追ではない(' + s1Style + ')'); }
    if (lIsSingle) { conditionC = false; reasons.push('Lが単騎'); }
    if (grade === 'girls') { conditionC = false; reasons.push('ガールズ'); }
    if (!(numLines <= 4)) { conditionC = false; reasons.push('ライン数が5以上(' + numLines + ')'); }

    var tier;
    if (!conditionC) {
      tier = '見';
    } else if (windSpeed < 1.5) {
      tier = '買い（強）';
    } else if (windSpeed < 3) {
      tier = '買い';
    } else {
      tier = '見寄り';
      reasons.push('実効風速が強め（3m/s以上）');
    }

    var letter;
    var subLabel;
    if (tier === '買い（強）') {
      letter = 'A';
      subLabel = '買い（強）';
    } else if (tier === '買い') {
      letter = 'B';
      subLabel = '買い';
    } else if (tier === '見寄り') {
      letter = 'C';
      subLabel = '見送り推奨（風が強め・境界）';
    } else {
      letter = 'C';
      subLabel = '見送り推奨';
    }

    var cautions = [];

    return { tier: tier, conditionC: conditionC, reasons: reasons, letter: letter, subLabel: subLabel, cautions: cautions };
  }

  /**
   * Plackett-Luce 的中確率（三連単・二車単）。晴天令スコアのみ使用。
   * @param {Object<string,number>} seitenScores 出走全員の車番(文字列)->晴天令スコア
   * @param {string} grade 級班キー
   * @param {Array<{labels:string[], cars:number[], type:string}>} tickets buildTickets() の結果
   * @returns {{perTicket:Array<{labels:string[],cars:number[],type:string,prob:number}>, totalProb:number, T:number}}
   */
  function computeProbabilities(seitenScores, grade, tickets) {
    var ids = Object.keys(seitenScores).map(Number);
    var n = ids.length;
    var mean = 0, i;
    for (i = 0; i < n; i++) mean += seitenScores[String(ids[i])];
    mean = n > 0 ? mean / n : 0;
    var variance = 0;
    for (i = 0; i < n; i++) variance += Math.pow(seitenScores[String(ids[i])] - mean, 2);
    variance = n > 0 ? variance / n : 0;
    var sd = Math.sqrt(variance);

    var z = {};
    ids.forEach(function (id) {
      z[id] = sd > 0 ? (seitenScores[String(id)] - mean) / sd : 0;
    });

    var T = GRADE_T[grade] !== undefined ? GRADE_T[grade] : OVERALL_T;

    var w = {};
    ids.forEach(function (id) { w[id] = Math.exp(z[id] / T); });

    function orderProb(order) {
      var remaining = ids.slice();
      var prob = 1;
      order.forEach(function (pick) {
        var sumW = 0;
        remaining.forEach(function (id) { sumW += w[id]; });
        prob *= w[pick] / sumW;
        remaining = remaining.filter(function (id) { return id !== pick; });
      });
      return prob;
    }

    // 6点の三連単と2点の二車単は同時に起きない（三連単6点の先頭2着の組に s1-L / L-s1 は
    // 含まれない）ので、合計は的中確率そのものになる。
    var perTicket = tickets.map(function (t) {
      return { labels: t.labels, cars: t.cars, type: t.type, prob: orderProb(t.cars) };
    });
    var totalProb = perTicket.reduce(function (s, t) { return s + t.prob; }, 0);

    return { perTicket: perTicket, totalProb: totalProb, T: T };
  }

  /**
   * 予算配分。mode='even'（既定）は均等（100円単位、端数は確率の高いチケットから100円ずつ加算）。
   * mode='sqrt' は確率の平方根に応じた傾斜配分（最大剰余法、100円単位）。
   * @param {number} budgetYen 予算（円）
   * @param {Array<{prob:number}>} perTicket computeProbabilities().perTicket
   * @param {string} [mode] 'even'|'sqrt'（省略時 'even'）
   * @returns {{amounts:number[], total:number, diff:number}} amounts は perTicket と同順
   */
  function allocateBudget(budgetYen, perTicket, mode) {
    var m = perTicket.length;
    if (!(budgetYen > 0) || m === 0) {
      return { amounts: perTicket.map(function () { return 0; }), total: 0, diff: -(budgetYen || 0) };
    }
    var unit = 100;

    if (mode === 'sqrt') {
      var N = Math.floor(budgetYen / unit);
      if (N <= 0) {
        var zeroAmounts = perTicket.map(function () { return 0; });
        return { amounts: zeroAmounts, total: 0, diff: 0 - budgetYen };
      }
      var weights = perTicket.map(function (t) { return Math.sqrt(Math.max(t.prob, 0)); });
      var weightSum = weights.reduce(function (s, w) { return s + w; }, 0);
      var rawUnits, baseUnitsArr, fracArr;
      if (weightSum > 0) {
        rawUnits = weights.map(function (w) { return (N * w) / weightSum; });
      } else {
        rawUnits = perTicket.map(function () { return N / m; });
      }
      baseUnitsArr = rawUnits.map(function (v) { return Math.floor(v); });
      fracArr = rawUnits.map(function (v, idx) { return v - baseUnitsArr[idx]; });
      var allocatedUnits = baseUnitsArr.reduce(function (s, u) { return s + u; }, 0);
      var remainingUnits = N - allocatedUnits;

      var fracOrder = fracArr
        .map(function (f, idx) { return { idx: idx, frac: f }; })
        .sort(function (a, b) { return b.frac - a.frac; });

      for (var j = 0; j < remainingUnits && j < fracOrder.length; j++) {
        baseUnitsArr[fracOrder[j].idx] += 1;
      }

      var sqrtAmounts = baseUnitsArr.map(function (u) { return u * unit; });
      var sqrtTotal = sqrtAmounts.reduce(function (s, a) { return s + a; }, 0);
      var sqrtDiff = sqrtTotal - budgetYen;
      return { amounts: sqrtAmounts, total: sqrtTotal, diff: sqrtDiff };
    }

    var rawShare = budgetYen / m;
    var baseUnits = Math.floor(rawShare / unit);
    var amounts = perTicket.map(function () { return baseUnits * unit; });
    var allocated = baseUnits * unit * m;
    var remainder = Math.round(budgetYen - allocated);
    var remainderUnits = Math.floor(remainder / unit);

    var order = perTicket
      .map(function (t, idx) { return { idx: idx, prob: t.prob }; })
      .sort(function (a, b) { return b.prob - a.prob; });

    for (var k = 0; k < remainderUnits && k < order.length; k++) {
      amounts[order[k].idx] += unit;
    }

    var total = amounts.reduce(function (s, a) { return s + a; }, 0);
    var diff = total - budgetYen;
    return { amounts: amounts, total: total, diff: diff };
  }

  return {
    GRADE_T: GRADE_T,
    OVERALL_T: OVERALL_T,
    TICKETS: TICKETS,
    NITAN_TICKETS: NITAN_TICKETS,
    TIER_HISTORY: TIER_HISTORY,
    TIER_MULTIPLIER: TIER_MULTIPLIER,
    deriveLabels: deriveLabels,
    buildTickets: buildTickets,
    judgeTier: judgeTier,
    computeProbabilities: computeProbabilities,
    allocateBudget: allocateBudget,
  };
});
