// スプシ「係数サマリー」CSV → replay fixtures 形式への抽出
//
// 使い方:
//   node replay/extract_from_summary.mjs <summary.csv> <出力.json> [--from 2026-07-05] [--to 2026-07-14]
//
// 入力: スプシ係数サマリーの gviz CSV export（ヘッダー行なし想定。あれば自動スキップ）
// 列スキーマ（2026-07-14 解読、keirin_logic_kaizen_202607143.md 付録参照）:
//   1:log_id 2:ISOタイムスタンプ 3:app_id 4:race_info JSON 5:CalculationSnapshot JSON
//   6-7:sendLogペイロードJSON（7列目 prediction に買い目HTML） 8:実結果着順 9:決まり手
//   10:ステータス 11:的中フラグ 12-14:払戻（三連単/三連複/二車単）
// 除外: status≠ANALYZED・払戻欠損・選手7名未満
//
// 注意: fixtures.json（718R基準）は変更禁止。本スクリプトの出力は必ず別ファイルにする。
// 抽出後は必ず件数・的中数をスプシ集計と突合すること（分岐テスト Step 3）。

import fs from 'node:fs';

const args = process.argv.slice(2);
const [inPath, outPath] = args.filter(a => !a.startsWith('--'));
function argOf(name, dflt) {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1] : dflt;
}
const fromDate = argOf('--from', null);
const toDate = argOf('--to', null);

if (!inPath || !outPath) {
  console.error('usage: node replay/extract_from_summary.mjs <summary.csv> <出力.json> [--from YYYY-MM-DD] [--to YYYY-MM-DD]');
  process.exit(1);
}
if (/fixtures\.json$/.test(outPath)) {
  console.error('fixtures.json への出力は禁止（測定基準の保護）。別ファイル名を指定すること。');
  process.exit(1);
}

// RFC4180 準拠の素朴なCSVパーサ（セル内のJSONはダブルクォート囲み・""エスケープ想定）
function parseCSV(text) {
  const rows = [];
  let row = [], cell = '', inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"') {
        if (text[i + 1] === '"') { cell += '"'; i++; }
        else inQ = false;
      } else cell += c;
    } else if (c === '"') inQ = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(cell); cell = '';
      if (row.some(x => x !== '')) rows.push(row);
      row = [];
    } else cell += c;
  }
  if (cell !== '' || row.length) { row.push(cell); if (row.some(x => x !== '')) rows.push(row); }
  return rows;
}

function tryJSON(s) {
  if (!s) return null;
  try { return JSON.parse(s); } catch { return null; }
}
const num = (s) => {
  const n = Number(String(s ?? '').replace(/[¥,\s円]/g, ''));
  return Number.isFinite(n) ? n : null;
};

const rows = parseCSV(fs.readFileSync(inPath, 'utf8'));
const fixtures = [];
const skips = {};
const skip = (why) => { skips[why] = (skips[why] || 0) + 1; };

for (const r of rows) {
  const [logId, ts, appId, raceInfoRaw, snapshotRaw, , predictionRaw, result, kimarite, status, , paySanrentan, paySanrenpuku, payNisyatan] = r;

  if (!ts || !/^\d{4}-\d{2}-\d{2}T/.test(ts)) { skip('header-or-bad-ts'); continue; }
  const date = ts.slice(0, 10);
  if (fromDate && date < fromDate) { skip('before-from'); continue; }
  if (toDate && date > toDate) { skip('after-to'); continue; }
  if (String(status).trim() !== 'ANALYZED') { skip('status!=ANALYZED'); continue; }

  const raceInfo = tryJSON(raceInfoRaw);
  const snapshot = tryJSON(snapshotRaw);
  if (!raceInfo || !snapshot) { skip('json-parse-fail'); continue; }

  const payouts = {
    sanrentan: num(paySanrentan),
    sanrenpuku: num(paySanrenpuku),
    nisyatan: num(payNisyatan),
  };
  if (payouts.sanrentan === null || payouts.sanrenpuku === null || payouts.nisyatan === null) { skip('payout-missing'); continue; }
  if (!result || !/\d+-\d+-\d+/.test(result)) { skip('result-missing'); continue; }

  const base = snapshot.scores?.base || {};
  const ids = Object.keys(base).map(Number).sort((a, b) => a - b);
  if (ids.length < 7) { skip('players<7'); continue; }

  let s1Id = null, b1Id = null;
  const players = ids.map(id => {
    const b = base[id];
    if (b.is_s1) s1Id = id;
    if (b.is_b1) b1Id = id;
    return {
      id,
      score: b.score,
      style: b.style,
      wmark: b.wmark,
      recent: b.recent,
      isScratch: !!(b.is_scratch ?? b.isScratch),
      isGoldCap: false,
      isLocal: !!(b.is_local ?? b.isLocal),
    };
  });

  const lines = snapshot.lines || [];
  if (!lines.length) { skip('lines-missing'); continue; }

  const prediction = tryJSON(predictionRaw);
  const seiten = prediction?.prediction?.seiten ?? prediction?.seiten ?? null;
  const kouten = prediction?.prediction?.kouten ?? prediction?.kouten ?? null;

  fixtures.push({
    race_id: raceInfo.race_id ?? snapshot.race_id ?? '',
    log_id: logId,
    date,
    ts,
    bankName: raceInfo.bankName ?? raceInfo.bank ?? '',
    raceType: raceInfo.grade ?? raceInfo.raceType ?? '',
    tenun: raceInfo.tenun ?? null,
    wind: {
      speed: raceInfo.wind?.speed ?? 0,
      direction: raceInfo.wind?.direction ?? 'none',
    },
    lines,
    lineInput: lines.map(l => l.join('')).join(','),
    players,
    radio: { s1Id, b1Id },
    result: result.trim(),
    kimarite: (kimarite || '').trim(),
    payouts,
    logged_bets: seiten || kouten ? { seiten, kouten } : undefined,
  });
}

fixtures.sort((a, b) => a.ts.localeCompare(b.ts));
fs.writeFileSync(outPath, JSON.stringify(fixtures, null, 1));
console.log(`抽出: ${fixtures.length}R → ${outPath}`);
console.log('除外内訳:', skips);
if (fixtures.length) {
  console.log(`期間: ${fixtures[0].date} 〜 ${fixtures[fixtures.length - 1].date}`);
  const tenunN = fixtures.filter(f => f.tenun !== null && f.tenun !== undefined).length;
  console.log(`tenun あり: ${tenunN}/${fixtures.length}`);
}
console.log('次の手順（Step 3）: 件数・的中数をスプシ集計と突合してから run.mjs --fixtures で計測すること。');
