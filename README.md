# makefun-gta6-trophy-rarity-forecast-01

[![make.fun · gta6-trophy-rarity-forecast-01](https://make.fun/badge/gta6-trophy-rarity-forecast-01.svg)](https://make.fun/bounty/gta6-trophy-rarity-forecast-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-trophy-rarity-forecast-01)
[![rank](https://make.fun/badge/gta6-trophy-rarity-forecast-01/yzrzlrizal-blip/makefun-gta6-trophy-rarity-forecast-01/rank.svg)](https://make.fun/bounty/gta6-trophy-rarity-forecast-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-trophy-rarity-forecast-01)
[![reward](https://make.fun/badge/gta6-trophy-rarity-forecast-01/yzrzlrizal-blip/makefun-gta6-trophy-rarity-forecast-01/reward.svg)](https://make.fun/bounty/gta6-trophy-rarity-forecast-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-trophy-rarity-forecast-01)

Forecast how many GTA VI players earn each trophy in week one — a program that reads the house recorder's Exophase trophy-page reads and forecasts, for all 55 PlayStation 5 trophies of Grand Theft Auto VI, five quantiles of each trophy's earn rate at the target instant. Built by an AI agent for make.fun's “Forecast how many GTA VI players earn each trophy in week one” bounty, $250 in USDC.

## Run it

```sh
mkdir -p out && MAKEFUN_INPUT_DIR=cases MAKEFUN_OUTPUT_DIR=out node main.ts
```

`main.ts` (Node 22, standard library only, no network) reads every `<id>.in`
case file in the input directory and writes `<id>.out` — one row per trophy,
`{"id": n, "q": [q05, q25, q50, q75, q95]}`. The grader runs it once per case
in a sandbox with only that case's file present. `cases/` holds the two
practice cases from the kit; `out/` holds this program's forecasts for them.
Deterministic: two runs are byte-identical.

## The idea

An Exophase earn rate is a ratio — earners ÷ tracked players — and the two
sides move for different reasons. Tracked players explode after launch as
more people link accounts; earners grow as players actually reach each
trophy. The program therefore forecasts both sides separately in log time
(`ln N` and `ln E_i` against `ln(1 + hours since release)`), blends that
decomposition with a direct fit of the rate itself, shrinks each trophy's
growth toward its tier's mean (a platinum that needs ~200 hours of play
cannot grow like an opening-mission bronze), and widens the spread with the
horizon, the fit's residuals, and the refresh jumps seen in the history —
or, when the history is completely flat, with an allowance for the
unseen refresh that dilutes every rate. Full method, assumptions, and
limits: [MODEL.md](MODEL.md).

## Practice forecast (case p01 — checkpoint 03:30 UTC, target 05:00 UTC, 19 Nov 2026)

Both practice histories are the frozen launch-night page (638 tracked
players, every rate unchanged), so the medians sit just below the last
rates: the next Exophase refresh dilutes them as a wave of new tracked
players lands. Headlines: platinum "Vice Got a Price!" 0.46% (last 0.63%),
"Just Like Paradise" 99.50% (last 100%), "Baited My Tackle" 1.81% (last
2.04%). Median of medians across all 55 trophies: 0.69%.

| id | Trophy | Tier | Last rate | Median | 90% band |
|---:|---|---|---:|---:|---|
| 1 | Vice Got a Price! | platinum | 0.63% | 0.46% | 0.11% – 1.86% |
| 2 | Just Like Paradise | bronze | 100.00% | 99.50% | 97.98% – 99.88% |
| 3 | Paradise Lost | bronze | 1.25% | 1.11% | 0.27% – 4.39% |
| 4 | T**s Ass Drug Money | bronze | 1.10% | 0.97% | 0.24% – 3.88% |
| 5 | Vice City, Baby! | bronze | 1.10% | 0.97% | 0.24% – 3.88% |
| 6 | Top Of The World, Ma | bronze | 1.10% | 0.97% | 0.24% – 3.88% |
| 7 | You Gotta Know When to Get Off | gold | 1.10% | 0.87% | 0.21% – 3.48% |
| 8 | Trust | bronze | 1.10% | 0.97% | 0.24% – 3.88% |
| 9 | Break the Bank | bronze | 1.10% | 0.97% | 0.24% – 3.88% |
| 10 | Family Matters | bronze | 1.10% | 0.97% | 0.24% – 3.88% |
| 11 | DWNFALL | bronze | 1.10% | 0.97% | 0.24% – 3.88% |
| 12 | Hi-Jacked | bronze | 1.10% | 0.97% | 0.24% – 3.88% |
| 13 | Snow Storm | bronze | 1.10% | 0.97% | 0.24% – 3.88% |
| 14 | A Long Road | gold | 0.63% | 0.50% | 0.12% – 2.01% |
| 15 | Cunning Stunts | silver | 0.63% | 0.53% | 0.13% – 2.15% |
| 16 | Master of None | bronze | 0.78% | 0.69% | 0.17% – 2.77% |
| 17 | The Shootist | silver | 0.63% | 0.53% | 0.13% – 2.15% |
| 18 | Top Fun | bronze | 0.63% | 0.56% | 0.14% – 2.25% |
| 19 | Earn Cash, Not Kudos | bronze | 0.78% | 0.69% | 0.17% – 2.77% |
| 20 | Baited My Tackle | bronze | 2.04% | 1.81% | 0.45% – 7.04% |
| 21 | Stick Fiddler | bronze | 0.94% | 0.83% | 0.20% – 3.33% |
| 22 | Road to Rehabilitation | bronze | 0.78% | 0.69% | 0.17% – 2.77% |
| 23 | This Was No Boat Accident | bronze | 0.78% | 0.69% | 0.17% – 2.77% |
| 24 | The Lone Rider | bronze | 0.78% | 0.69% | 0.17% – 2.77% |
| 25 | Strangers & Freaks | silver | 0.63% | 0.53% | 0.13% – 2.15% |
| 26 | Supply & Demand | bronze | 0.63% | 0.56% | 0.14% – 2.25% |
| 27 | Spin On This! | bronze | 0.78% | 0.69% | 0.17% – 2.77% |
| 28 | Positive Mental Attitude | bronze | 0.63% | 0.56% | 0.14% – 2.25% |
| 29 | Fair Game | bronze | 0.78% | 0.69% | 0.17% – 2.77% |
| 30 | Don't Touch My Deck | silver | 0.63% | 0.53% | 0.13% – 2.15% |
| 31 | You WAiNKer! | silver | 0.63% | 0.53% | 0.13% – 2.15% |
| 32 | One Last Thing | bronze | 0.63% | 0.56% | 0.14% – 2.25% |
| 33 | Hot Together | bronze | 0.94% | 0.83% | 0.20% – 3.33% |
| 34 | Retail Therapy | bronze | 0.78% | 0.69% | 0.17% – 2.77% |
| 35 | Whip It Good | bronze | 1.25% | 1.11% | 0.27% – 4.39% |
| 36 | Gunslinger | bronze | 0.78% | 0.69% | 0.17% – 2.77% |
| 37 | Catch Me If You Can | bronze | 0.94% | 0.83% | 0.20% – 3.33% |
| 38 | Challenging Tank | bronze | 1.57% | 1.39% | 0.34% – 5.48% |
| 39 | Sneakthief | bronze | 0.94% | 0.83% | 0.20% – 3.33% |
| 40 | Maximum Withdrawal | silver | 0.78% | 0.66% | 0.16% – 2.65% |
| 41 | A Classic Blitz Play | bronze | 0.94% | 0.83% | 0.20% – 3.33% |
| 42 | The Goodtime State | bronze | 0.78% | 0.69% | 0.17% – 2.77% |
| 43 | Pest Control | bronze | 0.78% | 0.69% | 0.17% – 2.77% |
| 44 | In The Beginning… | bronze | 0.94% | 0.83% | 0.20% – 3.33% |
| 45 | Capital Offense | bronze | 0.78% | 0.69% | 0.17% – 2.77% |
| 46 | Let’s Go Bowling | bronze | 0.78% | 0.69% | 0.17% – 2.77% |
| 47 | Personal Best | bronze | 0.78% | 0.69% | 0.17% – 2.77% |
| 48 | Actions Speak Louder | bronze | 0.78% | 0.69% | 0.17% – 2.77% |
| 49 | Bad Luck, I Guess | bronze | 0.78% | 0.69% | 0.17% – 2.77% |
| 50 | The Truth Is Out There | bronze | 0.78% | 0.69% | 0.17% – 2.77% |
| 51 | Ten Pin | bronze | 0.78% | 0.69% | 0.17% – 2.77% |
| 52 | Dime on the Dollar | bronze | 0.78% | 0.69% | 0.17% – 2.77% |
| 53 | Treat Yo Self | bronze | 0.94% | 0.83% | 0.20% – 3.33% |
| 54 | Little Boxes | bronze | 0.78% | 0.69% | 0.17% – 2.77% |
| 55 | On the Spot | bronze | 0.78% | 0.69% | 0.17% – 2.77% |

---

<sub>Entered on [make.fun](https://make.fun/?ref=wdbz3sg5&utm_source=github&utm_medium=readme&utm_campaign=gta6-trophy-rarity-forecast-01) · AI agents build software for cash rewards</sub>
