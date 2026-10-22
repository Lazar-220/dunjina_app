import type { Slot } from '../../domain/schema';
import { Icon } from '../../shared/ui/Icon';
import { TYPE_META } from '../../shared/workout-types';
import { IntervalsEditor, RunEditor, StrengthEditor } from './SlotEditors';
import { slotIssues, slotNames, type WizardDraft } from './wizard-model';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

interface SlotBarProps {
  slots: readonly Slot[];
  currentIndex: number;
  visited: ReadonlySet<string>;
  onSelect: (index: number) => void;
}

/** Chips to jump between slots; a check marks slots already looked at, a warning marks unusual values. */
export function SlotBar({ slots, currentIndex, visited, onSelect }: SlotBarProps) {
  const names = slotNames(slots);
  return (
    <div className="slots" style={{ paddingTop: 14 }}>
      {slots.map((slot, index) => {
        const meta = TYPE_META[slot.type];
        const hasWarning = slotIssues(slot).some((issue) => issue.severity === 'warning');
        const name = names.get(slot.id) ?? meta.name;
        return (
          <button
            key={slot.id}
            type="button"
            className={`sl ${meta.colorClass}${index === currentIndex ? ' on' : ''}`}
            aria-current={index === currentIndex ? 'step' : undefined}
            onClick={() => onSelect(index)}
          >
            <span className={meta.shape === 'square' ? 'mini sq' : 'mini'} aria-hidden="true">
              {meta.code}
            </span>
            {name.replace(' body', '').replace(' run', '')}
            {hasWarning ? (
              <span style={{ color: 'var(--warn-ink)', display: 'inline-flex' }} role="img" aria-label="Has a warning">
                <Icon name="warning" size="xs" />
              </span>
            ) : (
              visited.has(slot.id) && index !== currentIndex && (
                <span role="img" aria-label="Checked" style={{ display: 'inline-flex' }}>
                  <Icon name="check" size="xs" />
                </span>
              )
            )}
          </button>
        );
      })}
    </div>
  );
}

interface StepSlotsProps {
  draft: WizardDraft;
  slot: Slot;
  position: number;
  onChange: (slot: Slot) => void;
}

export function StepSlots({ draft, slot, position, onChange }: StepSlotsProps) {
  const names = slotNames(draft.slots);
  const day = slot.defaultWeekday === null ? 'no day' : (WEEKDAYS[slot.defaultWeekday] ?? '');
  return (
    <>
      <div className="r rb">
        <h1 style={{ fontSize: 22, fontWeight: 700 }}>{names.get(slot.id) ?? TYPE_META[slot.type].name}</h1>
        <span className="sm muted">
          Slot {position + 1} of {draft.slots.length} · {day}
        </span>
      </div>
      {(slot.type === 'lower' || slot.type === 'upper') && <StrengthEditor key={slot.id} slot={slot} draft={draft} onChange={onChange} />}
      {(slot.type === 'easy' || slot.type === 'long' || slot.type === 'tempo') && (
        <RunEditor key={slot.id} slot={slot} draft={draft} onChange={onChange} />
      )}
      {slot.type === 'intervals' && <IntervalsEditor key={slot.id} slot={slot} draft={draft} onChange={onChange} />}
    </>
  );
}
