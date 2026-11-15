# ant-day7-runs

Headless runs of the day-7 sprint bot for Ant Architect, on GitHub Actions.
The bots only send normal player commands; every run is a real replay of the live game.

## Run a sweep

Actions → **day7-sweep** → Run workflow, or:

```
gh workflow run day7-sweep -f seed=1488 -f bot=bot15 -f jobs=8 -f runs=4
```

Each job runs `runs` games in a fresh headless Chromium. Results go to the job summary;
replays scoring at least `keep` are in the `all-results` artifact (`replays/*.json`).

## Run locally

```
npm install && npx playwright install chromium
SEED=1488 N=1 node run.js
```

## Bots

- `bot15`: seed tree + Rich Food (best so far: 130 on seed 1488).
- `bot17`: bot15 plus experimental options (feeders, Fungus Storage/Grower, sand Pheromones, farm placement).
