(function(app) {
    const TEMPLATE_DIR = '/templates/';
    const TEMPLATES = {
        env:    'ritsu_templates_env_v6.json',
        seiten: 'ritsu_templates_seiten_v1.json',
        kouten: 'ritsu_templates_kouten_v1.json',
        soukai: 'ritsu_templates_soukai_v1.json',
        midashi: 'ritsu_templates_midashi_v1.json',
    };

    const _cache = {};

    async function loadTemplate(name) {
        if (_cache[name]) return _cache[name];
        const url = TEMPLATE_DIR + TEMPLATES[name];
        const res = await fetch(url);
        if (!res.ok) throw new Error(`fetch失敗 ${res.status} ${url}`);
        _cache[name] = await res.json();
        return _cache[name];
    }

    function windDir(dir) {
        if (!dir) return '横';
        if (dir.includes('向かい')) return '向かい';
        if (dir.includes('追い'))  return '追い';
        return '横';
    }

    // ── 実効風向解決 ──────────────────────────────────────
    // ADJACENT_MAP / dirToVector / 合成係数0.707 は keirin_logic.js の
    // kururu処理（getKururuAdjustment）と同期必須。値を変える場合は両方同時に変えること。
    const ADJACENT_MAP = {
        "北東": ["北", "東"], "南東": ["南", "東"],
        "南西": ["南", "西"], "北西": ["北", "西"],
        "北":   ["北西", "北東"], "東": ["北東", "南東"],
        "南":   ["南東", "南西"], "西": ["南西", "北西"]
    };

    function dirToVector(dirType) {
        let vec = 0.0;
        if (dirType.includes("追い"))   vec += 1.0;
        if (dirType.includes("向かい")) vec -= 1.0;
        if (dirType === "H→B横風")     vec += 0.2;
        if (dirType === "B→H横風")     vec -= 0.2;
        return vec;
    }

    // 風種別を判定して返す: 'ドーム' | '微風' | '追い' | '向かい' | '横'
    // ドーム判定は「wind_direction_mapが未定義（null含む）」のみを条件とする。バンク名ハードコード禁止。
    // ドーム＞微風の優先順: 屋内では入力風速に関わらず風という変数が存在しないため。
    function resolveWindKind(wind, bank) {
        const map = bank?.wind_direction_map;
        if (!map) return 'ドーム';

        const speed = Number(wind?.speed) || 0;
        const dir   = wind?.direction;
        if (!dir || dir === 'none' || dir === '無風' || speed <= 1.0) return '微風';

        // マップ直接マッチ（wind.effective は keirin_logic.js が map[direction] で算出済み）
        const eff = wind?.effective || map[dir];
        if (eff) return windDir(eff);

        // 隣接2方角のベクトル合成（kururu処理と同一ロジック）
        if (ADJACENT_MAP[dir]) {
            const [adj1, adj2] = ADJACENT_MAP[dir];
            const v1 = map[adj1] ? dirToVector(map[adj1]) : 0.0;
            const v2 = map[adj2] ? dirToVector(map[adj2]) : 0.0;
            const vec = (v1 + v2) * 0.707;
            if (vec >= 0.55)  return '追い';
            if (vec <= -0.55) return '向かい';
            return '横';
        }
        return '横';
    }

    function windSpeed(speed) {
        const v = Number(speed) || 0;
        if (v <= 2.0) return '穏やか';
        if (v <= 5.0) return '活発';
        return '強風';
    }

    function straightLen(len) {
        const v = Number(len) || 50;
        if (v <= 49) return '短い';
        if (v <= 59) return '標準';
        return '長い';
    }

    function styleLabel(style) {
        if (style === '逃' || style === '自') return '逃先';
        if (style === '追' || style === '差') return '差マ';
        if (style === '両') return '捲り';
        return '差マ';
    }

    function variantIndex(raceId, len) {
        if (!raceId || typeof raceId !== 'string') return 0;
        const last = parseInt(raceId.slice(-1), 10);
        if (isNaN(last)) return 0;
        return last % len;
    }

    const CIRCLED = ['', '①', '②', '③', '④', '⑤', '⑥', '⑦'];
    function nameOrCircle(p) {
        return p.name || CIRCLED[p.id] || '';
    }

    function wmark(p) {
        const w = p.wmark;
        return (!w || w === '無') ? '' : w;
    }

    function interpolate(text, relations) {
        if (!text) return '';
        const r0 = relations.seiten?.r0 || {};
        const r1 = relations.seiten?.r1 || {};
        const r2 = relations.seiten?.r2 || {};
        const L  = relations.kouten?.L  || {};
        const sameLine = (relations.lineArrays || []).some(line =>
            Array.isArray(line) && line.includes(r0.id) && line.includes(r1.id)
        );
        const r1_rel = sameLine ? 'が続き' : 'は別線から';
        return text
            .replace(/\{r0\}/g,     nameOrCircle(r0))
            .replace(/\{r1\}/g,     nameOrCircle(r1))
            .replace(/\{r2\}/g,     nameOrCircle(r2))
            .replace(/\{r0mark\}/g, wmark(r0))
            .replace(/\{r1mark\}/g, wmark(r1))
            .replace(/\{r1_rel\}/g, r1_rel)
            .replace(/\{L\}/g,      nameOrCircle(L))
            .replace(/\{Lmark\}/g,  wmark(L));
    }

    function pick(arr, raceId) {
        if (!Array.isArray(arr) || arr.length === 0) return '';
        return arr[variantIndex(raceId, arr.length)];
    }

    function render(id, text) {
        const el = document.getElementById(id);
        if (el) el.textContent = text;
    }

    app.generateRitsuText = async function(relations) {
        try {
            const [envT, seitenT, koutenT, soukaiT, midashiT] = await Promise.all([
                loadTemplate('env'),
                loadTemplate('seiten'),
                loadTemplate('kouten'),
                loadTemplate('soukai'),
                loadTemplate('midashi'),
            ]);

            const raceId = relations.raceId || '';

            // 環境・バンク文（風判定3層: ドーム → 微風 → 追い/向かい/横）
            const windKind = resolveWindKind(relations.wind, relations.bank);
            const envKey = (windKind === 'ドーム' || windKind === '微風')
                ? windKind
                : `${windKind}_${windSpeed(relations.wind?.speed)}_${straightLen(relations.bank?.straight)}`;
            const envArr = envT[envKey] || envT['横_穏やか_標準'] || [''];
            render('ritsu-env', interpolate(pick(envArr, raceId), relations));

            // 見出し＋晴天令読み
            let tenkai = relations.tenkaiPattern || 'ちょい差し';
            if (tenkai === '別線差し') tenkai = 'ちょい差し';
            const r0style = styleLabel(relations.seiten?.r0?.style);
            const seitenKey = `${tenkai}_${r0style}`;
            const midashiArr = midashiT[seitenKey] || midashiT['ちょい差し_差マ'] || [''];
            render('ritsu-midashi', pick(midashiArr, raceId));
            const seitenArr = seitenT[seitenKey] || seitenT['ちょい差し_差マ'] || [''];
            render('ritsu-seiten', interpolate(pick(seitenArr, raceId), relations));

            // 荒天令読み
            const Lstyle = styleLabel(relations.kouten?.L?.style);
            const koutenArr = koutenT[Lstyle] || koutenT['差マ'] || [''];
            render('ritsu-kouten', interpolate(pick(koutenArr, raceId), relations));

            // 総評
            const soukaiKey = String(relations.tenunIndex ?? 50);
            const soukaiArr = soukaiT[soukaiKey] || soukaiT['33'] || [''];
            render('ritsu-soukai', interpolate(pick(soukaiArr, raceId), relations));

        } catch (e) {
            const msg = '[ritsu.js] エラー: ' + e.message;
            app.logMessage(msg);
            render('ritsu-midashi', '令読みエラー');
            render('ritsu-env', msg);
        }
    };

})(App);
