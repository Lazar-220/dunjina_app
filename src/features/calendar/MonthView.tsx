import { formatDayShort, monthGrid, yearMonthOf, type IsoDate, type YearMonth } from '../../domain/dates';
import { TYPE_META } from '../../shared/workout-types';
import type { CalendarItem } from '../workout/calendar-item';

const MAX_DOTS = 4;
const WEEKDAY_INITIALS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

interface MonthViewProps {
  month: YearMonth;
  today: IsoDate;
  selected: IsoDate;
  itemsByDate: ReadonlyMap<IsoDate, CalendarItem[]>;
  onSelect: (date: IsoDate) => void;
}

export function MonthView({ month, today, selected, itemsByDate, onSelect }: MonthViewProps) {
  return (
    <div style={{ padding: '0 10px', flex: 'none' }}>
      <div className="mgrid" aria-hidden="true">
        {WEEKDAY_INITIALS.map((initial, i) => (
          <div className="dow" key={i}>
            {initial}
          </div>
        ))}
      </div>
      <div className="mgrid">
        {monthGrid(month).map((date) => {
          const items = itemsByDate.get(date) ?? [];
          const inMonth = yearMonthOf(date).month === month.month;
          const classes = ['day', !inMonth && 'out', date === today && 'today', date === selected && 'sel']
            .filter(Boolean)
            .join(' ');
          const count = items.length;
          return (
            <button
              key={date}
              type="button"
              className={classes}
              aria-label={`${formatDayShort(date)}, ${count === 0 ? 'no workouts' : `${count} ${count === 1 ? 'workout' : 'workouts'}`}`}
              aria-pressed={date === selected}
              onClick={() => onSelect(date)}
            >
              <span className="n">{Number(date.slice(8))}</span>
              <span className="dots" aria-hidden="true">
                {items.slice(0, MAX_DOTS).map((item) => {
                  const meta = TYPE_META[item.type];
                  const classes = ['dot', meta.colorClass, meta.shape === 'square' && 'sq', item.status !== 'done' && 'ring']
                    .filter(Boolean)
                    .join(' ');
                  return <span key={item.key} className={classes} />;
                })}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
