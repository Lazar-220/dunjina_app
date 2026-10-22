import { newSlot, projectSlot, type WizardDraft } from './wizard-model';
import { runSeries, speedSeries, strengthSeries, tempoColumns } from './projection-view';

let counter = 0;
const newId = () => `pv-${++counter}`;
const draftOf = (slot: WizardDraft['slots'][number]): WizardDraft => ({
  name: 'Plan',
  startDate: '2026-10-19',
  endDate: null,
  slots: [slot],
});

describe('runSeries', () => {
  it('marks the week a run resets to min after reaching max', () => {
    const slot = newSlot('easy', [], newId);
    if (slot.type !== 'easy') throw new Error('Expected an easy run.');
    const config = { current: 8, min: 6, max: 12, step: 1 };
    const series = runSeries(projectSlot(draftOf({ ...slot, run: config }), slot.id), config);
    expect(series.values).toEqual([8, 9, 10, 11, 12, 6, 7, 8]);
    expect(series.marks).toEqual([false, false, false, false, false, true, false, false]);
    expect(series.cells[5]).toEqual({ week: 'W6', main: '6', mark: true });
  });
});

describe('strengthSeries', () => {
  it('shows reps with the weight and marks every weight step', () => {
    const slot = newSlot('lower', [], newId);
    if (slot.type !== 'lower') throw new Error('Expected a lower body slot.');
    const exercise = slot.exercises[0];
    if (!exercise) throw new Error('No exercise.');
    const series = strengthSeries(projectSlot(draftOf(slot), slot.id), exercise.id);
    expect(series.values).toEqual([6, 8, 10, 6, 8, 10, 6, 8]);
    expect(series.cells.map((c) => c.sub)).toEqual(['40', '40', '40', '42.5', '42.5', '42.5', '45', '45']);
    expect(series.marks).toEqual([false, false, false, true, false, false, true, false]);
  });
});

describe('speedSeries', () => {
  it('shows the draft and speed and marks each step up', () => {
    const slot = newSlot('intervals', [], newId);
    const series = speedSeries(projectSlot(draftOf(slot), slot.id));
    expect(series.cells.slice(0, 4).map((c) => `${c.main}@${c.sub}`)).toEqual(['D1@12.0', 'D2@12.0', 'D3@12.0', 'D1@12.5']);
    expect(series.marks.slice(0, 5)).toEqual([false, false, false, true, false]);
  });
});

describe('tempoColumns', () => {
  it('splits each session into warm-up, tempo and cool-down', () => {
    const slot = newSlot('tempo', [], newId);
    const [first, second] = tempoColumns(projectSlot(draftOf(slot), slot.id));
    expect(first).toEqual({ week: 'W1', total: 6.5, warmup: 2, tempo: 3, cooldown: 1.5 });
    expect(second?.total).toBe(7.5);
  });
});
