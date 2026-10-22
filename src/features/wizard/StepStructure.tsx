import type { Weekday } from '../../domain/dates';
import type { Slot, SlotType } from '../../domain/schema';
import { Icon } from '../../shared/ui/Icon';
import { TypeBadge } from '../../shared/ui/TypeBadge';
import { SLOT_TYPES, TYPE_META } from '../../shared/workout-types';
import { slotNames, weeklyCounts } from './wizard-model';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

interface StepStructureProps {
  slots: readonly Slot[];
  onAdd: (type: SlotType) => void;
  onRemove: (slot: Slot) => void;
  onWeekday: (slot: Slot, weekday: Weekday | null) => void;
  /** Why a slot cannot be removed (it has logged workouts), or null. */
  removalBlockedReason: (slot: Slot) => string | null;
}

function weekSummary(slots: readonly Slot[]): string {
  const parts = WEEKDAYS.map((day, i) => {
    const names = slots.filter((s) => s.defaultWeekday === i).map((s) => TYPE_META[s.type].name.toLowerCase());
    return `${day} ${names.length > 0 ? names.join(' and ') : 'free'}`;
  });
  return `Week preview: ${parts.join(', ')}`;
}

export function StepStructure({ slots, onAdd, onRemove, onWeekday, removalBlockedReason }: StepStructureProps) {
  const names = slotNames(slots);
  const { strength, running } = weeklyCounts(slots);

  return (
    <>
      <div className="col g4">
        <h1 className="title">Weekly structure</h1>
        <p className="muted" style={{ textWrap: 'pretty' }}>
          The workouts you do every week. A default weekday is optional; you can move any workout later.
        </p>
      </div>
      <div className="wkm" role="img" aria-label={weekSummary(slots)}>
        {WEEKDAYS.map((day, i) => {
          const here = slots.filter((s) => s.defaultWeekday === i);
          return (
            <span key={day} className={here.length === 0 ? 'free' : undefined}>
              {day.charAt(0)}
              {here.map((slot) => (
                <i
                  key={slot.id}
                  className={`dot ${TYPE_META[slot.type].colorClass} ${TYPE_META[slot.type].shape === 'square' ? 'sq' : ''}`}
                />
              ))}
            </span>
          );
        })}
      </div>
      <div className="sec">Add a slot</div>
      <div className="r g8" style={{ overflow: 'auto', margin: '0 -16px', padding: '2px 16px' }}>
        {SLOT_TYPES.map((type) => (
          <button
            key={type}
            type="button"
            className={`chip ${TYPE_META[type].colorClass}`}
            onClick={() => onAdd(type)}
          >
            <span className={`dot ${TYPE_META[type].shape === 'square' ? 'sq' : ''}`} />
            {TYPE_META[type].name}
          </button>
        ))}
      </div>
      <div className="r rb">
        <div className="sec" style={{ padding: 0 }}>
          {slots.length} {slots.length === 1 ? 'workout' : 'workouts'} per week
        </div>
        <span className="sm muted">
          {strength} strength · {running} running
        </span>
      </div>
      {slots.length === 0 && (
        <div className="empty-slot" style={{ justifyContent: 'center' }}>
          Add a workout above to start your week.
        </div>
      )}
      <div className="col g8">
        {slots.map((slot) => {
          const name = names.get(slot.id) ?? TYPE_META[slot.type].name;
          const blocked = removalBlockedReason(slot);
          return (
            <div key={slot.id} className={`wk ${TYPE_META[slot.type].colorClass}`}>
              <TypeBadge type={slot.type} small />
              <span className="grow col">
                <span className="nm">{name}</span>
                {blocked && <span className="xs muted">{blocked}</span>}
              </span>
              <select
                className="wd2"
                aria-label={`Weekday for ${name}`}
                value={slot.defaultWeekday === null ? '' : String(slot.defaultWeekday)}
                onChange={(event) => {
                  const value = event.target.value;
                  onWeekday(slot, value === '' ? null : (Number(value) as Weekday));
                }}
              >
                {WEEKDAYS.map((day, i) => (
                  <option key={day} value={i}>
                    {day}
                  </option>
                ))}
                <option value="">No day</option>
              </select>
              <button
                type="button"
                className="ib"
                aria-label={`Remove ${name}`}
                disabled={blocked !== null}
                onClick={() => onRemove(slot)}
              >
                <Icon name="close" size="s" />
              </button>
            </div>
          );
        })}
      </div>
    </>
  );
}
