import { App, Modal, Setting, Notice, Editor, TextComponent } from 'obsidian';
import SafePassagePlugin from '../main';
import { t } from '../i18n/i18n';

export class EditSecretModal extends Modal {
  private plugin: SafePassagePlugin;
  private editor?: Editor;

  private selectedProfileId = '';
  private entryPath = '';
  private username = '';
  private password = '';
  private url = '';
  private notes = '';
  private customFields: { name: string; value: string }[] = [];
  private passwordInput?: TextComponent;
  private warningDiv?: HTMLDivElement;
  private formDiv?: HTMLDivElement;

  constructor(app: App, plugin: SafePassagePlugin, editor?: Editor) {
    super(app);
    this.plugin = plugin;
    this.editor = editor;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl('h2', { text: t('INSERT_SECRET') });

    // 1. 프로필 선택 (읽기 전용 제외)
    const writeableProfiles = Object.values(this.plugin.settings.profiles);
    const activeProfiles = writeableProfiles.filter(p => !p.isReadOnly);

    if (activeProfiles.length === 0) {
      contentEl.createEl('p', {
        text: '⚠ 쓰기 가능한 프로필이 존재하지 않습니다. 설정을 확인해 주십시오.',
        attr: { style: 'color: var(--text-error);' }
      });
      return;
    }

    this.selectedProfileId = activeProfiles[0].id;

    new Setting(contentEl)
      .setName(t('SELECT_PROFILE'))
      .addDropdown(dropdown => {
        for (const p of activeProfiles) {
          dropdown.addOption(p.id, p.name);
        }
        dropdown.setValue(this.selectedProfileId);
        dropdown.onChange(val => {
          this.selectedProfileId = val;
          this.updateLockWarning();
        });
      });

    // 잠금 상태 경고 영역
    const warningDiv = contentEl.createDiv({ cls: 'sp-warning-container hidden' });
    this.warningDiv = warningDiv;

    // 2. 기본 정보 필드 입력 폼
    const formDiv = contentEl.createDiv();
    this.formDiv = formDiv;

    new Setting(formDiv)
      .setName(t('ENTRY_PATH'))
      .addText(text => text
        .setValue(this.entryPath)
        .onChange(val => { this.entryPath = val.trim(); }));

    new Setting(formDiv)
      .setName(t('USERNAME'))
      .addText(text => text
        .setValue(this.username)
        .onChange(val => { this.username = val; }));

    // 패스워드 입력 + 생성 버튼
    const passwordSetting = new Setting(formDiv)
      .setName(t('PASSWORD'));

    passwordSetting.addText(text => {
      text.inputEl.type = 'password';
      text.setValue(this.password);
      text.onChange(val => { this.password = val; });

      // 외부에서 주입할 수 있게 참조
      this.passwordInput = text;
    });

    passwordSetting.addButton(btn => btn
      .setButtonText(t('GENERATE_PASSWORD'))
      .onClick(() => {
        const generated = this.generateRandomPassword(16);
        this.password = generated;
        if (this.passwordInput) {
          this.passwordInput.setValue(generated);
          this.passwordInput.inputEl.type = 'text'; // 생성된 암호 보여주기
        }
        new Notice('무작위 패스워드가 생성되었습니다.');
      }));

    new Setting(formDiv)
      .setName(t('URL'))
      .addText(text => text
        .setValue(this.url)
        .onChange(val => { this.url = val.trim(); }));

    new Setting(formDiv)
      .setName(t('NOTES'))
      .addTextArea(text => text
        .setValue(this.notes)
        .onChange(val => { this.notes = val; }));

    // 3. 사용자 지정 추가 필드 영역
    contentEl.createEl('h3', { text: t('CUSTOM_FIELDS') });
    const customFieldsDiv = contentEl.createDiv();

    new Setting(contentEl)
      .addButton(btn => btn
        .setButtonText(t('ADD_FIELD'))
        .onClick(() => {
          this.customFields.push({ name: '', value: '' });
          this.renderCustomFields(customFieldsDiv);
        }));

    this.renderCustomFields(customFieldsDiv);

    // 4. 저장 버튼
    new Setting(contentEl)
      .addButton(btn => btn
        .setButtonText(t('SAVE'))
        .setCta()
        .onClick(async () => {
          await this.handleSave();
        }))
      .addButton(btn => btn
        .setButtonText(t('CANCEL'))
        .onClick(() => this.close()));

    // 초기 잠금 상태 확인
    this.updateLockWarning();
  }

  private renderCustomFields(container: HTMLElement) {
    container.empty();

    this.customFields.forEach((field, index) => {
      const row = container.createDiv({ cls: 'sp-custom-field-row' });

      // 필드명 입력
      const nameInput = row.createEl('input', {
        type: 'text',
        placeholder: t('FIELD_NAME'),
        value: field.name,
        cls: 'sp-input-flex-1'
      });
      nameInput.addEventListener('input', () => {
        field.name = nameInput.value.trim();
      });

      // 필드값 입력
      const valueInput = row.createEl('input', {
        type: 'password',
        placeholder: t('FIELD_VALUE'),
        value: field.value,
        cls: 'sp-input-flex-2'
      });
      valueInput.addEventListener('input', () => {
        field.value = valueInput.value;
      });

      // 필드 표시 보기 토글 단추
      const eyeBtn = row.createEl('button', {
        text: '👁',
        cls: 'sp-eye-btn'
      });
      eyeBtn.addEventListener('click', (e) => {
        e.preventDefault();
        valueInput.type = valueInput.type === 'password' ? 'text' : 'password';
      });

      // 필드 삭제 버튼
      const deleteBtn = row.createEl('button', {
        text: '✕',
        cls: 'sp-delete-btn'
      });
      deleteBtn.addEventListener('click', (e) => {
        e.preventDefault();
        this.customFields.splice(index, 1);
        this.renderCustomFields(container);
      });
    });
  }

  private updateLockWarning() {
    const warningDiv = this.warningDiv;
    const formDiv = this.formDiv;
    if (!warningDiv || !formDiv) return;

    const profile = this.plugin.settings.profiles[this.selectedProfileId];
    if (!profile) return;

    const isUnlocked = this.plugin.kdbxService.isUnlocked(profile.id);

    if (!isUnlocked) {
      warningDiv.removeClass('hidden');
      warningDiv.empty();
      warningDiv.createSpan({ text: t('DATABASE_LOCKED_WARNING') + ' ' });
      
      const unlockBtn = warningDiv.createEl('button', { text: t('UNLOCK') });
      unlockBtn.addEventListener('click', () => {
        void (async () => {
          const success = await this.plugin.unlockProfile(profile);
          if (success) {
            this.updateLockWarning();
          }
        })();
      });

      formDiv.addClass('sp-form-disabled');
    } else {
      warningDiv.addClass('hidden');
      formDiv.removeClass('sp-form-disabled');
    }
  }

  private async handleSave() {
    if (!this.entryPath || !this.username || !this.password) {
      new Notice(t('FIELD_REQUIRED'));
      return;
    }

    const profile = this.plugin.settings.profiles[this.selectedProfileId];
    if (!profile) return;

    const isUnlocked = this.plugin.kdbxService.isUnlocked(profile.id);
    if (!isUnlocked) {
      new Notice(t('DATABASE_LOCKED_WARNING'));
      return;
    }

    // 전송할 필드들 구성
    const fields: Record<string, string> = {
      Title: this.entryPath.split('/').pop() ?? this.entryPath,
      UserName: this.username,
      Password: this.password,
    };

    if (this.url) fields.URL = this.url;
    if (this.notes) fields.Notes = this.notes;

    // 커스텀 필드 병합
    this.customFields.forEach(f => {
      if (f.name) {
        fields[f.name] = f.value;
      }
    });

    try {
      await this.plugin.kdbxService.setEntry(profile, this.entryPath, fields);
      
      // 에디터 컨텍스트에서 실행된 경우 토큰 자동 삽입
      if (this.editor) {
        // 기본값으로 Password 필드 토큰 생성 및 백틱(`)으로 감싸기
        const token = `\`{{sp:${profile.name}/${this.entryPath}#Password}}\``;
        this.editor.replaceSelection(token);
        new Notice(t('SUCCESS_SAVE_TOKEN'));
      } else {
        new Notice(t('SUCCESS_SAVE'));
      }
      
      this.plugin.refreshViews();
      this.close();
    } catch (err) {
      new Notice(`저장 실패: ${err instanceof Error ? err.message : err}`);
    }
  }

  private generateRandomPassword(length: number): string {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+~}{[]:;?><,./-=';
    let pass = '';
    for (let i = 0; i < length; i++) {
      const index = Math.floor(Math.random() * chars.length);
      pass += chars[index];
    }
    return pass;
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }
}
