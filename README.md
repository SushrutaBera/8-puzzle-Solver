# AI 8-Puzzle Visualizer

An interactive web app that solves the 8-Puzzle with **Uniform Cost Search** (assigned algorithm number 5) and shows the search as it happens. Built for the Artificial Intelligence digital assignment (BCSE306L).

## Technologies Used
HTML5, CSS3, JavaScript (ES6) and Bootstrap 5.3 (loaded from a CDN). Fonts: Archivo and Fira Code from Google Fonts. No build step and no server.

## Search Algorithms Implemented
Uniform Cost Search, written from scratch in `js/solver.js`. It expands the frontier node with the lowest path cost g(n) using a binary-heap priority queue. Two move cost rules are available: 1 per move, or the number on the tile per move.

## Heuristics Used
None. Uniform Cost Search is an uninformed search and orders nodes by path cost only.

## Features
- Enter your own start and goal states, or generate a random solvable puzzle
- Live view of the node being expanded, its parent, depth, path cost, nodes generated and expanded, the frontier and the explored list
- Board that slides along the search, then along the final solution path
- Run, Pause, Resume, Next step, Previous step, Skip to solution, Reset and speed control
- Solution summary with moves, nodes, depth, time, path cost and approximate memory
- Comparison of Uniform Cost Search under the two cost rules
- Reference notes on all the search methods in the course (only Uniform Cost Search is implemented).

## Screenshots

### Home page
![Home page](images/home.png)

### Solving with Uniform Cost Search
![Solving with Uniform Cost Search](images/solve.png)

### Comparison table
![Comparison table](images/compare.png)

## GitHub Pages URL
https://sushrutabera.github.io/8-puzzle-Solver/

## Student Details
Name: Sushruta Bera
Registration number: 24BAI0163
Course: Artificial Intelligence (BCSE306L)

## References
- Russell and Norvig, Artificial Intelligence: A Modern Approach, chapter 3 (uniform cost search)
- Bootstrap 5 documentation, https://getbootstrap.com
- Google Fonts, https://fonts.google.com

## How to Run the Project
1. Download or clone the repository.
2. Open `index.html` in a browser, or use the VS Code Live Server extension.
3. Open the Solve tab, enter a start and goal state or press Generate random puzzle, then press Run.
4. Use the link in the github pages