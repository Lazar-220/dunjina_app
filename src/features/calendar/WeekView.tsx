import { addDays, compareDates, formatDayShort, type IsoDate } from '../../domain/dates';
import { Icon } from '../../shared/ui/Icon';
import { TypeBadge } from '../../shared/ui/TypeBadge';
import { WorkoutRow } from '../../shared/ui/WorkoutRow';
import { TYPE_META } from '../../shared/workout-types';
import type { CalendarItem } from '../workout/calendar-item';
import { describeValues } from '../workout/describe';
import { useDragToDay } from './useDragToDay';

const WEEKDAY_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

interface WeekViewProps {
  weekStart: IsoDate;
  today: IsoDate;
  itemsByDate: ReadonlyMap<IsoDate, CalendarItem[]>;
  /** Plan workouts of this week that have no day yet. */
  unassigned: readonly CalendarItem[];
  onOpen: (item: CalendarItem) => void;
  /** "⋯": the non-drag way to move a workout. */
  onMove: (item: CalendarItem) => void;
  /** Called when a workout is dropped on another day. */
  onDrop: (item: CalendarItem, date: IsoDate) => void;
  onAdd: (date: IsoDate) => void;
}

export function WeekView({ weekStart, today, itemsByDate, unassigned, onOpen, onMove, onDrop, onAdd }: WeekViewProps) {
  const { drag, gestureProps } = useDragToDay(onDrop);
  const target = drag?.targetDate ?? null;

  const row = (item: CalendarItem, muted: boolean) => (
    <WorkoutRow
      key={item.key}
      type={item.type}
      title={item.title}
      detail={describeValues(item.actual)}
      status={item.status}
      edited={item.edited}
      muted={muted}
      ghost={drag?.item.key === item.key}
      gestureProps={gestureProps(item)}
      onOpen={() => onOpen(item)}
      menu={{ label: `More actions for ${item.title}`, onClick: () => onMove(item) }}
    />
  );

  return (
    <>
      {drag && (
        <div style={{ padding: '0 16px 6px', flex: 'none' }}>
          <div className="banner info" role="status" style={{ alignItems: 'center', padding: '9px 12px' }}>
            <Icon name="grip" size="s" />
            <span className="grow">
              <b>Moving {drag.item.title}</b>
              {target ? ` · release on ${formatDayShort(target)}` : ' · drag onto a day'}
            </span>
          </div>
        </div>
      )}
      <div className="scroll" style={{ paddingTop: 0, gap: 0, paddingBottom: 96 }}>
        {unassigned.length > 0 && (
          <div className="dayrow" style={{ borderTop: 0 }}>
            <div className="dlab">
              <span>No day</span>
            </div>
            <div className="stack">{unassigned.map((item) => row(item, false))}</div>
          </div>
        )}
        {WEEKDAY_SHORT.map((name, i) => {
          const date = addDays(weekStart, i);
          const items = itemsByDate.get(date) ?? [];
          const past = compareDates(date, today) < 0;
          const isTarget = drag !== null && target === date && drag.item.date !== date;
          return (
            <div className={date === today ? 'dayrow today' : 'dayrow'} key={date} data-date={date}>
              <div className="dlab">
                {name}
                <b>{Number(date.slice(8))}</b>
              </div>
              <div className="stack">
                {isTarget && (
                  <div className="drop empty-slot" style={{ border: 0, justifyContent: 'center', fontWeight: 600, color: 'var(--ink)' }}>
                    Drop here · {formatDayShort(date)}
                  </div>
                )}
                {items.map((item) => row(item, past))}
                {items.length === 0 && !isTarget && (
                  <button type="button" className="empty-slot" onClick={() => onAdd(date)}>
                    <Icon name="plus" size="s" />
                    Rest · tap to add
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
      {drag && (
        <div
          className={`wk ${TYPE_META[drag.item.type].colorClass} lift`}
          style={{ left: drag.rect.left, width: drag.rect.width, top: drag.y - drag.rect.height / 2, transform: 'rotate(1.6deg) scale(1.03)' }}
          aria-hidden="true"
        >
          <TypeBadge type={drag.item.type} />
          <span className="grow col">
            <span className="nm">{drag.item.title}</span>
            <span className="ds ell">
              {describeValues(drag.item.actual)}
              {target && drag.item.date && target !== drag.item.date ? ` · ${formatDayShort(drag.item.date).slice(0, 3)} → ${formatDayShort(target).slice(0, 3)}` : ''}
            </span>
          </span>
          <Icon name="grip" />
        </div>
      )}
    </>
  );
}
