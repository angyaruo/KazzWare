import { expect, test } from 'bun:test';
import { DEFAULTS, replaceRange, settings, slopHits, uniqueRange, textareaRange, textareaOffset } from '../src/shared';
test('literal phrases escape regex syntax and honor Unicode word boundaries', () => {
  expect(slopHits('orbs Orbs sorbs orbsé (a+b) a+b', ['orbs', 'a+b'], true)).toEqual([{ phrase: 'orbs', count: 2 }, { phrase: 'a+b', count: 2 }]);
  expect(slopHits('orbsé', ['orbs'], false)[0].count).toBe(1);
});
test('range editing preserves exact source bytes outside UTF-16 offsets', () => {
  expect(replaceRange('🌑 **old**\r\nend', { start: 5, end: 8 }, 'new')).toBe('🌑 **new**\r\nend');
  expect(() => replaceRange('🌑', { start: 1, end: 2 }, 'x')).toThrow('Unicode');
  expect(() => replaceRange('abc', { start: 2, end: 1 }, '')).toThrow();
  expect(uniqueRange('repeat repeat', 'repeat')).toBeUndefined(); expect(uniqueRange('a **word**', 'word')).toEqual({ start: 4, end: 8 });
});
test('settings enforce bounded lists, intervals, and format', () => {
  expect(() => settings({ ...DEFAULTS, interval: 0 })).toThrow(); expect(() => settings({ ...DEFAULTS, slop: [''] })).toThrow();
  expect(settings({ ...DEFAULTS, slop: ['a', 'a'] }).slop).toEqual(['a']);
});
test('textarea normalized newlines map back to original source offsets', () => {
  const source = '🌑\r\nfirst\rsecond\r\nlast';
  const displayed = source.replace(/\r\n?/g, '\n'); const start = displayed.indexOf('second');
  const range = textareaRange(source, start, start + 6);
  expect(source.slice(range.start, range.end)).toBe('second');
  expect(replaceRange(source, range, 'changed')).toBe('🌑\r\nfirst\rchanged\r\nlast');
  expect(textareaOffset(source, range.start)).toBe(start);
});
