# Security Policy

株価あそび場は攻撃面を小さくするため、サーバー、アカウント、決済、外部株価API、外部JavaScript、広告、解析を持たない静的サイトとして維持します。

## 脅威として扱うもの

- 企業名などの自由入力を使ったDOM XSS
- 改変JSONによる不正状態、大量メモリー消費、日付破壊
- `eval`などによるコード実行
- 外部CDNや外部スクリプトのサプライチェーンリスク
- APIキー、アクセストークン、秘密鍵の誤コミット
- GitHub Actionsの過剰権限
- 無制限な日足や取引履歴による低性能端末の利用不能
- 意図しない外部通信

架空株価が非現実的であること、時価総額とPERの関係が現実と異なることは脆弱性ではなく仕様です。

## 現在の対策

- ユーザー文字列は`textContent`など安全なDOM APIで表示
- `innerHTML`、`eval`、`new Function`、`document.write`を使わない
- CSPで`connect-src 'none'`、スクリプトとスタイルを同一サイトへ限定
- 外部JavaScript、外部CDN、外部フォントなし
- JSONは最大8MB、localStorageは約2.5MBを目安に制限
- 日足1200本、取引300件などの上限
- schemaVersion 3で日付をISO形式として検証
- ローソク足の日付とdayが厳密な昇順であることを検証
- currentDateが最新ローソク足の日付と一致することを検証
- v1/v2移行でも入力を直接信頼せずv3検証を通す
- Canvas DPR最大1.5
- GitHub Actionsは`contents: read`
- workflow内で外部Actionを使用しない
- 危険DOM API、外部通信API、高信頼度の秘密情報パターン、Git履歴を自動監査

CSPは補助防御です。CSPを理由に危険な実装を許可しません。

## 秘密情報

通常保守にOpenAI APIキー、GitHub PAT、パスワード、2段階認証コード、復旧コード、SSH秘密鍵は不要です。AI、Issue、Pull Request、README、ソースへ貼りません。

誤ってコミットした場合は、サービス側で直ちに失効またはローテーションし、Git履歴を確認します。単に最新コミットから削除しただけで解決したと考えません。

## 脆弱性修正

- mainへ直接書かない
- `fix/`ブランチを使う
- 原因を修正する
- 標準検査を通す
- 関係ないリファクタリングを混ぜない
- Revert方法を確認してからmainへ反映する
