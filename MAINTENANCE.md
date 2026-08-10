# 株価あそび場 保守マニュアル

この文書を保守手順の正本とします。普通の無料プランのAIと、エントリークラスのスマートフォン、タブレットでも保守しやすい、小さく依存の少ない静的サイトを維持します。

正本リポジトリ

https://github.com/abcderp2/stocktrading0

公開サイト

https://abcderp2.github.io/stocktrading0/

## 1. 最優先方針

- `main`は公開中の安定版として扱う
- mainへ直接変更せず、作業ブランチとPull Requestを使う
- 追加課金、有料API、広告、アクセス解析、外部CDN、外部フォント、外部JavaScriptを追加しない
- npm、フレームワーク、ビルドツールを必須にしない
- エントリークラスのスマートフォンとタブレットを性能基準から外さない
- 1企業構成を維持し、企業管理画面を再導入しない
- 非現実的な金融数値は遊びの仕様として許可し、安全上限と金融上の現実性を混同しない
- README、SECURITY、CHANGELOGと実装が食い違わないよう同期する

AIへ依頼するときは次を最初に渡します。

```text
株価あそび場を保守してください。
正本は https://github.com/abcderp2/stocktrading0 です。
最初に MAINTENANCE.md を読み、セキュリティに関係する変更では SECURITY.md も確認してください。
追加課金、npm、外部API、外部CDN、外部JavaScriptを前提にせず、エントリークラスのスマートフォンとタブレットでも使える構成を維持してください。
mainへ直接変更せず、作業ブランチ、検査、PR、差分確認、戻し方の確認まで行ってください。
今回の依頼: ここへ書く
```

## 2. ファイルの役割

- `index.html`: 操作画面、説明、公開メタ情報
- `assets/css/style.css`: レスポンシブ表示、タッチ領域、ダークモード
- `assets/js/market-engine.js`: 架空価格、約20年の日付、出来高、日足、週足/月足集計、売買、統計
- `assets/js/chart.js`: Canvasローソク足、出来高、横スライド、クロスヘア、ズーム
- `assets/js/storage.js`: localStorage、JSON、v1からv4の移行、入力検証
- `assets/js/app.js`: UI接続、Undo、即リセット、自動保存、架空イベント
- `scripts/check_site.py`: 公開構造と重要仕様の静的検査
- `scripts/accessibility_layout_check.py`: フォーム名とレスポンシブ契約
- `scripts/smoke_test.js`: 市場、20年履歴、集計、売買、保存移行の機能検査
- `scripts/security_audit.py`: 危険API、秘密情報、Git履歴の監査
- `.github/workflows/quality.yml`: 上記検査をGitHub Actionsで実行

役割をまたぐ巨大な1ファイルへ集約しません。一方で似た役割の小ファイルを無意味に増やしません。

## 3. 変更手順

1. mainの最新コミットと未完了PRを確認する
2. `feature/目的`または`fix/目的`ブランチをmainから作る
3. 今回に必要なファイルだけ変更する
4. 標準検査を実行する
5. mainとの差分を確認する
6. 秘密情報、外部依存、意図しないファイルがないことを確認する
7. Pull Requestは最初はDraftにする
8. Quality checks成功を確認する
9. スマホ、タブレット、PCの表示契約を確認する
10. Draftを解除しSquash mergeする
11. mainのQuality checks成功を確認する
12. GitHub Pagesのbuildとdeploy成功を確認する

## 4. 標準検査

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

検査に失敗した状態をmainへ入れません。警告や端末負荷に関係する変更も内容を確認します。

## 5. 約20年履歴の契約

- 初期現在株価は必ず1,000円
- `HISTORY_YEARS = 20`
- 日足上限は`MAX_CANDLES = 7500`
- 通常の平日市場では約20年分が約5,000本台になる
- 端末の現在日を履歴の終点に使う
- 平日市場は土日と1月1日から3日、12月31日を簡易休場として飛ばす
- 365日市場は利用者が明示的に選んだ場合だけ有効
- 簡易休場は実際の取引所カレンダーではないと画面に明記する
- 実在の市場休日を正確に扱う目的で外部APIを追加しない

20年より長い履歴を追加する場合は、保存容量、初期生成時間、Undoメモリ、Canvas描画本数を先に再測定します。

## 6. 日足、週足、月足、出来高

保存元は日足だけです。

日足は次を持ちます。

- `day`
- `date`
- `open`
- `high`
- `low`
- `close`
- `volume`

週足と月足は日足から表示時に集計します。別の週足、月足配列をlocalStorageへ保存しません。

週足、月足のルール

- 始値: 期間最初の日足の始値
- 高値: 期間内の日足高値の最大
- 安値: 期間内の日足安値の最小
- 終値: 期間最後の日足の終値
- 出来高: 期間内出来高の合計

## 7. チャート操作と著作権

一般的な株価アプリで広く使われる操作原則は参考にできます。

参考にしてよいもの

- 期間切替
- 日足、週足、月足
- 横方向のパン
- 指やマウス位置へ追従する日時と価格表示
- クロスヘア
- OHLC
- 出来高
- 拡大縮小

コピーしないもの

- 第三者のソースコード
- スクリーンショット、画像、アイコン、ロゴ
- 独自の配色セット
- 特徴的な画面レイアウトの丸写し
- 独自の文言や説明文
- 商標を自サイト名や機能名のように使うこと

実装はこのリポジトリのVanilla JavaScriptとCanvasで独自に作ります。参考元を追加しても外部ランタイム依存にはしません。

チャートは1本指またはマウスで横に滑らせて、表示位置を移しながら選択中の足を連続更新します。タップだけを必須操作にしません。2本指またはホイールでズームし、操作が難しい端末向けにボタンも残します。

Canvasへ一度に描く本数は最大約320本に抑え、20年分全てを毎フレーム描画しません。

## 8. 現実要素と非現実要素

現実っぽい要素

- 実日付風の市場日付
- OHLC
- 出来高
- 52週高値、安値
- 長期高値、安値
- 日足、週足、月足
- 期間切替
- 売買履歴の日付

非現実な遊び

- 0.01円から1兆円までの株価
- 株価と無関係な時価総額、PER
- 365日市場
- 極端な値動き
- 架空イベント

架空イベントは画面上で明確に架空と分かる名称にし、実在企業や実在事件を装わないようにします。

## 9. 保存形式v4

現行キー

`stocktrading0.state.v4`

旧キー

- `stocktrading0.state.v3`
- `stocktrading0.state.v2`
- `stocktrading0.state.v1`

旧キーは自動削除しません。v4がない場合に移行元として読みます。

保存形式を変更するときは次を守ります。

1. schemaVersionを上げる
2. 旧データを黙って破壊しない
3. 旧キーを自動削除しない
4. 移行スモークテストを追加する
5. JSONバックアップにも同じ検証を適用する
6. Revertした場合に旧版が読める余地を残す

localStorageは約2.5MB以下、JSON入出力は8MB以下です。通常の20年平日日足は全量保存を最初に試し、容量不足時だけ古い履歴を段階的に減らします。

## 10. Undoと「最初から」

「最初から」は確認ダイアログを出さず、1回押した時点で初期状態へ戻します。

安全策としてリセット直前の状態をUndoへ保存します。「1つ戻す」で復旧できます。

20年履歴を何十個もメモリへ保持しないため、Undoは最大3状態です。連続スライダー操作は同じ操作群をまとめ、細かいイベントごとにUndoを積みません。

## 11. セキュリティ

- CSPの`connect-src 'none'`を維持する
- 公開JavaScriptへ`fetch`、`XMLHttpRequest`、`WebSocket`、`EventSource`、`sendBeacon`を追加しない
- `innerHTML`、`outerHTML`、`insertAdjacentHTML`、`document.write`、`eval`、`new Function`を使わない
- APIキー、アクセストークン、秘密鍵をコミットしない
- 自由入力をHTMLとして解釈しない
- 制御文字と双方向制御文字を除去する
- 保存JSONの日付順序、OHLC、出来高、数値上限を検証する
- Git履歴を含む秘密情報監査を維持する

セキュリティ変更では[SECURITY.md](SECURITY.md)も更新します。

## 12. レスポンシブと低性能端末

- 最小320px程度を対象にする
- 主要操作は44px以上を基本にする
- 720px以下で操作行を1列へ落とす
- 430px以下でも横スクロールなしで主要画面が読めることを目標にする
- 期間ボタンは狭い画面では横スクロール可能にする
- Canvas DPRは最大1.5
- Canvas描画は最大約320本
- バックグラウンドでは自動再生を停止し保存する
- `prefers-reduced-motion`を維持する

実機を持たないAIが物理端末で確認したと偽らないこと。自動検査とコード上の契約と、実機確認を区別します。

## 13. 戻し方

小さな操作ミス

- 「1つ戻す」

初期化したい

- 「最初から」

データごと戻したい

- JSONバックアップを読み込む

公開コードを戻したい

- 対象のSquash mergeコミットをGitHubでRevertする
- Revert後にmainのQuality checksとPages deployを確認する

旧localStorageキーを自動削除しないため、コードRevert時の復旧余地を残します。

## 14. 文書の統廃合

保守手順の正本はこの`MAINTENANCE.md`だけです。同じ内容の別手順書を増やしません。

- 使い方と概要: `README.md`
- 保守手順: `MAINTENANCE.md`
- セキュリティ: `SECURITY.md`
- 更新履歴: `CHANGELOG.md`
- AI向け公開方針: `llms.txt`

仕様変更時は必要な文書だけを同期します。
