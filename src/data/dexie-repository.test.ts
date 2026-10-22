import Dexie from 'dexie';
import { createDemoPlan } from '../domain/demo-plan';
import type { OneOff, Override } from '../domain/schema';
import { parseBackup, serializeBackup, type BackupData } from './backup';
import { createDexieRepository } from './dexie-repository';
import { StoredDataError, type Repository } from './repository';
import { DEFAULT_SETTINGS } from './settings';

let counter = 0;
const newId = () => `id-${++counter}`;
let databaseName = '';
let repository: Repository;

beforeEach(() => {
  databaseName = `test-db-${newId()}`;
  repository = createDexieRepository(databaseName);
});

afterEach(async () => {
  await Dexie.delete(databaseName);
});

function sampleData(): BackupData {
  const plan = createDemoPlan('2026-10-19', newId);
  const slot = plan.slots[2];
  if (!slot) throw new Error('Demo plan too small.');
  const overrides: Override[] = [{ planId: plan.id, slotId: slot.id, week: 2, done: true, values: { kind: 'run', km: 7 } }];
  const oneOffs: OneOff[] = [{ id: 'one', date: '2026-10-24', type: 'easy', done: false, details: { kind: 'run', km: 5 } }];
  return { plans: [plan], overrides, oneOffs };
}

describe('Dexie repository', () => {
  it('starts empty with default settings', async () => {
    expect(await repository.readAll()).toEqual({ plans: [], overrides: [], oneOffs: [] });
    expect(await repository.getSettings()).toEqual(DEFAULT_SETTINGS);
  });

  it('saves, lists, updates and removes plans, overrides and one-offs', async () => {
    const data = sampleData();
    const [plan] = data.plans;
    const [override] = data.overrides;
    const [oneOff] = data.oneOffs;
    if (!plan || !override || !oneOff) throw new Error('Incomplete sample.');

    await repository.savePlan(plan);
    await repository.saveOverride(override);
    await repository.saveOverride({ ...override, week: 3, date: '2026-11-05' });
    await repository.saveOneOff(oneOff);

    expect(await repository.listPlans()).toEqual([plan]);
    expect((await repository.listOverrides(plan.id)).map((o) => o.week).sort()).toEqual([2, 3]);
    expect(await repository.listOverrides('another-plan')).toEqual([]);
    expect(await repository.listOneOffs()).toEqual([oneOff]);

    await repository.saveOverride({ ...override, values: { kind: 'run', km: 9 } });
    expect((await repository.listOverrides(plan.id)).find((o) => o.week === 2)?.values).toEqual({ kind: 'run', km: 9 });

    await repository.removeOverride(plan.id, override.slotId, 2);
    expect((await repository.listOverrides(plan.id)).map((o) => o.week)).toEqual([3]);
    await repository.removeOneOff(oneOff.id);
    expect(await repository.listOneOffs()).toEqual([]);
  });

  it('drops saved edits of removed slots together with the plan update', async () => {
    const data = sampleData();
    const [plan] = data.plans;
    const [override] = data.overrides;
    if (!plan || !override) throw new Error('Incomplete sample.');
    await repository.replaceAll(data);
    const other = { ...override, slotId: plan.slots[0]?.id ?? 'missing', week: 4, date: '2026-11-09' };
    await repository.saveOverride(other);

    await repository.savePlan({ ...plan, name: 'Renamed' }, [override.slotId]);

    expect((await repository.listPlans())[0]?.name).toBe('Renamed');
    expect((await repository.listOverrides(plan.id)).map((o) => o.slotId)).toEqual([other.slotId]);
  });

  it('saves and removes several overrides at once', async () => {
    const data = sampleData();
    const [plan] = data.plans;
    const [first] = data.overrides;
    if (!plan || !first) throw new Error('Incomplete sample.');
    const more = [2, 3, 4].map((week) => ({ ...first, week, done: undefined, values: undefined, date: '2026-11-0' + week }));
    await repository.saveOverrides(more);
    expect((await repository.listOverrides(plan.id)).map((o) => o.week).sort()).toEqual([2, 3, 4]);

    await repository.removeOverrides([more[0], more[2]].flatMap((o) => (o ? [o] : [])));
    expect((await repository.listOverrides(plan.id)).map((o) => o.week)).toEqual([3]);
  });

  it('persists settings', async () => {
    await repository.saveSettings({ theme: 'dark', lastBackupDate: '2026-10-22' });
    expect(await repository.getSettings()).toEqual({ theme: 'dark', lastBackupDate: '2026-10-22' });
  });

  it('reports unreadable stored rows with an actionable error', async () => {
    const [plan] = sampleData().plans;
    if (!plan) throw new Error('No plan.');
    await repository.savePlan(plan);
    const raw = new Dexie(databaseName);
    raw.version(1).stores({ plans: 'id', overrides: '[planId+slotId+week], planId', oneOffs: 'id, date', settings: 'key' });
    await raw.table('plans').put({ id: 'broken', name: 'Broken' });
    raw.close();
    await expect(repository.listPlans()).rejects.toBeInstanceOf(StoredDataError);
    await expect(repository.listPlans()).rejects.toThrow('Import a backup to restore your data');
  });
});

describe('export and import through the repository', () => {
  it('restores exactly what was exported', async () => {
    const data = sampleData();
    await repository.replaceAll(data);
    const text = serializeBackup(await repository.readAll(), '2026-10-22');

    const other = createDexieRepository(`${databaseName}-other`);
    const parsed = parseBackup(text);
    if (!parsed.ok) throw new Error('Export should be importable.');
    await other.replaceAll(parsed.backup);
    expect(await other.readAll()).toEqual(data);
    await Dexie.delete(`${databaseName}-other`);
  });

  it('replaces existing data instead of merging', async () => {
    await repository.replaceAll(sampleData());
    const replacement = sampleData();
    await repository.replaceAll(replacement);
    const stored = await repository.readAll();
    expect(stored.plans.map((p) => p.id)).toEqual(replacement.plans.map((p) => p.id));
  });

  it('changes nothing when the import fails midway', async () => {
    const original = sampleData();
    await repository.replaceAll(original);
    const [override] = original.overrides;
    if (!override) throw new Error('No override.');
    const duplicateKeys = { ...sampleData(), overrides: [override, override] };

    await expect(repository.replaceAll(duplicateKeys)).rejects.toThrow();
    expect(await repository.readAll()).toEqual(original);
  });

  it('keeps device settings when data is replaced', async () => {
    await repository.saveSettings({ theme: 'dark', lastBackupDate: '2026-10-01' });
    await repository.replaceAll(sampleData());
    expect(await repository.getSettings()).toEqual({ theme: 'dark', lastBackupDate: '2026-10-01' });
  });
});
