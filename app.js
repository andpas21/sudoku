(() => {
  const POINTS = { easy: 1, medium: 3, hard: 5, expert: 10 };
  const NAMES = { easy: 'Facile', medium: 'Medio', hard: 'Difficile', expert: 'Esperto' };
  const MAX_HINTS = 3;
  const KEY = 'sudoku.v1';
  const CUR = 'sudoku.current';
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => [...document.querySelectorAll(s)];
  const E = SudokuEngine;

  // ---------- Storage (unico punto da sostituire per una classifica online) ----------
  const Store = {
    data: null,
    load() {
      try {
        const d = JSON.parse(localStorage.getItem(KEY));
        if (d && Array.isArray(d.games)) { this.data = d; return; }
      } catch {}
      this.data = { name: 'Giocatore', games: [] };
    },
    save() { try { localStorage.setItem(KEY, JSON.stringify(this.data)); } catch {} },
    add(game) { this.data.games.push(game); this.save(); },
    reset() { this.data = { name: this.data.name, games: [] }; this.save(); },
  };
  const saveCurrent = () => {
    try {
      if (g) localStorage.setItem(CUR, JSON.stringify(g));
      else localStorage.removeItem(CUR);
    } catch {}
  };
  const loadCurrent = () => {
    try {
      const c = JSON.parse(localStorage.getItem(CUR));
      if (c && c.board && c.board.length === 81 && c.solution && c.puzzle) return c;
    } catch {}
    return null;
  };

  // ---------- Stato partita ----------
  let g = null;
  let sel = null;

  const PEERS = Array.from({ length: 81 }, (_, i) => {
    const s = new Set();
    for (let j = 0; j < 81; j++) {
      if (j !== i && (E.rowOf(i) === E.rowOf(j) || E.colOf(i) === E.colOf(j) || E.boxOf(i) === E.boxOf(j))) s.add(j);
    }
    return s;
  });

  const fmt = (s) => {
    const h = (s / 3600) | 0, m = ((s % 3600) / 60) | 0, sec = s % 60;
    const mm = String(m).padStart(2, '0'), ss = String(sec).padStart(2, '0');
    return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
  };
  const esc = (t) => String(t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmtDate = (ts) => new Date(ts).toLocaleDateString('it-IT', { day: '2-digit', month: 'short' });
  const potential = () => (g ? Math.max(0, POINTS[g.diff] - g.hintsUsed) : 0);

  // ---------- Dialog ----------
  const dlg = $('#dialog');
  function ask(title, text, ok = 'OK', cancel = 'Annulla') {
    return new Promise((resolve) => {
      $('#dlg-title').textContent = title;
      $('#dlg-text').textContent = text;
      $('#dlg-ok').textContent = ok;
      const c = $('#dlg-cancel');
      c.hidden = cancel === null;
      if (cancel) c.textContent = cancel;
      const done = (v) => { dlg.close(); $('#dlg-ok').onclick = c.onclick = null; resolve(v); };
      $('#dlg-ok').onclick = () => done(true);
      c.onclick = () => done(false);
      dlg.oncancel = () => resolve(false);
      dlg.showModal();
    });
  }

  // ---------- Costruzione UI ----------
  const boardEl = $('#board');
  const cells = [];
  for (let i = 0; i < 81; i++) {
    const b = document.createElement('button');
    b.className = 'cell';
    b.setAttribute('role', 'gridcell');
    b.addEventListener('click', () => { sel = i; render(); });
    boardEl.appendChild(b);
    cells.push(b);
  }
  const padEl = $('#pad');
  const padBtns = [];
  for (let n = 1; n <= 9; n++) {
    const b = document.createElement('button');
    b.textContent = n;
    b.addEventListener('click', () => setValue(n));
    padEl.appendChild(b);
    padBtns.push(b);
  }

  function conflicts() {
    const bad = new Set();
    for (let i = 0; i < 81; i++) {
      const v = g.board[i];
      if (!v) continue;
      for (const j of PEERS[i]) if (g.board[j] === v) { bad.add(i); break; }
    }
    return bad;
  }

  function render() {
    const hasGame = !!g;
    $('#new-panel').hidden = hasGame;
    $('#game-panel').hidden = !hasGame;
    if (!hasGame) {
      const cur = loadCurrent();
      $('#btn-resume').hidden = !cur || cur.over;
      return;
    }
    const bad = conflicts();
    const selVal = sel !== null ? g.board[sel] : 0;
    const counts = new Array(10).fill(0);
    for (let i = 0; i < 81; i++) {
      const v = g.board[i];
      counts[v]++;
      const el = cells[i];
      el.textContent = v || '';
      el.className = 'cell'
        + (g.puzzle[i] ? ' given' : '')
        + (g.hinted[i] ? ' hint' : '')
        + (g.revealed[i] ? ' revealed' : '')
        + (sel !== null && i === sel ? ' sel' : '')
        + (sel !== null && i !== sel && PEERS[sel].has(i) ? ' peer' : '')
        + (selVal && v === selVal && i !== sel ? ' same' : '')
        + (bad.has(i) ? ' err' : '');
    }
    padBtns.forEach((b, k) => { b.classList.toggle('done', counts[k + 1] >= 9); b.disabled = !!g.over; });
    $('#diff-label').textContent = NAMES[g.diff];
    $('#points-label').textContent = g.over ? (g.over === 'won' ? `+${g.points} pt` : '0 pt') : `${potential()} pt`;
    $('#timer').textContent = fmt(g.seconds);
    const left = MAX_HINTS - g.hintsUsed;
    const hint = $('#btn-hint');
    hint.textContent = `Aiuto (${left})`;
    hint.disabled = !!g.over || left <= 0;
    $('#btn-erase').disabled = !!g.over;
    $('#btn-giveup').disabled = !!g.over;
  }

  // ---------- Logica di gioco ----------
  const editable = (i) => g && !g.over && i !== null && !g.puzzle[i] && !g.hinted[i];

  function setValue(n) {
    if (!editable(sel)) return;
    g.board[sel] = n;
    afterMove();
  }
  function erase() {
    if (!editable(sel)) return;
    g.board[sel] = 0;
    afterMove();
  }
  function afterMove() {
    saveCurrent();
    render();
    if (g.board.every((v, i) => v === g.solution[i])) finish('won');
  }

  function useHint() {
    if (!g || g.over || g.hintsUsed >= MAX_HINTS) return;
    const wrong = (i) => !g.puzzle[i] && !g.hinted[i] && g.board[i] !== g.solution[i];
    let i = sel !== null && wrong(sel) ? sel : null;
    if (i === null) {
      const pool = [...Array(81).keys()].filter(wrong);
      if (!pool.length) return;
      i = pool[(Math.random() * pool.length) | 0];
    }
    g.board[i] = g.solution[i];
    g.hinted[i] = true;
    g.hintsUsed++;
    sel = i;
    afterMove();
  }

  async function giveUp() {
    if (!g || g.over) return;
    const ok = await ask('Ti arrendi?', 'Vedrai la soluzione, ma questa partita varrà 0 punti.', 'Mostra soluzione', 'Continua');
    if (!ok) return;
    for (let i = 0; i < 81; i++) {
      if (g.board[i] !== g.solution[i]) g.revealed[i] = true;
      g.board[i] = g.solution[i];
    }
    finish('lost');
  }

  async function finish(result) {
    g.over = result;
    g.points = result === 'won' ? potential() : 0;
    Store.add({
      id: Date.now(), diff: g.diff, result, seconds: g.seconds,
      hints: g.hintsUsed, points: g.points, date: Date.now(),
    });
    saveCurrent();
    render();
    if (result === 'won') {
      await ask('Completato! 🎉',
        `${NAMES[g.diff]} in ${fmt(g.seconds)}\nAiuti usati: ${g.hintsUsed}\nPunti guadagnati: ${g.points}`, 'Ottimo', null);
    }
  }

  function newGame(diff) {
    $('#new-panel').querySelectorAll('.diff').forEach((b) => (b.disabled = true));
    $('#new-panel h1').textContent = 'Genero il puzzle…';
    // lascia al browser il tempo di mostrare il messaggio prima del calcolo
    setTimeout(() => {
      const { puzzle, solution } = E.generate(diff);
      g = {
        diff, puzzle, solution, board: puzzle.slice(),
        hinted: new Array(81).fill(false), revealed: new Array(81).fill(false),
        hintsUsed: 0, seconds: 0, over: null, points: 0,
      };
      sel = null;
      $('#new-panel h1').textContent = 'Nuovo sudoku';
      $('#new-panel').querySelectorAll('.diff').forEach((b) => (b.disabled = false));
      saveCurrent();
      render();
    }, 30);
  }

  async function backToMenu() {
    if (g && !g.over) {
      const ok = await ask('Nuova partita?', 'La partita in corso verrà abbandonata (nessuna statistica registrata).', 'Abbandona', 'Continua');
      if (!ok) return;
    }
    g = null;
    sel = null;
    saveCurrent();
    render();
  }

  // ---------- Timer ----------
  let tick = 0;
  setInterval(() => {
    if (!g || g.over || document.hidden || !$('#view-game').classList.contains('active')) return;
    g.seconds++;
    $('#timer').textContent = fmt(g.seconds);
    if (++tick % 5 === 0) saveCurrent();
  }, 1000);
  document.addEventListener('visibilitychange', () => { if (document.hidden) saveCurrent(); });

  // ---------- Classifica ----------
  let lbFilter = 'all';
  function renderLeaderboard() {
    const filters = [['all', 'Totale'], ...Object.entries(NAMES)];
    $('#lb-filter').innerHTML = filters
      .map(([k, label]) => `<button data-f="${k}" class="${k === lbFilter ? 'on' : ''}">${label}</button>`).join('');
    $$('#lb-filter button').forEach((b) => (b.onclick = () => { lbFilter = b.dataset.f; renderLeaderboard(); }));

    const wins = Store.data.games.filter((x) => x.result === 'won');
    const totalPts = wins.reduce((s, x) => s + x.points, 0);
    let list;
    if (lbFilter === 'all') {
      $('#lb-summary').textContent = `${esc(Store.data.name)}: ${totalPts} punti totali · migliori partite per punti`;
      list = [...wins].sort((a, b) => b.points - a.points || a.seconds - b.seconds);
    } else {
      $('#lb-summary').textContent = `Migliori tempi · ${NAMES[lbFilter]}`;
      list = wins.filter((x) => x.diff === lbFilter).sort((a, b) => a.seconds - b.seconds);
    }
    list = list.slice(0, 10);
    $('#lb-list').innerHTML = list.length
      ? list.map((x, i) => `<li><span class="rank">${i + 1}</span>
          <span>${esc(Store.data.name)}<div class="sub">${NAMES[x.diff]} · ${fmtDate(x.date)}${x.hints ? ` · ${x.hints} aiuti` : ''}</div></span>
          <span>${fmt(x.seconds)}</span><span class="pts">${x.points} pt</span></li>`).join('')
      : '<li class="empty" style="display:block">Nessuna partita completata.</li>';
  }

  // ---------- Profilo ----------
  function renderProfile() {
    const games = Store.data.games;
    const wins = games.filter((x) => x.result === 'won');
    const losses = games.length - wins.length;
    let best = 0, run = 0;
    for (const x of games) { run = x.result === 'won' ? run + 1 : 0; best = Math.max(best, run); }
    const totalPts = wins.reduce((s, x) => s + x.points, 0);
    const totalTime = games.reduce((s, x) => s + x.seconds, 0);
    const hints = games.reduce((s, x) => s + x.hints, 0);
    const rate = games.length ? Math.round((wins.length / games.length) * 100) : 0;
    $('#player-name').value = Store.data.name;
    const cards = [
      [totalPts, 'Punti totali'], [wins.length, 'Completati'], [losses, 'Arresi'], [`${rate}%`, 'Percentuale vittorie'],
      [run, 'Serie attuale'], [best, 'Serie migliore'], [hints, 'Aiuti usati'], [fmt(totalTime), 'Tempo di gioco'],
    ];
    $('#profile-cards').innerHTML = cards.map(([v, l]) => `<div class="card"><b>${v}</b><span>${l}</span></div>`).join('');

    const rows = Object.entries(NAMES).map(([k, label]) => {
      const w = wins.filter((x) => x.diff === k);
      const bestT = w.length ? fmt(Math.min(...w.map((x) => x.seconds))) : '–';
      const avgT = w.length ? fmt(Math.round(w.reduce((s, x) => s + x.seconds, 0) / w.length)) : '–';
      return `<tr><td>${label}</td><td>${w.length}</td><td>${bestT}</td><td>${avgT}</td><td>${w.reduce((s, x) => s + x.points, 0)}</td></tr>`;
    }).join('');
    $('#profile-table').innerHTML = `<table><tr><th>Livello</th><th>Fatti</th><th>Record</th><th>Media</th><th>Punti</th></tr>${rows}</table>`;

    const recent = [...games].reverse().slice(0, 10);
    $('#profile-recent').innerHTML = recent.length
      ? recent.map((x) => `<li><span class="rank">${x.result === 'won' ? '✓' : '✗'}</span>
          <span>${NAMES[x.diff]}<div class="sub">${fmtDate(x.date)}${x.hints ? ` · ${x.hints} aiuti` : ''}</div></span>
          <span>${fmt(x.seconds)}</span><span class="pts">${x.points} pt</span></li>`).join('')
      : '<li class="empty" style="display:block">Ancora nessuna partita.</li>';
  }

  // ---------- Navigazione ----------
  function showView(name) {
    $$('.view').forEach((v) => v.classList.toggle('active', v.id === `view-${name}`));
    $$('.tabs button').forEach((b) => b.classList.toggle('active', b.dataset.view === name));
    if (name === 'leaderboard') renderLeaderboard();
    if (name === 'profile') renderProfile();
    $('main').scrollTop = 0;
  }
  $$('.tabs button').forEach((b) => b.addEventListener('click', () => showView(b.dataset.view)));

  $$('.diff').forEach((b) => b.addEventListener('click', () => newGame(b.dataset.diff)));
  $('#btn-resume').addEventListener('click', () => { g = loadCurrent(); render(); });
  $('#btn-erase').addEventListener('click', erase);
  $('#btn-hint').addEventListener('click', useHint);
  $('#btn-giveup').addEventListener('click', giveUp);
  $('#btn-new').addEventListener('click', backToMenu);
  $('#player-name').addEventListener('input', (e) => {
    Store.data.name = e.target.value.trim().slice(0, 20) || 'Giocatore';
    Store.save();
  });
  $('#btn-reset').addEventListener('click', async () => {
    if (await ask('Azzerare le statistiche?', 'Tutte le partite registrate verranno cancellate. Non si può annullare.', 'Azzera', 'Annulla')) {
      Store.reset();
      renderProfile();
    }
  });

  // tastiera (desktop)
  document.addEventListener('keydown', (e) => {
    if (!g || e.target.tagName === 'INPUT' || !$('#view-game').classList.contains('active')) return;
    if (e.key >= '1' && e.key <= '9') setValue(+e.key);
    else if (e.key === 'Backspace' || e.key === 'Delete' || e.key === '0') erase();
    else if (e.key.startsWith('Arrow')) {
      e.preventDefault();
      let r = sel === null ? 4 : E.rowOf(sel), c = sel === null ? 4 : E.colOf(sel);
      if (e.key === 'ArrowUp') r = Math.max(0, r - 1);
      if (e.key === 'ArrowDown') r = Math.min(8, r + 1);
      if (e.key === 'ArrowLeft') c = Math.max(0, c - 1);
      if (e.key === 'ArrowRight') c = Math.min(8, c + 1);
      sel = r * 9 + c;
      render();
    }
  });

  // ---------- Avvio ----------
  Store.load();
  const saved = loadCurrent();
  if (saved) { g = saved; if (!g.hinted) g.hinted = new Array(81).fill(false); if (!g.revealed) g.revealed = new Array(81).fill(false); }
  render();

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
  }
})();
