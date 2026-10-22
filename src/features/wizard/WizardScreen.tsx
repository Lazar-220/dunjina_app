import { useMemo, useState } from 'react';
import { addDays, type Weekday } from '../../domain/dates';
import { findActivePlan, isPlanActive } from '../../domain/plans';
import type { Plan, Slot, SlotType } from '../../domain/schema';
import { hasErrors, validatePlanEnd, type Issue } from '../../domain/validation';
import { newId } from '../../shared/ids';
import { hrefOf, navigate, type Route } from '../../shared/router';
import { todayIso } from '../../shared/today';
import { Banner } from '../../shared/ui/Banner';
import { Icon } from '../../shared/ui/Icon';
import { useToast } from '../../shared/ui/Toast';
import { PlanDataGate, usePlanData, type ReadyPlanData } from '../plan-data/PlanDataProvider';
import { StepBasics } from './StepBasics';
import { StepReview } from './StepReview';
import { SlotBar, StepSlots } from './StepSlots';
import { StepStructure } from './StepStructure';
import { WizardFrame } from './WizardFrame';
import {
  canAdvance,
  draftFromPlan,
  duplicateDraft,
  emptyDraft,
  newSlot,
  slotNames,
  stepIssues,
  toPlan,
  type WizardDraft,
  type WizardStep,
} from './wizard-model';

type WizardRoute = Extract<Route, { name: 'plan-new' | 'plan-edit' }>;

const DEFAULT_PLAN_WEEKS = 12;

export function WizardScreen({ route }: { route: WizardRoute }) {
  return <PlanDataGate>{(data) => <WizardEntry data={data} route={route} />}</PlanDataGate>;
}

function Notice({ title, message }: { title: string; message: string }) {
  return (
    <div className="scroll" style={{ justifyContent: 'center' }}>
      <div className="card col g12">
        <h1 style={{ fontSize: 21, fontWeight: 700 }}>{title}</h1>
        <Banner tone="info">{message}</Banner>
        <a className="btn p blk" href={hrefOf({ name: 'plans' })}>
          Go to Plans
        </a>
      </div>
    </div>
  );
}

/** Decides what the wizard may do before showing it: a new plan needs no active plan; only an active plan can be edited. */
function WizardEntry({ data, route }: { data: ReadyPlanData; route: WizardRoute }) {
  const today = todayIso();
  const active = findActivePlan(data.plans, today);

  if (route.name === 'plan-new') {
    if (active) {
      return (
        <Notice
          title="You already have an active plan"
          message={`Only one plan can be active at a time. End “${active.name}” in Plans first, then create the new one.`}
        />
      );
    }
    const source = route.fromPlanId ? data.plans.find((p) => p.id === route.fromPlanId) : undefined;
    const initial = source ? duplicateDraft(source, today, newId) : emptyDraft(today);
    return <Wizard data={data} initial={initial} plan={null} />;
  }

  const plan = data.plans.find((p) => p.id === route.planId);
  if (!plan) return <Notice title="Plan not found" message="This plan no longer exists on this device." />;
  if (!isPlanActive(plan, today)) {
    return (
      <Notice
        title="This plan has ended"
        message="An ended plan can’t be edited or restarted. Duplicate it as a new plan from the Plans tab."
      />
    );
  }
  return <Wizard data={data} initial={draftFromPlan(plan)} plan={plan} />;
}

interface WizardProps {
  data: ReadyPlanData;
  initial: WizardDraft;
  /** The plan being edited, or null when creating one. */
  plan: Plan | null;
}

function Wizard({ data, initial, plan }: WizardProps) {
  const { savePlan } = usePlanData();
  const toast = useToast();
  const [draft, setDraft] = useState(initial);
  const [step, setStep] = useState<WizardStep>(plan ? 'structure' : 'basics');
  const [slotIndex, setSlotIndex] = useState(0);
  const [visited, setVisited] = useState<ReadonlySet<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const editing = plan !== null;
  const title = editing ? 'Edit plan' : 'New plan';
  const doneSlotIds = useMemo(
    () => new Set(data.overrides.filter((o) => o.planId === plan?.id && o.done).map((o) => o.slotId)),
    [data.overrides, plan?.id],
  );

  const basicsIssues = useMemo<Issue[]>(() => {
    const issues = [...stepIssues(draft, 'basics')];
    if (plan && draft.endDate !== null) issues.push(...validatePlanEnd(plan, data.index, draft.endDate));
    return issues;
  }, [draft, plan, data.index]);

  const currentSlot = draft.slots[slotIndex];
  const goTo = (next: WizardStep) => {
    setStep(next);
    if (next === 'slots') {
      const first = draft.slots[Math.min(slotIndex, draft.slots.length - 1)];
      if (first) setVisited((seen) => new Set(seen).add(first.id));
    }
  };

  const selectSlot = (index: number) => {
    setSlotIndex(index);
    const slot = draft.slots[index];
    if (slot) setVisited((seen) => new Set(seen).add(slot.id));
  };

  const updateSlot = (updated: Slot) =>
    setDraft((current) => ({ ...current, slots: current.slots.map((s) => (s.id === updated.id ? updated : s)) }));

  const addSlot = (type: SlotType) => setDraft((current) => ({ ...current, slots: [...current.slots, newSlot(type, current.slots, newId)] }));

  const removeSlot = (slot: Slot) => {
    setDraft((current) => ({ ...current, slots: current.slots.filter((s) => s.id !== slot.id) }));
    setSlotIndex(0);
  };

  const setWeekday = (slot: Slot, weekday: Weekday | null) => updateSlot({ ...slot, defaultWeekday: weekday });

  const removalBlockedReason = (slot: Slot): string | null =>
    doneSlotIds.has(slot.id) ? 'Has done workouts, so it can’t be removed.' : null;

  const save = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      const saved = toPlan(draft, plan?.id ?? newId(), plan?.endedOn ?? null);
      const keptSlotIds = new Set(saved.slots.map((s) => s.id));
      const removedSlotIds = plan ? plan.slots.filter((s) => !keptSlotIds.has(s.id)).map((s) => s.id) : [];
      await savePlan(saved, removedSlotIds);
      toast.show({ message: editing ? 'Plan saved' : 'Plan created' });
      navigate({ name: 'calendar' });
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : String(error));
      setSaving(false);
    }
  };

  const cancelHref = hrefOf({ name: 'plans' });
  const nextSlot = draft.slots[slotIndex + 1];

  if (step === 'basics') {
    const suggestedEnd = addDays(draft.startDate, 7 * DEFAULT_PLAN_WEEKS - 1);
    return (
      <WizardFrame
        title={title}
        stepNumber={1}
        backLabel="Back to Plans"
        onBack={() => navigate({ name: 'plans' })}
        footer={
          <>
            <a className="btn s" href={cancelHref} style={{ minWidth: 96 }}>
              Cancel
            </a>
            <button type="button" className="btn p" disabled={hasErrors(basicsIssues)} onClick={() => goTo('structure')}>
              Next: weekly structure
            </button>
          </>
        }
      >
        <StepBasics draft={draft} onChange={setDraft} issues={basicsIssues} startDateLocked={editing} suggestedEndDate={suggestedEnd} />
      </WizardFrame>
    );
  }

  if (step === 'structure') {
    return (
      <WizardFrame
        title={title}
        stepNumber={2}
        backLabel="Previous step"
        onBack={() => goTo('basics')}
        footer={
          <>
            <button type="button" className="btn s" style={{ minWidth: 96 }} onClick={() => goTo('basics')}>
              Back
            </button>
            <button type="button" className="btn p" disabled={!canAdvance(draft, 'structure')} onClick={() => goTo('slots')}>
              Next: configure slots
            </button>
          </>
        }
      >
        <StepStructure slots={draft.slots} onAdd={addSlot} onRemove={removeSlot} onWeekday={setWeekday} removalBlockedReason={removalBlockedReason} />
      </WizardFrame>
    );
  }

  if (step === 'slots' && currentSlot) {
    const slotBlocked = !canAdvance({ ...draft, slots: [currentSlot] }, 'slots');
    const names = slotNames(draft.slots);
    return (
      <WizardFrame
        title={title}
        stepNumber={3}
        backLabel="Previous step"
        onBack={() => (slotIndex > 0 ? selectSlot(slotIndex - 1) : goTo('structure'))}
        slotBar={<SlotBar slots={draft.slots} currentIndex={slotIndex} visited={visited} onSelect={selectSlot} />}
        footer={
          <>
            <button type="button" className="btn s" style={{ minWidth: 96 }} onClick={() => (slotIndex > 0 ? selectSlot(slotIndex - 1) : goTo('structure'))}>
              Back
            </button>
            <button
              type="button"
              className="btn p"
              disabled={slotBlocked}
              onClick={() => (nextSlot ? selectSlot(slotIndex + 1) : goTo('review'))}
            >
              {nextSlot ? `Next slot: ${names.get(nextSlot.id) ?? ''}` : 'Review plan'}
            </button>
          </>
        }
      >
        <StepSlots draft={draft} slot={currentSlot} position={slotIndex} onChange={updateSlot} />
      </WizardFrame>
    );
  }

  return (
    <WizardFrame
      title={title}
      stepNumber={4}
      backLabel="Previous step"
      onBack={() => goTo('slots')}
      footer={
        <>
          <button type="button" className="btn s" style={{ minWidth: 96 }} onClick={() => goTo('slots')}>
            Back
          </button>
          <button type="button" className="btn p" disabled={saving} onClick={() => void save()}>
            <Icon name="check" size="s" />
            {editing ? 'Save changes' : 'Save plan'}
          </button>
        </>
      }
    >
      {saveError && <Banner tone="err">Couldn’t save the plan. {saveError}</Banner>}
      <StepReview
        draft={draft}
        onEditSlot={(index) => {
          setSlotIndex(index);
          goTo('slots');
        }}
      />
    </WizardFrame>
  );
}
