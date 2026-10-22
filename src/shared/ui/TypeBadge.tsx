import type { SlotType } from '../../domain/schema';
import { TYPE_META } from '../workout-types';

interface TypeBadgeProps {
  type: SlotType;
  /** Dashed outline marks a draft. */
  draft?: boolean;
  small?: boolean;
}

export function TypeBadge({ type, draft = false, small = false }: TypeBadgeProps) {
  const meta = TYPE_META[type];
  const classes = ['badge', meta.shape === 'square' && 'sq', small && 'sm', draft && 'draft'].filter(Boolean).join(' ');
  return (
    <span className={`${meta.colorClass}`}>
      <span className={classes} aria-hidden="true">
        {meta.code}
      </span>
    </span>
  );
}
