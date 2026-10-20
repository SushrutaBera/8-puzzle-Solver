const STUDENT = { name: 'Sushruta Bera', reg: '24BAI0163', course: 'BCSE306L', title: 'Interactive 8-Puzzle Problem Solver using AI Search Algorithms' };
const $ = id => document.getElementById(id);
let start = '283164705', goal = '123804765', tl = [], idx = 0, timer = null, res = null;
const cells = s => [...s].map(c => `<i class="${c === '0' ? 'z' : ''}">${c}</i>`).join('');
const fmt = n => typeof n === 'number' ? (Number.isInteger(n) ? n : n.toFixed(2)) : n;
/* navigation */
document.querySelectorAll('[data-p]').forEach(b => b.onclick = () => { document.querySelectorAll('.pg').forEach(p => p.classList.toggle('d-none', p.id !== b.dataset.p)); document.querySelectorAll('.tabs button').forEach(t => t.classList.toggle('on', t.dataset.p === b.dataset.p)) });
$('h-title').textContent = STUDENT.title; $('h-course').textContent = STUDENT.course; $('h-name').textContent = STUDENT.name; $('h-reg').textContent = STUDENT.reg;
/* inputs */
['s', 'g'].forEach(p => { $('g-' + p).innerHTML = Array.from({ length: 9 }, (_, i) => `<input maxlength="1" aria-label="${p === 's' ? 'Start' : 'Goal'} cell ${i + 1}">`).join('') });
const setGrid = (p, s) => $('g-' + p).querySelectorAll('input').forEach((e, i) => e.value = s[i] === '0' ? '_' : s[i]);
const getGrid = p => { const v = [...$('g-' + p).querySelectorAll('input')].map(e => /^[_ 0]?$/.test(e.value) ? '0' : e.value).join(''); return v.length === 9 && [...'012345678'].every(c => v.includes(c)) ? v : null };
const say = (t, err) => { $('msg').textContent = t; $('msg').className = 'msg' + (err ? ' err' : '') };
function setPuzzle(s, g) { start = s; goal = g; setGrid('s', s); setGrid('g', g); $('m-s').innerHTML = cells(s); $('m-g').innerHTML = cells(g); $('demo').innerHTML = cells(s); stop(); tl = []; idx = 0; $('sum').classList.add('d-none'); place(s); $('phase').textContent = 'Current state' }
$('b-apply').onclick = () => { const s = getGrid('s'), g = getGrid('g'); if (!s || !g) return say('Each grid must contain every digit from 0 to 8 exactly once.', 1); if (!solvable(s, g)) return say('This start state cannot reach this goal. Swap any two tiles in one grid.', 1); setPuzzle(s, g); say('Puzzle set.') };
$('b-rand').onclick = () => { const g = getGrid('g') || '123456780'; setPuzzle(randomPuzzle(g), g); say('Random solvable puzzle created.') };
$('algo').onchange = () => { const a = $('algo').value; $('o-dls').classList.toggle('d-none', a !== 'dls'); $('o-h').classList.toggle('d-none', a !== 'gbfs' && a !== 'astar') };
/* board with sliding tiles */
$('board').innerHTML = [1, 2, 3, 4, 5, 6, 7, 8].map(t => `<div class="tile" id="t${t}"><span>${t}</span></div>`).join('');
function place(s) { for (let t = 1; t <= 8; t++) { const i = s.indexOf(t), e = $('t' + t); e.style.left = (i % 3) * 33.333 + '%'; e.style.top = (i / 3 | 0) * 33.333 + '%' } }
const opts = () => ({ algo: $('algo').value, limit: $('limit').value, heur: $('heur').value, cost: $('cost').value });
/* playback */
function prepare() {
    stop(); res = search(start, goal, opts()); const o = opts();
    tl = res.trace.map(f => ({ k: 's', ...f })); res.path.forEach((p, i) => tl.push({ k: 'p', s: p.s, i, g: p.g, tile: p.tile })); idx = 0; render()
}
function render() {
    const f = tl[idx]; if (!f) return; place(f.s); const inf = ['gbfs', 'astar'].includes($('algo').value);
    let rows;
    if (f.k === 's') {
        $('phase').textContent = 'Searching: node being expanded';
        rows = [['Node expanded', f.s], ['Parent', f.p || 'none (root)'], ['Depth', f.d], ['Path cost g(n)', f.g]];
        if (inf) rows.push(['Heuristic h(n)', f.h], ['Evaluation f(n)', f.f]);
        rows.push(['Nodes generated', f.gen], ['Nodes expanded', f.exp], ['Frontier size', f.fs], ['Explored size', f.ex]);
        $('kids').innerHTML = f.kids.length ? f.kids.map(k => `<div><div class="mini">${cells(k.s)}</div><div class="kid">g=${k.g}${inf ? ` h=${k.h} f=${k.f}` : ''}</div></div>`).join('') : '<span class="hint">No new successors.</span>';
        $('fr').innerHTML = f.fr.map(x => `<li>${x}</li>`).join('') || '<li>empty</li>'; $('ex').innerHTML = f.recent.slice().reverse().map(x => `<li>${x}</li>`).join('')
    }
    else { $('phase').textContent = `Solution path, step ${f.i} of ${res.path.length - 1}`; rows = [['State', f.s], ['Tile moved', f.i ? f.tile : 'none'], ['Cost so far', f.g]]; $('kids').innerHTML = ''; }
    $('stat').innerHTML = rows.map(r => `<tr><td>${r[0]}</td><td>${r[1]}</td></tr>`).join('');
    if (idx === tl.length - 1) summary();
}
function summary() {
    const r = res; $('sum').classList.remove('d-none');
    const rows = [['Result', r.found ? 'Solution found' : (r.capped ? 'Not found (node limit reached)' : 'Not found')], ['Total moves', fmt(r.moves ?? '-')], ['Nodes generated', r.gen], ['Nodes expanded', r.exp], ['Maximum depth reached', r.maxD], ['Execution time', r.ms.toFixed(1) + ' ms'], ['Path cost', fmt(r.cost ?? '-')], ['Approximate memory', r.kb + ' KB (peak nodes x 110 bytes)']];
    $('sumt').innerHTML = rows.map(x => `<tr><td>${x[0]}</td><td>${x[1]}</td></tr>`).join('');
    $('path').innerHTML = r.path.map((p, i) => `<div><div class="mini">${cells(p.s)}</div><div class="kid">step ${i}</div></div>`).join('')
}
const delay = () => Math.round(1200 / Math.pow($('speed').value, 1.4));
function play() { stop(); if (!tl.length) return; timer = setInterval(() => { if (idx >= tl.length - 1) return stop(); idx++; render() }, delay()) }
function stop() { clearInterval(timer); timer = null }
$('c-run').onclick = () => { prepare(); play() };
$('c-pause').onclick = stop;
$('c-resume').onclick = () => { if (idx >= tl.length - 1) idx = 0; play() };
$('c-next').onclick = () => { stop(); if (!tl.length) prepare(); else if (idx < tl.length - 1) { idx++; render() } };
$('c-prev').onclick = () => { stop(); if (idx > 0) { idx--; render() } };
$('c-reset').onclick = () => { stop(); idx = 0; if (tl.length) render(); else place(start); $('sum').classList.add('d-none') };
$('speed').oninput = () => { if (timer) play() };
/* comparison */
$('b-cmp').onclick = () => {
    $('cmpt').innerHTML = '<tr><td>Running...</td></tr>'; setTimeout(() => {
        const names = { ucs: 'UCS', bfs: 'BFS', dfs: 'DFS', dls: 'DLS', iddls: 'IDDLS', gbfs: 'GBFS', astar: 'A*' };
        const body = Object.keys(names).map(a => {
            const r = search(start, goal, { ...opts(), algo: a });
            return `<tr><td>${names[a]}</td><td>${r.found ? 'Yes' : (r.capped ? 'No (limit)' : 'No')}</td><td>${r.exp}</td><td>${r.gen}</td><td>${r.moves ?? '-'}</td><td>${r.cost ?? '-'}</td><td>${r.ms.toFixed(1)} ms</td><td>${r.kb} KB</td></tr>`
        }).join('');
        $('cmpt').innerHTML = '<tr><th>Algorithm</th><th>Solution found</th><th>Nodes expanded</th><th>Nodes generated</th><th>Moves</th><th>Path cost</th><th>Time</th><th>Memory</th></tr>' + body
    }, 30)
};
/* info page */
$('infos').innerHTML = Object.values(INFO).map(v => `<div class="info-item"><h3 class="h5">${v[0]}</h3><dl>${LABELS.slice(1).map((l, i) => `<dt>${l}</dt><dd>${v[i + 1]}</dd>`).join('')}</dl></div>`).join('');
setPuzzle(start, goal);
