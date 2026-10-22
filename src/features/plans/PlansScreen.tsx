import { useState } from 'react';
import type { IsoDate } from '../../domain/dates';
import type { Plan } from '../../domain/schema';
import { hrefOf } from '../../shared/router';
import { todayIso } from '../../shared/today';
import { Icon } from '../../shared/ui/Icon';
import { useToast } from '../../shared/ui/Toast';
import { TYPE_META } from '../../shared/workout-types';
import { PlanDataGate, usePlanData, type ReadyPlanData } from '../plan-data/PlanDataProvider';
import { EndPlanSheet } from './EndPlanSheet';
import { describePlan, sortPlans } from './plans-model';
import './plans.css';

export function PlansScreen() {
  return <PlanDataGate>{(data) => <Plans data={data} />}</PlanDataGate>;
}

function Plans({ data }: { data: ReadyPlanData }) {
  const today = todayIso();
  const planData = usePlanData();
  const toast = useToast();
  const [ending, setEnding] = useState<Plan | null>(null);
  const plans = sortPlans(data.plans, today);

  const endPlan = async (plan: Plan, endedOn: IsoDate) => {
    if (!(await planData.savePlan({ ...plan, endedOn }))) return;
    setEnding(null);
    toast.show({
      message: `“${plan.name}” ended`,
      action: { label: 'Undo', run: () => void planData.savePlan(plan) },
    });
  };

  return (
    <>
      <div className="top">
        <div className="grow col g4">
          <span className="sm muted">{plans.length === 1 ? '1 plan' : `${plans.length} plans`}</span>
          <h1 className="title">Plans</h1>
        </div>
        <a className="btn p" href={hrefOf({ name: 'plan-new' })} style={{ minHeight: 46 }}>
          <Icon name="plus" size="s" />
          New plan
        </a>
      </div>
      <div className="scroll" style={{ paddingTop: 6 }}>
        {plans.length === 0 && (
          <div className="card col g10 c" style={{ alignItems: 'center', padding: '22px 16px' }}>
            <h2 style={{ fontSize: 18, fontWeight: 700 }}>No plans yet</h2>
            <p className="sm muted" style={{ textWrap: 'pretty' }}>
              Create a plan to get progressive weekly drafts, or load the demo plan in Settings.
            </p>
          </div>
        )}
        {plans.map((plan) => (
          <PlanCard
            key={plan.id}
            plan={plan}
            data={data}
            today={today}
            onEnd={() => setEnding(plan)}
          />
        ))}
      </div>
      {ending && (
        <EndPlanSheet
          plan={ending}
          data={data}
          today={today}
          subtitle={describePlan(ending, today, data.overrides).span}
          onCancel={() => setEnding(null)}
          onEnd={(endedOn) => endPlan(ending, endedOn)}
        />
      )}
    </>
  );
}

function PlanCard({ plan, data, today, onEnd }: { plan: Plan; data: ReadyPlanData; today: IsoDate; onEnd: () => void }) {
  const info = describePlan(plan, today, data.overrides);
  const active = info.status === 'active';
  return (
    <section className={active ? 'pl current' : 'pl off'}>
      <div className="r rb">
        <h2 style={{ fontSize: 19, fontWeight: 700 }}>{plan.name}</h2>
        {active ? (
          <span className="st done">
            <i className="live" />
            Active
          </span>
        ) : (
          <span className="st">Ended</span>
        )}
      </div>
      <div className="col g4">
        <span className="sm muted">{info.span}</span>
        <span className="sm muted">{info.detail}</span>
      </div>
      <div className="mix" role="img" aria-label={`Weekly mix: ${info.strength} strength, ${info.running} running`}>
        {plan.slots.map((slot) => {
          const meta = TYPE_META[slot.type];
          return (
            <i
              key={slot.id}
              style={{ background: `var(--t-${meta.colorClass.slice(2)})`, borderRadius: meta.shape === 'square' ? 3 : '50%' }}
            />
          );
        })}
        <span className="xs muted" style={{ marginLeft: 4 }}>
          {info.strength} strength · {info.running} running
        </span>
      </div>
      <div className="r g8">
        {active ? (
          <>
            <a className="btn s grow" href={hrefOf({ name: 'plan-edit', planId: plan.id })} style={{ minHeight: 46 }}>
              <Icon name="edit" size="s" />
              Edit plan
            </a>
            <button type="button" className="ib o" style={{ height: 46 }} aria-label={`End ${plan.name}`} onClick={onEnd}>
              <Icon name="more" />
            </button>
          </>
        ) : (
          <a className="btn s grow" href={hrefOf({ name: 'plan-new', fromPlanId: plan.id })} style={{ minHeight: 46 }}>
            <Icon name="copy" size="s" />
            Duplicate as new plan
          </a>
        )}
      </div>
    </section>
  );
}
