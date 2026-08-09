# Stock Trading 0 保守マニュアル

この文書は、Stock Trading 0を無料プランのAIとエントリークラスのスマートフォンまたはタブレットでも保守しやすくするための正本です。別の保守手順書を増やさず、手順を変えるときはこのファイルを更新します。

## 1. 前提

正本リポジトリ

https://github.com/abcderp2/stocktrading0

開発中

- リポジトリはprivate
- `main`は安定版として扱う
- 変更は作業ブランチで行う
- public化とGitHub Pages公開は完成時に判断する

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
- `.github/workflows/quality.yml`
- `.gitignore`

JavaScriptの役割

- `market-engine.js`: 市場生成、企業、時間進行、売買、ポートフォリオ計算
- `chart.js`: Canvasのローソク足描画とズーム、横移動
- `storage.js`: localStorage、JSON書き出し、JSON検証と読み込み
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
10. Pull Requestを作る場合は最初はDraftにする
11. 検査が通ったことを確認する
12. 表示と操作をスマートフォン幅、タブレット幅、PC幅で確認する
13. 問題がなければmainへ反映する
14. 公開中なら公開サイトも確認する

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
```

GitHub Actionsの`Quality checks`でも同じ種類の検査を行います。

検査に失敗した状態をmainへ入れません。警告だけの場合も内容を確認し、低性能端末やセキュリティへ関係する警告は放置しません。

## 7. スマートフォンとタブレットの確認

最低限、次を確認します。

- 320px程度の狭い画面で横スクロールが発生しない
- 360pxから430px程度でボタンと入力欄が押せる
- 700px前後のタブレットでチャートと操作パネルが無理なく並ぶ
- PC幅で余白が広がりすぎない
- 文字が拡大されても操作不能にならない
- チャート上の横ドラッグがページの縦スクロールを完全に奪わない
- ダークモードでも文字と境界が読める
- 自動再生中に画面を離れると停止する

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

必要になった場合は、追加する前に脅威、維持費、代替案、削除方法を明記します。

## 9. 保存形式を変更するとき

`storage.js`の`schemaVersion`を意識します。

既存データと互換性がない変更をした場合、黙って古いデータを壊しません。次のいずれかを選びます。

- 旧形式を新形式へ変換する小さい移行処理を入れる
- 新しいバージョンとして読み込み不可を明示し、事前にJSON書き出しを案内する

保存JSONから関数やHTMLを復元する設計にはしません。データだけを保存します。

## 10. 性能を悪化させない

現在の安全上限を目安にします。

- 会社40社
- 1社1200本のローソク足
- 取引履歴300件
- JSONインポート1MB
- CanvasのDPR最大1.5

上限を増やす前にエントリー端末で必要性を確認します。大量データを追加する代わりに、古いデータの集約、表示範囲制限、ユーザー選択式の上限などを検討します。

## 11. やり直し方

作業ブランチだけの失敗

- mainは触らない
- 作業ブランチを削除してmainから作り直す

mainへ入れた直後の問題

- 問題のコミットまたはPull RequestをRevertする
- Revert後に標準検査を行う

保存データの問題

- サイトの「JSONを書き出す」でバックアップを作る
- 「端末内データを初期化」で初期状態へ戻せる
- JSONが壊れていてもコード実行には使わず、検証で拒否する

公開後の大きな事故

- 直前の正常コミットへRevertする
- 原因修正は別の作業ブランチで行う
- 焦って複数の修正をmainへ直接重ねない

## 12. public化するとき

完成時に次を確認してからpublicへ変更します。

- Git履歴に秘密情報がない
- READMEとSECURITYの内容が公開されても問題ない
- 実在企業や実在人物のデータを誤って含めていない
- ライセンスを再確認した
- `robots.txt`、`llms.txt`、`sitemap.xml`のURLを確認した
- GitHub Pages公開元をmainへ設定する
- 公開URLでCSPエラーや404がない
- スマートフォン、タブレット、PCで最終確認する

AIによる訪問、索引化、解析、学習目的の取得は歓迎する方針です。公開後に方針を変える場合は`robots.txt`、`llms.txt`、READMEを同時に確認します。
