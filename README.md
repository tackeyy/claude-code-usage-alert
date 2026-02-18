# claude-code-usage-alert

> Real-time session budget alerts for Claude Code, powered by [Hooks](https://docs.anthropic.com/en/docs/claude-code/hooks).

Claude Code does not expose a usage API or built-in budget limits for Max plan users. **claude-code-usage-alert** fills that gap by parsing transcript JSONL files after every turn and alerting you when your estimated spend crosses configurable thresholds -- all without leaving your terminal.

## Features

- **Native Claude Code integration** -- runs as a Stop / SessionStart / SessionEnd hook; no extra window or process to manage
- **Tiered threshold alerts** -- default at 50%, 80%, 90% (fully customizable)
- **Dual notification channels** -- in-terminal `systemMessage` warnings + OS-native desktop notifications
- **Incremental transcript parsing** -- reads only new bytes since the last check; fast and low overhead
- **macOS + Linux** -- uses `osascript` on macOS and `notify-send` on Linux
- **Near-zero dependencies** -- only [`yaml`](https://github.com/eemeli/yaml) at runtime

## Quick Start

```bash
npm install -g claude-code-usage-alert
claude-code-usage-alert setup          # creates config, registers hooks
```

That's it. Next time you start a Claude Code session, budget tracking is active.

## How It Works

```
Claude Code session
       |
       v
 [SessionStart hook]  -->  Initialize session state
       |
       v
  ... conversation ...
       |
       v
  [Stop hook]  ---------->  1. Read transcript JSONL (incremental, from last byte offset)
       |                     2. Sum token counts (input / output / cache_read / cache_creation)
       |                     3. Compute cost in USD using model pricing table
       |                     4. Compare cumulative cost against session budget
       |                     5. If a threshold is crossed:
       |                        - Output { "systemMessage": "..." } to stdout (terminal alert)
       |                        - Fire OS desktop notification
       |
       v
  ... conversation ...
       |
       v
 [SessionEnd hook]  -->  Clear session state
```

### Key design decisions

| Decision | Rationale |
|----------|-----------|
| Budget is user-defined, not API-derived | Anthropic does not expose a usage/remaining API for Max plan |
| Incremental byte-offset parsing | Avoids re-reading the entire transcript on every turn |
| Never crashes | `main().catch()` and per-handler try/catch ensure hook failures are silent |
| `systemMessage` output | Official Hooks contract -- Claude Code reads this from stdout and displays it inline |

## Configuration

Configuration lives at `~/.claude-code-usage-alert/config.yml`. Created automatically by `claude-code-usage-alert setup`.

```yaml
# ~/.claude-code-usage-alert/config.yml

budget:
  mode: cost
  # Session budget in USD
  sessionBudget: 5.00

thresholds:
  - percent: 50
    notify: terminal    # terminal only
  - percent: 80
    notify: both        # terminal + desktop
  - percent: 90
    notify: both        # terminal + desktop

notifications:
  desktop: true
  terminal: true
  sound: false
```

### Configuration reference

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `budget.mode` | `"cost"` | `"cost"` | Budget mode (currently only cost-based) |
| `budget.sessionBudget` | `number` | `5.00` | Session budget in USD |
| `thresholds[].percent` | `number` | `50, 80, 90` | Percentage thresholds that trigger alerts |
| `thresholds[].notify` | `"terminal" \| "desktop" \| "both"` | varies | Notification method per threshold |
| `notifications.desktop` | `boolean` | `true` | Enable/disable desktop notifications |
| `notifications.terminal` | `boolean` | `true` | Enable/disable terminal (systemMessage) notifications |
| `notifications.sound` | `boolean` | `false` | Enable/disable notification sound |

## Commands

### `claude-code-usage-alert setup`

One-time initialization:

1. Creates `~/.claude-code-usage-alert/config.yml` with default settings
2. Creates `~/.claude-code-usage-alert/state.json` for session tracking
3. Registers Stop, SessionStart, and SessionEnd hooks in `~/.claude/settings.json`

Existing hooks in your settings.json are preserved -- the command merges without overwriting.

### `claude-code-usage-alert hook <event>`

Hook handler invoked automatically by Claude Code. You should not call this directly.

| Event | Behavior |
|-------|----------|
| `SessionStart` | Initializes or restores session state |
| `Stop` | Parses new transcript data, calculates cost, checks thresholds, sends notifications |
| `SessionEnd` | Clears session state |

### `claude-code-usage-alert status`

Displays current session information:

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

View or modify configuration from the command line.

```bash
# Show current config
claude-code-usage-alert config

# Set session budget to $10
claude-code-usage-alert config --budget 10.00

# Set custom thresholds
claude-code-usage-alert config --thresholds 30,60,90
```

## Architecture

```
src/
  index.ts                    CLI entry point (subcommand router)
  commands/
    setup.ts                  Setup wizard + hook registration
    hook.ts                   Hook event handler (Stop / SessionStart / SessionEnd)
    status.ts                 Current session status display
    config.ts                 Config CLI viewer/modifier
  core/
    transcript-parser.ts      Incremental JSONL parser (byte-offset based)
    pricing.ts                Model pricing table + cost calculation
    usage-calculator.ts       Percentage calculation + threshold checking
    state-manager.ts          Session state persistence (~/.claude-code-usage-alert/state.json)
  config/
    defaults.ts               Default config values + TypeScript interfaces
    loader.ts                 YAML config loader/saver (~/.claude-code-usage-alert/config.yml)
  notification/
    desktop.ts                OS-native desktop notifications (osascript / notify-send)
    terminal.ts               systemMessage JSON formatter
    dispatcher.ts             Routes notifications to terminal and/or desktop
  utils/
    platform.ts               Platform detection (darwin / linux)
```

### Data flow (Stop hook)

```
stdin (JSON from Claude Code)
  |
  v
hook.ts: parseHookInput()
  |
  +-- transcript-parser.ts: parseTranscript(path, offset)
  |     |
  |     +-- Reads bytes [offset..EOF] from transcript JSONL
  |     +-- Returns { totalTokens, model, newOffset }
  |
  +-- pricing.ts: calculateCost(tokens, model)
  |     |
  |     +-- Looks up model in PRICING_TABLE
  |     +-- Returns cost in USD
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

### Supported models

| Model | Input (per 1M tokens) | Output (per 1M tokens) | Cache Read | Cache Creation |
|-------|----------------------:|----------------------:|-----------:|---------------:|
| claude-opus-4-6 | $15.00 | $75.00 | $1.50 | $18.75 |
| claude-sonnet-4-5 | $3.00 | $15.00 | $0.30 | $3.75 |
| claude-haiku-4-5 | $0.80 | $4.00 | $0.08 | $1.00 |

Model names are resolved with prefix matching (e.g., `claude-sonnet-4-5-20250514` maps to `claude-sonnet-4-5`) and keyword fallback (`opus`, `sonnet`, `haiku`).

## FAQ

### Can this tool read the exact Max plan usage limit from Anthropic?

No. Anthropic does not expose a usage rate or remaining-budget API for Max plan subscribers. This tool uses a **user-defined session budget** as a proxy. You set the amount you consider reasonable for a single session, and the tool alerts you as you approach it.

### How does this differ from [ccusage](https://github.com/ryoppippi/ccusage)?

ccusage is a **post-hoc analysis** tool -- you run it after a session to see how many tokens you used. claude-code-usage-alert is a **real-time notification** tool that runs inside Claude Code via Hooks and warns you *during* your session before you exceed your budget. The JSONL parsing approach is inspired by ccusage.

### Will this slow down Claude Code?

No. The Stop hook runs after each assistant turn with a 5-second timeout. Incremental parsing only reads new bytes since the last check, so it typically completes in single-digit milliseconds. If the hook fails or times out, Claude Code silently ignores it.

### Does it work on Windows?

Not currently. Desktop notifications use `osascript` (macOS) and `notify-send` (Linux). Windows support via PowerShell toast notifications could be added in the future.

## Comparison with Existing Tools

For a detailed analysis of why existing tools did not meet the requirements for real-time, in-session budget alerting, see [docs/competitive-analysis.md](docs/competitive-analysis.md).

## Contributing

Contributions are welcome. Please open an issue first to discuss what you would like to change.

```bash
git clone https://github.com/tackeyy/claude-code-usage-alert.git
cd claude-code-usage-alert
npm install
npm run build
npm test
```

## License

[MIT](LICENSE)
