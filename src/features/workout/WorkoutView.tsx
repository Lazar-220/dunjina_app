import { formatDayShort } from '../../domain/dates';
import type { WorkoutValues } from '../../domain/schedule';
import { Banner } from '../../shared/ui/Banner';
import { Icon } from '../../shared/ui/Icon';
import { Sheet, SheetHeader } from '../../shared/ui/Sheet';
import type { CalendarItem } from './calendar-item';
import { fmt, fmtSpeed, totalKm } from './describe';

interface WorkoutViewProps {
  item: CalendarItem;
  /** The same workout one plan week later, or null for one-offs and the last week of a plan. */
  next: WorkoutValues | null;
  onClose: () => void;
  onMarkDone: () => void;
  onEdit: () => void;
  onMove: () => void;
  onDelete: () => void;
  onReset: () => void;
}

const STATUS_LABEL = { draft: 'Draft', confirmed: 'Confirmed', done: 'Done' } as const;

function subtitleOf(item: CalendarItem): string {
  const day = item.date ? formatDayShort(item.date) : 'No day assigned';
  return item.week === null ? `${day} · One-off` : `${day} · Week ${item.week}`;
}

export function WorkoutView({ item, next, onClose, onMarkDone, onEdit, onMove, onDelete, onReset }: WorkoutViewProps) {
  const done = item.status === 'done';
  const resettable = item.ref.kind === 'plan' && item.status !== 'draft';
  return (
    <Sheet label={`${item.title} workout`} type={item.type} onClose={onClose}>
      <SheetHeader
        type={item.type}
        draftBadge={item.status === 'draft'}
        title={item.title}
        subtitle={subtitleOf(item)}
        trailing={
          <span className={item.status === 'done' ? 'st done' : item.status === 'draft' ? 'st draft' : 'st'}>
            {STATUS_LABEL[item.status]}
          </span>
        }
        onClose={onClose}
      />
      <div className="body">
        <WorkoutDetails values={item.actual} next={next} edited={item.edited} />
      </div>
      {!done && (
        <button type="button" className="btn p blk" onClick={onMarkDone}>
          <Icon name="check" size="s" />
          Mark as done
        </button>
      )}
      <div className="three-actions">
        <button type="button" className="act" onClick={onEdit}>
          <Icon name="edit" />
          Edit
        </button>
        <button type="button" className="act" onClick={onMove}>
          <Icon name="move" />
          Move to…
        </button>
        <button type="button" className="act d" onClick={onDelete}>
          <Icon name="trash" />
          Delete
        </button>
      </div>
      {resettable && (
        <button type="button" className="btn s blk" onClick={onReset}>
          Reset to generated values
        </button>
      )}
    </Sheet>
  );
}

function WorkoutDetails({ values, next, edited }: { values: WorkoutValues; next: WorkoutValues | null; edited: boolean }) {
  switch (values.kind) {
    case 'strength': {
      const nextExercises = next?.kind === 'strength' ? next.exercises : [];
      return (
        <>
          {values.exercises.map((exercise) => {
            const following = nextExercises.find((e) => e.exerciseId === exercise.exerciseId);
            const resets = following !== undefined && following.reps < exercise.reps;
            return (
              <div className="ex" key={exercise.exerciseId}>
                <span className="b">{exercise.name}</span>
                <div className="r g12" style={{ alignItems: 'flex-end' }}>
                  <span className="val mono">
                    {exercise.sets} × {exercise.reps}
                  </span>
                  <span className="val mono">
                    {fmt(exercise.kg)}
                    <small>kg</small>
                  </span>
                  {following && (
                    <span className="nx">
                      <span>Next week</span>
                      <span className="mono b" style={{ color: 'var(--ink)' }}>
                        {following.reps} @ {fmt(following.kg)}
                      </span>
                    </span>
                  )}
                </div>
                {exercise.note && <span className="sm muted">{exercise.note}</span>}
                {resets && following && (
                  <Banner tone="info">
                    Max reps. Next week resets to {following.reps} reps
                    {following.kg > exercise.kg ? ` and adds ${fmt(following.kg - exercise.kg)} kg` : ''}.
                  </Banner>
                )}
              </div>
            );
          })}
          {edited && <span className="xs muted">Edited: values differ from the generated plan.</span>}
        </>
      );
    }
    case 'run':
      return (
        <div className="ex">
          <div className="r g12" style={{ alignItems: 'flex-end' }}>
            <span className="val mono">
              {fmt(values.km)}
              <small>km</small>
            </span>
            {next?.kind === 'run' && <NextWeek text={`${fmt(next.km)} km`} />}
          </div>
        </div>
      );
    case 'tempo':
      return (
        <div className="ex">
          <div className="r g12" style={{ alignItems: 'flex-end' }}>
            <span className="val mono">
              {fmt(values.km)}
              <small>km tempo</small>
            </span>
            {next?.kind === 'tempo' && <NextWeek text={`${fmt(next.km)} km`} />}
          </div>
          <span className="sm muted">
            {fmt(values.warmupKm)} km warm-up · {fmt(values.cooldownKm)} km cool-down · {fmt(totalKm(values))} km total
          </span>
        </div>
      );
    case 'intervals':
      return (
        <div className="ex">
          {values.draftCount > 1 && (
            <span className="b">
              Draft {values.draft} of {values.draftCount}
            </span>
          )}
          <div className="r g12" style={{ alignItems: 'flex-end' }}>
            <span className="val mono">
              {values.count} × {fmt(values.distanceM)}
              <small>m</small>
            </span>
            <span className="val mono">
              {fmtSpeed(values.speedKmh)}
              <small>km/h</small>
            </span>
            {next?.kind === 'intervals' && (
              <NextWeek text={`D${next.draft} · ${next.count} × ${fmt(next.distanceM)} m @ ${fmtSpeed(next.speedKmh)}`} />
            )}
          </div>
          <span className="sm muted">
            Rest {fmt(values.restS)} s · {fmt(values.warmupKm)} km warm-up · {fmt(values.cooldownKm)} km cool-down
          </span>
        </div>
      );
  }
}

function NextWeek({ text }: { text: string }) {
  return (
    <span className="nx">
      <span>Next week</span>
      <span className="mono b" style={{ color: 'var(--ink)' }}>
        {text}
      </span>
    </span>
  );
}
