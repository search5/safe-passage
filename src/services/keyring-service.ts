export class KeyringService {
  private passwords: Map<string, string> = new Map();

  savePassword(profileId: string, password: string) {
    this.passwords.set(profileId, password);
  }

  getPassword(profileId: string): string | null {
    return this.passwords.get(profileId) ?? null;
  }

  deletePassword(profileId: string) {
    this.passwords.delete(profileId);
  }

  clear() {
    this.passwords.clear();
  }
}
