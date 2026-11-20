# Cards v2 test build: what changed

Test site: https://ants2-cards-v2.pages.dev (bundle `index-BH7fZbFB.js`, build `ants2-f9774f03e713…`).
`/api/replays/builds/<build>/info` returns `{"version":"Cards v2","playable":true,"retired":false}`.
The live game (antarchitectgame.com/play) was still v0.00125 (`35c64e66`) on 2026-11-20.
The test site serves the same `/api/leaderboard` (Most ants by day 7, ants at tick 63000).

Compared against the v125 bundle (`game-bundle/v125/index.js`), prettified and diffed.

## 1. Ants come from Dens (biggest change)

- **No Ant Houses, no ant capacity.** The `hatch` command now refuses with "Ants come from Dens now".
- Dens are 3x2 rooms in the new "Worker Ants" tab. Each one costs eggs (plus clay) and gives ants:

| Den | Room id | Cost | Base ants | +1 ant per nearby |
|---|---|---|---|---|
| Digger Den | 42 | 2 eggs | 2 | Royal (queen) chamber |
| Leafcutter Den | 43 | 2 eggs, 1 brown clay | 2 | Leaf Storage |
| Farmer Den | 44 | 2 eggs, 2 brown clay | 2 | Fungus Farm |
| Nurse(ry) Den | 50 | 2 eggs, 2 clay (card) | 2 | Egg Storage |
| Hauler Den | 46 | 3 eggs, 5 tan clay (card) | 3 | Dirt Storage |
| Replete Den | 47 | 3 eggs, 9 fungus (card) | 3 | Clay Pit |
| Feeder / Undertaker Den | 45 / 48 | | | "No longer built" |
| Soldier | 49 (2x1) | 2 eggs, 10 leaves | 1 warrior | "Coming soon", no combat yet |

- Base ants are carried out as eggs by **Nurses** (new caste; you start with 2) and hatch after 3 s.
  The bonus ants appear at once, with no egg, whenever a matching room finishes in reach.
- Reach: the two rooms' centres are less than (sizes/2 + 5 cells) apart on both axes.
- **Same-type rooms that touch are joined into one group**, and a den counts every source in reach of
  *any* den of its group. So a chain of N joined Farmer Dens with M farms around it gives N x (2 + M) farmers.
  Total ants grow with dens x farms, not dens + farms. Leaf Storage gets +2 capacity per Leafcutter Den in reach.

## 2. Eggs

- Eggs are free: the queen lays 1 egg every 10 s (300 ticks) while eggs < egg capacity (5 at start).
  `fungusPerEgg: 3` is gone. Eggs over the cap are simply not laid, so unused eggs are lost time.
- Egg Storage (card) +5 egg capacity. Start: queen, 3 diggers, 2 nurses, 5 eggs, 0 clay (cap 10).

## 3. Upgrades are placed on rooms

- `upgrade` command refuses: "Upgrades are placed now". New command `upgrade-room {kind, id}`.
- Each upgrade goes on a room type and mostly helps only the ants of that den:
  Strong Digging (`tunnel`) and Jaw Muscles / Strong Backs on Digger Dens, Mandibles and Night Shift on
  Leafcutter Dens, Scent Memory and Rich Food on any den, Rich Spores on Fungus Farms, Trail Markers on Pheromones.
- **Research** is a new upgrade on the queen chamber: 10/20/30/40 fungus per level. Queen level N reveals
  seed-tree group N-1 (`reveal-seed-group` no longer works).
- Strong Digging no longer needs a card: 10 brown clay + 10 fungus, placed on a Digger Den, lets rooms dig tan dirt.
- Trail Markers: clay cost 0 (was 10), fungus 10/15/20, +5/16 range per level (was +0.2).
- Royal Jelly, Pause laying and the old Brown/Tan/Red "Clay Storage" names: removed or renamed ("Clay Storage").

## 4. Costs and numbers

- Leaf Storage 1 -> 2 brown clay. Clay Storage and Dirt Storage now also cost 2 leaves.
- Old room per-nearby bonuses removed: Ant House next to Ant House, Pheromones next to Queen chamber,
  Sprout next to Leaf Storage (now -1 s per Leaf Storage, min 10 s).
- Storages: clay storage tunnels give +2 (new `clayStoragePerTunnel`), Leaf Storage no longer gets +1 per tunnel.
- Fog: `fogPastRange` 20 -> 11 (royal nursery 18). Pheromone sand bonus removed.
- Nurse hatch 3 s, soldier hatch 6 s.

## 5. Seed tree

- Cards changed: new Nursery Den card (group 2); Trail Markers card moved into group 1; Hauler and
  Replete cards now give dens. Removed: Fungus Storage card (now always available), Feeder, Undertaker,
  Graveyard, Royal Jelly.
- Group shuffle per seed still applies (`unlocks.tree`), so plan from the live tree.

## 6. Interface

- Tabs: Build, Worker Ants, Upgrades, Soldier Ants (combat tab, not active yet).
- Cards are dragged into the dirt; upgrades are dragged onto a room. Card order saved (`ants2.cardOrder.v2`).

## What it means for the day-7 board

The multiplier makes the old ~220 obsolete. A first bot (`ant-day7-runs/cardsv2/c2bot.js`) reaches
**4338 ants by tick 63000 on seed 55917**, with ~57 joined Farmer Dens around ~74 farms.
Limits found, in order: clay (each late Farmer Den is worth ~70 ants), digging time, eggs lost at the cap,
leaves for farms. Clay Pits and pheromone expansion did not help on 55917.
This quadratic bonus looks like something the developer may change before release.
