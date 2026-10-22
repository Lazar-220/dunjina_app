import { useId, useState } from 'react';
import { roundValue } from '../../domain/progression';
import { Icon } from './Icon';

interface StepperProps {
  label: string;
  /** Visually hide the label (it still names the control for screen readers). */
  hideLabel?: boolean;
  value: number;
  unit?: string;
  /** Shown before the value, e.g. "+" for a step size. */
  prefix?: string;
  step: number;
  min?: number;
  onChange: (value: number) => void;
  /** Outline the control when the value differs from the plan. */
  modified?: boolean;
  tone?: 'warn' | 'err';
  decreaseLabel: string;
  increaseLabel: string;
}

const formatValue = (value: number): string => String(roundValue(value));

export function Stepper({
  label,
  hideLabel = false,
  value,
  unit,
  prefix,
  step,
  min = 0,
  onChange,
  modified = false,
  tone,
  decreaseLabel,
  increaseLabel,
}: StepperProps) {
  const labelId = useId();
  const [text, setText] = useState<string | null>(null);
  const shown = text ?? formatValue(value);

  const commit = (next: number) => {
    setText(null);
    onChange(roundValue(Math.max(min, next)));
  };

  const onType = (typed: string) => {
    setText(typed);
    const parsed = Number(typed.replace(',', '.'));
    if (typed.trim() !== '' && Number.isFinite(parsed) && parsed >= min) onChange(roundValue(parsed));
  };

  const classes = ['step', modified && 'mod', tone].filter(Boolean).join(' ');
  return (
    <div className="field">
      <span id={labelId} className={hideLabel ? 'sr-only' : 'lbl'}>
        {label}
      </span>
      <div className={classes}>
        <button type="button" aria-label={decreaseLabel} onClick={() => commit(value - step)}>
          <Icon name="minus" size="s" />
        </button>
        <span className="v">
          {prefix && <span className="u">{prefix}</span>}
          <input
            inputMode="decimal"
            autoComplete="off"
            aria-labelledby={labelId}
            value={shown}
            style={{ width: `${Math.max(shown.length, 1) + 0.6}ch` }}
            onChange={(event) => onType(event.target.value)}
            onBlur={() => setText(null)}
          />
          {unit && <span className="u">{unit}</span>}
        </span>
        <button type="button" aria-label={increaseLabel} onClick={() => commit(value + step)}>
          <Icon name="plus" size="s" />
        </button>
      </div>
    </div>
  );
}
