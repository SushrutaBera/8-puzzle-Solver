/* info.js: text shown on the Algorithms page. Reference notes for all search methods.
   Only Uniform Cost Search is implemented in solver.js. */

const ALGORITHM_INFO = [
  {
    name: 'Uniform Cost Search (assigned)',
    description: 'Expands the cheapest frontier node first, ordered by path cost g(n).',
    principle: 'Keeps a priority queue keyed on g(n) and expands the lowest. A cheaper route to a frontier state replaces the costlier one. The goal test happens when a node is expanded.',
    advantages: 'Finds the lowest cost solution for any non-negative step costs.',
    limitations: 'Ignores the goal direction, so it expands many nodes. Memory grows with the frontier.',
    time: 'O(b^(1+C*/e))',
    space: 'O(b^(1+C*/e))',
    completeness: 'Yes, when step costs are above zero',
    optimality: 'Yes'
  },
  {
    name: 'Breadth First Search',
    description: 'Expands all nodes at depth d before depth d+1.',
    principle: 'FIFO queue. The shallowest node leaves the frontier first.',
    advantages: 'Shortest solution in moves.',
    limitations: 'Very high memory use.',
    time: 'O(b^d)',
    space: 'O(b^d)',
    completeness: 'Yes',
    optimality: 'Yes for equal step costs'
  },
  {
    name: 'Depth First Search',
    description: 'Follows one branch as deep as possible before backing up.',
    principle: 'LIFO stack with a seen set to avoid cycles.',
    advantages: 'Small frontier. Quick when solutions are deep and plentiful.',
    limitations: 'Solutions are often very long. Not optimal.',
    time: 'O(b^m)',
    space: 'O(b*m) for a tree, more with a seen set',
    completeness: 'Yes with a seen set on a finite graph',
    optimality: 'No'
  },
  {
    name: 'Depth Limited Search',
    description: 'Depth First Search that refuses to go below a set depth.',
    principle: 'Stack with a depth cutoff and an ancestor check.',
    advantages: 'Bounded memory. Avoids endless descent.',
    limitations: 'Misses solutions deeper than the limit.',
    time: 'O(b^l)',
    space: 'O(b*l)',
    completeness: 'No',
    optimality: 'No'
  },
  {
    name: 'Iterative Deepening DLS',
    description: 'Runs DLS with limits 0, 1, 2 and so on until the goal appears.',
    principle: 'Repeats depth limited searches. Early work is repeated but shallow levels are cheap.',
    advantages: 'BFS answer with DFS memory.',
    limitations: 'Repeats work. Slow on deep solutions.',
    time: 'O(b^d)',
    space: 'O(b*d)',
    completeness: 'Yes',
    optimality: 'Yes for equal step costs'
  },
  {
    name: 'Greedy Best First Search',
    description: 'Always expands the node that looks closest to the goal by h(n).',
    principle: 'Priority queue ordered by h(n) only.',
    advantages: 'Fast when the heuristic is good.',
    limitations: 'Can follow misleading estimates and return long paths.',
    time: 'O(b^m)',
    space: 'O(b^m)',
    completeness: 'Yes with a seen set on a finite graph',
    optimality: 'No'
  },
  {
    name: 'A* Search',
    description: 'Expands the lowest f(n) = g(n) + h(n).',
    principle: 'Priority queue on f(n). Misplaced tiles and Manhattan distance never overestimate with 1 per move, so the result is optimal.',
    advantages: 'Optimal and usually far fewer expansions than uninformed search.',
    limitations: 'Memory heavy. With tile number costs, these heuristics may overestimate.',
    time: 'O(b^d) worst case, much less in practice',
    space: 'O(b^d)',
    completeness: 'Yes',
    optimality: 'Yes with an admissible heuristic'
  }
];

// Row labels in display order, paired with the field they show.
const INFO_ROWS = [
  ['Description', 'description'],
  ['Working principle', 'principle'],
  ['Advantages', 'advantages'],
  ['Limitations', 'limitations'],
  ['Time complexity', 'time'],
  ['Space complexity', 'space'],
  ['Completeness', 'completeness'],
  ['Optimality', 'optimality']
];