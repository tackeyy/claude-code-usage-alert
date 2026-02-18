import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { parseTranscript } from '../src/core/transcript-parser.js';

describe('transcript-parser', () => {
  let tmpDir: string;
  let tmpFile: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cc-usage-test-'));
    tmpFile = path.join(tmpDir, 'transcript.jsonl');
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('parses usage from transcript lines', () => {
    const lines = [
      JSON.stringify({
        type: 'request',
        model: 'claude-sonnet-4-5-20250514',
      }),
      JSON.stringify({
        type: 'response',
        model: 'claude-sonnet-4-5-20250514',
        usage: {
          input_tokens: 1000,
          output_tokens: 200,
          cache_read_input_tokens: 500,
          cache_creation_input_tokens: 100,
        },
      }),
    ];
    fs.writeFileSync(tmpFile, lines.join('\n') + '\n');

    const result = parseTranscript(tmpFile, 0);
    expect(result.totalTokens.input).toBe(1000);
    expect(result.totalTokens.output).toBe(200);
    expect(result.totalTokens.cacheRead).toBe(500);
    expect(result.totalTokens.cacheCreation).toBe(100);
    expect(result.model).toBe('claude-sonnet-4-5-20250514');
    expect(result.newOffset).toBeGreaterThan(0);
  });

  it('reads incrementally from offset', () => {
    const line1 = JSON.stringify({
      type: 'response',
      model: 'claude-sonnet-4-5',
      usage: { input_tokens: 1000, output_tokens: 200 },
    });
    const line2 = JSON.stringify({
      type: 'response',
      model: 'claude-sonnet-4-5',
      usage: { input_tokens: 500, output_tokens: 100 },
    });

    // Write first line
    fs.writeFileSync(tmpFile, line1 + '\n');
    const result1 = parseTranscript(tmpFile, 0);
    expect(result1.totalTokens.input).toBe(1000);

    // Append second line
    fs.appendFileSync(tmpFile, line2 + '\n');
    const result2 = parseTranscript(tmpFile, result1.newOffset);
    expect(result2.totalTokens.input).toBe(500);
    expect(result2.totalTokens.output).toBe(100);
  });

  it('returns empty result for non-existent file', () => {
    const result = parseTranscript('/non/existent/file.jsonl', 0);
    expect(result.totalTokens.input).toBe(0);
    expect(result.model).toBe('');
    expect(result.newOffset).toBe(0);
  });

  it('returns same offset when no new data', () => {
    const line = JSON.stringify({
      type: 'response',
      usage: { input_tokens: 100, output_tokens: 50 },
    });
    fs.writeFileSync(tmpFile, line + '\n');

    const result1 = parseTranscript(tmpFile, 0);
    const result2 = parseTranscript(tmpFile, result1.newOffset);
    expect(result2.newOffset).toBe(result1.newOffset);
    expect(result2.totalTokens.input).toBe(0);
  });

  it('handles malformed JSON lines gracefully', () => {
    const lines = [
      'not valid json',
      JSON.stringify({
        type: 'response',
        usage: { input_tokens: 100, output_tokens: 50 },
      }),
      '{ broken',
    ];
    fs.writeFileSync(tmpFile, lines.join('\n') + '\n');

    const result = parseTranscript(tmpFile, 0);
    expect(result.totalTokens.input).toBe(100);
    expect(result.totalTokens.output).toBe(50);
  });

  it('skips incomplete last line without trailing newline', () => {
    const completeLine = JSON.stringify({
      type: 'response',
      usage: { input_tokens: 100, output_tokens: 50 },
    });
    const incompleteLine = '{"type":"response","usage":{"input_tokens":999';
    // Write complete line with newline, then incomplete line without newline
    fs.writeFileSync(tmpFile, completeLine + '\n' + incompleteLine);

    const result = parseTranscript(tmpFile, 0);
    // Should parse only the complete line
    expect(result.totalTokens.input).toBe(100);
    expect(result.totalTokens.output).toBe(50);
    // newOffset should point to end of the complete line (not end of file)
    expect(result.newOffset).toBe(Buffer.byteLength(completeLine + '\n', 'utf-8'));
  });

  it('returns fromOffset when no complete line exists', () => {
    const incompleteLine = '{"type":"response","usage":{"input_toke';
    fs.writeFileSync(tmpFile, incompleteLine);

    const result = parseTranscript(tmpFile, 0);
    expect(result.totalTokens.input).toBe(0);
    expect(result.newOffset).toBe(0);
  });

  it('reads incomplete line on next call once it is complete', () => {
    const line1 = JSON.stringify({
      type: 'response',
      usage: { input_tokens: 100, output_tokens: 50 },
    });
    const line2Part = '{"type":"response","usage":{"input_tokens":200';
    // Write complete line + partial line
    fs.writeFileSync(tmpFile, line1 + '\n' + line2Part);

    const result1 = parseTranscript(tmpFile, 0);
    expect(result1.totalTokens.input).toBe(100);

    // Now complete the second line
    const line2Full = JSON.stringify({
      type: 'response',
      usage: { input_tokens: 200, output_tokens: 80 },
    });
    fs.writeFileSync(tmpFile, line1 + '\n' + line2Full + '\n');

    const result2 = parseTranscript(tmpFile, result1.newOffset);
    expect(result2.totalTokens.input).toBe(200);
    expect(result2.totalTokens.output).toBe(80);
  });

  it('extracts usage from nested message field', () => {
    const line = JSON.stringify({
      type: 'response',
      message: {
        model: 'claude-opus-4-6',
        usage: {
          input_tokens: 2000,
          output_tokens: 400,
          cache_read_input_tokens: 1000,
          cache_creation_input_tokens: 0,
        },
      },
    });
    fs.writeFileSync(tmpFile, line + '\n');

    const result = parseTranscript(tmpFile, 0);
    expect(result.totalTokens.input).toBe(2000);
    expect(result.totalTokens.output).toBe(400);
    expect(result.totalTokens.cacheRead).toBe(1000);
    expect(result.model).toBe('claude-opus-4-6');
  });
});
