// The calls on a candle chart: one arrow per AI from where the week opens, at the price it opens at, to the right
// edge of the plot: up for Higher, down for Lower, in the AI's own color and named, with its logo, at the tip.
// The tips fan out a fixed step apart, so an arrow's slant says which way a call went, never how far.

import type { Direction, Prediction } from '../ledger.ts';
import { DIRECTION_NAMES, MODEL_NAMES, modelBadge, SIGNS } from './ledger-view.ts';

export type CandleCall = Pick<Prediction, 'model' | 'direction'>;

// A point in the plot's viewBox: x across a plot `width` units wide, y down as a percent of its height.
export interface PlotPoint {
  readonly x: number;
  readonly y: number;
}

// Percent of the plot height the arrows take above and below the point they start from.
export interface FanRoom {
  readonly above: number;
  readonly below: number;
}

export interface CallArrows {
  readonly lines: readonly string[]; // for the plot's svg
  readonly heads: string; // for the layer over the plot
  readonly tips: string; // the names, beside the plot
}

const FAN = 12; // percent of the plot height between the tips of two calls the same way
const EDGE = 6; // percent of the plot height between the outermost tip and the edge of the plot

export function fanRoom(calls: readonly CandleCall[]): FanRoom {
  const count = (direction: Direction) => calls.filter((c) => c.direction === direction).length;
  return { above: count('up') * FAN + EDGE, below: count('down') * FAN + EDGE };
}

// In the order of the calls, each one a step further out than the call before it the same way.
export function callArrows(calls: readonly CandleCall[], origin: PlotPoint, width: number): CallArrows {
  const ends = calls.map((call, i) => {
    const rank = calls.slice(0, i).filter((c) => c.direction === call.direction).length;
    return { ...call, y: round(origin.y + (call.direction === 'up' ? -FAN : FAN) * (rank + 1)) };
  });
  const across = round(((width - origin.x) / width) * 100);
  return {
    lines: ends.map(
      ({ model, direction, y }) =>
        `<line class="candles-arrow ${model} ${direction}" x1="${origin.x}" y1="${origin.y}" x2="${width}" y2="${y}" vector-effect="non-scaling-stroke"/>`,
    ),
    heads: ends.map(({ model, y }) => `<span class="candles-head ${model}" style="top: ${y}%; --dx: ${across}; --dy: ${round(y - origin.y)}"></span>`).join(''),
    tips: `<span class="candles-tips" aria-hidden="true">${ends.map(tip).join('')}</span>`,
  };
}

function tip({ model, direction, y }: CandleCall & { readonly y: number }): string {
  return `<span class="candles-tip ${model} ${direction}" style="--y: ${y}">${modelBadge(model)}${MODEL_NAMES[model]} <span class="sign">${SIGNS[direction]}</span><span class="candles-word"> ${DIRECTION_NAMES[direction]}</span></span>`;
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
