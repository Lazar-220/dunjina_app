import { useState } from 'react';
import { addDays, compareDates, formatDayShort, isValidIsoDate, mondayOf, type IsoDate } from '../../domain/dates';
import { Banner } from '../../shared/ui/Banner';
import { Icon } from '../../shared/ui/Icon';
import { Sheet, SheetHeader } from '../../shared/ui/Sheet';
import type { CalendarItem } from './calendar-item';
import { describeValues } from './describe';

interface MoveSheetProps {
  item: CalendarItem;
  today: IsoDate;
  /** Monday of the plan week, used when the workout has no day yet. */
  weekStart: IsoDate;
  /** Titles of the other workouts on a date, to warn about a busy day. */
  titlesOn: (date: IsoDate, excludeKey?: string) => string[];
  onCancel: () => void;
  onMove: (date: IsoDate) => Promise<void>;
}

const WEEKDAY_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export function MoveSheet({ item, today, weekStart, titlesOn, onCancel, onMove }: MoveSheetProps) {
  const current = item.date;
  const monday = current ? mondayOf(current) : weekStart;
  const days = Array.from({ length: 7 }, (_, i) => addDays(monday, i));
  const [selected, setSelected] = useState<IsoDate | null>(null);
  const [otherDateOpen, setOtherDateOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const target = selected ?? current;
  const busy = target ? titlesOn(target, item.key) : [];
  const canMove = selected !== null && selected !== current;

  const move = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      await onMove(selected);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet label={`Move ${item.title}`} type={item.type} onClose={onCancel}>
      <SheetHeader
        type={item.type}
        title={`Move ${item.title}`}
        subtitle={`${describeValues(item.actual)} · ${current ? `now ${formatDayShort(current)}` : 'no day yet'}`}
        onClose={onCancel}
      />
      <div className="sec">This week</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 6 }}>
        {days.map((date, i) => {
          const isCurrent = date === current;
          const classes = ['wd', date === selected && 'on', isCurrent && 'cur', compareDates(date, today) < 0 && 'past']
            .filter(Boolean)
            .join(' ');
          return (
            <button
              key={date}
              type="button"
              className={classes}
              aria-pressed={date === selected}
              aria-label={`${formatDayShort(date)}${isCurrent ? ', current day' : ''}`}
              onClick={() => setSelected(date)}
            >
              {WEEKDAY_SHORT[i]}
              <b>{Number(date.slice(8))}</b>
            </button>
          );
        })}
      </div>
      {otherDateOpen ? (
        <div className="field">
          <label className="lbl" htmlFor="move-other-date">
            Another date
          </label>
          <input
            id="move-other-date"
            type="date"
            className="inp"
            value={selected ?? ''}
            onChange={(event) => {
              if (isValidIsoDate(event.target.value)) setSelected(event.target.value);
            }}
          />
        </div>
      ) : (
        <button
          type="button"
          className="inp"
          style={{ justifyContent: 'space-between', minHeight: 52 }}
          onClick={() => setOtherDateOpen(true)}
        >
          <span className="r g10">
            <Icon name="calendar" />
            Another week or date…
          </span>
          <Icon name="forward" size="s" />
        </button>
      )}
      <Banner tone="info">
        Only the day changes. Values and progression stay the same.
        {busy.length > 0 && target && ` ${formatDayShort(target).slice(0, 3)} already has ${busy.join(', ')}.`}
      </Banner>
      <div className="col g8">
        <button type="button" className="btn p blk" disabled={!canMove || saving} onClick={() => void move()}>
          {selected ? `Move to ${formatDayShort(selected)}` : 'Pick a day'}
        </button>
        <button type="button" className="btn s blk" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </Sheet>
  );
}
