import type { OneOff, Override, Plan } from '../domain/schema';
import type { BackupData } from './backup';
import type { Settings } from './settings';

/** All persistence goes through this interface; the UI never touches the database directly. */
export interface Repository {
  listPlans(): Promise<Plan[]>;
  savePlan(plan: Plan): Promise<void>;

  listOverrides(planId: string): Promise<Override[]>;
  saveOverride(override: Override): Promise<void>;
  removeOverride(planId: string, slotId: string, week: number): Promise<void>;

  listOneOffs(): Promise<OneOff[]>;
  saveOneOff(oneOff: OneOff): Promise<void>;
  removeOneOff(id: string): Promise<void>;

  getSettings(): Promise<Settings>;
  saveSettings(settings: Settings): Promise<void>;

  readAll(): Promise<BackupData>;
  /** Replaces plans, overrides and one-offs in one transaction: on any failure nothing changes. */
  replaceAll(data: BackupData): Promise<void>;
}

/** Stored rows that no longer match the schema (manual tampering, a bug, a half-finished migration). */
export class StoredDataError extends Error {
  constructor(readonly table: string, detail: string) {
    super(
      `Saved ${table} on this device are unreadable (${detail}). Import a backup to restore your data.`,
    );
    this.name = 'StoredDataError';
  }
}
