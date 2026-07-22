import { setIcon, Notice } from 'obsidian';
import SafePassagePlugin from '../main';
import { t } from '../i18n/i18n';
import { ProfileConfig } from '../types';

export interface TokenParseResult {
  raw: string;
  profileId: string;
  entryPath: string;
  fieldName: string;
}

export function parseToken(raw: string): TokenParseResult | null {
  // {{sp:profileId/Group/Entry#FieldName}} 형식 파싱
  const match = raw.match(/^\{\{sp:([^/]+)\/(.+?)#([^}]+)\}\}$/);
  if (!match) return null;

  return {
    raw,
    profileId: match[1]!,
    entryPath: match[2]!,
    fieldName: match[3]!
  };
}

export function getProfileByIdOrName(
  plugin: SafePassagePlugin,
  identifier: string
): ProfileConfig | null {
  const lowerId = identifier.toLowerCase();
  
  // 1. ID 직접 확인
  if (plugin.settings.profiles[lowerId]) {
    return plugin.settings.profiles[lowerId] as ProfileConfig;
  }
  
  // 2. 이름 매칭 확인
  const profiles = Object.values(plugin.settings.profiles) as ProfileConfig[];
  const found = profiles.find(p => p.name.toLowerCase() === lowerId);
  return found ?? null;
}

export function buildChipElement(
  token: TokenParseResult,
  plugin: SafePassagePlugin
): HTMLElement {
  const chip = document.createElement('span');
  chip.classList.add('sp-chip');
  
  const iconSpan = chip.createSpan({ cls: 'sp-chip-icon' });
  setIcon(iconSpan, 'key');

  const profile = getProfileByIdOrName(plugin, token.profileId);
  console.log(`[SafePassage] buildChipElement() - 토큰 프로필ID: ${token.profileId}, 찾은 프로필 객체:`, profile);
  
  if (!profile) {
    // 프로필 정보가 없는 에러 상태
    chip.classList.add('warning');
    chip.createSpan({ text: `⚠ ${t('MISSING_PROFILE', { profileId: token.profileId })}` });
    chip.title = t('MISSING_PROFILE_DESC', { profileId: token.profileId });
    return chip;
  }

  const isUnlocked = plugin.kdbxService.isUnlocked(profile.id);

  if (!isUnlocked) {
    // 잠겨있는 상태
    chip.classList.add('locked');
    const entryName = token.entryPath.split('/').pop() ?? token.entryPath;
    const displayText = `${profile.name}: ${entryName}#${token.fieldName} (🔒)`;
    chip.createSpan({ text: displayText });
    chip.title = t('PROFILE_LOCKED_DESC');

    chip.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      const success = await plugin.unlockProfile(profile);
      if (success) {
        // 성공 시 칩 상태 리프레시 (노트 강제 업데이트 유도)
        plugin.refreshViews();
      }
    });
    return chip;
  }

  // 잠금 해제된 상태에서 실제 엔트리 로드
  const entry = plugin.kdbxService.getEntry(profile.id, token.entryPath);

  if (!entry) {
    // 엔트리가 존재하지 않는 에러 상태
    chip.classList.add('warning');
    const entryNameText = token.entryPath.split('/').pop() ?? '';
    chip.createSpan({ text: `⚠ ${t('MISSING_ENTRY', { entryName: entryNameText })}` });
    chip.title = t('MISSING_ENTRY_DESC', { entryPath: token.entryPath });
    return chip;
  }

  const value = entry.fields[token.fieldName];

  if (value === undefined) {
    // 필드가 존재하지 않는 에러 상태 (계획서 요구사항 준수)
    chip.classList.add('warning');
    chip.createSpan({ text: `⚠ ${t('MISSING_FIELD', { fieldName: token.fieldName })}` });
    chip.title = t('MISSING_FIELD_DESC', { fieldName: token.fieldName });

    chip.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      new Notice(t('MISSING_FIELD_NOTICE', { fieldName: token.fieldName }));
    });
    return chip;
  }

  // 정상적인 칩 표시
  chip.createSpan({ text: `${entry.title} (${token.fieldName})` });
  chip.title = t('CLICK_TO_COPY');

  chip.addEventListener('click', async (e) => {
    e.preventDefault();
    e.stopPropagation();

    // 복사할 값 가져오기
    let valToCopy = value;
    if (token.fieldName.toLowerCase() === 'password') {
      valToCopy = entry.getPassword();
    }

    await plugin.clipboardService.copyText(valToCopy, plugin.settings.clipboardClearSeconds);
    plugin.sessionService.consumeSingleLookup(profile);
  });

  return chip;
}
