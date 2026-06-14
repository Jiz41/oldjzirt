(function() {
  var SELECTORS = [
    'html',
    'body',
    '#jiz-main-content',
    '.subtitle',
    'h2',
    'h3',
    'h4',
    '.manual-header',
    '.manual-content',
    '#ritsu-column',
    '.kiyone-section',
    '.kiyone-voice',
    '#bank-tendency-display',
    '#ensan-kekka-output',
    '.ensan-bet',
    'code',
    'small',
  ];

  function runDebug() {
    var cs = window.getComputedStyle;
    var lines = [];

    lines.push('=== FONT SIZE DEBUG ===');
    lines.push('UA: ' + navigator.userAgent.slice(0, 80));
    lines.push('viewport: ' + (document.querySelector('meta[name=viewport]') || {}).content);
    lines.push('innerW: ' + window.innerWidth + ' / DPR: ' + window.devicePixelRatio);
    lines.push('');

    SELECTORS.forEach(function(sel) {
      var el = sel === 'html'
        ? document.documentElement
        : sel === 'body'
          ? document.body
          : document.querySelector(sel);
      if (!el) { lines.push(sel + ': (not found)'); return; }
      var style = cs(el);
      lines.push(sel + ': ' + style.fontSize
        + ' | lh=' + style.lineHeight
        + ' | ls=' + style.letterSpacing);
    });

    // インラインstyleにem/remが残る要素を検出
    lines.push('');
    lines.push('=== INLINE STYLE EM/REM ===');
    var all = document.querySelectorAll('[style]');
    var found = 0;
    all.forEach(function(el) {
      var s = el.getAttribute('style') || '';
      if (/font-size\s*:\s*[0-9.]+e?r?em/i.test(s)) {
        var id = el.id ? '#' + el.id : el.className ? '.' + el.className.split(' ')[0] : el.tagName;
        lines.push(id + ': ' + s.match(/font-size[^;]*/i)[0]);
        found++;
      }
    });
    if (!found) lines.push('(none)');

    var text = lines.join('\n');

    // 画面オーバーレイ表示
    var box = document.createElement('div');
    box.style.cssText = [
      'position:fixed', 'top:0', 'left:0', 'right:0', 'z-index:2147483647',
      'background:rgba(0,0,0,0.93)', 'color:#00ff88',
      'font-family:monospace', 'font-size:11px', 'line-height:1.5',
      'padding:12px', 'max-height:60vh', 'overflow-y:auto',
      'white-space:pre', 'word-break:break-all'
    ].join(';');
    box.textContent = text;

    var btn = document.createElement('button');
    btn.textContent = '✕ 閉じる';
    btn.style.cssText = 'display:block;margin:8px 0 0;padding:6px 16px;background:#333;color:#fff;border:1px solid #666;font-size:13px;cursor:pointer;';
    btn.onclick = function() { box.remove(); };
    box.appendChild(btn);
    document.body.appendChild(box);
  }

  // #jiz-main-content が visible になった直後に起動
  function waitForVisible() {
    var main = document.getElementById('jiz-main-content');
    if (!main) { setTimeout(waitForVisible, 200); return; }

    var observer = new MutationObserver(function(mutations) {
      for (var i = 0; i < mutations.length; i++) {
        if (main.classList.contains('visible')) {
          observer.disconnect();
          // 描画が確定するまで1フレーム待つ
          requestAnimationFrame(function() {
            requestAnimationFrame(runDebug);
          });
          return;
        }
      }
    });
    observer.observe(main, { attributes: true, attributeFilter: ['class'] });

    // 既にvisibleなら即実行
    if (main.classList.contains('visible')) {
      requestAnimationFrame(function() { requestAnimationFrame(runDebug); });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', waitForVisible);
  } else {
    waitForVisible();
  }
})();
