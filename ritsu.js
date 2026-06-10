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

    function nameOrId(p) {
        const n = p.name;
        if (!n || n === '無') return p.id != null ? p.id + '番' : '';
        return n;
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
        const r1_rel = sameLine ? 'が続く' : 'は別線から';
        return text
            .replace(/\{r0\}/g,     nameOrId(r0))
            .replace(/\{r1\}/g,     nameOrId(r1))
            .replace(/\{r2\}/g,     nameOrId(r2))
            .replace(/\{r0mark\}/g, r0.wmark || '')
            .replace(/\{r1mark\}/g, r1.wmark || '')
            .replace(/\{r1_rel\}/g, r1_rel)
            .replace(/\{L\}/g,      nameOrId(L))
            .replace(/\{Lmark\}/g,  L.wmark  || '');
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

            // 環境・バンク文
            const envKey = `${windDir(relations.wind?.direction)}_${windSpeed(relations.wind?.speed)}_${straightLen(relations.bank?.straight)}`;
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
            render('ritsu-env', msg);
        }
    };

})(App);
