import type { ReactNode } from 'react';
import { Icon, type IconName } from './Icon';

export type BannerTone = 'warn' | 'err' | 'ok' | 'info';

const ICON_OF_TONE: Record<BannerTone, IconName> = { warn: 'warning', err: 'warning', ok: 'check', info: 'info' };

/** Errors are announced immediately (alert); everything else politely (status). */
export function Banner({ tone, children }: { tone: BannerTone; children: ReactNode }) {
  return (
    <div className={`banner ${tone}`} role={tone === 'err' ? 'alert' : 'status'}>
      <Icon name={ICON_OF_TONE[tone]} size="s" />
      <span>{children}</span>
    </div>
  );
}
