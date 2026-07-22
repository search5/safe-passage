export type SessionDuration = 'single' | '5min' | '15min' | 'session';

export interface ProfileConfig {
  id: string;
  name: string;
  databasePath: string;
  keyFilePath?: string;
  isReadOnly: boolean;
  managedByKeyring: boolean;
  sessionDuration: SessionDuration;
}

export interface SafePassageSettings {
  profiles: Record<string, ProfileConfig>;
  clipboardClearSeconds: number;
  keyringEnabled: boolean;
  autoUnlock: boolean;
}

export interface KeePassEntryInfo {
  title: string;
  userName: string;
  url: string;
  notes: string;
  fields: Record<string, string>;
  getPassword: () => string;
}

export interface ProfileState {
  id: string;
  name: string;
  isLocked: boolean;
  isReadOnly: boolean;
}

export const DEFAULT_SETTINGS: SafePassageSettings = {
  profiles: {},
  clipboardClearSeconds: 60,
  keyringEnabled: false,
  autoUnlock: false,
};
