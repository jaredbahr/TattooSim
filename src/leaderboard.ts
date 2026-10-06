/**
 * Leaderboards: arcade-style initials, top 10 per board.
 *
 *   demo  - best Demo Day earnings
 *   shop  - best single day in the full game
 *   shame - the worst tattoos ever inked (lowest likeness wins, obviously)
 *
 * Ranking is pure (`insertEntry`) so it's unit-testable. Storage sits behind the
 * `LeaderboardStore` interface: today it's this browser's localStorage; a shared online
 * backend can implement the same two methods without touching the game.
 */

export type BoardId = 'demo' | 'shop' | 'shame';

export interface Entry {
  initials: string;
  /** Dollars for demo/shop; likeness % for shame. */
  value: number;
  /** Short context line, e.g. "Day 3 · avg 81%" or "Bald Eagle on Gary". */
  detail: string;
  /** ISO timestamp; used as a tie-breaker (earlier wins) and to highlight new entries. */
  at: string;
}

export const BOARD_SIZE = 10;

export const BOARDS: Record<BoardId, { title: string; lowerIsBetter: boolean; unit: '$' | '%' }> = {
  demo: { title: 'Demo Day', lowerIsBetter: false, unit: '$' },
  shop: { title: 'Best Day', lowerIsBetter: false, unit: '$' },
  shame: { title: 'Hall of Shame', lowerIsBetter: true, unit: '%' },
};

/** Uppercase A–Z only, 1–3 letters. Blank becomes "???" (anonymous, arcade-style). */
export function cleanInitials(raw: string): string {
  const letters = raw.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 3);
  return letters || '???';
}

/**
 * Insert an entry into a ranked board. Returns the new board (max BOARD_SIZE) and the
 * entry's 0-based rank, or -1 if it didn't make the cut.
 */
export function insertEntry(
  board: readonly Entry[],
  entry: Entry,
  lowerIsBetter: boolean,
): { board: Entry[]; rank: number } {
  const better = (a: Entry, b: Entry) => {
    if (a.value !== b.value) return lowerIsBetter ? a.value - b.value : b.value - a.value;
    return a.at.localeCompare(b.at);
  };
  const next = [...board, entry].sort(better).slice(0, BOARD_SIZE);
  return { board: next, rank: next.indexOf(entry) };
}

export interface LeaderboardStore {
  top(board: BoardId): Promise<Entry[]>;
  submit(board: BoardId, entry: Entry): Promise<{ rank: number; board: Entry[] }>;
}

/** Per-browser storage. Survives reloads; not shared between devices. */
export class LocalLeaderboard implements LeaderboardStore {
  private key(board: BoardId): string {
    return `cheeky-business:board:${board}`;
  }

  async top(board: BoardId): Promise<Entry[]> {
    try {
      const raw = localStorage.getItem(this.key(board));
      const parsed = raw ? (JSON.parse(raw) as Entry[]) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  async submit(board: BoardId, entry: Entry): Promise<{ rank: number; board: Entry[] }> {
    const result = insertEntry(await this.top(board), entry, BOARDS[board].lowerIsBetter);
    try {
      localStorage.setItem(this.key(board), JSON.stringify(result.board));
    } catch {
      /* storage unavailable (private mode): the board just won't persist */
    }
    return result;
  }
}

const INITIALS_KEY = 'cheeky-business:initials';

export function lastInitials(): string {
  try {
    return localStorage.getItem(INITIALS_KEY) ?? '';
  } catch {
    return '';
  }
}

export function rememberInitials(initials: string): void {
  try {
    localStorage.setItem(INITIALS_KEY, initials);
  } catch {
    /* not critical */
  }
}
