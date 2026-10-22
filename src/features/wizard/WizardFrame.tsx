import type { ReactNode } from 'react';
import { Icon } from '../../shared/ui/Icon';
import './wizard.css';

interface WizardFrameProps {
  title: string;
  /** 1-4 */
  stepNumber: number;
  onBack: () => void;
  /** Accessible name of the arrow in the header. */
  backLabel: string;
  /** Chips for the slots, shown between the progress bars and the content. */
  slotBar?: ReactNode;
  footer: ReactNode;
  children: ReactNode;
}

const TOTAL_STEPS = 4;

export function WizardFrame({ title, stepNumber, onBack, backLabel, slotBar, footer, children }: WizardFrameProps) {
  return (
    <>
      <div className="wz">
        <button type="button" className="ib" aria-label={backLabel} onClick={onBack}>
          <Icon name="back" />
        </button>
        <span className="b grow">{title}</span>
        <span className="sm muted" style={{ paddingRight: 8 }}>
          Step {stepNumber} of {TOTAL_STEPS}
        </span>
      </div>
      <div
        className="bars"
        role="progressbar"
        aria-label="Progress"
        aria-valuemin={1}
        aria-valuemax={TOTAL_STEPS}
        aria-valuenow={stepNumber}
      >
        {Array.from({ length: TOTAL_STEPS }, (_, i) => (
          <i key={i} className={i < stepNumber ? 'on' : undefined} />
        ))}
      </div>
      {slotBar}
      <div className="scroll" style={{ paddingTop: slotBar ? 10 : 18, gap: 14 }}>
        {children}
      </div>
      <div className="foot">{footer}</div>
    </>
  );
}
