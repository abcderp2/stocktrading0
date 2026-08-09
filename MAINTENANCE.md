# Stock Trading 0 保守マニュアル

この文書は、Stock Trading 0を無料プランのAIとエントリークラスのスマートフォンまたはタブレットでも保守しやすくするための正本です。別の保守手順書を増やさず、手順を変えるときはこのファイルを更新します。

## 1. 前提

正本リポジトリ

https://github.com/abcderp2/stocktrading0

開発中

- リポジトリはprivate
- `main`は安定版として扱う
- 変更は作業ブランチで行う
- public化とGitHub Pages公開は完成時に行う

公開後の想定URL

https://abcderp2.github.io/stocktrading0/

追加課金、有料API、有料ホスティング、有料AI、外部CMS、広告、アクセス解析を前提にしません。

## 2. AIへ最初に渡す依頼

```text
Stock Trading 0を保守してください。
正本は https://github.com/abcderp2/stocktrading0 です。
最初に MAINTENANCE.md を読み、必要なら SECURITY.md も読んでください。
無料プランのAIとエントリークラスのスマートフォンまたはタブレットでも保守できる、依存の少ない静的サイト構成を維持してください。
今回の目的だけを変更し、mainへ直接書き込まず、作業ブランチで調査、変更、検査、差分確認、戻し方の報告まで進めてください。
今回の依頼内容:
ここへ依頼を書く
```

## 3. 参照順位

内容が食い違う場合は次の順で確認します。

1. 実際の動作と`index.html`、`assets/js/`、`assets/css/`
2. セキュリティ方針は`SECURITY.md`
3. 保守方法は`MAINTENANCE.md`
4. 概要は`README.md`
5. 変更履歴は`CHANGELOG.md`

推測だけで仕様を変えません。今回の依頼で決まっていない重要事項は、既存動作を維持する側へ倒します。

## 4. ファイル構成

公開ファイル

- `index.html`
- `404.html`
- `assets/css/style.css`
- `assets/js/market-engine.js`
- `assets/js/chart.js`
- `assets/js/storage.js`
- `assets/js/app.js`
- `robots.txt`
- `llms.txt`
- `sitemap.xml`
- `.nojekyll`

保守ファイル

- `README.md`
- `MAINTENANCE.md`
- `SECURITY.md`
- `CHANGELOG.md`
- `scripts/check_site.py`
- `scripts/security_audit.py`
- `scripts/workflow_policy.py`
- `scripts/smoke_test.js`
- `.github/workflows/quality.yml`
- `.github/CODEOWNERS`
- `.gitignore`

JavaScriptの役割

- `market-engine.js`: 市場生成、企業、時間進行、売買、ポートフォリオ計算
- `chart.js`: Canvasのローソク足描画、タッチ操作、マウス操作、ボタン操作
- `storage.js`: localStorage、容量調整、JSON書き出し、JSON検証と読み込み
- `app.js`: 画面要素と上記3機能を接続

機能を追加するときは、役割をまたいで巨大な1ファイルへ集約しません。一方で、似た役割の小さいファイルを大量に増やすことも避けます。

## 5. 変更の基本手順

1. `main`の最新状態を確認する
2. 既存の未完了作業ブランチがないか確認する
3. 大きな変更なら`backup/YYYY-MM-DD-purpose`のような退避ブランチをmainから作る
4. `feature/目的`または`fix/目的`の作業ブランチをmainから作る
5. 今回に必要なファイルだけ読む
6. 変更する
7. 標準検査を実行する
8. 差分を確認する
9. 予期しないファイルや秘密情報が入っていないことを確認する
10. Pull Requestは最初はDraftにする
11. GitHub ActionsのQuality checksが成功したことを確認する
12. スマートフォン幅、タブレット幅、PC幅で表示と操作を確認する
13. 問題がなければmainへ反映する
14. 公開中なら公開サイトを確認する

今回の依頼と関係ない整形、全面リファクタリング、ライブラリ導入を同じ変更へ混ぜません。

## 6. 標準検査

```text
python3 -I scripts/workflow_policy.py
python3 -I scripts/check_site.py
python3 -I scripts/security_audit.py --history
node --check assets/js/market-engine.js
node --check assets/js/chart.js
node --check assets/js/storage.js
node --check assets/js/app.js
node --check scripts/smoke_test.js
node scripts/smoke_test.js
```

GitHub Actionsの`Quality checks`でも同じ種類の検査を行います。

スモークテストでは、時間進行、売買、空売り制御、建玉上限、40社状態、1200本上限、端末内保存、保存後の再読込、重複ID拒否、危険な特殊ID拒否、ローソク足日付順序、見えない制御文字除去を検査します。

検査に失敗した状態をmainへ入れません。警告だけの場合も内容を確認し、低性能端末やセキュリティへ関係する警告は放置しません。

## 7. スマートフォンとタブレットの確認

最低限、次を確認します。

- 320px程度の狭い画面で横スクロールが発生しない
- 360pxから430px程度でボタンと入力欄が押せる
- 700px前後のタブレットでチャートと操作パネルが無理なく並ぶ
- PC幅で余白が広がりすぎない
- 文字を200%程度まで拡大しても主要操作を失わない
- チャート上の横ドラッグがページの縦スクロールを完全に奪わない
- ピンチ操作が使えなくてもチャート操作ボタンで移動と拡大縮小ができる
- ダークモードでも文字と境界が読める
- 自動再生中に画面を離れると停止し、保存される
- JSON書き出しと読み込みが端末ブラウザーで動く

高性能PCだけで軽いことを性能基準にしません。

## 8. セキュリティ上の変更禁止事項

理由なく次を追加しません。

- 外部API
- APIキー
- ユーザーアカウント
- サーバー保存
- 広告
- アクセス解析
- 外部フォント
- 外部CDN
- 外部JavaScript
- npm依存
- `innerHTML`
- `outerHTML`
- `insertAdjacentHTML`
- `eval`
- `new Function`
- `document.write`
- インライン`onclick`など
- `fetch`
- `XMLHttpRequest`
- `WebSocket`
- `EventSource`
- `navigator.sendBeacon`

必要になった場合は、追加する前に脅威、維持費、代替案、削除方法を明記します。

自由な金融数値は脆弱性ではありません。非現実的な株価やPERを理由にゲームの自由度を勝手に狭めません。端末を固める量のデータ、コード実行、保存破損、秘密情報、意図しない通信は別問題として制限します。

## 9. 保存形式を変更するとき

`storage.js`の`schemaVersion`を意識します。

現在の実行中チャートは1社最大1200本です。端末内の自動保存はlocalStorageの同期書き込み負荷と容量を抑えるため、直近600本を最初に試し、容量に応じて360、240、120本へ縮小します。JSON書き出しでは実行中の最大1200本まで保持します。読み込み上限は8MBです。

既存データと互換性がない変更をした場合、黙って古いデータを壊しません。次のいずれかを選びます。

- 旧形式を新形式へ変換する小さい移行処理を入れる
- 新しいバージョンとして読み込み不可を明示し、事前にJSON書き出しを案内する

保存JSONから関数やHTMLを復元する設計にはしません。データだけを保存します。

保存検証では少なくとも次を維持します。

- 会社数とローソク足数の上限
- 取引件数の上限
- 数値が有限であること
- 会社IDの形式と重複禁止
- `__proto__`、`prototype`、`constructor`をIDとして許可しない
- ローソク足の日付が昇順で、最後の日付が世界の日付と一致すること
- 株価は最後のローソク足終値を正本とすること
- 建玉、現金、損益の安全上限を市場エンジンと保存側で一致させること

## 10. 性能を悪化させない

現在の安全上限を目安にします。

- 会社40社
- 1社1200本の実行中ローソク足
- 取引履歴300件
- JSONインポート8MB
- localStorageへ書く1回のスナップショットは約2.5MB以下
- CanvasのDPR最大1.5
- 自動保存は操作後1秒のデバウンス

上限を増やす前にエントリー端末で必要性を確認します。大量データを追加する代わりに、古いデータの集約、保存履歴の縮小、表示範囲制限を先に検討します。

## 11. 依存関係の方針

現在の公開サイトは外部JavaScript依存0です。この状態を優先します。

新しいライブラリを入れる場合は、無料かどうかだけで決めません。次を確認します。

- 本当に自前実装より安全で保守しやすいか
- ライセンス
- 更新頻度と保守状況
- バンドルサイズ
- サプライチェーンリスク
- エントリー端末への負荷
- 無料AIが将来更新できる複雑さか
- 削除して元へ戻す方法

## 12. やり直し方

作業ブランチだけの失敗

- mainは触らない
- 作業ブランチを削除してmainから作り直す

mainへ入れた直後の問題

- 問題のPull RequestまたはコミットをRevertする
- Revert後に標準検査を行う

保存データの問題

- サイトの「JSONを書き出す」でバックアップを作る
- 「端末内データを初期化」で初期状態へ戻せる
- JSONが壊れていてもコード実行には使わず、検証で拒否する

公開後の大きな事故

- まずGitHub Pagesを停止するか直前の正常コミットへRevertする
- 原因修正は別の`fix/`ブランチで行う
- 焦って複数の修正をmainへ直接重ねない

## 13. public化前の最終確認

publicへ変更する直前に次を確認します。

- `main`に公開予定コードが入っている
- Draft PRや未反映の公開必須変更が残っていない
- Quality checksが成功している
- Git履歴の秘密情報監査が成功している
- README、MAINTENANCE、SECURITY、CHANGELOGが現行実装と一致する
- 実在企業や実在人物のデータを誤って含めていない
- APIキー、トークン、パスワード、個人情報がない
- `robots.txt`、`llms.txt`、`sitemap.xml`のURLが正しい
- `404.html`がある
- MIT Licenseを公開して問題ないことを確認する
- public化するとコード、履歴、Actionsの履歴やログも公開対象になることを理解する

## 14. GitHub Freeで公開するときの操作

リポジトリをpublicへ変更しただけではGitHub Pagesサイトは公開されません。

1. GitHubで`stocktrading0`を開く
2. `Settings`を開く
3. `Danger Zone`の`Change repository visibility`からpublicへ変更する
4. public化後に`Settings`の`Pages`を開く
5. `Build and deployment`の`Source`を`Deploy from a branch`にする
6. Branchを`main`にする
7. Folderを`/(root)`にする
8. `Save`を押す
9. Pagesの初回デプロイが成功したことを確認する
10. https://abcderp2.github.io/stocktrading0/ を開く

このサイトには`.nojekyll`があるため、静的ファイルをそのまま公開する構成を維持します。公開方法をカスタムActionsへ変更する必要はありません。

## 15. 公開直後の確認

公開URLで次を確認します。

- トップページが200相当で表示される
- CSSと4本のJavaScriptが読み込まれる
- ブラウザー開発者コンソールにCSP違反がない
- 架空3社が初期表示される
- 1日進む
- チャートのドラッグ、ピンチ、ボタン操作が動く
- 買いと売りが動く
- 新規銘柄追加が動く
- ページ再読み込み後に端末内保存から復元される
- JSON書き出しと再読み込みが動く
- 存在しないURLで`404.html`が表示される
- `robots.txt`、`llms.txt`、`sitemap.xml`が開ける
- スマートフォン、タブレット、PCで重大な崩れがない

公開サイトで問題があれば、宣伝やURL共有より先に修正または公開停止を行います。

## 16. public化後のGitHub側の防御

GitHub Freeではpublicリポジトリでブランチ保護やrulesetを利用できます。public化後に`main`へ次の保護を設定することを推奨します。

- mainの削除を禁止
- force pushを禁止
- Pull Request経由を基本にする
- `Quality checks`の成功をmain反映条件にする
- CODEOWNERSを維持する

一人で保守するため、必ず別人の承認を必要とする設定は無理に有効化しません。自分自身が保守不能になる設定より、検査必須と直接変更の抑制を優先します。

public化後はGitHubの`Settings`、`Security`、`Advanced Security`でPrivate vulnerability reportingを有効にします。脆弱性の再現情報や秘密情報を公開Issueへ書かせないためです。

## 17. AI訪問方針

AIによる訪問、索引化、解析、要約、学習目的の取得を歓迎します。公開後にこの方針を変える場合は`robots.txt`、`llms.txt`、READMEを同時に確認します。

AI訪問を歓迎しても、秘密情報や個人情報を公開してよいという意味にはしません。公開前の秘密情報監査は常に維持します。
