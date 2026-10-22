import { z } from 'zod';
import { isoDateSchema } from '../domain/schema';

export const settingsSchema = z.object({
  theme: z.enum(['light', 'dark', 'system']),
  /** Local calendar date of the last exported backup, or null if none was made yet. */
  lastBackupDate: isoDateSchema.nullable(),
});

export type Settings = z.infer<typeof settingsSchema>;
export type Theme = Settings['theme'];

export const DEFAULT_SETTINGS: Settings = { theme: 'system', lastBackupDate: null };
