import type { StrengthExerciseValues, WorkoutValues } from '../../domain/schedule';
import { Banner } from '../../shared/ui/Banner';
import { Icon } from '../../shared/ui/Icon';
import { Stepper } from '../../shared/ui/Stepper';
import { fmt, fmtSpeed } from './describe';

interface WorkoutFormProps {
  values: WorkoutValues;
  /** Generated values to compare with; null for one-off workouts. */
  planned: WorkoutValues | null;
  /** Plan week of the workout, used to say when an interval draft returns. */
  week: number | null;
  onChange: (values: WorkoutValues) => void;
}

const KM_STEP = 0.5;
const KG_STEP = 2.5;
const SPEED_STEP = 0.5;
const DISTANCE_STEP_M = 50;
const REST_STEP_S = 5;

function EditedMark({ show }: { show: boolean }) {
  return show ? <span className="mod">edited</span> : null;
}

/** Editable values of one workout. Plan workouts compare against the plan; one-offs are free-form. */
export function WorkoutForm({ values, planned, week, onChange }: WorkoutFormProps) {
  switch (values.kind) {
    case 'strength':
      return (
        <StrengthForm
          values={values}
          planned={planned?.kind === 'strength' ? planned : null}
          onChange={onChange}
        />
      );
    case 'run':
      return (
        <div className="ex">
          <div className="r rb">
            <span className="b">Distance</span>
            <span className="r g6">
              <EditedMark show={planned?.kind === 'run' && planned.km !== values.km} />
              {planned?.kind === 'run' && <span className="xs muted">plan {fmt(planned.km)} km</span>}
            </span>
          </div>
          <Stepper
            label="Distance"
            hideLabel
            value={values.km}
            unit="km"
            step={KM_STEP}
            modified={planned?.kind === 'run' && planned.km !== values.km}
            decreaseLabel="0.5 km less"
            increaseLabel="0.5 km more"
            onChange={(km) => onChange({ ...values, km })}
          />
        </div>
      );
    case 'tempo': {
      const plan = planned?.kind === 'tempo' ? planned : null;
      return (
        <div className="ex">
          <div className="r rb">
            <span className="b">Tempo distance</span>
            <span className="r g6">
              <EditedMark show={plan !== null && plan.km !== values.km} />
              {plan && <span className="xs muted">plan {fmt(plan.km)} km</span>}
            </span>
          </div>
          <Stepper
            label="Tempo distance"
            hideLabel
            value={values.km}
            unit="km"
            step={KM_STEP}
            modified={plan !== null && plan.km !== values.km}
            decreaseLabel="0.5 km less"
            increaseLabel="0.5 km more"
            onChange={(km) => onChange({ ...values, km })}
          />
          {!plan && (
            <div className="two">
              <Stepper
                label="Warm-up"
                value={values.warmupKm}
                unit="km"
                step={KM_STEP}
                decreaseLabel="Shorter warm-up"
                increaseLabel="Longer warm-up"
                onChange={(warmupKm) => onChange({ ...values, warmupKm })}
              />
              <Stepper
                label="Cool-down"
                value={values.cooldownKm}
                unit="km"
                step={KM_STEP}
                decreaseLabel="Shorter cool-down"
                increaseLabel="Longer cool-down"
                onChange={(cooldownKm) => onChange({ ...values, cooldownKm })}
              />
            </div>
          )}
        </div>
      );
    }
    case 'intervals':
      return (
        <IntervalsForm
          values={values}
          planned={planned?.kind === 'intervals' ? planned : null}
          week={week}
          onChange={onChange}
        />
      );
  }
}

type StrengthValues = Extract<WorkoutValues, { kind: 'strength' }>;
type IntervalValues = Extract<WorkoutValues, { kind: 'intervals' }>;

function StrengthForm({
  values,
  planned,
  onChange,
}: {
  values: StrengthValues;
  planned: StrengthValues | null;
  onChange: (values: WorkoutValues) => void;
}) {
  const update = (position: number, changes: Partial<StrengthExerciseValues>) =>
    onChange({
      ...values,
      exercises: values.exercises.map((e, i) => (i === position ? { ...e, ...changes } : e)),
    });
  const free = planned === null;

  return (
    <>
      {values.exercises.map((exercise, position) => {
        const plan = planned?.exercises.find((e) => e.exerciseId === exercise.exerciseId);
        const repsChanged = plan !== undefined && plan.reps !== exercise.reps;
        const kgChanged = plan !== undefined && plan.kg !== exercise.kg;
        return (
          <div className="ex" key={exercise.exerciseId}>
            <div className="r rb">
              {free ? (
                <div className="field grow">
                  <label className="lbl" htmlFor={`exercise-name-${position}`}>
                    Exercise name
                  </label>
                  <input
                    id={`exercise-name-${position}`}
                    className="inp"
                    value={exercise.name}
                    autoComplete="off"
                    onChange={(event) => update(position, { name: event.target.value })}
                  />
                </div>
              ) : (
                <span className="b">{exercise.name}</span>
              )}
              <span className="r g6">
                <EditedMark show={repsChanged || kgChanged} />
                {plan && (
                  <span className="xs muted">
                    plan {plan.reps} × {fmt(plan.kg)}
                  </span>
                )}
                {free && values.exercises.length > 1 && (
                  <button
                    type="button"
                    className="ib"
                    aria-label={`Remove ${exercise.name || 'exercise'}`}
                    onClick={() => onChange({ ...values, exercises: values.exercises.filter((_, i) => i !== position) })}
                  >
                    <Icon name="close" size="s" />
                  </button>
                )}
              </span>
            </div>
            <div className={free ? 'three' : 'two'}>
              {free && (
                <Stepper
                  label="Sets"
                  hideLabel
                  value={exercise.sets}
                  unit="sets"
                  step={1}
                  min={1}
                  decreaseLabel="One set less"
                  increaseLabel="One set more"
                  onChange={(sets) => update(position, { sets: Math.round(sets) })}
                />
              )}
              <Stepper
                label={`Reps for ${exercise.name}`}
                hideLabel
                value={exercise.reps}
                unit="reps"
                step={1}
                min={1}
                modified={repsChanged}
                decreaseLabel="One rep less"
                increaseLabel="One rep more"
                onChange={(reps) => update(position, { reps })}
              />
              <Stepper
                label={`Weight for ${exercise.name}`}
                hideLabel
                value={exercise.kg}
                unit="kg"
                step={KG_STEP}
                modified={kgChanged}
                decreaseLabel="2.5 kg less"
                increaseLabel="2.5 kg more"
                onChange={(kg) => update(position, { kg })}
              />
            </div>
            {exercise.note && <span className="sm muted">{exercise.note}</span>}
          </div>
        );
      })}
      {free && (
        <button
          type="button"
          className="btn s blk"
          onClick={() =>
            onChange({
              ...values,
              exercises: [
                ...values.exercises,
                { exerciseId: String(values.exercises.length), name: `Exercise ${values.exercises.length + 1}`, sets: 3, reps: 8, kg: 20 },
              ],
            })
          }
        >
          <Icon name="plus" size="s" />
          Add exercise
        </button>
      )}
    </>
  );
}

function IntervalsForm({
  values,
  planned,
  week,
  onChange,
}: {
  values: IntervalValues;
  planned: IntervalValues | null;
  week: number | null;
  onChange: (values: WorkoutValues) => void;
}) {
  const speedChanged = planned !== null && planned.speedKmh !== values.speedKmh;
  const countChanged = planned !== null && planned.count !== values.count;
  const distanceChanged = planned !== null && planned.distanceM !== values.distanceM;
  const restChanged = planned !== null && planned.restS !== values.restS;
  const sessionEdited = countChanged || distanceChanged || restChanged;

  return (
    <>
      <div className="ex">
        <div className="r rb">
          <span className="b">Speed</span>
          {planned && <span className="st" style={{ background: 'var(--ink)', color: 'var(--bg)' }}>All later weeks</span>}
        </div>
        <Stepper
          label="Speed"
          hideLabel
          value={values.speedKmh}
          unit="km/h"
          step={SPEED_STEP}
          modified={speedChanged}
          decreaseLabel="0.5 km/h slower"
          increaseLabel="0.5 km/h faster"
          onChange={(speedKmh) => onChange({ ...values, speedKmh })}
        />
        {planned && (
          <div className="r rb">
            <span className="xs muted">plan {fmtSpeed(planned.speedKmh)} km/h</span>
            <EditedMark show={speedChanged} />
          </div>
        )}
      </div>
      <div className="ex">
        <div className="r rb">
          <span className="b">Session</span>
          {planned && <span className="st">This session only</span>}
        </div>
        <div className="two">
          <Stepper
            label="Intervals"
            value={values.count}
            step={1}
            min={1}
            modified={countChanged}
            decreaseLabel="One fewer"
            increaseLabel="One more"
            onChange={(count) => onChange({ ...values, count: Math.round(count) })}
          />
          <Stepper
            label="Distance each"
            value={values.distanceM}
            unit="m"
            step={DISTANCE_STEP_M}
            min={50}
            modified={distanceChanged}
            decreaseLabel="Shorter"
            increaseLabel="Longer"
            onChange={(distanceM) => onChange({ ...values, distanceM })}
          />
          <Stepper
            label="Rest between"
            value={values.restS}
            unit="s"
            step={REST_STEP_S}
            modified={restChanged}
            decreaseLabel="Less rest"
            increaseLabel="More rest"
            onChange={(restS) => onChange({ ...values, restS })}
          />
          {!planned && (
            <>
              <Stepper
                label="Warm-up"
                value={values.warmupKm}
                unit="km"
                step={KM_STEP}
                decreaseLabel="Shorter warm-up"
                increaseLabel="Longer warm-up"
                onChange={(warmupKm) => onChange({ ...values, warmupKm })}
              />
              <Stepper
                label="Cool-down"
                value={values.cooldownKm}
                unit="km"
                step={KM_STEP}
                decreaseLabel="Shorter cool-down"
                increaseLabel="Longer cool-down"
                onChange={(cooldownKm) => onChange({ ...values, cooldownKm })}
              />
            </>
          )}
        </div>
        {planned && week !== null && (
          <Banner tone="info">
            {sessionEdited
              ? `Plan said ${planned.count} intervals. Count, distance and rest don’t carry forward: Draft ${planned.draft} returns as ${planned.count} × ${fmt(planned.distanceM)} m, ${fmt(planned.restS)} s in W${week + planned.draftCount}.`
              : `Count, distance and rest apply to this session only; Draft ${planned.draft} comes back unchanged in W${week + planned.draftCount}.`}
          </Banner>
        )}
      </div>
    </>
  );
}
