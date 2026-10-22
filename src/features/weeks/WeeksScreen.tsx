import { useMemo, useState } from 'react';
import { findActivePlan } from '../../domain/plans';
import { weekIndexOf, type IsoDate } from '../../domain/dates';
import type { Plan } from '../../domain/schema';
import { lastWeekOf } from '../../domain/schedule';
import { hrefOf } from '../../shared/router';
import { todayIso } from '../../shared/today';
import { Icon } from '../../shared/ui/Icon';
import { useToast } from '../../shared/ui/Toast';
import { PlanDataGate, usePlanData, type ReadyPlanData } from '../plan-data/PlanDataProvider';
import { SheetsLayer, type OpenSheet } from '../workout/SheetsLayer';
import { useInfiniteWeeks } from './useInfiniteWeeks';
import { WeekCard } from './WeekCard';
import { summarizeWeek, type WeekSummary } from './weeks-model';
import './weeks.css';

export function WeeksScreen() {
  return <PlanDataGate>{(data) => <Weeks data={data} />}</PlanDataGate>;
}

function NoActivePlan() {
  return (
    <>
      <div className="top">
        <div className="grow col g4">
          <span className="sm muted">No active plan</span>
          <h1 className="title">Weeks</h1>
        </div>
      </div>
      <div className="scroll" style={{ justifyContent: 'center', paddingBottom: 96 }}>
        <div className="card col g10 c" style={{ alignItems: 'center', padding: '22px 16px' }}>
          <h2 style={{ fontSize: 18, fontWeight: 700 }}>No weeks to show</h2>
          <p className="sm muted" style={{ textWrap: 'pretty' }}>
            Weeks appear once you have an active plan.
          </p>
          <a className="btn p" href={hrefOf({ name: 'plan-new' })}>
            Create plan
          </a>
        </div>
      </div>
    </>
  );
}

function currentWeekOf(plan: Plan, today: IsoDate): number {
  const week = Math.max(1, weekIndexOf(plan.startDate, today));
  const last = lastWeekOf(plan);
  return last === null ? week : Math.min(week, last);
}

function Weeks({ data }: { data: ReadyPlanData }) {
  const today = todayIso();
  const plan = findActivePlan(data.plans, today);
  if (!plan) return <NoActivePlan />;
  return <WeeksList data={data} plan={plan} today={today} />;
}

function WeeksList({ data, plan, today }: { data: ReadyPlanData; plan: Plan; today: IsoDate }) {
  const planData = usePlanData();
  const toast = useToast();
  const currentWeek = currentWeekOf(plan, today);
  const { first, last, hasMore, loading, sentinel, loadMore, loadEarlier } = useInfiniteWeeks(currentWeek, lastWeekOf(plan));
  const [openWeeks, setOpenWeeks] = useState<ReadonlySet<number>>(new Set([currentWeek]));
  const [editingId, setEditingId] = useState<string | null>(null);
  const [sheet, setSheet] = useState<OpenSheet>(null);

  const summaries = useMemo(
    () =>
      Array.from({ length: last - first + 1 }, (_, i) => summarizeWeek(plan, first + i, data.index, data.overrides)),
    [plan, first, last, data.index, data.overrides],
  );

  const toggleWeek = (week: number) =>
    setOpenWeeks((current) => {
      const next = new Set(current);
      if (!next.delete(week)) next.add(week);
      return next;
    });

  const resetWeek = async (summary: WeekSummary) => {
    const previous = data.overrides.filter((o) =>
      summary.resettable.some((k) => k.planId === o.planId && k.slotId === o.slotId && k.week === o.week),
    );
    if (!(await planData.removeOverrides(summary.resettable))) return;
    toast.show({
      message: `Week ${summary.week} reset to generated values`,
      action: { label: 'Undo', run: () => void planData.saveOverrides(previous) },
    });
  };

  return (
    <>
      <div className="top">
        <div className="grow col g4">
          <span className="sm muted">
            {plan.name} · {plan.endDate === null ? 'open-ended' : 'ends ' + plan.endDate}
          </span>
          <h1 className="title">Weeks</h1>
        </div>
        <button type="button" className="chip" onClick={() => setSheet({ adding: today })}>
          <Icon name="plus" size="xs" />
          Add workout
        </button>
      </div>
      <div className="scroll" style={{ paddingTop: 4 }}>
        {first > 1 && (
          <button type="button" className="btn s blk" onClick={loadEarlier}>
            Show earlier weeks
          </button>
        )}
        {summaries.map((summary) => (
          <WeekCard
            key={summary.week}
            plan={plan}
            data={data}
            summary={summary}
            isCurrent={summary.week === currentWeek}
            open={openWeeks.has(summary.week)}
            onToggle={() => toggleWeek(summary.week)}
            editingId={editingId}
            onEditing={setEditingId}
            onOpenSheet={setSheet}
            onResetWeek={() => void resetWeek(summary)}
          />
        ))}
        {loading && (
          <div className="col g10" aria-busy="true" aria-label="Loading more weeks">
            <div className="sk" style={{ height: 64, borderRadius: 18 }} />
            <div className="sk" style={{ height: 64, borderRadius: 18 }} />
            <span className="sm muted c">
              Generating weeks {last + 1}–{last + 4}…
            </span>
          </div>
        )}
        {hasMore && !loading && (
          <button type="button" className="btn s blk" onClick={loadMore}>
            Load more weeks
          </button>
        )}
        {hasMore && <div ref={sentinel} style={{ height: 1 }} aria-hidden="true" />}
        {!hasMore && <p className="sm muted c">This is the last week of the plan.</p>}
      </div>
      <SheetsLayer data={data} open={sheet} onChange={setSheet} />
    </>
  );
}
