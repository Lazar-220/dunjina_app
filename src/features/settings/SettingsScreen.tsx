import { useRef, type ChangeEvent } from 'react';
import { backupErrorMessage, backupFileName, summarizeBackup, type BackupFile, type BackupSummary } from '../../data/backup';
import type { Theme } from '../../data/settings';
import { formatDate } from '../../domain/dates';
import { todayIso } from '../../shared/today';
import { Banner } from '../../shared/ui/Banner';
import { Dialog } from '../../shared/ui/Dialog';
import { Icon } from '../../shared/ui/Icon';
import { describeBackupAge, formatSize } from './backup-age';
import { useBackup } from './useBackup';
import { useDemoPlan } from './useDemoPlan';
import { useStoragePersistence } from './useStoragePersistence';
import { useSettings } from './SettingsProvider';
import './settings.css';

const THEMES: { value: Theme; label: string }[] = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'system', label: 'System' },
];

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? '' : 's'}`;
const summaryText = ({ plans, workoutsDone }: BackupSummary) =>
  `${plural(plans, 'plan')} · ${plural(workoutsDone, 'workout')}`;

export function SettingsScreen() {
  const backup = useBackup();
  const { update } = useSettings();
  const demo = useDemoPlan(backup.refresh);
  const persistence = useStoragePersistence();
  const fileInput = useRef<HTMLInputElement>(null);

  const today = todayIso();
  const age = describeBackupAge(backup.settings.lastBackupDate, today);

  const onFileChosen = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (file) void backup.chooseFile(file);
  };

  return (
    <>
      <div className="top">
        <div className="grow col g4">
          <span className="sm muted">Training Planner v1</span>
          <h1 className="title">Settings</h1>
        </div>
      </div>
      <div className="scroll" style={{ paddingTop: 6, gap: 14 }}>
        <section className="settings-data" aria-label="Your data">
          <div className="col g4">
            <h2 style={{ fontSize: 19, fontWeight: 700 }}>Your data</h2>
            <p className="muted" style={{ textWrap: 'pretty' }}>
              Everything is stored only on this device. Export a backup to keep it safe or to move it between the
              browser and the Android app.
            </p>
          </div>
          <div className="settings-kv" aria-label="Stored data">
            <div>
              <b>{backup.stored?.plans ?? '–'}</b>
              <small>{backup.stored?.plans === 1 ? 'plan' : 'plans'}</small>
            </div>
            <div>
              <b>{backup.stored?.workoutsDone ?? '–'}</b>
              <small>workouts done</small>
            </div>
            <div>
              <b>{backup.stored ? formatSize(backup.stored.sizeBytes) : '–'}</b>
              <small>backup size</small>
            </div>
          </div>
          <Banner tone={age.stale ? 'warn' : 'ok'}>
            <b>Last backup: {age.text}.</b>
            {age.stale && ' Browsers can clear local storage without warning.'}
          </Banner>
          {backup.problem && <Banner tone="err">{backup.problem}</Banner>}
          <div className="col g8">
            <button type="button" className="btn p blk settings-big" onClick={() => void backup.exportBackup()}>
              <Icon name="download" />
              Export backup
            </button>
            <div className="settings-file">
              <Icon name="file" size="s" />
              <span className="mono ell">{backupFileName(today)}</span>
            </div>
            <button type="button" className="btn s blk settings-big" onClick={() => fileInput.current?.click()}>
              <Icon name="upload" />
              Import backup
            </button>
            <input
              ref={fileInput}
              type="file"
              accept="application/json,.json"
              className="sr-only"
              tabIndex={-1}
              aria-hidden="true"
              onChange={onFileChosen}
            />
            <span className="hint">
              Importing replaces what is on this device. You will see a summary and confirm first.
            </span>
          </div>
          {backup.importFlow.step === 'rejected' && (
            <>
              <Banner tone="err">
                <b>{backupErrorMessage(backup.importFlow.error).title}</b>{' '}
                {backupErrorMessage(backup.importFlow.error).detail}
              </Banner>
              <button type="button" className="btn s blk" onClick={() => fileInput.current?.click()}>
                Choose another file
              </button>
            </>
          )}
          <div className="r rb" style={{ paddingTop: 12, borderTop: '1px solid var(--line)' }}>
            <span className="sm">Browser storage</span>
            {persistence === 'persistent' && (
              <span className="st done">
                <Icon name="check" size="xs" />
                Persistent
              </span>
            )}
            {persistence === 'not-guaranteed' && <span className="st warn">Not guaranteed</span>}
          </div>
        </section>

        <section className="card col g12">
          <h2 style={{ fontSize: 17, fontWeight: 700 }}>Appearance</h2>
          <div className="seg" role="radiogroup" aria-label="Theme">
            {THEMES.map(({ value, label }) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={backup.settings.theme === value}
                className={backup.settings.theme === value ? 'on' : undefined}
                onClick={() => void update({ theme: value })}
              >
                {label}
              </button>
            ))}
          </div>
        </section>

        <section className="card col g12">
          <h2 style={{ fontSize: 17, fontWeight: 700 }}>Try it out</h2>
          <p className="muted" style={{ textWrap: 'pretty' }}>
            Adds an example plan with strength, easy runs, tempo, a long run and intervals.
          </p>
          {demo.outcome.kind === 'blocked' && (
            <Banner tone="warn">You already have an active plan. End it in Plans before loading the demo plan.</Banner>
          )}
          {demo.outcome.kind === 'failed' && <Banner tone="err">Couldn’t load the demo plan. {demo.outcome.message}</Banner>}
          <button type="button" className="btn s blk" onClick={() => void demo.loadDemoPlan()}>
            Load demo plan
          </button>
        </section>

        <section className="card col g8">
          <h2 style={{ fontSize: 17, fontWeight: 700 }}>About</h2>
          <div className="r rb">
            <span className="muted">Units</span>
            <span className="mono sm">km · kg · km/h · s</span>
          </div>
          <div className="r rb">
            <span className="muted">Backup format</span>
            <span className="mono sm">v1</span>
          </div>
          <div className="r rb">
            <span className="muted">Weeks start on</span>
            <span className="mono sm">Monday</span>
          </div>
        </section>
      </div>

      {backup.importFlow.step === 'confirm' && (
        <ConfirmImport
          incoming={backup.importFlow.backup}
          current={backup.stored}
          lastBackup={age.text}
          onReplace={() => void backup.confirmImport()}
          onExport={() => void backup.exportBackup()}
          onCancel={backup.dismissImport}
        />
      )}
    </>
  );
}

interface ConfirmImportProps {
  incoming: BackupFile;
  current: BackupSummary | null;
  lastBackup: string;
  onReplace: () => void;
  onExport: () => void;
  onCancel: () => void;
}

function ConfirmImport({ incoming, current, lastBackup, onReplace, onExport, onCancel }: ConfirmImportProps) {
  const incomingSummary = summarizeBackup(incoming);
  return (
    <Dialog title="Replace data on this device?" onClose={onCancel}>
      <div className="settings-compare">
        <div className="card col g4" style={{ padding: 10 }}>
          <span className="xs muted b">This backup</span>
          <span className="b">{summaryText(incomingSummary)}</span>
          <span className="xs muted">saved {formatDate(incoming.exportedOn)}</span>
        </div>
        <div className="card col g4" style={{ padding: 10 }}>
          <span className="xs muted b">On this device</span>
          <span className="b">{current ? summaryText(current) : '–'}</span>
          <span className="xs muted">last backup {lastBackup}</span>
        </div>
      </div>
      <div className="col g8">
        <button type="button" className="btn d blk" onClick={onReplace}>
          Replace data
        </button>
        <button type="button" className="btn s blk" onClick={onExport}>
          Export current data first
        </button>
        <button type="button" className="btn s blk" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </Dialog>
  );
}
