# Competitive Analysis: Claude Code Usage Monitoring Tools

## Why claude-code-usage-alert exists

Several open-source tools already track Claude Code usage, each optimized for different use cases -- post-session analysis, visual dashboards, menu bar utilities, and more. Before building claude-code-usage-alert, we surveyed the landscape to understand what was already available and where an unserved niche might exist.

We found that **real-time, in-session budget alerting via the Hooks API** was a gap that none of the existing tools were designed to fill. This document records our evaluation and what we learned from each project.

---

## Requirements

These are the specific requirements for the tool we wanted to build:

| # | Requirement | Rationale |
|:-:|-------------|-----------|
| 1 | **Seamless Claude Code integration** via Hooks + `systemMessage` -- no separate window, terminal, or process | Switching context to check usage defeats the purpose of real-time alerting |
| 2 | **Tiered threshold notifications** (e.g., 50% / 80% / 90%, user-customizable) | A single "you ran out" alert is too late; progressive warnings let you adjust behavior |
| 3 | **Cross-platform** (macOS + Linux) | Team members use both platforms |
| 4 | **Lightweight dependencies** -- no Python runtime, no heavy frameworks | A hook that runs after every turn must be fast and reliable |
| 5 | **Official extension points only** -- Hooks API, local JSONL files; no unofficial APIs, no PTY scraping, no session cookies | Relying on official interfaces reduces the risk of breakage when the CLI updates |

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
| 4 | No | Requires Python + Rich + Pydantic + Sentry SDK. A substantial dependency tree, reflecting its feature-rich dashboard capabilities. |
| 5 | Partial | Accesses API usage data directly rather than through Hooks. Not PTY scraping, but not using the official Hooks extension point either. |

#### Strengths

- **Rich visual dashboard**: Provides a comprehensive real-time view of usage with ML-based prediction -- far more visual depth than a simple alert.
- **Large community**: ~6,600 stars indicates strong adoption and interest.

#### Notes

- Development appears to be paused (last commit September 2025, 80+ open issues).
- The Python + Rich TUI has non-trivial startup time, which is fine for a standalone dashboard but would be a concern if repurposed as a per-turn hook.

#### What we learned from Claude-Code-Usage-Monitor

The ML-based usage prediction concept is compelling. While our tool takes a simpler threshold-based approach, the idea of projecting future spend based on current session patterns is something worth exploring in future versions.

#### Summary

A feature-rich standalone dashboard designed for a different use case than inline alerting. Its architecture is optimized for visual monitoring in a separate terminal rather than Hooks-based integration (requirement 1).

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
| 2 | No | No real-time notification capability. This is by design -- ccusage is an analysis tool, not a monitoring tool. |
| 3 | Yes | TypeScript/Node.js, cross-platform. |
| 4 | Yes | Lightweight Node.js dependencies. |
| 5 | Yes | Reads only local JSONL files, no unofficial APIs. |

#### What we learned from ccusage

ccusage is the most technically mature tool in this space. Its JSONL parsing approach -- reading Claude Code's local transcript files to extract token counts and model information -- is the correct foundation. claude-code-usage-alert uses a similar incremental parsing strategy.

However, ccusage intentionally does not address real-time alerting. It answers "how much did I use?" after the fact, while claude-code-usage-alert answers "am I about to exceed my budget?" during a session.

#### Summary

The most technically mature tool in this space and an excellent choice for post-session analysis. Its design intentionally focuses on retrospective reporting rather than real-time alerting (requirements 1 and 2), which is a different use case from what claude-code-usage-alert targets.

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
| 3 | No | Built specifically for **Linux (NixOS/Hyprland)**. Uses `hyprctl notify` for notifications, so it is tailored to that ecosystem. |
| 4 | Yes | Single Go binary, no runtime dependencies. |
| 5 | - | Uses PTY scraping -- spawns `claude /usage` in a pseudo-terminal and parses the text output. Since the `/usage` output format is not a stable API, this approach may be affected by CLI version updates. |

#### Strengths

- **Single Go binary**: Zero runtime dependencies, fast startup -- an ideal deployment model for CLI tools.
- **Linux-native notifications**: Well-integrated with the NixOS/Hyprland ecosystem.

#### Notes

- The repository does not include a license file, so the terms of use are unclear.
- As a single-maintainer project focused on a specific Linux environment, cross-platform support is not a goal.
- The CLI output-parsing approach may require updates when `claude /usage` output format changes.

#### What we learned from claude-o-meter

The single-binary Go approach is a strong model for distribution simplicity. claude-code-usage-alert similarly aims for minimal dependencies (shell script with no runtime requirements) to keep the integration lightweight.

#### Summary

A focused tool built for the NixOS/Hyprland ecosystem. Its architecture -- PTY scraping and Linux-specific notifications -- reflects different design priorities from our requirements (requirements 3 and 5), but the single-binary philosophy is something we admire.

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
| 5 | - | Relies on claude.ai session cookies to query usage data. Since this is not a documented public API, it may be affected by upstream changes and requires handling session credentials. |

#### What we learned from Claude-Usage-Tracker

The tiered threshold UX is well-designed. The idea of progressive alerts (info at 50%, warning at 80%, critical at 90%) with different notification intensities directly influenced claude-code-usage-alert's threshold configuration.

#### Summary

The best UX among the evaluated tools. Its macOS-native design (requirement 3) and cookie-based data access (requirement 5) reflect a different set of trade-offs from our requirements, but the alert UX is exemplary.

---

### 5. claude-code-limit-tracker

| | |
|---|---|
| **Language** | Python |
| **GitHub Stars** | ~13 |
| **Last Updated** | August 2025 |
| **Approach** | Status line integration with usage estimates |

#### Requirement analysis

| Req | Met? | Details |
|:---:|:----:|---------|
| 1 | Partial | Attempts some terminal integration, but not via the official Hooks `systemMessage` contract. |
| 2 | No | No tiered threshold notification system. Provides a static usage display without progressive alerts. |
| 3 | Partial | Python is cross-platform in theory, but untested on multiple platforms given the project's state. |
| 4 | No | Requires Python + NumPy, which adds a relatively large dependency footprint. |
| 5 | Partial | Approach is unclear from the limited codebase. |

#### Strengths

- **Early exploration of terminal integration**: One of the first projects to attempt showing usage information directly in the terminal session.

#### Notes

- An early-stage project; development has not continued since August 2025.
- No license file is present, so the terms of use are unclear.
- The NumPy dependency adds a relatively heavy footprint for a usage tracking tool.

#### What we learned from claude-code-limit-tracker

This project was an early attempt at bringing usage information closer to the developer's workflow -- a goal we share. It helped validate that there is demand for in-session usage visibility, even though the implementation approach differs from ours.

#### Summary

An early-stage project that explored terminal-based usage display. Development is currently inactive, and it does not cover tiered alerts (requirement 2) or lightweight dependencies (requirement 4), but the concept of in-session visibility was ahead of its time.

---

## Summary Matrix

| Tool | Req 1: Hooks integration | Req 2: Tiered alerts | Req 3: Cross-platform | Req 4: Lightweight deps | Req 5: Official APIs only |
|------|:---:|:---:|:---:|:---:|:---:|
| Claude-Code-Usage-Monitor | - | Partial | Yes | - | Partial |
| ccusage | - | - | Yes | Yes | Yes |
| claude-o-meter | - | Partial | - | Yes | - |
| Claude-Usage-Tracker | - | Yes | - | N/A | - |
| claude-code-limit-tracker | Partial | - | Partial | - | Partial |
| **claude-code-usage-alert** | **Yes** | **Yes** | **Yes** | **Yes** | **Yes** |

Each tool is optimized for a different use case. claude-code-usage-alert targets a specific niche that the others were not designed to fill: **Hooks-native, in-session budget alerting with tiered thresholds.**

---

## claude-code-usage-alert's Position

claude-code-usage-alert builds on ideas from the community:

- **Inspired by ccusage's approach**: local JSONL transcript parsing (proven, reliable, no unofficial APIs)
- **Inspired by Claude-Usage-Tracker's UX**: tiered threshold alerts with escalating severity
- **Hooks-native delivery**: `systemMessage` output appears directly in Claude Code's terminal, and desktop notifications fire in the background

The result targets a niche that complements the existing tools: **a real-time, in-session budget alerting tool that runs inside Claude Code through the official Hooks extension point.**

### Trade-offs we accept

| Trade-off | Why it's acceptable |
|-----------|-------------------|
| Budget is user-estimated, not API-derived | No official usage API exists. User-set budgets are the only viable approach today. |
| Cost calculations are approximate | Based on published per-token pricing; actual billing may differ slightly due to rounding or pricing changes. |
| No historical analysis or dashboards | Out of scope. Use ccusage for post-session analysis. claude-code-usage-alert focuses on real-time alerting only. |
| No Windows support | macOS and Linux cover the primary Claude Code user base. Windows support can be added via PowerShell toast notifications if demand exists. |
