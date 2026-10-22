import { sparkGeometry } from './sparkline-geometry';

describe('sparkGeometry', () => {
  it('draws one point per value, evenly spaced, higher values higher up', () => {
    const { line } = sparkGeometry({ values: [4, 8], marks: [false, false], width: 100, height: 50, pad: 5, margin: 0 });
    expect(line).toBe('M25.0 45.0 L75.0 5.0');
  });

  it('only marks the flagged points', () => {
    const { markDots } = sparkGeometry({ values: [1, 2, 3], marks: [false, true, false], width: 90, height: 40, pad: 0, margin: 0 });
    expect(markDots).toBe('M45.0 20.0h.01');
  });

  it('places a band between max and min', () => {
    const geometry = sparkGeometry({
      values: [5, 6],
      marks: [false, false],
      band: { min: 4, max: 8 },
      width: 100,
      height: 44,
      pad: 4,
      margin: 0,
    });
    expect(geometry.bandY).toBe(4);
    expect(geometry.bandHeight).toBe(36);
  });

  it('survives a flat series without dividing by zero', () => {
    const { line } = sparkGeometry({ values: [3, 3, 3], marks: [false, false, false], width: 30, height: 20, margin: 0 });
    expect(line).not.toContain('NaN');
  });
});
