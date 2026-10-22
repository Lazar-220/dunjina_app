import { useCallback, useMemo } from 'react';
import { formatDayShort, type IsoDate } from '../../domain/dates';
import type { OneOff, Override, SlotType } from '../../domain/schema';
import { overrideFor, type WorkoutValues } from '../../domain/schedule';
import { newId } from '../../shared/ids';
import { useToast } from '../../shared/ui/Toast';
import { usePlanData, type ReadyPlanData } from '../plan-data/PlanDataProvider';
import { valuesToOneOffDetails, type CalendarItem } from './calendar-item';
import { buildOverride } from './edit-model';
import { defaultOneOffDetails } from './one-off-defaults';

type PlanRef = Extract<CalendarItem['ref'], { kind: 'plan' }>;

/** Writes workout changes and offers "Undo" for each of them. */
export function useWorkoutActions(data: ReadyPlanData) {
  const planData = usePlanData();
  const toast = useToast();
  const { saveOverride, removeOverride, saveOneOff, removeOneOff } = planData;

  const replaceOverride = useCallback(
    async (ref: PlanRef, next: Override | null, message: string) => {
      const previous = overrideFor(data.index, ref.slotId, ref.week);
      if (next) await saveOverride(next);
      else await removeOverride(ref);
      toast.show({
        message,
        action: {
          label: 'Undo',
          run: () => void (previous ? saveOverride(previous) : removeOverride(ref)),
        },
      });
    },
    [data.index, removeOverride, saveOverride, toast],
  );

  const replaceOneOff = useCallback(
    async (previous: OneOff, next: OneOff | null, message: string) => {
      if (next) await saveOneOff(next);
      else await removeOneOff(previous.id);
      toast.show({ message, action: { label: 'Undo', run: () => void saveOneOff(previous) } });
    },
    [removeOneOff, saveOneOff, toast],
  );

  const oneOffOf = useCallback(
    (item: CalendarItem): OneOff => {
      if (item.ref.kind !== 'oneOff') throw new Error('Expected a one-off workout.');
      const { id } = item.ref;
      const oneOff = data.oneOffs.find((o) => o.id === id);
      if (!oneOff) throw new Error('This one-off workout no longer exists.');
      return oneOff;
    },
    [data.oneOffs],
  );

  return useMemo(
    () => ({
      /** Saves the form: a full snapshot when done, differences from the plan otherwise. */
      async saveForm(item: CalendarItem, form: WorkoutValues, done: boolean) {
        if (item.ref.kind === 'oneOff') {
          const oneOff = oneOffOf(item);
          await replaceOneOff(
            oneOff,
            { ...oneOff, done, details: valuesToOneOffDetails(form) },
            done && !oneOff.done ? `${item.title} marked done` : 'Changes saved',
          );
          return;
        }
        const { ref } = item;
        if (!item.planned) return;
        const next = buildOverride({
          existing: overrideFor(data.index, ref.slotId, ref.week),
          planId: ref.planId,
          slotId: ref.slotId,
          week: ref.week,
          planned: item.planned,
          form,
          done,
        });
        await replaceOverride(ref, next, done && item.status !== 'done' ? `${item.title} marked done` : 'Changes saved');
      },

      /** Stores an override built elsewhere (null removes it), e.g. by the inline editor of the Weeks list. */
      async applyOverride(item: CalendarItem, next: Override | null) {
        if (item.ref.kind !== 'plan') return;
        await replaceOverride(item.ref, next, 'Changes saved');
      },

      async reset(item: CalendarItem) {
        if (item.ref.kind !== 'plan') return;
        await replaceOverride(item.ref, null, 'Reset to generated values');
      },

      async move(item: CalendarItem, date: IsoDate) {
        const message = `Moved to ${formatDayShort(date)}`;
        if (item.ref.kind === 'oneOff') {
          const oneOff = oneOffOf(item);
          await replaceOneOff(oneOff, { ...oneOff, date }, message);
          return;
        }
        const { ref } = item;
        const existing = overrideFor(data.index, ref.slotId, ref.week) ?? {
          planId: ref.planId,
          slotId: ref.slotId,
          week: ref.week,
        };
        await replaceOverride(ref, { ...existing, date }, message);
      },

      async remove(item: CalendarItem) {
        const message = `${item.title} deleted`;
        if (item.ref.kind === 'oneOff') {
          await replaceOneOff(oneOffOf(item), null, message);
          return;
        }
        const { ref } = item;
        const existing = overrideFor(data.index, ref.slotId, ref.week) ?? {
          planId: ref.planId,
          slotId: ref.slotId,
          week: ref.week,
        };
        await replaceOverride(ref, { ...existing, deleted: true }, message);
      },

      async addOneOff(type: SlotType, date: IsoDate): Promise<OneOff> {
        const oneOff: OneOff = { id: newId(), date, type, done: false, details: defaultOneOffDetails(type) };
        await saveOneOff(oneOff);
        return oneOff;
      },
    }),
    [data.index, oneOffOf, replaceOneOff, replaceOverride, saveOneOff],
  );
}
