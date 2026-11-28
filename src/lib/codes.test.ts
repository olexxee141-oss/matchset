import { describe, expect, it } from 'vitest';
import { extractCode } from './codes';

describe('extractCode', () => {
  it('accepts a plain code and a matching path segment', () => {
    expect(extractCode('abc12345', 'community')).toBe('abc12345');
    expect(extractCode('community/abc12345', 'community')).toBe('abc12345');
  });
  it('extracts the final code from an invite URL', () => {
    expect(extractCode('https://example.test/community/abc12345', 'community')).toBe('abc12345');
  });
  it('rejects malformed, too-short, and wrong-kind inputs', () => {
    expect(extractCode('abc', 'community')).toBe('');
    expect(extractCode('community/abc12345', 'set')).toBe('');
    expect(extractCode('https://[invalid', 'community')).toBe('');
  });
});
