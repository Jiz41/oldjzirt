// VERSION: 1.0
// ============================================================================
// 窓の中の競輪場 — 背景世界レイヤー制御（時刻連動v1：端末時刻）
// ============================================================================
// #bg-world 内の4レイヤーの .active と body の時間帯クラス（bgw-*）を切り替える。
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
    let currentPeriod = null;

    function applyPeriod(period) {
        if (period === currentPeriod) return;
        currentPeriod = period;
        PERIODS.forEach(p => {
            const layer = document.getElementById('bgw-' + p);
            if (layer) layer.classList.toggle('active', p === period);
            document.body.classList.toggle('bgw-' + p, p === period);
        });
    }

    function tick() {
        const now = new Date();
        applyPeriod(getBgPeriod(now.getHours(), now.getMinutes()));
    }

    tick();
    setInterval(tick, 60000);
})();
