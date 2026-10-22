import { sparkGeometry, type SparkInput } from './sparkline-geometry';

interface SparklineProps extends Omit<SparkInput, 'width' | 'height'> {
  height: number;
  /** Class that sets the line colour (a workout type colour class). */
  colorClass: string;
  /** Text alternative describing the series, e.g. "Easy run distance in km, weeks 1 to 8: 5, 6, ...". */
  label: string;
}

const WIDTH = 326;

export function Sparkline({ colorClass, label, height, ...input }: SparklineProps) {
  const geometry = sparkGeometry({ ...input, width: WIDTH, height });
  return (
    <svg className={`sp ${colorClass}`} viewBox={`0 0 ${WIDTH} ${height}`} height={height} role="img" aria-label={label}>
      {input.band && <rect className="band" x="0" y={geometry.bandY} width={WIDTH} height={geometry.bandHeight} rx="6" />}
      <path className="ln" d={geometry.line} />
      <path className="pt" d={geometry.dots} />
      <path className="rs" d={geometry.markDots} />
    </svg>
  );
}
