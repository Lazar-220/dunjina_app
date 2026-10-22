import { useMemo, useState } from 'react';
import { formatDayShort } from '../../domain/dates';
import { previewImpact } from '../../domain/impact';
import type { Plan, Slot } from '../../domain/schema';
import type { OverrideIndex, WorkoutValues } from '../../domain/schedule';
import { Banner } from '../../shared/ui/Banner';
import { Icon } from '../../shared/ui/Icon';
import { Sheet, SheetHeader } from '../../shared/ui/Sheet';
import type { CalendarItem } from './calendar-item';
import { buildOverride, differencesOf } from './edit-model';
import { impactGroups } from './impact-view';
import { WorkoutForm } from './WorkoutForm';

interface MarkDoneSheetProps {
  item: CalendarItem;
  /** Plan and slot of a plan workout; null for one-offs. */
  source: { plan: Plan; slot: Slot; index: OverrideIndex } | null;
  mode: 'done' | 'edit';
  onCancel: () => void;
  onSave: (form: WorkoutValues, done: boolean) => Promise<void>;
}

function samePlan(planned: WorkoutValues | null, form: WorkoutValues): boolean {
  return planned !== null && differencesOf(planned, form) === undefined;
}

export function MarkDoneSheet({ item, source, mode, onCancel, onSave }: MarkDoneSheetProps) {
  const [form, setForm] = useState<WorkoutValues>(item.actual);
  const [saving, setSaving] = useState(false);
  const done = mode === 'done' || item.status === 'done';

  const groups = useMemo(() => {
    if (!source || !item.planned || item.ref.kind !== 'plan') return [];
    const candidate = buildOverride({
      existing: source.index.get(item.ref.slotId)?.get(item.ref.week),
      planId: item.ref.planId,
      slotId: item.ref.slotId,
      week: item.ref.week,
      planned: item.planned,
      form,
      done,
    });
    if (!candidate) return [];
    return impactGroups(previewImpact(source.plan, source.slot, candidate, source.index));
  }, [done, form, item.planned, item.ref, source]);

  const matchesPlan = samePlan(item.planned, form);
  const title = mode === 'done' ? 'Mark as done' : 'Edit workout';
  const day = item.date ? formatDayShort(item.date) : 'No day assigned';

  const save = async () => {
    setSaving(true);
    try {
      await onSave(form, done);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet label={`${title}: ${item.title}`} type={item.type} onClose={onCancel}>
      <SheetHeader type={item.type} title={title} subtitle={`${item.title} · ${day}`} onClose={onCancel} />
      <div className="body">
        <p className="sm muted" style={{ textWrap: 'pretty' }}>
          {item.planned
            ? 'Values start from the plan. Change only what was different; your numbers become the baseline for the weeks after.'
            : 'Enter what you did. One-off workouts sit outside the plan and never change its progression.'}
        </p>
        <WorkoutForm values={form} planned={item.planned} week={item.week} onChange={setForm} />
        {groups.length > 0 && (
          <div className="col g8">
            <Banner tone="warn">
              <b>This changes the next weeks.</b> Check the preview before saving.
            </Banner>
            {groups.map((group) => (
              <div className="ex" key={group.label}>
                <span className="b sm">{group.label}</span>
                <div className="imp3">
                  {group.cells.map((cell) => (
                    <div key={cell.header}>
                      <small>{cell.header}</small>
                      {cell.changed ? (
                        <span className="mono">
                          <span className="was">{cell.was}</span>
                          <br />
                          <b>{cell.now}</b>
                        </span>
                      ) : (
                        <span className="mono muted">
                          {cell.now}
                          <br />
                          unchanged
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
        {item.planned && groups.length === 0 && matchesPlan && (
          <Banner tone="ok">Matches the plan. Later weeks stay as generated.</Banner>
        )}
        {item.planned && groups.length === 0 && !matchesPlan && (
          <Banner tone="info">Only this workout changes. Later weeks stay as generated.</Banner>
        )}
      </div>
      <div className="r g8">
        <button type="button" className="btn s" style={{ minWidth: 96 }} onClick={onCancel}>
          Cancel
        </button>
        <button type="button" className="btn p grow" disabled={saving} onClick={() => void save()}>
          <Icon name="check" size="s" />
          {mode === 'done' ? 'Save as done' : 'Save changes'}
        </button>
      </div>
    </Sheet>
  );
}
