import { useState } from 'react';
import type { ExerciseConfig, IntervalDraft, IntervalsSlot, RunSlot, StrengthSlot, TempoSlot } from '../../domain/schema';
import type { Issue } from '../../domain/validation';
import { newId } from '../../shared/ids';
import { Banner } from '../../shared/ui/Banner';
import { Icon } from '../../shared/ui/Icon';
import { Sparkline } from '../../shared/ui/Sparkline';
import { Stepper } from '../../shared/ui/Stepper';
import { TYPE_META } from '../../shared/workout-types';
import { fmt, fmtSpeed } from '../workout/describe';
import { runSeries, speedSeries, strengthSeries, tempoColumns, type Series } from './projection-view';
import { newExercise, projectSlot, slotIssues, type WizardDraft } from './wizard-model';

const warnTone = (issues: readonly Issue[], ...fields: string[]) =>
  issues.some((issue) => fields.includes(issue.field) && issue.severity === 'warning') ? ('warn' as const) : undefined;

function Warnings({ issues }: { issues: readonly Issue[] }) {
  const warnings = issues.filter((issue) => issue.severity === 'warning');
  if (warnings.length === 0) return null;
  return (
    <Banner tone="warn">
      <span>
        {warnings.map((issue) => (
          <span key={issue.field + issue.message} style={{ display: 'block' }}>
            {issue.message}
          </span>
        ))}
      </span>
    </Banner>
  );
}

function NoteField({ id, value, onChange }: { id: string; value: string | undefined; onChange: (value: string) => void }) {
  return (
    <div className="field">
      <label className="lbl" htmlFor={id}>
        Note (optional)
      </label>
      <input id={id} className="inp" value={value ?? ''} autoComplete="off" onChange={(event) => onChange(event.target.value)} />
    </div>
  );
}

function ValueTable({ series }: { series: Series }) {
  return (
    <div className="vt">
      {series.cells.map((cell) => (
        <div key={cell.week} className={cell.mark ? 'cell rs' : 'cell'}>
          <span className="h">{cell.week}</span>
          <span className="mono">{cell.main}</span>
          {cell.sub !== undefined && <small className="mono">{cell.sub}</small>}
        </div>
      ))}
    </div>
  );
}

// ---------- strength ----------

interface EditorProps<S> {
  slot: S;
  draft: WizardDraft;
  onChange: (slot: S) => void;
}

export function StrengthEditor({ slot, draft, onChange }: EditorProps<StrengthSlot>) {
  const [editingId, setEditingId] = useState<string | null>(slot.exercises[0]?.id ?? null);
  const colorClass = TYPE_META[slot.type].colorClass;

  const update = (id: string, changes: Partial<ExerciseConfig>) =>
    onChange({ ...slot, exercises: slot.exercises.map((e) => (e.id === id ? { ...e, ...changes } : e)) });

  const addExercise = () => {
    const exercise = newExercise(newId, `Exercise ${slot.exercises.length + 1}`);
    onChange({ ...slot, exercises: [...slot.exercises, exercise] });
    setEditingId(exercise.id);
  };

  const workouts = projectSlot(draft, slot.id);

  return (
    <>
      {slot.exercises.map((exercise) => {
        if (exercise.id !== editingId) {
          return (
            <button key={exercise.id} type="button" className="xrow" onClick={() => setEditingId(exercise.id)}>
              <span className="grow col">
                <span className="b">{exercise.name || 'Unnamed exercise'}</span>
                <span className="sm muted">
                  {exercise.sets} × {exercise.minReps}–{exercise.maxReps} · +{fmt(exercise.repsStep)} reps · {fmt(exercise.currentKg)} kg, +{fmt(exercise.kgStep)} kg
                </span>
              </span>
              <Icon name="forward" size="s" />
            </button>
          );
        }
        const issues = slotIssues({ ...slot, exercises: [exercise] });
        const series = strengthSeries(workouts, exercise.id);
        return (
          <div key={exercise.id} className={`card col g12 ${colorClass}`} style={{ borderColor: 'var(--ink)', borderWidth: 1.5 }}>
            <div className="r rb">
              <span className="b">{exercise.name || 'New exercise'}</span>
              <span className="st">Editing</span>
            </div>
            <div className="field">
              <label className="lbl" htmlFor={`exercise-${exercise.id}`}>
                Exercise
              </label>
              <input
                id={`exercise-${exercise.id}`}
                className={issues.some((i) => i.field === 'name') ? 'inp err' : 'inp'}
                value={exercise.name}
                autoComplete="off"
                onChange={(event) => update(exercise.id, { name: event.target.value })}
              />
            </div>
            <div className="two">
              <Stepper label="Sets" value={exercise.sets} step={1} min={1} decreaseLabel="Fewer sets" increaseLabel="More sets" onChange={(sets) => update(exercise.id, { sets: Math.round(sets) })} />
              <Stepper label="Current reps" value={exercise.currentReps} step={1} tone={warnTone(issues, 'currentReps')} decreaseLabel="Fewer reps" increaseLabel="More reps" onChange={(currentReps) => update(exercise.id, { currentReps })} />
              <Stepper label="Min reps" value={exercise.minReps} step={1} tone={warnTone(issues, 'minReps')} decreaseLabel="Lower min" increaseLabel="Raise min" onChange={(minReps) => update(exercise.id, { minReps })} />
              <Stepper label="Max reps" value={exercise.maxReps} step={1} tone={warnTone(issues, 'minReps')} decreaseLabel="Lower max" increaseLabel="Raise max" onChange={(maxReps) => update(exercise.id, { maxReps })} />
              <Stepper label="Reps step" prefix="+" value={exercise.repsStep} step={1} tone={warnTone(issues, 'repsStep')} decreaseLabel="Smaller step" increaseLabel="Larger step" onChange={(repsStep) => update(exercise.id, { repsStep })} />
              <Stepper label="Current weight" value={exercise.currentKg} unit="kg" step={2.5} decreaseLabel="Lighter" increaseLabel="Heavier" onChange={(currentKg) => update(exercise.id, { currentKg })} />
            </div>
            <div className="field">
              <Stepper label="Weight step" prefix="+" value={exercise.kgStep} unit="kg" step={0.5} tone={warnTone(issues, 'kgStep')} decreaseLabel="Smaller weight step" increaseLabel="Larger weight step" onChange={(kgStep) => update(exercise.id, { kgStep })} />
              <span className="hint">Added only in the week reps reset to min.</span>
            </div>
            <Warnings issues={issues} />
            <NoteField id={`note-${exercise.id}`} value={exercise.note} onChange={(note) => update(exercise.id, { note: note === '' ? undefined : note })} />
            <div className="sep" />
            <div className="col g8">
              <div className="r rb">
                <span className="b sm">Projection · reps@kg</span>
                <span className="xs muted">highlighted = weight step</span>
              </div>
              <div className="pvg">
                {series.cells.map((cell) => (
                  <div key={cell.week} className={cell.mark ? `pv up ${colorClass}` : 'pv'}>
                    <small>{cell.week}</small>
                    <span className="mono">
                      {cell.main}@{cell.sub}
                    </span>
                  </div>
                ))}
              </div>
            </div>
            <div className="r g8">
              <button
                type="button"
                className="btn s grow"
                style={{ minHeight: 46 }}
                disabled={slot.exercises.length === 1}
                onClick={() => {
                  onChange({ ...slot, exercises: slot.exercises.filter((e) => e.id !== exercise.id) });
                  setEditingId(null);
                }}
              >
                <Icon name="trash" size="s" />
                Remove
              </button>
              <button type="button" className="btn p grow" style={{ minHeight: 46 }} onClick={() => setEditingId(null)}>
                Done
              </button>
            </div>
          </div>
        );
      })}
      <button type="button" className="empty-slot" style={{ justifyContent: 'center', fontWeight: 600 }} onClick={addExercise}>
        <Icon name="plus" size="s" />
        Add exercise
      </button>
    </>
  );
}

// ---------- easy, long, tempo ----------

export function RunEditor({ slot, draft, onChange }: EditorProps<RunSlot | TempoSlot>) {
  const isTempo = slot.type === 'tempo';
  const colorClass = TYPE_META[slot.type].colorClass;
  const issues = slotIssues(slot);
  const workouts = projectSlot(draft, slot.id);
  const series = runSeries(workouts, slot.run);
  const noun = isTempo ? 'tempo' : 'km';
  const setRun = (changes: Partial<typeof slot.run>) => onChange({ ...slot, run: { ...slot.run, ...changes } });

  return (
    <>
      <div className="card col g12">
        <div className="two">
          {isTempo && (
            <>
              <Stepper label="Warm-up (fixed)" value={slot.warmupKm} unit="km" step={0.5} decreaseLabel="Shorter warm-up" increaseLabel="Longer warm-up" onChange={(warmupKm) => onChange({ ...slot, warmupKm })} />
              <Stepper label="Cool-down (fixed)" value={slot.cooldownKm} unit="km" step={0.5} decreaseLabel="Shorter cool-down" increaseLabel="Longer cool-down" onChange={(cooldownKm) => onChange({ ...slot, cooldownKm })} />
            </>
          )}
          <Stepper label={isTempo ? 'Current tempo' : 'Current km'} value={slot.run.current} unit="km" step={0.5} tone={warnTone(issues, 'current')} decreaseLabel="Less" increaseLabel="More" onChange={(current) => setRun({ current })} />
          <Stepper label="Km step" prefix="+" value={slot.run.step} unit="km" step={0.5} tone={warnTone(issues, 'step')} decreaseLabel="Smaller step" increaseLabel="Larger step" onChange={(step) => setRun({ step })} />
          <Stepper label={isTempo ? 'Min tempo' : 'Min km'} value={slot.run.min} unit="km" step={0.5} tone={warnTone(issues, 'min')} decreaseLabel="Lower min" increaseLabel="Raise min" onChange={(min) => setRun({ min })} />
          <Stepper label={isTempo ? 'Max tempo' : 'Max km'} value={slot.run.max} unit="km" step={0.5} tone={warnTone(issues, 'min')} decreaseLabel="Lower max" increaseLabel="Raise max" onChange={(max) => setRun({ max })} />
        </div>
        <Warnings issues={issues} />
        <NoteField id={`note-${slot.id}`} value={slot.note} onChange={(note) => onChange({ ...slot, note: note === '' ? undefined : note })} />
      </div>
      <div className={`card col g10 ${colorClass}`}>
        {isTempo ? (
          <>
            <div className="r rb">
              <span className="b">Projection · total km per session</span>
            </div>
            <TempoBars workouts={workouts} />
            <div className="r g16 xs muted">
              <span className="r g6">
                <i className="lg" style={{ background: 'var(--t-tp)' }} />
                Tempo (progresses)
              </span>
              <span className="r g6">
                <i className="lg" style={{ background: 'var(--line2)' }} />
                Warm-up + cool-down
              </span>
            </div>
          </>
        ) : (
          <>
            <div className="r rb">
              <span className="b">Projection · {noun}</span>
              <span className="xs muted r g6">
                <i className="dot" style={{ background: 'var(--ink)' }} />
                reset to min
              </span>
            </div>
            <Sparkline
              values={series.values}
              marks={series.marks}
              band={{ min: slot.run.min, max: slot.run.max }}
              height={72}
              pad={10}
              margin={0.5}
              colorClass={colorClass}
              label={`Projected distance in km, weeks 1 to ${series.values.length}: ${series.values.map(fmt).join(', ')}`}
            />
            <ValueTable series={series} />
            <p className="xs muted">
              Shaded band = min to max. The week that reaches max is shown at max; the next week resets to min.
            </p>
          </>
        )}
      </div>
    </>
  );
}

const TEMPO_PX_PER_KM = 9;

function TempoBars({ workouts }: { workouts: Parameters<typeof tempoColumns>[0] }) {
  const columns = tempoColumns(workouts);
  return (
    <div
      className="bars8"
      role="img"
      aria-label={`Total km per tempo session, weeks 1 to ${columns.length}: ${columns.map((c) => fmt(c.total)).join(', ')}`}
    >
      {columns.map((column) => (
        <div className="bcol" key={column.week}>
          <span className="mono xs">{fmt(column.total)}</span>
          <div className="bstack">
            <i className="fx" style={{ height: Math.round(column.warmup * TEMPO_PX_PER_KM) }} />
            <i className="tp" style={{ height: Math.round(column.tempo * TEMPO_PX_PER_KM) }} />
            <i className="fx" style={{ height: Math.round(column.cooldown * TEMPO_PX_PER_KM) }} />
          </div>
          <span className="xs muted b">{column.week}</span>
        </div>
      ))}
    </div>
  );
}

// ---------- intervals ----------

const MAX_DRAFTS = 8;

export function IntervalsEditor({ slot, draft, onChange }: EditorProps<IntervalsSlot>) {
  const [editing, setEditing] = useState(0);
  const colorClass = TYPE_META[slot.type].colorClass;
  const series = speedSeries(projectSlot(draft, slot.id));
  const count = slot.drafts.length;
  const current = slot.drafts[Math.min(editing, count - 1)];

  const updateDraft = (position: number, changes: Partial<IntervalDraft>) =>
    onChange({ ...slot, drafts: slot.drafts.map((d, i) => (i === position ? { ...d, ...changes } : d)) });

  const setDraftCount = (next: number) => {
    const wanted = Math.min(MAX_DRAFTS, Math.max(1, Math.round(next)));
    const last = slot.drafts[slot.drafts.length - 1];
    const drafts =
      wanted < count ? slot.drafts.slice(0, wanted) : [...slot.drafts, ...Array.from({ length: wanted - count }, () => ({ ...(last ?? { count: 5, distanceM: 400, restS: 90 }) }))];
    onChange({ ...slot, drafts });
    setEditing((position) => Math.min(position, wanted - 1));
  };

  return (
    <>
      <div className="card col g12">
        <div className="field">
          <Stepper
            label="Drafts in the cycle"
            value={count}
            unit={`drafts = ${count}-week cycle`}
            step={1}
            min={1}
            decreaseLabel="Fewer drafts"
            increaseLabel="More drafts"
            onChange={setDraftCount}
          />
          <span className="hint">Draft 1{count > 1 ? `, 2${count > 2 ? `, ${count}` : ''}` : ''} rotate week by week, then start over.</span>
        </div>
        <div className="two">
          <Stepper label="Warm-up (fixed)" value={slot.warmupKm} unit="km" step={0.5} decreaseLabel="Shorter warm-up" increaseLabel="Longer warm-up" onChange={(warmupKm) => onChange({ ...slot, warmupKm })} />
          <Stepper label="Cool-down (fixed)" value={slot.cooldownKm} unit="km" step={0.5} decreaseLabel="Shorter cool-down" increaseLabel="Longer cool-down" onChange={(cooldownKm) => onChange({ ...slot, cooldownKm })} />
          <Stepper label="Starting speed" value={slot.startSpeedKmh} unit="km/h" step={0.5} decreaseLabel="Slower" increaseLabel="Faster" onChange={(startSpeedKmh) => onChange({ ...slot, startSpeedKmh })} />
          <Stepper label="Speed increase" prefix="+" value={slot.speedStepKmh} unit="km/h" step={0.5} decreaseLabel="Smaller increase" increaseLabel="Larger increase" onChange={(speedStepKmh) => onChange({ ...slot, speedStepKmh })} />
        </div>
        <span className="hint">Speed goes up once after each full {count}-week cycle.</span>
        <NoteField id={`note-${slot.id}`} value={slot.note} onChange={(note) => onChange({ ...slot, note: note === '' ? undefined : note })} />
      </div>
      {slot.drafts.map((draftConfig, position) =>
        position === Math.min(editing, count - 1) && current ? (
          <div key={position} className={`card col g12 ${colorClass}`} style={{ borderColor: 'var(--ink)', borderWidth: 1.5 }}>
            <div className="r rb">
              <span className="b">Draft {position + 1}</span>
              <span className="st">Editing</span>
            </div>
            <div className="two">
              <Stepper label="Intervals" value={current.count} step={1} min={1} decreaseLabel="Fewer intervals" increaseLabel="More intervals" onChange={(value) => updateDraft(position, { count: Math.round(value) })} />
              <Stepper label="Distance each" value={current.distanceM} unit="m" step={50} min={50} decreaseLabel="Shorter" increaseLabel="Longer" onChange={(distanceM) => updateDraft(position, { distanceM })} />
              <Stepper label="Rest between" value={current.restS} unit="s" step={5} decreaseLabel="Less rest" increaseLabel="More rest" onChange={(restS) => updateDraft(position, { restS })} />
            </div>
          </div>
        ) : (
          <button key={position} type="button" className={`xrow ${colorClass}`} onClick={() => setEditing(position)}>
            <span className="badge sm" aria-hidden="true">D{position + 1}</span>
            <span className="grow col">
              <span className="b">Draft {position + 1}</span>
              <span className="sm muted">
                {draftConfig.count} × {fmt(draftConfig.distanceM)} m · rest {fmt(draftConfig.restS)} s
              </span>
            </span>
            <Icon name="forward" size="s" />
          </button>
        ),
      )}
      <div className={`card col g10 ${colorClass}`}>
        <div className="r rb">
          <span className="b">Projection · draft and speed</span>
          <span className="xs muted">highlighted = +{fmtSpeed(slot.speedStepKmh)} km/h</span>
        </div>
        <div className="cyc">
          {series.cells.map((cell) => (
            <div key={cell.week} className={cell.mark ? `cy up ${colorClass}` : 'cy'}>
              <small>
                {cell.week} · {cell.main}
              </small>
              <span className="mono">{cell.sub}</span>
            </div>
          ))}
        </div>
        <p className="xs muted">Each draft returns unchanged every cycle. Only the speed progresses.</p>
      </div>
    </>
  );
}
