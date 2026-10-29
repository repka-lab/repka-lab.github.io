// Ledger tables for the site: the per-model scoreboard and the full list of forecasts.
// A result is always a sign plus a word, so it never depends on color alone.

import { getStats, MODELS } from '../ledger.ts';
import type { Asset, Direction, Ledger, Model, Prediction, Verification } from '../ledger.ts';
import { escapeHtml } from './html.ts';

const MODEL_NAMES: Readonly<Record<Model, string>> = { chatgpt: 'ChatGPT', claude: 'Claude', gemini: 'Gemini', grok: 'Grok' };
const ASSET_NAMES: Readonly<Record<Asset, string>> = { gold: 'Gold', silver: 'Silver', sp500: 'S&P 500', nasdaq: 'NASDAQ' };
const DIRECTION_NAMES: Readonly<Record<Direction, string>> = { up: 'Up', down: 'Down', flat: 'Flat' };

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const NONE = '—';
const MINUS = '−';

// A plain day stays as it is; a moment becomes "YYYY-MM-DD HH:MM UTC".
export function formatUtc(value: string): string {
  if (DAY.test(value)) return value;
  const iso = new Date(value).toISOString();
  return `${iso.slice(0, 10)} ${iso.slice(11, 16)} UTC`;
}

// A price move in percent, signed: +1.50%, −0.20%, 0.00%.
export function formatChange(changePct: number): string {
  const digits = Math.abs(changePct).toFixed(2);
  if (digits === '0.00') return '0.00%';
  return `${changePct > 0 ? '+' : MINUS}${digits}%`;
}

function percent(value: number | null, scale: number): string {
  return value === null ? NONE : `${Math.round(value * scale)}%`;
}

export function renderScoreboard(ledger: Ledger): string {
  const stats = getStats(ledger);
  const rows = MODELS.map((model) => {
    const s = stats[model];
    const cells = [s.predictions, s.verified, s.pending, s.hits, s.misses]
      .map((n) => `<td class="num">${n}</td>`)
      .concat(`<td class="num">${percent(s.hit_rate, 100)}</td>`, `<td class="num">${percent(s.avg_confidence, 1)}</td>`);
    return `<tr><th scope="row">${MODEL_NAMES[model]}</th>${cells.join('')}</tr>`;
  });

  return `<div class="table-wrap">
  <table class="scoreboard">
    <thead><tr><th scope="col">Model</th><th scope="col" class="num">Forecasts</th><th scope="col" class="num">Checked</th><th scope="col" class="num">Pending</th><th scope="col" class="num">Hits</th><th scope="col" class="num">Misses</th><th scope="col" class="num">Hit rate</th><th scope="col" class="num">Avg. confidence</th></tr></thead>
    <tbody>
      ${rows.join('\n      ')}
    </tbody>
  </table>
</div>`;
}

export function renderLedgerTable(ledger: Ledger): string {
  if (ledger.predictions.length === 0) {
    return '<p class="empty">No forecasts recorded yet. The first ones appear here before any video or post about them goes out.</p>';
  }
  const verdicts = new Map(ledger.verifications.map((v) => [v.prediction_id, v]));
  const rows = ledger.predictions.toReversed().map((p) => ledgerRow(p, verdicts.get(p.id)));

  return `<div class="table-wrap">
  <table class="ledger">
    <thead><tr><th scope="col">ID</th><th scope="col">Recorded</th><th scope="col">Model</th><th scope="col">Asset</th><th scope="col">Call</th><th scope="col" class="num">Confidence</th><th scope="col">Check date</th><th scope="col">Result</th><th scope="col">Details</th></tr></thead>
    <tbody>
      ${rows.join('\n      ')}
    </tbody>
  </table>
</div>`;
}

function ledgerRow(p: Prediction, verdict: Verification | undefined): string {
  const cells = [
    `<th scope="row">${p.id}</th>`,
    `<td>${formatUtc(p.date)}</td>`,
    `<td>${MODEL_NAMES[p.model]}<br><small>${escapeHtml(p.model_version)}</small></td>`,
    `<td>${escapeHtml(ASSET_NAMES[p.asset])}</td>`,
    `<td>${DIRECTION_NAMES[p.direction]}</td>`,
    `<td class="num">${p.confidence}%</td>`,
    `<td>${formatUtc(p.verify_date)}</td>`,
    `<td>${resultCell(verdict)}</td>`,
    `<td>${detailsCell(p, verdict)}</td>`,
  ];
  return `<tr>${cells.join('')}</tr>`;
}

function resultCell(verdict: Verification | undefined): string {
  if (!verdict) return '<span class="result pending">Pending</span>';
  const label = verdict.hit ? '<span class="result hit">✓ Hit</span>' : '<span class="result miss">✗ Miss</span>';
  return `${label}<br><small>${DIRECTION_NAMES[verdict.outcome]}, ${formatChange(verdict.change_pct)}</small>`;
}

function detailsCell(p: Prediction, verdict: Verification | undefined): string {
  const facts = [
    `<dt>Reasoning</dt><dd>${escapeHtml(p.reasoning)}</dd>`,
    `<dt>Flat band</dt><dd>±${p.flat_threshold_pct}%</dd>`,
    `<dt>Prompt hash</dt><dd><code>${p.prompt_hash}</code></dd>`,
  ];
  const prices = verdict
    ? [
        `<dt>Prices</dt><dd>${verdict.price_start} → ${verdict.price_end} (${escapeHtml(verdict.price_source)})</dd>`,
        `<dt>Checked</dt><dd>${formatUtc(verdict.verified_at)}</dd>`,
      ]
    : [];
  return `<details><summary>Show</summary><dl>${[...facts, ...prices].join('')}</dl></details>`;
}
