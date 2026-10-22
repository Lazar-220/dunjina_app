import { addDays, compareDates, type IsoDate } from '../../domain/dates';
import { Icon } from '../../shared/ui/Icon';
import { WorkoutRow } from '../../shared/ui/WorkoutRow';
import type { CalendarItem } from '../workout/calendar-item';
import { describeValues } from '../workout/describe';

const WEEKDAY_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

interface WeekViewProps {
  weekStart: IsoDate;
  today: IsoDate;
  itemsByDate: ReadonlyMap<IsoDate, CalendarItem[]>;
  /** Plan workouts of this week that have no day yet. */
  unassigned: readonly CalendarItem[];
  onOpen: (item: CalendarItem) => void;
  onMove: (item: CalendarItem) => void;
  onAdd: (date: IsoDate) => void;
}

export function WeekView({ weekStart, today, itemsByDate, unassigned, onOpen, onMove, onAdd }: WeekViewProps) {
  const row = (item: CalendarItem, muted: boolean) => (
    <WorkoutRow
      key={item.key}
      type={item.type}
      title={item.title}
      detail={describeValues(item.actual)}
      status={item.status}
      edited={item.edited}
      muted={muted}
      onOpen={() => onOpen(item)}
      menu={{ label: `More actions for ${item.title}`, onClick: () => onMove(item) }}
    />
  );

  return (
    <div className="scroll" style={{ paddingTop: 0, gap: 0 }}>
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
        return (
          <div className={date === today ? 'dayrow today' : 'dayrow'} key={date}>
            <div className="dlab">
              {name}
              <b>{Number(date.slice(8))}</b>
            </div>
            <div className="stack">
              {items.map((item) => row(item, past))}
              {items.length === 0 && (
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
  );
}
