(function() {
  const splash    = document.getElementById('jiz-splash');
  const logo      = document.getElementById('jiz-splash-logo');
  const loaderBar = document.getElementById('jiz-loader-bar');
  const main      = document.getElementById('jiz-main-content');
  const MIN_MS    = 1500;
  const startTime = Date.now();

  // ゲージを1.2秒で60%まで進める（ロード中の演出）
  setTimeout(() => {
    loaderBar.style.transition = 'width 1.2s ease-out';
    loaderBar.style.width = '60%';
  }, 100);

  function complete() {
    const remaining = Math.max(0, MIN_MS - (Date.now() - startTime));
    setTimeout(() => {
      // ゲージを100%に
      loaderBar.style.transition = 'width 0.3s ease-in';
      loaderBar.style.width = '100%';
      // ロゴフェードイン
      setTimeout(() => logo.classList.add('visible'), 150);
      // スプラッシュアウト→本体表示
      setTimeout(() => {
        splash.classList.add('out');
        setTimeout(() => {
          splash.style.display = 'none';
          main.classList.add('visible');
        }, 600);
      }, 900);
    }, remaining);
  }

  if (document.readyState === 'complete') {
    complete();
  } else {
    window.addEventListener('load', complete);
  }
})();
