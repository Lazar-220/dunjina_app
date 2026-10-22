import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Dexie from 'dexie';
import { App } from '../../app/App';
import { parseBackup, serializeBackup } from '../../data/backup';
import { createDexieRepository } from '../../data/dexie-repository';
import type { Repository } from '../../data/repository';
import { createDemoPlan } from '../../domain/demo-plan';
import { todayIso } from '../../shared/today';

let counter = 0;
const newId = () => `settings-test-${++counter}`;
let databaseName = '';
let repository: Repository;
let downloads: { fileName: string; text: Promise<string> }[] = [];

beforeEach(() => {
  databaseName = `settings-test-db-${newId()}`;
  repository = createDexieRepository(databaseName);
  downloads = [];
  window.location.hash = '#/settings';

  let lastBlob: Blob | undefined;
  URL.createObjectURL = (blob: Blob | MediaSource) => {
    lastBlob = blob as Blob;
    return 'blob:test';
  };
  URL.revokeObjectURL = () => undefined;
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
    if (lastBlob) downloads.push({ fileName: this.download, text: lastBlob.text() });
  });
});

afterEach(async () => {
  vi.restoreAllMocks();
  await Dexie.delete(databaseName);
});

async function openSettings() {
  const user = userEvent.setup();
  const view = render(<App repository={repository} />);
  await screen.findByRole('heading', { name: 'Settings' });
  return { user, ...view };
}

function backupFile(text: string): File {
  return new File([text], 'backup.json', { type: 'application/json' });
}

async function seedDemoPlan() {
  await repository.savePlan(createDemoPlan('2026-10-19', newId));
}

describe('export', () => {
  it('downloads a dated, importable backup and records the backup date', async () => {
    await seedDemoPlan();
    const { user } = await openSettings();
    expect(screen.getByText(/Last backup: never/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Export backup/ }));

    await waitFor(() => expect(downloads).toHaveLength(1));
    const [download] = downloads;
    expect(download?.fileName).toBe(`training-planner-${todayIso()}.json`);
    const parsed = parseBackup((await download?.text) ?? '');
    expect(parsed.ok).toBe(true);
    expect(await screen.findByText(/Last backup: today/)).toBeInTheDocument();
    expect(await repository.getSettings()).toMatchObject({ lastBackupDate: todayIso() });
    expect(screen.getByText('Backup saved to this device')).toBeInTheDocument();
  });
});

describe('import', () => {
  async function chooseFile(user: ReturnType<typeof userEvent.setup>, text: string) {
    const input = document.querySelector<HTMLInputElement>('input[type="file"]');
    if (!input) throw new Error('No file input.');
    await user.upload(input, backupFile(text));
  }

  async function exportFromAnotherDevice(): Promise<string> {
    const other = createDexieRepository(`${databaseName}-other`);
    await other.savePlan(createDemoPlan('2026-09-21', newId));
    const text = serializeBackup(await other.readAll(), '2026-10-22');
    await Dexie.delete(`${databaseName}-other`);
    return text;
  }

  it('shows a summary, then replaces the data only after confirmation', async () => {
    await seedDemoPlan();
    const incoming = await exportFromAnotherDevice();
    const parsed = parseBackup(incoming);
    const incomingPlanId = parsed.ok ? parsed.backup.plans[0]?.id : undefined;
    const { user } = await openSettings();

    await chooseFile(user, incoming);

    const dialog = await screen.findByRole('dialog', { name: 'Replace data on this device?' });
    expect(within(dialog).getByText('This backup')).toBeInTheDocument();
    expect(within(dialog).getByText('saved Thu 22 Oct 2026')).toBeInTheDocument();
    expect((await repository.listPlans()).map((p) => p.id)).not.toContain(incomingPlanId);

    await user.click(within(dialog).getByRole('button', { name: 'Replace data' }));

    await screen.findByText('Backup imported');
    expect((await repository.listPlans()).map((p) => p.id)).toEqual([incomingPlanId]);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('changes nothing when the user cancels', async () => {
    await seedDemoPlan();
    const before = await repository.readAll();
    const { user } = await openSettings();

    await chooseFile(user, await exportFromAnotherDevice());
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(await repository.readAll()).toEqual(before);
  });

  it('closes the confirmation with Escape without importing', async () => {
    const { user } = await openSettings();
    await chooseFile(user, await exportFromAnotherDevice());
    await screen.findByRole('dialog');

    await user.keyboard('{Escape}');

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect((await repository.readAll()).plans).toEqual([]);
  });

  it('rejects a file that is not a backup, says so, and changes nothing', async () => {
    await seedDemoPlan();
    const before = await repository.readAll();
    const { user } = await openSettings();

    await chooseFile(user, JSON.stringify({ hello: 'world' }));

    const alert = await screen.findByText(/format marker missing/);
    expect(alert).toHaveTextContent('Can’t read this file.');
    expect(alert).toHaveTextContent('Nothing was changed.');
    expect(screen.getByRole('button', { name: 'Choose another file' })).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(await repository.readAll()).toEqual(before);
  });

  it('refuses a backup from a newer app version', async () => {
    const { user } = await openSettings();
    const newer = JSON.stringify({ schema: 'training-planner', schemaVersion: 2 });

    await chooseFile(user, newer);

    expect(await screen.findByText(/Newer backup format \(v2\)/)).toBeInTheDocument();
    expect((await repository.readAll()).plans).toEqual([]);
  });

  it('rejects a damaged backup instead of importing part of it', async () => {
    const { user } = await openSettings();
    const damaged = JSON.parse(await exportFromAnotherDevice()) as { plans: { startDate: string }[] };
    const [plan] = damaged.plans;
    if (!plan) throw new Error('No plan.');
    plan.startDate = 'next monday';

    await chooseFile(user, JSON.stringify(damaged));

    expect(await screen.findByText(/This backup is damaged/)).toBeInTheDocument();
    expect((await repository.readAll()).plans).toEqual([]);
  });
});

describe('demo plan', () => {
  it('loads once and refuses a second active plan', async () => {
    const { user } = await openSettings();

    await user.click(screen.getByRole('button', { name: 'Load demo plan' }));
    await screen.findByText('Demo plan loaded');
    expect(await repository.listPlans()).toHaveLength(1);
    await waitFor(() => expect(screen.getByLabelText('Stored data')).toHaveTextContent('1plan'));

    await user.click(screen.getByRole('button', { name: 'Load demo plan' }));
    expect(await screen.findByText(/already have an active plan/)).toBeInTheDocument();
    expect(await repository.listPlans()).toHaveLength(1);
  });
});

describe('theme', () => {
  it('applies and remembers the chosen theme', async () => {
    const { user } = await openSettings();

    await user.click(screen.getByRole('radio', { name: 'Dark' }));

    await waitFor(() => expect(document.documentElement.dataset['theme']).toBe('dark'));
    expect(screen.getByRole('radio', { name: 'Dark' })).toBeChecked();
    expect(await repository.getSettings()).toMatchObject({ theme: 'dark' });
  });
});
