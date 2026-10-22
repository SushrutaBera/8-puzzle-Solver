/*
 * solver.js
 * State model and search algorithms for the 8-puzzle.
 *
 * A state is a string of 9 digits read row by row. The digit '0' is the blank.
 * Example: '283164705' is the board
 *     2 8 3
 *     1 6 4
 *     7 0 5
 */

// For each square (0 to 8), the squares the blank can swap with.
const NEIGHBOUR_SQUARES = [
    [1, 3], [0, 2, 4], [1, 5],
    [0, 4, 6], [1, 3, 5, 7], [2, 4, 8],
    [3, 7], [4, 6, 8], [5, 7]
];

// Priorities are "cost * ID_SCALE + id", so equal costs leave the queue oldest first.
const ID_SCALE = 1e7;

/* ---------- Heuristics ---------- */

// Number of tiles that are not on their goal square (the blank is ignored).
function misplacedTiles(state, goal) {
    let count = 0;
    for (let square = 0; square < 9; square++) {
        if (state[square] !== '0' && state[square] !== goal[square]) count++;
    }
    return count;
}

// Sum of row distance plus column distance of every tile from its goal square.
function manhattanDistance(state, goal) {
    let total = 0;
    for (let square = 0; square < 9; square++) {
        if (state[square] === '0') continue;
        const goalSquare = goal.indexOf(state[square]);
        const rowGap = Math.abs(Math.floor(square / 3) - Math.floor(goalSquare / 3));
        const colGap = Math.abs((square % 3) - (goalSquare % 3));
        total += rowGap + colGap;
    }
    return total;
}

const HEURISTICS = { misplaced: misplacedTiles, manhattan: manhattanDistance };

/* ---------- Puzzle helpers ---------- */

// All states reachable in one move, with the number of the tile that slid.
function getSuccessors(state) {
    const blank = state.indexOf('0');
    return NEIGHBOUR_SQUARES[blank].map(square => {
        const tiles = state.split('');
        tiles[blank] = tiles[square];
        tiles[square] = '0';
        return { state: tiles.join(''), tile: Number(state[square]) };
    });
}

// Parity of inversions. Two states can reach each other only if parities match.
function inversionParity(state) {
    const tiles = [...state].filter(t => t !== '0');
    let inversions = 0;
    for (let i = 0; i < tiles.length; i++) {
        for (let j = i + 1; j < tiles.length; j++) {
            if (tiles[i] > tiles[j]) inversions++;
        }
    }
    return inversions % 2;
}

function isSolvable(start, goal) {
    return inversionParity(start) === inversionParity(goal);
}

// Walk away from the goal with random legal moves, so the result is always solvable.
function generateRandomPuzzle(goal) {
    let state = goal;
    let previous = '';
    for (let i = 0; i < 80; i++) {
        const options = getSuccessors(state).filter(next => next.state !== previous);
        previous = state;
        state = options[Math.floor(Math.random() * options.length)].state;
    }
    return state;
}

/* ---------- Priority queue (binary min-heap) ---------- */

class PriorityQueue {
    constructor() { this.items = []; }

    get size() { return this.items.length; }

    push(priority, value) {
        const items = this.items;
        items.push({ priority, value });
        let child = items.length - 1;
        while (child > 0) {
            const parent = (child - 1) >> 1;
            if (items[parent].priority <= items[child].priority) break;
            [items[parent], items[child]] = [items[child], items[parent]];
            child = parent;
        }
    }

    pop() {
        const items = this.items;
        const top = items[0];
        const last = items.pop();
        if (items.length > 0) {
            items[0] = last;
            let parent = 0;
            while (true) {
                const left = 2 * parent + 1;
                const right = left + 1;
                let smallest = parent;
                if (left < items.length && items[left].priority < items[smallest].priority) smallest = left;
                if (right < items.length && items[right].priority < items[smallest].priority) smallest = right;
                if (smallest === parent) break;
                [items[smallest], items[parent]] = [items[parent], items[smallest]];
                parent = smallest;
            }
        }
        return top.value;
    }
}

/* ---------- Search ---------- */

// Decides which frontier node is expanded next. Lower priority value goes first.
function priorityOf(node, algorithm) {
    switch (algorithm) {
        case 'bfs': return node.id;                       // oldest first (queue)
        case 'dfs':
        case 'dls': return -node.id;                      // newest first (stack)
        case 'ucs': return node.g * ID_SCALE + node.id;   // cheapest path so far
        case 'gbfs': return node.h * ID_SCALE + node.id;  // closest to goal by heuristic
        default: return node.f * ID_SCALE + node.id;      // A*: g + h
    }
}

/*
 * Runs one search and records what happened.
 * options: { algorithm, depthLimit, heuristic, costMode, nodeCap }
 *   algorithm: 'ucs' | 'bfs' | 'dfs' | 'dls' | 'iddls' | 'gbfs' | 'astar'
 *   costMode:  'uniform' (every move costs 1) or 'tile' (a move costs the tile number)
 */
function search(startState, goalState, options) {
    const startTime = performance.now();
    const nodeCap = options.nodeCap || 150000;
    const usesHeuristic = options.algorithm === 'gbfs' || options.algorithm === 'astar';
    const heuristic = usesHeuristic ? HEURISTICS[options.heuristic] : () => 0;
    const moveCost = tile => (options.costMode === 'tile' ? tile : 1);

    // Counters shared by all passes (iterative deepening runs several passes).
    let generated = 1;
    let expanded = 0;
    let maxDepth = 0;
    let peakNodes = 1;
    let capped = false;

    // Recorded for the visualiser. Long runs are thinned so the list stays small.
    let trace = [];
    let traceStride = 1;
    let expansionsSeen = 0;
    let rootNode = null;

    function runPass(algorithm, depthLimit) {
        trace = [];
        traceStride = 1;
        expansionsSeen = 0;
        let nextId = 0;
        const recentlyExpanded = [];

        const root = { state: startState, parent: null, tile: null, g: 0, depth: 0, id: nextId++, h: heuristic(startState, goalState) };
        root.f = root.h;
        rootNode = root;

        const frontier = new PriorityQueue();
        frontier.push(priorityOf(root, algorithm), root);
        const explored = new Set();
        const bestCost = new Map([[startState, 0]]);
        const isTreeSearch = algorithm === 'dls';          // DLS only avoids loops along its own path
        const mayImproveCost = algorithm === 'ucs' || algorithm === 'astar';

        while (frontier.size > 0) {
            const node = frontier.pop();

            // A state can sit in the frontier more than once. Skip stale copies.
            if (!isTreeSearch) {
                if (explored.has(node.state)) continue;
                explored.add(node.state);
            }

            expanded++;
            maxDepth = Math.max(maxDepth, node.depth);
            recentlyExpanded.push(node.state);
            if (recentlyExpanded.length > 6) recentlyExpanded.shift();

            const successors = [];
            const isGoal = node.state === goalState;
            const atDepthLimit = algorithm === 'dls' && node.depth >= depthLimit;

            if (!isGoal && !atDepthLimit && expanded < nodeCap) {
                for (const next of getSuccessors(node.state)) {
                    const g = node.g + moveCost(next.tile);

                    if (isTreeSearch) {
                        if (isOnPathTo(node, next.state)) continue;
                    } else {
                        if (explored.has(next.state)) continue;
                        const known = bestCost.get(next.state);
                        if (known !== undefined && (!mayImproveCost || known <= g)) continue;
                        bestCost.set(next.state, g);
                    }

                    const child = { state: next.state, parent: node, tile: next.tile, g, depth: node.depth + 1, id: nextId++, h: heuristic(next.state, goalState) };
                    child.f = child.g + child.h;
                    successors.push(child);
                    frontier.push(priorityOf(child, algorithm), child);
                    generated++;
                }
                peakNodes = Math.max(peakNodes, frontier.size + explored.size);
            }

            expansionsSeen++;
            if (expansionsSeen % traceStride === 0 || isGoal) {
                trace.push(makeTraceFrame(node, successors, frontier, explored.size, recentlyExpanded));
                if (trace.length > 1200) {           // keep every second frame, then record half as often
                    trace = trace.filter((_, i) => i % 2 === 0 || i === trace.length - 1);
                    traceStride *= 2;
                }
            }

            if (isGoal) return node;
            if (expanded >= nodeCap) { capped = true; return null; }
        }
        return null;
    }

    function isOnPathTo(node, state) {
        for (let n = node; n; n = n.parent) {
            if (n.state === state) return true;
        }
        return false;
    }

    function makeTraceFrame(node, successors, frontier, exploredCount, recentlyExpanded) {
        // Peek at the first 15 heap entries and sort them to show who is next in line.
        const preview = frontier.items.slice(0, 15)
            .sort((a, b) => a.priority - b.priority)
            .slice(0, 6)
            .map(entry => entry.value.state + '  g=' + entry.value.g + (usesHeuristic ? ' h=' + entry.value.h : ''));
        return {
            node,
            state: node.state,
            parentState: node.parent ? node.parent.state : null,
            depth: node.depth, g: node.g, h: node.h, f: node.f,
            generated, expanded,
            exploredCount, frontierCount: frontier.size,
            successors: successors.map(c => ({ state: c.state, g: c.g, h: c.h, f: c.f })),
            frontierPreview: preview,
            recentlyExpanded: recentlyExpanded.slice()
        };
    }

    // Iterative deepening repeats depth limited passes with a growing limit.
    let goalNode = null;
    if (options.algorithm === 'iddls') {
        for (let limit = 0; limit <= 40 && !goalNode && !capped; limit++) {
            goalNode = runPass('dls', limit);
        }
    } else {
        goalNode = runPass(options.algorithm, Number(options.depthLimit) || 0);
    }

    // Walk back from the goal to the root to get the solution path.
    const path = [];
    for (let n = goalNode; n; n = n.parent) {
        path.push({ state: n.state, tile: n.tile, g: n.g, node: n });
    }
    path.reverse();

    return {
        found: goalNode !== null,
        capped,
        root: rootNode,
        path,
        trace,
        generated,
        expanded,
        maxDepth,
        peakNodes,
        timeMs: performance.now() - startTime,
        pathCost: goalNode ? goalNode.g : null,
        moves: goalNode ? goalNode.depth : null,
        memoryKb: Math.round(peakNodes * 110 / 1024)   // rough: about 110 bytes per stored node
    };
}