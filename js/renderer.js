/* ============================================================
 * A2UI v0.9 ミニレンダラー
 * ------------------------------------------------------------
 * 仕様（a2ui_protocol.md / catalogs/basic/catalog.json）に忠実な
 * 学習用レンダラー実装。以下のレンダリングモデルを実装する:
 *
 *  - サーバー→クライアント4メッセージ型
 *      createSurface / updateComponents / updateDataModel / deleteSurface
 *  - 隣接リストモデル: コンポーネントはフラットなMapに格納し、
 *    ID参照（children/child/tabs/trigger/content）でツリーを構築
 *  - rootゲーティング: id "root" が定義されるまで表示されない
 *  - プログレッシブレンダリング: 欠落データ・子はプレースホルダー表示
 *  - Dynamic* プロパティ: リテラル / {path} / FunctionCall を受理
 *    絶対パス(先頭/)はルートスコープ、相対パスはコレクションの
 *    テンプレートスコープで解決
 *  - 双方向バインディング: 入力は即座にローカルデータモデルへ反映
 *    （サーバーへの送信は action 発火時のみ）
 *  - checks: 条件を満たさない場合 TextField にエラー表示、
 *    Button は自動的に無効化
 *  - action: イベントは name/surfaceId/sourceComponentId/timestamp/
 *    context を持つメッセージとして送信。sendDataModel が有効な場合
 *    データモデル全体をメタデータに同梱
 * ============================================================ */
(function () {
  'use strict';

  /* ============================================================
   * JSON Pointer (RFC 6901) ユーティリティ
   * ============================================================ */
  function parsePointer(ptr) {
    if (typeof ptr !== 'string' || ptr === '' || ptr === '/') return [];
    return ptr.split('/').slice(1).map(function (t) {
      return t.replace(/~1/g, '/').replace(/~0/g, '~');
    });
  }

  function getPointer(obj, ptr) {
    var cur = obj;
    var tokens = parsePointer(ptr);
    for (var i = 0; i < tokens.length; i++) {
      if (cur === null || cur === undefined) return undefined;
      cur = cur[tokens[i]];
    }
    return cur;
  }

  /** upsertセマンティクスで path に value を書き込む。value===undefined なら削除 */
  function setPointer(obj, ptr, value) {
    var tokens = parsePointer(ptr);
    if (tokens.length === 0) return obj;
    var cur = obj;
    for (var i = 0; i < tokens.length - 1; i++) {
      var t = tokens[i];
      var next = tokens[i + 1];
      if (cur[t] === null || cur[t] === undefined || typeof cur[t] !== 'object') {
        cur[t] = /^\d+$/.test(next) ? [] : {};
      }
      cur = cur[t];
    }
    var last = tokens[tokens.length - 1];
    if (value === undefined) {
      if (Array.isArray(cur)) cur[Number(last)] = undefined; // 配列は長さを維持
      else delete cur[last];
    } else {
      cur[last] = value;
    }
    return obj;
  }

  /* ============================================================
   * DOMヘルパー
   * ============================================================ */
  function append(parent, child) {
    if (child === null || child === undefined || child === false) return;
    if (Array.isArray(child)) {
      for (var i = 0; i < child.length; i++) append(parent, child[i]);
      return;
    }
    if (child instanceof Node) parent.appendChild(child);
    else parent.appendChild(document.createTextNode(String(child)));
  }

  function el(tag, attrs) {
    var node = document.createElement(tag);
    if (attrs) {
      for (var k in attrs) {
        if (!Object.prototype.hasOwnProperty.call(attrs, k)) continue;
        var v = attrs[k];
        if (v === null || v === undefined || v === false) continue;
        if (k === 'class') node.className = v;
        else if (k === 'style' && typeof v === 'object') { for (var s in v) node.style[s] = v[s]; }
        else if (k === 'html') node.innerHTML = v;
        else if (k.slice(0, 2) === 'on' && typeof v === 'function') {
          node.addEventListener(k.slice(2).toLowerCase(), v);
        }
        else if (v === true) node.setAttribute(k, '');
        else node.setAttribute(k, String(v));
      }
    }
    for (var i = 2; i < arguments.length; i++) append(node, arguments[i]);
    return node;
  }

  var cssEscapeFn = (typeof CSS !== 'undefined' && CSS.escape) ? CSS.escape :
    function (s) { return String(s).replace(/["\\\]]/g, '\\$&'); };

  /* ============================================================
   * A2UISurface — 1つのサーフェス（UI領域）を表す
   * ============================================================ */
  function A2UISurface(opts) {
    opts = opts || {};
    this.surfaceId = opts.surfaceId || 'surface';
    this.catalogId = opts.catalogId || '';
    this.theme = opts.theme || {};
    this.sendDataModel = !!opts.sendDataModel;
    this.onAction = opts.onAction || null;   // function (message, metadata, surface)
    this.onRender = opts.onRender || null;   // function (surface)
    this.openUrlHandler = opts.openUrl || null;

    this.components = new Map();  // id → コンポーネント定義
    this.dataModel = {};          // サーフェスのローカルデータモデル
    this.uiState = new Map();     // 描画状態（タブ選択・モーダル開閉など）
    this.created = false;
    this.destroyed = false;
    this._pending = false;

    this.el = el('div', { 'class': 'a2ui-surface' });
    this._renderNow();
  }

  /* -------------------- メッセージディスパッチ -------------------- */
  A2UISurface.prototype.handleMessage = function (msg) {
    if (!msg || typeof msg !== 'object') return;
    if (msg.createSurface) {
      if (this.created) { this.components.clear(); this.uiState.clear(); this.dataModel = {}; this.destroyed = false; }
      this.surfaceId = msg.createSurface.surfaceId || this.surfaceId;
      this.catalogId = msg.createSurface.catalogId || this.catalogId;
      this.theme = msg.createSurface.theme || {};
      this.sendDataModel = !!msg.createSurface.sendDataModel;
      this.created = true;
      this._renderNow();
    } else if (msg.updateComponents) {
      var comps = (msg.updateComponents && msg.updateComponents.components) || [];
      for (var i = 0; i < comps.length; i++) {
        if (comps[i] && comps[i].id) this.components.set(comps[i].id, comps[i]);
      }
      this.render();
    } else if (msg.updateDataModel) {
      this._applyDataModel(msg.updateDataModel);
      this.render();
    } else if (msg.deleteSurface) {
      this.destroyed = true;
      this.components.clear();
      this.dataModel = {};
      this.uiState.clear();
      this.el.innerHTML = '';
      this.el.appendChild(el('div', { 'class': 'a2ui-deleted' },
        'deleteSurface 受信 — サーフェス「' + this.surfaceId + '」とコンポーネント・データを破棄しました'));
      if (this.onRender) { try { this.onRender(this); } catch (e) { /* noop */ } }
    }
  };

  A2UISurface.prototype._applyDataModel = function (u) {
    var path = (u.path === undefined || u.path === null || u.path === '/') ? '' : u.path;
    if (path === '') {
      // データモデル全体を置換
      this.dataModel = ('value' in u && u.value !== undefined) ?
        ((u.value !== null && typeof u.value === 'object' && !Array.isArray(u.value)) ? u.value : {}) : {};
      return;
    }
    if (!('value' in u) || u.value === undefined) setPointer(this.dataModel, path, undefined);
    else setPointer(this.dataModel, path, u.value);
  };

  /* -------------------- 描画（rootゲーティング付き） -------------------- */
  A2UISurface.prototype.render = function () {
    if (this._pending) return;
    this._pending = true;
    var self = this;
    requestAnimationFrame(function () { self._pending = false; self._renderNow(); });
  };

  A2UISurface.prototype._renderNow = function () {
    // 再描画してもフォーカス・キャレットを維持する（双方向バインディング体験のため）
    var focusInfo = null;
    try {
      var ae = document.activeElement;
      if (ae && this.el.contains(ae)) {
        focusInfo = {
          ptr: ae.getAttribute('data-bindptr') || ae.getAttribute('data-fakeptr') || null,
          selS: ae.selectionStart, selE: ae.selectionEnd
        };
      }
    } catch (e) { /* noop */ }

    this.el.innerHTML = '';

    if (this.theme && this.theme.primaryColor) {
      this.el.style.setProperty('--a2ui-primary', this.theme.primaryColor);
    }
    // テーマ: エージェントの帰属表示（iconUrl / agentDisplayName）
    if (this.theme && (this.theme.agentDisplayName || this.theme.iconUrl)) {
      var head = el('div', { 'class': 'a2ui-surface-header' });
      if (this.theme.iconUrl) {
        var img = el('img', { src: this.theme.iconUrl, alt: 'agent icon' });
        img.addEventListener('error', function () { if (img.parentNode) img.remove(); });
        head.appendChild(img);
      }
      head.appendChild(el('span', { 'class': 'a2ui-agentchip' }, '🤖 ' + (this.theme.agentDisplayName || '')));
      this.el.appendChild(head);
    }

    if (this.destroyed) return;

    var root = this.components.get('root');
    if (!root) {
      this.el.appendChild(el('div', { 'class': 'a2ui-waiting' },
        '⏳ root コンポーネントを待機中…（' + this.components.size + ' 件の定義をバッファリングしています）'));
    } else {
      var node = this.renderComponent('root', null);
      if (node) this.el.appendChild(node);
    }

    // フォーカス復元
    if (focusInfo && focusInfo.ptr) {
      var target = null;
      try {
        target = this.el.querySelector('[data-bindptr="' + cssEscapeFn(focusInfo.ptr) + '"], [data-fakeptr="' + cssEscapeFn(focusInfo.ptr) + '"]');
      } catch (e) { /* noop */ }
      if (target) {
        target.focus();
        try { if (focusInfo.selS !== null && focusInfo.selS !== undefined) target.setSelectionRange(focusInfo.selS, focusInfo.selE); }
        catch (e) { /* noop */ }
      }
    }

    if (this.onRender) { try { this.onRender(this); } catch (e) { /* noop */ } }
  };

  A2UISurface.prototype.uiStateFor = function (key) {
    if (!this.uiState.has(key)) this.uiState.set(key, {});
    return this.uiState.get(key);
  };

  /* ============================================================
   * コンポーネントツリー構築（隣接リストモデル）
   * ============================================================ */
  A2UISurface.prototype.renderComponent = function (id, scope) {
    var def = this.components.get(id);
    if (!def) {
      // 参照先が未到着（プログレッシブレンダリング）または無効参照
      return el('span', { 'class': 'a2ui-missing' }, '⟨未定義コンポーネント: ' + id + '⟩');
    }
    return this.renderDef(def, scope);
  };

  /**
   * ChildList を解決し、子ノードの配列を返す。
   * - 配列形式: 固定の子IDリスト
   * - テンプレート形式: { componentId, path } — path の配列から動的に生成
   *   各アイテムごとに「コレクションスコープ」が作られ、相対パスが解決される
   */
  A2UISurface.prototype.renderChildren = function (childList, scope, applyWeight) {
    var entries = [];
    var self = this;
    if (Array.isArray(childList)) {
      for (var i = 0; i < childList.length; i++) {
        var def = this.components.get(childList[i]);
        entries.push({ def: def || { id: childList[i] }, node: this.renderComponent(childList[i], scope) });
      }
    } else if (childList && typeof childList === 'object' && typeof childList.componentId === 'string') {
      var listPtr = this.resolvePtr(childList.path || '', scope);
      var arr = getPointer(this.dataModel, listPtr);
      if (!Array.isArray(arr)) {
        entries.push({
          def: {},
          node: el('span', { 'class': 'a2ui-missing' }, '⟨リストデータ未着: ' + (childList.path || '') + '⟩')
        });
      } else {
        for (var j = 0; j < arr.length; j++) {
          var itemScope = listPtr.replace(/\/$/, '') + '/' + j;
          entries.push({
            def: this.components.get(childList.componentId) || { id: childList.componentId },
            node: this.renderComponent(childList.componentId, itemScope)
          });
        }
      }
    }
    // weight（flex-grow相当）は Row / Column の直接の子にのみ有効
    if (applyWeight) {
      entries.forEach(function (e) {
        if (e.def && e.def.weight !== undefined && e.node && e.node.style) {
          e.node.style.flexGrow = String(e.def.weight);
          e.node.style.flexBasis = '0';
        }
      });
    }
    return entries.map(function (e) { return e.node; });
  };

  /* ============================================================
   * Dynamic* プロパティの解決
   * ============================================================ */
  A2UISurface.prototype.resolvePtr = function (path, scope) {
    if (typeof path !== 'string' || path === '') return '/';
    if (path.charAt(0) === '/') return path;                 // 絶対パス
    if (scope) return scope.replace(/\/$/, '') + '/' + path; // 相対パス（コレクションスコープ）
    return '/' + path;                                       // ルートスコープでの相対
  };

  A2UISurface.prototype.resolveDynamic = function (v, scope) {
    if (v === null || v === undefined) return v;
    if (typeof v !== 'object' || Array.isArray(v)) return v;  // リテラル
    if (typeof v.path === 'string' && v.call === undefined) {
      return getPointer(this.dataModel, this.resolvePtr(v.path, scope));
    }
    if (typeof v.call === 'string') return this.callFunction(v, scope);
    return v; // リテラルオブジェクト
  };

  /** 双方向バインディング先の絶対パス（バインドされていなければ null） */
  A2UISurface.prototype.bindingPtr = function (valueSpec, scope) {
    if (valueSpec && typeof valueSpec === 'object' && !Array.isArray(valueSpec) &&
        typeof valueSpec.path === 'string' && valueSpec.call === undefined) {
      return this.resolvePtr(valueSpec.path, scope);
    }
    return null;
  };

  A2UISurface.prototype.toStr = function (v) {
    if (v === undefined || v === null) return '';
    if (typeof v === 'object') { try { return JSON.stringify(v); } catch (e) { return String(v); } }
    return String(v);
  };

  /* -------------------- 関数呼び出し -------------------- */
  A2UISurface.prototype.callFunction = function (fc, scope) {
    var args = {};
    var src = fc.args || {};
    for (var k in src) {
      if (!Object.prototype.hasOwnProperty.call(src, k)) continue;
      var av = src[k];
      if (av !== null && typeof av === 'object') {
        if (Array.isArray(av)) {
          var arr = [];
          for (var i = 0; i < av.length; i++) {
            arr.push((av[i] !== null && typeof av[i] === 'object') ? this.resolveDynamic(av[i], scope) : av[i]);
          }
          args[k] = arr;
        } else if (typeof av.call === 'string' || typeof av.path === 'string') {
          args[k] = this.resolveDynamic(av, scope);
        } else {
          args[k] = av; // リテラルオブジェクト引数
        }
      } else {
        args[k] = av;
      }
    }
    return this.invokeFunction(fc.call, args, scope);
  };

  A2UISurface.prototype.invokeFunction = function (name, args, scope) {
    var fn = window.A2UIFunctions && window.A2UIFunctions[name];
    if (!fn) return undefined;
    var self = this;
    var ctx = {
      surface: this,
      scope: scope,
      interpolate: function (s) { return self.interpolate(s, scope); },
      resolve: function (p) { return getPointer(self.dataModel, self.resolvePtr(p, scope)); },
      openUrl: this.openUrlHandler || null
    };
    return fn(args, ctx);
  };

  /* -------------------- formatString の ${} 補間 -------------------- */
  A2UISurface.prototype.interpolate = function (str, scope) {
    if (typeof str !== 'string') return str === undefined || str === null ? '' : String(str);
    var out = '';
    var i = 0;
    while (i < str.length) {
      var c = str.charAt(i);
      if (c === '\\' && str.charAt(i + 1) === '$' && str.charAt(i + 2) === '{') {
        out += '${'; i += 3; continue;   // \${ → リテラル
      }
      if (c === '$' && str.charAt(i + 1) === '{') {
        var depth = 1, j = i + 2;
        while (j < str.length && depth > 0) {
          if (str.charAt(j) === '{') depth++;
          else if (str.charAt(j) === '}') depth--;
          j++;
        }
        var inner = str.slice(i + 2, depth === 0 ? j - 1 : j);
        try { out += this.toStr(this.evalExpr(inner, scope)); }
        catch (e) { out += ''; }
        i = j; continue;
      }
      out += c; i++;
    }
    return out;
  };

  A2UISurface.prototype.evalExpr = function (expr, scope) {
    expr = expr.trim();
    if (expr === '') return '';
    var m = expr.match(/^([A-Za-z_][\w]*)\s*\(([\s\S]*)\)$/);
    if (m) {
      // 関数呼び出し（名前付き引数）
      var fname = m[1];
      var args = this.parseCallArgs(m[2], scope);
      return this.invokeFunction(fname, args, scope);
    }
    if (expr.charAt(0) === '/' || /^[A-Za-z_][\w\-\/]*$/.test(expr)) {
      // パス（絶対または相対）
      return getPointer(this.dataModel, this.resolvePtr(expr, scope));
    }
    if (/^-?\d+(\.\d+)?$/.test(expr)) return Number(expr);
    if (expr === 'true') return true;
    if (expr === 'false') return false;
    return expr.replace(/^['"]|['"]$/g, ''); // 引用符付きリテラル
  };

  A2UISurface.prototype.parseCallArgs = function (text, scope) {
    var args = {};
    var parts = splitTopLevel(text, ',');
    for (var i = 0; i < parts.length; i++) {
      var part = parts[i].trim();
      if (part === '') continue;
      var ci = indexOfTopLevel(part, ':');
      if (ci > 0) {
        var key = part.slice(0, ci).trim();
        var valText = part.slice(ci + 1).trim();
        args[key] = this.evalArgValue(valText, scope);
      }
      // 位置引数は仕様例に出てこないため省略
    }
    return args;
  };

  A2UISurface.prototype.evalArgValue = function (text, scope) {
    text = text.trim();
    if (text === '') return '';
    if (text.charAt(0) === '$' && text.charAt(1) === '{' && text.charAt(text.length - 1) === '}') {
      return this.evalExpr(text.slice(2, -1), scope);   // ネスト式
    }
    if ((text.charAt(0) === '\'' && text.charAt(text.length - 1) === '\'') ||
        (text.charAt(0) === '"' && text.charAt(text.length - 1) === '"')) {
      // 引用符付きリテラル。ただし ${…} を含む場合は補間する
      var inner = text.slice(1, -1);
      return inner.indexOf('${') >= 0 ? this.interpolate(inner, scope) : inner;
    }
    if (/^-?\d+(\.\d+)?$/.test(text)) return Number(text);
    if (text === 'true') return true;
    if (text === 'false') return false;
    return text;
  };

  function splitTopLevel(text, sep) {
    var parts = [], cur = '', depth = 0, quote = null;
    for (var i = 0; i < text.length; i++) {
      var c = text.charAt(i);
      if (quote) {
        cur += c;
        if (c === quote && text.charAt(i - 1) !== '\\') quote = null;
        continue;
      }
      if (c === '\'' || c === '"') { quote = c; cur += c; continue; }
      if (c === '(' || c === '{') depth++;
      if (c === ')' || c === '}') depth--;
      if (c === sep && depth === 0) { parts.push(cur); cur = ''; continue; }
      cur += c;
    }
    if (cur.trim() !== '') parts.push(cur);
    return parts;
  }

  function indexOfTopLevel(text, ch) {
    var depth = 0, quote = null;
    for (var i = 0; i < text.length; i++) {
      var c = text.charAt(i);
      if (quote) { if (c === quote && text.charAt(i - 1) !== '\\') quote = null; continue; }
      if (c === '\'' || c === '"') { quote = c; continue; }
      if (c === '(' || c === '{') depth++;
      if (c === ')' || c === '}') depth--;
      if (c === ch && depth === 0) return i;
    }
    return -1;
  }

  /* -------------------- checks（クライアント側検証） -------------------- */
  /** 失敗したチェックのメッセージ配列を返す。condition 形式と
   *  仕様書例の直接 FunctionCall 形式の両方を受け付ける */
  A2UISurface.prototype.evalChecks = function (def, scope) {
    var failures = [];
    var checks = def.checks || [];
    for (var i = 0; i < checks.length; i++) {
      var c = checks[i];
      if (!c || typeof c !== 'object') continue;
      var cond = (c.condition !== undefined) ? c.condition : c;
      var ok = true;
      try { ok = !!this.resolveDynamic(cond, scope); }
      catch (e) { ok = false; }
      if (!ok) failures.push(c.message || '入力値が無効です');
    }
    return failures;
  };

  /* -------------------- action 送信（client → server） -------------------- */
  A2UISurface.prototype.dispatchAction = function (actionDef, sourceId, scope) {
    if (!actionDef || typeof actionDef !== 'object') return;
    var self = this;

    if (actionDef.event && typeof actionDef.event === 'object') {
      var ev = actionDef.event;
      var context = {};
      var src = ev.context || {};
      for (var k in src) {
        if (!Object.prototype.hasOwnProperty.call(src, k)) continue;
        try { context[k] = this.resolveDynamic(src[k], scope); }
        catch (e) { context[k] = null; }
      }
      var message = {
        name: ev.name,
        surfaceId: this.surfaceId,
        sourceComponentId: sourceId,
        timestamp: new Date().toISOString(),
        context: context
      };
      var metadata = {};
      if (this.sendDataModel) {
        // sendDataModel=true の場合、action のたびにデータモデル全体を
        // トランスポートのメタデータとして送り返す
        metadata.a2uiClientDataModel = { surfaces: {} };
        metadata.a2uiClientDataModel.surfaces[this.surfaceId] = this.dataModel;
      }
      if (this.onAction) {
        try { this.onAction(message, metadata, this); } catch (e) { /* noop */ }
      }
      return;
    }

    if (actionDef.functionCall && typeof actionDef.functionCall === 'object') {
      var fc = actionDef.functionCall;
      var result;
      try { result = this.callFunction(fc, scope); }
      catch (e) { result = 'ERROR: ' + e.message; }
      var localMsg = {
        localFunctionCall: fc,
        result: result === undefined ? '(void)' : result,
        surfaceId: this.surfaceId,
        sourceComponentId: sourceId,
        timestamp: new Date().toISOString()
      };
      if (this.onAction) {
        try { this.onAction(localMsg, {}, this); } catch (e) { /* noop */ }
      }
    }
  };

  /* ============================================================
   * 各コンポーネントの描画
   * ============================================================ */
  var JUSTIFY = {
    start: 'flex-start', center: 'center', end: 'flex-end',
    spaceBetween: 'space-between', spaceAround: 'space-around',
    spaceEvenly: 'space-evenly', stretch: 'stretch'
  };
  var ALIGN = { start: 'flex-start', center: 'center', end: 'flex-end', stretch: 'stretch' };
  var FIT = { contain: 'contain', cover: 'cover', fill: 'fill', none: 'none', scaleDown: 'scale-down' };

  A2UISurface.prototype.renderDef = function (def, scope) {
    try {
      var node = this['render_' + def.component] ?
        this['render_' + def.component](def, scope) :
        el('div', { 'class': 'a2ui-error-box' }, '未対応コンポーネント: ' + def.component);
      if (node) {
        // 共通: アクセシビリティ属性
        if (def.accessibility && typeof def.accessibility === 'object' && node.setAttribute) {
          if (def.accessibility.label !== undefined) {
            node.setAttribute('aria-label', this.toStr(this.resolveDynamic(def.accessibility.label, scope)));
          }
          if (def.accessibility.description !== undefined) {
            node.setAttribute('aria-description', this.toStr(this.resolveDynamic(def.accessibility.description, scope)));
          }
        }
      }
      return node;
    } catch (e) {
      return el('div', { 'class': 'a2ui-error-box' }, '描画エラー (' + def.component + '): ' + e.message);
    }
  };

  /* ---------- 表示 ---------- */
  A2UISurface.prototype.render_Text = function (def, scope) {
    var raw = this.toStr(this.resolveDynamic(def.text, scope));
    var variant = def.variant || 'body';
    return el('div', { 'class': 'a2ui-text a2ui-text-' + variant, 'data-variant': variant },
      el('div', { html: window.A2UIMarkdown.render(raw) }));
  };

  A2UISurface.prototype.render_Image = function (def, scope) {
    var url = this.toStr(this.resolveDynamic(def.url, scope));
    var alt = this.toStr(this.resolveDynamic(def.description, scope));
    var variant = def.variant || 'mediumFeature';
    var fit = FIT[def.fit] || 'fill';
    var self = this;
    if (!url) return el('span', { 'class': 'a2ui-missing' }, '⟨画像URL未着⟩');
    var img = el('img', {
      'class': 'a2ui-img a2ui-img-' + variant, src: url, alt: alt,
      style: { objectFit: fit }
    });
    img.addEventListener('error', function () {
      var fb = el('div', { 'class': 'a2ui-media-fallback' }, '画像を読み込めませんでした（オフラインの可能性）');
      if (img.parentNode) img.parentNode.replaceChild(fb, img);
      else self._imgFallback = fb;
    });
    return img;
  };

  A2UISurface.prototype.render_Icon = function (def, scope) {
    var nameVal = def.name;
    var svg = null, label = '';
    if (typeof nameVal === 'string') {
      label = nameVal;
      svg = window.A2UIIcons.get(nameVal);
    } else if (nameVal && typeof nameVal === 'object') {
      if (typeof nameVal.svgPath === 'string') {
        svg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="' + nameVal.svgPath + '"/></svg>';
        label = 'svgPath';
      } else {
        var resolved = this.resolveDynamic(nameVal, scope);
        label = this.toStr(resolved);
        svg = window.A2UIIcons.get(label);
      }
    }
    if (!svg) svg = window.A2UIIcons.render(label); // フォールバック
    return el('span', { 'class': 'a2ui-icon', html: svg, title: label });
  };

  A2UISurface.prototype.render_Video = function (def, scope) {
    var url = this.toStr(this.resolveDynamic(def.url, scope));
    if (!url) return el('span', { 'class': 'a2ui-missing' }, '⟨動画URL未着⟩');
    var video = el('video', { 'class': 'a2ui-video', src: url, controls: true, preload: 'metadata' });
    video.addEventListener('error', function () {
      var fb = el('div', { 'class': 'a2ui-media-fallback' }, '動画を読み込めませんでした（オフラインの可能性）');
      if (video.parentNode) video.parentNode.replaceChild(fb, video);
    });
    return video;
  };

  A2UISurface.prototype.render_AudioPlayer = function (def, scope) {
    var url = this.toStr(this.resolveDynamic(def.url, scope));
    var desc = this.toStr(this.resolveDynamic(def.description, scope));
    if (!url) return el('span', { 'class': 'a2ui-missing' }, '⟨音声URL未着⟩');
    var audio = el('audio', { 'class': 'a2ui-audio', src: url, controls: true, preload: 'metadata' });
    audio.addEventListener('error', function () {
      var fb = el('div', { 'class': 'a2ui-media-fallback' }, '音声を読み込めませんでした（オフラインの可能性）');
      if (audio.parentNode) audio.parentNode.replaceChild(fb, audio);
    });
    if (!desc) return audio;
    return el('div', { 'class': 'a2ui-column', style: { gap: '6px' } },
      el('div', { 'class': 'a2ui-text a2ui-text-caption' }, desc), audio);
  };

  /* ---------- レイアウト ---------- */
  A2UISurface.prototype.render_Row = function (def, scope) {
    return el('div', {
      'class': 'a2ui-row',
      style: {
        justifyContent: JUSTIFY[def.justify || 'start'] || 'flex-start',
        alignItems: ALIGN[def.align || 'stretch'] || 'stretch'
      }
    }, this.renderChildren(def.children, scope, true));
  };

  A2UISurface.prototype.render_Column = function (def, scope) {
    return el('div', {
      'class': 'a2ui-column',
      style: {
        justifyContent: JUSTIFY[def.justify || 'start'] || 'flex-start',
        alignItems: ALIGN[def.align || 'stretch'] || 'stretch'
      }
    }, this.renderChildren(def.children, scope, true));
  };

  A2UISurface.prototype.render_List = function (def, scope) {
    var dir = def.direction === 'horizontal' ? 'horizontal' : 'vertical';
    return el('div', {
      'class': 'a2ui-list a2ui-list-' + dir,
      style: { alignItems: ALIGN[def.align || 'stretch'] || 'stretch' }
    }, this.renderChildren(def.children, scope, false));
  };

  A2UISurface.prototype.render_Card = function (def, scope) {
    return el('div', { 'class': 'a2ui-card' }, this.renderComponent(def.child, scope));
  };

  A2UISurface.prototype.render_Tabs = function (def, scope) {
    var self = this;
    var st = this.uiStateFor('tabs:' + def.id);
    if (typeof st.selectedIndex !== 'number' || st.selectedIndex < 0 ||
        st.selectedIndex >= def.tabs.length) st.selectedIndex = 0;
    var bar = el('div', { 'class': 'a2ui-tabbar' });
    def.tabs.forEach(function (t, idx) {
      var title = self.toStr(self.resolveDynamic(t.title, scope));
      bar.appendChild(el('button', {
        'class': 'a2ui-tab' + (idx === st.selectedIndex ? ' a2ui-tab-active' : ''),
        type: 'button',
        onclick: (function (i) { return function () { st.selectedIndex = i; self.render(); }; })(idx)
      }, title));
    });
    var activeTab = def.tabs[st.selectedIndex];
    var panel = el('div', { 'class': 'a2ui-tabpanel' },
      activeTab ? this.renderComponent(activeTab.child, scope) : null);
    return el('div', { 'class': 'a2ui-tabs' }, bar, panel);
  };

  A2UISurface.prototype.render_Divider = function (def) {
    var axis = def.axis === 'vertical' ? 'vertical' : 'horizontal';
    return el('div', { 'class': 'a2ui-divider a2ui-divider-' + axis, 'aria-hidden': 'true' });
  };

  A2UISurface.prototype.render_Modal = function (def, scope) {
    var self = this;
    var st = this.uiStateFor('modal:' + def.id);
    var trigger = el('span', {
      'class': 'a2ui-modal-inline',
      onclick: function () { st.open = true; self.render(); }
    }, this.renderComponent(def.trigger, scope));
    if (!st.open) return trigger;
    var overlay = null;
    function close() { st.open = false; self.render(); }
    overlay = el('div', {
      'class': 'a2ui-modal-overlay',
      onclick: function (e) { if (e.target === overlay) close(); }
    }, el('div', { 'class': 'a2ui-modal-dialog', role: 'dialog', 'aria-modal': 'true' },
      el('button', { 'class': 'a2ui-modal-close', type: 'button', 'aria-label': '閉じる', html: '✕', onclick: close }),
      this.renderComponent(def.content, scope)));
    return el('div', {}, trigger, overlay);
  };

  /* ---------- 入力 ---------- */
  A2UISurface.prototype.render_Button = function (def, scope) {
    var self = this;
    var failures = this.evalChecks(def, scope);
    return el('button', {
      'class': 'a2ui-btn a2ui-btn-' + (def.variant || 'default'),
      type: 'button',
      disabled: failures.length > 0 ? true : null,
      title: failures.length ? failures.join(' ／ ') : null,
      onclick: function () {
        if (failures.length === 0) self.dispatchAction(def.action, def.id, scope);
      }
    }, this.renderComponent(def.child, scope));
  };

  A2UISurface.prototype.render_TextField = function (def, scope) {
    var self = this;
    var variant = def.variant || 'shortText';
    var label = this.toStr(this.resolveDynamic(def.label, scope));
    var value = this.resolveDynamic(def.value, scope);
    var cur = this.toStr(value);
    var ptr = this.bindingPtr(def.value, scope);
    var st = this.uiStateFor('tf:' + def.id + (scope ? '#' + scope : ''));
    var failures = this.evalChecks(def, scope);
    var showErrors = failures.length > 0 && (st.touched || cur !== '');

    var input;
    var commonAttrs = {
      'class': variant === 'longText' ? 'a2ui-textarea' : 'a2ui-input',
      'data-bindptr': ptr || null,
      placeholder: label && !cur ? '' : null,
      'aria-label': label || null
    };
    if (variant === 'longText') {
      input = el('textarea', Object.assign({}, commonAttrs, { rows: 3 }), cur);
    } else {
      var type = variant === 'number' ? 'number' : (variant === 'obscured' ? 'password' : 'text');
      input = el('input', Object.assign({}, commonAttrs, { type: type, value: cur }));
      if (def.validationRegexp && variant === 'shortText') input.setAttribute('pattern', def.validationRegexp);
    }
    input.addEventListener('input', function () {
      if (!ptr) return;
      var v = input.value;
      setPointer(self.dataModel, ptr, variant === 'number' ? (v === '' ? '' : Number(v)) : v);
      self.render();
    });
    input.addEventListener('blur', function () {
      if (!st.touched) { st.touched = true; self.render(); }
    });

    var field = el('div', { 'class': 'a2ui-field' + (showErrors ? ' a2ui-invalid' : '') });
    if (label) field.appendChild(el('div', { 'class': 'a2ui-label' }, label));
    field.appendChild(input);
    if (showErrors) {
      failures.forEach(function (m) {
        field.appendChild(el('div', { 'class': 'a2ui-error' }, '⚠ ' + m));
      });
    }
    return field;
  };

  A2UISurface.prototype.render_CheckBox = function (def, scope) {
    var self = this;
    var label = this.toStr(this.resolveDynamic(def.label, scope));
    var checked = !!this.resolveDynamic(def.value, scope);
    var ptr = this.bindingPtr(def.value, scope);
    var box = el('input', { type: 'checkbox' });
    box.checked = checked;
    box.addEventListener('change', function () {
      if (!ptr) return;
      setPointer(self.dataModel, ptr, box.checked);
      self.render();
    });
    return el('label', { 'class': 'a2ui-checkbox' }, box, label);
  };

  A2UISurface.prototype.render_ChoicePicker = function (def, scope) {
    var self = this;
    var st = this.uiStateFor('cp:' + def.id + (scope ? '#' + scope : ''));
    var label = this.toStr(this.resolveDynamic(def.label, scope));
    var variant = def.variant || 'mutuallyExclusive';
    var displayStyle = def.displayStyle || 'checkbox';
    var filterable = !!def.filterable;
    var options = (def.options || []).map(function (o) {
      return { label: self.toStr(self.resolveDynamic(o.label, scope)), value: o.value };
    });
    var value = this.resolveDynamic(def.value, scope);
    if (!Array.isArray(value)) value = [];
    var ptr = this.bindingPtr(def.value, scope);

    function writeValue(newArr) {
      if (!ptr) return;
      setPointer(self.dataModel, ptr, newArr);
      self.render();
    }

    var wrap = el('div', { 'class': 'a2ui-field' });
    if (label) wrap.appendChild(el('div', { 'class': 'a2ui-label' }, label));

    // filterable: 選択肢をラベルの部分一致で絞り込む
    var shown = options;
    if (filterable) {
      var filter = el('input', {
        type: 'text', 'class': 'a2ui-filter',
        value: st.filter || '', placeholder: '検索…', 'data-fakeptr': 'cpfilter:' + def.id
      });
      filter.addEventListener('input', function () {
        st.filter = filter.value;
        self.render();
      });
      wrap.appendChild(filter);
      var q = (st.filter || '').toLowerCase();
      shown = options.filter(function (o) { return o.label.toLowerCase().indexOf(q) >= 0; });
    }

    if (displayStyle === 'chips') {
      // チップス（ピルボタン）スタイル
      var chips = el('div', { 'class': 'a2ui-chips' });
      shown.forEach(function (o) {
        var selected = value.indexOf(o.value) >= 0;
        chips.appendChild(el('button', {
          'class': 'a2ui-chipbtn' + (selected ? ' a2ui-chipbtn-selected' : ''),
          type: 'button',
          onclick: function () {
            if (variant === 'mutuallyExclusive') writeValue([o.value]);
            else if (selected) writeValue(value.filter(function (v) { return v !== o.value; }));
            else writeValue(value.concat([o.value]));
          }
        }, o.label));
      });
      if (!shown.length) chips.appendChild(el('span', { 'class': 'a2ui-missing' }, '⟨該当なし⟩'));
      wrap.appendChild(chips);
      return wrap;
    }

    if (variant === 'mutuallyExclusive') {
      // 排他的選択 → ドロップダウン
      var select = el('select', { 'class': 'a2ui-select', 'data-bindptr': ptr || null });
      select.appendChild(el('option', { value: '' }, '— 選択してください —'));
      shown.forEach(function (o) {
        select.appendChild(el('option', { value: o.value }, o.label));
      });
      select.value = value[0] || '';
      if (select.selectedIndex === -1) select.selectedIndex = 0;
      select.addEventListener('change', function () {
        writeValue(select.value ? [select.value] : []);
      });
      wrap.appendChild(select);
      return wrap;
    }

    // 複数選択 → チェックボックスリスト
    var list = el('div', { 'class': 'a2ui-checklist' });
    shown.forEach(function (o) {
      var selected = value.indexOf(o.value) >= 0;
      var cb = el('input', { type: 'checkbox' });
      cb.checked = selected;
      cb.addEventListener('change', function () {
        if (cb.checked) writeValue(value.concat([o.value]));
        else writeValue(value.filter(function (v) { return v !== o.value; }));
      });
      list.appendChild(el('label', { 'class': 'a2ui-checkitem' }, cb, o.label));
    });
    if (!shown.length) list.appendChild(el('span', { 'class': 'a2ui-missing' }, '⟨該当なし⟩'));
    wrap.appendChild(list);
    return wrap;
  };

  A2UISurface.prototype.render_Slider = function (def, scope) {
    var self = this;
    var label = this.toStr(this.resolveDynamic(def.label, scope));
    var min = typeof def.min === 'number' ? def.min : 0;
    var max = typeof def.max === 'number' ? def.max : 100;
    var value = Number(this.resolveDynamic(def.value, scope));
    if (!Number.isFinite(value)) value = min;
    var ptr = this.bindingPtr(def.value, scope);
    var shown = Math.round(value * 100) / 100;

    var input = el('input', {
      type: 'range', 'class': 'a2ui-slider', min: min, max: max, step: 'any',
      value: value, 'aria-label': label || null
    });
    var valueBox = el('span', { 'class': 'a2ui-slider-value' }, shown);
    input.addEventListener('input', function () {
      valueBox.textContent = input.value;
      if (ptr) {
        setPointer(self.dataModel, ptr, Number(input.value));
        self.render();
      }
    });
    var field = el('div', { 'class': 'a2ui-field' });
    if (label) field.appendChild(el('div', { 'class': 'a2ui-label' }, label));
    field.appendChild(el('div', { 'class': 'a2ui-slider-row' }, input, valueBox));
    return field;
  };

  A2UISurface.prototype.render_DateTimeInput = function (def, scope) {
    var self = this;
    var label = this.toStr(this.resolveDynamic(def.label, scope));
    var enableDate = def.enableDate !== false && def.enableDate !== undefined ? !!def.enableDate : false;
    var enableTime = !!def.enableTime;
    var ptr = this.bindingPtr(def.value, scope);
    var iso = this.toStr(this.resolveDynamic(def.value, scope));
    var failures = this.evalChecks(def, scope);
    var st = this.uiStateFor('dt:' + def.id + (scope ? '#' + scope : ''));

    var type;
    if (enableDate && enableTime) type = 'datetime-local';
    else if (enableDate) type = 'date';
    else if (enableTime) type = 'time';
    else type = 'text';

    function isoToInput(isoVal) {
      if (!isoVal) return '';
      if (type === 'date') return isoVal.slice(0, 10);
      if (type === 'time') return isoVal.length > 16 ? isoVal.slice(11, 16) : isoVal.slice(0, 5);
      return isoVal.slice(0, 16);
    }
    function inputToIso(v) {
      if (!v) return '';
      if (type === 'time') return v.length === 5 ? v + ':00' : v;
      return v;
    }

    var input = el('input', {
      type: type, 'class': 'a2ui-input', value: isoToInput(iso),
      'data-bindptr': ptr || null, 'aria-label': label || null
    });
    if (def.min) input.setAttribute('min', isoToInput(this.toStr(this.resolveDynamic(def.min, scope))));
    if (def.max) input.setAttribute('max', isoToInput(this.toStr(this.resolveDynamic(def.max, scope))));
    if (type === 'text') input.disabled = true;

    input.addEventListener('change', function () {
      if (!ptr) return;
      setPointer(self.dataModel, ptr, inputToIso(input.value));
      self.render();
    });
    input.addEventListener('blur', function () {
      if (!st.touched) { st.touched = true; self.render(); }
    });

    var field = el('div', { 'class': 'a2ui-field' + (failures.length && st.touched ? ' a2ui-invalid' : '') });
    if (label) field.appendChild(el('div', { 'class': 'a2ui-label' }, label));
    field.appendChild(input);
    if (failures.length && st.touched) {
      failures.forEach(function (m) { field.appendChild(el('div', { 'class': 'a2ui-error' }, '⚠ ' + m)); });
    }
    return field;
  };

  /* ============================================================
   * 公開API
   * ============================================================ */
  function mountSurface(container, messages, opts) {
    opts = opts || {};
    var surface = null;
    (messages || []).forEach(function (m) {
      if (m && m.createSurface) {
        surface = new A2UISurface(Object.assign({}, m.createSurface, opts));
        container.appendChild(surface.el);
      } else if (surface) {
        surface.handleMessage(m);
      }
    });
    if (!surface) {
      surface = new A2UISurface(Object.assign({ surfaceId: opts.surfaceId || 'surface' }, opts));
      container.appendChild(surface.el);
    }
    surface.render();
    return surface;
  }

  window.A2UI = {
    Surface: A2UISurface,
    mountSurface: mountSurface,
    el: el,
    getPointer: getPointer,
    setPointer: setPointer
  };
})();
