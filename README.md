# Stock Trading 0

実在の銘柄や実際の株価データを使わず、架空企業、架空相場、架空の指標を自由に作って遊ぶ株式市場サンドボックスです。

開発中はprivateリポジトリのまま保守し、公開するときにpublic化とGitHub Pages公開を判断します。追加課金、有料API、広告、アクセス解析、アカウント登録、外部株価APIは使いません。

## いま遊べること

- 架空企業の会社名とティッカーを自由入力
- 株価、時価総額、PER、年間ボラティリティ、年間トレンド、材料感応度を自由設定
- 指標を自由値のままにするモードと、株価へ比例させるモード
- ローソク足チャートの横移動、拡大縮小、最新位置への復帰
- 1日、5日、20日の時間進行と自動再生
- 市場心理と市場全体の荒さを変更
- 好材料、悪材料、暴騰、暴落、任意ショックを次の日へ予約
- 架空資金による買いと売り
- 任意で空売り、現金マイナス、取引コストを有効化
- ブラウザー内の自動保存
- JSONへの書き出しと検証付き読み込み
- 新しい世界の作り直しと端末内データ初期化

表示される企業、株価、指標、値動き、損益はすべて架空です。投資助言、実際の市場データ、将来予測ではありません。

## 技術構成

無料プランのAIと、エントリークラスのスマートフォンまたはタブレットでも保守しやすいことを優先しています。

- HTML5
- CSS3
- Vanilla JavaScript
- Canvas 2Dによる自前のローソク足チャート
- localStorageによる端末内保存
- Python標準ライブラリによる読み取り専用検査
- 外部Actionを使わないGitHub Actions
- GitHub Pagesで公開可能な静的構成

Node.jsのパッケージ、npm、フレームワーク、ビルドツール、データベース、バックエンド、外部CDN、外部フォント、広告、解析SDKはありません。

## 低性能端末への配慮

- 描画対象は表示中のローソク足だけ
- 1銘柄のローソク足は最大1200本
- 架空企業は最大40社
- 最近の取引履歴は最大300件
- Canvasの高DPI倍率は最大1.5倍
- バックグラウンドへ移動すると自動再生を停止
- 320px幅からPCまでレスポンシブ表示
- 重要操作は44px以上のタップ領域を基本とする
- `prefers-reduced-motion`へ対応

## セキュリティとプライバシー

このサイトは外部通信を必要としません。APIキー、パスワード、アクセストークン、個人情報を入力する機能もありません。

会社名などの自由入力はHTMLとして解釈せず、JavaScriptでは`textContent`やDOM生成APIで表示します。`innerHTML`、`eval`、`document.write`などの危険な実装を自動検査で拒否します。

保存JSONの読み込みでは、ファイルサイズ、会社数、ローソク足数、取引数、文字列長、数値範囲、有限数、保存形式のバージョンを検証します。

`index.html`には静的サイトで適用可能なContent Security Policyを設定し、スクリプトとスタイルは同一サイト内だけ、ネットワーク接続は`connect-src 'none'`としています。

脆弱性対応と秘密情報を誤って公開した場合の手順は[SECURITY.md](SECURITY.md)を参照してください。

## 標準検査

PCまたはGitHub Actionsでは次を実行します。

```text
python3 -I scripts/workflow_policy.py
python3 -I scripts/check_site.py
python3 -I scripts/security_audit.py --history
node --check assets/js/market-engine.js
node --check assets/js/chart.js
node --check assets/js/storage.js
node --check assets/js/app.js
```

GitHub Actionsでも同じ方針の検査を自動実行します。

## 保守

保守手順の正本は[MAINTENANCE.md](MAINTENANCE.md)です。

AIへ保守を依頼するときは、最初に`MAINTENANCE.md`と今回の依頼内容を渡してください。セキュリティ変更では`SECURITY.md`も渡します。

大きな変更はmainへ直接入れず、作業ブランチで変更し、検査後にPull Requestで確認します。失敗した変更はブランチを捨てればmainへ影響しません。

## AIによる訪問

公開後はAIクローラー、検索エンジン、機械解析による訪問、読み取り、索引化、要約、学習目的の取得を歓迎する方針です。`robots.txt`は公開ページへのアクセスを許可し、`llms.txt`にも機械向け説明を置いています。

公開物の利用条件は`LICENSE`に従います。

## 公開予定URL

public化してGitHub Pagesを有効にした場合の想定URLです。

https://abcderp2.github.io/stocktrading0/

開発中はPages公開を前提にせず、privateのまま作業します。

## ライセンス

MIT License。詳細は[LICENSE](LICENSE)を参照してください。
