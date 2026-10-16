// decision_panel.js — 「買い/見」ティア・買い目8点・確率・配分電卓のUI描画。
// keirin_logic.js のスコア計算・買い目生成ロジックには触れない。読み取り専用（app.lastCalcResult / CalculationSnapshot / DOM入力値）。
// 依存: decision_core.js（先に読み込まれていること）
(function () {
  'use strict';

  var PANEL_ID = 'decision-panel';
  var BUDGET_INPUT_ID = 'decision-budget';
  var ALLOC_MODE_NAME = 'decision-alloc-mode';

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function ensurePanelContainer() {
    var existing = document.getElementById(PANEL_ID);
    if (existing) return existing;
    var container = document.getElementById('results-container');
    if (!container) return null;
    var el = document.createElement('div');
    el.id = PANEL_ID;
    // 「予想結果・推奨買い目」の結果欄（.result-section）の先頭に入れ込む。見つからなければ従来どおりコンテナ先頭。
    var section = container.querySelector('.result-section');
    if (section) {
      section.insertBefore(el, section.firstChild);
    } else {
      el.className = 'result-section';
      container.insertBefore(el, container.firstChild);
    }
    return el;
  }

  var TIER_COLORS = {
    'A': 'var(--gold, #ffb62e)',
    'B': 'var(--neon-a, #39ffb0)',
    'C': 'var(--muted, #979aa6)',
  };

  function renderHistoryTable(letter) {
    var hist = DecisionCore.TIER_HISTORY[letter];
    if (!hist) return '';
    var rows = hist.rows.map(function (r) {
      if (r.note) {
        return '<tr><td>' + escapeHtml(r.period) + '</td><td colspan="2">' + escapeHtml(r.note) + '</td></tr>';
      }
      return '<tr><td>' + escapeHtml(r.period) + '</td><td>n=' + r.n + '</td><td>回収率 ' + r.roi + '%</td></tr>';
    }).join('');
    return '<h4 style="margin-top:12px; font-size:0.85em; color:#ccc;">過去実績（' + escapeHtml(letter) + '）</h4>' +
      '<table style="width:100%; font-size:0.78em; color:#aaa; border-collapse:collapse; margin-top:6px;">' + rows + '</table>' +
      '<p style="font-size:0.72em; color:#777; margin:4px 0 0;">※過去データの目安（3期間の検証値。この8点構成を100円ずつ買った場合の回収率）。将来の結果を保証するものではありません。</p>';
  }

  function renderTicketsTable(perTicket, amounts) {
    var rows = perTicket.map(function (t, idx) {
      var kind = t.type === 'nisyatan' ? '二車単' : '三連単';
      var combo = t.cars.join('-');
      var probPct = (t.prob * 100).toFixed(2) + '%';
      var amount = amounts ? (amounts[idx] > 0 ? (amounts[idx] + '円') : '0円（配分なし）') : '';
      return '<tr>' +
        '<td style="padding:4px 6px;">' + escapeHtml(kind) + '</td>' +
        '<td style="padding:4px 6px; font-weight:bold;">' + escapeHtml(combo) + '</td>' +
        '<td style="padding:4px 6px; color:#bba060;">' + probPct + '</td>' +
        (amounts ? '<td style="padding:4px 6px;">' + amount + '</td>' : '') +
        '</tr>';
    }).join('');
    var header = '<tr style="color:#888; font-size:0.78em;"><th style="text-align:left; padding:4px 6px;">券種</th><th style="text-align:left; padding:4px 6px;">買い目</th><th style="text-align:left; padding:4px 6px;">的中確率</th>' +
      (amounts ? '<th style="text-align:left; padding:4px 6px;">配分</th>' : '') + '</tr>';
    return '<table style="width:100%; border-collapse:collapse; font-size:0.85em;">' + header + rows + '</table>';
  }

  function computeDecisionData() {
    if (typeof App === 'undefined' || !App.lastCalcResult || !App.lastCalcResult.relations) return null;
    // CalculationSnapshot は keirin_logic.js の即時実行関数内の変数で外から見えない。公開APIの写しを使う。
    if (typeof App.getCurrentCoefficients !== 'function') return null;
    var snap = App.getCurrentCoefficients() || {};

    var relations = App.lastCalcResult.relations;
    var base = (snap.scores && snap.scores.base) || [];
    var seitenScores = (snap.scores && snap.scores.final && snap.scores.final.seiten) || {};
    var lines = snap.lines || [];

    if (base.length === 0 || Object.keys(seitenScores).length === 0) return null;

    var activePlayerIds = base.map(function (p) { return p.id; });

    var seitenR = relations.seiten || {};
    var top3CarIds = [seitenR.r0, seitenR.r1, seitenR.r2]
      .filter(Boolean)
      .map(function (p) { return p.id; });
    var lObj = relations.kouten ? relations.kouten.L : null;
    var lCarId = lObj ? lObj.id : null;

    var labelToCar = DecisionCore.deriveLabels({
      activePlayerIds: activePlayerIds,
      seitenScores: seitenScores,
      top3CarIds: top3CarIds,
      lCarId: lCarId,
    });

    var tickets = DecisionCore.buildTickets(labelToCar);

    var raceTypeEl = document.getElementById('race-type');
    var windSpeedEl = document.getElementById('wind-speed');
    var grade = raceTypeEl ? raceTypeEl.value : 'a-kyu';
    var windSpeed = windSpeedEl ? (parseFloat(windSpeedEl.value) || 0) : 0;
    var beta = (snap && snap.bank && snap.bank.beta) ? snap.bank.beta : 1.0;
    var effWindSpeed = windSpeed * beta;

    var s1Player = base.find(function (p) { return p.id === labelToCar.s1; });
    var s1Style = s1Player ? s1Player.style : null;

    var lLine = lines.find(function (line) { return line.indexOf(labelToCar.L) !== -1; });
    var lIsSingle = labelToCar.L === null ? true : (lLine ? lLine.length === 1 : true);

    var numLines = lines.filter(function (line) { return line.length > 0; }).length;

    var tierResult = DecisionCore.judgeTier({
      s1Style: s1Style,
      lIsSingle: lIsSingle,
      grade: grade,
      numLines: numLines,
      windSpeed: effWindSpeed,
    });

    var probResult = DecisionCore.computeProbabilities(seitenScores, grade, tickets);

    return {
      labelToCar: labelToCar,
      tickets: tickets,
      tierResult: tierResult,
      probResult: probResult,
      grade: grade,
      windSpeed: windSpeed,
      effWindSpeed: effWindSpeed,
      numLines: numLines,
    };
  }

  function render() {
    var panel = ensurePanelContainer();
    if (!panel) return;
    var data = computeDecisionData();
    if (!data) {
      panel.innerHTML = '<h3>🎯 買い/見 判定・配分電卓</h3><p style="color:#999; font-size:0.85em;">計算結果がまだありません。「予想を計算」を実行してください。</p>';
      return;
    }

    var tier = data.tierResult.tier;
    var letter = data.tierResult.letter;
    var subLabel = data.tierResult.subLabel;
    var cautions = data.tierResult.cautions || [];
    var color = TIER_COLORS[letter] || '#aaa';

    var headerHtml = '<h3 style="margin-bottom:4px;">🎯 買い/見 判定・配分電卓</h3>' +
      '<div style="display:flex; align-items:center; gap:10px; margin:8px 0;">' +
      '<span style="font-size:3.6em; font-weight:800; line-height:1; color:' + color + '; font-family:monospace;">' + escapeHtml(letter) + '</span>' +
      '<div><span style="font-size:1em; color:' + color + ';">' + escapeHtml(subLabel) + '</span></div>' +
      '</div>';

    cautions.forEach(function (c) {
      headerHtml += '<p style="font-size:0.78em; color:var(--gold, #ffb62e);">⚠ ' + escapeHtml(c) + '</p>';
    });

    if (letter === 'C') {
      headerHtml += '<p style="font-size:0.78em; color:#999;">理由: ' + data.tierResult.reasons.map(escapeHtml).join(' / ') + '</p>';
    }

    headerHtml += renderHistoryTable(letter);

    var perTicket = data.probResult.perTicket;
    var totalProb = data.probResult.totalProb;

    var budgetInput = '<div style="margin-top:14px;">' +
      '<label style="font-size:0.85em; color:#ccc;">このレースの予算（円）</label>' +
      '<input type="number" inputmode="numeric" min="0" step="100" id="' + BUDGET_INPUT_ID + '" placeholder="例: 3000" style="width:100%; padding:6px; box-sizing:border-box; margin-top:4px; background:var(--panel-2, #1d2029); color:var(--text, #eceae2); border:1px solid var(--border, #2e3140);">' +
      '</div>';

    var allocModeInput = '<div style="margin-top:10px; font-size:0.8em; color:#ccc;">' +
      '<label style="display:block; margin-bottom:4px;"><input type="radio" name="' + ALLOC_MODE_NAME + '" value="even" checked> 均等（既定）</label>' +
      '<label style="display:block;"><input type="radio" name="' + ALLOC_MODE_NAME + '" value="sqrt"> 確率に応じて傾斜（弱め）</label>' +
      '<p style="font-size:0.72em; color:#777; margin:4px 0 0;">均等が既定。傾斜は目安（この8点構成では傾斜の効果は未検証）。</p>' +
      '</div>';

    var ticketsHeader = '<h4 style="margin-top:16px;">買い目8点（三連単6点＋二車単2点）・的中確率（合計 ' + (totalProb * 100).toFixed(2) + '%）</h4>';
    if (perTicket.length < 8) {
      ticketsHeader += '<p style="font-size:0.75em; color:#c99;">成立: ' + perTicket.length + '/8点（ラベル未解決または車番重複により一部除外）</p>';
    }

    var ticketsTableContainer = '<div id="decision-tickets-table">' + renderTicketsTable(perTicket, null) + '</div>';
    var probCaveat = '<p style="font-size:0.72em; color:#777;">的中確率は晴天令スコアからの推定です。過去実績は表示より高めに出る傾向があります（全体: 表示15%に対し実績18%、条件C: 表示14%に対し実績19%）。</p>';
    var summaryEl = '<div id="decision-summary" style="margin-top:8px; font-size:0.85em; color:#bba060;"></div>';

    panel.innerHTML = headerHtml + budgetInput + allocModeInput + ticketsHeader + ticketsTableContainer + probCaveat + summaryEl;

    var tierText = letter + '（' + subLabel + '）';
    window.DecisionPanelState = {
      tier: tier,
      letter: letter,
      tierText: tierText,
      tickets: perTicket.map(function (t) {
        var kind = t.type === 'nisyatan' ? '二車単' : '三連単';
        return kind + ' ' + t.cars.join('-');
      })
    };

    bindCalcHandlers(data);
  }

  function bindCalcHandlers(data) {
    var budgetEl = document.getElementById(BUDGET_INPUT_ID);
    var modeEls = document.getElementsByName(ALLOC_MODE_NAME);
    var tablesContainer = document.getElementById('decision-tickets-table');
    var summaryEl = document.getElementById('decision-summary');

    var perTicket = data.probResult.perTicket;

    function getSelectedMode() {
      for (var i = 0; i < modeEls.length; i++) {
        if (modeEls[i].checked) return modeEls[i].value;
      }
      return 'even';
    }

    function renderAllocation() {
      var budget = budgetEl ? parseFloat(budgetEl.value) : NaN;
      if (!(budget > 0)) {
        tablesContainer.innerHTML = renderTicketsTable(perTicket, null);
        if (summaryEl) summaryEl.textContent = '';
        return;
      }
      var mode = getSelectedMode();
      var alloc = DecisionCore.allocateBudget(budget, perTicket, mode);
      tablesContainer.innerHTML = renderTicketsTable(perTicket, alloc.amounts);
      if (summaryEl) {
        var diffText = (alloc.diff >= 0 ? '+' : '') + alloc.diff;
        summaryEl.textContent = '合計: ' + alloc.total + '円（入力値との差: ' + diffText + '円）';
      }
    }

    if (budgetEl) budgetEl.addEventListener('input', renderAllocation);
    for (var i = 0; i < modeEls.length; i++) {
      modeEls[i].addEventListener('change', renderAllocation);
    }

    renderAllocation();
  }

  function wrapCalculatePrediction() {
    if (typeof window.calculatePrediction !== 'function') {
      setTimeout(wrapCalculatePrediction, 50);
      return;
    }
    if (window.calculatePrediction.__decisionPanelWrapped) return;
    var _original = window.calculatePrediction;
    var wrapped = function () {
      var result = _original.apply(this, arguments);
      if (result && typeof result.then === 'function') {
        result.then(function () { render(); });
      } else {
        render();
      }
      return result;
    };
    wrapped.__decisionPanelWrapped = true;
    window.calculatePrediction = wrapped;
  }

  wrapCalculatePrediction();
})();
