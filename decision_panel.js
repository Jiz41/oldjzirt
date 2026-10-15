// decision_panel.js — 「買い/見」ティア・買い目8点・確率・配分電卓のUI描画。
// keirin_logic.js のスコア計算・買い目生成ロジックには触れない。読み取り専用（app.lastCalcResult / CalculationSnapshot / DOM入力値）。
// 依存: decision_core.js（先に読み込まれていること）
(function () {
  'use strict';

  var PANEL_ID = 'decision-panel';
  var BUDGET_INPUT_ID = 'decision-budget';
  var BASE_BUDGET_INPUT_ID = 'decision-base-budget';

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
    el.className = 'result-section';
    container.insertBefore(el, container.firstChild);
    return el;
  }

  var TIER_COLORS = {
    '買い（強）': '#f8b500',
    '買い': '#DAA520',
    '見寄り': '#8a8a60',
    '見': '#777777',
  };

  function renderHistoryTable(tierKey) {
    var hist = DecisionCore.TIER_HISTORY[tierKey];
    if (!hist) return '';
    var rows = hist.rows.map(function (r) {
      if (r.note) {
        return '<tr><td>' + escapeHtml(r.period) + '</td><td colspan="2">' + escapeHtml(r.note) + '</td></tr>';
      }
      return '<tr><td>' + escapeHtml(r.period) + '</td><td>n=' + r.n + '</td><td>回収率 ' + r.roi + '%</td></tr>';
    }).join('');
    return '<table style="width:100%; font-size:0.78em; color:#aaa; border-collapse:collapse; margin-top:6px;">' + rows + '</table>' +
      '<p style="font-size:0.72em; color:#777; margin:4px 0 0;">※過去データの目安（3期間の検証値）。将来の結果を保証するものではありません。</p>';
  }

  function renderTicketsTable(perTicket, amounts) {
    var rows = perTicket.map(function (t, idx) {
      var combo = t.cars.join('-');
      var probPct = (t.prob * 100).toFixed(2) + '%';
      var amount = amounts ? (amounts[idx] + '円') : '';
      return '<tr>' +
        '<td style="padding:4px 6px; font-weight:bold;">' + escapeHtml(combo) + '</td>' +
        '<td style="padding:4px 6px; color:#bba060;">' + probPct + '</td>' +
        (amounts ? '<td style="padding:4px 6px;">' + amount + '</td>' : '') +
        '</tr>';
    }).join('');
    var header = '<tr style="color:#888; font-size:0.78em;"><th style="text-align:left; padding:4px 6px;">買い目(三連単)</th><th style="text-align:left; padding:4px 6px;">的中確率</th>' +
      (amounts ? '<th style="text-align:left; padding:4px 6px;">配分</th>' : '') + '</tr>';
    return '<table style="width:100%; border-collapse:collapse; font-size:0.85em;">' + header + rows + '</table>';
  }

  function computeDecisionData() {
    if (typeof App === 'undefined' || !App.lastCalcResult || !App.lastCalcResult.relations) return null;
    if (typeof CalculationSnapshot === 'undefined') return null;

    var relations = App.lastCalcResult.relations;
    var base = (CalculationSnapshot.scores && CalculationSnapshot.scores.base) || [];
    var seitenScores = (CalculationSnapshot.scores && CalculationSnapshot.scores.final && CalculationSnapshot.scores.final.seiten) || {};
    var lines = CalculationSnapshot.lines || [];

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
      windSpeed: windSpeed,
    });

    var probResult = DecisionCore.computeProbabilities(seitenScores, grade, tickets);

    return {
      labelToCar: labelToCar,
      tickets: tickets,
      tierResult: tierResult,
      probResult: probResult,
      grade: grade,
      windSpeed: windSpeed,
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
    var color = TIER_COLORS[tier] || '#aaa';
    var isMiss = tier === '見';

    var headerHtml = '<h3 style="margin-bottom:4px;">🎯 買い/見 判定・配分電卓</h3>' +
      '<div style="display:flex; align-items:center; gap:10px; margin:8px 0;">' +
      '<span style="font-size:1.3em; font-weight:bold; color:' + color + ';">ティア：' + escapeHtml(tier) + '</span>' +
      (isMiss ? '<span style="background:#5a2a2a; color:#ffb3b3; padding:2px 8px; border-radius:4px; font-size:0.85em;">見送り推奨</span>' : '') +
      '</div>';

    if (!data.tierResult.conditionC) {
      headerHtml += '<p style="font-size:0.78em; color:#999;">理由: ' + data.tierResult.reasons.map(escapeHtml).join(' / ') + '</p>';
    }

    headerHtml += renderHistoryTable(tier);

    var perTicket = data.probResult.perTicket;
    var totalProb = data.probResult.totalProb;

    var budgetInput = '<div style="margin-top:14px;">' +
      '<label style="font-size:0.85em; color:#ccc;">このレースの予算（円）</label>' +
      '<input type="number" inputmode="numeric" min="0" step="100" id="' + BUDGET_INPUT_ID + '" placeholder="800" style="width:100%; padding:6px; box-sizing:border-box; margin-top:4px; background:#1a1a1a; color:#e8e8e8; border:1px solid #444;">' +
      '</div>';

    var baseBudgetInput = '<div style="margin-top:10px; font-size:0.8em; color:#999;">' +
      '<label>基準額（任意・倍率の目安計算用）</label>' +
      '<div style="display:flex; gap:6px; margin-top:4px;">' +
      '<input type="number" inputmode="numeric" min="0" step="100" id="' + BASE_BUDGET_INPUT_ID + '" placeholder="例: 1000" style="flex:1; padding:6px; box-sizing:border-box; background:#1a1a1a; color:#e8e8e8; border:1px solid #444;">' +
      '<button type="button" id="decision-apply-base" style="padding:6px 10px; background:#333; color:#DAA520; border:1px solid #555; border-radius:4px;">目安を予算に反映</button>' +
      '</div>' +
      '<p id="decision-base-hint" style="margin:4px 0 0;"></p>' +
      '</div>';

    var multiplierNote = '<p style="font-size:0.72em; color:#777; margin-top:6px;">' +
      'レース間の目安倍率: 買い（強）=1.5倍 / 買い=1.0倍 / 見寄り=0.5倍 / 見=買わない目安。' +
      '8点は確率に関わらず均等配分（確率比例は過去の検証で成績が悪かったため不採用）。' +
      '</p>';

    var ticketsHeader = '<h4 style="margin-top:16px;">買い目8点・的中確率（合計 ' + (totalProb * 100).toFixed(2) + '%）</h4>';
    if (perTicket.length < 8) {
      ticketsHeader += '<p style="font-size:0.75em; color:#c99;">成立: ' + perTicket.length + '/8点（ラベル未解決または車番重複により一部除外）</p>';
    }

    var ticketsTableContainer = '<div id="decision-tickets-table">' + renderTicketsTable(perTicket, null) + '</div>';
    var summaryEl = '<div id="decision-summary" style="margin-top:8px; font-size:0.85em; color:#bba060;"></div>';

    panel.innerHTML = headerHtml + budgetInput + baseBudgetInput + multiplierNote + ticketsHeader + ticketsTableContainer + summaryEl;

    bindCalcHandlers(data);
  }

  function bindCalcHandlers(data) {
    var budgetEl = document.getElementById(BUDGET_INPUT_ID);
    var baseBudgetEl = document.getElementById(BASE_BUDGET_INPUT_ID);
    var applyBtn = document.getElementById('decision-apply-base');
    var hintEl = document.getElementById('decision-base-hint');
    var tablesContainer = document.getElementById('decision-tickets-table');
    var summaryEl = document.getElementById('decision-summary');

    var perTicket = data.probResult.perTicket;
    var tier = data.tierResult.tier;
    var multiplier = DecisionCore.TIER_MULTIPLIER[tier];

    function renderAllocation() {
      var budget = budgetEl ? parseFloat(budgetEl.value) : NaN;
      if (!(budget > 0)) {
        tablesContainer.innerHTML = renderTicketsTable(perTicket, null);
        if (summaryEl) summaryEl.textContent = '';
        return;
      }
      var alloc = DecisionCore.allocateBudget(budget, perTicket);
      tablesContainer.innerHTML = renderTicketsTable(perTicket, alloc.amounts);
      if (summaryEl) {
        var diffText = (alloc.diff >= 0 ? '+' : '') + alloc.diff;
        summaryEl.textContent = '合計: ' + alloc.total + '円（入力値との差: ' + diffText + '円）';
      }
    }

    function renderBaseHint() {
      if (!hintEl) return;
      var baseBudget = baseBudgetEl ? parseFloat(baseBudgetEl.value) : NaN;
      if (!(baseBudget > 0)) { hintEl.textContent = ''; return; }
      if (multiplier === 0) {
        hintEl.textContent = 'ティアが「見」のため目安予算の提示はありません。';
        return;
      }
      var suggested = Math.round((baseBudget * multiplier) / 100) * 100;
      hintEl.textContent = 'このレースの目安予算 ＝ 基準額×' + multiplier + ' ＝ ' + suggested + '円';
    }

    if (budgetEl) budgetEl.addEventListener('input', renderAllocation);
    if (baseBudgetEl) baseBudgetEl.addEventListener('input', renderBaseHint);
    if (applyBtn) {
      applyBtn.addEventListener('click', function () {
        var baseBudget = baseBudgetEl ? parseFloat(baseBudgetEl.value) : NaN;
        if (!(baseBudget > 0) || multiplier === 0) return;
        var suggested = Math.round((baseBudget * multiplier) / 100) * 100;
        if (budgetEl) {
          budgetEl.value = suggested;
          renderAllocation();
        }
      });
    }

    renderAllocation();
    renderBaseHint();
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
