import { App, normalizePath } from 'obsidian';
import * as kdbxweb from 'kdbxweb';
import { argon2id, argon2d, argon2i } from 'hash-wasm';
import { ProfileConfig, KeePassEntryInfo } from '../types';
import { t } from '../i18n/i18n';

// WebAssembly 기반 Argon2 구현체 등록
kdbxweb.CryptoEngine.setArgon2Impl(
  async (password, salt, memory, iterations, length, parallelism, type, version) => {
    const argonType = type as number;
    const hashFn = argonType === 2 ? argon2id : argonType === 1 ? argon2i : argon2d;
    const hash = await hashFn({
      password: new Uint8Array(password),
      salt: new Uint8Array(salt),
      iterations,
      memorySize: memory,
      hashLength: length,
      parallelism,
      outputType: 'binary',
    });
    return new Uint8Array(hash).buffer;
  }
);

export class KdbxService {
  private activeDbs: Map<string, kdbxweb.Kdbx> = new Map();
  private app: App;

  constructor(app: App) {
    this.app = app;
  }

  isUnlocked(profileId: string): boolean {
    return this.activeDbs.has(profileId);
  }

  async unlock(profile: ProfileConfig, password: string): Promise<void> {
    const dbFile = this.app.vault.getFileByPath(normalizePath(profile.databasePath));
    if (!dbFile) {
      throw new Error(t('ERR_DB_NOT_FOUND', { path: profile.databasePath }));
    }
    const dbData = await this.app.vault.readBinary(dbFile);

    let keyFileData: ArrayBuffer | undefined;
    if (profile.keyFilePath) {
      const keyFile = this.app.vault.getFileByPath(normalizePath(profile.keyFilePath));
      if (!keyFile) {
        throw new Error(t('ERR_KEYFILE_NOT_FOUND', { path: profile.keyFilePath }));
      }
      keyFileData = await this.app.vault.readBinary(keyFile);
    }

    const credentials = new kdbxweb.KdbxCredentials(
      kdbxweb.ProtectedValue.fromString(password),
      keyFileData ?? null
    );

    const db = await kdbxweb.Kdbx.load(dbData, credentials);
    this.activeDbs.set(profile.id, db);
  }

  lock(profileId: string): void {
    this.activeDbs.delete(profileId);
  }

  lockAll(): void {
    this.activeDbs.clear();
  }

  getEntry(profileId: string, entryPath: string): KeePassEntryInfo | null {
    const db = this.activeDbs.get(profileId);
    if (!db) return null;

    const entry = this.resolveEntry(db, entryPath);
    if (!entry) return null;

    return this.toEntryInfo(entry);
  }

  findEntries(profileId: string, query: string): KeePassEntryInfo[] {
    const db = this.activeDbs.get(profileId);
    if (!db) return [];

    const results: KeePassEntryInfo[] = [];
    const lowerQuery = query.toLowerCase();
    const root = db.getDefaultGroup();

    for (const entry of root.allEntries()) {
      const title = this.fieldText(entry.fields.get('Title')) ?? '';
      const userName = this.fieldText(entry.fields.get('UserName')) ?? '';
      const url = this.fieldText(entry.fields.get('URL')) ?? '';

      if (
        title.toLowerCase().includes(lowerQuery) ||
        userName.toLowerCase().includes(lowerQuery) ||
        url.toLowerCase().includes(lowerQuery)
      ) {
        results.push(this.toEntryInfo(entry));
      }
    }

    return results;
  }

  getAllEntries(profileId: string): KeePassEntryInfo[] {
    const db = this.activeDbs.get(profileId);
    if (!db) return [];

    const results: KeePassEntryInfo[] = [];
    const root = db.getDefaultGroup();

    for (const entry of root.allEntries()) {
      const title = this.fieldText(entry.fields.get('Title'));
      if (!title) continue;
      results.push(this.toEntryInfo(entry));
    }

    return results;
  }

  async setEntry(profile: ProfileConfig, entryPath: string, fields: Record<string, string>): Promise<void> {
    if (profile.isReadOnly) {
      throw new Error(t('ERR_READONLY_WRITE'));
    }

    const db = this.activeDbs.get(profile.id);
    if (!db) {
      throw new Error(t('ERR_DB_LOCKED'));
    }

    const segments = entryPath.split('/');
    const title = segments[segments.length - 1] ?? entryPath;
    const groupSegments = segments.slice(0, -1);

    const group = this.resolveOrCreateGroup(db, groupSegments);
    let entry = group.entries.find(
      e => this.fieldText(e.fields.get('Title')) === title
    ) ?? null;

    if (!entry) {
      entry = db.createEntry(group);
      if (!group.entries.includes(entry)) {
        group.entries.push(entry);
      }
    }

    // 필드 설정 (Password 필드는 ProtectedValue로 보호)
    for (const [key, value] of Object.entries(fields)) {
      const isProtected = key.toLowerCase() === 'password';
      const fieldValue: kdbxweb.KdbxEntryField = isProtected
        ? kdbxweb.ProtectedValue.fromString(value)
        : value;
      entry.fields.set(key, fieldValue);
    }

    if (!entry.fields.get('Title')) {
      entry.fields.set('Title', title);
    }

    entry.times.update();
    await this.saveDatabase(profile.id, profile.databasePath);
  }

  async deleteEntry(profile: ProfileConfig, entryPath: string): Promise<boolean> {
    if (profile.isReadOnly) {
      throw new Error(t('ERR_READONLY_DELETE'));
    }

    const db = this.activeDbs.get(profile.id);
    if (!db) return false;

    const entry = this.resolveEntry(db, entryPath);
    if (!entry) return false;

    db.remove(entry);
    await this.saveDatabase(profile.id, profile.databasePath);
    return true;
  }

  private async saveDatabase(profileId: string, databasePath: string): Promise<void> {
    const db = this.activeDbs.get(profileId);
    if (!db) throw new Error(t('ERR_DB_INSTANCE_MISSING'));

    const buffer = await db.save();
    const normalizedPath = normalizePath(databasePath);
    const existing = this.app.vault.getFileByPath(normalizedPath);
    if (existing) {
      await this.app.vault.modifyBinary(existing, buffer);
    } else {
      await this.app.vault.createBinary(normalizedPath, buffer);
    }
  }

  // ── 헬퍼 메서드들 ──────────────────────────────────────────────────────

  private resolveEntry(db: kdbxweb.Kdbx, entryPath: string): kdbxweb.KdbxEntry | null {
    const segments = entryPath.split('/');
    const title = segments[segments.length - 1];
    const groupSegments = segments.slice(0, -1);
    const group = groupSegments.length
      ? this.findGroup(db.getDefaultGroup(), groupSegments)
      : db.getDefaultGroup();

    if (!group) return null;
    return group.entries.find(e => this.fieldText(e.fields.get('Title')) === title) ?? null;
  }

  private findGroup(root: kdbxweb.KdbxGroup, segments: string[]): kdbxweb.KdbxGroup | null {
    if (segments.length === 0) return root;
    const head = segments[0];
    const rest = segments.slice(1);
    const child = root.groups.find(g => (g.name ?? '').toLowerCase() === head.toLowerCase());
    if (!child) return null;
    return this.findGroup(child, rest);
  }

  private resolveOrCreateGroup(db: kdbxweb.Kdbx, segments: string[]): kdbxweb.KdbxGroup {
    let current = db.getDefaultGroup();
    for (const seg of segments) {
      const existing = current.groups.find(g => (g.name ?? '').toLowerCase() === seg.toLowerCase());
      if (existing) {
        current = existing;
      } else {
        current = db.createGroup(current, seg);
      }
    }
    return current;
  }

  private toEntryInfo(entry: kdbxweb.KdbxEntry): KeePassEntryInfo {
    const fields: Record<string, string> = {};
    for (const [key, value] of entry.fields) {
      fields[key] = value instanceof kdbxweb.ProtectedValue ? value.getText() : value;
    }

    const title = fields.Title ?? '';
    const userName = fields.UserName ?? '';
    const url = fields.URL ?? '';
    const notes = fields.Notes ?? '';

    return {
      title,
      userName,
      url,
      notes,
      fields,
      getPassword: () => {
        const passVal = entry.fields.get('Password');
        if (passVal instanceof kdbxweb.ProtectedValue) {
          return passVal.getText();
        }
        return typeof passVal === 'string' ? passVal : '';
      }
    };
  }

  private fieldText(value: string | kdbxweb.ProtectedValue | undefined): string | undefined {
    if (value === undefined) return undefined;
    if (value instanceof kdbxweb.ProtectedValue) return value.getText();
    return value;
  }
}
