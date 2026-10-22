import Dexie, { type EntityTable, type Table } from 'dexie';
import type { z } from 'zod';
import { oneOffSchema, overrideSchema, planSchema, type OneOff, type Override, type Plan } from '../domain/schema';
import type { BackupData } from './backup';
import { StoredDataError, type Repository } from './repository';
import { DEFAULT_SETTINGS, settingsSchema, type Settings } from './settings';

const SETTINGS_KEY = 'app';

interface SettingsRow extends Settings {
  key: string;
}

class PlannerDatabase extends Dexie {
  declare plans: EntityTable<Plan, 'id'>;
  declare overrides: Table<Override, [string, string, number]>;
  declare oneOffs: EntityTable<OneOff, 'id'>;
  declare settings: EntityTable<SettingsRow, 'key'>;

  constructor(name: string) {
    super(name);
    this.version(1).stores({
      plans: 'id',
      overrides: '[planId+slotId+week], planId',
      oneOffs: 'id, date',
      settings: 'key',
    });
  }
}

/** Parses rows read from IndexedDB; the database is an external boundary, so its contents are not trusted. */
function parseRows<T>(table: string, schema: z.ZodType<T>, rows: unknown[]): T[] {
  return rows.map((row) => {
    const result = schema.safeParse(row);
    if (!result.success) {
      throw new StoredDataError(table, result.error.issues[0]?.message ?? 'invalid row');
    }
    return result.data;
  });
}

export function createDexieRepository(databaseName = 'training-planner'): Repository {
  const db = new PlannerDatabase(databaseName);

  const readAll = async (): Promise<BackupData> => ({
    plans: parseRows('plans', planSchema, await db.plans.toArray()),
    overrides: parseRows('changes', overrideSchema, await db.overrides.toArray()),
    oneOffs: parseRows('one-off workouts', oneOffSchema, await db.oneOffs.toArray()),
  });

  return {
    async listPlans() {
      return parseRows('plans', planSchema, await db.plans.toArray());
    },
    async savePlan(plan, dropOverridesOfSlots = []) {
      await db.transaction('rw', db.plans, db.overrides, async () => {
        await db.plans.put(plan);
        const removed = new Set(dropOverridesOfSlots);
        if (removed.size > 0) {
          await db.overrides
            .where('planId')
            .equals(plan.id)
            .filter((override) => removed.has(override.slotId))
            .delete();
        }
      });
    },

    async listOverrides(planId) {
      return parseRows('changes', overrideSchema, await db.overrides.where('planId').equals(planId).toArray());
    },
    async saveOverride(override) {
      await db.overrides.put(override);
    },
    async removeOverride(planId, slotId, week) {
      await db.overrides.delete([planId, slotId, week]);
    },
    async saveOverrides(overrides) {
      await db.overrides.bulkPut([...overrides]);
    },
    async removeOverrides(keys) {
      await db.overrides.bulkDelete(keys.map(({ planId, slotId, week }): [string, string, number] => [planId, slotId, week]));
    },

    async listOneOffs() {
      return parseRows('one-off workouts', oneOffSchema, await db.oneOffs.toArray());
    },
    async saveOneOff(oneOff) {
      await db.oneOffs.put(oneOff);
    },
    async removeOneOff(id) {
      await db.oneOffs.delete(id);
    },

    async getSettings() {
      const row = await db.settings.get(SETTINGS_KEY);
      if (!row) return DEFAULT_SETTINGS;
      const [settings] = parseRows('settings', settingsSchema, [row]);
      return settings ?? DEFAULT_SETTINGS;
    },
    async saveSettings(settings) {
      await db.settings.put({ key: SETTINGS_KEY, ...settings });
    },

    readAll,
    async replaceAll(data) {
      await db.transaction('rw', db.plans, db.overrides, db.oneOffs, async () => {
        await Promise.all([db.plans.clear(), db.overrides.clear(), db.oneOffs.clear()]);
        await db.plans.bulkAdd(data.plans);
        await db.overrides.bulkAdd(data.overrides);
        await db.oneOffs.bulkAdd(data.oneOffs);
      });
    },
  };
}
