/* ============================================================
 * A2UIベーシックカタログのクライアント側「登録関数」実装
 * 仕様上、実行可能コードは送られず、名前付き関数をクライアントが呼ぶ。
 * 各関数は (args, ctx) を受け取る。
 *   ctx = { surface, scope, interpolate(str), resolve(path), openUrl(url) }
 * ============================================================ */
(function () {
  'use strict';

  function str(v) { return v === null || v === undefined ? '' : String(v); }
  function num(v) { return Number(v); }

  /* ---------- フォーマット（TR35風トークン、日本語ロケール） ---------- */
  var MONTHS = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];
  var DOW_SHORT = ['日', '月', '火', '水', '木', '金', '土'];
  var DOW_LONG = ['日曜日', '月曜日', '火曜日', '水曜日', '木曜日', '金曜日', '土曜日'];
  // 長いトークンを先にマッチさせる
  var TOKENS = ['EEEE', 'MMMM', 'yyyy', 'MMM', 'MM', 'dd', 'EE', 'yy', 'HH', 'hh', 'mm', 'ss',
                'E', 'M', 'd', 'H', 'h', 'a'];

  function pad2(n) { return (n < 10 ? '0' : '') + n; }

  function formatDateImpl(date, pattern) {
    var out = '';
    var rest = pattern;
    while (rest.length > 0) {
      var matched = false;
      for (var t = 0; t < TOKENS.length; t++) {
        var tok = TOKENS[t];
        if (rest.slice(0, tok.length) === tok) {
          out += tokenValue(date, tok);
          rest = rest.slice(tok.length);
          matched = true;
          break;
        }
      }
      if (!matched) { out += rest[0]; rest = rest.slice(1); }
    }
    return out;
  }

  function tokenValue(d, tok) {
    var h12 = d.getHours() % 12 || 12;
    switch (tok) {
      case 'yyyy': return String(d.getFullYear());
      case 'yy': return String(d.getFullYear()).slice(-2);
      case 'M': return String(d.getMonth() + 1);
      case 'MM': return pad2(d.getMonth() + 1);
      case 'MMM': return MONTHS[d.getMonth()];
      case 'MMMM': return MONTHS[d.getMonth()];
      case 'd': return String(d.getDate());
      case 'dd': return pad2(d.getDate());
      case 'E': return DOW_SHORT[d.getDay()];
      case 'EE': return DOW_SHORT[d.getDay()];
      case 'EEEE': return DOW_LONG[d.getDay()];
      case 'H': return String(d.getHours());
      case 'HH': return pad2(d.getHours());
      case 'h': return String(h12);
      case 'hh': return pad2(h12);
      case 'mm': return pad2(d.getMinutes());
      case 'ss': return pad2(d.getSeconds());
      case 'a': return d.getHours() < 12 ? '午前' : '午後';
      default: return tok;
    }
  }

  /* ---------- 関数カタログ ---------- */
  var Functions = {

    /* バリデーション（true = 有効） */
    required: function (a) {
      var v = a.value;
      return v !== null && v !== undefined && v !== '' &&
             !(Array.isArray(v) && v.length === 0);
    },

    regex: function (a) {
      try { return new RegExp(a.pattern).test(str(a.value)); }
      catch (e) { return false; }
    },

    length: function (a) {
      var l = str(a.value).length;
      if (a.min !== undefined && l < a.min) return false;
      if (a.max !== undefined && l > a.max) return false;
      return true;
    },

    numeric: function (a) {
      var n = num(a.value);
      if (Number.isNaN(n)) return false;
      if (a.min !== undefined && n < a.min) return false;
      if (a.max !== undefined && n > a.max) return false;
      return true;
    },

    email: function (a) {
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(str(a.value).trim());
    },

    /* 文字列・数値フォーマット */
    formatString: function (a, ctx) {
      return ctx.interpolate(str(a.value));
    },

    formatNumber: function (a) {
      var opt = { useGrouping: a.grouping !== false };
      if (a.decimals !== undefined) {
        opt.minimumFractionDigits = a.decimals;
        opt.maximumFractionDigits = a.decimals;
      }
      return new Intl.NumberFormat('ja-JP', opt).format(num(a.value));
    },

    formatCurrency: function (a) {
      var opt = { style: 'currency', currency: str(a.currency || 'JPY'), useGrouping: a.grouping !== false };
      if (a.decimals !== undefined) {
        opt.minimumFractionDigits = a.decimals;
        opt.maximumFractionDigits = a.decimals;
      }
      try {
        return new Intl.NumberFormat('ja-JP', opt).format(num(a.value));
      } catch (e) {
        return String(num(a.value)) + ' ' + str(a.currency);
      }
    },

    formatDate: function (a) {
      var d = a.value instanceof Date ? a.value : new Date(a.value);
      if (Number.isNaN(d.getTime())) return '';
      return formatDateImpl(d, str(a.format));
    },

    pluralize: function (a) {
      var n = num(a.value);
      var cat = 'other';                     // CLDR複数カテゴリ（簡易版）
      if (n === 0) cat = 'zero';
      else if (n === 1) cat = 'one';
      else if (n === 2) cat = 'two';
      return a[cat] !== undefined ? str(a[cat]) : str(a.other);
    },

    /* ローカルアクション */
    openUrl: function (a, ctx) {
      var url = str(a.url);
      if (ctx.openUrl) return ctx.openUrl(url);
      if (typeof window !== 'undefined') window.open(url, '_blank', 'noopener');
      return undefined; // returnType: void
    },

    /* 論理演算 */
    and: function (a) { return (a.values || []).every(Boolean); },
    or: function (a) { return (a.values || []).some(Boolean); },
    not: function (a) { return !a.value; }
  };

  window.A2UIFunctions = Functions;
  window.A2UIDateUtils = { formatDate: formatDateImpl };
})();
