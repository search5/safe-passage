import { describe, expect, it } from 'vitest';
import * as kdbxweb from 'kdbxweb';
import type { App } from 'obsidian';
import type { ProfileConfig } from '../src/types';
import { KdbxService } from '../src/services/kdbx-service';

// Kdbx.create() builds a real in-memory database (no Argon2/file I/O needed), so we can
// exercise resolveEntry's path/uuid branches without mocking Obsidian's App or vault.
function createTestDb() {
  const credentials = new kdbxweb.KdbxCredentials(kdbxweb.ProtectedValue.fromString('test-password'));
  const db = kdbxweb.Kdbx.create(credentials, 'Test DB');
  const root = db.getDefaultGroup();

  const financeGroup = db.createGroup(root, 'Finance');
  const apiGroup = db.createGroup(financeGroup, 'API');

  const entry = db.createEntry(apiGroup);
  entry.fields.set('Title', 'OpenAI');
  entry.fields.set('UserName', 'me@example.com');
  entry.fields.set('Password', kdbxweb.ProtectedValue.fromString('secret123'));

  return { db, entry };
}

const fakeProfile: ProfileConfig = {
  id: 'p1',
  name: 'Test Profile',
  databasePath: 'test.kdbx',
  isReadOnly: false,
  managedByKeyring: false,
  sessionDuration: 'session',
};

function createTestService(profileId: string, db: kdbxweb.Kdbx): KdbxService {
  // getEntry/findEntries/getAllEntries/resolveEntry never touch this.app, but saveDatabase
  // (used by deleteEntry) does, so stub just enough of Vault for that path to succeed.
  const fakeApp = {
    vault: {
      getFileByPath: () => null,
      createBinary: async () => undefined,
      modifyBinary: async () => undefined,
    },
  } as unknown as App;

  const service = new KdbxService(fakeApp);
  (service as unknown as { activeDbs: Map<string, kdbxweb.Kdbx> }).activeDbs.set(profileId, db);
  return service;
}

describe('KdbxService uuid references', () => {
  it('resolves an entry via a uuid: reference', () => {
    const { db, entry } = createTestDb();
    const service = createTestService('p1', db);

    const found = service.getEntry('p1', `uuid:${entry.uuid.id}`);

    expect(found).not.toBeNull();
    expect(found?.title).toBe('OpenAI');
    expect(found?.uuid).toBe(entry.uuid.id);
  });

  it('still resolves an entry via a legacy path reference', () => {
    const { db } = createTestDb();
    const service = createTestService('p1', db);

    const found = service.getEntry('p1', 'Finance/API/OpenAI');

    expect(found).not.toBeNull();
    expect(found?.title).toBe('OpenAI');
  });

  it('returns null for a uuid: reference with no matching entry', () => {
    const { db } = createTestDb();
    const service = createTestService('p1', db);

    const found = service.getEntry('p1', 'uuid:AAAAAAAAAAAAAAAAAAAAAA==');

    expect(found).toBeNull();
  });

  it('populates uuid and groupPath on resolved entries', () => {
    const { db, entry } = createTestDb();
    const service = createTestService('p1', db);

    const found = service.getEntry('p1', 'Finance/API/OpenAI');

    expect(found?.uuid).toBe(entry.uuid.id);
    expect(found?.groupPath).toBe('Finance/API');
  });

  it('deletes an entry addressed by a uuid: reference', async () => {
    const { db, entry } = createTestDb();
    const service = createTestService('p1', db);
    const originalGroup = entry.parentGroup;

    const deleted = await service.deleteEntry(fakeProfile, `uuid:${entry.uuid.id}`);

    // kdbxweb's db.remove() moves entries to the Recycle Bin group rather than purging them
    // outright, and a uuid reference is expected to keep resolving there (surviving group
    // moves is the whole point of uuid references) — so assert removal from the original
    // group rather than asserting the uuid becomes unresolvable everywhere.
    expect(deleted).toBe(true);
    expect(originalGroup?.entries).not.toContain(entry);
  });
});
