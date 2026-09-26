// On-screen logger for mobile (no devtools). Captures console.* + errors into a
// copyable panel. Classic script — must load BEFORE the game module to catch early errors.
(function () {
  var MAX = 500;
  var buf = [];
  var pre = null, panel = null;

  function pad(n) { return n < 10 ? '0' + n : '' + n; }
  function stamp() { var d = new Date(); return pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds()); }

  function fmt(a) {
    if (a instanceof Error) return (a.stack || a.message || String(a));
    if (a && typeof a === 'object') { try { return JSON.stringify(a); } catch (e) { return String(a); } }
    return String(a);
  }

  function push(kind, args) {
    var parts = [];
    for (var i = 0; i < args.length; i++) parts.push(fmt(args[i]));
    buf.push('[' + stamp() + '] ' + kind + ' ' + parts.join(' '));
    if (buf.length > MAX) buf.shift();
    render();
  }

  ['log', 'info', 'warn', 'error', 'debug'].forEach(function (k) {
    var orig = console[k] ? console[k].bind(console) : function () {};
    console[k] = function () { try { push(k.toUpperCase(), arguments); } catch (e) {} orig.apply(null, arguments); };
  });
  window.addEventListener('error', function (e) {
    push('ERROR', [(e.message || 'error') + ' @ ' + (e.filename || '') + ':' + (e.lineno || '') + ':' + (e.colno || ''),
      e.error && e.error.stack ? ('\n' + e.error.stack) : '']);
  });
  window.addEventListener('unhandledrejection', function (e) {
    push('REJECT', [e.reason && e.reason.stack ? e.reason.stack : e.reason]);
  });

  function render() { if (pre && panel && panel.style.display !== 'none') { pre.textContent = buf.join('\n'); pre.scrollTop = pre.scrollHeight; } }

  function mkBtn(label, fn) {
    var b = document.createElement('button');
    b.className = 'devlogAct'; b.textContent = label;
    b.addEventListener('click', fn);
    return b;
  }

  function flash(b, text) { var o = b.textContent; b.textContent = text; setTimeout(function () { b.textContent = o; }, 1100); }

  function copyAll(btn) {
    var text = buf.join('\n');
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () { flash(btn, 'Скопійовано!'); }, function () { fallback(text, btn); });
    } else fallback(text, btn);
  }
  function fallback(text, btn) {
    try {
      var ta = document.createElement('textarea');
      ta.value = text; ta.style.position = 'fixed'; ta.style.left = '-9999px';
      document.body.appendChild(ta); ta.focus(); ta.select();
      var ok = document.execCommand('copy'); document.body.removeChild(ta);
      flash(btn, ok ? 'Скопійовано!' : 'Виділи й копіюй вручну');
    } catch (e) { flash(btn, 'Помилка копіювання'); }
  }

  function toggle() {
    var open = panel.style.display === 'none';
    panel.style.display = open ? 'flex' : 'none';
    if (open) render();
  }

  function build() {
    var btn = document.createElement('button');
    btn.id = 'devlogBtn'; btn.textContent = 'LOG';
    btn.addEventListener('click', toggle);

    panel = document.createElement('div');
    panel.id = 'devlogPanel'; panel.style.display = 'none';
    var bar = document.createElement('div'); bar.id = 'devlogBar';
    var copyBtn = mkBtn('Копіювати', function () { copyAll(copyBtn); });
    bar.appendChild(copyBtn);
    bar.appendChild(mkBtn('Очистити', function () { buf = []; render(); }));
    bar.appendChild(mkBtn('✕', toggle));
    pre = document.createElement('pre'); pre.id = 'devlogPre';
    panel.appendChild(bar); panel.appendChild(pre);

    document.body.appendChild(btn);
    document.body.appendChild(panel);
  }

  window.DevLog = { log: function () { push('LOG', arguments); }, dump: function () { return buf.join('\n'); } };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', build);
  else build();
})();
