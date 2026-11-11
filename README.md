# Encoding Strategies Memory Experiment

A self-contained static website implementing the specified memory experiment.

## Files
- `index.html` — page structure
- `styles.css` — presentation
- `script.js` — experiment logic, randomization, timing, scoring, and CSV export

## Run
Open `index.html` in a modern browser. No server, database, framework, package manager, or build step is required.

## Design choices
- 18 words total: 3 blocks × 6 words.
- Each session independently randomizes the order of the three encoding strategies.
- Three six-word lists are independently shuffled and paired with the randomized strategy order.
- Each word is shown for 3.5 seconds.
- A randomly selected three-digit starting number is used for a 30-second backward-by-3 distractor task.
- Free recall accepts whitespace/comma/semicolon-separated responses.
- Recall is case-insensitive and uses conservative edit-distance tolerance for minor spelling errors.
- Each target word receives credit at most once.
- Results are scored separately by encoding strategy.
- Two client-side CSV downloads are provided.
