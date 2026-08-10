# 株価あそび場

実在の株価や企業データを使わず、1つの「テスト企業」の株価と指標を自由に動かして遊ぶ静的な架空株価サンドボックスです。

公開URL

https://abcderp2.github.io/stocktrading0/

GitHubリポジトリ

https://github.com/abcderp2/stocktrading0

## いま遊べること

初期状態の現在株価は必ず1,000円です。端末の日付を基準に直近60市場日の履歴を作り、平日のみモードでは土日を飛ばして日付が進みます。

- 企業名を「テスト企業」から自由に変更
- 株価、時価総額、PER、値動きの激しさ、上がりやすさ、市場ムードをスライダーまたは数値入力で変更
- チャート右のつまみを上下ドラッグして株価を直接変更
- 日付と曜日を表示
- 日足、週足、月足を切り替え
- 1か月、3か月、1年、全期間を切り替え
- ローソク足をタップして期間、始値、高値、安値、終値、値幅を確認
- 平日のみ市場と365日市場を切り替え
- 1日、5日、20日進行と自動進行
- 架空資金で買い、売り、任意で空売り
- 1つ戻す、最初から、JSONバックアップ

日付やローソク足の見た目は現実らしくしていますが、企業、株価、指標、値動き、売買結果はすべて架空です。投資助言、実市場データ、将来予測ではありません。

## 技術構成

追加課金なしで保守できることを優先しています。

- HTML5
- CSS3
- Vanilla JavaScript
- Canvas 2D
- localStorage
- Python標準ライブラリの静的検査
- Node.js標準機能だけのスモークテスト
- GitHub Actions
- GitHub Pages

npm、フレームワーク、ビルドツール、バックエンド、データベース、外部CDN、外部フォント、広告、解析SDK、有料API、株価APIはありません。

## 低性能端末への配慮

- 保存する元データは日足だけにし、週足と月足は表示時に最大1200本から集計
- 日足履歴は最大1200本
- 取引履歴は最大300件
- CanvasのdevicePixelRatioは最大1.5倍
- 自動保存は約0.9秒デバウンス
- localStorageは約2.5MB以下を目安に履歴を600、360、240、120本へ段階調整
- 320px程度のスマートフォンからタブレット、PCまでレスポンシブ対応
- 操作対象は44px以上を基本とする
- `prefers-reduced-motion`対応

## 保存形式とやり直し

現在の保存形式はschemaVersion 3です。日付情報を追加したため旧v2とv1から分離しています。

旧保存領域は自動削除しません。v3がない場合だけ旧保存を読み、選択されていた企業のチャートへ日付を付けてv3へ移行します。問題が起きた場合は旧版コードへRevertしやすい構造です。

画面上では「1つ戻す」「最初から」「JSONバックアップ」を利用できます。

## セキュリティとプライバシー

外部通信を必要とせず、アカウント、決済、APIキー、パスワード、個人情報入力を持ちません。

自由入力はHTMLとして実行せず、`textContent`などのDOM APIで扱います。CSPでネットワーク接続を`connect-src 'none'`にし、危険なDOM API、外部通信API、秘密情報、GitHub Actions権限を自動検査します。

詳細は[SECURITY.md](SECURITY.md)を参照してください。

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

GitHub ActionsのQuality checksでも同じ方針の検査を実行します。

## 保守

保守手順の正本は[MAINTENANCE.md](MAINTENANCE.md)です。無料プランのAIへ依頼する場合も、最初にMAINTENANCE.mdを読ませ、変更は作業ブランチ、検査、Pull Request、Squash mergeの順で進めます。

## AIによる訪問

公開後のAIクローラー、検索エンジン、機械解析、索引化、要約、学習目的の取得を歓迎します。方針は`robots.txt`と[llms.txt](llms.txt)に日本語と英語で記載しています。公開物の利用条件は`LICENSE`に従います。

## ライセンス

MIT License。詳細は[LICENSE](LICENSE)を参照してください。
