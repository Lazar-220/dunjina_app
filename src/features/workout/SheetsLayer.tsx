import type { IsoDate } from '../../domain/dates';
import type { OneOff } from '../../domain/schema';
import type { ReadyPlanData } from '../plan-data/PlanDataProvider';
import { AddWorkoutSheet } from './AddWorkoutSheet';
import type { ItemRef } from './calendar-item';
import { itemsBetween, titlesOnDate } from './item-queries';
import { useWorkoutActions } from './useWorkoutActions';
import { WorkoutSheetHost, type SheetMode } from './WorkoutSheetHost';

/** Which sheet is open: a workout (in a given mode) or the "add workout" sheet for a date. */
export type OpenSheet = { itemRef: ItemRef; mode: SheetMode } | { adding: IsoDate } | null;

interface SheetsLayerProps {
  data: ReadyPlanData;
  open: OpenSheet;
  onChange: (open: OpenSheet) => void;
  /** Called after a one-off workout was added, before its sheet opens. */
  onAdded?: (oneOff: OneOff) => void;
}

/** Renders the workout sheets for any screen that lists workouts. */
export function SheetsLayer({ data, open, onChange, onAdded }: SheetsLayerProps) {
  const actions = useWorkoutActions(data);
  if (!open) return null;
  const close = () => onChange(null);

  if ('itemRef' in open) {
    return <WorkoutSheetHost data={data} itemRef={open.itemRef} initialMode={open.mode} onClose={close} />;
  }

  const titlesOn = (date: IsoDate, excludeKey?: string) =>
    titlesOnDate(itemsBetween({ plans: data.plans, oneOffs: data.oneOffs, index: data.index }, date, date), date, excludeKey);

  return (
    <AddWorkoutSheet
      initialDate={open.adding}
      titlesOn={titlesOn}
      onCancel={close}
      onAdd={async (type, date) => {
        const oneOff = await actions.addOneOff(type, date);
        onAdded?.(oneOff);
        onChange({ itemRef: { kind: 'oneOff', id: oneOff.id }, mode: 'view' });
      }}
    />
  );
}
