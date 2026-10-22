import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Dexie from 'dexie';
import { App } from '../../app/App';
import { createDexieRepository } from '../../data/dexie-repository';
import type { Repository } from '../../data/repository';
import { createDemoPlan } from '../../domain/demo-plan';
import type { Plan } from '../../domain/schema';

let counter = 0;
const newId = () => `calendar-test-${++counter}`;
let databaseName = '';
let repository: Repository;
let plan: Plan;

/** Thursday of plan week 1 (the demo plan starts on Monday 2026-10-19). */
const TODAY = new Date(2026, 9, 22, 12, 0, 0);

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(TODAY);
  databaseName = `calendar-test-db-${newId()}`;
  repository = createDexieRepository(databaseName);
  plan = createDemoPlan('2026-10-19', newId);
  await repository.savePlan(plan);
  window.location.hash = '#/';
});

afterEach(async () => {
  vi.useRealTimers();
  await Dexie.delete(databaseName);
});

async function openCalendar() {
  const user = userEvent.setup({ advanceTimers: () => undefined });
  render(<App repository={repository} />);
  await screen.findByRole('heading', { name: 'October 2026' });
  return user;
}

const slotOf = (type: string) => {
  const slot = plan.slots.find((s) => s.type === type);
  if (!slot) throw new Error(`No ${type} slot.`);
  return slot;
};

async function openWorkout(user: ReturnType<typeof userEvent.setup>, name: RegExp) {
  await user.click(await screen.findByRole('button', { name }));
  return screen.findByRole('dialog');
}

describe('calendar with a plan', () => {
  it('shows today’s drafts in the agenda and the plan week in the header', async () => {
    await openCalendar();

    expect(screen.getByText('Autumn base · Week 1')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Thu 22 Oct' })).toBeInTheDocument();
    expect(screen.getByText('Today · 2 workouts')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Upper body/ })).toHaveTextContent('Bench press 3×6 @ 45 kg · +2 more');
    expect(screen.getByRole('button', { name: /Easy run B/ })).toHaveTextContent('4 km');
  });

  it('selects another day and goes to the next month without a limit', async () => {
    const user = await openCalendar();

    await user.click(screen.getByRole('button', { name: 'Mon 26 Oct, 1 workout' }));
    expect(screen.getByRole('heading', { name: 'Mon 26 Oct' })).toBeInTheDocument();
    expect(screen.getByText('Week 2 · 1 workout')).toBeInTheDocument();

    for (let i = 0; i < 14; i++) await user.click(screen.getByRole('button', { name: 'Next month' }));
    expect(screen.getByRole('heading', { name: 'December 2027' })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /workouts?$/ }).length).toBeGreaterThan(20);
  }, 20_000);

  it('shows a rest day with a prompt to add a workout', async () => {
    const user = await openCalendar();
    await user.click(screen.getByRole('button', { name: 'Sat 24 Oct, no workouts' }));
    expect(screen.getByRole('button', { name: /Rest day · tap to add a workout/ })).toBeInTheDocument();
  });
});

describe('mark as done with propagation', () => {
  it('previews the next weeks, saves a snapshot as the new baseline, and can be undone', async () => {
    const user = await openCalendar();
    await openWorkout(user, /Upper body/);
    await user.click(screen.getByRole('button', { name: 'Mark as done' }));

    const sheet = await screen.findByRole('dialog', { name: 'Mark as done: Upper body' });
    expect(within(sheet).getByText('Matches the plan. Later weeks stay as generated.')).toBeInTheDocument();

    const reps = within(sheet).getByRole('textbox', { name: 'Reps for Bench press' });
    await user.clear(reps);
    await user.type(reps, '8');

    expect(await within(sheet).findByText('This changes the next weeks.')).toBeInTheDocument();
    const preview = within(sheet).getByText('Bench press', { selector: '.b.sm' }).closest('.ex');
    expect(preview).not.toBeNull();
    expect(preview).toHaveTextContent('W2');
    expect(preview).toHaveTextContent('8@45');
    expect(preview).toHaveTextContent('10@45');
    expect(within(sheet).queryByText('Matches the plan. Later weeks stay as generated.')).not.toBeInTheDocument();
    expect((await repository.listOverrides(plan.id)).length).toBe(0);

    await user.click(within(sheet).getByRole('button', { name: 'Save as done' }));

    expect(await screen.findByText('Upper body marked done')).toBeInTheDocument();
    const [stored] = await repository.listOverrides(plan.id);
    expect(stored).toMatchObject({ slotId: slotOf('upper').id, week: 1, done: true });
    expect(stored?.values).toEqual({
      kind: 'strength',
      exercises: expect.arrayContaining([{ exerciseId: expect.any(String), sets: 3, reps: 8, kg: 45 }]),
    });
    expect(screen.getByRole('button', { name: /Upper body/ })).toHaveTextContent('Done');

    // The new baseline reaches next week: 8 reps become 10, not the generated 8.
    await user.click(screen.getByRole('button', { name: 'Mon 26 Oct, 1 workout' }));
    await user.click(screen.getByRole('button', { name: 'Thu 29 Oct, 2 workouts' }));
    expect(screen.getByRole('button', { name: /Upper body/ })).toHaveTextContent('Bench press 3×10 @ 45 kg');

    await user.click(screen.getByRole('button', { name: 'Undo' }));
    await waitFor(async () => expect(await repository.listOverrides(plan.id)).toEqual([]));
  });

  it('says so when nothing was changed and still stores the snapshot', async () => {
    const user = await openCalendar();
    await openWorkout(user, /Easy run B/);
    await user.click(screen.getByRole('button', { name: 'Mark as done' }));
    const sheet = await screen.findByRole('dialog', { name: 'Mark as done: Easy run B' });

    expect(within(sheet).getByText('Matches the plan. Later weeks stay as generated.')).toBeInTheDocument();
    await user.click(within(sheet).getByRole('button', { name: 'Save as done' }));

    await waitFor(async () =>
      expect(await repository.listOverrides(plan.id)).toEqual([
        { planId: plan.id, slotId: expect.any(String), week: 1, done: true, values: { kind: 'run', km: 4 } },
      ]),
    );
  });

  it('shows interval speed as "all later weeks" and the other fields as "this session only"', async () => {
    const user = await openCalendar();
    await user.click(screen.getByRole('button', { name: 'Tue 20 Oct, 1 workout' }));
    await openWorkout(user, /Intervals/);
    await user.click(screen.getByRole('button', { name: 'Mark as done' }));
    const sheet = await screen.findByRole('dialog', { name: 'Mark as done: Intervals' });

    expect(within(sheet).getByText('All later weeks')).toBeInTheDocument();
    expect(within(sheet).getByText('This session only')).toBeInTheDocument();

    const speed = within(sheet).getByRole('textbox', { name: 'Speed' });
    await user.clear(speed);
    await user.type(speed, '11');
    await user.click(within(sheet).getByRole('button', { name: 'One fewer' }));

    expect(await within(sheet).findByText('Speed in the next weeks')).toBeInTheDocument();
    expect(within(sheet).getByText(/Draft 1 returns as 8 × 400 m, 60 s in W4/)).toBeInTheDocument();
  });
});

describe('edit, move, delete and reset', () => {
  it('moves a workout to another day of its week and keeps its values', async () => {
    const user = await openCalendar();
    await openWorkout(user, /Easy run B/);
    await user.click(screen.getByRole('button', { name: 'Move to…' }));
    const sheet = await screen.findByRole('dialog', { name: 'Move Easy run B' });

    await user.click(within(sheet).getByRole('button', { name: 'Fri 23 Oct' }));
    expect(within(sheet).getByText(/Fri already has Tempo\./)).toBeInTheDocument();
    await user.click(within(sheet).getByRole('button', { name: 'Move to Fri 23 Oct' }));

    expect(await screen.findByText('Moved to Fri 23 Oct')).toBeInTheDocument();
    const [stored] = await repository.listOverrides(plan.id);
    expect(stored).toEqual({ planId: plan.id, slotId: expect.any(String), week: 1, date: '2026-10-23' });
    expect(screen.getByText('Today · 1 workout')).toBeInTheDocument();
  });

  it('deletes only that instance after confirmation, and undo brings it back', async () => {
    const user = await openCalendar();
    await openWorkout(user, /Easy run B/);
    await user.click(screen.getByRole('button', { name: 'Delete' }));
    const confirm = await screen.findByRole('dialog', { name: 'Delete Easy run B on Thu 22 Oct?' });
    expect(within(confirm).getByText('Only this workout is removed. Later weeks keep their values.')).toBeInTheDocument();

    await user.click(within(confirm).getByRole('button', { name: 'Delete workout' }));

    expect(await screen.findByText('Easy run B deleted')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Easy run B/ })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Mon 26 Oct, 1 workout' }));
    await user.click(screen.getByRole('button', { name: 'Thu 29 Oct, 2 workouts' }));
    expect(screen.getByRole('button', { name: /Easy run B/ })).toHaveTextContent('5 km');

    await user.click(screen.getByRole('button', { name: 'Undo' }));
    await waitFor(async () => expect(await repository.listOverrides(plan.id)).toEqual([]));
  });

  it('keeps the workout when the user chooses Keep', async () => {
    const user = await openCalendar();
    await openWorkout(user, /Easy run B/);
    await user.click(screen.getByRole('button', { name: 'Delete' }));
    await user.click(await screen.findByRole('button', { name: 'Keep' }));

    expect(screen.getByRole('dialog', { name: 'Easy run B workout' })).toBeInTheDocument();
    expect(await repository.listOverrides(plan.id)).toEqual([]);
  });

  it('edits a draft, marks it edited, and resets it to the generated values', async () => {
    const user = await openCalendar();
    await openWorkout(user, /Easy run B/);
    await user.click(screen.getByRole('button', { name: 'Edit' }));
    const sheet = await screen.findByRole('dialog', { name: 'Edit workout: Easy run B' });
    const km = within(sheet).getByRole('textbox', { name: 'Distance' });
    await user.clear(km);
    await user.type(km, '6');
    await user.click(within(sheet).getByRole('button', { name: 'Save changes' }));

    expect(await screen.findByText('Changes saved')).toBeInTheDocument();
    const [stored] = await repository.listOverrides(plan.id);
    expect(stored?.values).toEqual({ kind: 'run', km: 6 });
    expect(stored?.done).toBeUndefined();
    expect(screen.getByRole('button', { name: /Easy run B/ })).toHaveTextContent('edited');

    await user.click(screen.getByRole('button', { name: /Easy run B/ }));
    await user.click(await screen.findByRole('button', { name: 'Reset to generated values' }));
    await waitFor(async () => expect(await repository.listOverrides(plan.id)).toEqual([]));
    expect(await screen.findByText('Reset to generated values')).toBeInTheDocument();
  });
});

describe('one-off workouts', () => {
  it('adds a one-off on a chosen day, logs it, and leaves the plan untouched', async () => {
    const user = await openCalendar();
    await user.click(screen.getByRole('button', { name: 'Sat 24 Oct, no workouts' }));
    await user.click(screen.getByRole('button', { name: 'Add workout' }));
    const add = await screen.findByRole('dialog', { name: 'Add workout' });
    expect(within(add).getByLabelText(/Date · Sat 24 Oct · rest day/)).toHaveValue('2026-10-24');
    expect(within(add).getByText(/never change its progression/)).toBeInTheDocument();

    await user.click(within(add).getByRole('button', { name: /Long run/ }));

    const view = await screen.findByRole('dialog', { name: 'Long run workout' });
    expect(within(view).getByText('Sat 24 Oct · One-off')).toBeInTheDocument();
    await user.click(within(view).getByRole('button', { name: 'Mark as done' }));
    const sheet = await screen.findByRole('dialog', { name: 'Mark as done: Long run' });
    expect(within(sheet).getByText(/Enter what you did/)).toBeInTheDocument();
    await user.click(within(sheet).getByRole('button', { name: 'Save as done' }));

    expect(await screen.findByText('Long run marked done')).toBeInTheDocument();
    expect(await repository.listOverrides(plan.id)).toEqual([]);
    const [oneOff] = await repository.listOneOffs();
    expect(oneOff).toMatchObject({ date: '2026-10-24', type: 'long', done: true, details: { kind: 'run', km: 10 } });
    expect(screen.getByRole('button', { name: /Long run/ })).toHaveTextContent('Done');
  });
});

describe('week view', () => {
  it('lists the days of the week and moves a workout from the more-actions button', async () => {
    const user = await openCalendar();
    await user.click(screen.getByRole('button', { name: 'Week' }));

    expect(screen.getByRole('heading', { name: 'Week of Mon 19 Oct' })).toBeInTheDocument();
    expect(screen.getByText('Autumn base · Week 1')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'More actions for Easy run B' }));
    const sheet = await screen.findByRole('dialog', { name: 'Move Easy run B' });
    await user.click(within(sheet).getByRole('button', { name: 'Sat 24 Oct' }));
    await user.click(within(sheet).getByRole('button', { name: 'Move to Sat 24 Oct' }));

    expect(await screen.findByText('Moved to Sat 24 Oct')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Next week' }));
    expect(screen.getByRole('heading', { name: 'Week of Mon 26 Oct' })).toBeInTheDocument();
  });
});

describe('empty state', () => {
  it('offers to create a plan or import a backup when there is nothing yet', async () => {
    const empty = createDexieRepository(`${databaseName}-empty`);
    render(<App repository={empty} />);

    expect(await screen.findByRole('heading', { name: 'No active plan' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Create plan/ })).toHaveAttribute('href', '#/plans/new');
    expect(screen.getByRole('link', { name: /Import a backup/ })).toHaveAttribute('href', '#/settings');
    await Dexie.delete(`${databaseName}-empty`);
  });
});

describe('when saving fails', () => {
  it('tells the user, keeps the sheet and their input open, and stores nothing', async () => {
    const failing: Repository = {
      ...repository,
      saveOverride: async () => {
        throw new Error('The disk is full.');
      },
    };
    const user = userEvent.setup({ advanceTimers: () => undefined });
    render(<App repository={failing} />);
    await screen.findByRole('heading', { name: 'October 2026' });
    await openWorkout(user, /Easy run B/);
    await user.click(screen.getByRole('button', { name: 'Mark as done' }));
    const sheet = await screen.findByRole('dialog', { name: 'Mark as done: Easy run B' });
    const km = within(sheet).getByRole('textbox', { name: 'Distance' });
    await user.clear(km);
    await user.type(km, '6');

    await user.click(within(sheet).getByRole('button', { name: 'Save as done' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Couldn’t save your change. Nothing was lost. The disk is full.');
    expect(screen.getByRole('dialog', { name: 'Mark as done: Easy run B' })).toBeInTheDocument();
    expect(within(sheet).getByRole('textbox', { name: 'Distance' })).toHaveValue('6');
    expect(screen.queryByText('Easy run B marked done')).not.toBeInTheDocument();
    expect(await repository.listOverrides(plan.id)).toEqual([]);
  });
});
