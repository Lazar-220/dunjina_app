import { useState } from 'react';
import { formatDayShort, isValidIsoDate, type IsoDate } from '../../domain/dates';
import type { SlotType } from '../../domain/schema';
import { Banner } from '../../shared/ui/Banner';
import { Icon } from '../../shared/ui/Icon';
import { Sheet } from '../../shared/ui/Sheet';
import { TypeBadge } from '../../shared/ui/TypeBadge';
import { SLOT_TYPES, TYPE_META } from '../../shared/workout-types';

interface AddWorkoutSheetProps {
  initialDate: IsoDate;
  /** Titles of workouts already planned on a date, to mention a rest day or a busy day. */
  titlesOn: (date: IsoDate, excludeKey?: string) => string[];
  onCancel: () => void;
  onAdd: (type: SlotType, date: IsoDate) => Promise<void>;
}

export function AddWorkoutSheet({ initialDate, titlesOn, onCancel, onAdd }: AddWorkoutSheetProps) {
  const [date, setDate] = useState(initialDate);
  const [saving, setSaving] = useState(false);
  const existing = titlesOn(date);

  const add = async (type: SlotType) => {
    setSaving(true);
    try {
      await onAdd(type, date);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet label="Add workout" onClose={onCancel}>
      <div className="sheet-head">
        <h2 className="grow" style={{ fontSize: 22, fontWeight: 700 }}>
          Add workout
        </h2>
        <button type="button" className="ib" aria-label="Close" onClick={onCancel}>
          <Icon name="close" />
        </button>
      </div>
      <div className="field">
        <label className="lbl" htmlFor="add-date">
          Date · {formatDayShort(date)}
          {existing.length === 0 ? ' · rest day' : ''}
        </label>
        <input
          id="add-date"
          type="date"
          className="inp"
          value={date}
          onChange={(event) => {
            if (isValidIsoDate(event.target.value)) setDate(event.target.value);
          }}
        />
      </div>
      <div className="sec">Type</div>
      <div className="two">
        {SLOT_TYPES.map((type) => {
          const meta = TYPE_META[type];
          return (
            <button
              key={type}
              type="button"
              className={`wk ${meta.colorClass}`}
              style={{ minHeight: 68 }}
              disabled={saving}
              onClick={() => void add(type)}
            >
              <TypeBadge type={type} small />
              <span className="grow col">
                <span className="nm">{meta.name}</span>
                <span className="ds">{meta.group}</span>
              </span>
            </button>
          );
        })}
      </div>
      <Banner tone="info">
        One-off workouts sit outside the plan and never change its progression. To adjust a plan slot, edit its draft in
        Weeks.
      </Banner>
    </Sheet>
  );
}
