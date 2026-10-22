import type { SlotType } from '../domain/schema';

export interface TypeMeta {
  code: string;
  name: string;
  /** Strength is a rounded square, running a circle; colour is never the only signal. */
  shape: 'square' | 'circle';
  /** Class that sets the --c colour variable. */
  colorClass: string;
  group: 'Strength' | 'Running';
}

export const TYPE_META: Record<SlotType, TypeMeta> = {
  lower: { code: 'LO', name: 'Lower body', shape: 'square', colorClass: 't-lo', group: 'Strength' },
  upper: { code: 'UP', name: 'Upper body', shape: 'square', colorClass: 't-up', group: 'Strength' },
  easy: { code: 'EZ', name: 'Easy run', shape: 'circle', colorClass: 't-ez', group: 'Running' },
  long: { code: 'LR', name: 'Long run', shape: 'circle', colorClass: 't-lr', group: 'Running' },
  tempo: { code: 'TP', name: 'Tempo', shape: 'circle', colorClass: 't-tp', group: 'Running' },
  intervals: { code: 'IV', name: 'Intervals', shape: 'circle', colorClass: 't-iv', group: 'Running' },
};

export const SLOT_TYPES = Object.keys(TYPE_META) as SlotType[];
