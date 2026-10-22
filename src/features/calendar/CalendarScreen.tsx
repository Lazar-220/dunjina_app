import { useMemo, useState } from 'react';
import {
  addDays,
  firstOfMonth,
  formatDayShort,
  formatMonthTitle,
  mondayOf,
  monthGrid,
  shiftMonth,
  weekIndexOf,
  yearMonthOf,
  type IsoDate,
  type YearMonth,
} from '../../domain/dates';
import { findActivePlan } from '../../domain/plans';
import type { Plan } from '../../domain/schema';
import { lastWeekOf } from '../../domain/schedule';
import { todayIso } from '../../shared/today';
import { Icon } from '../../shared/ui/Icon';
import { WorkoutRow } from '../../shared/ui/WorkoutRow';
import { PlanDataGate, type ReadyPlanData } from '../plan-data/PlanDataProvider';
import type { CalendarItem } from '../workout/calendar-item';
import { describeValues } from '../workout/describe';
import { groupByDate, itemsBetween, unassignedInWeek } from '../workout/item-queries';
import { SheetsLayer, type OpenSheet } from '../workout/SheetsLayer';
import { useWorkoutActions } from '../workout/useWorkoutActions';
import { CalendarEmpty } from './CalendarEmpty';
import { MonthView } from './MonthView';
import { WeekView } from './WeekView';

type View = 'month' | 'week';

export function CalendarScreen() {
  return <PlanDataGate>{(data) => <Calendar data={data} />}</PlanDataGate>;
}

/** "Autumn base · Week 5", or just the plan name outside its weeks, or "No active plan". */
function subtitleFor(plan: Plan | undefined, date: IsoDate): string {
  if (!plan) return 'No active plan';
  const week = weekIndexOf(plan.startDate, date);
  const last = lastWeekOf(plan);
  return week >= 1 && (last === null || week <= last) ? `${plan.name} · Week ${week}` : plan.name;
}

function Calendar({ data }: { data: ReadyPlanData }) {
  const today = todayIso();
  const [view, setView] = useState<View>('month');
  const [selected, setSelected] = useState<IsoDate>(today);
  const [month, setMonth] = useState<YearMonth>(() => yearMonthOf(today));
  const [open, setOpen] = useState<OpenSheet>(null);

  const source = useMemo(
    () => ({ plans: data.plans, oneOffs: data.oneOffs, index: data.index }),
    [data.plans, data.oneOffs, data.index],
  );
  const activePlan = findActivePlan(data.plans, today);

  const weekStart = mondayOf(selected);
  const range = useMemo(() => {
    if (view === 'week') return { from: weekStart, to: addDays(weekStart, 6) };
    const grid = monthGrid(month);
    return { from: grid[0] ?? firstOfMonth(month), to: grid[grid.length - 1] ?? firstOfMonth(month) };
  }, [view, weekStart, month]);

  const items = useMemo(() => itemsBetween(source, range.from, range.to), [source, range]);
  const itemsByDate = useMemo(() => groupByDate(items), [items]);
  const actions = useWorkoutActions(data);
  const unassigned = useMemo(() => {
    if (view !== 'week' || !activePlan) return [];
    const week = weekIndexOf(activePlan.startDate, weekStart);
    return week >= 1 ? unassignedInWeek(activePlan, week, data.index) : [];
  }, [view, activePlan, weekStart, data.index]);


  if (data.plans.length === 0 && data.oneOffs.length === 0) return <CalendarEmpty today={today} />;

  const select = (date: IsoDate) => {
    setSelected(date);
    setMonth(yearMonthOf(date));
  };

  const stepMonth = (delta: number) => {
    const next = shiftMonth(month, delta);
    setMonth(next);
    setSelected(yearMonthOf(today).year === next.year && yearMonthOf(today).month === next.month ? today : firstOfMonth(next));
  };

  const stepWeek = (delta: number) => select(addDays(selected, 7 * delta));

  const selectedItems = itemsByDate.get(selected) ?? [];
  const selectedWeek = activePlan ? weekIndexOf(activePlan.startDate, selected) : 0;
  const agendaSub =
    (selected === today ? 'Today' : selectedWeek >= 1 ? `Week ${selectedWeek}` : 'Outside the plan') +
    ` · ${selectedItems.length === 0 ? 'no workouts' : `${selectedItems.length} ${selectedItems.length === 1 ? 'workout' : 'workouts'}`}`;

  const title = view === 'month' ? formatMonthTitle(month) : `Week of ${formatDayShort(weekStart)}`;
  const previousLabel = view === 'month' ? 'Previous month' : 'Previous week';
  const nextLabel = view === 'month' ? 'Next month' : 'Next week';
  const step = view === 'month' ? stepMonth : stepWeek;

  return (
    <>
      <div className="top">
        <div className="grow col g4">
          <span className="sm muted">{subtitleFor(activePlan, selected)}</span>
          <h1 className="title">{title}</h1>
        </div>
        <button type="button" className="ib o" aria-label={previousLabel} onClick={() => step(-1)}>
          <Icon name="back" />
        </button>
        <button type="button" className="ib o" aria-label={nextLabel} onClick={() => step(1)}>
          <Icon name="forward" />
        </button>
      </div>
      <div style={{ padding: '0 16px 8px' }}>
        <div className="seg">
          <button type="button" className={view === 'month' ? 'on' : undefined} aria-pressed={view === 'month'} onClick={() => setView('month')}>
            Month
          </button>
          <button type="button" className={view === 'week' ? 'on' : undefined} aria-pressed={view === 'week'} onClick={() => setView('week')}>
            Week
          </button>
        </div>
      </div>

      {view === 'month' ? (
        <>
          <MonthView month={month} today={today} selected={selected} itemsByDate={itemsByDate} onSelect={select} />
          <div className="legend" aria-hidden="true">
            <span><i className="dot t-lr" />Done</span>
            <span><i className="dot ring t-lr" />Draft</span>
            <span><i className="dot sq t-lo" />Strength</span>
            <span><i className="dot t-ez" />Running</span>
          </div>
          <div className="sep" style={{ margin: '6px 16px 0' }} />
          <div className="scroll" style={{ paddingTop: 12 }}>
            <div className="col g4">
              <h2 style={{ fontSize: 18, fontWeight: 700 }}>{formatDayShort(selected)}</h2>
              <span className="sm muted">{agendaSub}</span>
            </div>
            {selectedItems.map((item) => (
              <WorkoutRow
                key={item.key}
                type={item.type}
                title={item.title}
                detail={describeValues(item.actual)}
                status={item.status}
                edited={item.edited}
                statusPill
                onOpen={() => setOpen({ itemRef: item.ref, mode: 'view' })}
              />
            ))}
            {selectedItems.length === 0 && (
              <button type="button" className="empty-slot" style={{ minHeight: 64 }} onClick={() => setOpen({ adding: selected })}>
                <Icon name="plus" />
                Rest day · tap to add a workout
              </button>
            )}
          </div>
        </>
      ) : (
        <WeekView
          weekStart={weekStart}
          today={today}
          itemsByDate={itemsByDate}
          unassigned={unassigned}
          onOpen={(item: CalendarItem) => setOpen({ itemRef: item.ref, mode: 'view' })}
          onMove={(item: CalendarItem) => setOpen({ itemRef: item.ref, mode: 'move' })}
          onDrop={(item, date) => void actions.move(item, date)}
          onAdd={(date) => setOpen({ adding: date })}
        />
      )}

      <button type="button" className="fab" aria-label="Add workout" onClick={() => setOpen({ adding: selected })}>
        <Icon name="plus" size="l" />
      </button>

      <SheetsLayer data={data} open={open} onChange={setOpen} onAdded={(oneOff) => select(oneOff.date)} />
    </>
  );
}
