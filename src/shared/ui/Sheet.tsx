import type { ReactNode } from 'react';
import type { SlotType } from '../../domain/schema';
import { useFocusTrap } from '../hooks/useFocusTrap';
import { TYPE_META } from '../workout-types';
import { Icon } from './Icon';
import { TypeBadge } from './TypeBadge';

interface SheetProps {
  /** Accessible name of the dialog. */
  label: string;
  onClose: () => void;
  /** Colours the sheet in a workout type's colour. */
  type?: SlotType;
  children: ReactNode;
}

/** Bottom sheet: modal, traps focus, closes on Escape or a tap on the dimmed background. */
export function Sheet({ label, onClose, type, children }: SheetProps) {
  const containerRef = useFocusTrap(onClose);
  return (
    <>
      <div className="scrim" onClick={onClose} aria-hidden="true" />
      <div
        ref={containerRef}
        className={`sheet ${type ? TYPE_META[type].colorClass : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        tabIndex={-1}
      >
        <div className="grab" />
        {children}
      </div>
    </>
  );
}

interface SheetHeaderProps {
  type?: SlotType;
  draftBadge?: boolean;
  title: string;
  subtitle: string;
  /** Optional status pill between the title and the close button. */
  trailing?: ReactNode;
  onClose: () => void;
}

export function SheetHeader({ type, draftBadge = false, title, subtitle, trailing, onClose }: SheetHeaderProps) {
  return (
    <div className="sheet-head">
      {type && <TypeBadge type={type} draft={draftBadge} />}
      <div className="grow col g4">
        <h2 style={{ fontSize: 21, fontWeight: 700 }}>{title}</h2>
        <span className="sm muted">{subtitle}</span>
      </div>
      {trailing}
      <button type="button" className="ib" aria-label="Close" onClick={onClose}>
        <Icon name="close" />
      </button>
    </div>
  );
}
