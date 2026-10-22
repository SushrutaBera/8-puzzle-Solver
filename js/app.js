/*
 * app.js
 * Page behaviour: navigation, puzzle input, playback of the search, comparison table.
 */

// Edit these before submitting.
const STUDENT = {
  name: 'Sushruta Bera',
  registration: '24BAI0163',
  course: 'Artificial Intelligence (BCSE306L)',
  title: 'Interactive 8-Puzzle Problem Solver using AI Search Algorithms'
};

const MAX_WALK_STEPS = 40;   // only absurdly long jumps are placed directly instead of slid

const $ = id => document.getElementById(id);

let startState = '283164705';
let goalState = '123804765';
let timeline = [];           // every frame to play: search frames, then solution path frames
let position = 0;            // index of the frame on screen
let playTimer = null;
let walkTimers = [];
let result = null;           // output of search()
let boardNode = null;        // search node the big board currently shows

/* ---------- Small helpers ---------- */

// Draws a 3 by 3 board as HTML cells.
function boardCells(state) {
  return [...state]
    .map(tile => `<i class="${tile === '0' ? 'z' : ''}">${tile}</i>`)
    .join('');
}

function formatValue(value) {
  if (typeof value !== 'number') return value;
  return Number.isInteger(value) ? value : value.toFixed(2);
}

function currentOptions() {
  return {
    algorithm: $('algo').value,
    depthLimit: $('limit').value,
    heuristic: $('heur').value,
    costMode: $('cost').value
  };
}

/* ---------- Navigation and static text ---------- */

document.querySelectorAll('[data-p]').forEach(button => {
  button.onclick = () => {
    const target = button.dataset.p;
    document.querySelectorAll('.pg').forEach(page => page.classList.toggle('d-none', page.id !== target));
    document.querySelectorAll('.tabs button').forEach(tab => tab.classList.toggle('on', tab.dataset.p === target));
  };
});

$('h-title').textContent = STUDENT.title;
$('h-course').textContent = STUDENT.course;
$('h-name').textContent = STUDENT.name;
$('h-reg').textContent = STUDENT.registration;

$('infos').innerHTML = ALGORITHM_INFO.map(info => `
  <div class="info-item">
    <h3 class="h5">${info.name}</h3>
    <dl>${INFO_ROWS.map(([label, field]) => `<dt>${label}</dt><dd>${info[field]}</dd>`).join('')}</dl>
  </div>`).join('');

/* ---------- Puzzle input ---------- */

['s', 'g'].forEach(prefix => {
  $('g-' + prefix).innerHTML = Array.from({ length: 9 }, (_, i) =>
    `<input maxlength="1" aria-label="${prefix === 's' ? 'Start' : 'Goal'} cell ${i + 1}">`).join('');
});

function writeGrid(prefix, state) {
  $('g-' + prefix).querySelectorAll('input').forEach((input, i) => {
    input.value = state[i] === '0' ? '_' : state[i];
  });
}

// Returns the 9 character state, or null if the grid is not a valid arrangement.
function readGrid(prefix) {
  const text = [...$('g-' + prefix).querySelectorAll('input')]
    .map(input => (/^[_ 0]?$/.test(input.value) ? '0' : input.value))
    .join('');
  const usesEveryDigit = [...'012345678'].every(digit => text.includes(digit));
  return text.length === 9 && usesEveryDigit ? text : null;
}

function showMessage(text, isError) {
  $('msg').textContent = text;
  $('msg').className = 'msg' + (isError ? ' err' : '');
}

function setPuzzle(start, goal) {
  startState = start;
  goalState = goal;
  writeGrid('s', start);
  writeGrid('g', goal);
  $('m-s').innerHTML = boardCells(start);
  $('m-g').innerHTML = boardCells(goal);
  $('demo').innerHTML = boardCells(start);
  $('demo2').innerHTML = boardCells(goal);
  stopPlayback();
  timeline = [];
  position = 0;
  boardNode = null;
  $('sum').classList.add('d-none');
  $('phase').textContent = 'Current state';
  placeTiles(start);
}

$('b-apply').onclick = () => {
  const start = readGrid('s');
  const goal = readGrid('g');
  if (!start || !goal) return showMessage('Each grid must contain every digit from 0 to 8 exactly once.', true);
  if (!isSolvable(start, goal)) return showMessage('This start state cannot reach this goal. Swap any two tiles in one grid.', true);
  setPuzzle(start, goal);
  showMessage('Puzzle set.');
};

$('b-rand').onclick = () => {
  const goal = readGrid('g') || '123456780';
  setPuzzle(generateRandomPuzzle(goal), goal);
  showMessage('Random solvable puzzle created.');
};

$('algo').onchange = () => {
  const algorithm = $('algo').value;
  $('o-dls').classList.toggle('d-none', algorithm !== 'dls');
  $('o-h').classList.toggle('d-none', algorithm !== 'gbfs' && algorithm !== 'astar');
};

/* ---------- The sliding board ---------- */

$('board').innerHTML = [1, 2, 3, 4, 5, 6, 7, 8]
  .map(tile => `<div class="tile" id="t${tile}"><span>${tile}</span></div>`).join('');

// Moves every tile to its square. The CSS transition makes it slide.
function placeTiles(state) {
  for (let tile = 1; tile <= 8; tile++) {
    const square = state.indexOf(tile);
    const element = $('t' + tile);
    element.style.left = (square % 3) * 33.333 + '%';
    element.style.top = Math.floor(square / 3) * 33.333 + '%';
  }
}

// States to pass through when going from one search node to another:
// back up to their common ancestor, then down to the target. Every step is one legal move.
function routeBetween(from, to) {
  if (!from || !to) return null;
  const up = [];
  const down = [];
  let a = from;
  let b = to;
  while (a.depth > b.depth) { a = a.parent; up.push(a.state); }
  while (b.depth > a.depth) { down.push(b.state); b = b.parent; }
  while (a !== b) {
    down.push(b.state);   // record the lower node before climbing past it
    a = a.parent;
    b = b.parent;
    if (!a || !b) return null;
    up.push(a.state);
  }
  return up.concat(down.reverse());
}

function clearWalk() {
  walkTimers.forEach(clearTimeout);
  walkTimers = [];
}

// Slides the board from the node it shows to the frame's node. Returns how long that takes.
function walkBoardTo(frame) {
  const target = frame.node;
  const isFirstPathFrame = frame.kind === 'path' && frame.index === 0;
  const route = isFirstPathFrame ? null : routeBetween(boardNode, target);
  boardNode = target;
  clearWalk();

  if (!route || route.length === 0 || route.length > MAX_WALK_STEPS) {
    placeTiles(target.state);
    return 0;
  }
  const stepMs = timePerMove(frame);
  $('board').style.setProperty('--slide', Math.round(stepMs * 0.85) + 'ms');
  route.forEach((state, i) => {
    walkTimers.push(setTimeout(() => placeTiles(state), i * stepMs));
  });
  return route.length * stepMs;
}

/* ---------- Showing one frame ---------- */

function showFrame(frame) {
  const usesHeuristic = ['gbfs', 'astar'].includes($('algo').value);
  const walkMs = walkBoardTo(frame);
  $('cur').innerHTML = boardCells(frame.state);
  let rows;

  if (frame.kind === 'search') {
    $('phase').textContent = 'Searching: the board follows the solver';
    rows = [
      ['Node expanded', frame.state],
      ['Parent', frame.parentState || 'none (root)'],
      ['Depth', frame.depth],
      ['Path cost g(n)', frame.g]
    ];
    if (usesHeuristic) rows.push(['Heuristic h(n)', frame.h], ['Evaluation f(n)', frame.f]);
    rows.push(
      ['Nodes generated', frame.generated],
      ['Nodes expanded', frame.expanded],
      ['Frontier size', frame.frontierCount],
      ['Explored size', frame.exploredCount]
    );
    $('kids').innerHTML = frame.successors.length
      ? frame.successors.map(child => `
          <div><div class="mini">${boardCells(child.state)}</div>
          <div class="kid">g=${child.g}${usesHeuristic ? ` h=${child.h} f=${child.f}` : ''}</div></div>`).join('')
      : '<span class="hint">No new successors.</span>';
    $('fr').innerHTML = frame.frontierPreview.map(text => `<li>${text}</li>`).join('') || '<li>empty</li>';
    $('ex').innerHTML = frame.recentlyExpanded.slice().reverse().map(text => `<li>${text}</li>`).join('');
  } else {
    $('phase').textContent = `Solution path: move ${frame.index} of ${result.path.length - 1}`;
    rows = [
      ['State', frame.state],
      ['Tile moved', frame.index ? frame.tile : 'none'],
      ['Cost so far', frame.g]
    ];
    $('kids').innerHTML = '';
  }

  $('stat').innerHTML = rows.map(([label, value]) => `<tr><td>${label}</td><td>${value}</td></tr>`).join('');
  if (position === timeline.length - 1) showSummary();
  return walkMs;
}

function showSummary() {
  $('sum').classList.remove('d-none');
  const status = result.found ? 'Solution found' : (result.capped ? 'Not found (node limit reached)' : 'Not found');
  const rows = [
    ['Result', status],
    ['Total moves', formatValue(result.moves ?? '-')],
    ['Nodes generated', result.generated],
    ['Nodes expanded', result.expanded],
    ['Maximum depth reached', result.maxDepth],
    ['Execution time', result.timeMs.toFixed(1) + ' ms'],
    ['Path cost', formatValue(result.pathCost ?? '-')],
    ['Approximate memory', result.memoryKb + ' KB (peak nodes x 110 bytes)']
  ];
  $('sumt').innerHTML = rows.map(([label, value]) => `<tr><td>${label}</td><td>${value}</td></tr>`).join('');
  $('path').innerHTML = result.path.map((step, i) => `
    <div><div class="mini">${boardCells(step.state)}</div><div class="kid">step ${i}</div></div>`).join('');
}

/* ---------- Playback controls ---------- */

const speedDelay = () => Math.round(900 / Math.pow($('speed').value, 1.4));

// Time for one tile slide. Solution moves are slower so they are easy to follow.
function timePerMove(frame) {
  return frame.kind === 'path' ? Math.max(speedDelay(), 150) : Math.max(Math.round(speedDelay() / 2), 45);
}

// Time to wait before the next frame: the slides just played plus a short pause.
function waitAfter(frame, walkMs) {
  const pause = frame.kind === 'path' ? 0 : 40;
  return Math.max(walkMs + pause, 60);
}

function prepareRun() {
  stopPlayback();
  result = search(startState, goalState, currentOptions());
  timeline = result.trace.map(frame => ({ kind: 'search', ...frame }));
  result.path.forEach((step, i) => {
    timeline.push({ kind: 'path', index: i, state: step.state, node: step.node, g: step.g, tile: step.tile });
  });
  position = 0;
  boardNode = result.root;
  placeTiles(startState);
  showFrame(timeline[0]);
}

function startPlayback() {
  stopPlayback();
  if (timeline.length === 0) return;
  const advance = () => {
    if (position >= timeline.length - 1) { playTimer = null; return; }
    position++;
    const walkMs = showFrame(timeline[position]);
    playTimer = setTimeout(advance, waitAfter(timeline[position], walkMs));
  };
  playTimer = setTimeout(advance, 300);
}

function stopPlayback() {
  clearTimeout(playTimer);
  playTimer = null;
}

function stepTo(newPosition) {
  stopPlayback();
  position = newPosition;
  showFrame(timeline[position]);
}

$('c-run').onclick = () => { prepareRun(); startPlayback(); };
$('c-pause').onclick = stopPlayback;
$('c-resume').onclick = () => { if (position >= timeline.length - 1) position = 0; startPlayback(); };
$('c-next').onclick = () => {
  if (timeline.length === 0) prepareRun();
  else if (position < timeline.length - 1) stepTo(position + 1);
};
$('c-prev').onclick = () => { if (position > 0) stepTo(position - 1); };
$('c-skip').onclick = () => { if (timeline.length) stepTo(result.trace.length); };
$('c-reset').onclick = () => {
  stopPlayback();
  clearWalk();
  position = 0;
  $('sum').classList.add('d-none');
  if (timeline.length) { boardNode = result.root; placeTiles(startState); showFrame(timeline[0]); }
  else placeTiles(startState);
};
$('speed').oninput = () => { if (playTimer) startPlayback(); };

/* ---------- Comparison page ---------- */

const ALGORITHM_NAMES = { ucs: 'UCS', bfs: 'BFS', dfs: 'DFS', dls: 'DLS', iddls: 'IDDLS', gbfs: 'GBFS', astar: 'A*' };

$('b-cmp').onclick = () => {
  $('cmpt').innerHTML = '<tr><td>Running...</td></tr>';
  setTimeout(() => {      // let the "Running" text paint before the heavy work
    const rows = Object.keys(ALGORITHM_NAMES).map(algorithm => {
      const run = search(startState, goalState, { ...currentOptions(), algorithm });
      const found = run.found ? 'Yes' : (run.capped ? 'No (limit)' : 'No');
      return `<tr><td>${ALGORITHM_NAMES[algorithm]}</td><td>${found}</td><td>${run.expanded}</td><td>${run.generated}</td>
        <td>${run.moves ?? '-'}</td><td>${run.pathCost ?? '-'}</td><td>${run.timeMs.toFixed(1)} ms</td><td>${run.memoryKb} KB</td></tr>`;
    }).join('');
    $('cmpt').innerHTML = `<tr><th>Algorithm</th><th>Solution found</th><th>Nodes expanded</th><th>Nodes generated</th>
      <th>Moves</th><th>Path cost</th><th>Time</th><th>Memory</th></tr>` + rows;
  }, 30);
};

/* ---------- Start up ---------- */

setPuzzle(startState, goalState);