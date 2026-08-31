/* ============================================================
 * A2UI UIカタログ — カタログデータ
 * ------------------------------------------------------------
 * 各エントリの「A2UI JSON」はここでJSオブジェクトとして定義し、
 * 表示（JSON.stringify）とプレビュー（ミニレンダラーへの送信）の
 * 両方に同じデータを使う（単一のソース・オブ・トゥルース）。
 * ============================================================ */
(function () {
  'use strict';

  var CATALOG_ID = 'https://a2ui.org/specification/v0_9/catalogs/basic/catalog.json';

  /* ---------- メッセージ構築ヘルパー ---------- */
  function CS(surfaceId, extra) {
    return { version: 'v0.9', createSurface: Object.assign({ surfaceId: surfaceId, catalogId: CATALOG_ID }, extra || {}) };
  }
  function UC(surfaceId, components) {
    return { version: 'v0.9', updateComponents: { surfaceId: surfaceId, components: components } };
  }
  function UD(surfaceId, path, value) {
    var u = { surfaceId: surfaceId };
    if (path !== undefined) u.path = path;
    if (value !== undefined) u.value = value;
    return { version: 'v0.9', updateDataModel: u };
  }
  function DS(surfaceId) {
    return { version: 'v0.9', deleteSurface: { surfaceId: surfaceId } };
  }
  function P(path) { return { path: path }; }

  /* ============================================================
   * カタログ本体
   * ============================================================ */
  var CATALOG = [

    /* =================  はじめに  ================= */
    {
      category: 'はじめに',
      catDesc: 'A2UIの仕組みと、このカタログの読み方。',
      items: [
        {
          id: 'overview',
          title: 'A2UIとは — メッセージストリームでUIを組み立てる',
          desc: 'A2UIではエージェント（サーバー）がUIを「コード」ではなく「宣言的なJSONメッセージのストリーム」として送ります。クライアントは到着したメッセージを順に処理し、自分の持つネイティブコンポーネントで安全に描画します（エージェント生成のコードは一切実行しません）。',
          docHtml: '' +
            '<h4>サーバー → クライアント（UIストリーム）</h4>' +
            '<table><tr><th>メッセージ型</th><th>役割</th></tr>' +
            '<tr><td><code>createSurface</code></td><td>UI領域（サーフェス）を作成。<code>surfaceId</code>・<code>catalogId</code>・任意の <code>theme</code>・<code>sendDataModel</code> を指定</td></tr>' +
            '<tr><td><code>updateComponents</code></td><td>コンポーネント定義の<strong>フラットな配列</strong>を送る。親子関係はID参照（隣接リスト形式）で表現</td></tr>' +
            '<tr><td><code>updateDataModel</code></td><td>JSON Pointer（<code>/user/name</code> など）でデータをupsert。サーバーはUI構造を再送せずに内容だけ変えられる</td></tr>' +
            '<tr><td><code>deleteSurface</code></td><td>サーフェスと、そのコンポーネント・データをすべて破棄</td></tr></table>' +
            '<h4>クライアント → サーバー（ユーザー操作）</h4>' +
            '<table><tr><th>メッセージ型</th><th>役割</th></tr>' +
            '<tr><td><code>action</code></td><td>ボタン押下などで送信。<code>name</code> / <code>surfaceId</code> / <code>sourceComponentId</code> / <code>timestamp</code> / <code>context</code> を持つ</td></tr>' +
            '<tr><td><code>error</code></td><td>クライアント側の問題を報告。LLMの自己修正ループ用に <code>VALIDATION_FAILED</code> 標準形式がある</td></tr></table>' +
            '<p>トランスポートは自由（A2A / AG-UI / MCP / SSE / WebSocket / REST）。このカタログの各プレビューも、実際にこのメッセージ列を送って描画しています。</p>' +
            '<p>仕様: <a href="https://github.com/a2ui-project/a2ui" target="_blank" rel="noopener noreferrer">a2ui-project/a2ui</a>（Apache-2.0） / 公式レンダラー: React・Lit・Angular・Flutter など</p>'
        },
        {
          id: 'common',
          title: '共通の型とプロパティ',
          desc: 'すべてのコンポーネントで共通のプロパティと、A2UIの中核となるデータ型です。各コンポーネントのプロパティ表では、これらの共通項目は省略しています。',
          docHtml: '' +
            '<h4>コンポーネント共通プロパティ</h4>' +
            '<table><tr><th>プロパティ</th><th>型</th><th>必須</th><th>説明</th></tr>' +
            '<tr><td><code>id</code></td><td>ComponentId（string）</td><td>◎</td><td>コンポーネントの一意なID。親からの参照・ツリー構築に使う。rootのみ <code>id: "root"</code> が必須</td></tr>' +
            '<tr><td><code>component</code></td><td>string</td><td>◎</td><td>コンポーネントの型名（例: <code>"Text"</code>）</td></tr>' +
            '<tr><td><code>accessibility.label</code></td><td>DynamicString</td><td>−</td><td>支援技術向けの短いラベル（1〜3語）</td></tr>' +
            '<tr><td><code>accessibility.description</code></td><td>DynamicString</td><td>−</td><td>支援技術向けの補足説明</td></tr>' +
            '<tr><td><code>weight</code></td><td>number</td><td>−</td><td>Row / Column の<strong>直下の子</strong>のみ有効。flex-grow相当の伸び方（グリッド分割に使用）</td></tr></table>' +
            '<h4>Dynamic*（動的プロパティ型）</h4>' +
            '<p><code>text</code> や <code>value</code> などバインド可能なプロパティは、次の3形式のいずれも受け付けます:</p>' +
            '<table><tr><th>形式</th><th>例</th><th>意味</th></tr>' +
            '<tr><td>リテラル</td><td><code>"こんにちは"</code></td><td>固定値</td></tr>' +
            '<tr><td>データバインディング</td><td><code>{ "path": "/user/name" }</code></td><td>データモデルのJSON Pointer。<code>/</code> 始まりは絶対パス、それ以外はコレクションテンプレート内の相対パス</td></tr>' +
            '<tr><td>関数呼び出し</td><td><code>{ "call": "formatString", "args": {…} }</code></td><td>クライアント側の登録関数を実行した結果</td></tr></table>' +
            '<h4>ChildList（子の指定）</h4>' +
            '<table><tr><th>形式</th><th>例</th><th>意味</th></tr>' +
            '<tr><td>固定配列</td><td><code>["title", "button"]</code></td><td>子コンポーネントIDの静的なリスト</td></tr>' +
            '<tr><td>テンプレート</td><td><code>{ "path": "/items", "componentId": "item_card" }</code></td><td>path の配列データから子を動的に生成（各要素が1つのスコープになる）</td></tr></table>' +
            '<h4>Action（操作の定義）</h4>' +
            '<table><tr><th>形式</th><th>例</th><th>意味</th></tr>' +
            '<tr><td>サーバーイベント</td><td><code>{ "event": { "name": "submit", "context": {…} } }</code></td><td>クライアント→サーバーへ <code>action</code> メッセージを送信</td></tr>' +
            '<tr><td>ローカル関数</td><td><code>{ "functionCall": { "call": "openUrl", "args": {…} } }</code></td><td>クライアント側の関数を実行（例: URLを開く）</td></tr></table>' +
            '<h4>CheckRule（クライアント側検証）</h4>' +
            '<p><code>{ "condition": <em>DynamicBoolean</em>, "message": "エラー文" }</code> — condition が false のときメッセージを表示。TextFieldではエラー表示、Buttonでは<strong>自動的にボタンが無効化</strong>されます。</p>'
        },
        {
          id: 'stream',
          title: '完全なストリーム例 — 問い合わせフォームを1メッセージずつ送る',
          desc: '仕様書に掲載されているコンタクトフォームのストリーム例（日本語化）です。「次のメッセージを送信」ボタンで、クライアントがメッセージを1通ずつ処理してUIが組み上がる様子を確認できます。フォームへの入力や「送信する」ボタン押下時の action イベントも確認できます。',
          stream: [
            CS('contact_form_1'),
            UC('contact_form_1', [
              { id: 'root', component: 'Card', child: 'form_container' },
              { id: 'form_container', component: 'Column', children: ['header_row', 'name_row', 'email_group', 'divider_1', 'newsletter_checkbox', 'submit_button'], justify: 'start', align: 'stretch' },
              { id: 'header_row', component: 'Row', children: ['header_icon', 'header_text'], align: 'center' },
              { id: 'header_icon', component: 'Icon', name: 'mail' },
              { id: 'header_text', component: 'Text', text: 'お問い合わせ', variant: 'h2' },
              { id: 'name_row', component: 'Row', children: ['first_name_group', 'last_name_group'], justify: 'spaceBetween' },
              { id: 'first_name_group', component: 'Column', children: ['first_name_label', 'first_name_field'], weight: 1 },
              { id: 'first_name_label', component: 'Text', text: '名', variant: 'caption' },
              { id: 'first_name_field', component: 'TextField', label: '名', value: P('/contact/firstName'), variant: 'shortText' },
              { id: 'last_name_group', component: 'Column', children: ['last_name_label', 'last_name_field'], weight: 1 },
              { id: 'last_name_label', component: 'Text', text: '姓', variant: 'caption' },
              { id: 'last_name_field', component: 'TextField', label: '姓', value: P('/contact/lastName'), variant: 'shortText' },
              { id: 'email_group', component: 'Column', children: ['email_label', 'email_field'] },
              { id: 'email_label', component: 'Text', text: 'メールアドレス', variant: 'caption' },
              { id: 'email_field', component: 'TextField', label: 'メールアドレス', value: P('/contact/email'), variant: 'shortText', checks: [
                { condition: { call: 'required', args: { value: P('/contact/email') } }, message: 'メールアドレスは必須です。' },
                { condition: { call: 'email', args: { value: P('/contact/email') } }, message: '有効なメールアドレスを入力してください。' }
              ] },
              { id: 'divider_1', component: 'Divider', axis: 'horizontal' },
              { id: 'newsletter_checkbox', component: 'CheckBox', label: 'ニュースレターを購読する', value: P('/contact/subscribe') },
              { id: 'submit_button_label', component: 'Text', text: '送信する' },
              { id: 'submit_button', component: 'Button', child: 'submit_button_label', variant: 'primary', action: { event: { name: 'submitContactForm', context: { formId: 'contact_form_1', isNewsletterSubscribed: P('/contact/subscribe') } } } }
            ]),
            UD('contact_form_1', '/contact', { firstName: '太郎', lastName: '山田', email: 'taro.yamada@example.com', subscribe: true }),
            DS('contact_form_1')
          ],
          openEventLog: true,
          note: '最後の deleteSurface でサーフェスごと破棄されます。このようにUIのライフサイクル全体がメッセージで制御されます。'
        }
      ]
    },

    /* =================  レイアウト  ================= */
    {
      category: 'レイアウト',
      catDesc: '構造を作るコンテナコンポーネント。UIのツリーは、これらのID参照の連結で表現されます。',
      items: [
        {
          id: 'row',
          title: 'Row — 横並びコンテナ',
          badge: 'component: "Row"',
          desc: '子を横方向（主軸）に並べるコンテナです。justify で主軸の配置、align で交差軸（縦方向）の配置を指定します。子の weight を使うと横幅を比率で分割できます。',
          props: [
            { n: 'children', t: 'ChildList', r: true, d: '子コンポーネントIDの配列、またはテンプレートオブジェクト' },
            { n: 'justify', t: 'start | center | end | spaceBetween | spaceAround | spaceEvenly | stretch', v: 'start', d: '主軸（横）方向の配置' },
            { n: 'align', t: 'start | center | end | stretch', v: 'stretch', d: '交差軸（縦）方向の配置' }
          ],
          messages: [
            CS('demo_row'),
            UC('demo_row', [
              { id: 'root', component: 'Column', children: ['weather_row', 'center_row', 'weight_row'] },
              { id: 'weather_row', component: 'Row', children: ['place_group', 'temp_text'], justify: 'spaceBetween', align: 'center' },
              { id: 'place_group', component: 'Row', children: ['place_icon', 'place_text'], align: 'center' },
              { id: 'place_icon', component: 'Icon', name: 'locationOn' },
              { id: 'place_text', component: 'Text', text: '東京都 千代田区' },
              { id: 'temp_text', component: 'Text', text: '28°C', variant: 'h4' },
              { id: 'center_row', component: 'Row', children: ['center_hint'], justify: 'center' },
              { id: 'center_hint', component: 'Text', text: 'この行は justify: center（中央寄せ）です', variant: 'caption' },
              { id: 'weight_row', component: 'Row', children: ['weight_card_1', 'weight_card_2'], justify: 'start' },
              { id: 'weight_card_1', component: 'Card', child: 'weight_text_1', weight: 1 },
              { id: 'weight_text_1', component: 'Text', text: 'weight: 1', variant: 'caption' },
              { id: 'weight_card_2', component: 'Card', child: 'weight_text_2', weight: 2 },
              { id: 'weight_text_2', component: 'Text', text: 'weight: 2（2倍の幅）', variant: 'caption' }
            ])
          ],
          note: 'weight は Row / Column の直下の子のみに指定できます（flex-grow 相当）。下のカード行で 1 : 2 に分割されているのが分かります。'
        },
        {
          id: 'column',
          title: 'Column — 縦積みコンテナ',
          badge: 'component: "Column"',
          desc: '子を縦方向に積むコンテナです。justify で主軸（縦）の配置、align で交差軸（横）の配置を指定します。Row と組み合わせてグリッドを作れます。',
          props: [
            { n: 'children', t: 'ChildList', r: true, d: '子コンポーネントIDの配列、またはテンプレートオブジェクト' },
            { n: 'justify', t: 'start | center | end | spaceBetween | …', v: 'start', d: '主軸（縦）方向の配置。spaceBetween は高さが確定したレイアウトでヘッダー/フッターを両端に寄せるのに使う' },
            { n: 'align', t: 'start | center | end | stretch', v: 'stretch', d: '交差軸（横）方向の配置' }
          ],
          messages: [
            CS('demo_column'),
            UC('demo_column', [
              { id: 'root', component: 'Row', children: ['col_start', 'col_center', 'col_end'], align: 'start' },
              { id: 'col_start', component: 'Column', children: ['cs_label', 'cs_1', 'cs_2'], align: 'start', weight: 1 },
              { id: 'cs_label', component: 'Text', text: 'align: start', variant: 'caption' },
              { id: 'cs_1', component: 'Card', child: 'cs_1_text' },
              { id: 'cs_1_text', component: 'Text', text: '左寄せの子' },
              { id: 'cs_2', component: 'Card', child: 'cs_2_text' },
              { id: 'cs_2_text', component: 'Text', text: '左寄せの子' },
              { id: 'col_center', component: 'Column', children: ['cc_label', 'cc_1'], align: 'center', weight: 1 },
              { id: 'cc_label', component: 'Text', text: 'align: center', variant: 'caption' },
              { id: 'cc_1', component: 'Card', child: 'cc_1_text' },
              { id: 'cc_1_text', component: 'Text', text: '中央寄せの子' },
              { id: 'col_end', component: 'Column', children: ['ce_label', 'ce_1'], align: 'end', weight: 1 },
              { id: 'ce_label', component: 'Text', text: 'align: end', variant: 'caption' },
              { id: 'ce_1', component: 'Card', child: 'ce_1_text' },
              { id: 'ce_1_text', component: 'Text', text: '右寄せの子' }
            ])
          ],
          note: 'justify の spaceBetween は、画面全体など高さが確定するコンテナで header を上部・ボタンを下部に配置したい場合に便利です（このプレビューは高さ自動のため割愛）。'
        },
        {
          id: 'list',
          title: 'List — スクロール可能なリスト',
          badge: 'component: "List"',
          desc: 'スクロール可能なリストコンテナです。direction で縦・横を切り替えます。大量データはテンプレート（ChildListのオブジェクト形式）でデータモデルから生成します（詳細は「データ連携」カテゴリ）。',
          props: [
            { n: 'children', t: 'ChildList', r: true, d: '子ID配列またはテンプレート' },
            { n: 'direction', t: 'vertical | horizontal', v: 'vertical', d: 'リストの向き。horizontal はスクロールバーを隠し子の幅を制限するのが推奨' },
            { n: 'align', t: 'start | center | end | stretch', v: 'stretch', d: '交差軸方向の配置' }
          ],
          messages: [
            CS('demo_list'),
            UC('demo_list', [
              { id: 'root', component: 'Column', children: ['menu_list', 'h_label', 'tag_list'] },
              { id: 'menu_list', component: 'List', children: ['m1', 'm2', 'm3'], direction: 'vertical' },
              { id: 'm1', component: 'Card', child: 'm1c' },
              { id: 'm1c', component: 'Row', children: ['m1i', 'm1t', 'm1p'], align: 'center' },
              { id: 'm1i', component: 'Icon', name: 'favorite' },
              { id: 'm1t', component: 'Text', text: '特製ラーメン', weight: 1 },
              { id: 'm1p', component: 'Text', text: '¥950' },
              { id: 'm2', component: 'Card', child: 'm2c' },
              { id: 'm2c', component: 'Row', children: ['m2i', 'm2t', 'm2p'], align: 'center' },
              { id: 'm2i', component: 'Icon', name: 'star' },
              { id: 'm2t', component: 'Text', text: '餃子（5個）', weight: 1 },
              { id: 'm2p', component: 'Text', text: '¥350' },
              { id: 'm3', component: 'Card', child: 'm3c' },
              { id: 'm3c', component: 'Row', children: ['m3i', 'm3t', 'm3p'], align: 'center' },
              { id: 'm3i', component: 'Icon', name: 'check' },
              { id: 'm3t', component: 'Text', text: '平日ランチセット', weight: 1 },
              { id: 'm3p', component: 'Text', text: '¥1,200' },
              { id: 'h_label', component: 'Text', text: 'direction: horizontal の例', variant: 'caption' },
              { id: 'tag_list', component: 'List', children: ['t1', 't2', 't3', 't4'], direction: 'horizontal' },
              { id: 't1', component: 'Card', child: 't1t' },
              { id: 't1t', component: 'Text', text: '🍜 麺類', variant: 'caption' },
              { id: 't2', component: 'Card', child: 't2t' },
              { id: 't2t', component: 'Text', text: '🥟 点心', variant: 'caption' },
              { id: 't3', component: 'Card', child: 't3t' },
              { id: 't3t', component: 'Text', text: '☕ ドリンク', variant: 'caption' },
              { id: 't4', component: 'Card', child: 't4t' },
              { id: 't4t', component: 'Text', text: '🍚 定食', variant: 'caption' }
            ])
          ],
          note: '縦リストは maxHeight がありスクロールします（実装ガイドの推奨）。横リストはスクロールバーを表示しないのが推奨スタイルです。'
        },
        {
          id: 'card',
          title: 'Card — カード状のコンテナ',
          badge: 'component: "Card"',
          desc: 'カード風の枠で包むコンテナです。子は<strong>ちょうど1つ</strong>だけ（child プロパティ）。複数要素を入れたい場合は Column / Row で包んでから渡します。角丸・影・16dp程度のパディングが推奨スタイルです。',
          props: [
            { n: 'child', t: 'ComponentId', r: true, d: '単一の子コンポーネントID。複数要素は Column/Row でラップする' }
          ],
          messages: [
            CS('demo_card'),
            UC('demo_card', [
              { id: 'root', component: 'Column', children: ['profile_card'] },
              { id: 'profile_card', component: 'Card', child: 'profile_col' },
              { id: 'profile_col', component: 'Column', children: ['profile_row', 'profile_divider', 'profile_bio'] },
              { id: 'profile_row', component: 'Row', children: ['avatar', 'name_col'], align: 'center' },
              { id: 'avatar', component: 'Image', url: 'https://picsum.photos/seed/a2ui-face/80/80', variant: 'avatar', description: 'プロフィール写真' },
              { id: 'name_col', component: 'Column', children: ['name_text', 'role_text'] },
              { id: 'name_text', component: 'Text', text: '山田 太郎', variant: 'h4' },
              { id: 'role_text', component: 'Text', text: 'シニアエンジニア · 東京', variant: 'caption' },
              { id: 'profile_divider', component: 'Divider', axis: 'horizontal' },
              { id: 'profile_bio', component: 'Text', text: 'エージェントUIとフロントエンドの設計が専門です。A2UIを使ったデータ駆動UIを研究中。' }
            ])
          ],
          note: '実装ガイドでは、Cardのネスト時に背景が重ならないよう「透明な背景 + 1dpのアウトライン」スタイルが推奨されています。'
        },
        {
          id: 'tabs',
          title: 'Tabs — タブ切替',
          badge: 'component: "Tabs"',
          desc: 'タブバーと、タブごとのコンテンツを切り替えるコンポーネントです。選択状態（selectedIndex）はクライアントのローカル状態で、デフォルトは0番タブ。アクティブなタブのコンテンツのみが描画されます。',
          props: [
            { n: 'tabs', t: 'Array of { title: DynamicString, child: ComponentId }', r: true, d: 'タブ定義の配列（1つ以上）。title はデータバインド可能' }
          ],
          messages: [
            CS('demo_tabs'),
            UC('demo_tabs', [
              { id: 'root', component: 'Column', children: ['tabs'] },
              { id: 'tabs', component: 'Tabs', tabs: [
                { title: '概要', child: 'tab_overview' },
                { title: '機能', child: 'tab_features' },
                { title: 'レビュー', child: 'tab_reviews' }
              ] },
              { id: 'tab_overview', component: 'Text', text: 'A2UIは、エージェントが**宣言的なJSON**でUIを送るためのオープン標準です。\n\nクライアントはネイティブコンポーネントで描画するため、**安全**で高速です。' },
              { id: 'tab_features', component: 'Text', text: '- プログレッシブレンダリング\n- データとUI構造の分離\n- クライアント側関数による検証\n- テーマ対応' },
              { id: 'tab_reviews', component: 'Card', child: 'review_col' },
              { id: 'review_col', component: 'Column', children: ['review_row', 'review_text'] },
              { id: 'review_row', component: 'Row', children: ['star1', 'star2', 'star3', 'star4', 'star5'] },
              { id: 'star1', component: 'Icon', name: 'star' },
              { id: 'star2', component: 'Icon', name: 'star' },
              { id: 'star3', component: 'Icon', name: 'star' },
              { id: 'star4', component: 'Icon', name: 'star' },
              { id: 'star5', component: 'Icon', name: 'starHalf' },
              { id: 'review_text', component: 'Text', text: '「ストリーミングでUIが組み上がるのが面白い」— 匿名', variant: 'caption' }
            ])
          ],
          note: 'タブの切替はクライアント内で完結し、サーバーへの通信は発生しません。'
        },
        {
          id: 'divider',
          title: 'Divider — 区切り線',
          badge: 'component: "Divider"',
          desc: '水平または垂直の区切り線です。axis で向きを指定します。',
          props: [
            { n: 'axis', t: 'horizontal | vertical', v: 'horizontal', d: 'horizontal は全幅・1dp、vertical はコンテナの高さに合わせて伸びる' }
          ],
          messages: [
            CS('demo_divider'),
            UC('demo_divider', [
              { id: 'root', component: 'Column', children: ['sec_a', 'h_div', 'vs_row'] },
              { id: 'sec_a', component: 'Text', text: 'セクション A — 見出しや本文のまとまりの区切りに使います。' },
              { id: 'h_div', component: 'Divider', axis: 'horizontal' },
              { id: 'vs_row', component: 'Row', children: ['vs_1', 'vs_div', 'vs_2'], align: 'center' },
              { id: 'vs_1', component: 'Text', text: '左の項目' },
              { id: 'vs_div', component: 'Divider', axis: 'vertical' },
              { id: 'vs_2', component: 'Text', text: '右の項目' }
            ])
          ]
        },
        {
          id: 'modal',
          title: 'Modal — ダイアログ',
          badge: 'component: "Modal"',
          desc: '2つの子を持ちます。trigger（通常はButton）は常に表示され、タップすると content がダイアログとして開きます。閉じる手段の提供は必須です。デスクトップでは中央ポップアップ＋暗転背景、モバイルではボトムシートにするのが推奨スタイルです。',
          props: [
            { n: 'trigger', t: 'ComponentId', r: true, d: 'ダイアログを開くコンポーネントのID（例: Button）' },
            { n: 'content', t: 'ComponentId', r: true, d: 'ダイアログ内に表示するコンポーネントのID（複数要素はColumnでラップ）' }
          ],
          messages: [
            CS('demo_modal'),
            UC('demo_modal', [
              { id: 'root', component: 'Column', children: ['lead', 'modal'] },
              { id: 'lead', component: 'Text', text: '削除のような破壊的操作は、確認ダイアログを挟むのが定石です。' },
              { id: 'modal', component: 'Modal', trigger: 'open_button', content: 'dialog_col' },
              { id: 'open_label', component: 'Text', text: '削除ダイアログを開く' },
              { id: 'open_button', component: 'Button', child: 'open_label', action: { event: { name: 'openDeleteDialog' } } },
              { id: 'dialog_col', component: 'Column', children: ['dlg_title', 'dlg_text', 'dlg_buttons'] },
              { id: 'dlg_title', component: 'Text', text: 'プロジェクトを削除しますか？', variant: 'h4' },
              { id: 'dlg_text', component: 'Text', text: 'この操作は取り消せません。すべてのファイルが完全に削除されます。', variant: 'caption' },
              { id: 'dlg_buttons', component: 'Row', children: ['cancel_button', 'delete_button'], justify: 'end' },
              { id: 'cancel_label', component: 'Text', text: 'キャンセル' },
              { id: 'cancel_button', component: 'Button', child: 'cancel_label', variant: 'borderless', action: { event: { name: 'cancelDelete' } } },
              { id: 'delete_label', component: 'Text', text: '削除する' },
              { id: 'delete_button', component: 'Button', child: 'delete_label', variant: 'primary', action: { event: { name: 'confirmDelete', context: { projectId: 'proj-42' } } } }
            ])
          ],
          openEventLog: true,
          note: 'trigger のタップでダイアログが開きます（triggerがButtonの場合は action も同時に送信されます）。背景クリックまたは ✕ で閉じます。'
        }
      ]
    },

    /* =================  表示  ================= */
    {
      category: '表示',
      catDesc: 'コンテンツを表示するコンポーネント。多くのプロパティは Dynamic* としてデータバインドできます。',
      items: [
        {
          id: 'text',
          title: 'Text — テキスト（Markdown対応）',
          badge: 'component: "Text"',
          desc: 'テキストを表示します。variant で基本的なスタイルを指定でき、text は簡単なMarkdown（HTML・画像・リンクを除く）を解釈します。',
          props: [
            { n: 'text', t: 'DynamicString', r: true, d: '表示するテキスト。リテラル / {path} / formatStringなどの関数呼び出しが可能' },
            { n: 'variant', t: 'h1 | h2 | h3 | h4 | h5 | caption | body', v: 'body', d: 'ベースとなるテキストスタイルのヒント（h1=2.5倍 … caption=0.8倍）' }
          ],
          messages: [
            CS('demo_text'),
            UC('demo_text', [
              { id: 'root', component: 'Column', children: ['t_h1', 't_h2', 't_h3', 't_caption', 't_body', 't_md'] },
              { id: 't_h1', component: 'Text', text: '見出し1 (h1)', variant: 'h1' },
              { id: 't_h2', component: 'Text', text: '見出し2 (h2)', variant: 'h2' },
              { id: 't_h3', component: 'Text', text: '見出し3 (h3)', variant: 'h3' },
              { id: 't_caption', component: 'Text', text: 'キャプション (caption) — 補足情報に使います', variant: 'caption' },
              { id: 't_body', component: 'Text', text: '本文 (body)。長いテキストは自動的に折り返されます。日本語のテキストでも問題なく表示できます。' },
              { id: 't_md', component: 'Text', text: '**太字**と*斜体*と `コード` が使えます。\n- 箇条書きアイテム\n- 箇条書きアイテム2\n> 引用行もサポートします。' }
            ])
          ],
          note: 'リッチな表現はMarkdownよりも専用コンポーネント（Image・Icon等）の組み合わせが推奨されます（仕様上のガイダンス）。'
        },
        {
          id: 'image',
          title: 'Image — 画像',
          badge: 'component: "Image"',
          desc: 'URLから画像を表示します。variant でサイズ・形状のヒント、fit でリサイズ方法を指定します。',
          props: [
            { n: 'url', t: 'DynamicString', r: true, d: '画像のURL' },
            { n: 'description', t: 'DynamicString', r: false, d: '代替テキスト（アクセシビリティ）' },
            { n: 'fit', t: 'contain | cover | fill | none | scaleDown', v: 'fill', d: 'CSS object-fit 相当のリサイズ指定' },
            { n: 'variant', t: 'icon | avatar | smallFeature | mediumFeature | largeFeature | header', v: 'mediumFeature', d: 'サイズ/スタイルのヒント（icon=24dp、avatar=40dp円形、header=全幅バナー）' }
          ],
          messages: [
            CS('demo_image'),
            UC('demo_image', [
              { id: 'root', component: 'Column', children: ['top_row', 'medium_img', 'header_img'] },
              { id: 'top_row', component: 'Row', children: ['avatar_img', 'small_img'], align: 'end' },
              { id: 'avatar_img', component: 'Image', url: 'https://picsum.photos/seed/a2ui-face/80/80', variant: 'avatar', description: 'プロフィール画像' },
              { id: 'small_img', component: 'Image', url: 'https://picsum.photos/seed/a2ui-thumb/200/200', variant: 'smallFeature', fit: 'cover' },
              { id: 'medium_img', component: 'Image', url: 'https://picsum.photos/seed/a2ui-view/400/240', variant: 'mediumFeature', fit: 'cover', description: '風景写真' },
              { id: 'header_img', component: 'Image', url: 'https://picsum.photos/seed/a2ui-header/900/260', variant: 'header', fit: 'cover' }
            ])
          ],
          note: '画像の読み込みに失敗した場合（オフライン時など）はフォールバックを表示します。'
        },
        {
          id: 'icon',
          title: 'Icon — アイコン',
          badge: 'component: "Icon"',
          desc: 'システム定義のアイコンを名前で表示します（24dp・テキスト色を継承）。ベーシックカタログでは58種の名前が定義されています。このプレビューはリストテンプレートでデータモデルからアイコン列を生成しています。',
          props: [
            { n: 'name', t: 'string（58種の定義名） | { svgPath } | { path }', r: true, d: 'アイコン名（例: "home"）。独自SVGパスやデータバインドも可能' }
          ],
          messages: [
            CS('demo_icon'),
            UC('demo_icon', [
              { id: 'root', component: 'Column', children: ['icon_list', 'icon_hint'] },
              { id: 'icon_list', component: 'List', children: { path: '/icons', componentId: 'icon_row' }, direction: 'horizontal' },
              { id: 'icon_row', component: 'Column', children: ['the_icon', 'icon_label'], align: 'center' },
              { id: 'the_icon', component: 'Icon', name: P('name') },
              { id: 'icon_label', component: 'Text', text: P('label'), variant: 'caption' },
              { id: 'icon_hint', component: 'Text', text: '↑ データモデル /icons からテンプレート生成（下のボタンでデータを差し替え）', variant: 'caption' }
            ]),
            UD('demo_icon', '/', {
              icons: [
                { name: 'home', label: 'home' }, { name: 'search', label: 'search' },
                { name: 'settings', label: 'settings' }, { name: 'person', label: 'person' },
                { name: 'notifications', label: 'notifications' }, { name: 'favorite', label: 'favorite' },
                { name: 'shoppingCart', label: 'shoppingCart' }, { name: 'mail', label: 'mail' }
              ]
            })
          ],
          extraControls: [
            { label: 'メディア系アイコンに差し替え', message: UD('demo_icon', '/icons', [
              { name: 'play', label: 'play' }, { name: 'pause', label: 'pause' },
              { name: 'skipNext', label: 'skipNext' }, { name: 'volumeUp', label: 'volumeUp' },
              { name: 'download', label: 'download' }, { name: 'share', label: 'share' },
              { name: 'camera', label: 'camera' }, { name: 'photo', label: 'photo' }
            ]) },
            { label: 'ナビ系に戻す', message: UD('demo_icon', '/icons', [
              { name: 'home', label: 'home' }, { name: 'search', label: 'search' },
              { name: 'settings', label: 'settings' }, { name: 'person', label: 'person' },
              { name: 'notifications', label: 'notifications' }, { name: 'favorite', label: 'favorite' },
              { name: 'shoppingCart', label: 'shoppingCart' }, { name: 'mail', label: 'mail' }
            ]) }
          ],
          note: '定義名: accountCircle, add, arrowBack, arrowForward, attachFile, calendarToday, call, camera, check, close, delete, download, edit, event, error, fastForward, favorite, favoriteOff, folder, help, home, info, locationOn, lock, lockOpen, mail, menu, moreVert, moreHoriz, notifications, notificationsOff, pause, payment, person, phone, photo, play, print, refresh, rewind, search, send, settings, share, shoppingCart, skipNext, skipPrevious, star, starHalf, starOff, stop, upload, visibility, visibilityOff, volumeDown, volumeMute, volumeOff, volumeUp, warning'
        },
        {
          id: 'video',
          title: 'Video — 動画',
          badge: 'component: "Video"',
          desc: 'URLから動画を表示します。ネイティブのプレイヤーコントロール（再生・シーク等）を持ちます。',
          props: [
            { n: 'url', t: 'DynamicString', r: true, d: '動画のURL' }
          ],
          messages: [
            CS('demo_video'),
            UC('demo_video', [
              { id: 'root', component: 'Column', children: ['video', 'caption'] },
              { id: 'video', component: 'Video', url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4' },
              { id: 'caption', component: 'Text', text: 'Google提供のサンプル動画（再生にはネット接続が必要です）', variant: 'caption' }
            ])
          ]
        },
        {
          id: 'audio',
          title: 'AudioPlayer — 音声プレイヤー',
          badge: 'component: "AudioPlayer"',
          desc: 'URLから音声を再生するプレイヤーです。description でタイトルなどの説明テキストを表示できます。',
          props: [
            { n: 'url', t: 'DynamicString', r: true, d: '音声のURL' },
            { n: 'description', t: 'DynamicString', r: false, d: 'タイトル・概要などの説明' }
          ],
          messages: [
            CS('demo_audio'),
            UC('demo_audio', [
              { id: 'root', component: 'Column', children: ['player', 'caption'] },
              { id: 'player', component: 'AudioPlayer', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3', description: 'SoundHelix Song 1 — サンプル音源' },
              { id: 'caption', component: 'Text', text: '再生にはネット接続が必要です', variant: 'caption' }
            ])
          ]
        }
      ]
    },

    /* =================  入力  ================= */
    {
      category: '入力',
      catDesc: 'ユーザー入力を受け付けるコンポーネント。value は双方向バインディングで、入力するたびにクライアント内のデータモデルへ即時反映されます（サーバーへ送られるのは action 発火時のみ）。',
      items: [
        {
          id: 'button',
          title: 'Button — ボタン',
          badge: 'component: "Button"',
          desc: 'タップで action を送信するボタンです。ラベルは子コンポーネント（通常はText）として渡します。checks を付けると、条件を満たさない間は自動的に無効化されます。',
          props: [
            { n: 'child', t: 'ComponentId', r: true, d: '子コンポーネントのID。ラベル付きボタンにはText、要件がある場合のみIcon' },
            { n: 'action', t: 'Action', r: true, d: '{ event: { name, context } }（サーバーへ送信）または { functionCall: {...} }（ローカル実行）' },
            { n: 'variant', t: 'default | primary | borderless', v: 'default', d: 'primary=主要アクション（テーマ色）、borderless=枠なし（リンク風）' },
            { n: 'checks', t: 'Array of CheckRule', r: false, d: '1つでも失敗するとボタンが無効化される' }
          ],
          messages: [
            CS('demo_button'),
            UC('demo_button', [
              { id: 'root', component: 'Column', children: ['btn_row', 'hint'] },
              { id: 'btn_row', component: 'Row', children: ['btn_default', 'btn_primary', 'btn_borderless'], align: 'center' },
              { id: 'default_label', component: 'Text', text: '通常ボタン' },
              { id: 'btn_default', component: 'Button', child: 'default_label', action: { event: { name: 'normalClicked', context: { from: 'default' } } } },
              { id: 'primary_label', component: 'Text', text: '保存する' },
              { id: 'btn_primary', component: 'Button', child: 'primary_label', variant: 'primary', action: { event: { name: 'saveClicked', context: { userName: P('/user/name'), savedAt: 'runtime' } } } },
              { id: 'borderless_label', component: 'Text', text: '詳細を見る' },
              { id: 'btn_borderless', component: 'Button', child: 'borderless_label', variant: 'borderless', action: { event: { name: 'detailsClicked' } } },
              { id: 'hint', component: 'Text', text: 'primary ボタンの context には {path} が含まれています。名前は下のデータモデルで変わります。', variant: 'caption' }
            ]),
            UD('demo_button', '/', { user: { name: '山田太郎' } })
          ],
          extraControls: [
            { label: 'サーバーが名前を変更（updateDataModel）', message: UD('demo_button', '/user/name', '佐藤花子') }
          ],
          openEventLog: true,
          openDataModel: true,
          note: 'ボタンを押すと、client → server への action メッセージがイベントログに表示されます。context 内の {path} は押下瞬間の値に解決されます。'
        },
        {
          id: 'textfield',
          title: 'TextField — テキスト入力',
          badge: 'component: "TextField"',
          desc: '1行・複数行・数値・マスク入力に対応するテキストフィールドです。value を {path} にバインドすると、タイプするたびにデータモデルへ即時反映されます。checks でクライアント側検証もできます。',
          props: [
            { n: 'label', t: 'DynamicString', r: true, d: 'フィールドのラベル' },
            { n: 'value', t: 'DynamicString', r: false, d: '値。{path} で双方向バインディング' },
            { n: 'variant', t: 'shortText | longText | number | obscured', v: 'shortText', d: '短文 / 長文（複数行）/ 数値キーボード / パスワード' },
            { n: 'validationRegexp', t: 'string（正規表現）', r: false, d: 'クライアント側検証の正規表現' },
            { n: 'checks', t: 'Array of CheckRule', r: false, d: '検証ルール。失敗時はメッセージを表示' }
          ],
          messages: [
            CS('demo_textfield'),
            UC('demo_textfield', [
              { id: 'root', component: 'Column', children: ['f_name', 'f_email', 'f_age', 'f_pass', 'f_note'] },
              { id: 'f_name', component: 'TextField', label: 'お名前', value: P('/form/name'), variant: 'shortText' },
              { id: 'f_email', component: 'TextField', label: 'メールアドレス（必須）', value: P('/form/email'), variant: 'shortText', checks: [
                { condition: { call: 'required', args: { value: P('/form/email') } }, message: 'メールアドレスは必須です。' },
                { condition: { call: 'email', args: { value: P('/form/email') } }, message: 'メールアドレスの形式が正しくありません。' }
              ] },
              { id: 'f_age', component: 'TextField', label: '年齢', value: P('/form/age'), variant: 'number' },
              { id: 'f_pass', component: 'TextField', label: 'パスワード', value: P('/form/password'), variant: 'obscured' },
              { id: 'f_note', component: 'TextField', label: '自己紹介（複数行）', value: P('/form/bio'), variant: 'longText' }
            ]),
            UD('demo_textfield', '/form', { name: '山田太郎', email: '', age: 28, password: '', bio: 'よろしくお願いします。' })
          ],
          openDataModel: true,
          note: 'メールアドレス欄に不正な形式を入力すると、checks のエラーメッセージが表示されます。入力はすべて「データモデル」パネルに即時反映されます。'
        },
        {
          id: 'checkbox',
          title: 'CheckBox — チェックボックス',
          badge: 'component: "CheckBox"',
          desc: 'ラベル付きの boolean チェックボックスです。value を {path} にバインドすると、true / false が即座にデータモデルへ書き込まれます。',
          props: [
            { n: 'label', t: 'DynamicString', r: true, d: '横に表示するラベル' },
            { n: 'value', t: 'DynamicBoolean', r: true, d: 'true=チェック。{path} で双方向バインディング' }
          ],
          messages: [
            CS('demo_checkbox'),
            UC('demo_checkbox', [
              { id: 'root', component: 'Column', children: ['cb_terms', 'cb_news', 'mirror'] },
              { id: 'cb_terms', component: 'CheckBox', label: '利用規約に同意する', value: P('/settings/terms') },
              { id: 'cb_news', component: 'CheckBox', label: 'お得な情報を受け取る', value: P('/settings/newsletter') },
              { id: 'mirror', component: 'Text', text: { call: 'formatString', args: { value: '現在の状態 → 同意: ${/settings/terms} / 配信: ${/settings/newsletter}' } }, variant: 'caption' }
            ]),
            UD('demo_checkbox', '/', { settings: { terms: true, newsletter: false } })
          ],
          openDataModel: true,
          note: '下部のキャプションは formatString でデータモデルを補間しています。チェックを切り替えると即座に変わります。'
        },
        {
          id: 'choicepicker',
          title: 'ChoicePicker — 選択ピッカー',
          badge: 'component: "ChoicePicker"',
          desc: '選択肢から1つまたは複数を選ぶコンポーネントです。value は「選択された value の文字列配列」にバインドされます（排他的選択でも配列で1要素）。displayStyle と variant の組み合わせで見た目が変わります。',
          props: [
            { n: 'options', t: 'Array of { label: DynamicString, value: string }', r: true, d: '選択肢リスト' },
            { n: 'value', t: 'DynamicStringList', r: true, d: '選択中の value 配列。{path} で双方向バインディング' },
            { n: 'variant', t: 'multipleSelection | mutuallyExclusive', v: 'mutuallyExclusive', d: '複数選択 / 排他的選択' },
            { n: 'displayStyle', t: 'checkbox | chips', v: 'checkbox', d: 'checkbox=ドロップダウン等 / chips=ピルボタン列' },
            { n: 'filterable', t: 'boolean', v: 'false', d: 'true で選択肢を検索絞り込みする入力を表示' },
            { n: 'label', t: 'DynamicString', r: false, d: 'グループのラベル' }
          ],
          messages: [
            CS('demo_choicepicker'),
            UC('demo_choicepicker', [
              { id: 'root', component: 'Column', children: ['cp_method', 'cp_interests', 'cp_cities'] },
              { id: 'cp_method', component: 'ChoicePicker', label: '連絡方法（排他的 / ドロップダウン）', variant: 'mutuallyExclusive', displayStyle: 'checkbox', options: [
                { label: 'メール', value: 'email' }, { label: '電話', value: 'phone' }, { label: '郵送', value: 'post' }
              ], value: P('/contact/method') },
              { id: 'cp_interests', component: 'ChoicePicker', label: '興味のある分野（複数選択 / チップス）', variant: 'multipleSelection', displayStyle: 'chips', options: [
                { label: 'AI・エージェント', value: 'ai' }, { label: 'UXデザイン', value: 'ux' }, { label: 'データ分析', value: 'data' }, { label: 'モバイル', value: 'mobile' }
              ], value: P('/contact/interests') },
              { id: 'cp_cities', component: 'ChoicePicker', label: '勤務希望地（複数選択 / 検索可能）', variant: 'multipleSelection', displayStyle: 'checkbox', filterable: true, options: [
                { label: '札幌', value: 'sapporo' }, { label: '東京', value: 'tokyo' }, { label: '横浜', value: 'yokohama' },
                { label: '名古屋', value: 'nagoya' }, { label: '京都', value: 'kyoto' }, { label: '大阪', value: 'osaka' },
                { label: '広島', value: 'hiroshima' }, { label: '福岡', value: 'fukuoka' }
              ], value: P('/contact/cities') }
            ]),
            UD('demo_choicepicker', '/contact', { method: ['email'], interests: ['ai', 'ux'], cities: ['tokyo'] })
          ],
          openDataModel: true,
          note: 'どのピッカーでも value は文字列配列としてデータモデルに入ります。検索ボックスに「お」などと入れて絞り込みも試せます。'
        },
        {
          id: 'slider',
          title: 'Slider — スライダー',
          badge: 'component: "Slider"',
          desc: '範囲内の数値を選ぶスライダーです。value は数値（整数とは限りません。例: 0.0〜1.0）で双方向バインディングされます。',
          props: [
            { n: 'value', t: 'DynamicNumber', r: true, d: '現在値。{path} で双方向バインディング' },
            { n: 'max', t: 'number', r: true, d: '最大値' },
            { n: 'min', t: 'number', v: '0', d: '最小値' },
            { n: 'label', t: 'DynamicString', r: false, d: 'ラベル' }
          ],
          messages: [
            CS('demo_slider'),
            UC('demo_slider', [
              { id: 'root', component: 'Column', children: ['sl_budget', 'mirror', 'sl_alpha'] },
              { id: 'sl_budget', component: 'Slider', label: '予算上限（万円）', min: 0, max: 100, value: P('/search/budget') },
              { id: 'mirror', component: 'Text', text: { call: 'formatString', args: { value: '現在の予算: ${formatCurrency(value:${/search/budget}, currency:\'JPY\')}〜' } } },
              { id: 'sl_alpha', component: 'Slider', label: '不透明度（0.0〜1.0 の小数値もOK）', min: 0, max: 1, value: P('/search/alpha') }
            ]),
            UD('demo_slider', '/search', { budget: 40, alpha: 0.7 })
          ],
          openDataModel: true,
          note: '下のスライダーのように 0〜1 の連続値も扱えます。formatCurrency との組み合わせで通貨表示のミラーも可能です。'
        },
        {
          id: 'datetime',
          title: 'DateTimeInput — 日付・時刻入力',
          badge: 'component: "DateTimeInput"',
          desc: '日付・時刻の入力です。enableDate / enableTime の組み合わせで「日付のみ」「時刻のみ」「日時」のUIになります。値は ISO 8601 文字列でデータモデルとやり取りされます。',
          props: [
            { n: 'value', t: 'DynamicString', r: true, d: 'ISO 8601形式の値。未設定は空文字列で初期化' },
            { n: 'enableDate', t: 'boolean', v: 'false', d: 'true で日付選択を有効化' },
            { n: 'enableTime', t: 'boolean', v: 'false', d: 'true で時刻選択を有効化' },
            { n: 'min / max', t: 'DynamicString', r: false, d: '選択可能範囲（ISO 8601）' },
            { n: 'label', t: 'DynamicString', r: false, d: 'ラベル' }
          ],
          messages: [
            CS('demo_datetime'),
            UC('demo_datetime', [
              { id: 'root', component: 'Column', children: ['d_date', 'd_time', 'd_both', 'mirror'] },
              { id: 'd_date', component: 'DateTimeInput', label: '予定日（日付のみ）', value: P('/plan/date'), enableDate: true, enableTime: false },
              { id: 'd_time', component: 'DateTimeInput', label: '開始時刻（時刻のみ）', value: P('/plan/time'), enableDate: false, enableTime: true },
              { id: 'd_both', component: 'DateTimeInput', label: 'リマインダー（日時）', value: P('/plan/datetime'), enableDate: true, enableTime: true, min: '2026-08-29T00:00' },
              { id: 'mirror', component: 'Text', text: { call: 'formatString', args: { value: 'リマインダー: ${formatDate(value:${/plan/datetime}, format:\'yyyy年M月d日（E） h:mm a\')}' } }, variant: 'caption' }
            ]),
            UD('demo_datetime', '/plan', { date: '2026-09-15', time: '10:30:00', datetime: '2026-09-16T18:30' })
          ],
          openDataModel: true,
          note: '下部のキャプションは formatDate 関数で ISO 8601 値を整形しています。値を変えると即座に反映されます。'
        }
      ]
    },

    /* =================  データ連携  ================= */
    {
      category: 'データ連携',
      catDesc: 'A2UIの中核: UI構造（updateComponents）とデータ（updateDataModel）の分離、パス解決、双方向バインディング、クライアント側関数。',
      items: [
        {
          id: 'binding',
          title: 'Dynamic* — リテラル / パス / 関数の3形式',
          badge: 'DynamicString / DynamicNumber / …',
          desc: 'バインド可能なプロパティは3形式を受け付けます: ①リテラル、②データモデルへの {path}（JSON Pointer）、③クライアント側関数の {call}。サーバーは updateDataModel を送るだけで、UI構造を再送せずに表示を変えられます。',
          messages: [
            CS('demo_binding'),
            UC('demo_binding', [
              { id: 'root', component: 'Column', children: ['t_literal', 't_path', 't_fn', 'hint'] },
              { id: 't_literal', component: 'Text', text: '① リテラル: 固定テキスト（データに依存しない）' },
              { id: 't_path', component: 'Text', text: P('/user/name'), variant: 'h4' },
              { id: 't_fn', component: 'Text', text: { call: 'formatString', args: { value: '③ 関数: こんにちは、${/user/name}さん！（プラン: ${/user/plan}）' } } },
              { id: 'hint', component: 'Text', text: '② は { "path": "/user/name" } にバインドされたTextです', variant: 'caption' }
            ]),
            UD('demo_binding', '/', { user: { name: '山田太郎', plan: 'プロ' } })
          ],
          extraControls: [
            { label: '名前を「佐藤花子」に更新', message: UD('demo_binding', '/user/name', '佐藤花子') },
            { label: '名前を「田中一郎」に更新', message: UD('demo_binding', '/user/name', '田中一郎') },
            { label: '名前キーを削除（value省略）', message: { version: 'v0.9', updateDataModel: { surfaceId: 'demo_binding', path: '/user/name' } } }
          ],
          openDataModel: true,
          note: 'updateDataModel はupsertセマンティクス（なければ作成）。value を省略するとキー削除になり、②③は空文字として描画されます（データ欠落時も描画が壊れないのがプログレッシブレンダリングの特徴です）。'
        },
        {
          id: 'template',
          title: 'リストテンプレート — データから子を生成',
          badge: 'ChildList（オブジェクト形式）',
          desc: 'Row / Column / List の children に { componentId, path } を渡すと、path の配列データから子が自動生成されます。テンプレート内では <code>/</code> 始まりでないパス（相対パス）が各アイテムのスコープで解決されるのがポイントです。',
          messages: [
            CS('demo_template'),
            UC('demo_template', [
              { id: 'root', component: 'Column', children: ['title', 'staff_list'] },
              { id: 'title', component: 'Text', text: '社員一覧', variant: 'h4' },
              { id: 'staff_list', component: 'List', children: { path: '/staff', componentId: 'staff_card' }, direction: 'vertical' },
              { id: 'staff_card', component: 'Card', child: 'staff_col' },
              { id: 'staff_col', component: 'Column', children: ['staff_row', 'staff_company'] },
              { id: 'staff_row', component: 'Row', children: ['staff_name', 'staff_role'], justify: 'spaceBetween', align: 'center' },
              { id: 'staff_name', component: 'Text', text: P('name'), variant: 'h5' },
              { id: 'staff_role', component: 'Text', text: P('role'), variant: 'caption' },
              { id: 'staff_company', component: 'Text', text: { call: 'formatString', args: { value: '所属: ${/company}（絶対パスは全員共通）' } }, variant: 'caption' }
            ]),
            UD('demo_template', '/', {
              company: 'Acme株式会社',
              staff: [
                { name: '山田太郎', role: 'シニアエンジニア' },
                { name: '佐藤花子', role: 'プロダクトデザイナー' },
                { name: '田中一郎', role: 'プロダクトマネージャー' }
              ]
            })
          ],
          extraControls: [
            { label: 'スタッフを1人追加', message: UD('demo_template', '/staff', [
              { name: '山田太郎', role: 'シニアエンジニア' },
              { name: '佐藤花子', role: 'プロダクトデザイナー' },
              { name: '田中一郎', role: 'プロダクトマネージャー' },
              { name: '鈴木美咲', role: 'データサイエンティスト' }
            ]) },
            { label: 'スタッフを2人に戻す', message: UD('demo_template', '/staff', [
              { name: '山田太郎', role: 'シニアエンジニア' },
              { name: '佐藤花子', role: 'プロダクトデザイナー' }
            ]) }
          ],
          openDataModel: true,
          note: 'テンプレート内の "name" や "role" は相対パス（/staff/0/name のように解決）、"/company" は絶対パス（ルートから解決）です。updateDataModel だけでリストが増減します。'
        },
        {
          id: 'twoway',
          title: '双方向バインディング — 入力は即データモデルへ',
          badge: 'Two-Way Binding',
          desc: '入力コンポーネントの value を {path} にバインドすると、ユーザーの操作は<strong>即座に</strong>クライアント内データモデルへ書き込まれ、同じパスを見ている表示がリアルタイムに更新されます。サーバーへ送信されるのは action（ボタン押下など）のタイミングだけです。',
          messages: [
            CS('demo_twoway'),
            UC('demo_twoway', [
              { id: 'root', component: 'Column', children: ['f_name', 'greeting', 'submit_row'] },
              { id: 'f_name', component: 'TextField', label: 'お名前', value: P('/profile/name'), variant: 'shortText' },
              { id: 'greeting', component: 'Text', text: { call: 'formatString', args: { value: 'こんにちは、${/profile/name}さん！' } }, variant: 'h4' },
              { id: 'submit_row', component: 'Row', children: ['submit_btn'], justify: 'end' },
              { id: 'submit_label', component: 'Text', text: '送信する' },
              { id: 'submit_btn', component: 'Button', child: 'submit_label', variant: 'primary', action: { event: { name: 'submitProfile', context: { name: P('/profile/name') } } } }
            ]),
            UD('demo_twoway', '/', { profile: { name: '山田太郎' } })
          ],
          openEventLog: true,
          openDataModel: true,
          note: '入力すると挨拶が即座に変わります（クライアント内完結・通信なし）。「送信する」を押した時だけ、context 内の {path} が解決されて action がサーバーへ送られます。'
        },
        {
          id: 'formatstring',
          title: 'formatString — 文字列への動的補間',
          badge: 'call: "formatString"',
          desc: 'formatString 関数は <code>${…}</code> 記法でデータモデルの値や他の関数結果を文字列に埋め込めます。パス（<code>${/user/name}</code>）、関数呼び出し（<code>${formatDate(...)}</code>）、ネスト（<code>${upper(${now()})}</code> 形式）に対応し、リテラルの <code>${</code> は <code>\\${</code> でエスケープします。',
          messages: [
            CS('demo_formatstring'),
            UC('demo_formatstring', [
              { id: 'root', component: 'Column', children: ['t_order', 't_cart', 'hint'] },
              { id: 't_order', component: 'Text', text: { call: 'formatString', args: { value: '注文 #${/order/id} を ${formatDate(value:${/order/date}, format:\'yyyy年M月d日（E）\')} に、${formatCurrency(value:${/order/amount}, currency:\'JPY\')} でお支払い予定です。' } } },
              { id: 't_cart', component: 'Text', text: { call: 'formatString', args: { value: '${pluralize(value:${/cart/count}, one:\'カートに商品が 1 点入っています\', other:\'カートに商品が ${/cart/count} 点入っています\')}（合計 ${formatNumber(value:${/cart/total})} 円）' } } },
              { id: 'hint', component: 'Text', text: '下のボタンで /cart/count を変えると pluralize の表現も切り替わります', variant: 'caption' }
            ]),
            UD('demo_formatstring', '/', {
              order: { id: 'A-1024', date: '2026-09-01T10:00:00', amount: 12800 },
              cart: { count: 3, total: 6300 }
            })
          ],
          extraControls: [
            { label: 'カート個数を 1 にする', message: UD('demo_formatstring', '/cart/count', 1) },
            { label: 'カート個数を 5 にする', message: UD('demo_formatstring', '/cart/count', 5) }
          ],
          openDataModel: true,
          note: '関数呼び出しの引数は名前付き（例: value:..., format:...）で、引数値にも ${…} をネストできます。'
        },
        {
          id: 'checks',
          title: 'checks — 検証とボタンの自動無効化',
          badge: 'CheckRule / and / or / not',
          desc: '入力コンポーネントの checks はクライアント側で評価され、失敗メッセージを表示します。Button に checks を付けると、1つでも失敗している間ボタンが自動的に無効化されます。論理関数 and / or / not で条件を組み合わせられます。',
          messages: [
            CS('demo_checks'),
            UC('demo_checks', [
              { id: 'root', component: 'Column', children: ['cb_terms', 'f_email', 'f_phone', 'btn_register', 'hint'] },
              { id: 'cb_terms', component: 'CheckBox', label: '利用規約に同意する（必須）', value: P('/signup/terms') },
              { id: 'f_email', component: 'TextField', label: 'メールアドレス（必須）', value: P('/signup/email'), variant: 'shortText', checks: [
                { condition: { call: 'required', args: { value: P('/signup/email') } }, message: 'メールアドレスは必須です。' },
                { condition: { call: 'email', args: { value: P('/signup/email') } }, message: 'メールアドレスの形式が正しくありません。' }
              ] },
              { id: 'f_phone', component: 'TextField', label: '電話番号（任意・10桁）', value: P('/signup/phone'), variant: 'shortText', checks: [
                { condition: { call: 'regex', args: { value: P('/signup/phone'), pattern: '^\\d{10}$' } }, message: '電話番号は10桁の数字で入力してください。' }
              ] },
              { id: 'register_label', component: 'Text', text: '登録する' },
              { id: 'btn_register', component: 'Button', child: 'register_label', variant: 'primary', action: { event: { name: 'registerAccount', context: { email: P('/signup/email'), phone: P('/signup/phone') } } }, checks: [
                {
                  condition: { call: 'and', args: { values: [
                    { call: 'required', args: { value: P('/signup/terms') } },
                    { call: 'or', args: { values: [
                      { call: 'required', args: { value: P('/signup/email') } },
                      { call: 'required', args: { value: P('/signup/phone') } }
                    ] } }
                  ] } },
                  message: '規約に同意し、メールまたは電話のいずれかを入力してください'
                }
              ] },
              { id: 'hint', component: 'Text', text: 'ボタンは「規約同意 AND（メール OR 電話）」が満たされるまで無効です', variant: 'caption' }
            ]),
            UD('demo_checks', '/', { signup: { terms: false, email: '', phone: '' } })
          ],
          openEventLog: true,
          openDataModel: true,
          note: 'チェックと入力の組み合わせでボタンが有効になる様子を確認してください。無効時は title 属性に失敗メッセージが入ります。'
        },
        {
          id: 'functions',
          title: '登録関数カタログ（15種）',
          desc: 'A2UIでは実行可能コードを送らず、「名前付き関数」をクライアント側で呼び出します。ベーシックカタログでは以下の15関数が定義されています（各デモは上記エントリで確認できます）。',
          docHtml: '' +
            '<h4>バリデーション（boolean を返す）</h4>' +
            '<table><tr><th>関数</th><th>引数</th><th>説明</th></tr>' +
            '<tr><td><code>required</code></td><td>value</td><td>null / undefined / 空でないか</td></tr>' +
            '<tr><td><code>regex</code></td><td>value, pattern</td><td>正規表現にマッチするか</td></tr>' +
            '<tr><td><code>length</code></td><td>value, min?, max?</td><td>文字数の範囲</td></tr>' +
            '<tr><td><code>numeric</code></td><td>value, min?, max?</td><td>数値の範囲</td></tr>' +
            '<tr><td><code>email</code></td><td>value</td><td>メールアドレス形式か</td></tr></table>' +
            '<h4>フォーマット（string を返す）</h4>' +
            '<table><tr><th>関数</th><th>引数</th><th>説明</th></tr>' +
            '<tr><td><code>formatString</code></td><td>value</td><td><code>${…}</code> 補間（パス・関数呼び出し・ネスト）</td></tr>' +
            '<tr><td><code>formatNumber</code></td><td>value, decimals?, grouping?</td><td>桁区切り・小数桁付きの数値書式</td></tr>' +
            '<tr><td><code>formatCurrency</code></td><td>value, currency, decimals?, grouping?</td><td>ISO 4217通貨コードでの通貨書式</td></tr>' +
            '<tr><td><code>formatDate</code></td><td>value, format</td><td>Unicode TR35パターン（yyyy年M月d日 など）で日付書式</td></tr>' +
            '<tr><td><code>pluralize</code></td><td>value, zero/one/two/few/many/other</td><td>CLDR複数カテゴリによる文言切替</td></tr></table>' +
            '<h4>ローカルアクション・論理演算</h4>' +
            '<table><tr><th>関数</th><th>引数</th><th>説明</th></tr>' +
            '<tr><td><code>openUrl</code></td><td>url</td><td>ブラウザでURLを開く（action の functionCall で使用）</td></tr>' +
            '<tr><td><code>and</code> / <code>or</code></td><td>values（2つ以上）</td><td>論理積 / 論理和</td></tr>' +
            '<tr><td><code>not</code></td><td>value</td><td>論理否定</td></tr></table>' +
            '<p>関数は checks の条件、Dynamic* の関数呼び出し形式、formatString の <code>${関数名(…)}</code> のいずれでも使えます。</p>'
        }
      ]
    },

    /* =================  テーマとサーフェス  ================= */
    {
      category: 'テーマとサーフェス',
      catDesc: 'サーフェスの作成・テーマ・データ同期・プログレッシブレンダリング。',
      items: [
        {
          id: 'theme',
          title: 'createSurface — テーマと sendDataModel',
          badge: 'theme / sendDataModel',
          desc: 'createSurface の theme でブランド色（primaryColor）やエージェントのアイコン（iconUrl）・表示名（agentDisplayName）を指定できます。sendDataModel: true にすると、action 送信のたびにデータモデル全体がトランスポートのメタデータとしてサーバーへ同梱されます。',
          messages: [
            CS('demo_theme', {
              theme: {
                primaryColor: '#e11d48',
                iconUrl: 'https://picsum.photos/seed/a2ui-agent/48/48',
                agentDisplayName: 'ディナー予約アシスタント'
              },
              sendDataModel: true
            }),
            UC('demo_theme', [
              { id: 'root', component: 'Column', children: ['title', 'cp_course', 'btn_reserve'] },
              { id: 'title', component: 'Text', text: 'ディナーコースを選択', variant: 'h4' },
              { id: 'cp_course', component: 'ChoicePicker', label: 'コース', variant: 'mutuallyExclusive', displayStyle: 'chips', options: [
                { label: 'スタンダード ¥6,000', value: 'standard' },
                { label: 'プレミアム ¥12,000', value: 'premium' },
                { label: 'シェフ任せ ¥18,000', value: 'omakase' }
              ], value: P('/res/course') },
              { id: 'reserve_label', component: 'Text', text: '予約を確定する' },
              { id: 'btn_reserve', component: 'Button', child: 'reserve_label', variant: 'primary', action: { event: { name: 'reserveDinner', context: { course: P('/res/course'), guests: 2 } } } }
            ]),
            UD('demo_theme', '/', { res: { course: ['standard'] } })
          ],
          openEventLog: true,
          openDataModel: true,
          note: 'primaryColor（ローズピンク）が primary ボタンや選択チップに反映されています。「予約を確定する」を押すと、action に加えて metadata.a2uiClientDataModel（データモデル全体）がイベントログに表示されます。'
        },
        {
          id: 'progressive',
          title: 'プログレッシブレンダリングとrootゲーティング',
          badge: 'Streaming',
          desc: 'クライアントは <code>id: "root"</code> のコンポーネントが到着するまで<strong>何も表示しません</strong>（バッファリング）。root到着後は、まだ到着していない子やデータはプレースホルダー／空値で描画し、届き次第差し替えます。1メッセージずつ送って確認してください。',
          stream: [
            CS('demo_progressive'),
            UC('demo_progressive', [
              { id: 'greet', component: 'Text', text: P('/quote/text'), variant: 'h4' },
              { id: 'detail', component: 'Text', text: '気温や降水確率は、データが届き次第ここに表示されます。', variant: 'caption' }
            ]),
            UC('demo_progressive', [
              { id: 'root', component: 'Card', child: 'root_col' }
            ]),
            UC('demo_progressive', [
              { id: 'root_col', component: 'Column', children: ['greet', 'weather_badge', 'detail'] }
            ]),
            UC('demo_progressive', [
              { id: 'weather_badge', component: 'Row', children: ['weather_icon', 'weather_text'], align: 'center' }
            ]),
            UC('demo_progressive', [
              { id: 'weather_icon', component: 'Icon', name: 'event' },
              { id: 'weather_text', component: 'Text', text: '東京・明日の天気', variant: 'caption' }
            ]),
            UD('demo_progressive', '/', { quote: { text: '明日の東京は晴れ、最高気温 28°C の予報です。' } })
          ],
          openEventLog: false,
          note: '1〜2通目: root（とそのラッパー）がまだ無いため、子定義はバッファリングされるだけ / 3通目: root_col が到着し描画開始。weather_badge はまだ未定義なので黄枠のプレースホルダーになる（参照はスキップせず差し替え待ち） / 4通目: weather_badge が到着するが、その中身（icon・text）がまだ無い / 5通目: 中身が到着して完成 / 6通目: updateDataModel で greet のテキストが埋まる。ストリームの順序はこのように部分的・任意の順でよく、届いたものから再構築されるのがA2UIの特徴です。'
        }
      ]
    }
  ];

  window.A2UI_CATALOG = CATALOG;
})();
