import type { SlotType } from '../../domain/schema';
import { TYPE_META } from '../workout-types';
import { Icon } from './Icon';
import { TypeBadge } from './TypeBadge';

/** draft: generated; confirmed: edited or moved; done: logged. */
export type RowStatus = 'draft' | 'confirmed' | 'done';

interface WorkoutRowProps {
  type: SlotType;
  title: string;
  detail: string;
  status: RowStatus;
  edited: boolean;
  onOpen: () => void;
  /** Show a "Done"/"Draft" pill on the right (agenda list) instead of a check beside the name (week list). */
  statusPill?: boolean;
  /** Render the row dimmed (days in the past). */
  muted?: boolean;
  /** Extra action button, e.g. "More actions for Easy run". */
  menu?: { label: string; onClick: () => void };
}

export function WorkoutRow({ type, title, detail, status, edited, onOpen, statusPill = false, muted = false, menu }: WorkoutRowProps) {
  const classes = ['wk', TYPE_META[type].colorClass, status !== 'confirmed' && status, muted && 'past']
    .filter(Boolean)
    .join(' ');
  return (
    <div className={classes}>
      <button type="button" className="wk-main" onClick={onOpen}>
        <TypeBadge type={type} draft={status === 'draft'} />
        <span className="grow col">
          <span className="nm r g6">
            {title}
            {!statusPill && status === 'done' && <Icon name="check" size="xs" />}
            {edited && <span className="mod">edited</span>}
          </span>
          <span className="ds ell">{detail}</span>
        </span>
        {statusPill && status === 'done' && (
          <span className="st done">
            <Icon name="check" size="xs" />
            Done
          </span>
        )}
        {statusPill && status === 'draft' && <span className="st draft">Draft</span>}
      </button>
      {menu && (
        <button type="button" className="ib" aria-label={menu.label} onClick={menu.onClick}>
          <Icon name="more" />
        </button>
      )}
    </div>
  );
}
