import { App, normalizePath, Platform } from 'obsidian';
import * as kdbxweb from 'kdbxweb';
import { argon2id, argon2d, argon2i } from 'hash-wasm';
import { ProfileConfig, KeePassEntryInfo } from '../types';

export function isAbsolutePath(path: string): boolean {
  return path.startsWith('/') || /^[a-zA-Z]:\\/.test(path) || /^[a-zA-Z]:\//.test(path);
}

function getFs(): typeof import('fs') | null {
  // esbuild.config.mjs가 Node 내장 모듈을 external로 빼두었기 때문에,
  // require('fs')는 번들에 포함되지 않고 데스크톱 런타임의 실제 Node 모듈로 해석됨
  if (!Platform.isDesktop) return null;
  try {
    return require('fs');
  } catch (e) {
    console.error("[SafePassage] fs 모듈 동적 로드 실패:", e);
    return null;
  }
}

// WebAssembly 기반 Argon2 구현체 등록
kdbxweb.CryptoEngine.setArgon2Impl(
  async (password, salt, memory, iterations, length, parallelism, type, version) => {
    const t = type as number;
    const hashFn = t === 2 ? argon2id : t === 1 ? argon2i : argon2d;
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
    let dbData: ArrayBuffer;
    const fsModule = getFs();

    if (isAbsolutePath(profile.databasePath) && fsModule) {
      try {
        const buffer = await fsModule.promises.readFile(profile.databasePath);
        dbData = buffer.buffer as ArrayBuffer;
      } catch (err) {
        throw new Error(`외부 데이터베이스 파일을 읽을 수 없습니다: ${profile.databasePath} (${err instanceof Error ? err.message : err})`);
      }
    } else {
      // 절대 경로인데 fsModule이 없다면 (즉 모바일) 에러 처리
      if (isAbsolutePath(profile.databasePath)) {
        throw new Error("모바일 환경에서는 절대 경로의 외부 데이터베이스 파일을 사용할 수 없습니다. Vault 내부 경로로 변경해 주십시오.");
      }
      const dbFile = this.app.vault.getFileByPath(normalizePath(profile.databasePath));
      if (!dbFile) {
        throw new Error(`데이터베이스 파일을 찾을 수 없습니다: ${profile.databasePath}`);
      }
      dbData = await this.app.vault.readBinary(dbFile);
    }

    let keyFileData: ArrayBuffer | undefined;
    if (profile.keyFilePath) {
      if (isAbsolutePath(profile.keyFilePath) && fsModule) {
        try {
          const buffer = await fsModule.promises.readFile(profile.keyFilePath);
          keyFileData = buffer.buffer as ArrayBuffer;
        } catch {
          throw new Error(`외부 키 파일을 읽을 수 없습니다: ${profile.keyFilePath}`);
        }
      } else {
        if (isAbsolutePath(profile.keyFilePath)) {
          throw new Error("모바일 환경에서는 절대 경로의 외부 키 파일을 사용할 수 없습니다.");
        }
        const keyFile = this.app.vault.getFileByPath(normalizePath(profile.keyFilePath));
        if (!keyFile) {
          throw new Error(`키 파일을 찾을 수 없습니다: ${profile.keyFilePath}`);
        }
        keyFileData = await this.app.vault.readBinary(keyFile);
      }
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
      throw new Error("읽기 전용 프로필에서는 데이터를 추가/수정할 수 없습니다.");
    }

    const db = this.activeDbs.get(profile.id);
    if (!db) {
      throw new Error("데이터베이스가 잠겨 있습니다.");
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
      throw new Error("읽기 전용 프로필에서는 데이터를 삭제할 수 없습니다.");
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
    if (!db) throw new Error("저장할 데이터베이스 인스턴스가 존재하지 않습니다.");

    const buffer = await db.save();
    const fsModule = getFs();

    if (isAbsolutePath(databasePath) && fsModule) {
      try {
        const nodeBuffer = Buffer.from(buffer);
        await fsModule.promises.writeFile(databasePath, nodeBuffer);
      } catch (err) {
        throw new Error(`외부 데이터베이스 파일 쓰기 실패: ${databasePath} (${err instanceof Error ? err.message : err})`);
      }
    } else {
      if (isAbsolutePath(databasePath)) {
        throw new Error("모바일 환경에서는 절대 경로의 외부 데이터베이스 파일을 저장할 수 없습니다.");
      }
      const existing = this.app.vault.getFileByPath(normalizePath(databasePath));
      if (existing) {
        await this.app.vault.modifyBinary(existing, buffer);
      } else {
        await this.app.vault.createBinary(databasePath, buffer);
      }
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
