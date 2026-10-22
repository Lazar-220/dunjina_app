import { describeBackupAge, formatSize } from './backup-age';

describe('describeBackupAge', () => {
  it('treats a missing backup as stale', () => {
    expect(describeBackupAge(null, '2026-10-22')).toEqual({ text: 'never', stale: true });
  });

  it('words recent backups naturally and keeps them fresh for 7 days', () => {
    expect(describeBackupAge('2026-10-22', '2026-10-22')).toEqual({ text: 'today', stale: false });
    expect(describeBackupAge('2026-10-21', '2026-10-22')).toEqual({ text: 'yesterday', stale: false });
    expect(describeBackupAge('2026-10-15', '2026-10-22')).toEqual({ text: '7 days ago', stale: false });
  });

  it('warns after 7 days', () => {
    expect(describeBackupAge('2026-10-10', '2026-10-22')).toEqual({ text: '12 days ago', stale: true });
  });
});

describe('formatSize', () => {
  it('shows bytes under 1 KB and rounded kilobytes above', () => {
    expect(formatSize(512)).toBe('512 B');
    expect(formatSize(49_152)).toBe('48 KB');
  });
});
