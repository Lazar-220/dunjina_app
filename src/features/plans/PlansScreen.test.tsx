import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Dexie from 'dexie';
import { App } from '../../app/App';
import { createDexieRepository } from '../../data/dexie-repository';
import type { Repository } from '../../data/repository';
import { createDemoPlan } from '../../domain/demo-plan';
import type { Plan } from '../../domain/schema';

let counter = 0;
const newId = () => `plans-test-${++counter}`;
let databaseName = '';
let repository: Repository;
let plan: Plan;

const TODAY = new Date(2026, 9, 22, 12, 0, 0);

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(TODAY);
  databaseName = `plans-test-db-${newId()}`;
  repository = createDexieRepository(databaseName);
  plan = createDemoPlan('2026-10-19', newId);
  await repository.savePlan(plan);
  window.location.hash = '#/plans';
});

afterEach(async () => {
  vi.useRealTimers();
  await Dexie.delete(databaseName);
});

async function openPlans() {
  const user = userEvent.setup({ advanceTimers: () => undefined });
  render(<App repository={repository} />);
  await screen.findByRole('heading', { name: 'Plans' });
  return user;
}

describe('plans list', () => {
  it('shows the active plan first with its details and an ended plan to duplicate', async () => {
    const ended: Plan = { ...createDemoPlan('2026-03-16', newId), name: 'Spring 10K', endedOn: '2026-06-14' };
    await repository.savePlan(ended);
    await openPlans();

    expect(screen.getByText('2 plans')).toBeInTheDocument();
    const [first, second] = screen.getAllByRole('heading', { level: 2 });
    expect(first).toHaveTextContent('Autumn base');
    expect(second).toHaveTextContent('Spring 10K');
    expect(screen.getByText('Open-ended · since Mon 19 Oct 2026')).toBeInTheDocument();
    expect(screen.getByText('Now in week 1 · 7 workouts a week')).toBeInTheDocument();
    expect(screen.getAllByRole('img', { name: 'Weekly mix: 2 strength, 5 running' })).toHaveLength(2);
    expect(screen.getByRole('link', { name: 'Edit plan' })).toHaveAttribute('href', `#/plans/edit/${plan.id}`);
    expect(screen.getByRole('link', { name: 'Duplicate as new plan' })).toHaveAttribute('href', `#/plans/new?from=${ended.id}`);
    expect(screen.getByText('0 workouts completed')).toBeInTheDocument();
  });

  it('invites the user to create a plan when there are none', async () => {
    const empty = createDexieRepository(`${databaseName}-empty`);
    render(<App repository={empty} />);

    expect(await screen.findByText('No plans yet')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'New plan' })).toHaveAttribute('href', '#/plans/new');
    await Dexie.delete(`${databaseName}-empty`);
  });
});

describe('ending a plan', () => {
  it('explains what is kept and removed, ends the plan today, and can be undone', async () => {
    const user = await openPlans();
    await user.click(screen.getByRole('button', { name: 'End Autumn base' }));

    const sheet = await screen.findByRole('dialog', { name: 'End plan: Autumn base' });
    expect(within(sheet).getByText(/Kept:/).closest('span')).toHaveTextContent('every completed workout and your edited values stay');
    expect(within(sheet).getByText(/Removed:/).closest('span')).toHaveTextContent(
      'all drafts after Thu 22 Oct, including 2 still open this week.',
    );
    expect(within(sheet).getByText(/can’t be restarted/)).toBeInTheDocument();

    await user.click(within(sheet).getByRole('button', { name: 'End plan' }));

    expect(await screen.findByText('“Autumn base” ended')).toBeInTheDocument();
    expect((await repository.listPlans())[0]?.endedOn).toBe('2026-10-22');
    expect(screen.getByText('Ended')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Edit plan' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Undo' }));
    await waitFor(async () => expect((await repository.listPlans())[0]?.endedOn).toBeNull());
  });

  it('keeps done workouts: the plan cannot end before the last one, a later date works', async () => {
    const upper = plan.slots.find((s) => s.type === 'upper');
    if (!upper) throw new Error('No upper slot.');
    await repository.saveOverride({
      planId: plan.id,
      slotId: upper.id,
      week: 2,
      done: true,
      values: { kind: 'strength', exercises: [] },
    });
    const user = await openPlans();
    await user.click(screen.getByRole('button', { name: 'End Autumn base' }));
    const sheet = await screen.findByRole('dialog', { name: 'End plan: Autumn base' });

    expect(within(sheet).getByRole('alert')).toHaveTextContent(
      "The plan can't end before your last done workout on Thu 29 Oct 2026",
    );
    expect(within(sheet).getByRole('button', { name: 'End plan' })).toBeDisabled();

    await user.click(within(sheet).getByRole('button', { name: 'Pick a date' }));
    fireEvent.change(within(sheet).getByLabelText('Last day of the plan'), { target: { value: '2026-10-29' } });
    await waitFor(() => expect(within(sheet).getByRole('button', { name: 'End plan' })).toBeEnabled());
    await user.click(within(sheet).getByRole('button', { name: 'End plan' }));

    await screen.findByText('“Autumn base” ended');
    expect((await repository.listPlans())[0]?.endedOn).toBe('2026-10-29');
    const upperOverrides = await repository.listOverrides(plan.id);
    expect(upperOverrides).toHaveLength(1);
  });

  it('keeps the plan when the user chooses Keep plan', async () => {
    const user = await openPlans();
    await user.click(screen.getByRole('button', { name: 'End Autumn base' }));
    await user.click(await screen.findByRole('button', { name: 'Keep plan' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect((await repository.listPlans())[0]?.endedOn).toBeNull();
  });
});
