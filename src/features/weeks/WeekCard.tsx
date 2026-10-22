import { generatedDate, type Workout } from '../../domain/schedule';
import { weekdayOf } from '../../domain/dates';
import type { Override, Plan, Slot } from '../../domain/schema';
import { Icon } from '../../shared/ui/Icon';
import { TypeBadge } from '../../shared/ui/TypeBadge';
import { TYPE_META } from '../../shared/workout-types';
import { planItem } from '../workout/calendar-item';
import { describeValues } from '../workout/describe';
import { distanceOf } from '../workout/edit-model';
import type { ReadyPlanData } from '../plan-data/PlanDataProvider';
import { useWorkoutActions } from '../workout/useWorkoutActions';
import type { OpenSheet } from '../workout/SheetsLayer';
import { InlineRunEditor } from './InlineRunEditor';
import { MiniTrend } from './MiniTrend';
import { followNote, progressionTag, rangeLabel, trendLabel, trendOf, type WeekSummary } from './weeks-model';

const WEEKDAY_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

interface WeekCardProps {
  plan: Plan;
  data: ReadyPlanData;
  summary: WeekSummary;
  isCurrent: boolean;
  open: boolean;
  onToggle: () => void;
  editingId: string | null;
  onEditing: (id: string | null) => void;
  onOpenSheet: (sheet: OpenSheet) => void;
  onResetWeek: () => void;
}

export function WeekCard({ plan, data, summary, isCurrent, open, onToggle, editingId, onEditing, onOpenSheet, onResetWeek }: WeekCardProps) {
  const actions = useWorkoutActions(data);
  const { week } = summary;

  return (
    <section className="card" style={{ padding: 0, overflow: 'hidden' }}>
      <button
        type="button"
        className="whead"
        aria-expanded={open}
        aria-label={`Week ${week}${isCurrent ? ', this week' : ''}, ${rangeLabel(summary.start, summary.end)}, ${summary.statusLine}, about ${Math.round(summary.runningKm)} km running`}
        onClick={onToggle}
      >
        <span className="grow col g4">
          <span className="r g8">
            <b style={{ fontSize: 17 }}>Week {week}</b>
            {isCurrent && <span className="st">This week</span>}
          </span>
          <span className="sm muted">
            {rangeLabel(summary.start, summary.end)} · {summary.statusLine}
          </span>
        </span>
        <span className="col" style={{ alignItems: 'flex-end' }}>
          <span className="b">≈ {Math.round(summary.runningKm)} km</span>
          <span className="xs muted">running</span>
        </span>
        <Icon name={open ? 'up' : 'down'} size="s" />
      </button>
      {open && (
        <div className="wbody">
          {summary.done.length > 0 && (
            <div className="r g6" style={{ flexWrap: 'wrap', padding: '10px 0 6px' }}>
              <span className="xs muted b">Done</span>
              {summary.done.map((workout) => {
                const item = planItem(plan, workout);
                return (
                  <button
                    key={workout.id}
                    type="button"
                    className={`tag ${TYPE_META[workout.type].colorClass}`}
                    style={{ minHeight: 44 }}
                    onClick={() => onOpenSheet({ itemRef: item.ref, mode: 'view' })}
                  >
                    <Icon name="check" size="xs" />
                    {item.title}
                    {workout.edited && (
                      <span className="mod" style={{ height: 18 }}>
                        edited
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
          {summary.open.map((workout) => {
            const slot = plan.slots.find((s) => s.id === workout.slotId);
            if (!slot) return null;
            return (
              <WeekRow
                key={workout.id}
                plan={plan}
                slot={slot}
                workout={workout}
                data={data}
                editing={editingId === workout.id}
                onToggleEdit={() => onEditing(editingId === workout.id ? null : workout.id)}
                onOpenSheet={onOpenSheet}
                onSaveOverride={(override) => actions.applyOverride(planItem(plan, workout), override)}
                onReset={() => actions.reset(planItem(plan, workout))}
              />
            );
          })}
          {summary.resettable.length > 0 && (
            <button type="button" className="btn s blk" style={{ marginTop: 6, minHeight: 46 }} onClick={onResetWeek}>
              <Icon name="undo" size="s" />
              Reset week to generated values
            </button>
          )}
        </div>
      )}
    </section>
  );
}

interface WeekRowProps {
  plan: Plan;
  slot: Slot;
  workout: Workout;
  data: ReadyPlanData;
  editing: boolean;
  onToggleEdit: () => void;
  onOpenSheet: (sheet: OpenSheet) => void;
  onSaveOverride: (override: Override | null) => Promise<void>;
  onReset: () => Promise<void>;
}

function WeekRow({ plan, slot, workout, data, editing, onToggleEdit, onOpenSheet, onSaveOverride, onReset }: WeekRowProps) {
  const item = planItem(plan, workout);
  const meta = TYPE_META[workout.type];
  const tag = progressionTag(plan, slot, workout, data.index);
  const note = followNote(plan, slot, workout, data.overrides) ?? slot.note ?? null;
  const planned = describeValues(workout.planned);
  const showWas = workout.edited && planned !== describeValues(workout.actual);
  const isRun = distanceOf(workout.actual) !== null;
  const day = workout.date === null ? 'No day' : (WEEKDAY_SHORT[weekdayOf(workout.date)] ?? '');

  return (
    <div className={`wrow ${meta.colorClass}`}>
      <div className="r" style={{ gap: 8 }}>
        <button type="button" className="wlink" onClick={() => onOpenSheet({ itemRef: item.ref, mode: 'view' })}>
          <TypeBadge type={workout.type} small draft />
          <span className="grow col" style={{ minWidth: 0, gap: 1 }}>
            <span className="r g6" style={{ flexWrap: 'wrap' }}>
              <span className="nm" style={{ fontSize: 15, fontWeight: 650 }}>
                {item.title}
              </span>
              {workout.edited && <span className="mod">edited</span>}
              {tag && <span className="st">{tag}</span>}
            </span>
            <span className="ds" style={{ fontSize: 13, color: 'var(--ink2)' }}>
              {describeValues(workout.actual)}
              {showWas && <> <span className="was">{planned}</span></>}
            </span>
            {note && <span className="xs muted">{note}</span>}
          </span>
        </button>
        <MiniTrend trend={trendOf(plan, slot, workout.week, data.index)} label={trendLabel(slot)} />
        <button
          type="button"
          className="wdb"
          aria-label={`Weekday ${day}, change`}
          onClick={() => onOpenSheet({ itemRef: item.ref, mode: 'move' })}
        >
          {day}
        </button>
        {isRun ? (
          <button
            type="button"
            className="ib o"
            aria-label={`Edit ${item.title} inline`}
            aria-expanded={editing}
            onClick={onToggleEdit}
          >
            <Icon name="edit" size="s" />
          </button>
        ) : (
          <button
            type="button"
            className="ib o"
            aria-label={`Open ${item.title}`}
            onClick={() => onOpenSheet({ itemRef: item.ref, mode: 'edit' })}
          >
            <Icon name="edit" size="s" />
          </button>
        )}
      </div>
      {editing && isRun && (
        <InlineRunEditor
          plan={plan}
          slot={slot}
          workout={workout}
          generatedDate={generatedDate(plan, slot, workout.week)}
          index={data.index}
          existing={data.index.get(slot.id)?.get(workout.week)}
          onSave={onSaveOverride}
          onReset={onReset}
          onClose={onToggleEdit}
        />
      )}
    </div>
  );
}

