// GTA VI trophy-rarity forecast — gta6-trophy-rarity-forecast-01.
//
// Forecasts, for every PS5 trophy of Grand Theft Auto VI, five quantiles of
// its Exophase earn rate (percent of tracked players who have earned it) at
// a case's target instant. Run once per case by the grader:
//   node main.ts            (Node 22, standard library only, no network)
// It reads every <id>.in in $MAKEFUN_INPUT_DIR (else /input) and writes
// <id>.out to $MAKEFUN_OUTPUT_DIR (else /output).
//
// Method (see MODEL.md for the full write-up, assumptions and limits).
// Exophase does not refresh continuously: the house recorder saw the page
// frozen at 638 tracked players from launch night until 04:30 UTC on
// 19 Nov 2026, when it jumped to 3,868 tracked players and every rate but
// the one at 100% fell. So a rate is a ratio, earners / tracked players,
// and the two sides move for different reasons:
//
//   * tracked players N(t) grows as more players link their accounts and
//     earn at least one trophy — fastest right after launch, then slower;
//   * earners E_i(t) of trophy i grow as players reach that trophy in the
//     game — early trophies fast, story/100%-completion trophies slow.
//
// The forecast therefore decomposes the rate and extrapolates both sides
// separately in log time, then blends that with a direct fit of the rate
// itself, so neither side's extrapolation can run away on its own:
//
//   x = ln(1 + hours since release, 2026-11-19T00:00:00Z)
//   ln N        ~ a_N + b_N * x            (least squares, distinct reads)
//   ln E_i      ~ a_i + b_i * x            (per trophy, shrunk to its tier)
//   logit r_i   ~ c_i + d_i * x            (direct fit, per trophy)
//   median rate = inv-logit( 0.55 * (lnE_i(target) - lnN(target))
//                           + 0.45 * (c_i + d_i * x_target) )
//   quantiles   = inv-logit( logit(median) + z_tau * sigma_i )
//
// Slopes are shrunk toward their tier's mean slope (platinum/gold trophies
// cannot grow like early bronzes: the platinum needs ~200 hours of play,
// the gold "A Long Road" needs 100% completion), and the median is capped
// by a loose tier ceiling. The spread sigma_i grows with the horizon
// (random-walk term), with the fit's residual scatter, with how far the
// target is extrapolated past the history, and with the refresh-jump
// variance seen in the history — or, when the history is completely flat
// (no refresh seen yet), with an unseen-refresh allowance, because the
// next refresh dilutes every rate as a wave of new tracked players lands.
//
// Everything is deterministic: pure functions of the case file, fixed
// constants, sorted iteration. Two runs produce byte-identical output.

import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const INPUT_DIR = process.env.MAKEFUN_INPUT_DIR ?? '/input';
const OUTPUT_DIR = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

/** Quantile levels the contest scores, in the order each row lists them. */
const LEVELS = [0.05, 0.25, 0.5, 0.75, 0.95];
/** Standard normal quantile at each level. */
const Z = [-1.645, -0.674, 0, 0.674, 1.645];
/** Release instant: GTA VI launched 19 November 2026 (PS5 / Xbox). */
const RELEASE_MS = Date.parse('2026-11-19T00:00:00Z');

/** Weight of the earners/tracked decomposition vs the direct rate fit. */
const DECOMP_WEIGHT = 0.55;
/** Irreducible logit spread: refresh timing and dilution are unknowable. */
const BASE_SIGMA = 0.55;
/** Random-walk spread, logit units per square-root day of horizon. */
const RW_SIGMA = 0.45;
/** Spread added when the history shows no refresh at all (flat page). */
const UNSEEN_REFRESH_SIGMA = 0.65;
/** Spread added for refresh risk when refreshes have been seen. */
const SEEN_REFRESH_SIGMA = 0.3;
/** Median logit shift when the history is flat: the next refresh dilutes. */
const FLAT_HISTORY_SHIFT = -0.35;
/** Loose week-one ceilings by tier (percent); only binds wild extrapolations. */
const TIER_CEILING: Record<string, number> = {
  platinum: 2,
  gold: 20,
  silver: 60,
  bronze: 99.5,
};
/** Prior slope (ln earners vs ln time) by tier, used only to shrink weak fits. */
const TIER_SLOPE_PRIOR: Record<string, number> = {
  platinum: 0.15,
  gold: 0.5,
  silver: 0.8,
  bronze: 1.0,
};

interface Trophy {
  id: number;
  name: string;
  tier: string;
}

interface Read {
  at: string;
  players_tracked: number;
  rates: Array<number | null>;
}

interface Case {
  id: string;
  at: string;
  horizon_minutes: number;
  target: string;
  levels: number[];
  trophies: Trophy[];
  history: Read[];
}

const clamp = (x: number, lo: number, hi: number): number =>
  Math.min(hi, Math.max(lo, x));
/** logit of a percent, clamped to the scorer's 0.01..99.99 range. */
const logit = (pct: number): number => {
  const p = clamp(pct, 0.01, 99.99) / 100;
  return Math.log(p / (1 - p));
};
const invLogit = (l: number): number => 100 / (1 + Math.exp(-l));
const round4 = (x: number): number => Math.round(x * 10000) / 10000;
/** Hours from release to an ISO instant; before release counts as 0. */
const hoursSinceRelease = (iso: string): number =>
  Math.max(0, (Date.parse(iso) - RELEASE_MS) / 3_600_000);
/** log-time coordinate: ln(1 + hours since release). */
const xOf = (iso: string): number => Math.log1p(hoursSinceRelease(iso));

/** Ordinary least squares y ~ a + b*x. Returns intercept, slope, residual sd. */
function linfit(
  xs: number[],
  ys: number[],
): { a: number; b: number; residSd: number } {
  const n = xs.length;
  if (n === 0) return { a: 0, b: 0, residSd: 0 };
  if (n === 1) return { a: ys[0] as number, b: 0, residSd: 0 };
  let mx = 0;
  let my = 0;
  for (let i = 0; i < n; i++) {
    mx += xs[i] as number;
    my += ys[i] as number;
  }
  mx /= n;
  my /= n;
  let sxx = 0;
  let sxy = 0;
  for (let i = 0; i < n; i++) {
    const dx = (xs[i] as number) - mx;
    sxx += dx * dx;
    sxy += dx * ((ys[i] as number) - my);
  }
  const b = sxx > 1e-12 ? sxy / sxx : 0;
  const a = my - b * mx;
  let ss = 0;
  for (let i = 0; i < n; i++) {
    const r = (ys[i] as number) - (a + b * (xs[i] as number));
    ss += r * r;
  }
  return { a, b, residSd: n > 2 ? Math.sqrt(ss / (n - 2)) : 0 };
}

const mean = (xs: number[]): number =>
  xs.length === 0 ? 0 : xs.reduce((s, v) => s + v, 0) / xs.length;

/** Collapse consecutive identical reads (Exophase refreshes in steps). */
function distinctReads(history: Read[]): Read[] {
  const out: Read[] = [];
  for (const r of history) {
    const prev = out[out.length - 1];
    if (
      prev !== undefined &&
      prev.players_tracked === r.players_tracked &&
      prev.rates.length === r.rates.length &&
      prev.rates.every((v, i) => v === r.rates[i])
    ) {
      continue;
    }
    out.push(r);
  }
  return out;
}

function forecastCase(c: Case): { id: number; q: number[] }[] {
  const history = distinctReads(c.history);
  const last = c.history[c.history.length - 1];
  if (last === undefined) {
    // No history at all: flat 1% with a very wide spread, never crash.
    return c.trophies.map((t) => ({
      id: t.id,
      q: Z.map((z) => round4(invLogit(logit(1) + z * 2.0))),
    }));
  }
  const xTarget = xOf(c.target);
  const xLast = xOf(last.at);
  const xFirst = history.length > 0 ? xOf((history[0] as Read).at) : xLast;
  const span = Math.max(0.05, xLast - xFirst);
  // How far past the history the target sits, in units of the history span.
  const extrap = clamp((xTarget - xLast) / span, 0, 1.5);
  const horizonDays = Math.max(0, c.horizon_minutes) / 1440;

  // --- Tracked players: ln N ~ a + b*x over distinct reads. ---
  const xsN: number[] = [];
  const ysN: number[] = [];
  for (const r of history) {
    if (r.players_tracked > 0) {
      xsN.push(xOf(r.at));
      ysN.push(Math.log(r.players_tracked));
    }
  }
  const fitN = linfit(xsN, ysN);
  const lnNLast = Math.log(Math.max(1, last.players_tracked));
  // Extrapolate, but never let the tracked count fall or explode.
  const lnNTarget = clamp(
    fitN.a + fitN.b * xTarget,
    lnNLast,
    lnNLast + Math.log(8),
  );

  // --- Per-trophy fits, then shrink slopes toward the tier mean. ---
  interface TrophyFit {
    lnE: { a: number; b: number };
    logitR: { a: number; b: number; residSd: number };
    lastRate: number;
    n: number;
  }
  const fits: TrophyFit[] = c.trophies.map((t, i) => {
    const xs: number[] = [];
    const ysE: number[] = [];
    const ysL: number[] = [];
    for (const r of history) {
      const rate = r.rates[i];
      if (rate === null || rate === undefined) continue;
      const n = Math.max(1, r.players_tracked);
      // Half-a-player pseudo-counts keep 0% and 100% finite.
      const earners = rate <= 0 ? 0.5 : rate >= 100 ? n - 0.5 : (rate / 100) * n;
      xs.push(xOf(r.at));
      ysE.push(Math.log(Math.max(0.5, earners)));
      ysL.push(logit(rate));
    }
    const fE = linfit(xs, ysE);
    const fL = linfit(xs, ysL);
    const lastRate = last.rates[i];
    return {
      lnE: { a: fE.a, b: fE.b },
      logitR: { a: fL.a, b: fL.b, residSd: fL.residSd },
      lastRate:
        lastRate === null || lastRate === undefined ? 1 : (lastRate as number),
      n: xs.length,
    };
  });

  // Tier mean slope of ln earners, for shrinkage of weak/noisy fits.
  const tierSlopes: Record<string, number> = {};
  for (const tier of ['platinum', 'gold', 'silver', 'bronze']) {
    const slopes: number[] = [];
    c.trophies.forEach((t, i) => {
      if (t.tier === tier && (fits[i] as TrophyFit).n >= 2) {
        slopes.push((fits[i] as TrophyFit).lnE.b);
      }
    });
    tierSlopes[tier] =
      slopes.length > 0
        ? mean(slopes)
        : (TIER_SLOPE_PRIOR[tier] ?? 1.0);
  }

  // Refresh jumps seen in the history (logit changes between distinct reads).
  const jumps: number[] = [];
  for (let j = 1; j < history.length; j++) {
    const prev = history[j - 1] as Read;
    const cur = history[j] as Read;
    for (let i = 0; i < c.trophies.length; i++) {
      const a = prev.rates[i];
      const b = cur.rates[i];
      if (a !== null && b !== null && a !== undefined && b !== undefined) {
        jumps.push(Math.abs(logit(b) - logit(a)));
      }
    }
  }
  const jumpSd =
    jumps.length > 0 ? clamp(mean(jumps), 0, 0.8) : UNSEEN_REFRESH_SIGMA;
  const flatHistory = history.length <= 1;

  return c.trophies.map((t, i) => {
    const f = fits[i] as TrophyFit;
    // Shrink this trophy's earners slope toward its tier's mean slope.
    // Weight grows with the number of distinct reads behind the fit.
    const w = f.n >= 2 ? f.n / (f.n + 4) : 0;
    const tierSlope = tierSlopes[t.tier] ?? TIER_SLOPE_PRIOR[t.tier] ?? 1.0;
    const bE = w * f.lnE.b + (1 - w) * tierSlope;
    // Re-anchor the intercept at the last read so the fit passes through
    // the most recent observation, not a stale average.
    const nLast = Math.max(1, last.players_tracked);
    const earnersLast =
      f.lastRate <= 0 ? 0.5 : f.lastRate >= 100 ? nLast - 0.5 : (f.lastRate / 100) * nLast;
    const aE = Math.log(Math.max(0.5, earnersLast)) - bE * xLast;
    const lnETarget = aE + bE * xTarget;
    // Decomposition rate E/N as a proportion, then its logit (ln(E/N) alone
    // is not a logit: it would put a 100% trophy at 50%).
    const rateA = clamp(Math.exp(lnETarget - lnNTarget), 0.0001, 0.9999);
    const logitA = logit(rateA * 100);
    const logitB = f.logitR.a + f.logitR.b * xTarget;

    let med = DECOMP_WEIGHT * logitA + (1 - DECOMP_WEIGHT) * logitB;
    if (flatHistory && f.lastRate < 99.9) med += FLAT_HISTORY_SHIFT;
    // Loose tier ceiling: a week-one platinum cannot be common.
    const ceiling = TIER_CEILING[t.tier] ?? 99.5;
    med = Math.min(med, logit(ceiling));
    med = Math.max(med, logit(0.01));

    const resid = clamp(f.logitR.residSd, 0, 0.9) * (1 + extrap);
    const refresh = flatHistory ? UNSEEN_REFRESH_SIGMA : Math.max(SEEN_REFRESH_SIGMA, jumpSd * 0.5);
    const sigma = clamp(
      Math.sqrt(
        BASE_SIGMA * BASE_SIGMA +
          RW_SIGMA * RW_SIGMA * horizonDays +
          resid * resid +
          refresh * refresh,
      ),
      0.6,
      2.2,
    );

    const qs = Z.map((z) => round4(clamp(invLogit(med + z * sigma), 0.01, 99.99)));
    // Rounding must not break monotonicity.
    for (let k = 1; k < qs.length; k++) {
      if ((qs[k] as number) < (qs[k - 1] as number)) qs[k] = qs[k - 1] as number;
    }
    return { id: t.id, q: qs };
  });
}

mkdirSync(OUTPUT_DIR, { recursive: true });
// Every case file, in name order, so two runs write the same bytes.
const inputs = readdirSync(INPUT_DIR)
  .filter((f) => f.endsWith('.in'))
  .sort();
for (const file of inputs) {
  const id = file.slice(0, -'.in'.length);
  const c = JSON.parse(readFileSync(join(INPUT_DIR, file), 'utf8')) as Case;
  if (c.levels.length !== LEVELS.length || c.levels.some((t, j) => t !== LEVELS[j])) {
    throw new Error(
      `${file} asks for levels ${JSON.stringify(c.levels)}, not ${JSON.stringify(LEVELS)}`,
    );
  }
  const trophies = forecastCase(c);
  writeFileSync(join(OUTPUT_DIR, `${id}.out`), `${JSON.stringify({ trophies })}\n`);
}
