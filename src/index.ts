#!/usr/bin/env node

/**
 * claude-code-usage-alert - Claude Code usage tracking and budget alerting.
 *
 * Subcommands:
 *   setup   - Initialize config and register hooks
 *   hook    - Process hook events (Stop, SessionStart, SessionEnd)
 *   status  - Show current usage
 *   config  - View/modify configuration
 */

const args = process.argv.slice(2);
const command = args[0];

async function main(): Promise<void> {
  switch (command) {
    case 'setup': {
      const { runSetup } = await import('./commands/setup.js');
      runSetup();
      break;
    }
    case 'hook': {
      const event = args[1];
      if (!event) {
        console.error('Usage: claude-code-usage-alert hook <Stop|SessionStart|SessionEnd>');
        process.exitCode = 1;
        return;
      }
      const { runHook } = await import('./commands/hook.js');
      runHook(event);
      break;
    }
    case 'status': {
      const { runStatus } = await import('./commands/status.js');
      runStatus();
      break;
    }
    case 'config': {
      const { runConfig } = await import('./commands/config.js');
      runConfig(args.slice(1));
      break;
    }
    default: {
      console.log('claude-code-usage-alert - Claude Code usage tracking and budget alerting\n');
      console.log('Usage:');
      console.log('  claude-code-usage-alert setup                         Initialize and register hooks');
      console.log('  claude-code-usage-alert hook <event>                  Process a hook event');
      console.log('  claude-code-usage-alert status                        Show current usage');
      console.log('  claude-code-usage-alert config [--budget N] [--thresholds N,N,N]  View/modify config');
      console.log('');
      console.log('Quick start:');
      console.log('  npx claude-code-usage-alert setup');
      break;
    }
  }
}

main().catch(() => {
  // Never crash - exit cleanly
  process.exitCode = 0;
});
