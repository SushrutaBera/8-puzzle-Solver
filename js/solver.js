const MOVES = [[1, 3], [0, 2, 4], [1, 5], [0, 4, 6], [1, 3, 5, 7], [2, 4, 8], [3, 7], [4, 6, 8], [5, 7]];
const misplaced = (s, g) => { let d = 0; for (let i = 0; i < 9; i++)if (s[i] !== '0' && s[i] !== g[i]) d++; return d };
const manhattan = (s, g) => { let d = 0; for (let i = 0; i < 9; i++)if (s[i] !== '0') { const j = g.indexOf(s[i]); d += Math.abs((i / 3 | 0) - (j / 3 | 0)) + Math.abs(i % 3 - j % 3) } return d };
const HEUR = { misplaced, manhattan };
function neighbors(s) { const z = s.indexOf('0'); return MOVES[z].map(j => { const a = s.split(''); a[z] = a[j]; a[j] = '0'; return { state: a.join(''), tile: +s[j] } }) }
const inv = s => { let c = 0; const a = [...s].filter(x => x !== '0'); for (let i = 0; i < 8; i++)for (let j = i + 1; j < 8; j++)if (a[i] > a[j]) c++; return c % 2 };
const solvable = (s, g) => inv(s) === inv(g);
function randomPuzzle(goal) { let s = goal, prev = ''; for (let i = 0; i < 80; i++) { const n = neighbors(s).filter(x => x.state !== prev); prev = s; s = n[Math.random() * n.length | 0].state } return s }
class Heap {
    constructor() { this.a = [] } get size() { return this.a.length }
    push(k, v) { const a = this.a; a.push({ k, v }); let i = a.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (a[p].k <= a[i].k) break;[a[p], a[i]] = [a[i], a[p]]; i = p } }
    pop() { const a = this.a, top = a[0], last = a.pop(); if (a.length) { a[0] = last; let i = 0; for (; ;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < a.length && a[l].k < a[m].k) m = l; if (r < a.length && a[r].k < a[m].k) m = r; if (m === i) break;[a[m], a[i]] = [a[i], a[m]]; i = m } } return top.v }
}

/* o: {algo, limit, heur, cost, cap}. Returns stats, path and a thinned trace of expansions. */
function search(start, goal, o) {
    const t0 = performance.now(), cap = o.cap || 150000;
    const informed = o.algo === 'gbfs' || o.algo === 'astar', H = informed ? HEUR[o.heur] : () => 0;
    const sc = t => o.cost === 'tile' ? t : 1;
    let gen = 1, exp = 0, maxD = 0, peak = 1, capped = false, trace = [], stride = 1, tick = 0, closedSize = 0;
    const run = (algo, limit) => {
        trace = []; stride = 1; tick = 0; let n = 0; const recent = [];
        const key = x => algo === 'bfs' ? x.id : (algo === 'dfs' || algo === 'dls') ? -x.id : (algo === 'ucs' ? x.g : algo === 'gbfs' ? x.h : x.f) * 1e7 + x.id;
        const root = { state: start, parent: null, g: 0, d: 0, id: n++, h: H(start, goal) }; root.f = root.h;
        const open = new Heap(), closed = new Set(), best = new Map([[start, 0]]); open.push(key(root), root);
        const tree = algo === 'dls', weighted = algo === 'ucs' || algo === 'astar';
        while (open.size) {
            const x = open.pop();
            if (!tree) { if (closed.has(x.state)) continue; closed.add(x.state) }
            exp++; closedSize = closed.size; maxD = Math.max(maxD, x.d);
            recent.push(x.state); if (recent.length > 6) recent.shift();
            const kids = [];
            if (x.state !== goal && !(algo === 'dls' && x.d >= limit) && exp < cap) {
                for (const nb of neighbors(x.state)) {
                    const g = x.g + sc(nb.tile);
                    if (tree) { let bad = false; for (let a = x; a; a = a.parent)if (a.state === nb.state) { bad = true; break } if (bad) continue }
                    else {
                        if (closed.has(nb.state)) continue;
                        if (weighted) { if (best.has(nb.state) && best.get(nb.state) <= g) continue } else if (best.has(nb.state)) continue;
                        best.set(nb.state, g)
                    }
                    const k = { state: nb.state, tile: nb.tile, parent: x, g, d: x.d + 1, id: n++, h: H(nb.state, goal) }; k.f = k.g + k.h;
                    kids.push(k); open.push(key(k), k); gen++;
                }
                peak = Math.max(peak, open.size + closed.size);
            }
            if (++tick % stride === 0 || x.state === goal) {
                trace.push({
                    s: x.state, p: x.parent && x.parent.state, d: x.d, g: x.g, h: x.h, f: x.f, gen, exp, ex: closedSize, fs: open.size,
                    kids: kids.map(k => ({ s: k.state, g: k.g, h: k.h, f: k.f })),
                    fr: open.a.slice(0, 15).sort((a, b) => a.k - b.k).slice(0, 6).map(e => e.v.state + '  g=' + e.v.g + (informed ? ' h=' + e.v.h : '')), recent: recent.slice()
                });
                if (trace.length > 3000) { trace = trace.filter((_, i) => i % 2 === 0 || i === trace.length - 1); stride *= 2 }
            }
            if (x.state === goal) return x;
            if (exp >= cap) { capped = true; return null }
        }
        return null;
    };
    let end = null;
    if (o.algo === 'iddls') { for (let L = 0; L <= 40 && !end && !capped; L++)end = run('dls', L) }
    else end = run(o.algo, +o.limit || 0);
    const path = []; for (let x = end; x; x = x.parent)path.push({ s: x.state, tile: x.tile, g: x.g }); path.reverse();
    return { found: !!end, capped, path, trace, gen, exp, maxD, peak, ms: performance.now() - t0, cost: end ? end.g : null, moves: end ? end.d : null, kb: Math.round(peak * 110 / 1024) };
}
