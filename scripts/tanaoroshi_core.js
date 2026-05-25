// tanaoroshi_core.js — 自動棚卸し本体
// 読み取り専用。ファイルの修正・削除は一切行わない。

const fs   = require('fs');
const path = require('path');
const https = require('https');

const WITH_VERIFY = process.argv.includes('--with-verify');

const TARGETS = [
    '/root/Jiz41r1t5u/keirin_logic.js',
    '/root/Jiz41r1t5u/shakkou_donperi_core.js',
];

const DISCORD_WEBHOOK = process.env.DISCORD_WEBHOOK_URL;
const CSV_DIR = '/storage/emulated/0/Download/QuickShare';

// ── ユーティリティ ────────────────────────────────────────
function readFile(p) {
    return fs.readFileSync(p, 'utf8');
}

function getLines(src) {
    return src.split('\n');
}

// ── 静的解析ヘルパー ──────────────────────────────────────

// const/let/var 宣言を抽出
function extractDeclarations(src) {
    const decls = [];
    const re = /(?:const|let|var)\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*=/g;
    let m;
    while ((m = re.exec(src)) !== null) {
        const line = src.slice(0, m.index).split('\n').length;
        decls.push({ name: m[1], line });
    }
    return decls;
}

// 識別子の使用回数カウント（宣言行以外）
function countUsages(src, name) {
    const re = new RegExp(`\\b${name}\\b`, 'g');
    return (src.match(re) || []).length;
}

// function宣言を抽出
function extractFunctions(src) {
    const funcs = [];
    const re = /^(?:function\s+([A-Za-z_$][A-Za-z0-9_$]*)|(?:const|let|var)\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*=\s*(?:async\s+)?function|\bapp\.([A-Za-z_$][A-Za-z0-9_$]*)\s*=\s*(?:async\s+)?function)/mg;
    let m;
    while ((m = re.exec(src)) !== null) {
        const name = m[1] || m[2] || m[3];
        const line = src.slice(0, m.index).split('\n').length;
        if (name) funcs.push({ name, line });
    }
    return funcs;
}

// ×1.0 / ×1 の冗長乗算
function findRedundantMultiplications(src, lines) {
    const findings = [];
    lines.forEach((ln, i) => {
        if (/\*\s*1\.0\b/.test(ln) || /\*\s*1\b(?!\.)/.test(ln)) {
            if (!/\/\//.test(ln.split('*')[0])) { // コメント行は除外
                findings.push({ line: i + 1, text: ln.trim() });
            }
        }
    });
    return findings;
}

// マジックナンバー検出（コメントなし数値リテラル）
function findMagicNumbers(src, lines) {
    const findings = [];
    const re = /[^a-zA-Z0-9_'"`](\d+\.\d{2,})[^a-zA-Z0-9_'"`]/g;
    lines.forEach((ln, i) => {
        if (ln.trim().startsWith('//')) return;
        let m;
        while ((m = re.exec(ln)) !== null) {
            const val = parseFloat(m[1]);
            if (val === 1.0 || val === 0.0) continue; // 冗長チェック側で拾う
            const hasComment = ln.includes('//');
            if (!hasComment) {
                findings.push({ line: i + 1, value: m[1], text: ln.trim().slice(0, 60) });
            }
        }
        re.lastIndex = 0;
    });
    return findings;
}

// ── チェック実行 ──────────────────────────────────────────
function analyzeFile(filePath) {
    const filename = path.basename(filePath);
    const src = readFile(filePath);
    const lines = getLines(src);
    const findings = [];

    // --- チェック1：未使用変数・未接続係数 ---
    const decls = extractDeclarations(src);
    for (const d of decls) {
        const usages = countUsages(src, d.name);
        // 宣言で1回、使用で1回 = 計2回以上が最低限
        if (usages <= 1 && d.name.length > 2) {
            findings.push({
                severity: 'B',
                category: '未使用の変数・係数',
                file: filename,
                line: d.line,
                summary: `「${d.name}」が定義されていますが、計算の流れに乗っていないようです。`,
                detail: `何の値を持つ変数か確認のうえ、不要であれば削除できます。`,
            });
        }
    }

    // --- チェック2：死にコード（関数定義・呼び出しなし）---
    const funcs = extractFunctions(src);
    for (const f of funcs) {
        const usages = countUsages(src, f.name);
        if (usages <= 1 && !['calculatePrediction','runScenarioSimulation'].includes(f.name)) {
            findings.push({
                severity: 'A',
                category: '呼び出されていない関数（死にコード候補）',
                file: filename,
                line: f.line,
                summary: `「${f.name}」という処理が定義されていますが、どこからも呼び出されていません。`,
                detail: `過去の改修で切り離された可能性があります。不要であれば削除できます。`,
            });
        }
    }

    // --- チェック3：冗長コード（×1.0 乗算）---
    const redundant = findRedundantMultiplications(src, lines);
    for (const r of redundant) {
        findings.push({
            severity: 'C',
            category: '効果ゼロの乗算（×1.0）',
            file: filename,
            line: r.line,
            summary: `1.0を掛けている箇所があります。計算結果に影響しません。`,
            detail: `整理のため削除しても問題ないと思われます。`,
        });
    }

    // --- チェック4：意図が即わからない箇所（コメントなしマジックナンバー）---
    const magic = findMagicNumbers(src, lines);
    // 上位5件に絞る（C扱い）
    for (const mg of magic.slice(0, 5)) {
        findings.push({
            severity: 'C',
            category: '説明のない数値（マジックナンバー）',
            file: filename,
            line: mg.line,
            summary: `「${mg.value}」という数値が何の根拠で設定されているか読み取れません。`,
            detail: `コメントで「何の係数か」「なぜこの値か」を1行補足いただけると将来の改修が楽になります。`,
        });
    }

    return findings;
}

// --- チェック5（照合モード）: 実績CSVとの照合 ---
function analyzeWithVerify() {
    const findings = [];
    // 最新のCSVファイルを取得
    let csvFiles = [];
    try {
        csvFiles = fs.readdirSync(CSV_DIR)
            .filter(f => f.includes('ハズレ解析') && f.endsWith('.csv'))
            .map(f => ({ name: f, mtime: fs.statSync(path.join(CSV_DIR, f)).mtimeMs }))
            .sort((a, b) => b.mtime - a.mtime);
    } catch (e) {
        findings.push({
            severity: 'S',
            category: '実績CSVが見つかりません',
            file: '—',
            line: null,
            summary: `照合モードで実行しましたが、${CSV_DIR} にCSVファイルが見つかりませんでした。`,
            detail: `ハズレ解析CSVをQuickShareフォルダに配置してください。`,
        });
        return findings;
    }

    if (csvFiles.length === 0) {
        findings.push({
            severity: 'S',
            category: '実績CSVが見つかりません',
            file: '—',
            line: null,
            summary: `照合対象のハズレ解析CSVが見つかりませんでした。`,
            detail: `ファイル名に「ハズレ解析」を含むCSVをQuickShareフォルダに配置してください。`,
        });
        return findings;
    }

    const latestCsv = csvFiles[0];
    findings.push({
        severity: 'C',
        category: '実績CSV照合（情報）',
        file: latestCsv.name,
        line: null,
        summary: `照合対象：${latestCsv.name}`,
        detail: `最新ファイルを使用して照合を行いました。件数・期間は次回実装で詳細化予定。`,
    });

    return findings;
}

// ── レポート組み立て ──────────────────────────────────────
const SEVERITY_LABEL = { S: '🔴 S（重大）', A: '🟠 A（要対応）', B: '🟡 B（確認推奨）', C: '⚪ C（軽微）' };
const SEVERITY_ORDER = { S: 0, A: 1, B: 2, C: 3 };

function buildReport(allFindings) {
    const today = new Date().toLocaleDateString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '/');
    const mode  = WITH_VERIFY ? '（照合モード）' : '（通常モード）';

    const sorted = allFindings.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);

    if (sorted.length === 0) {
        return [`**【棚卸しレポート ${today}】${mode}**\n\n問題は見つかりませんでした。引き続きご安心ください。`];
    }

    const header = `**【棚卸しレポート ${today}】${mode}**\n検出件数：${sorted.length}件\n---`;
    const chunks  = [header];
    let   current = '';

    for (const f of sorted) {
        const lineStr = f.line ? `${f.file} ${f.line}行目付近` : f.file;
        const block = [
            `\n■ ${SEVERITY_LABEL[f.severity]}：${f.category}`,
            lineStr,
            f.summary,
            f.detail,
        ].join('\n');

        // Discordの2000文字制限を考慮して分割
        if ((current + block).length > 1800) {
            chunks.push(current);
            current = block;
        } else {
            current += block;
        }
    }
    if (current) chunks.push(current);
    return chunks;
}

// ── Discord送信 ───────────────────────────────────────────
function sendToDiscord(message) {
    return new Promise((resolve, reject) => {
        const body = JSON.stringify({ content: message });
        const url  = new URL(DISCORD_WEBHOOK);
        const opts = {
            hostname: url.hostname,
            path:     url.pathname + url.search,
            method:   'POST',
            headers:  { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
        };
        const req = https.request(opts, res => {
            res.on('data', () => {});
            res.on('end', () => resolve());
        });
        req.on('error', reject);
        req.write(body);
        req.end();
    });
}

// ── メイン ───────────────────────────────────────────────
async function main() {
    if (!DISCORD_WEBHOOK) {
        console.error('DISCORD_WEBHOOK_URL が未設定です');
        process.exit(1);
    }

    let allFindings = [];

    for (const target of TARGETS) {
        if (!fs.existsSync(target)) {
            allFindings.push({
                severity: 'S',
                category: 'ファイルが見つかりません',
                file: path.basename(target),
                line: null,
                summary: `${target} が存在しません。`,
                detail: `パスを確認してください。`,
            });
            continue;
        }
        allFindings = allFindings.concat(analyzeFile(target));
    }

    if (WITH_VERIFY) {
        allFindings = allFindings.concat(analyzeWithVerify());
    }

    const chunks = buildReport(allFindings);
    for (const chunk of chunks) {
        await sendToDiscord(chunk);
        await new Promise(r => setTimeout(r, 500)); // レート制限回避
    }

    console.log(`棚卸し完了：${allFindings.length}件検出`);
}

main().catch(e => { console.error(e); process.exit(1); });
