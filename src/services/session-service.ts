import { Notice } from 'obsidian';
import { KdbxService } from './kdbx-service';
import { ProfileConfig } from '../types';
import { t } from '../i18n/i18n';

const TIMEOUT_VALUES: Record<string, number> = {
  'single': 0,
  '5min': 5 * 60 * 1000,
  '15min': 15 * 60 * 1000,
  'session': Infinity,
};

export class SessionService {
  private kdbxService: KdbxService;
  private timers: Map<string, ReturnType<typeof setTimeout>> = new Map();
  private onLockCallback?: (profileId: string) => void;

  constructor(kdbxService: KdbxService) {
    this.kdbxService = kdbxService;
  }

  registerOnLock(callback: (profileId: string) => void) {
    this.onLockCallback = callback;
  }

  startSession(profile: ProfileConfig) {
    this.clearTimer(profile.id);

    const timeout = TIMEOUT_VALUES[profile.sessionDuration] ?? 0;
    if (timeout === 0 || timeout === Infinity) return;

    const timer = setTimeout(() => {
      this.lockProfile(profile.id);
      new Notice(t('SESSION_EXPIRED', { profileName: profile.name }));
    }, timeout);

    this.timers.set(profile.id, timer);
  }

  lockProfile(profileId: string) {
    this.clearTimer(profileId);
    this.kdbxService.lock(profileId);
    if (this.onLockCallback) {
      this.onLockCallback(profileId);
    }
  }

  lockAll() {
    for (const profileId of this.timers.keys()) {
      this.clearTimer(profileId);
    }
    this.kdbxService.lockAll();
    if (this.onLockCallback) {
      // 모든 프로필에 대해 락 콜백 호출 (전달의 편의상 락올 이벤트로도 작동 가능)
      this.onLockCallback('*');
    }
  }

  consumeSingleLookup(profile: ProfileConfig) {
    if (profile.sessionDuration === 'single') {
      this.lockProfile(profile.id);
    }
  }

  private clearTimer(profileId: string) {
    const timer = this.timers.get(profileId);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(profileId);
    }
  }
}
