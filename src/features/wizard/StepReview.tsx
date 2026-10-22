import { formatDayShort } from '../../domain/dates';
import type { Slot } from '../../domain/schema';
import { Icon } from '../../shared/ui/Icon';
import { Sparkline } from '../../shared/ui/Sparkline';
import { TYPE_META } from '../../shared/workout-types';
import { fmt, fmtSpeed } from '../workout/describe';
import { runSeries, speedSeries, strengthSeries, type Series } from './projection-view';
import { projectSlot, slotNames, weeklyCounts, weeklyRunningKm, PROJECTED_WEEKS, type WizardDraft } from './wizard-model';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const VOLUME_BAR_MAX_PX = 62;

interface StepReviewProps {
  draft: WizardDraft;
  onEditSlot: (index: number) => void;
}

export function StepReview({ draft, onEditSlot }: StepReviewProps) {
  const names = slotNames(draft.slots);
  const { strength, running } = weeklyCounts(draft.slots);
  const volume = weeklyRunningKm(draft);
  const maxVolume = Math.max(...volume, 1);

  return (
    <>
      <div className="col g4">
        <h1 className="title">Review</h1>
        <p className="muted" style={{ textWrap: 'pretty' }}>
          The first {PROJECTED_WEEKS} projected weeks of every slot. Check that the rules do what you expect, then save.
        </p>
      </div>
      <div className="card col g10">
        <div className="r rb">
          <span className="b">{draft.name.trim()}</span>
          <span className="st">{draft.endDate === null ? 'Open-ended' : `Ends ${formatDayShort(draft.endDate)}`}</span>
        </div>
        <span className="sm muted">
          Starts {formatDayShort(draft.startDate)} · {draft.slots.length} workouts a week · {strength} strength, {running} running
        </span>
        <div className="sep" />
        <span className="b sm">Running volume per week (km)</span>
        <div
          className="vbars"
          role="img"
          aria-label={`Running km per week, weeks 1 to ${volume.length}: ${volume.map((km) => Math.round(km)).join(', ')}`}
        >
          {volume.map((km, i) => (
            <div className="vcol" key={i}>
              <span className="mono xs">{Math.round(km)}</span>
              <i style={{ height: Math.round((km / maxVolume) * VOLUME_BAR_MAX_PX) }} />
              <span className="xs muted b">W{i + 1}</span>
            </div>
          ))}
        </div>
      </div>
      {draft.slots.map((slot, index) => (
        <SlotSummary key={slot.id} draft={draft} slot={slot} name={names.get(slot.id) ?? ''} onEdit={() => onEditSlot(index)} />
      ))}
      <p className="xs muted c" style={{ padding: '4px 8px 0', textWrap: 'pretty' }}>
        Dark dots and highlighted cells mark the week a value resets (reps back to min, or speed steps up). Weeks after{' '}
        {PROJECTED_WEEKS} follow the same rules without limit.
      </p>
    </>
  );
}

function SlotSummary({ draft, slot, name, onEdit }: { draft: WizardDraft; slot: Slot; name: string; onEdit: () => void }) {
  const meta = TYPE_META[slot.type];
  const workouts = projectSlot(draft, slot.id);
  const day = slot.defaultWeekday === null ? 'No day' : (WEEKDAYS[slot.defaultWeekday] ?? '');

  const rows: { title: string; subtitle: string; series: Series; band?: { min: number; max: number }; height: number; label: string }[] = [];
  let meta2 = day;
  if (slot.type === 'lower' || slot.type === 'upper') {
    meta2 = `${day} · ${slot.exercises.length} ${slot.exercises.length === 1 ? 'exercise' : 'exercises'}`;
    for (const exercise of slot.exercises) {
      const series = strengthSeries(workouts, exercise.id);
      rows.push({
        title: exercise.name,
        subtitle: `${exercise.sets} sets · ${exercise.minReps}–${exercise.maxReps} reps (+${fmt(exercise.repsStep)}) · ${fmt(exercise.currentKg)} kg (+${fmt(exercise.kgStep)})`,
        series,
        band: { min: exercise.minReps, max: exercise.maxReps },
        height: 40,
        label: `${exercise.name}, reps by week: ${series.values.join(', ')}`,
      });
    }
  } else if (slot.type === 'intervals') {
    const series = speedSeries(workouts);
    meta2 = `${day} · ${slot.drafts.length}-draft cycle`;
    rows.push({
      title: 'Speed (km/h)',
      subtitle: `${fmtSpeed(slot.startSpeedKmh)} start · +${fmtSpeed(slot.speedStepKmh)} per cycle`,
      series,
      height: 48,
      label: `Interval speed by week: ${series.values.map(fmtSpeed).join(', ')}`,
    });
  } else {
    const series = runSeries(workouts, slot.run);
    if (slot.type === 'tempo') meta2 = `${day} · ${fmt(slot.warmupKm)} km warm-up, ${fmt(slot.cooldownKm)} km cool-down`;
    rows.push({
      title: slot.type === 'tempo' ? 'Tempo distance' : 'Distance',
      subtitle: `${fmt(slot.run.current)} km · range ${fmt(slot.run.min)}–${fmt(slot.run.max)} · +${fmt(slot.run.step)}`,
      series,
      band: { min: slot.run.min, max: slot.run.max },
      height: 56,
      label: `${name}, km by week: ${series.values.map(fmt).join(', ')}`,
    });
  }

  return (
    <div className={`card col g12 ${meta.colorClass}`}>
      <div className="r">
        <span className={meta.shape === 'square' ? 'badge sm sq' : 'badge sm'} aria-hidden="true">
          {meta.code}
        </span>
        <span className="grow col">
          <span className="b">{name}</span>
          <span className="xs muted">{meta2}</span>
        </span>
        <button type="button" className="ib" aria-label={`Edit ${name}`} onClick={onEdit}>
          <Icon name="edit" size="s" />
        </button>
      </div>
      {rows.map((row) => (
        <div className="col g6" key={row.title}>
          <div className="r rb">
            <span className="b sm">{row.title}</span>
            <span className="xs muted">{row.subtitle}</span>
          </div>
          <Sparkline
            values={row.series.values}
            marks={row.series.marks}
            band={row.band}
            height={row.height}
            colorClass={meta.colorClass}
            label={row.label}
          />
          <div className="vt">
            {row.series.cells.map((cell) => (
              <div key={cell.week} className={cell.mark ? 'cell rs' : 'cell'}>
                <span className="h">{cell.week}</span>
                <span className="mono">{cell.main}</span>
                {cell.sub !== undefined && <small className="mono">{cell.sub}</small>}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
