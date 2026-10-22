export interface SparkInput {
  values: readonly number[];
  /** True where a value resets or steps up; drawn as a dark dot. */
  marks: readonly boolean[];
  /** Shaded band, e.g. min to max of a distance. */
  band?: { min: number; max: number };
  width: number;
  height: number;
  /** Vertical padding inside the chart. */
  pad?: number;
  /** Extra range above and below the data. */
  margin?: number;
}

export interface SparkGeometry {
  line: string;
  dots: string;
  markDots: string;
  bandY: number;
  bandHeight: number;
}

const f = (n: number) => n.toFixed(1);

/** SVG path data for a small trend chart with one point per week. */
export function sparkGeometry({ values, marks, band, width, height, pad = 7, margin = 0.4 }: SparkInput): SparkGeometry {
  const first = values[0] ?? 0;
  const lo = Math.min(band?.min ?? first, ...values) - margin;
  const hi = Math.max(band?.max ?? first, ...values) + margin;
  const span = hi - lo || 1;
  const x = (i: number) => ((i + 0.5) * width) / values.length;
  const y = (value: number) => pad + ((hi - value) / span) * (height - 2 * pad);
  const point = (value: number, i: number) => `${f(x(i))} ${f(y(value))}`;
  return {
    line: values.map((value, i) => `${i === 0 ? 'M' : 'L'}${point(value, i)}`).join(' '),
    dots: values.map((value, i) => `M${point(value, i)}h.01`).join(' '),
    markDots: values.flatMap((value, i) => (marks[i] ? [`M${point(value, i)}h.01`] : [])).join(' '),
    bandY: band ? y(band.max) : 0,
    bandHeight: band ? y(band.min) - y(band.max) : 0,
  };
}
