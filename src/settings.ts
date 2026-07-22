import { App, PluginSettingTab, Setting } from 'obsidian';
import SafePassagePlugin from './main';
import { ProfileConfig, SessionDuration } from './types';
import { t } from './i18n/i18n';

export class SafePassageSettingTab extends PluginSettingTab {
  plugin: SafePassagePlugin;

  constructor(app: App, plugin: SafePassagePlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    new Setting(containerEl).setName(t('SETTINGS_TITLE')).setHeading();

    // 1. 전역 보안 설정
    new Setting(containerEl).setName(t('GLOBAL_SECURITY_SETTINGS')).setHeading();

    new Setting(containerEl)
      .setName(t('CLIPBOARD_TIMEOUT'))
      .setDesc(t('CLIPBOARD_TIMEOUT_DESC'))
      .addText(text => text
        .setPlaceholder('60')
        .setValue(String(this.plugin.settings.clipboardClearSeconds))
        .onChange(async (value) => {
          const num = Number(value);
          this.plugin.settings.clipboardClearSeconds = isNaN(num) ? 60 : num;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName(t('KEYRING_ENABLE'))
      .setDesc(t('KEYRING_ENABLE_DESC'))
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.keyringEnabled)
        .onChange(async (value) => {
          this.plugin.settings.keyringEnabled = value;
          if (!value) {
            this.plugin.keyringService.clear();
          }
          await this.plugin.saveSettings();
        }));

    // 2. 프로필 목록
    new Setting(containerEl).setName(t('DATABASE_PROFILES')).setHeading();

    const profileContainer = containerEl.createDiv({ cls: 'kpn-profile-list' });
    this.renderProfiles(profileContainer);

    // 새 프로필 추가 버튼
    new Setting(containerEl)
      .addButton(btn => btn
        .setButtonText(t('ADD_NEW_PROFILE'))
        .setCta()
        .onClick(async () => {
          const newId = `profile-${Date.now()}`;
          const newProfile: ProfileConfig = {
            id: newId,
            name: '새 프로필',
            databasePath: '',
            isReadOnly: true,
            managedByKeyring: false,
            sessionDuration: '5min',
          };
          this.plugin.settings.profiles[newId] = newProfile;
          await this.plugin.saveSettings();
          this.display(); // UI 리프레시
        }));
  }

  private renderProfiles(container: HTMLElement) {
    const profiles = Object.values(this.plugin.settings.profiles) as ProfileConfig[];

    if (profiles.length === 0) {
      container.createEl('p', { text: t('NO_PROFILES_MSG'), attr: { style: 'color: var(--text-muted); font-style: italic;' } });
      return;
    }

    for (const profile of profiles) {
      const profileDiv = container.createDiv({
        attr: {
          style: 'border: 1px solid var(--border-color); padding: 15px; margin-bottom: 15px; border-radius: 8px; background-color: var(--background-primary-alt);'
        }
      });

      // 프로필 이름 수정
      new Setting(profileDiv)
        .setName(t('PROFILE_NAME'))
        .addText(text => text
          .setValue(profile.name)
          .onChange(async (val) => {
            profile.name = val.trim() || '이름 없음';
            await this.plugin.saveSettings();
          }));

      // DB 경로 수정
      new Setting(profileDiv)
        .setName(t('DATABASE_PATH'))
        .setDesc(t('DATABASE_PATH_DESC'))
        .addText(text => text
          .setValue(profile.databasePath)
          .onChange(async (val) => {
            profile.databasePath = val.trim();
            await this.plugin.saveSettings();
          }));

      // 키 파일 경로 수정 (선택적)
      new Setting(profileDiv)
        .setName(t('KEY_PATH'))
        .setDesc(t('KEY_PATH_DESC'))
        .addText(text => text
          .setValue(profile.keyFilePath ?? '')
          .onChange(async (val) => {
            profile.keyFilePath = val.trim() || undefined;
            await this.plugin.saveSettings();
          }));

      // 읽기 전용 토글 (하이브리드 모드)
      new Setting(profileDiv)
        .setName(t('READ_ONLY'))
        .setDesc(t('READ_ONLY_DESC'))
        .addToggle(toggle => toggle
          .setValue(profile.isReadOnly)
          .onChange(async (val) => {
            profile.isReadOnly = val;
            await this.plugin.saveSettings();
          }));

      // 키링 관리 여부 토글
      new Setting(profileDiv)
        .setName(t('MANAGE_BY_KEYRING'))
        .setDesc(t('MANAGE_BY_KEYRING_DESC'))
        .addToggle(toggle => toggle
          .setValue(profile.managedByKeyring)
          .onChange(async (val) => {
            profile.managedByKeyring = val;
            await this.plugin.saveSettings();
          }));

      // 세션 유지시간 설정
      new Setting(profileDiv)
        .setName(t('SESSION_LIFETIME'))
        .setDesc(t('SESSION_LIFETIME_DESC'))
        .addDropdown(dropdown => dropdown
          .addOption('single', t('SESSION_SINGLE'))
          .addOption('5min', t('SESSION_5MIN'))
          .addOption('15min', t('SESSION_15MIN'))
          .addOption('session', t('SESSION_FOREVER'))
          .setValue(profile.sessionDuration)
          .onChange(async (val) => {
            profile.sessionDuration = val as SessionDuration;
            await this.plugin.saveSettings();
          }));

      // 프로필 제거 버튼
      new Setting(profileDiv)
        .addButton(btn => btn
          .setButtonText(t('DELETE_PROFILE'))
          .setWarning()
          .onClick(async () => {
            delete this.plugin.settings.profiles[profile.id];
            this.plugin.kdbxService.lock(profile.id);
            await this.plugin.saveSettings();
            this.display();
          }));
    }
  }
}
