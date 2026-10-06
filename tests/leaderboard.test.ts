import { describe, expect, it } from 'vitest';
import { BOARD_SIZE, cleanInitials, insertEntry, type Entry } from '../src/leaderboard';

const e = (initials: string, value: number, at = '2026-01-01T00:00:00Z'): Entry => ({ initials, value, detail: '', at });

describe('cleanInitials', () => {
  it('uppercases, strips non-letters and caps at 3', () => {
    expect(cleanInitials('j.b-r!x')).toBe('JBR');
  });
  it('keeps short initials as typed and marks blanks anonymous', () => {
    expect(cleanInitials('jb')).toBe('JB');
    expect(cleanInitials('')).toBe('???');
  });
});

describe('insertEntry', () => {
  it('ranks higher values first when higher is better', () => {
    const { board, rank } = insertEntry([e('AAA', 100), e('BBB', 50)], e('NEW', 75), false);
    expect(board.map((x) => x.initials)).toEqual(['AAA', 'NEW', 'BBB']);
    expect(rank).toBe(1);
  });

  it('ranks lower values first for the Hall of Shame', () => {
    const { board, rank } = insertEntry([e('AAA', 10), e('BBB', 40)], e('NEW', 3), true);
    expect(board[0].initials).toBe('NEW');
    expect(rank).toBe(0);
  });

  it('breaks ties in favor of the earlier entry', () => {
    const { rank } = insertEntry([e('OLD', 100, '2026-01-01T00:00:00Z')], e('NEW', 100, '2026-02-01T00:00:00Z'), false);
    expect(rank).toBe(1);
  });

  it('caps the board and reports -1 when the entry misses the cut', () => {
    const full = Array.from({ length: BOARD_SIZE }, (_, i) => e(`P${String.fromCharCode(65 + i)}A`, 1000 - i));
    const { board, rank } = insertEntry(full, e('LOW', 1), false);
    expect(board).toHaveLength(BOARD_SIZE);
    expect(rank).toBe(-1);
  });
});
