import { useState } from 'react';
import { formatDayShort, isValidIsoDate, mondayOf } from '../../domain/dates';
import type { Issue } from '../../domain/validation';
import { Icon } from '../../shared/ui/Icon';
import type { WizardDraft } from './wizard-model';

interface StepBasicsProps {
  draft: WizardDraft;
  onChange: (draft: WizardDraft) => void;
  issues: readonly Issue[];
  /** A plan that is already running keeps its start date: every saved edit is keyed to a plan week. */
  startDateLocked: boolean;
  /** Where the end date goes when the user switches open-ended off. */
  suggestedEndDate: string;
}

function IssueText({ id, issue }: { id: string; issue: Issue | undefined }) {
  if (!issue) return null;
  return (
    <span id={id} className={`hint ${issue.severity === 'error' ? 'err' : 'warn'} r g6`} role="alert">
      <Icon name="warning" size="xs" />
      {issue.message}
    </span>
  );
}

export function StepBasics({ draft, onChange, issues, startDateLocked, suggestedEndDate }: StepBasicsProps) {
  const [nameTouched, setNameTouched] = useState(false);
  const nameIssue = issues.find((issue) => issue.field === 'name');
  const endIssue = issues.find((issue) => issue.field === 'endDate');
  const openEnded = draft.endDate === null;
  const week1 = mondayOf(draft.startDate);

  return (
    <>
      <div className="col g4">
        <h1 className="title">Basics</h1>
        <p className="muted">Name the plan and say when it runs.</p>
      </div>
      <div className="field">
        <label className="lbl" htmlFor="plan-name">
          Plan name
        </label>
        <input
          id="plan-name"
          className={nameTouched && nameIssue ? 'inp err' : 'inp'}
          value={draft.name}
          autoComplete="off"
          aria-describedby={nameTouched && nameIssue ? 'plan-name-issue' : undefined}
          onChange={(event) => onChange({ ...draft, name: event.target.value })}
          onBlur={() => setNameTouched(true)}
        />
        {nameTouched && <IssueText id="plan-name-issue" issue={nameIssue} />}
      </div>
      <div className="field">
        <label className="lbl" htmlFor="plan-start">
          Start date
        </label>
        <input
          id="plan-start"
          type="date"
          className={startDateLocked ? 'inp dis' : 'inp'}
          value={draft.startDate}
          disabled={startDateLocked}
          onChange={(event) => {
            if (isValidIsoDate(event.target.value)) onChange({ ...draft, startDate: event.target.value });
          }}
        />
        <span className="hint">
          {startDateLocked
            ? 'A running plan keeps its start date, because your saved edits belong to its weeks.'
            : `Weeks run Monday to Sunday. Week 1 is the week of ${formatDayShort(week1)}.`}
        </span>
      </div>
      <div className="card r" style={{ minHeight: 72 }}>
        <div className="grow col g4">
          <span className="b" id="open-ended-label">
            Open-ended
          </span>
          <span className="sm muted">Runs until you change it. Workouts keep generating as you scroll.</span>
        </div>
        <button
          type="button"
          className={openEnded ? 'tgl on' : 'tgl'}
          role="switch"
          aria-checked={openEnded}
          aria-labelledby="open-ended-label"
          onClick={() => onChange({ ...draft, endDate: openEnded ? suggestedEndDate : null })}
        />
      </div>
      {!openEnded && (
        <div className="field">
          <label className="lbl" htmlFor="plan-end">
            End date
          </label>
          <input
            id="plan-end"
            type="date"
            className={endIssue ? 'inp err' : 'inp'}
            value={draft.endDate ?? ''}
            aria-describedby={endIssue ? 'plan-end-issue' : undefined}
            aria-invalid={endIssue ? true : undefined}
            onChange={(event) => {
              if (isValidIsoDate(event.target.value)) onChange({ ...draft, endDate: event.target.value });
            }}
          />
          <IssueText id="plan-end-issue" issue={endIssue} />
        </div>
      )}
    </>
  );
}
