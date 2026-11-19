# Model — GTA VI trophy-rarity forecast

## What is being forecast

For every PlayStation 5 trophy of Grand Theft Auto VI (55 trophies: 1 platinum,
2 gold, 6 silver, 46 bronze), the earn rate on Exophase at 2026-11-26T00:00:00Z:
the percent of the players Exophase tracks for the game who have earned that
trophy, as the page prints it. The program (`main.ts`) outputs five quantiles
(5%, 25%, 50%, 75%, 95%) per trophy. Score is mean pinball loss on the logit
scale, so both the median and an honest spread matter.

## What is announced vs assumed

Announced / documented (sources: the competition kit's rules and case files;
public trophy lists cross-checked across GamesRadar+, PC Gamer, PSNProfiles
and Exophase via PlanetGTA6 / Output Lag, Nov 2026):

- GTA VI released 19 November 2026 on PS5 and Xbox Series X|S. 55 trophies on
  PS5, same 55 as Xbox achievements (1,000 Gamerscore). Platinum: "Vice Got a
  Price!". Golds: "A Long Road" (100% completion) and "You Gotta Know When to
  Get Off" (final mission). 28 of the 55 are hidden (mostly story trophies).
  All single-player, no online trophies, no difficulty trophies.
- The platinum takes roughly 200 hours of play (guide estimates); 100%
  completion is the hardest requirement. One trophy ("Positive Mental
  Attitude") is reported as potentially missable.
- Exophase refreshes a game's counts on its own schedule, not with every
  player's trophy. The house recorder saw the page frozen at 638 tracked
  players from launch night until its 04:30 UTC read on 19 Nov 2026, when it
  jumped to 3,868 tracked players and every rate but the one at 100% fell.
  A read therefore shows rates as of Exophase's last refresh before it.

Assumed (stated, not hidden — these are the model's priors, and the final
case's own history overrides them wherever the data is informative):

- Tracked-player growth slows in log time: `ln N` is linear in
  `ln(1 + hours since release)`. Launch-week growth is explosive at first
  (638 → 3,868 tracked in one refresh) and then decelerates.
- Earners of a trophy grow roughly as a power of time since release, with
  the exponent depending on how deep into the game the trophy sits: early
  bronzes fastest, story/100%-completion trophies slowest. Implemented as
  tier shrinkage priors on the log-earners slope (platinum 0.15, gold 0.5,
  silver 0.8, bronze 1.0), with weight on the data growing with the number
  of distinct reads behind each fit.
- A completely flat history means no refresh has been seen yet, so the next
  refresh will dilute rates as a wave of new tracked players lands: the
  median is shifted down 0.35 logit units and the spread is widened. This
  only fires when the history has at most one distinct read; the final
  case's history (days of reads) will not trigger it.
- Loose week-one ceilings by tier (platinum 2%, gold 20%, silver 60%,
  bronze 99.5%) guard only against wild extrapolations; they do not bind
  on any realistic fit.

## Method (see the header comment in `main.ts`)

1. Collapse consecutive identical reads into distinct snapshots — Exophase
   refreshes in steps, so repeated reads carry no new information and would
   overweight the stale page in a fit.
2. Fit `ln N(t)` against `x = ln(1 + hours since release)` by least squares
   and extrapolate to the target (clamped: never below the last count, never
   more than 8× it).
3. Per trophy, fit `ln E_i(t)` (earners = rate × N, with half-player
   pseudo-counts at 0% and 100%) and `logit r_i(t)` against the same `x`,
   shrink the earners slope toward its tier mean, and re-anchor the fit at
   the last read. Median = 0.55 × (decomposition rate E/N, on the logit
   scale) + 0.45 × (direct rate fit).
4. Spread: `sigma = sqrt(0.55² + (0.45·√days)² + residual²·(1+extrap)²
   + refresh²)`, clamped to [0.6, 2.2] logit units. It grows with horizon,
   with the fit's residual scatter, with extrapolation distance past the
   history, and with the refresh-jump variance actually seen (or an
   unseen-refresh allowance when none has been seen).
5. Quantiles are `inv-logit(logit(median) + z_tau · sigma)`, rounded to
   4 decimals, non-decreasing, inside [0.01, 99.99].

Nothing is read from the network; everything is computed from the case
file. No randomness, no clock reads: two runs are byte-identical.

## Validation done here

- Practice cases p00/p01 (in `cases/`, outputs in `out/`): valid shape
  (55 rows, ids 1–55, five non-decreasing quantiles each), deterministic
  across two runs. Because both histories are the frozen launch-night page,
  the medians sit just below the last rates (the expected dilution at the
  first refresh) with a wide band — e.g. platinum 0.46% (last 0.63%),
  "Baited My Tackle" 1.81% (last 2.04%), "Just Like Paradise" 99.50%
  (last 100%). The house baseline on the same practice scores ~1.51 pinball
  loss with ~0 coverage, because its narrow band misses the refresh
  entirely; this model's band is built to survive it.
- Synthetic final-like case (11 refreshes, Nov 19–21, tracked players
  638 → 13,469, target Nov 26): runs clean, medians move sensibly with the
  trends (platinum dilutes 0.25% → 0.22%, early bronzes rise 2.7% → 3.7%),
  spread ≈ 1.15 logit units at the 4.5-day horizon.

## Limits

- The model cannot see the future refresh schedule: if Exophase refreshes
  rarely between the deadline and the target, the answering read may be
  stale and rates lower than the median; the spread is the honest answer
  to that, not a fix for it.
- Trophy-level behaviour is inferred from the case history alone. The
  trophy list in the case file is authoritative; where public guides
  disagree on a hidden trophy's requirement, the model does not use the
  requirement at all — only its tier and its observed earn trajectory.
- Early earn counts are tiny (a 1.10% rate at 638 tracked players is 7
  people), so launch-night rates are noisy; the tier shrinkage and the
  wide spread are there for exactly that reason.
