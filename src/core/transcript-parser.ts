/**
 * Incremental JSONL transcript parser.
 * Reads from a byte offset and extracts usage/model information.
 */

import * as fs from 'node:fs';
import { TokenCounts } from './pricing.js';

export interface ParseResult {
  totalTokens: TokenCounts;
  model: string;
  newOffset: number;
}

interface TranscriptUsage {
  input_tokens?: number;
  output_tokens?: number;
  cache_creation_input_tokens?: number;
  cache_read_input_tokens?: number;
}

interface TranscriptLine {
  type?: string;
  model?: string;
  usage?: TranscriptUsage;
  message?: {
    model?: string;
    usage?: TranscriptUsage;
  };
}

/**
 * Parse transcript JSONL file incrementally from a byte offset.
 * Returns aggregated token counts, the last seen model, and the new offset.
 */
export function parseTranscript(
  transcriptPath: string,
  fromOffset: number,
): ParseResult {
  const totalTokens: TokenCounts = {
    input: 0,
    output: 0,
    cacheRead: 0,
    cacheCreation: 0,
  };
  let model = '';

  let stat: fs.Stats;
  try {
    stat = fs.statSync(transcriptPath);
  } catch {
    return { totalTokens, model, newOffset: fromOffset };
  }

  if (stat.size <= fromOffset) {
    return { totalTokens, model, newOffset: fromOffset };
  }

  let newOffset = fromOffset;
  const fd = fs.openSync(transcriptPath, 'r');
  try {
    const bufSize = stat.size - fromOffset;
    const buffer = Buffer.alloc(bufSize);
    fs.readSync(fd, buffer, 0, bufSize, fromOffset);

    const content = buffer.toString('utf-8');

    // If the content doesn't end with a newline, the last segment is an
    // incomplete line (the file is still being written). Skip it so it
    // will be read as a complete line on the next invocation.
    const lastNewline = content.lastIndexOf('\n');
    if (lastNewline === -1) {
      // No complete line at all -- nothing to parse yet
      return { totalTokens, model, newOffset: fromOffset };
    }

    const completeContent = content.slice(0, lastNewline);
    newOffset = fromOffset + Buffer.byteLength(completeContent + '\n', 'utf-8');
    const lines = completeContent.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      try {
        const parsed: TranscriptLine = JSON.parse(trimmed);

        // Extract model name
        if (parsed.model) {
          model = parsed.model;
        } else if (parsed.message?.model) {
          model = parsed.message.model;
        }

        // Extract usage - can be at top level or inside message
        const usage = parsed.usage ?? parsed.message?.usage;
        if (usage) {
          totalTokens.input += usage.input_tokens ?? 0;
          totalTokens.output += usage.output_tokens ?? 0;
          totalTokens.cacheRead += usage.cache_read_input_tokens ?? 0;
          totalTokens.cacheCreation += usage.cache_creation_input_tokens ?? 0;
        }
      } catch {
        // Skip malformed JSON lines
      }
    }
  } finally {
    fs.closeSync(fd);
  }

  return { totalTokens, model, newOffset };
}
