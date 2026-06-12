// VERSION: 2.0
// ============================================================================
// 窓の中の競輪場 — バンク背景制御（時刻連動v1：端末時刻）
// ============================================================================
// .result-section 内の .rs-bg 4レイヤーの .active を切り替える（すりガラス方式）。
// グローバルへは何も公開しない。
// ============================================================================
(function() {
    'use strict';

    // 時刻→区分の純関数（将来レース時刻連動に拡張する際はここを差し替え入口とする）
    // 06:00〜11:00 朝 / 11:01〜16:00 昼 / 16:01〜20:30 夜 / 20:31〜05:59 深夜
    function getBgPeriod(hours, minutes) {
        const t = hours * 60 + minutes;
        if (t >= 360 && t <= 660)  return 'asa';
        if (t >= 661 && t <= 960)  return 'hiru';
        if (t >= 961 && t <= 1230) return 'yoru';
        return 'shinya';
    }

    const PERIODS = ['asa', 'hiru', 'yoru', 'shinya'];
    const IMAGES = {
        asa:    'bg/bg01_asa.webp',
        hiru:   'bg/bg02_hiru.webp',
        yoru:   'bg/bg03_yoru.webp',
        shinya: 'bg/bg04_shinya.webp',
    };
    let currentPeriod = null;

    // プリロード：.result-section は計算実行まで display:none のため
    // ブラウザが背景画像を取得せず、初回出現時に一拍空白になるのを防ぐ。
    // 当該時間帯の1枚のみ・load完了後のアイドル時に取得（初期表示速度に不干渉）
    const preloadedPeriods = {};
    function preloadPeriodImage(period) {
        if (preloadedPeriods[period]) return;
        preloadedPeriods[period] = true;
        const img = new Image();
        img.src = IMAGES[period];
    }

    function schedulePreload(period) {
        const onIdle = () => {
            if ('requestIdleCallback' in window) {
                requestIdleCallback(() => preloadPeriodImage(period), { timeout: 10000 });
            } else {
                setTimeout(() => preloadPeriodImage(period), 2000);
            }
        };
        if (document.readyState === 'complete') onIdle();
        else window.addEventListener('load', onIdle, { once: true });
    }

    function applyPeriod(period) {
        if (period === currentPeriod) return;
        currentPeriod = period;
        PERIODS.forEach(p => {
            const layer = document.getElementById('rsbg-' + p);
            if (layer) layer.classList.toggle('active', p === period);
        });
        schedulePreload(period);
    }

    function tick() {
        const now = new Date();
        applyPeriod(getBgPeriod(now.getHours(), now.getMinutes()));
    }

    tick();
    setInterval(tick, 60000);
})();
