[English](README.md) | **日本語**

# claude-code-usage-alert

> Claude Code のセッション予算をリアルタイムで段階通知する [Hooks](https://docs.anthropic.com/en/docs/claude-code/hooks) ベースのツール。

Claude Code は Max プランユーザー向けの使用量 API やビルトインの予算制限を提供していません。**claude-code-usage-alert** は、毎ターン終了時に transcript JSONL を解析し、推定コストが設定した閾値を超えた時点で通知することで、このギャップを埋めます。ターミナルから離れる必要はありません。

## 特徴

- **Claude Code にネイティブ統合** -- Stop / SessionStart / SessionEnd hook として動作。別ウィンドウや別プロセスの管理は不要
- **段階的な閾値通知** -- デフォルトは 50%, 80%, 90%（自由にカスタマイズ可能）
- **2つの通知チャネル** -- ターミナル内の `systemMessage` 警告 + OS ネイティブのデスクトップ通知
- **インクリメンタル transcript 解析** -- 前回チェック以降の新しいバイトのみ読み取り。高速・低オーバーヘッド
- **macOS + Linux 対応** -- macOS では `osascript`、Linux では `notify-send` を使用
- **ほぼゼロの外部依存** -- ランタイム依存は [`yaml`](https://github.com/eemeli/yaml) のみ

![デスクトップ通知のサンプル](docs/images/notification-sample.png)

## 想定ユースケース

### Max プランユーザー：1日のリミット到達を事前に察知したい

Max プラン（Pro / Max 5x）は月額固定ですが、1日あたりの使用量に上限があります。Anthropic はこの上限値や現在の使用率を API で公開していないため、リミットに達するまで残量がわかりません。

claude-code-usage-alert を使うと、セッション中の推定コストが設定した予算の閾値を超えた時点で通知されるため、「突然リミットに達して作業が中断される」前にペースを把握できます。

> **注意:** 通知に表示されるドル金額は API 換算の推定値であり、Max プランの実際のリミット消費量とは連動していません。「このセッションでどの程度リソースを使っているか」の相対的な目安です。

### Max プランと API 利用を併用するユーザー

Max プランのリミットに達した後、API キーに切り替えて作業を続けるユーザーもいます。API 利用時はトークン単位の従量課金になるため、セッション中のコスト感覚がより重要になります。

セッション予算を設定しておけば、API 利用時にも「このセッションでいくら程度使っているか」を把握しながら作業できます。

### チームでの利用コスト意識の共有

チームメンバーが Claude Code を日常的に使う環境では、個人ごとのセッション予算を設定することで、過度な使用を自覚する仕組みとして活用できます。

## クイックスタート

```bash
npm install -g claude-code-usage-alert
claude-code-usage-alert setup          # 設定ファイル作成、hook 登録
```

これだけです。次に Claude Code セッションを開始すると、予算追跡が有効になります。

## 仕組み

```
Claude Code セッション
       |
       v
 [SessionStart hook]  -->  セッション状態を初期化
       |
       v
  ... 会話 ...
       |
       v
  [Stop hook]  ---------->  1. transcript JSONL を読み取り（インクリメンタル、前回のバイトオフセットから）
       |                     2. トークン数を合計（input / output / cache_read / cache_creation）
       |                     3. モデル別単価テーブルでコスト（USD）を算出
       |                     4. 累積コストをセッション予算と比較
       |                     5. 閾値を超えた場合:
       |                        - { "systemMessage": "..." } を stdout に出力（ターミナル内通知）
       |                        - OS デスクトップ通知を発火
       |
       v
  ... 会話 ...
       |
       v
 [SessionEnd hook]  -->  セッション状態をクリア
```

### 設計上の重要な判断

| 判断 | 理由 |
|------|------|
| 予算はユーザー定義（API 取得ではない） | Anthropic が Max プランの使用量/残量 API を公開していないため |
| インクリメンタル・バイトオフセット解析 | 毎ターンで transcript 全体を再読み込みすることを回避 |
| 絶対にクラッシュしない設計 | `main().catch()` とハンドラごとの try/catch で hook の失敗をサイレントに処理 |
| `systemMessage` 出力 | 公式の Hooks 仕様 -- Claude Code が stdout からこの値を読み取りインラインで表示 |

## 設定

設定ファイルは `~/.claude-code-usage-alert/config.yml` にあります。`claude-code-usage-alert setup` で自動作成されます。

```yaml
# ~/.claude-code-usage-alert/config.yml

budget:
  mode: cost
  # セッション予算（USD）
  sessionBudget: 5.00
  # 週間予算（USD）
  weeklyBudget: 50.00
  # 週間カウンターのリセット曜日（claude.ai のプラン使用制限ページで確認）
  weeklyResetDay: monday

thresholds:
  - percent: 50
    notify: terminal    # ターミナルのみ
  - percent: 80
    notify: both        # ターミナル + デスクトップ
  - percent: 90
    notify: both        # ターミナル + デスクトップ

notifications:
  desktop: true
  terminal: true
  sound: false
```

### 設定リファレンス

| キー | 型 | デフォルト | 説明 |
|------|------|---------|------|
| `budget.mode` | `"cost"` | `"cost"` | 予算モード（現在はコストベースのみ） |
| `budget.sessionBudget` | `number` | `5.00` | セッション予算（USD） |
| `budget.weeklyBudget` | `number` | `50.00` | 週間予算（USD） |
| `budget.weeklyResetDay` | `string` | `"monday"` | 週間カウンターのリセット曜日 |
| `thresholds[].percent` | `number` | `50, 80, 90` | 通知を発火する閾値（%） |
| `thresholds[].notify` | `"terminal" \| "desktop" \| "both"` | 各種 | 閾値ごとの通知方法 |
| `notifications.desktop` | `boolean` | `true` | デスクトップ通知の有効/無効 |
| `notifications.terminal` | `boolean` | `true` | ターミナル（systemMessage）通知の有効/無効 |
| `notifications.sound` | `boolean` | `false` | 通知音の有効/無効 |

## コマンド

### `claude-code-usage-alert setup`

初回セットアップ:

1. `~/.claude-code-usage-alert/config.yml` をデフォルト設定で作成
2. `~/.claude-code-usage-alert/state.json` をセッション追跡用に作成
3. `~/.claude/settings.json` に Stop, SessionStart, SessionEnd の hook を登録

既存の settings.json の hook 設定は保持されます。上書きせずにマージします。

### `claude-code-usage-alert hook <event>`

Claude Code から自動的に呼び出される hook ハンドラ。直接呼び出す必要はありません。

| イベント | 動作 |
|---------|------|
| `SessionStart` | セッション状態を初期化または復元 |
| `Stop` | 新しい transcript データを解析、コスト計算、閾値チェック、通知送信 |
| `SessionEnd` | セッション状態をクリア |

### `claude-code-usage-alert status`

現在のセッション情報を表示:

```
=== claude-code-usage-alert Status ===

Session ID:  abc123
Started at:  2026-02-18T10:30:00.000Z

Budget:      $5.00
Used:        $2.3456 (47%)
Remaining:   $2.6544

Tokens:
  Input:          125,000
  Output:         45,000
  Cache Read:     80,000
  Cache Creation: 10,000

Next alert:  at 50%
```

### `claude-code-usage-alert config [options]`

コマンドラインから設定を表示・変更:

```bash
# 現在の設定を表示
claude-code-usage-alert config

# セッション予算を $10 に設定
claude-code-usage-alert config --budget 10.00

# カスタム閾値を設定
claude-code-usage-alert config --thresholds 30,60,90
```

## アーキテクチャ

```
src/
  index.ts                    CLI エントリポイント（サブコマンドルーター）
  commands/
    setup.ts                  セットアップウィザード + hook 登録
    hook.ts                   Hook イベントハンドラ（Stop / SessionStart / SessionEnd）
    status.ts                 現在のセッション状態表示
    config.ts                 設定の CLI 表示/変更
  core/
    transcript-parser.ts      インクリメンタル JSONL パーサー（バイトオフセットベース）
    pricing.ts                モデル別単価テーブル + コスト計算
    usage-calculator.ts       使用率計算 + 閾値チェック
    state-manager.ts          セッション状態の永続化（~/.claude-code-usage-alert/state.json）
  config/
    defaults.ts               デフォルト設定値 + TypeScript インターフェース
    loader.ts                 YAML 設定ローダー/セーバー（~/.claude-code-usage-alert/config.yml）
  notification/
    desktop.ts                OS ネイティブデスクトップ通知（osascript / notify-send）
    terminal.ts               systemMessage JSON フォーマッター
    dispatcher.ts             ターミナル/デスクトップへの通知ルーティング
  utils/
    platform.ts               プラットフォーム検出（darwin / linux）
```

### データフロー（Stop hook）

```
stdin（Claude Code からの JSON）
  |
  v
hook.ts: parseHookInput()
  |
  +-- transcript-parser.ts: parseTranscript(path, offset)
  |     |
  |     +-- transcript JSONL の [offset..EOF] バイトを読み取り
  |     +-- { totalTokens, model, newOffset } を返却
  |
  +-- pricing.ts: calculateCost(tokens, model)
  |     |
  |     +-- PRICING_TABLE からモデルを検索
  |     +-- コスト（USD）を返却
  |
  +-- state-manager.ts: updateSession(state, tokens, cost, offset)
  |
  +-- usage-calculator.ts: getUsagePercent() + checkThresholds()
  |
  +-- dispatcher.ts: notify()
        |
        +-- terminal.ts: formatSystemMessage() --> stdout
        +-- desktop.ts: sendDesktopNotification() --> osascript / notify-send
```

### 対応モデル

| モデル | Input (100万トークンあたり) | Output (100万トークンあたり) | Cache Read | Cache Creation |
|--------|---------------------------:|---------------------------:|-----------:|---------------:|
| claude-opus-4-6 | $15.00 | $75.00 | $1.50 | $18.75 |
| claude-sonnet-4-5 | $3.00 | $15.00 | $0.30 | $3.75 |
| claude-haiku-4-5 | $0.80 | $4.00 | $0.08 | $1.00 |

モデル名はプレフィックスマッチングで解決されます（例: `claude-sonnet-4-5-20250514` は `claude-sonnet-4-5` にマッピング）。キーワードフォールバック（`opus`, `sonnet`, `haiku`）にも対応。

## よくある質問

### Max プランの正確な使用量リミットを取得できますか？

いいえ。Anthropic は Max プラン契約者向けの使用率や残量の API を公開していません。このツールは代わりに**ユーザー定義のセッション予算**を使用します。1セッションで妥当と考える金額を設定すると、その金額に近づくにつれて通知されます。

### [ccusage](https://github.com/ryoppippi/ccusage) との違いは？

ccusage は**事後分析**ツールです。セッション終了後に使用トークン数を確認するために実行します。claude-code-usage-alert は、Hooks を介して Claude Code 内部で動作する**リアルタイム通知**ツールであり、予算を超える*前に*セッション中に警告します。JSONL 解析のアプローチは ccusage に着想を得ています。

### Claude Code が遅くなりますか？

いいえ。Stop hook は各アシスタントターンの後に 5 秒のタイムアウトで実行されます。インクリメンタル解析は前回のチェック以降の新しいバイトのみを読み取るため、通常はミリ秒単位で完了します。hook が失敗またはタイムアウトした場合、Claude Code はサイレントに無視します。

### 通知に表示されるドル金額の意味は？

通知に表示されるドル金額（例: `$2.50 est. / $5.00`）は **API 換算の推定コスト**であり、実際の課金額ではありません。トークン使用量に公開されている API 単価を掛けて算出しています。月額固定の Max プランユーザーにとっては、セッションの使用強度を示す相対的な指標として機能します。

### セッションをまたいだ使用量を追跡できますか？

はい。セッション単位の追跡に加えて、設定可能な週間ウィンドウ内の全セッションの推定コストを蓄積します。`weeklyBudget` と `weeklyResetDay` を設定すると、週間の閾値アラート（`[Weekly]` プレフィックス付き）を受け取れます。セッション履歴は `~/.claude-code-usage-alert/state.json` にローカル保存されます。

### 週間予算は Anthropic の実際の週間制限と一致しますか？

いいえ。Anthropic は週間制限データを API で公開していません。週間予算は API 換算の推定コストに基づく**ユーザー定義の目標値**です。claude.ai のダッシュボードに表示される「週間制限」バーとは連動しません。ただし、1週間を通じたセッション横断の使用強度を一貫して把握する手段になります。

### 週の途中からこのツールを使い始めても問題ありませんか？

はい。インストールした時点から追跡が始まります。インストール前のセッションは含まれないため、最初の週の合計は実際の使用量より低く表示されます。翌週以降は1週間分がフルに計測されます。

### プランの週間リセット曜日はどこで確認できますか？

[claude.ai](https://claude.ai) の「プラン使用制限」セクションを確認してください。週間制限バーにリセット曜日と時刻が表示されています（例: 「14:00 (水)にリセット」）。config の `weeklyResetDay` をこれに合わせて設定してください。

### Windows で動作しますか？

現在は対応していません。デスクトップ通知は `osascript`（macOS）と `notify-send`（Linux）を使用しています。将来的に PowerShell のトースト通知による Windows サポートを追加する可能性があります。

## 既存ツールとの比較

Claude Code のエコシステムには優れた使用量モニタリングツールが既に存在します。claude-code-usage-alert は **Hooks を通じたリアルタイムのセッション内予算通知** という、以下のツールがカバーしていない領域に特化しています。

| ツール | アプローチ | 強み | 本ツールとの違い |
|--------|----------|------|----------------|
| [ccusage](https://github.com/ryoppippi/ccusage) | セッション後の JSONL 分析 | 最も成熟し広く使われている。正確なトークン/コストレポート | セッション後の振り返り用で、リアルタイム通知は対象外。本ツールの JSONL 解析は ccusage に着想を得ています。 |
| [Claude-Code-Usage-Monitor](https://github.com/1rgs/Claude-Code-Usage-Monitor) | 独立したターミナルダッシュボード | ML 予測付きのリッチな TUI | 別のターミナルウィンドウで動作。Hooks 経由の Claude Code 統合ではありません。 |
| [Claude-Usage-Tracker](https://github.com/nicekid1/Claude-Usage-Tracker) | macOS メニューバーアプリ | 洗練されたネイティブ UI と段階的アラート | macOS 専用。本ツールの段階的な閾値通知 UX はこのツールの設計に着想を得ています。 |
| [claude-o-meter](https://github.com/ansonTGN/claude-o-meter) | Go バイナリ、PTY スクレイピング | 単一バイナリ、ランタイム依存なし | Linux 中心。`/usage` コマンド出力の解析に依存しており、CLI バージョン間で変更される可能性があります。 |

各ツールは使用量モニタリングの異なる側面を解決しています。セッション後の詳細分析には [ccusage](https://github.com/ryoppippi/ccusage) を推奨します。claude-code-usage-alert は Claude Code の公式 Hooks 拡張ポイントを通じた**プロアクティブなセッション内通知**を提供することで、これらのツールを補完する設計です。

要件分析の詳細は [docs/competitive-analysis.md](docs/competitive-analysis.md) を参照してください。

## コントリビューション

コントリビューションを歓迎します。変更を加える前に、まず Issue を作成して議論してください。

```bash
git clone https://github.com/tackeyy/claude-code-usage-alert.git
cd claude-code-usage-alert
npm install
npm run build
npm test
```

## ライセンス

[MIT](LICENSE)
