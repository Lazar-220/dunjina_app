import { useState } from 'react';
import { formatDayShort, weekStartDate, type IsoDate } from '../../domain/dates';
import { computeSlotWeek } from '../../domain/schedule';
import { todayIso } from '../../shared/today';
import { Dialog } from '../../shared/ui/Dialog';
import type { ReadyPlanData } from '../plan-data/PlanDataProvider';
import { resolveItem, type CalendarItem, type ItemRef } from './calendar-item';
import { itemsBetween, titlesOnDate } from './item-queries';
import { MarkDoneSheet } from './MarkDoneSheet';
import { MoveSheet } from './MoveSheet';
import { useWorkoutActions } from './useWorkoutActions';
import { WorkoutView } from './WorkoutView';

export type SheetMode = 'view' | 'done' | 'edit' | 'move' | 'delete';

interface WorkoutSheetHostProps {
  data: ReadyPlanData;
  itemRef: ItemRef;
  /** 'move' opens straight on the Move sheet (the "⋯" action of a row). */
  initialMode?: SheetMode;
  onClose: () => void;
}

/** The workout sheet and the flows it leads to (mark done, edit, move, delete). */
export function WorkoutSheetHost({ data, itemRef, initialMode = 'view', onClose }: WorkoutSheetHostProps) {
  const [mode, setMode] = useState<SheetMode>(initialMode);
  const actions = useWorkoutActions(data);
  const item = resolveItem({ plans: data.plans, oneOffs: data.oneOffs, index: data.index }, itemRef);

  if (!item) return null;

  const toView = () => (initialMode === 'view' ? setMode('view') : onClose());
  const finish = async (action: () => Promise<void>) => {
    await action();
    onClose();
  };

  if (mode === 'done' || mode === 'edit') {
    return (
      <MarkDoneSheet
        item={item}
        source={planSource(data, item)}
        mode={mode}
        onCancel={toView}
        onSave={async (form, done) => {
          await actions.saveForm(item, form, done);
          onClose();
        }}
      />
    );
  }

  if (mode === 'move') {
    return (
      <MoveSheet
        item={item}
        today={todayIso()}
        weekStart={weekStartOf(data, item)}
        titlesOn={(date, excludeKey) =>
          titlesOnDate(itemsBetween({ plans: data.plans, oneOffs: data.oneOffs, index: data.index }, date, date), date, excludeKey)
        }
        onCancel={toView}
        onMove={async (date) => {
          await actions.move(item, date);
          onClose();
        }}
      />
    );
  }

  return (
    <>
      <WorkoutView
        item={item}
        next={nextWeekValues(data, item)}
        onClose={onClose}
        onMarkDone={() => setMode('done')}
        onEdit={() => setMode('edit')}
        onMove={() => setMode('move')}
        onDelete={() => setMode('delete')}
        onReset={() => void finish(() => actions.reset(item))}
      />
      {mode === 'delete' && (
        <Dialog
          title={`Delete ${item.title}${item.date ? ` on ${formatDayShort(item.date)}` : ''}?`}
          onClose={toView}
        >
          <p className="muted" style={{ textWrap: 'pretty' }}>
            Only this workout is removed. Later weeks keep their values.
          </p>
          <div className="col g8">
            <button type="button" className="btn d blk" onClick={() => void finish(() => actions.remove(item))}>
              Delete workout
            </button>
            <button type="button" className="btn s blk" onClick={toView}>
              Keep
            </button>
          </div>
        </Dialog>
      )}
    </>
  );
}

function planSource(data: ReadyPlanData, item: CalendarItem) {
  if (item.ref.kind !== 'plan') return null;
  const { planId, slotId } = item.ref;
  const plan = data.plans.find((p) => p.id === planId);
  const slot = plan?.slots.find((s) => s.id === slotId);
  return plan && slot ? { plan, slot, index: data.index } : null;
}

function nextWeekValues(data: ReadyPlanData, item: CalendarItem) {
  const source = planSource(data, item);
  if (!source || item.week === null) return null;
  return computeSlotWeek(source.plan, source.slot, item.week + 1, source.index)?.actual ?? null;
}

function weekStartOf(data: ReadyPlanData, item: CalendarItem): IsoDate {
  const source = planSource(data, item);
  return source && item.week !== null ? weekStartDate(source.plan.startDate, item.week) : (item.date ?? todayIso());
}
