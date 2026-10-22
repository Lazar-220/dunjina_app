import type { Trend } from './weeks-model';

const WIDTH = 52;
const HEIGHT = 28;

/** Tiny line of eight neighbouring weeks with this week marked. */
export function MiniTrend({ trend, label }: { trend: Trend; label: string }) {
  const { values, currentIndex } = trend;
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const x = (i: number) => 3 + (i * (WIDTH - 6)) / Math.max(values.length - 1, 1);
  const y = (value: number) => (hi === lo ? HEIGHT / 2 : 4 + ((hi - value) / (hi - lo)) * (HEIGHT - 8));
  const line = values.map((value, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)} ${y(value).toFixed(1)}`).join(' ');
  const current = `M${x(currentIndex).toFixed(1)} ${y(values[currentIndex] ?? lo).toFixed(1)}h.01`;
  return (
    <svg className="sp" viewBox={`0 0 ${WIDTH} ${HEIGHT}`} width={WIDTH} height={HEIGHT} style={{ width: WIDTH, flex: 'none' }} role="img" aria-label={label}>
      <path className="ln" d={line} />
      <path className="cu" d={current} />
      <path className="cu2" d={current} />
    </svg>
  );
}
