import { Plugin, Notice, MarkdownView } from 'obsidian';
import { SafePassageSettings, DEFAULT_SETTINGS, ProfileConfig } from './types';
import { SafePassageSettingTab } from './settings';
import { KdbxService } from './services/kdbx-service';
import { SessionService } from './services/session-service';
import { ClipboardService } from './services/clipboard-service';
import { KeyringService } from './services/keyring-service';
import { registerBlockProcessor } from './ui/block-processor';
import { registerInlineProcessor } from './ui/inline-processor';
import { buildEditorExtension, refreshChipsEffect, getActiveEditorViews } from './ui/inline-decorator';
import { promptMasterPassword } from './ui/auth-modal';
import { EditSecretModal } from './ui/edit-secret-modal';
import { getProfileByIdOrName } from './ui/chip-component';
import { t } from './i18n/i18n';

export default class SafePassagePlugin extends Plugin {
  settings: SafePassageSettings = DEFAULT_SETTINGS;
  kdbxService!: KdbxService;
  sessionService!: SessionService;
  clipboardService!: ClipboardService;
  keyringService!: KeyringService;

  async onload() {
    await this.loadSettings();

    // 서비스 인스턴스화
    this.kdbxService = new KdbxService(this.app);
    this.sessionService = new SessionService(this.kdbxService);
    this.clipboardService = new ClipboardService();
    this.keyringService = new KeyringService();

    // 세션 잠금 콜백 등록
    this.sessionService.registerOnLock((profileId: string) => {
      if (profileId === '*') {
        this.keyringService.clear();
      } else {
        this.keyringService.deletePassword(profileId);
      }
      this.refreshViews();
    });

    // 설정 탭 등록
    this.addSettingTab(new SafePassageSettingTab(this.app, this));

    // 커맨드 등록
    this.addCommand({
      id: 'lock-all-profiles',
      name: t('COMMAND_LOCK_ALL'),
      callback: () => {
        this.sessionService.lockAll();
        new Notice(t('ALL_LOCKED'));
      }
    });

    this.addCommand({
      id: 'unlock-profile-manually',
      name: t('COMMAND_UNLOCK_MANUAL'),
      callback: () => {
        const profiles = Object.values(this.settings.profiles);
        if (profiles.length === 0) {
          new Notice(t('NO_PROFILES_CONFIGURED'));
          return;
        }
        
        // 일단 첫 번째 프로필 해제 예시 (실제 구현 시 선택 팝업이나 설정 활용)
        const locked = profiles.filter((p: ProfileConfig) => !this.kdbxService.isUnlocked(p.id));
        if (locked.length === 0) {
          new Notice(t('ALREADY_UNLOCKED'));
          return;
        }
        
        // 순서대로 첫 번째 항목 잠금 해제 시도
        void this.unlockProfile(locked[0]);
      }
    });

    this.addCommand({
      id: 'insert-secret',
      name: t('INSERT_SECRET'),
      editorCallback: (editor) => {
        new EditSecretModal(this.app, this, editor).open();
      }
    });

    // 파일 오픈 시 자동 잠금 해제 이벤트 연동
    this.registerEvent(
      this.app.workspace.on('file-open', async (file) => {
        if (!file || file.extension !== 'md') return;

        try {
          const content = await this.app.vault.read(file);
          const regex = /\{\{sp:([^/]+)\/(.+?)#([^}]+)\}\}/g;
          let match;
          const lockedProfileIds = new Set<string>();

          while ((match = regex.exec(content)) !== null) {
            const profileId = match[1];
            const profile = getProfileByIdOrName(this, profileId);
            if (profile && !this.kdbxService.isUnlocked(profile.id)) {
              lockedProfileIds.add(profile.id);
            }
          }

          // 잠겨 있는 프로필 중 키링 관리가 활성화되어 있고 키가 저장되어 있으면 자동 언락 진행
          for (const profileId of lockedProfileIds) {
            const profile = this.settings.profiles[profileId];
            if (profile && profile.managedByKeyring && this.settings.keyringEnabled) {
              const savedPass = this.keyringService.getPassword(profile.id);
              if (savedPass) {
                try {
                  await this.kdbxService.unlock(profile, savedPass);
                  this.sessionService.startSession(profile);
                  new Notice(t('KEYRING_AUTO_UNLOCKED', { profileName: profile.name }));
                } catch {
                  this.keyringService.deletePassword(profile.id);
                }
              }
            }
          }
          
          if (lockedProfileIds.size > 0) {
            this.refreshViews();
          }
        } catch (e) {
          console.error("SafePassage 파일 자동 언락 감지 중 오류:", e);
        }
      })
    );

    // 렌더러 등록 (에디터 & 읽기 모드)
    this.registerEditorExtension(buildEditorExtension(this));
    registerBlockProcessor(this);
    registerInlineProcessor(this);
  }

  onunload() {
    this.sessionService.lockAll();
    this.clipboardService.clearPending();
    this.keyringService.clear();
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
    this.refreshViews();
  }

  async unlockProfile(profile: ProfileConfig): Promise<boolean> {
    // 1. 키링에 패스워드가 있으면 자동 잠금 해제 시도
    if (this.settings.keyringEnabled && profile.managedByKeyring) {
      const savedPass = this.keyringService.getPassword(profile.id);
      if (savedPass) {
        try {
          await this.kdbxService.unlock(profile, savedPass);
          this.sessionService.startSession(profile);
          new Notice(t('KEYRING_AUTO_UNLOCKED', { profileName: profile.name }));
          return true;
        } catch {
          // 키링 해제 실패 시 캐시 삭제 후 수동 입력 유도
          this.keyringService.deletePassword(profile.id);
        }
      }
    }

    // 2. 수동 암호 입력 요청
    const password = await promptMasterPassword(this.app, profile.name);
    if (!password) return false;

    try {
      await this.kdbxService.unlock(profile, password);
      
      // 키링 저장 설정 활성화 시 비밀번호 세션 보관
      if (this.settings.keyringEnabled && profile.managedByKeyring) {
        this.keyringService.savePassword(profile.id, password);
      }

      this.sessionService.startSession(profile);
      new Notice(t('PROFILE_UNLOCKED_NOTICE', { profileName: profile.name }));
      this.refreshViews();
      return true;
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : '';
      new Notice(t('UNLOCK_FAILED', { message: errMsg }));
      return false;
    }
  }

  refreshViews() {
    // 1. 등록된 CM6 에디터들에 갱신 효과 디스패치 — EditorView.dispatch()는 공식 CM6 API
    for (const cm of getActiveEditorViews()) {
      try {
        cm.dispatch({
          effects: refreshChipsEffect.of()
        });
      } catch (e) {
        console.error("[SafePassage] 에디터 디스패치 중 에러:", e);
      }
    }

    // 2. 읽기 모드(프리뷰) 강제 리렌더링 — 공식 public API
    this.app.workspace.iterateAllLeaves(leaf => {
      const view = leaf.view;
      if (view instanceof MarkdownView) {
        try {
          view.previewMode.rerender(true);
        } catch (e) {
          console.error("[SafePassage] previewMode.rerender() 실패:", e);
        }
      }
    });

    // 3. 에디터 및 읽기 모드 내의 모든 크레덴셜 테이블 강제 리프레시 이벤트 발송
    document.querySelectorAll('.sp-table-container').forEach(el => {
      el.dispatchEvent(new CustomEvent('sp-refresh'));
    });
  }
}
