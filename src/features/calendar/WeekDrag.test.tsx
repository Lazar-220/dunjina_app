import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Dexie from 'dexie';
import { App } from '../../app/App';
import { createDexieRepository } from '../../data/dexie-repository';
import type { Repository } from '../../data/repository';
import { createDemoPlan } from '../../domain/demo-plan';
import type { Plan } from '../../domain/schema';
import { LONG_PRESS_MS } from './useDragToDay';

let counter = 0;
const newId = () => `drag-test-${++counter}`;
let databaseName = '';
let repository: Repository;
let plan: Plan;
const originalElementFromPoint = document.elementFromPoint;

/** Thursday of plan week 1. */
const TODAY = new Date(2026, 9, 22, 12, 0, 0);

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(TODAY);
  databaseName = `drag-test-db-${newId()}`;
  repository = createDexieRepository(databaseName);
  plan = createDemoPlan('2026-10-19', newId);
  await repository.savePlan(plan);
  window.location.hash = '#/';
});

afterEach(async () => {
  vi.useRealTimers();
  document.elementFromPoint = originalElementFromPoint;
  await Dexie.delete(databaseName);
});

async function openWeekView() {
  const user = userEvent.setup({ advanceTimers: () => undefined });
  render(<App repository={repository} />);
  await screen.findByRole('heading', { name: 'October 2026' });
  await user.click(screen.getByRole('button', { name: 'Week' }));
  await screen.findByRole('heading', { name: 'Week of Mon 19 Oct' });
  return user;
}

/** jsdom has no layout, so the day under the pointer is decided by a stub keyed on the pointer's x position. */
function dayUnderPointer(dayByX: Record<number, string>) {
  document.elementFromPoint = (x: number) => {
    const date = dayByX[Math.round(x)];
    return date ? document.querySelector(`[data-date="${date}"]`) : null;
  };
}

const rowButton = (name: RegExp) => screen.getByRole('button', { name });
const wait = (ms: number) => act(() => new Promise<void>((resolve) => setTimeout(resolve, ms)));

describe('dragging in the week view', () => {
  it('lifts a workout after a long press, shows where it will land, and moves it on release', async () => {
    await openWeekView();
    dayUnderPointer({ 100: '2026-10-22', 200: '2026-10-23' });
    const easyB = rowButton(/^Easy run B/);

    fireEvent.pointerDown(easyB, { pointerId: 1, pointerType: 'touch', clientX: 100, clientY: 400 });
    await wait(LONG_PRESS_MS + 50);

    expect(await screen.findByText(/Moving Easy run B/)).toBeInTheDocument();
    fireEvent.pointerMove(window, { pointerId: 1, clientX: 200, clientY: 460 });
    expect(await screen.findByText(/release on Fri 23 Oct/)).toBeInTheDocument();
    expect(screen.getByText('Drop here · Fri 23 Oct')).toBeInTheDocument();

    fireEvent.pointerUp(window, { pointerId: 1, clientX: 200, clientY: 460 });

    expect(await screen.findByText('Moved to Fri 23 Oct')).toBeInTheDocument();
    const [stored] = await repository.listOverrides(plan.id);
    expect(stored).toEqual({ planId: plan.id, slotId: expect.any(String), week: 1, date: '2026-10-23' });
    expect(screen.queryByText(/Moving Easy run B/)).not.toBeInTheDocument();
    expect(await repository.listOverrides(plan.id)).toHaveLength(1);
  });

  it('does not move anything when released on the same day or outside any day', async () => {
    await openWeekView();
    dayUnderPointer({ 100: '2026-10-22' });
    const easyB = rowButton(/^Easy run B/);

    fireEvent.pointerDown(easyB, { pointerId: 1, pointerType: 'touch', clientX: 100, clientY: 400 });
    await wait(LONG_PRESS_MS + 50);
    fireEvent.pointerUp(window, { pointerId: 1, clientX: 100, clientY: 400 });
    await waitFor(() => expect(screen.queryByText(/Moving Easy run B/)).not.toBeInTheDocument());

    fireEvent.pointerDown(easyB, { pointerId: 1, pointerType: 'touch', clientX: 100, clientY: 400 });
    await wait(LONG_PRESS_MS + 50);
    fireEvent.pointerMove(window, { pointerId: 1, clientX: 999, clientY: 400 });
    fireEvent.pointerUp(window, { pointerId: 1, clientX: 999, clientY: 400 });
    await waitFor(() => expect(screen.queryByText(/Moving Easy run B/)).not.toBeInTheDocument());

    expect(await repository.listOverrides(plan.id)).toEqual([]);
  });

  it('cancels with Escape', async () => {
    await openWeekView();
    dayUnderPointer({ 100: '2026-10-22', 200: '2026-10-23' });

    fireEvent.pointerDown(rowButton(/^Easy run B/), { pointerId: 1, pointerType: 'touch', clientX: 100, clientY: 400 });
    await wait(LONG_PRESS_MS + 50);
    fireEvent.pointerMove(window, { pointerId: 1, clientX: 200, clientY: 460 });
    await screen.findByText(/release on Fri 23 Oct/);

    fireEvent.keyDown(window, { key: 'Escape' });
    fireEvent.pointerUp(window, { pointerId: 1, clientX: 200, clientY: 460 });

    await waitFor(() => expect(screen.queryByText(/Moving Easy run B/)).not.toBeInTheDocument());
    expect(await repository.listOverrides(plan.id)).toEqual([]);
  });

  it('treats an early movement as scrolling and never lifts the workout', async () => {
    await openWeekView();
    dayUnderPointer({ 100: '2026-10-22', 200: '2026-10-23' });

    fireEvent.pointerDown(rowButton(/^Easy run B/), { pointerId: 1, pointerType: 'touch', clientX: 100, clientY: 400 });
    fireEvent.pointerMove(window, { pointerId: 1, clientX: 100, clientY: 460 });
    await wait(LONG_PRESS_MS + 50);

    expect(screen.queryByText(/Moving Easy run B/)).not.toBeInTheDocument();
    fireEvent.pointerUp(window, { pointerId: 1, clientX: 100, clientY: 460 });
    expect(await repository.listOverrides(plan.id)).toEqual([]);
  });

  it('still opens the workout on a normal tap', async () => {
    const user = await openWeekView();

    await user.click(rowButton(/^Easy run B/));

    expect(await screen.findByRole('dialog', { name: 'Easy run B workout' })).toBeInTheDocument();
  });

  it('offers the same move without dragging', async () => {
    const user = await openWeekView();

    await user.click(screen.getByRole('button', { name: 'More actions for Easy run B' }));
    const sheet = await screen.findByRole('dialog', { name: 'Move Easy run B' });
    await user.click(within(sheet).getByRole('button', { name: 'Fri 23 Oct' }));
    await user.click(within(sheet).getByRole('button', { name: 'Move to Fri 23 Oct' }));

    expect(await screen.findByText('Moved to Fri 23 Oct')).toBeInTheDocument();
  });
});
