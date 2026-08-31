/* ============================================================
 * Textコンポーネント用 簡易Markdownレンダラー
 * 仕様:「simple Markdown formatting is supported
 *        (i.e. without HTML, images, or links)」
 * 対応: 見出し(#〜###) / 強調(**,*) / コード(`) /
 *        箇条書き(-,*) / 順序付きリスト(1.) / 引用(>) / 水平線(---)
 * すべてのHTMLをエスケープしてから変換する（安全）。
 * パースに失敗した生文字列にはマーカーを除去してフォールバック。
 * ============================================================ */
(function () {
  'use strict';

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /** インライン要素（強調・コード） */
  function inline(s) {
    return s
      .replace(/`([^`]+)`/g, function (_, c) { return '<code>' + c + '</code>'; })
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/\*([^*]+)\*/g, '<em>$1</em>');
  }

  /**
   * Markdownテキスト → 安全なHTML文字列
   */
  function render(src) {
    if (src === null || src === undefined) return '';
    var text = String(src);
    try {
      var lines = text.replace(/\r\n?/g, '\n').split('\n');
      var html = [];
      var i = 0;

      while (i < lines.length) {
        var line = lines[i];

        // 空行
        if (/^\s*$/.test(line)) { i++; continue; }

        // 水平線
        if (/^\s*(-{3,}|\*{3,})\s*$/.test(line)) { html.push('<hr class="md-hr"/>'); i++; continue; }

        // 見出し # ## ###
        var h = line.match(/^(#{1,3})\s+(.*)$/);
        if (h) {
          var lvl = h[1].length;
          html.push('<span class="md-h' + lvl + '">' + inline(h[2].trim()) + '</span>');
          i++; continue;
        }

        // 引用 >
        if (/^\s*>\s?/.test(line)) {
          var quote = [];
          while (i < lines.length && /^\s*>\s?/.test(lines[i])) {
            quote.push(lines[i].replace(/^\s*>\s?/, ''));
            i++;
          }
          html.push('<blockquote>' + inline(quote.join(' ')) + '</blockquote>');
          continue;
        }

        // 箇条書き - / *
        if (/^\s*[-*]\s+/.test(line)) {
          var items = [];
          while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) {
            items.push('<li>' + inline(lines[i].replace(/^\s*[-*]\s+/, '')) + '</li>');
            i++;
          }
          html.push('<ul>' + items.join('') + '</ul>');
          continue;
        }

        // 順序付きリスト 1. 2. ...
        if (/^\s*\d+\.\s+/.test(line)) {
          var ol = [];
          while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
            ol.push('<li>' + inline(lines[i].replace(/^\s*\d+\.\s+/, '')) + '</li>');
            i++;
          }
          html.push('<ol>' + ol.join('') + '</ol>');
          continue;
        }

        // 段落（空行まで連結、文中の改行は <br>）
        var para = [];
        while (i < lines.length && !/^\s*$/.test(lines[i]) &&
               !/^\s*([-*]\s+|\d+\.\s+|>|#{1,3}\s)/.test(lines[i])) {
          para.push(lines[i]);
          i++;
        }
        html.push('<p>' + inline(para.join('<br>')) + '</p>');
      }
      return html.join('');
    } catch (e) {
      // フォールバック: マーカーを除去した生テキスト
      return escapeHtml(text.replace(/[*#`>]/g, ''));
    }
  }

  window.A2UIMarkdown = { render: render, escapeHtml: escapeHtml };
})();
