import { diffDays, type IsoDate } from '../../domain/dates';

export const STALE_BACKUP_DAYS = 7;

export interface BackupAge {
  /** "12 days ago", "today", or "never". */
  text: string;
  /** True when there is no backup or it is older than a week. */
  stale: boolean;
}

export function describeBackupAge(lastBackup: IsoDate | null, today: IsoDate): BackupAge {
  if (lastBackup === null) return { text: 'never', stale: true };
  const days = diffDays(lastBackup, today);
  const text = days <= 0 ? 'today' : days === 1 ? 'yesterday' : `${days} days ago`;
  return { text, stale: days > STALE_BACKUP_DAYS };
}

export function formatSize(bytes: number): string {
  return bytes < 1024 ? `${bytes} B` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}
