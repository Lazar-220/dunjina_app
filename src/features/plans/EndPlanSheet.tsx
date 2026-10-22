import { useState } from 'react';
import { compareDates, formatDayShort, isValidIsoDate, type IsoDate } from '../../domain/dates';
import type { Plan } from '../../domain/schema';
import { validatePlanEnd, type Issue } from '../../domain/validation';
import { Banner } from '../../shared/ui/Banner';
import { Icon } from '../../shared/ui/Icon';
import { Sheet } from '../../shared/ui/Sheet';
import type { ReadyPlanData } from '../plan-data/PlanDataProvider';
import { draftsRemovedThisWeek } from './plans-model';

interface EndPlanSheetProps {
  plan: Plan;
  data: ReadyPlanData;
  today: IsoDate;
  subtitle: string;
  onCancel: () => void;
  onEnd: (endedOn: IsoDate) => Promise<void>;
}

function endIssues(plan: Plan, data: ReadyPlanData, end: IsoDate): Issue[] {
  const issues = validatePlanEnd(plan, data.index, end);
  if (compareDates(end, plan.startDate) < 0) {
    issues.push({ field: 'endDate', severity: 'error', message: 'The plan can’t end before it starts.' });
  }
  return issues;
}

/** Confirmation for ending a plan: what is kept, what is removed, and on which day. */
export function EndPlanSheet({ plan, data, today, subtitle, onCancel, onEnd }: EndPlanSheetProps) {
  const [pickDate, setPickDate] = useState(false);
  const [picked, setPicked] = useState<IsoDate>(today);
  const [saving, setSaving] = useState(false);
  const end = pickDate ? picked : today;
  const issues = endIssues(plan, data, end);
  const removed = draftsRemovedThisWeek(plan, data.index, end, today);

  const confirm = async () => {
    setSaving(true);
    try {
      await onEnd(end);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet label={`End plan: ${plan.name}`} onClose={onCancel}>
      <div className="sheet-head">
        <div className="grow col g4">
          <h2 style={{ fontSize: 21, fontWeight: 700 }}>End “{plan.name}”?</h2>
          <span className="sm muted">{subtitle}</span>
        </div>
        <button type="button" className="ib" aria-label="Close" onClick={onCancel}>
          <Icon name="close" />
        </button>
      </div>
      <div className="seg">
        <button type="button" className={pickDate ? undefined : 'on'} aria-pressed={!pickDate} onClick={() => setPickDate(false)}>
          Today · {formatDayShort(today)}
        </button>
        <button type="button" className={pickDate ? 'on' : undefined} aria-pressed={pickDate} onClick={() => setPickDate(true)}>
          Pick a date
        </button>
      </div>
      {pickDate && (
        <div className="field">
          <label className="lbl" htmlFor="end-plan-date">
            Last day of the plan
          </label>
          <input
            id="end-plan-date"
            type="date"
            className="inp"
            value={picked}
            onChange={(event) => {
              if (isValidIsoDate(event.target.value)) setPicked(event.target.value);
            }}
          />
        </div>
      )}
      {issues.map((issue) => (
        <Banner key={issue.message} tone="err">
          {issue.message}
        </Banner>
      ))}
      <div className="col g8">
        <div className="r g12" style={{ alignItems: 'flex-start' }}>
          <Icon name="check" size="s" />
          <span>
            <b>Kept:</b> every completed workout and your edited values stay in the calendar.
          </span>
        </div>
        <div className="r g12" style={{ alignItems: 'flex-start' }}>
          <Icon name="trash" size="s" />
          <span>
            <b>Removed:</b> all drafts after {formatDayShort(end)}
            {removed > 0 ? `, including ${removed} still open this week` : ''}.
          </span>
        </div>
      </div>
      <Banner tone="info">An ended plan can’t be restarted, but you can duplicate it as a new plan.</Banner>
      <div className="col g8">
        <button type="button" className="btn d blk" disabled={issues.length > 0 || saving} onClick={() => void confirm()}>
          End plan
        </button>
        <button type="button" className="btn s blk" onClick={onCancel}>
          Keep plan
        </button>
      </div>
    </Sheet>
  );
}
