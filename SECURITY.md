# Security Policy

株価あそび場は、外部市場データを使わない静的な架空株価サンドボックスです。ブラウザー内だけで動く範囲を小さく保ち、追加課金や秘密情報を必要としないことを基本方針にします。

## セキュリティ目標

- 通常利用で外部API通信を行わない
- APIキー、パスワード、アクセストークンを必要としない
- 利用者の自由入力をコードやHTMLとして実行しない
- 壊れたJSONや極端な数値でブラウザーを不必要に消耗させない
- 長期履歴を増やしても保存量、メモリ量、描画量に上限を置く
- 外部ライブラリやサプライチェーン依存を増やさない

## データ境界

会社名や銘柄コードなどの自由入力は文字列として扱い、HTMLとして挿入しません。制御文字と双方向制御文字を除去します。

保存形式v4では次を検証します。

- schemaVersion
- 企業ID
- 数値が有限値であること
- 株価、口座、建玉、出来高などの上限
- ISO形式の日付
- 日足の日付とdayが昇順であること
- 最新ローソクとstateの最新日が一致すること
- OHLCの整合性
- 取引の日付が未来でないこと
- 取引数量の上限

localStorage保存は約2.5MB以下、JSONの入出力は8MB以下に制限します。

## 長期履歴の負荷制御

- 日足は最大7,500本
- 取引履歴は最大300件
- 週足、月足は日足から表示時に集計し重複保存しない
- Canvasは最大約320本だけを一度に描画する
- devicePixelRatioは最大1.5
- Undoは最大3状態
- 自動保存は約1秒デバウンス

この上限を変更する場合は、保存容量、初期生成時間、メモリ、低性能端末での描画負荷を再確認します。

## 外部通信

CSPで`connect-src 'none'`を指定します。

公開JavaScriptでは次を使用しません。

- `fetch`
- `XMLHttpRequest`
- `WebSocket`
- `EventSource`
- `navigator.sendBeacon`

実在株価、ニュース、為替、広告、解析などを取得する目的で外部APIを追加しません。

## 危険なDOM・コード実行

公開JavaScriptでは次を使用しません。

- `innerHTML`
- `outerHTML`
- `insertAdjacentHTML`
- `document.write`
- `eval`
- `new Function`
- `srcdoc`

DOM更新は`textContent`、DOM API、既存フォーム値を基本にします。

## CSP

`index.html`では少なくとも次を維持します。

- `default-src 'self'`
- `script-src 'self'`
- `style-src 'self'`
- `connect-src 'none'`
- `object-src 'none'`
- `base-uri 'none'`
- `form-action 'none'`
- `worker-src 'none'`

GitHub Pagesではmeta CSPで対応できないレスポンスヘッダー制御もあるため、CSPだけで完全な防御を保証しません。依存を減らし危険APIを使わない設計と組み合わせます。

## 秘密情報

リポジトリへ次を入れません。

- APIキー
- パスワード
- GitHub token
- OpenAI等の秘密鍵
- 秘密鍵ファイル
- 個人情報を含む実データ

GitHub Actionsのセキュリティ監査は現在ファイルだけでなく到達可能なGit履歴も高シグナルな秘密情報パターンで検査します。

## 保存移行

現行キーは`stocktrading0.state.v4`です。v3、v2、v1キーは自動削除しません。

旧形式を移行するときも同じv4検証を通します。旧形式に出来高がない場合は安全な架空出来高を補います。旧履歴が20年未満の場合は架空の過去履歴を補います。

移行に失敗した壊れたデータを無理に実行しません。

## 著作権と第三者資産

一般的な株価アプリの操作原則を参考にすることはありますが、第三者の著作物をコピーしません。

禁止するもの

- 第三者アプリのソースコードの転載
- スクリーンショット、ロゴ、アイコン、画像の無断使用
- 特徴的な画面デザインの丸写し
- 独自の説明文章や文言のコピー
- 外部フォントや素材を権利確認なしで追加

期間切替、横パン、クロスヘア、OHLC、出来高など一般的な機能概念は、このリポジトリのHTML、CSS、Vanilla JavaScript、Canvasで独自実装します。

## 自動検査

標準のセキュリティ検査

```text
python3 -I scripts/security_audit.py --history
python3 -I scripts/workflow_policy.py
```

さらに`check_site.py`、`accessibility_layout_check.py`、`smoke_test.js`で公開構造、入力名、長期履歴、保存移行を検査します。

## 脆弱性を見つけた場合

公開Issueへ秘密情報、実トークン、悪用可能な個人情報を貼りません。

リポジトリ側でPrivate vulnerability reportingが有効な場合はそれを優先します。有効でない場合も、秘密情報を公開せず、まず安全な再現方法だけを整理します。

修正は作業ブランチで行い、回帰テストを追加し、Quality checks成功後にSquash mergeします。
