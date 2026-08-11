import { setIcon, Notice } from 'obsidian';
import SafePassagePlugin from '../main';
import { t } from '../i18n/i18n';
import { ProfileConfig } from '../types';
import { isUuidReference, UUID_REFERENCE_PREFIX, fullEntryPath } from '../services/kdbx-service';

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
    profileId: match[1],
    entryPath: match[2],
    fieldName: match[3]
  };
}

// path 참조는 마지막 세그먼트(엔트리 제목)를 표시명으로 쓴다. uuid 참조는 엔트리를 실제로
// resolve하기 전까지는 사람이 읽을 수 있는 이름을 알 방법이 없으므로(잠긴 DB 등), base64
// UUID 전체를 그대로 노출하는 대신 앞부분만 짧게 잘라 보여준다(git short hash와 동일한
// 발상 — 눈에 거슬리지 않으면서도 서로 다른 엔트리를 구분은 할 수 있게).
export function getReferenceLabel(reference: string): string {
  if (isUuidReference(reference)) {
    const id = reference.slice(UUID_REFERENCE_PREFIX.length);
    return id.length > 8 ? `${id.slice(0, 8)}…` : id;
  }
  return reference.split('/').pop() ?? reference;
}

export function getProfileByIdOrName(
  plugin: SafePassagePlugin,
  identifier: string
): ProfileConfig | null {
  const lowerId = identifier.toLowerCase();
  
  // 1. ID 직접 확인
  if (plugin.settings.profiles[lowerId]) {
    return plugin.settings.profiles[lowerId];
  }

  // 2. 이름 매칭 확인
  const profiles = Object.values(plugin.settings.profiles);
  const found = profiles.find(p => p.name.toLowerCase() === lowerId);
  return found ?? null;
}

export function buildChipElement(
  token: TokenParseResult,
  plugin: SafePassagePlugin
): HTMLElement {
  const chip = createSpan({ cls: 'sp-chip' });

  const iconSpan = chip.createSpan({ cls: 'sp-chip-icon' });
  setIcon(iconSpan, 'key');

  const profile = getProfileByIdOrName(plugin, token.profileId);

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
    const entryName = getReferenceLabel(token.entryPath);
    const displayText = `${profile.name}: ${entryName}#${token.fieldName} (🔒)`;
    chip.createSpan({ text: displayText });
    chip.title = t('PROFILE_LOCKED_DESC');

    chip.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      void (async () => {
        const success = await plugin.unlockProfile(profile);
        if (success) {
          // 성공 시 칩 상태 리프레시 (노트 강제 업데이트 유도)
          plugin.refreshViews();
        }
      })();
    });
    return chip;
  }

  // 잠금 해제된 상태에서 실제 엔트리 로드
  const entry = plugin.kdbxService.getEntry(profile.id, token.entryPath);

  if (!entry) {
    // 엔트리가 존재하지 않는 에러 상태
    chip.classList.add('warning');
    const entryNameText = getReferenceLabel(token.entryPath);
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

  // 정상적인 칩 표시 (그룹 아래 있는 엔트리도 구분할 수 있도록 전체 경로를 보여준다)
  chip.createSpan({ text: `${fullEntryPath(entry)} (${token.fieldName})` });
  chip.title = t('CLICK_TO_COPY');

  chip.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();

    void (async () => {
      // 복사할 값 가져오기
      let valToCopy = value;
      if (token.fieldName.toLowerCase() === 'password') {
        valToCopy = entry.getPassword();
      }

      await plugin.clipboardService.copyText(valToCopy, plugin.settings.clipboardClearSeconds);
      plugin.sessionService.consumeSingleLookup(profile);
    })();
  });

  return chip;
}
