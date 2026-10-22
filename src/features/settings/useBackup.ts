import { useCallback, useEffect, useState } from 'react';
import {
  backupFileName,
  parseBackup,
  serializeBackup,
  summarizeBackup,
  type BackupError,
  type BackupFile,
  type BackupSummary,
} from '../../data/backup';
import { useRepository } from '../../data/RepositoryContext';
import type { Repository } from '../../data/repository';
import { downloadTextFile } from '../../shared/download';
import { todayIso } from '../../shared/today';
import { useToast } from '../../shared/ui/Toast';
import { useSettings } from './SettingsProvider';

export interface StoredData extends BackupSummary {
  sizeBytes: number;
}

export type ImportFlow =
  | { step: 'idle' }
  | { step: 'rejected'; error: BackupError }
  | { step: 'confirm'; backup: BackupFile }
  | { step: 'replacing' };

async function readStoredData(repository: Repository): Promise<StoredData> {
  const data = await repository.readAll();
  const text = serializeBackup(data, todayIso());
  return { ...summarizeBackup(data), sizeBytes: new Blob([text]).size };
}

const errorText = (error: unknown): string => (error instanceof Error ? error.message : String(error));

export function useBackup() {
  const repository = useRepository();
  const { settings, update } = useSettings();
  const toast = useToast();
  const [stored, setStored] = useState<StoredData | null>(null);
  const [importFlow, setImportFlow] = useState<ImportFlow>({ step: 'idle' });
  const [problem, setProblem] = useState<string | null>(null);

  const [reloadCount, setReloadCount] = useState(0);
  const refresh = useCallback(() => setReloadCount((count) => count + 1), []);

  useEffect(() => {
    let cancelled = false;
    readStoredData(repository).then(
      (data) => {
        if (!cancelled) setStored(data);
      },
      (error: unknown) => {
        if (!cancelled) setProblem(errorText(error));
      },
    );
    return () => {
      cancelled = true;
    };
  }, [repository, reloadCount]);

  const exportBackup = useCallback(async () => {
    try {
      const today = todayIso();
      downloadTextFile(backupFileName(today), serializeBackup(await repository.readAll(), today));
      await update({ lastBackupDate: today });
      setProblem(null);
      toast.show({ message: 'Backup saved to this device' });
    } catch (error) {
      setProblem(`Couldn’t export your data. ${errorText(error)}`);
    }
  }, [repository, toast, update]);

  const chooseFile = useCallback(async (file: File) => {
    try {
      const result = parseBackup(await file.text());
      setImportFlow(result.ok ? { step: 'confirm', backup: result.backup } : { step: 'rejected', error: result.error });
    } catch (error) {
      setProblem(`Couldn’t read the file. ${errorText(error)}`);
    }
  }, []);

  const confirmImport = useCallback(async () => {
    if (importFlow.step !== 'confirm') return;
    const { plans, overrides, oneOffs } = importFlow.backup;
    setImportFlow({ step: 'replacing' });
    try {
      await repository.replaceAll({ plans, overrides, oneOffs });
      setProblem(null);
      toast.show({ message: 'Backup imported' });
      refresh();
    } catch (error) {
      setProblem(`Import failed and nothing was changed. ${errorText(error)}`);
    }
    setImportFlow({ step: 'idle' });
  }, [importFlow, refresh, repository, toast]);

  const dismissImport = useCallback(() => setImportFlow({ step: 'idle' }), []);

  return {
    settings,
    stored,
    importFlow,
    problem,
    refresh,
    exportBackup,
    chooseFile,
    confirmImport,
    dismissImport,
  };
}
