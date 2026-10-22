import { useId, type ReactNode } from 'react';
import { useFocusTrap } from '../hooks/useFocusTrap';

interface DialogProps {
  title: string;
  /** Called on Escape and on the Cancel path; must be safe (never confirms the action). */
  onClose: () => void;
  children: ReactNode;
}

export function Dialog({ title, onClose, children }: DialogProps) {
  const titleId = useId();
  const containerRef = useFocusTrap(onClose);
  return (
    <div className="scrim center">
      <div ref={containerRef} className="dlg" role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}>
        <h2 id={titleId}>{title}</h2>
        {children}
      </div>
    </div>
  );
}
