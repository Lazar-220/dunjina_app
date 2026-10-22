import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Dexie from 'dexie';
import { App } from '../../app/App';
import { createDexieRepository } from '../../data/dexie-repository';
import type { Repository } from '../../data/repository';
import { createDemoPlan } from '../../domain/demo-plan';
import type { Plan } from '../../domain/schema';

let counter = 0;
const newId = () => `weeks-test-${++counter}`;
let databaseName = '';
let repository: Repository;
let plan: Plan;

/** Thursday of plan week 1 (the demo plan starts on Monday 2026-10-19). */
const TODAY = new Date(2026, 9, 22, 12, 0, 0);

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(TODAY);
  databaseName = `weeks-test-db-${newId()}`;
  repository = createDexieRepository(databaseName);
  plan = createDemoPlan('2026-10-19', newId);
  await repository.savePlan(plan);
  window.location.hash = '#/weeks';
});

afterEach(async () => {
  vi.useRealTimers();
  await Dexie.delete(databaseName);
});

async function openWeeks() {
  const user = userEvent.setup({ advanceTimers: () => undefined });
  render(<App repository={repository} />);
  await screen.findByRole('heading', { name: 'Weeks' });
  return user;
}

const slotOf = (type: string) => {
  const slot = plan.slots.find((s) => s.type === type);
  if (!slot) throw new Error(`No ${type} slot.`);
  return slot;
};

const weekCard = (week: number) => {
  const header = screen.getByRole('button', { name: new RegExp(`^Week ${week}\\b`) });
  const card = header.closest('section');
  if (!card) throw new Error(`No card for week ${week}.`);
  return card;
};

describe('weeks list', () => {
  it('shows the current week open with its summary and workouts, and the next weeks collapsed', async () => {
    await openWeeks();

    expect(screen.getByText('Autumn base · open-ended')).toBeInTheDocument();
    const week1 = weekCard(1);
    expect(within(week1).getByText('This week')).toBeInTheDocument();
    expect(within(week1).getByText(/19 Oct – 25 Oct · 7 workouts/)).toBeInTheDocument();
    expect(within(week1).getByText('≈ 32 km')).toBeInTheDocument();
    expect(within(week1).getByRole('button', { name: /^Upper body/ })).toHaveTextContent('Bench press 3×6 @ 45 kg · +2 more');
    expect(within(weekCard(2)).queryByText('Upper body')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Week 2,/ })).toHaveAttribute('aria-expanded', 'false');
  });

  it('expands another week and shows its progression tags', async () => {
    const user = await openWeeks();
    await user.click(screen.getByRole('button', { name: /^Week 2,/ }));

    const week2 = weekCard(2);
    expect(within(week2).getByRole('button', { name: /^Easy run A/ })).toHaveTextContent('6 km');
    expect(within(week2).queryByText('Weight step')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /^Week 4,/ }));
    const week4 = weekCard(4);
    expect(within(week4).getAllByText('Weight step')).toHaveLength(2);
    expect(within(week4).getByText('Speed +0.5')).toBeInTheDocument();
  });

  it('keeps loading weeks without a limit', async () => {
    const user = await openWeeks();
    expect(screen.getAllByRole('button', { name: /^Week \d+/ })).toHaveLength(5);

    for (let i = 0; i < 6; i++) await user.click(await screen.findByRole('button', { name: 'Load more weeks' }));

    await waitFor(() => expect(screen.getAllByRole('button', { name: /^Week \d+/ })).toHaveLength(29));
    expect(screen.getByRole('button', { name: /^Week 29,/ })).toBeInTheDocument();
  });

  it('shows the done workouts of a week as tags and counts them', async () => {
    const upper = slotOf('upper');
    await repository.saveOverride({
      planId: plan.id,
      slotId: upper.id,
      week: 1,
      done: true,
      values: { kind: 'strength', exercises: [] },
    });
    await openWeeks();

    const week1 = weekCard(1);
    expect(within(week1).getByText(/1 of 7 done/)).toBeInTheDocument();
    expect(within(week1).getByRole('button', { name: 'Upper body' })).toBeInTheDocument();
    expect(within(week1).queryByRole('button', { name: /^Upper body.*Bench/ })).not.toBeInTheDocument();
  });

  it('stops at the end of a plan with an end date', async () => {
    await repository.savePlan({ ...plan, endDate: '2026-11-08' });
    await openWeeks();

    expect(await screen.findByText('This is the last week of the plan.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Load more weeks' })).not.toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /^Week \d+/ })).toHaveLength(3);
  });

  it('explains the empty state when there is no active plan', async () => {
    await repository.savePlan({ ...plan, endedOn: '2026-10-20' });
    await openWeeks();

    expect(await screen.findByText('No weeks to show')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Create plan' })).toHaveAttribute('href', '#/plans/new');
  });
});

describe('inline edit and reset', () => {
  async function editLongRun(user: ReturnType<typeof userEvent.setup>, km: string) {
    await user.click(screen.getByRole('button', { name: 'Edit Long run inline' }));
    const distance = screen.getByRole('textbox', { name: 'Distance' });
    await user.clear(distance);
    await user.type(distance, km);
  }

  it('previews the later weeks, saves the edit as the new baseline, and marks it as edited', async () => {
    const user = await openWeeks();
    await editLongRun(user, '12');

    expect(await screen.findByText('Later weeks recalculate from this value')).toBeInTheDocument();
    const preview = screen.getByText('Later weeks recalculate from this value').closest('div');
    expect(preview).toHaveTextContent('W2');
    expect(preview).toHaveTextContent('11 km');
    expect(preview).toHaveTextContent('13 km');
    expect(await repository.listOverrides(plan.id)).toEqual([]);

    await user.click(screen.getByRole('button', { name: 'Done' }));

    expect(await screen.findByText('Changes saved')).toBeInTheDocument();
    const [stored] = await repository.listOverrides(plan.id);
    expect(stored).toMatchObject({ slotId: slotOf('long').id, week: 1, values: { kind: 'run', km: 12 } });
    expect(stored?.done).toBeUndefined();
    const longRun = within(weekCard(1)).getByRole('button', { name: /^Long run/ });
    expect(longRun).toHaveTextContent('edited');
    expect(longRun).toHaveTextContent('12 km');
    expect(longRun).toHaveTextContent('10 km');

    await user.click(screen.getByRole('button', { name: /^Week 2,/ }));
    const week2Long = within(weekCard(2)).getByRole('button', { name: /^Long run/ });
    expect(week2Long).toHaveTextContent('13 km');
    expect(week2Long).toHaveTextContent('Follows your W1 edit · plan 11 km');
  });

  it('moves the day from the inline editor without touching the values', async () => {
    const user = await openWeeks();
    await user.click(screen.getByRole('button', { name: 'Edit Long run inline' }));
    await user.click(screen.getByRole('button', { name: 'Sat 24 Oct' }));
    await user.click(screen.getByRole('button', { name: 'Done' }));

    await waitFor(async () => {
      const [stored] = await repository.listOverrides(plan.id);
      expect(stored).toEqual({ planId: plan.id, slotId: slotOf('long').id, week: 1, date: '2026-10-24' });
    });
  });

  it('resets one workout from its editor', async () => {
    await repository.saveOverride({ planId: plan.id, slotId: slotOf('long').id, week: 1, values: { kind: 'run', km: 12 } });
    const user = await openWeeks();
    await user.click(screen.getByRole('button', { name: 'Edit Long run inline' }));
    await user.click(screen.getByRole('button', { name: 'Reset to 10 km' }));

    await waitFor(async () => expect(await repository.listOverrides(plan.id)).toEqual([]));
    expect(await screen.findByText('Reset to generated values')).toBeInTheDocument();
  });

  it('resets the whole week but keeps done workouts, and undo brings the edits back', async () => {
    const long = slotOf('long');
    const easy = slotOf('easy');
    const upper = slotOf('upper');
    await repository.saveOverrides([
      { planId: plan.id, slotId: long.id, week: 1, values: { kind: 'run', km: 12 } },
      { planId: plan.id, slotId: easy.id, week: 1, date: '2026-10-24' },
      { planId: plan.id, slotId: upper.id, week: 1, done: true, values: { kind: 'strength', exercises: [] } },
      { planId: plan.id, slotId: long.id, week: 2, values: { kind: 'run', km: 9 } },
    ]);
    const user = await openWeeks();

    await user.click(within(weekCard(1)).getByRole('button', { name: 'Reset week to generated values' }));

    expect(await screen.findByText('Week 1 reset to generated values')).toBeInTheDocument();
    const remaining = await repository.listOverrides(plan.id);
    expect(remaining.map((o) => [o.slotId === upper.id ? 'upper' : o.slotId === long.id ? 'long' : 'easy', o.week]).sort()).toEqual([
      ['long', 2],
      ['upper', 1],
    ]);

    await user.click(screen.getByRole('button', { name: 'Undo' }));
    await waitFor(async () => expect(await repository.listOverrides(plan.id)).toHaveLength(4));
  });

  it('opens the move sheet from the weekday button', async () => {
    const user = await openWeeks();
    await user.click(within(weekCard(1)).getAllByRole('button', { name: 'Weekday Sun, change' })[0] as HTMLElement);

    expect(await screen.findByRole('dialog', { name: 'Move Long run' })).toBeInTheDocument();
  });
});
