import { setIcon, Notice } from 'obsidian';
import SafePassagePlugin from '../main';
import { t } from '../i18n/i18n';
import { getProfileByIdOrName } from './chip-component';

interface BlockConfig {
  title?: string;
  profileId?: string;
  entries: string[];
  fields: string[];
}

function parseBlockConfig(source: string): BlockConfig {
  const lines = source.split('\n');
  let title: string | undefined;
  let profileId: string | undefined;
  const entries: string[] = [];
  let fields: string[] = ['UserName', 'Password']; // 기본 필드
  
  let inEntries = false;
  
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
  
    if (trimmed.startsWith('title:')) {
      title = trimmed.replace('title:', '').trim();
      // 양쪽 따옴표 제거
      title = title.replace(/^["']|["']$/g, '');
      inEntries = false;
    } else if (trimmed.startsWith('profile:')) {
      profileId = trimmed.replace('profile:', '').trim();
      inEntries = false;
    } else if (trimmed.startsWith('fields:')) {
      const fieldPart = trimmed.replace('fields:', '').trim();
      // [Username, Password] 형식 파싱
      const match = fieldPart.match(/^\[(.*)\]$/);
      if (match && match[1]) {
        fields = match[1].split(',').map(f => f.trim());
      }
      inEntries = false;
    } else if (trimmed.startsWith('entries:')) {
      inEntries = true;
    } else if (inEntries && trimmed.startsWith('-')) {
      const entry = trimmed.substring(1).trim();
      if (entry) {
        entries.push(entry);
      }
    }
  }

  return { title, profileId, entries, fields };
}

export function registerBlockProcessor(plugin: SafePassagePlugin): void {
  plugin.registerMarkdownCodeBlockProcessor('safe-passage', async (source: string, el: HTMLElement) => {
    const config = parseBlockConfig(source);
    const container = el.createDiv({ cls: 'sp-table-container' });

    const renderContent = async () => {
      container.empty();
      console.log("[SafePassage] 테이블 renderContent() 실행");

      if (!config.profileId) {
        container.createEl('p', { text: t('MISSING_PROFILE_PROPERTY') });
        return;
      }

      const profile = getProfileByIdOrName(plugin, config.profileId);
      if (!profile) {
        container.createEl('p', { text: t('MISSING_PROFILE_MSG', { profileId: config.profileId }) });
        return;
      }

      const isUnlocked = plugin.kdbxService.isUnlocked(profile.id);
      console.log(`[SafePassage] 테이블 렌더링 시 잠금 상태 - profile: ${profile.name}, unlocked: ${isUnlocked}`);

      // 테이블 타이틀 헤더 렌더링
      const titleText = config.title || `${profile.name} - KeePass 자격 증명`;
      const titleHeader = container.createDiv({ cls: 'sp-table-title' });
      titleHeader.createEl('span', { text: `📋 ${titleText}`, cls: 'sp-table-title-text' });

      if (!isUnlocked) {
        const lockDiv = container.createDiv({ cls: 'sp-table-locked' });
        lockDiv.style.padding = '12px';
        lockDiv.style.textAlign = 'center';
        lockDiv.createEl('span', { text: t('PROFILE_IS_LOCKED_MSG', { profileName: profile.name }) });
        
        const unlockBtn = lockDiv.createEl('button', { text: t('UNLOCK') });
        unlockBtn.addEventListener('click', async () => {
          const success = await plugin.unlockProfile(profile);
          if (success) {
            plugin.refreshViews();
          }
        });
        return;
      }

      // 테이블 렌더링
      const table = container.createEl('table', { cls: 'sp-table' });
      
      // 테이블 헤더 생성
      const thead = table.createEl('thead');
      const headerRow = thead.createEl('tr');
      headerRow.createEl('th', { text: t('ENTRY_NAME') });
      for (const field of config.fields) {
        headerRow.createEl('th', { text: field });
      }

      // 테이블 본문 생성
      const tbody = table.createEl('tbody');

      for (const entryPath of config.entries) {
        const row = tbody.createEl('tr');
        
        // 항목 열
        const titleText = entryPath.split('/').pop() ?? entryPath;
        row.createEl('td', { text: titleText });

        const entry = plugin.kdbxService.getEntry(profile.id, entryPath);

        for (const field of config.fields) {
          const td = row.createEl('td');
          
          if (!entry) {
            td.textContent = t('ENTRY_MISSING');
            td.classList.add('empty-field');
            continue;
          }

          const value = entry.fields[field];

          if (value === undefined) {
            td.textContent = t('EMPTY_FIELD_TEXT');
            td.classList.add('empty-field');
            td.title = t('EMPTY_FIELD_DESC', { fieldName: field });
            continue;
          }

          // 마스킹 처리된 값 표시
          const maskSpan = td.createSpan({ text: '••••••••' });
          maskSpan.style.marginRight = '8px';

          // 복사 버튼 추가
          const copyBtn = td.createEl('button', { cls: 'sp-copy-btn' });
          setIcon(copyBtn, 'copy');
          copyBtn.title = `${field} ${t('COPY')}`;

          copyBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            e.stopPropagation();

            let valToCopy = value;
            if (field.toLowerCase() === 'password') {
              valToCopy = entry.getPassword();
            }

            await plugin.clipboardService.copyText(valToCopy, plugin.settings.clipboardClearSeconds);
            plugin.sessionService.consumeSingleLookup(profile);
          });
        }
      }
    };

    // 최초 렌더링
    await renderContent();

    // refreshViews 발생 시 호출될 강제 새로고침 리스너 바인딩
    container.addEventListener('sp-refresh', async () => {
      await renderContent();
    });
  });
}
