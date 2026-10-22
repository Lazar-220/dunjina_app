import { useMemo, useState } from 'react';
import { addDays, formatDayShort, weekStartDate, type IsoDate } from '../../domain/dates';
import { previewImpact } from '../../domain/impact';
import type { Override, Plan, Slot } from '../../domain/schema';
import type { OverrideIndex, Workout } from '../../domain/schedule';
import { Icon } from '../../shared/ui/Icon';
import { Stepper } from '../../shared/ui/Stepper';
import { fmt } from '../workout/describe';
import { buildOverride, distanceOf, withDistance, withMovedDate } from '../workout/edit-model';
import { impactGroups } from '../workout/impact-view';

const WEEKDAY_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

interface InlineRunEditorProps {
  plan: Plan;
  slot: Slot;
  /** A run or tempo workout. */
  workout: Workout;
  /** The generated date of this week's workout (before any move), or null when it has no day. */
  generatedDate: IsoDate | null;
  index: OverrideIndex;
  existing: Override | undefined;
  onSave: (next: Override | null) => Promise<void>;
  onReset: () => Promise<void>;
  onClose: () => void;
}

/** Quick edit of a run's distance and day, with the effect on the following weeks shown before saving. */
export function InlineRunEditor({
  plan,
  slot,
  workout,
  generatedDate,
  index,
  existing,
  onSave,
  onReset,
  onClose,
}: InlineRunEditorProps) {
  const planId = plan.id;
  const slotId = slot.id;
  const week = workout.week;
  const plannedKm = distanceOf(workout.planned) ?? 0;
  const [km, setKm] = useState(distanceOf(workout.actual) ?? 0);
  const [date, setDate] = useState<IsoDate | null>(workout.date);
  const weekStart = weekStartDate(plan.startDate, week);

  const candidate = useMemo(() => {
    const key = { planId, slotId, week };
    const edited = buildOverride({ existing, ...key, planned: workout.planned, form: withDistance(workout.actual, km), done: false });
    return date === null ? edited : withMovedDate(edited, key, date, generatedDate);
  }, [planId, slotId, week, existing, workout.planned, workout.actual, km, date, generatedDate]);

  const group = useMemo(
    () => impactGroups(previewImpact(plan, slot, candidate ?? { planId, slotId, week }, index))[0],
    [candidate, plan, slot, planId, slotId, week, index],
  );

  return (
    <div className="edp">
      <Stepper
        label="Distance"
        hideLabel
        value={km}
        unit="km"
        step={1}
        modified={km !== plannedKm}
        decreaseLabel="One km less"
        increaseLabel="One km more"
        onChange={setKm}
      />
      <div className="col g6">
        <span className="lbl">Weekday</span>
        <div className="dgrid">
          {WEEKDAY_SHORT.map((name, i) => {
            const day = addDays(weekStart, i);
            return (
              <button
                key={name}
                type="button"
                className={day === date ? 'on' : undefined}
                aria-pressed={day === date}
                aria-label={formatDayShort(day)}
                onClick={() => setDate(day)}
              >
                {name}
              </button>
            );
          })}
        </div>
      </div>
      {group && (
        <div className="col g6">
          <span className="lbl">Later weeks recalculate from this value</span>
          <div className="imp">
            {group.cells.map((cell) => (
              <div key={cell.header}>
                <small>{cell.header}</small>
                <span className="mono">
                  <span className="was">{cell.was}</span> → <b>{cell.now}</b>
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
      <div className="r g8">
        <button type="button" className="btn s grow" style={{ minHeight: 46, padding: '0 10px' }} onClick={() => void onReset()}>
          <Icon name="undo" size="s" />
          Reset to {fmt(plannedKm)} km
        </button>
        <button
          type="button"
          className="btn p"
          style={{ minHeight: 46 }}
          onClick={() => {
            void onSave(candidate).then(onClose);
          }}
        >
          Done
        </button>
      </div>
    </div>
  );
}
