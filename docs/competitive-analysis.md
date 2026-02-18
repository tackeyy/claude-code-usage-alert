# Competitive Analysis: Claude Code Usage Monitoring Tools

## Why claude-code-usage-alert exists

Several open-source tools already track Claude Code usage. Before building claude-code-usage-alert, we evaluated each of them against the specific requirements for a real-time, in-session budget alerting tool. None of the existing tools satisfied all five requirements simultaneously.

This document records the evaluation.

---

## Requirements

These are the non-negotiable requirements that motivated creating a new tool:

| # | Requirement | Rationale |
|:-:|-------------|-----------|
| 1 | **Seamless Claude Code integration** via Hooks + `systemMessage` -- no separate window, terminal, or process | Switching context to check usage defeats the purpose of real-time alerting |
| 2 | **Tiered threshold notifications** (e.g., 50% / 80% / 90%, user-customizable) | A single "you ran out" alert is too late; progressive warnings let you adjust behavior |
| 3 | **Cross-platform** (macOS + Linux) | Team members use both platforms |
| 4 | **Lightweight dependencies** -- no Python runtime, no heavy frameworks | A hook that runs after every turn must be fast and reliable |
| 5 | **Official extension points only** -- Hooks API, local JSONL files; no unofficial APIs, no PTY scraping, no session cookies | Non-official integrations break silently when the CLI updates |

---

## Tool Evaluations

### 1. Claude-Code-Usage-Monitor

| | |
|---|---|
| **Language** | Python |
| **GitHub Stars** | ~6,600 |
| **Last Updated** | September 2025 (~5 months ago) |
| **Approach** | Separate terminal window with real-time dashboard, ML-based usage prediction |

#### Requirement analysis

| Req | Met? | Details |
|:---:|:----:|---------|
| 1 | No | Runs as a **standalone terminal application**. You must open a separate terminal window and keep it visible alongside Claude Code. There is no Hooks integration and no `systemMessage` output. |
| 2 | Partial | Has alerting capabilities, but they appear in the monitor's own window, not inside Claude Code. |
| 3 | Yes | Python is cross-platform. |
| 4 | No | Requires Python + Rich + Pydantic + Sentry SDK. Heavy dependency tree for a monitoring tool. |
| 5 | Partial | Accesses API usage data directly rather than through Hooks. Not PTY scraping, but not using the official Hooks extension point either. |

#### Additional concerns

- **Maintenance stalled**: 80+ open issues, last commit September 2025. No indication of active development.
- **Startup overhead**: The Python + Rich TUI has non-trivial startup time, acceptable for a standalone app but unsuitable for a hook that runs after every turn.

#### Verdict

The "separate window" architecture is fundamentally incompatible with requirement 1. This is a dashboard tool, not an inline alerting tool.

---

### 2. ccusage

| | |
|---|---|
| **Language** | TypeScript |
| **GitHub Stars** | ~10,800 |
| **Last Updated** | Active (regular releases) |
| **Approach** | CLI tool that parses local transcript JSONL files for post-session analysis |

#### Requirement analysis

| Req | Met? | Details |
|:---:|:----:|---------|
| 1 | No | A standalone CLI tool. You run it manually after a session to get a usage report. No Hooks integration, no `systemMessage` output. |
| 2 | No | **No real-time notification capability at all.** This is by design -- ccusage is an analysis tool, not a monitoring tool. |
| 3 | Yes | TypeScript/Node.js, cross-platform. |
| 4 | Yes | Lightweight Node.js dependencies. |
| 5 | Yes | Reads only local JSONL files, no unofficial APIs. |

#### What we learned from ccusage

ccusage is the most technically mature tool in this space. Its JSONL parsing approach -- reading Claude Code's local transcript files to extract token counts and model information -- is the correct foundation. claude-code-usage-alert uses a similar incremental parsing strategy.

However, ccusage intentionally does not address real-time alerting. It answers "how much did I use?" after the fact, while claude-code-usage-alert answers "am I about to exceed my budget?" during a session.

#### Verdict

Excellent tool for post-session analysis. Does not attempt to solve the real-time alerting problem (requirements 1 and 2).

---

### 3. claude-o-meter

| | |
|---|---|
| **Language** | Go |
| **GitHub Stars** | ~11 |
| **Last Updated** | 2025 |
| **Approach** | PTY scraping of `claude /usage` command output |

#### Requirement analysis

| Req | Met? | Details |
|:---:|:----:|---------|
| 1 | No | Runs as an external process. No Hooks integration. |
| 2 | Partial | Has some threshold logic, but notifications appear outside Claude Code. |
| 3 | No | Built specifically for **Linux (NixOS/Hyprland)**. Uses `hyprctl notify` for notifications. macOS support is limited or absent. |
| 4 | Yes | Single Go binary, no runtime dependencies. |
| 5 | No | **PTY scraping** -- spawns `claude /usage` in a pseudo-terminal and parses the text output. This breaks when Anthropic changes the output format of the `/usage` command. |

#### Additional concerns

- **No license**: The repository does not include a license file, making it legally unusable in most contexts.
- **Tiny community**: 11 stars, single maintainer, no indication of broad adoption.
- **Fragile integration**: PTY scraping is inherently brittle. The `/usage` command's output format is not a stable API.

#### Verdict

The PTY scraping approach (requirement 5) and Linux-only design (requirement 3) are disqualifying. The lack of a license is an additional blocker.

---

### 4. Claude-Usage-Tracker

| | |
|---|---|
| **Language** | Swift |
| **GitHub Stars** | ~1,200 |
| **Last Updated** | Active |
| **Approach** | macOS menu bar application with usage visualization |

#### Requirement analysis

| Req | Met? | Details |
|:---:|:----:|---------|
| 1 | No | A **standalone macOS menu bar application**. Provides a nice UI for checking usage, but it lives outside Claude Code. No Hooks integration. |
| 2 | Yes | Has threshold-based alerting with configurable levels. Good UX for progressive warnings. |
| 3 | No | **macOS only.** Written in Swift with AppKit/SwiftUI. Cannot run on Linux. |
| 4 | N/A | Native macOS app, no external runtime. But the flip side is it cannot run on Linux at all. |
| 5 | No | Relies on **claude.ai sessionKey cookies** to query usage data. This is an unofficial, undocumented API that can break at any time and raises security concerns (storing session cookies). |

#### What we learned from Claude-Usage-Tracker

The tiered threshold UX is well-designed. The idea of progressive alerts (info at 50%, warning at 80%, critical at 90%) with different notification intensities directly influenced claude-code-usage-alert's threshold configuration.

#### Verdict

Best UX among the evaluated tools, but the macOS-only constraint (requirement 3) and cookie-based API access (requirement 5) are disqualifying.

---

### 5. claude-code-limit-tracker

| | |
|---|---|
| **Language** | Python |
| **GitHub Stars** | ~13 |
| **Last Updated** | August 2025 (created and abandoned within 2 days) |
| **Approach** | Status line integration with usage estimates |

#### Requirement analysis

| Req | Met? | Details |
|:---:|:----:|---------|
| 1 | Partial | Attempts some terminal integration, but not via the official Hooks `systemMessage` contract. |
| 2 | No | No tiered threshold notification system. Provides a static usage display without progressive alerts. |
| 3 | Partial | Python is cross-platform in theory, but untested on multiple platforms given the project's state. |
| 4 | No | Requires Python + **NumPy**. NumPy is a heavy dependency for a usage tracker. |
| 5 | Partial | Approach is unclear from the limited codebase. |

#### Additional concerns

- **Effectively abandoned**: Created on August 19, 2025. Last commit on August 21, 2025. Two days of development, then nothing.
- **No license**: No license file, same legal concern as claude-o-meter.
- **NumPy dependency**: Pulling in NumPy (and its transitive dependencies) for a usage tracking tool is disproportionate.

#### Verdict

An abandoned proof-of-concept. Does not meet requirements 2 or 4, and the project's state makes it unsuitable for any use.

---

## Summary Matrix

| Tool | Req 1: Hooks integration | Req 2: Tiered alerts | Req 3: Cross-platform | Req 4: Lightweight deps | Req 5: Official APIs only |
|------|:---:|:---:|:---:|:---:|:---:|
| Claude-Code-Usage-Monitor | No | Partial | Yes | No | Partial |
| ccusage | No | No | Yes | Yes | Yes |
| claude-o-meter | No | Partial | No | Yes | No |
| Claude-Usage-Tracker | No | Yes | No | N/A | No |
| claude-code-limit-tracker | Partial | No | Partial | No | Partial |
| **claude-code-usage-alert** | **Yes** | **Yes** | **Yes** | **Yes** | **Yes** |

No existing tool satisfies all five requirements. The gap is consistent: **no tool integrates directly into Claude Code via Hooks with real-time tiered notifications.**

---

## claude-code-usage-alert's Position

claude-code-usage-alert combines:

- **ccusage's approach**: local JSONL transcript parsing (proven, reliable, no unofficial APIs)
- **Claude-Usage-Tracker's UX concept**: tiered threshold alerts with escalating severity
- **Hooks-native delivery**: `systemMessage` output appears directly in Claude Code's terminal, and desktop notifications fire in the background

The result occupies a position that none of the existing tools target: **a real-time, in-session budget alerting tool that runs inside Claude Code through the official Hooks extension point.**

### Trade-offs we accept

| Trade-off | Why it's acceptable |
|-----------|-------------------|
| Budget is user-estimated, not API-derived | No official usage API exists. User-set budgets are the only viable approach today. |
| Cost calculations are approximate | Based on published per-token pricing; actual billing may differ slightly due to rounding or pricing changes. |
| No historical analysis or dashboards | Out of scope. Use ccusage for post-session analysis. claude-code-usage-alert focuses on real-time alerting only. |
| No Windows support | macOS and Linux cover the primary Claude Code user base. Windows support can be added via PowerShell toast notifications if demand exists. |
