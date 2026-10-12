// Motore Sudoku: generazione con soluzione unica, solver a bitmask con euristica MRV.
const SudokuEngine = (() => {
  const ALL = 0x3fe; // bit 1..9
  const CLUES = { easy: 42, medium: 36, hard: 30, expert: 25 };

  const rowOf = (i) => (i / 9) | 0;
  const colOf = (i) => i % 9;
  const boxOf = (i) => ((rowOf(i) / 3) | 0) * 3 + ((colOf(i) / 3) | 0);

  function shuffle(a) {
    for (let i = a.length - 1; i > 0; i--) {
      const j = (Math.random() * (i + 1)) | 0;
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  const popcount = (m) => {
    let n = 0;
    while (m) { m &= m - 1; n++; }
    return n;
  };

  // Conta le soluzioni (fino a `limit`) e restituisce la prima trovata.
  function solve(grid, limit, randomize) {
    const g = grid.slice();
    const rows = new Array(9).fill(0);
    const cols = new Array(9).fill(0);
    const boxes = new Array(9).fill(0);
    for (let i = 0; i < 81; i++) {
      if (g[i]) {
        const bit = 1 << g[i];
        rows[rowOf(i)] |= bit; cols[colOf(i)] |= bit; boxes[boxOf(i)] |= bit;
      }
    }
    let count = 0;
    let first = null;

    function rec() {
      let best = -1, bestMask = 0, bestN = 10;
      for (let i = 0; i < 81; i++) {
        if (g[i]) continue;
        const mask = ALL & ~(rows[rowOf(i)] | cols[colOf(i)] | boxes[boxOf(i)]);
        const n = popcount(mask);
        if (n === 0) return;
        if (n < bestN) { best = i; bestMask = mask; bestN = n; if (n === 1) break; }
      }
      if (best === -1) {
        count++;
        if (!first) first = g.slice();
        return;
      }
      const digits = [];
      for (let d = 1; d <= 9; d++) if (bestMask & (1 << d)) digits.push(d);
      if (randomize) shuffle(digits);
      const r = rowOf(best), c = colOf(best), b = boxOf(best);
      for (const d of digits) {
        const bit = 1 << d;
        g[best] = d; rows[r] |= bit; cols[c] |= bit; boxes[b] |= bit;
        rec();
        g[best] = 0; rows[r] &= ~bit; cols[c] &= ~bit; boxes[b] &= ~bit;
        if (count >= limit) return;
      }
    }
    rec();
    return { count, solution: first };
  }

  function generate(difficulty) {
    const target = CLUES[difficulty] || CLUES.medium;
    const solution = solve(new Array(81).fill(0), 1, true).solution;
    const puzzle = solution.slice();
    let clues = 81;
    for (const i of shuffle([...Array(81).keys()])) {
      if (clues <= target) break;
      const keep = puzzle[i];
      puzzle[i] = 0;
      if (solve(puzzle, 2, false).count !== 1) puzzle[i] = keep;
      else clues--;
    }
    return { puzzle, solution };
  }

  return { generate, solve, CLUES, rowOf, colOf, boxOf };
})();

if (typeof module !== 'undefined') module.exports = SudokuEngine;
