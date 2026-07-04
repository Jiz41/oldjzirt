// リプレイ台: エンジンローダ＋1レース実行器
// node:vm 上で keirin_logic.js を実行し、fixtures の入力で calculatePrediction を回す。

import vm from 'node:vm';
import fs from 'node:fs';
import path from 'node:path';
import { createDom } from './dom_stub.mjs';

// 再現性確保用の乱数（race_id をシードに）
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function hashStr(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

/**
 * エンジン1個ぶんの実行環境を構築する。
 * @param {string} enginePath keirin_logic.js のパス
 * @param {string} bankdataPath bankdata.json のパス
 */
export function createEngine(enginePath, bankdataPath) {
  const engineSource = fs.readFileSync(enginePath, 'utf8');
  const bankdataRaw = fs.readFileSync(bankdataPath, 'utf8');

  async function runRace(fixture) {
    const dom = createDom();
    const captured = { sendLog: null, fetchPosts: [] };
    const logs = [];

    const rand = mulberry32(hashStr(fixture.race_id || fixture.log_id || 'x'));

    const App = {
      logMessage(msg) { logs.push(String(msg)); },
      sendLog(raceInfo, prediction) { captured.sendLog = { raceInfo, prediction }; },
      // shakkou/表示系はリプレイでは不要（no-op）
      startShakkouCalculation() {},
      completeShakkouCalculation() {},
      invokeShakkouDonperi() {},
      displayShinganHakke() {},
      generateTamakiTenunHTML() { return ''; },
    };

    const context = {
      console: { log() {}, warn() {}, error() {}, info() {} },
      document: dom.document,
      window: undefined, // 後で自己参照を設定
      App,
      app: App,
      alert() {},
      navigator: { userAgent: 'replay-harness' },
      localStorage: (() => {
        const m = new Map();
        return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k), clear: () => m.clear() };
      })(),
      setTimeout(fn) { fn(); return 0; },
      clearTimeout() {},
      setInterval() { return 0; },
      clearInterval() {},
      fetch: async (url, opts) => {
        const u = String(url);
        if (u.includes('bankdata.json')) {
          return { ok: true, status: 200, json: async () => JSON.parse(bankdataRaw), text: async () => bankdataRaw };
        }
        if (opts && opts.method === 'POST') captured.fetchPosts.push({ url: u, body: opts.body });
        return { ok: true, status: 200, json: async () => ({}), text: async () => '' };
      },
      Math: Object.create(Math, { random: { value: rand } }),
      JSON, Object, Array, Number, String, Boolean, RegExp, Date, Promise, Set, Map,
      parseFloat, parseInt, isNaN, isFinite, encodeURIComponent, decodeURIComponent,
      Error, TypeError, RangeError, Infinity, NaN, undefined: undefined,
      structuredClone: (globalThis.structuredClone || (o => JSON.parse(JSON.stringify(o)))),
    };
    context.window = context;
    context.globalThis = context;
    vm.createContext(context);

    // 入力注入（エンジンのDOM直読みに対応）
    dom.setInputs({
      'bank-name': fixture.bankName,
      'race-type': fixture.raceType,
      'wind-speed': fixture.wind?.speed ?? 0,
      'wind-direction': fixture.wind?.direction ?? '無風',
      'line-input': fixture.lineInput || '',
      'mode-selector': 'seitenrei',
    });

    // エンジンロード（トップレベルの loadBANK_DATA 即時実行を含む）
    vm.runInContext(engineSource, context, { filename: path.basename(enginePath) });

    // guardedData（InputGuard 方針A の浄化済みデータ形式）
    const guardedData = {
      raceType: fixture.raceType,
      bankName: fixture.bankName,
      modeSelector: 'seitenrei',
      lineInput: fixture.lineInput || '',
      players: fixture.players.map(p => ({ ...p })),
      radio: { s1Id: fixture.radio?.s1Id ?? null, b1Id: fixture.radio?.b1Id ?? null },
      wind: { speed: fixture.wind?.speed ?? 0, direction: fixture.wind?.direction ?? '無風' },
    };

    if (fixture.race_id && context.app.setRaceId) context.app.setRaceId(fixture.race_id);

    await context.app.calculatePrediction(guardedData);

    // 買い目回収：sendLog捕獲を優先、無ければ出力要素から
    const seitenHtml = captured.sendLog?.prediction?.seiten ?? dom.getOutput('seitenrei-output');
    const koutenHtml = captured.sendLog?.prediction?.kouten ?? dom.getOutput('koutenrei-output');
    const snapshot = context.app.getCurrentCoefficients ? context.app.getCurrentCoefficients() : null;

    return { seitenHtml, koutenHtml, snapshot, logs };
  }

  return { runRace };
}

/** 予想HTMLから買い目リストを抽出（fixtures抽出と同一規約） */
export function parseBets(html, section) {
  const m = new RegExp(section + '</strong><ul>(.*?)</ul>', 's').exec(html || '');
  if (!m) return [];
  return [...m[1].matchAll(/<li>([^<]+)<\/li>/g)].map(x => x[1].trim());
}
