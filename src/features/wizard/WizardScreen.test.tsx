import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Dexie from 'dexie';
import { App } from '../../app/App';
import { createDexieRepository } from '../../data/dexie-repository';
import type { Repository } from '../../data/repository';
import { createDemoPlan } from '../../domain/demo-plan';
import type { Plan } from '../../domain/schema';

let counter = 0;
const newId = () => `wizard-test-${++counter}`;
let databaseName = '';
let repository: Repository;

const TODAY = new Date(2026, 9, 22, 12, 0, 0);

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(TODAY);
  databaseName = `wizard-test-db-${newId()}`;
  repository = createDexieRepository(databaseName);
});

afterEach(async () => {
  vi.useRealTimers();
  await Dexie.delete(databaseName);
});

function openWizard(hash = '#/plans/new') {
  window.location.hash = hash;
  const user = userEvent.setup({ advanceTimers: () => undefined });
  render(<App repository={repository} />);
  return user;
}

const setDate = (label: string, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } });

describe('basics step', () => {
  it('blocks Next with a clear message when the end date is not after the start date', async () => {
    const user = openWizard();
    await screen.findByRole('heading', { name: 'Basics' });
    await user.type(screen.getByLabelText('Plan name'), 'Autumn base');
    expect(screen.getByRole('button', { name: 'Next: weekly structure' })).toBeEnabled();

    await user.click(screen.getByRole('switch', { name: 'Open-ended' }));
    setDate('End date', '2026-10-12');

    expect(await screen.findByText('End date must be after the start date.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Next: weekly structure' })).toBeDisabled();

    setDate('End date', '2026-12-20');
    await waitFor(() => expect(screen.getByRole('button', { name: 'Next: weekly structure' })).toBeEnabled());
  });

  it('needs a plan name and explains week 1 for a mid-week start', async () => {
    const user = openWizard();
    await screen.findByRole('heading', { name: 'Basics' });
    expect(screen.getByRole('button', { name: 'Next: weekly structure' })).toBeDisabled();

    setDate('Start date', '2026-10-22');
    expect(screen.getByText('Weeks run Monday to Sunday. Week 1 is the week of Mon 19 Oct.')).toBeInTheDocument();

    await user.type(screen.getByLabelText('Plan name'), 'x');
    expect(screen.getByRole('button', { name: 'Next: weekly structure' })).toBeEnabled();
  });
});

describe('creating a plan', () => {
  it('walks through all four steps, warns without blocking, saves, and shows the plan in the calendar', async () => {
    const user = openWizard();
    await screen.findByRole('heading', { name: 'Basics' });
    await user.type(screen.getByLabelText('Plan name'), 'Test plan');
    await user.click(screen.getByRole('button', { name: 'Next: weekly structure' }));

    await screen.findByRole('heading', { name: 'Weekly structure' });
    expect(screen.getByRole('button', { name: 'Next: configure slots' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Easy run' }));
    await user.click(screen.getByRole('button', { name: 'Long run' }));
    expect(screen.getByText('2 workouts per week')).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText('Weekday for Long run'), 'Sat');
    await user.click(screen.getByRole('button', { name: 'Next: configure slots' }));

    await screen.findByRole('heading', { name: 'Easy run' });
    expect(screen.getByText('Slot 1 of 2 · Wed')).toBeInTheDocument();
    const current = screen.getByRole('textbox', { name: 'Current km' });
    await user.clear(current);
    await user.type(current, '11');
    expect(
      await screen.findByText('Above max (8 km). Week 1 runs 11 km, then week 2 resets to 4 km.'),
    ).toBeInTheDocument();
    expect(screen.getByText('Projection · km')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Next slot: Long run' }));

    await screen.findByRole('heading', { name: 'Long run' });
    await user.click(screen.getByRole('button', { name: 'Review plan' }));

    await screen.findByRole('heading', { name: 'Review' });
    expect(screen.getByText('Open-ended')).toBeInTheDocument();
    expect(screen.getByText(/Starts Mon 19 Oct · 2 workouts a week · 0 strength, 2 running/)).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /Running km per week, weeks 1 to 8/ })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Save plan' }));

    await screen.findByText('Plan created');
    const [saved] = await repository.listPlans();
    expect(saved).toMatchObject({ name: 'Test plan', startDate: '2026-10-19', endDate: null, endedOn: null });
    expect(saved?.slots.map((s) => [s.type, s.defaultWeekday])).toEqual([
      ['easy', 2],
      ['long', 5],
    ]);
    const easy = saved?.slots[0];
    expect(easy?.type === 'easy' && easy.run).toEqual({ current: 11, min: 4, max: 8, step: 1 });
    expect(window.location.hash).toBe('#/');
    expect(await screen.findByText('Test plan · Week 1')).toBeInTheDocument();
  });

  it('lets a strength slot be built from scratch with its projection', async () => {
    const user = openWizard();
    await screen.findByRole('heading', { name: 'Basics' });
    await user.type(screen.getByLabelText('Plan name'), 'Lifting');
    await user.click(screen.getByRole('button', { name: 'Next: weekly structure' }));
    await user.click(await screen.findByRole('button', { name: 'Lower body' }));
    await user.click(screen.getByRole('button', { name: 'Next: configure slots' }));

    await screen.findByRole('heading', { name: 'Lower body' });
    await user.clear(screen.getByLabelText('Exercise'));
    await user.type(screen.getByLabelText('Exercise'), 'Back squat');
    expect(screen.getByText('Projection · reps@kg')).toBeInTheDocument();
    expect(screen.getByText('6@40')).toBeInTheDocument();
    expect(screen.getByText('6@42.5')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Review plan' }));
    await screen.findByRole('heading', { name: 'Review' });
    expect(screen.getByText('Back squat')).toBeInTheDocument();
  });

  it('blocks a strength slot whose exercise has no name', async () => {
    const user = openWizard();
    await user.type(await screen.findByLabelText('Plan name'), 'Lifting');
    await user.click(screen.getByRole('button', { name: 'Next: weekly structure' }));
    await user.click(await screen.findByRole('button', { name: 'Upper body' }));
    await user.click(screen.getByRole('button', { name: 'Next: configure slots' }));
    await user.clear(await screen.findByLabelText('Exercise'));

    expect(screen.getByRole('button', { name: 'Review plan' })).toBeDisabled();
  });
});

describe('one active plan', () => {
  it('asks to end the current plan before creating another', async () => {
    await repository.savePlan(createDemoPlan('2026-10-19', newId));
    openWizard();

    expect(await screen.findByRole('heading', { name: 'You already have an active plan' })).toBeInTheDocument();
    expect(screen.getByText(/End “Autumn base” in Plans first/)).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Basics' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Go to Plans' })).toHaveAttribute('href', '#/plans');
  });

  it('allows a new plan once the previous one has ended and can duplicate it', async () => {
    const ended: Plan = { ...createDemoPlan('2026-03-16', newId), endedOn: '2026-06-14' };
    await repository.savePlan(ended);
    openWizard(`#/plans/new?from=${ended.id}`);

    expect(await screen.findByRole('heading', { name: 'Basics' })).toBeInTheDocument();
    expect(screen.getByLabelText('Plan name')).toHaveValue('Autumn base (copy)');
    expect(screen.getByLabelText('Start date')).toHaveValue('2026-10-19');
  });
});

describe('editing the active plan', () => {
  async function seed() {
    const plan = createDemoPlan('2026-10-19', newId);
    await repository.savePlan(plan);
    const upper = plan.slots.find((s) => s.type === 'upper');
    if (!upper) throw new Error('No upper slot.');
    await repository.saveOverride({
      planId: plan.id,
      slotId: upper.id,
      week: 2,
      done: true,
      values: { kind: 'strength', exercises: [] },
    });
    return plan;
  }

  it('starts at the structure step and keeps the start date', async () => {
    const plan = await seed();
    const user = openWizard(`#/plans/edit/${plan.id}`);

    expect(await screen.findByRole('heading', { name: 'Weekly structure' })).toBeInTheDocument();
    expect(screen.getByText('Edit plan')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Back' }));
    expect(await screen.findByLabelText('Start date')).toBeDisabled();
  });

  it('will not remove a slot that has done workouts', async () => {
    const plan = await seed();
    openWizard(`#/plans/edit/${plan.id}`);
    await screen.findByRole('heading', { name: 'Weekly structure' });

    expect(screen.getByRole('button', { name: 'Remove Upper body' })).toBeDisabled();
    expect(screen.getByText('Has done workouts, so it can’t be removed.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Remove Lower body' })).toBeEnabled();
  });

  it('blocks an end date before the last done workout', async () => {
    const plan = await seed();
    const user = openWizard(`#/plans/edit/${plan.id}`);
    await screen.findByRole('heading', { name: 'Weekly structure' });
    await user.click(screen.getByRole('button', { name: 'Back' }));
    await user.click(await screen.findByRole('switch', { name: 'Open-ended' }));

    setDate('End date', '2026-10-27');
    expect(
      await screen.findByText(/The plan can't end before your last done workout on Thu 29 Oct 2026/),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Next: weekly structure' })).toBeDisabled();

    setDate('End date', '2026-11-29');
    await waitFor(() => expect(screen.getByRole('button', { name: 'Next: weekly structure' })).toBeEnabled());
  });

  it('saves a removed slot together with the removal of its saved edits', async () => {
    const plan = await seed();
    const lower = plan.slots.find((s) => s.type === 'lower');
    if (!lower) throw new Error('No lower slot.');
    await repository.saveOverride({ planId: plan.id, slotId: lower.id, week: 3, date: '2026-11-10' });
    const user = openWizard(`#/plans/edit/${plan.id}`);
    await screen.findByRole('heading', { name: 'Weekly structure' });

    await user.click(screen.getByRole('button', { name: 'Remove Lower body' }));
    await user.click(screen.getByRole('button', { name: 'Next: configure slots' }));
    for (let i = 0; i < 6; i++) await user.click(await screen.findByRole('button', { name: /^Next slot|Review plan/ }));
    await user.click(await screen.findByRole('button', { name: 'Save changes' }));

    await screen.findByText('Plan saved');
    const [saved] = await repository.listPlans();
    expect(saved?.slots.some((s) => s.id === lower.id)).toBe(false);
    const overrides = await repository.listOverrides(plan.id);
    expect(overrides.some((o) => o.slotId === lower.id)).toBe(false);
    expect(overrides).toHaveLength(1);
    expect(within(document.body).queryByRole('heading', { name: 'Review' })).not.toBeInTheDocument();
  }, 20_000);

  it('refuses to edit a plan that has ended', async () => {
    const ended: Plan = { ...createDemoPlan('2026-03-16', newId), endedOn: '2026-06-14' };
    await repository.savePlan(ended);
    openWizard(`#/plans/edit/${ended.id}`);

    expect(await screen.findByRole('heading', { name: 'This plan has ended' })).toBeInTheDocument();
  });
});
