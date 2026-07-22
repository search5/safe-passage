import { App, Modal, Setting } from 'obsidian';
import { t } from '../i18n/i18n';

export class AuthModal extends Modal {
  private password = '';
  private onSubmit: (password: string) => void;
  private onCancel: () => void;
  private profileName: string;
  private isSubmitted = false;

  constructor(app: App, profileName: string, onSubmit: (password: string) => void, onCancel: () => void) {
    super(app);
    this.profileName = profileName;
    this.onSubmit = onSubmit;
    this.onCancel = onCancel;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.createEl('h3', { text: t('UNLOCK_TITLE', { profileName: this.profileName }) });

    new Setting(contentEl)
      .setName(t('MASTER_PASSWORD'))
      .setDesc(t('MASTER_PASSWORD_DESC'))
      .addText(text => {
        text.inputEl.type = 'password';
        text.onChange(value => {
          this.password = value;
        });
        // Enter 키 입력 시 제출 처리
        text.inputEl.addEventListener('keydown', (e: KeyboardEvent) => {
          if (e.key === 'Enter') {
            this.submit();
          }
        });
      });

    new Setting(contentEl)
      .addButton(btn => btn
        .setButtonText(t('UNLOCK'))
        .setCta()
        .onClick(() => this.submit()))
      .addButton(btn => btn
        .setButtonText(t('CANCEL'))
        .onClick(() => this.close()));
  }

  private submit() {
    this.isSubmitted = true;
    this.onSubmit(this.password);
    this.close();
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
    if (!this.isSubmitted) {
      this.onCancel();
    }
  }
}

export function promptMasterPassword(app: App, profileName: string): Promise<string | null> {
  return new Promise((resolve) => {
    const modal = new AuthModal(
      app,
      profileName,
      (password) => resolve(password),
      () => resolve(null)
    );
    modal.open();
  });
}
