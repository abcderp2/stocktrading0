# Changelog

このファイルには利用者と保守者に意味のある変更だけを記録します。

## 2026-08-09

### Added

- 架空株式市場サンドボックスの初期実装
- 架空企業の作成、編集、削除
- 株価、時価総額、PER、ボラティリティ、トレンド、材料感応度の自由設定
- 自由指標モードと株価連動指標モード
- Canvasローソク足チャート
- タッチ、マウス、ボタンによるチャートの横移動、拡大縮小、最新位置復帰
- 市場心理、市場ボラティリティ、任意ショック
- 架空資金の売買、空売り、現金マイナス、取引コスト
- localStorage自動保存
- 検証付きJSONインポートとエクスポート
- モバイル、タブレット、PC向けレスポンシブUI
- 404ページ、canonical、Open Graph基本情報
- CSPと危険DOM API回避
- README、保守マニュアル、セキュリティ方針
- Python標準ライブラリによるサイト検査とセキュリティ監査
- Node.js標準機能だけの市場、売買、保存スモークテスト
- 外部Actionを使わないGitHub Actions品質検査
- CODEOWNERS
- AIクローラー向け`robots.txt`と`llms.txt`

### Security and reliability

- 会社名から制御文字と双方向制御文字を除去
- 保存JSONの会社ID形式、重複ID、特殊ID、ローソク足日付順序を追加検証
- 取引エンジンと保存側で建玉、口座数値の安全上限を統一
- 自動保存を1秒デバウンスし、低性能端末での同期書き込み負荷を削減
- localStorage保存を約2.5MB以下へ抑え、履歴量を自動調整
- 完全JSONバックアップの読み書き上限を8MBへ設定
- 意図しない`fetch`、`XMLHttpRequest`、`WebSocket`、`EventSource`、`sendBeacon`を自動監査
- Git履歴の秘密情報監査を維持
- public化後のブランチ保護、Private vulnerability reporting、公開確認、公開停止手順を保守マニュアルへ統合
