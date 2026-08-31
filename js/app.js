/* ============================================================
 * A2UI UIカタログ — アプリケーション（カタログUIの組み立て）
 * ============================================================ */
(function () {
  'use strict';

  var el = A2UI.el;
  var CATALOG = window.A2UI_CATALOG;

  /* ---------- JSONハイライト ---------- */
  function escapeHtml(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function highlightJSON(obj) {
    var json = JSON.stringify(obj, null, 2);
    if (json === undefined) json = 'undefined';
    var esc = escapeHtml(json);
    return esc.replace(
      /("(?:\\.|[^"\\])*")(\s*:)?|(-?\b\d+(?:\.\d+)?\b)|(\btrue\b|\bfalse\b|\bnull\b)/g,
      function (m, str, colon, num, kw) {
        if (str) return colon
          ? '<span class="j-key">' + str + '</span>' + colon
          : '<span class="j-str">' + str + '</span>';
        if (num) return '<span class="j-num">' + num + '</span>';
        if (kw) return '<span class="j-kw">' + kw + '</span>';
        return m;
      }
    );
  }

  /* ---------- コピー ---------- */
  function copyText(text, btn) {
    function done() {
      var old = btn.textContent;
      btn.textContent = 'コピーしました ✓';
      setTimeout(function () { btn.textContent = old; }, 1500);
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, function () { fallback(); });
    } else fallback();
    function fallback() {
      var ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); done(); } catch (e) { /* noop */ }
      ta.remove();
    }
  }

  /* ---------- イベントログ（client⇄server の可視化） ---------- */
  function createEventLog(open) {
    var details = el('details', { 'class': 'log-box' });
    if (open) details.open = true;
    details.appendChild(el('summary', null, 'イベントログ（client ⇄ server）'));
    var body = el('div');
    var empty = el('div', { 'class': 'dm-empty', style: { padding: '8px 14px 12px', fontSize: '12px' } },
      'まだイベントはありません。プレビュー内のボタンを押すと、ここに client → server の action メッセージが表示されます。');
    body.appendChild(empty);
    details.appendChild(body);

    function add(tag, obj, cls) {
      empty.remove();
      var item = el('div', { 'class': 'event-item' });
      item.appendChild(el('span', { 'class': 'event-tag' + (cls ? ' ' + cls : '') }, tag));
      item.appendChild(el('pre', { html: highlightJSON(obj) }));
      body.appendChild(item);
      while (body.children.length > 30) body.removeChild(body.firstChild);
    }
    return { details: details, add: add };
  }

  /* ---------- データモデル ライブビュー ---------- */
  function createDataModelView(open) {
    var details = el('details', { 'class': 'log-box' });
    if (open) details.open = true;
    details.appendChild(el('summary', null, 'データモデル（ライブ） — surface.dataModel'));
    var pre = el('pre');
    details.appendChild(pre);
    return {
      details: details,
      refresh: function (surface) {
        var has = surface.dataModel && Object.keys(surface.dataModel).length > 0;
        pre.innerHTML = has ? highlightJSON(surface.dataModel)
          : '<span class="dm-empty">(空 — updateDataModel はまだ送られていません)</span>';
      }
    };
  }

  /* ---------- プロパティ表 ---------- */
  function propTable(props) {
    var table = el('table', { 'class': 'props' });
    var head = el('tr', null,
      el('th', null, 'プロパティ'), el('th', null, '型・値'), el('th', null, '必須'),
      el('th', null, '既定'), el('th', null, '説明'));
    table.appendChild(el('thead', null, head));
    var tbody = el('tbody');
    props.forEach(function (p) {
      tbody.appendChild(el('tr', null,
        el('td', null, p.n),
        el('td', null, p.t),
        el('td', { 'class': p.r ? 'req' : 'opt' }, p.r ? '◎' : '−'),
        el('td', null, p.v || '−'),
        el('td', { html: p.d })
      ));
    });
    table.appendChild(tbody);
    return table;
  }

  /* ---------- 通常エントリ（JSON + プレビュー）の構築 ---------- */
  function buildDemoEntry(item, entryNode) {
    var demo = el('div', { 'class': 'demo' });

    /* JSONペイン */
    var jsonPane = el('div', { 'class': 'pane json-pane' });
    var copyBtn = el('button', { 'class': 'copy-btn', type: 'button' }, 'コピー');
    jsonPane.appendChild(el('div', { 'class': 'pane-header' }, el('span', null, 'A2UI JSON（メッセージストリーム）'), copyBtn));
    var pre = el('pre', { 'class': 'json-code' });
    pre.innerHTML = item.messages.map(highlightJSON).join('\n\n');
    jsonPane.appendChild(pre);
    demo.appendChild(jsonPane);

    copyBtn.addEventListener('click', function () {
      copyText(item.messages.map(function (m) { return JSON.stringify(m, null, 2); }).join('\n\n'), copyBtn);
    });

    /* プレビューペイン */
    var previewPane = el('div', { 'class': 'pane preview-pane' });
    previewPane.appendChild(el('div', { 'class': 'pane-header' }, el('span', null, 'プレビュー（ライブ）')));
    var frame = el('div', { 'class': 'surface-frame' });
    previewPane.appendChild(frame);

    var eventLog = createEventLog(!!item.openEventLog);
    var dmView = createDataModelView(!!item.openDataModel);

    var surface = A2UI.mountSurface(frame, item.messages, {
      onAction: function (message, metadata) {
        if (message.localFunctionCall) {
          eventLog.add('⚡ ローカル関数実行', message, 'fn');
        } else {
          eventLog.add('⬆ action（client → server）', message);
          if (metadata && metadata.a2uiClientDataModel) {
            eventLog.add('📦 metadata にデータモデルを同梱（sendDataModel）', metadata.a2uiClientDataModel, 'fn');
          }
        }
      },
      onRender: function (s) { dmView.refresh(s); }
    });
    dmView.refresh(surface);

    /* 追加コントロール（サーバーからのメッセージをシミュレート） */
    if (item.extraControls && item.extraControls.length) {
      var extra = el('div', { 'class': 'preview-extra' });
      extra.appendChild(el('span', { 'class': 'ctl-label' }, 'シミュレーター:'));
      item.extraControls.forEach(function (ctl) {
        var btn = el('button', { 'class': 'ctl-btn', type: 'button' }, ctl.label);
        btn.addEventListener('click', function () {
          surface.handleMessage(ctl.message);
          var kind = ctl.message.updateDataModel ? 'updateDataModel'
            : ctl.message.updateComponents ? 'updateComponents'
            : ctl.message.deleteSurface ? 'deleteSurface' : 'message';
          eventLog.add('⬇ ' + kind + '（server → client）', ctl.message, 'fn');
          dmView.refresh(surface);
        });
        extra.appendChild(btn);
      });
      previewPane.appendChild(extra);
    }

    previewPane.appendChild(eventLog.details);
    previewPane.appendChild(dmView.details);
    demo.appendChild(previewPane);

    entryNode.appendChild(demo);
  }

  /* ---------- ストリームプレイヤーの構築 ---------- */
  function buildStreamEntry(item, entryNode) {
    var lines = item.stream;   // メッセージオブジェクトの配列
    var idx = 0;
    var surface = null;

    var player = el('div', { 'class': 'stream-player' });
    var body = el('div', { 'class': 'sp-body' });

    /* 左: JSONL + コントロール */
    var left = el('div', { 'class': 'sp-left' });
    var textarea = el('textarea', { 'class': 'sp-textarea', readonly: true, spellcheck: 'false' });
    textarea.value = lines.map(function (m) { return JSON.stringify(m); }).join('\n');
    left.appendChild(textarea);

    var btnNext = el('button', { 'class': 'sp-btn', type: 'button' }, '▶ 次のメッセージを送信');
    var btnAll = el('button', { 'class': 'sp-btn ghost', type: 'button' }, '⏩ すべて送信');
    var btnReset = el('button', { 'class': 'sp-btn ghost', type: 'button' }, '↺ リセット');
    var status = el('span', { 'class': 'sp-status' }, '0 / ' + lines.length + ' 通 送信済み');
    var controls = el('div', { 'class': 'sp-controls' }, btnNext, btnAll, btnReset, status);
    left.appendChild(controls);

    var msgLabel = el('div', { 'class': 'sp-status' }, '最後に送信したメッセージ:');
    var msgPre = el('pre', { 'class': 'json-code sp-msg', style: { maxHeight: '170px' } });
    msgPre.innerHTML = '<span class="dm-empty">（まだありません）</span>';
    left.appendChild(msgLabel);
    left.appendChild(msgPre);

    /* 右: プレビュー */
    var right = el('div', { 'class': 'pane preview-pane' });
    right.appendChild(el('div', { 'class': 'pane-header' }, el('span', null, 'プレビュー（クライアント側の状態）')));
    var frame = el('div', { 'class': 'surface-frame' });
    right.appendChild(frame);

    var eventLog = createEventLog(!!item.openEventLog);
    right.appendChild(eventLog.details);

    body.appendChild(left);
    body.appendChild(right);
    player.appendChild(body);
    entryNode.appendChild(player);

    function ensureSurface() {
      if (!surface) {
        surface = A2UI.mountSurface(frame, [], {
          onAction: function (message, metadata) {
            if (message.localFunctionCall) {
              eventLog.add('⚡ ローカル関数実行', message, 'fn');
            } else {
              eventLog.add('⬆ action（client → server）', message);
              if (metadata && metadata.a2uiClientDataModel) {
                eventLog.add('📦 metadata にデータモデルを同梱（sendDataModel）', metadata.a2uiClientDataModel, 'fn');
              }
            }
          }
        });
      }
    }

    function updateStatus() {
      status.textContent = idx + ' / ' + lines.length + ' 通 送信済み';
      btnNext.disabled = idx >= lines.length;
      btnAll.disabled = idx >= lines.length;
      btnNext.textContent = idx >= lines.length ? '✓ 全メッセージ送信済み' : '▶ 次のメッセージを送信';
    }

    function sendNext() {
      if (idx >= lines.length) return false;
      ensureSurface();
      var msg = lines[idx];
      surface.handleMessage(msg);
      msgPre.innerHTML = highlightJSON(msg);
      var kind = msg.createSurface ? 'createSurface'
        : msg.updateComponents ? 'updateComponents'
        : msg.updateDataModel ? 'updateDataModel'
        : msg.deleteSurface ? 'deleteSurface' : 'message';
      eventLog.add('⬇ ' + kind + '（server → client）', msg, 'fn');
      idx++;
      updateStatus();
      return true;
    }

    btnNext.addEventListener('click', sendNext);
    btnAll.addEventListener('click', function () {
      function tick() {
        if (sendNext()) setTimeout(tick, 450);
      }
      tick();
    });
    btnReset.addEventListener('click', function () {
      idx = 0;
      if (surface) { surface.el.remove(); surface = null; }
      frame.innerHTML = '';
      msgPre.innerHTML = '<span class="dm-empty">（まだありません）</span>';
      updateStatus();
    });
    updateStatus();
  }

  /* ---------- カタログ本体の組み立て ---------- */
  var catalogRoot = document.getElementById('catalog');
  var nav = document.getElementById('nav');
  var navLinks = [];

  CATALOG.forEach(function (cat) {
    var catNav = el('div');
    catNav.appendChild(el('div', { 'class': 'nav-cat' }, cat.category));
    nav.appendChild(catNav);

    var section = el('section', { 'class': 'category', id: 'cat-' + categorySlug(cat.category) });
    section.appendChild(el('h2', null, cat.category));
    if (cat.catDesc) section.appendChild(el('p', { 'class': 'cat-desc' }, el('span', { html: cat.catDesc })));

    cat.items.forEach(function (item) {
      var link = el('a', { 'class': 'nav-item', href: '#' + item.id },
        (item.title.split(' — ')[0] || item.title));
      catNav.appendChild(link);
      navLinks.push({ link: link, id: item.id });

      var entry = el('section', { 'class': 'entry', id: item.id });
      var header = el('div', { 'class': 'entry-header' }, el('h3', null, item.title));
      if (item.badge) header.appendChild(el('span', { 'class': 'badge' }, item.badge));
      entry.appendChild(header);
      if (item.desc) entry.appendChild(el('p', { 'class': 'desc', html: item.desc }));

      if (item.docHtml) entry.appendChild(el('div', { 'class': 'doc-body', html: item.docHtml }));
      if (item.props && item.props.length) entry.appendChild(propTable(item.props));

      if (item.stream) buildStreamEntry(item, entry);
      else if (item.messages) buildDemoEntry(item, entry);

      if (item.note) entry.appendChild(el('p', { 'class': 'note', html: '💡 ' + item.note }));

      section.appendChild(entry);
    });

    catalogRoot.appendChild(section);
  });

  function categorySlug(name) {
    return encodeURIComponent(String(name)).replace(/%/g, '');
  }

  /* ---------- スクロールスパイ ---------- */
  if ('IntersectionObserver' in window) {
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) {
          navLinks.forEach(function (n) {
            n.link.classList.toggle('active', n.id === en.target.id);
          });
        }
      });
    }, { rootMargin: '-20% 0px -70% 0px' });
    navLinks.forEach(function (n) {
      var target = document.getElementById(n.id);
      if (target) observer.observe(target);
    });
  }
})();
