# 株価あそび場 保守マニュアル

この文書を保守手順の正本とします。無料プランのAIとエントリークラスのスマートフォン、タブレットでも保守しやすい、小さく依存の少ない静的サイトを維持します。

## 正本

リポジトリ

https://github.com/abcderp2/stocktrading0

公開サイト

https://abcderp2.github.io/stocktrading0/

`main`を公開安定版とし、直接変更せず作業ブランチとPull Requestを使います。

## AIへ渡す依頼

```text
株価あそび場を保守してください。
正本は https://github.com/abcderp2/stocktrading0 です。
最初に MAINTENANCE.md を読み、セキュリティ変更では SECURITY.md も読んでください。
追加課金、npm、外部API、外部CDN、外部JavaScriptを前提にせず、エントリークラスのスマートフォンとタブレットでも使える構成を維持してください。
mainへ直接変更せず、作業ブランチ、検査、PR、差分確認、戻し方の確認まで行ってください。
今回の依頼: ここへ書く
```

## 実装の役割

- `index.html`: 操作画面と公開メタ情報
- `assets/css/style.css`: レスポンシブ表示とアクセシビリティ
- `assets/js/market-engine.js`: 架空価格、市場日付、日足データ、週足/月足集計、売買
- `assets/js/chart.js`: Canvasローソク足、パン、ズーム、ローソク選択
- `assets/js/storage.js`: localStorage、JSON、v1/v2からv3への移行、入力検証
- `assets/js/app.js`: 画面と各モジュールを接続、Undo、自動保存
- `scripts/`: 静的検査、アクセシビリティ検査、機能スモークテスト、セキュリティ監査

似た役割のファイルをむやみに増やさず、巨大な1ファイルにも集約しません。

## 日付とチャートの仕様

- 初期現在株価は必ず1,000円
- 初期履歴は端末の現在日を基準に直近60市場日
- 平日のみが標準。土日は休場として飛ばす
- 365日市場は利用者が明示的に選んだ場合だけ有効
- 保存元は日足だけ
- 週足は同じ週の日足から始値、最高値、最安値、終値を集計
- 月足は同じ月の日足から集計
- 日足最大1200本
- 日付はISO `YYYY-MM-DD` で保存し、画面だけ日本語表記

祝日カレンダーは外部APIなしで正確に長期維持するコストが高いため、現時点では「平日」と「365日」の2方式です。祝日を追加する場合は固定データの更新責任と期間を明記してから行います。

## 保存形式

現在はschemaVersion 3です。

v3は各ローソク足と取引へ日付を持たせます。v2/v1のlocalStorageキーは自動削除せず、v3が存在しない場合に限り移行元として読みます。

保存形式を変更するときは次を守ります。

1. schemaVersionを上げる
2. 旧データを黙って破壊しない
3. 旧キーを自動削除しない
4. 移行スモークテストを追加する
5. JSONバックアップの読み込みにも同じ検証を適用する
6. Revertしたとき旧版が動ける状態を優先する

## 変更手順

1. mainの最新コミットと未完了PRを確認
2. `feature/`または`fix/`ブランチをmainから作成
3. 必要なファイルだけ変更
4. 標準検査を実行
5. mainとの差分を確認
6. 秘密情報、外部依存、意図しないファイルがないことを確認
7. Pull Requestを作成
8. Quality checks成功を確認
9. スマホ、タブレット、PCのレイアウト契約を確認
10. Squash merge
11. mainのQuality checks成功を確認
12. GitHub Pagesデプロイ成功を確認

## 標準検査

```text
python3 -I scripts/workflow_policy.py
python3 -I scripts/check_site.py
python3 -I scripts/accessibility_layout_check.py
python3 -I scripts/security_audit.py --history
node --check assets/js/market-engine.js
node --check assets/js/chart.js
node --check assets/js/storage.js
node --check assets/js/app.js
node --check scripts/smoke_test.js
node scripts/smoke_test.js
```

スモークテストでは最低限、初期1,000円、実日付、週末スキップ、365日市場、日足・週足・月足集計、売買日付、1200本上限、v3保存、日付検証、v2移行、旧データ非削除を確認します。

## スマホ、タブレット、PC

最低限次を守ります。

- 320px程度で横スクロールを起こさない
- 360pxから430pxで重要操作を1列または2列へ落とす
- 700px前後のタブレットでチャートと操作が過密にならない
- PCでチャートを過度に巨大化しない
- 44px以上のタップ領域を基本にする
- CanvasのDPRは1.5以下
- チャートの横操作がページ縦スクロールを完全に奪わない
- キーボードでも株価つまみを操作可能にする
- ダークモードと文字拡大を壊さない

## 性能上限

- 日足1200本
- 取引300件
- localStorage約2.5MB
- JSON最大8MB
- Canvas DPR最大1.5

週足と月足を別データとして保存しません。表示時集計にして保存容量と移行複雑性を増やさない方針です。

## セキュリティ上の禁止事項

必要性と代替案を明記せず次を追加しません。

- APIキー、GitHub PAT、パスワード
- 外部株価API
- アカウント、サーバー保存、決済
- 広告、アクセス解析
- npm依存、外部CDN、外部フォント、外部JavaScript
- `innerHTML`、`outerHTML`、`insertAdjacentHTML`
- `eval`、`new Function`、`document.write`
- インラインイベントハンドラ
- `fetch`、`XMLHttpRequest`、`WebSocket`などの外部通信

## やり直し

画面操作では「1つ戻す」「最初から」「JSONバックアップ」を使います。

コード変更で問題が出た場合は、mainへ複数の応急修正を重ねず、問題のSquashコミットをRevertし、原因修正を新しい作業ブランチで行います。

GitHub Pagesで重大な表示事故が起きた場合も、直前の正常コミットへRevertすることを最初の復旧候補にします。
