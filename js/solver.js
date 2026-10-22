/*
 * solver.js
 * State model and Uniform Cost Search for the 8-puzzle.
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

// Priority is "cost * ID_SCALE + id", so nodes with equal cost leave the queue oldest first.
const ID_SCALE = 1e7;

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

/* ---------- Uniform Cost Search ---------- */

/*
 * Expands the frontier node with the lowest path cost g(n) until the goal is expanded.
 * options: { costMode, nodeCap }
 *   costMode: 'uniform' (every move costs 1) or 'tile' (a move costs the number on the tile)
 */
function uniformCostSearch(startState, goalState, options) {
    const startTime = performance.now();
    const nodeCap = options.nodeCap || 150000;
    const moveCost = tile => (options.costMode === 'tile' ? tile : 1);

    let generated = 1;
    let expanded = 0;
    let maxDepth = 0;
    let peakNodes = 1;
    let capped = false;
    let nextId = 0;

    // Recorded for the visualiser. Long runs are thinned so the list stays small.
    let trace = [];
    let traceStride = 1;
    const recentlyExpanded = [];

    const root = { state: startState, parent: null, tile: null, g: 0, depth: 0, id: nextId++ };
    const frontier = new PriorityQueue();
    frontier.push(root.g * ID_SCALE + root.id, root);
    const explored = new Set();
    const cheapestKnown = new Map([[startState, 0]]);   // best g found so far for each state
    let goalNode = null;

    while (frontier.size > 0) {
        const node = frontier.pop();

        // A state can sit in the frontier more than once. Skip the stale copies.
        if (explored.has(node.state)) continue;
        explored.add(node.state);

        expanded++;
        maxDepth = Math.max(maxDepth, node.depth);
        recentlyExpanded.push(node.state);
        if (recentlyExpanded.length > 6) recentlyExpanded.shift();

        const isGoal = node.state === goalState;
        const successors = [];

        if (!isGoal && expanded < nodeCap) {
            for (const next of getSuccessors(node.state)) {
                if (explored.has(next.state)) continue;
                const g = node.g + moveCost(next.tile);
                const known = cheapestKnown.get(next.state);
                if (known !== undefined && known <= g) continue;   // already have a route that is as cheap
                cheapestKnown.set(next.state, g);

                const child = { state: next.state, parent: node, tile: next.tile, g, depth: node.depth + 1, id: nextId++ };
                successors.push(child);
                frontier.push(child.g * ID_SCALE + child.id, child);
                generated++;
            }
            peakNodes = Math.max(peakNodes, frontier.size + explored.size);
        }

        if (expanded % traceStride === 0 || isGoal) {
            trace.push(makeTraceFrame(node, successors));
            if (trace.length > 1200) {          // keep every second frame, then record half as often
                trace = trace.filter((_, i) => i % 2 === 0 || i === trace.length - 1);
                traceStride *= 2;
            }
        }

        if (isGoal) { goalNode = node; break; }
        if (expanded >= nodeCap) { capped = true; break; }
    }

    function makeTraceFrame(node, successors) {
        // Peek at the first 15 heap entries and sort them to show who is next in line.
        const nextInLine = frontier.items.slice(0, 15)
            .sort((a, b) => a.priority - b.priority)
            .slice(0, 6)
            .map(entry => entry.value.state + '  g=' + entry.value.g);
        return {
            node,
            state: node.state,
            parentState: node.parent ? node.parent.state : null,
            depth: node.depth,
            g: node.g,
            generated,
            expanded,
            exploredCount: explored.size,
            frontierCount: frontier.size,
            successors: successors.map(child => ({ state: child.state, g: child.g })),
            frontierPreview: nextInLine,
            recentlyExpanded: recentlyExpanded.slice()
        };
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
        root,
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