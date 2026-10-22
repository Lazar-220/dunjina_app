import { createDemoPlan } from '../domain/demo-plan';
import type { OneOff, Override } from '../domain/schema';
import {
  backupErrorMessage,
  backupFileName,
  parseBackup,
  serializeBackup,
  summarizeBackup,
  type BackupData,
  type ParsedBackup,
} from './backup';

let counter = 0;
const newId = () => `id-${++counter}`;

function sampleData(): BackupData {
  const plan = createDemoPlan('2026-10-19', newId);
  const longRun = plan.slots.find((slot) => slot.type === 'long');
  if (!longRun) throw new Error('Demo plan has no long run.');
  const overrides: Override[] = [
    { planId: plan.id, slotId: longRun.id, week: 2, done: true, values: { kind: 'run', km: 11 } },
    { planId: plan.id, slotId: longRun.id, week: 3, date: '2026-11-05' },
  ];
  const oneOffs: OneOff[] = [{ id: 'one', date: '2026-10-24', type: 'easy', done: true, details: { kind: 'run', km: 5 } }];
  return { plans: [plan], overrides, oneOffs };
}

function failure(result: ParsedBackup) {
  if (result.ok) throw new Error('Expected the backup to be rejected.');
  return result.error;
}

function fileOf(data: BackupData): Record<string, unknown> {
  return JSON.parse(serializeBackup(data, '2026-10-22')) as Record<string, unknown>;
}

describe('backup round trip', () => {
  it('parses what it serialized, unchanged', () => {
    const data = sampleData();
    const result = parseBackup(serializeBackup(data, '2026-10-22'));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect({ plans: result.backup.plans, overrides: result.backup.overrides, oneOffs: result.backup.oneOffs }).toEqual(data);
      expect(result.backup.exportedOn).toBe('2026-10-22');
    }
  });

  it('writes the format marker and version first', () => {
    const lines = serializeBackup(sampleData(), '2026-10-22').split('\n');
    expect(lines[1]).toBe('  "schema": "training-planner",');
    expect(lines[2]).toBe('  "schemaVersion": 1,');
  });

  it('names the file by date', () => {
    expect(backupFileName('2026-10-22')).toBe('training-planner-2026-10-22.json');
  });

  it('summarizes plans and done workouts', () => {
    expect(summarizeBackup(sampleData())).toEqual({ plans: 1, workoutsDone: 2 });
  });
});

describe('malformed backups are rejected with a clear message', () => {
  it('rejects text that is not JSON', () => {
    const error = failure(parseBackup('not json {'));
    expect(error.kind).toBe('not-json');
    expect(backupErrorMessage(error).detail).toContain('Nothing was changed');
  });

  it('rejects JSON without the format marker', () => {
    const error = failure(parseBackup(JSON.stringify({ plans: [] })));
    expect(backupErrorMessage(error)).toEqual({
      title: 'Can’t read this file.',
      detail: 'It isn’t a Training Planner backup (format marker missing). Nothing was changed.',
    });
    expect(failure(parseBackup('[1,2]')).kind).toBe('wrong-format');
    expect(failure(parseBackup('"text"')).kind).toBe('wrong-format');
  });

  it('refuses a newer format version', () => {
    const file = fileOf(sampleData());
    file['schemaVersion'] = 2;
    const error = failure(parseBackup(JSON.stringify(file)));
    expect(backupErrorMessage(error)).toEqual({
      title: 'Newer backup format (v2).',
      detail: 'Update the app to import this file. Nothing was changed.',
    });
  });

  it('rejects a file with a missing section', () => {
    const file = fileOf(sampleData());
    delete file['overrides'];
    expect(failure(parseBackup(JSON.stringify(file))).kind).toBe('invalid');
  });

  it('rejects a bad value inside a plan and names the problem', () => {
    const file = fileOf(sampleData()) as { plans: { startDate: string }[] };
    const [plan] = file.plans;
    if (!plan) throw new Error('No plan.');
    plan.startDate = '2026-02-30';
    const error = failure(parseBackup(JSON.stringify(file)));
    expect(error.kind).toBe('invalid');
    expect(backupErrorMessage(error).detail).toContain('plans.0.startDate');
  });

  it('rejects a missing or non-numeric version', () => {
    expect(failure(parseBackup(JSON.stringify({ schema: 'training-planner' }))).kind).toBe('invalid');
    expect(failure(parseBackup(JSON.stringify({ schema: 'training-planner', schemaVersion: 'one' }))).kind).toBe('invalid');
  });

  it('rejects changes that point at a slot that is not in the file', () => {
    const data = sampleData();
    const [first] = data.overrides;
    if (!first) throw new Error('No override.');
    const orphan = { ...data, overrides: [{ ...first, slotId: 'ghost' }] };
    const error = failure(parseBackup(serializeBackup(orphan, '2026-10-22')));
    expect(backupErrorMessage(error).detail).toContain('slot that is not in the backup');
  });

  it('rejects duplicate changes for the same week and values of the wrong kind', () => {
    const data = sampleData();
    const [first] = data.overrides;
    if (!first) throw new Error('No override.');
    expect(failure(parseBackup(serializeBackup({ ...data, overrides: [first, first] }, '2026-10-22'))).kind).toBe('invalid');
    const wrongKind = { ...first, values: { kind: 'tempo' as const, km: 3 } };
    const error = failure(parseBackup(serializeBackup({ ...data, overrides: [wrongKind] }, '2026-10-22')));
    expect(backupErrorMessage(error).detail).toContain('wrong kind of values');
  });

  it('rejects a one-off workout whose details do not match its type', () => {
    const file = fileOf(sampleData());
    file['oneOffs'] = [{ id: 'x', date: '2026-10-24', type: 'tempo', done: false, details: { kind: 'run', km: 5 } }];
    expect(failure(parseBackup(JSON.stringify(file))).kind).toBe('invalid');
  });

  it('rejects duplicate plan ids', () => {
    const data = sampleData();
    const [plan] = data.plans;
    if (!plan) throw new Error('No plan.');
    expect(failure(parseBackup(serializeBackup({ ...data, plans: [plan, plan] }, '2026-10-22'))).kind).toBe('invalid');
  });
});
