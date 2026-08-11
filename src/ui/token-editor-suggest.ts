import { Editor, EditorPosition, EditorSuggest, EditorSuggestContext, EditorSuggestTriggerInfo, TFile } from 'obsidian';
import SafePassagePlugin from '../main';
import { KeePassEntryInfo, ProfileConfig } from '../types';
import { getProfileByIdOrName } from './chip-component';
import { detectTriggerContext, detectProfileFieldTrigger, isInsideSafePassageBlock, findEntriesListTrigger, TriggerContext } from './token-trigger';
import { fullEntryPath } from '../services/kdbx-service';
import { t } from '../i18n/i18n';

type SuggestItem =
  | { kind: 'profile'; profile: ProfileConfig }
  | { kind: 'locked'; profile: ProfileConfig }
  | { kind: 'entry'; entry: KeePassEntryInfo }
  | { kind: 'field'; fieldName: string };

// {{sp:...}} 토큰 작성 중인지, safe-passage 코드블록의 "profile:" 필드나 entries: 리스트
// 항목을 작성 중인지를 함께 판별한 결과. onTrigger/getSuggestions/selectSuggestion에서
// 매번 다시 계산해서 쓴다(별도 상태를 저장하지 않아 popup이 재사용돼도 어긋날 일이 없다).
type ResolvedTrigger =
  | { kind: 'token'; trigger: TriggerContext }
  | { kind: 'blockProfile'; query: string; start: number }
  | { kind: 'entriesList'; query: string; start: number; profileId: string | null };

function resolveTrigger(editor: Editor, cursor: EditorPosition): ResolvedTrigger | null {
  const lineBeforeCursor = editor.getLine(cursor.line).slice(0, cursor.ch);

  const tokenTrigger = detectTriggerContext(lineBeforeCursor);
  if (tokenTrigger) return { kind: 'token', trigger: tokenTrigger };

  const lines = editor.getValue().split('\n');

  const profileFieldTrigger = detectProfileFieldTrigger(lineBeforeCursor);
  if (profileFieldTrigger && isInsideSafePassageBlock(lines, cursor.line)) {
    return { kind: 'blockProfile', query: profileFieldTrigger.query, start: profileFieldTrigger.start };
  }

  const entriesListTrigger = findEntriesListTrigger(lines, cursor.line, lineBeforeCursor);
  if (entriesListTrigger) {
    return { kind: 'entriesList', ...entriesListTrigger };
  }

  return null;
}

function samePosition(a: EditorPosition, b: EditorPosition): boolean {
  return a.line === b.line && a.ch === b.ch;
}

const MAX_SUGGESTIONS = 50;

export class TokenEditorSuggest extends EditorSuggest<SuggestItem> {
  private plugin: SafePassagePlugin;
  // 마지막으로 값을 채워 넣고 "끝난" 위치. 자동 괄호 닫기 트릭(공백 삽입)은 Obsidian의
  // 리스트 자동 들여쓰기가 줄 끝 공백을 보고 Enter를 하위 리스트 시작으로 오해하는 부작용이
  // 있어서, 대신 이 위치에서만 재트리거를 억제한다 — 커서가 조금이라도 움직이면 자연히
  // 풀린다.
  private suppressedPosition: EditorPosition | null = null;

  constructor(plugin: SafePassagePlugin) {
    super(plugin.app);
    this.plugin = plugin;
  }

  onTrigger(cursor: EditorPosition, editor: Editor, file: TFile | null): EditorSuggestTriggerInfo | null {
    if (!file) return null;

    if (this.suppressedPosition && samePosition(cursor, this.suppressedPosition)) {
      return null;
    }
    this.suppressedPosition = null;

    const resolved = resolveTrigger(editor, cursor);
    if (!resolved) return null;

    const start = resolved.kind === 'token' ? resolved.trigger.start : resolved.start;
    const query = resolved.kind === 'token' ? resolved.trigger.query : resolved.query;

    return {
      start: { line: cursor.line, ch: start },
      end: cursor,
      query,
    };
  }

  getSuggestions(context: EditorSuggestContext): SuggestItem[] {
    const resolved = resolveTrigger(context.editor, context.end);
    if (!resolved) return [];

    if (resolved.kind === 'blockProfile') {
      return this.suggestProfiles(resolved.query);
    }

    if (resolved.kind === 'entriesList') {
      return this.suggestEntries(resolved.profileId, resolved.query);
    }

    const trigger = resolved.trigger;

    if (trigger.stage === 'profile') {
      return this.suggestProfiles(trigger.query);
    }

    if (trigger.stage === 'reference') {
      return this.suggestEntries(trigger.profileId ?? null, trigger.query);
    }

    // field 단계
    const profile = getProfileByIdOrName(this.plugin, trigger.profileId ?? '');
    if (!profile) return [];

    if (!this.plugin.kdbxService.isUnlocked(profile.id)) {
      // 조용히 빈 목록을 반환하면 왜 후보가 안 뜨는지 알 수 없으므로, 클릭 한 번으로
      // 바로 잠금 해제할 수 있는 항목을 보여준다.
      return [{ kind: 'locked', profile }];
    }

    const entry = this.plugin.kdbxService.getEntry(profile.id, trigger.reference ?? '');
    if (!entry) return [];

    const query = trigger.query.toLowerCase();
    return Object.keys(entry.fields)
      .filter(name => name.toLowerCase().includes(query))
      .map(fieldName => ({ kind: 'field', fieldName }));
  }

  private suggestProfiles(query: string): SuggestItem[] {
    const lowerQuery = query.toLowerCase();
    return Object.values(this.plugin.settings.profiles)
      .filter(p => p.id.toLowerCase().includes(lowerQuery) || p.name.toLowerCase().includes(lowerQuery))
      .map(profile => ({ kind: 'profile', profile }));
  }

  private suggestEntries(profileIdOrName: string | null, query: string): SuggestItem[] {
    const profile = getProfileByIdOrName(this.plugin, profileIdOrName ?? '');
    if (!profile) return [];

    if (!this.plugin.kdbxService.isUnlocked(profile.id)) {
      // 조용히 빈 목록을 반환하면 왜 후보가 안 뜨는지 알 수 없으므로, 클릭 한 번으로
      // 바로 잠금 해제할 수 있는 항목을 보여준다.
      return [{ kind: 'locked', profile }];
    }

    const entries = query
      ? this.plugin.kdbxService.findEntries(profile.id, query)
      : this.plugin.kdbxService.getAllEntries(profile.id);
    return entries.slice(0, MAX_SUGGESTIONS).map(entry => ({ kind: 'entry', entry }));
  }

  renderSuggestion(item: SuggestItem, el: HTMLElement): void {
    if (item.kind === 'profile') {
      el.createDiv({ text: item.profile.name });
      el.createDiv({ text: item.profile.id, cls: 'sp-suggest-path' });
    } else if (item.kind === 'locked') {
      el.createDiv({ text: `🔒 ${t('PROFILE_LOCKED', { profileName: item.profile.name })}` });
      el.createDiv({ text: t('PROFILE_LOCKED_DESC'), cls: 'sp-suggest-path' });
    } else if (item.kind === 'entry') {
      el.createDiv({ text: item.entry.title });
      if (item.entry.groupPath) {
        el.createDiv({ text: fullEntryPath(item.entry), cls: 'sp-suggest-path' });
      }
    } else {
      el.createDiv({ text: item.fieldName });
    }
  }

  selectSuggestion(item: SuggestItem): void {
    if (!this.context) return;
    const { editor, start, end } = this.context;

    if (item.kind === 'profile') {
      const resolved = resolveTrigger(editor, end);
      if (resolved?.kind === 'blockProfile') {
        // 코드블록의 profile: 필드는 {{sp:...}} 토큰이 아니므로 다음 단계로 잇지 않는다.
        this.insertAndStop(editor, start, end, item.profile.id);
      } else {
        this.insertAndContinue(editor, start, end, item.profile.id, '/');
      }
    } else if (item.kind === 'locked') {
      // 아무것도 입력하지 않고, 잠금 해제 모달만 띄운 뒤 커서를 원래 위치로 되돌려
      // 이어서 타이핑하면 자동완성이 다시 트리거되게 한다.
      void this.requestUnlock(item.profile, editor, end);
    } else if (item.kind === 'entry') {
      // 이번 세션에서 확립한 방향대로, 에디터에서 선택한 엔트리는 path가 아니라 UUID
      // 참조로 삽입한다 — 이름 변경/그룹 이동에도 참조가 깨지지 않는다.
      const resolved = resolveTrigger(editor, end);
      if (resolved?.kind === 'entriesList') {
        // entries: 리스트 항목은 field 단계로 잇지 않는다.
        this.insertAndStop(editor, start, end, `uuid:${item.entry.uuid}`);
      } else {
        this.insertAndContinue(editor, start, end, `uuid:${item.entry.uuid}`, '#');
      }
    } else {
      this.insertAndContinue(editor, start, end, item.fieldName, '}}');
    }
  }

  private async requestUnlock(profile: ProfileConfig, editor: Editor, cursorAfter: EditorPosition): Promise<void> {
    await this.plugin.unlockProfile(profile);
    editor.focus();
    editor.setCursor(cursorAfter);
  }

  // 값을 삽입하고 그걸로 끝 — 다음 단계로 잇지 않는다. 뒤에 아무 문자도 남기지 않으므로
  // (트레일링 공백 등으로 Obsidian의 리스트 자동 들여쓰기를 건드리지 않는다), 삽입 직후
  // 위치에서만 재트리거를 억제해 팝업이 곧바로 다시 뜨지 않게 한다.
  private insertAndStop(editor: Editor, start: EditorPosition, end: EditorPosition, value: string): void {
    editor.replaceRange(value, start, end);
    const afterValue: EditorPosition = { line: start.line, ch: start.ch + value.length };
    editor.setCursor(afterValue);
    this.suppressedPosition = afterValue;
  }

  // 선택한 값을 삽입한 뒤, 다음 단계로 바로 이어지도록 구분자까지 자동으로 입력하고
  // 커서를 그 뒤로 옮긴다 (profile→'/', entry→'#', field→'}}').
  private insertAndContinue(
    editor: Editor,
    start: EditorPosition,
    end: EditorPosition,
    value: string,
    separator: string
  ): void {
    editor.replaceRange(value, start, end);
    const afterValue: EditorPosition = { line: start.line, ch: start.ch + value.length };

    // 에디터의 자동 괄호 닫기(예: '{{' 입력 시 '}}'가 커서 뒤에 즉시 따라붙음)로 구분자가
    // 이미 있는 경우, 중복 삽입하지 않고 그 뒤로 커서만 옮긴다.
    const restOfLine = editor.getLine(afterValue.line).slice(afterValue.ch);
    if (restOfLine.startsWith(separator)) {
      editor.setCursor({ line: afterValue.line, ch: afterValue.ch + separator.length });
      return;
    }

    editor.replaceRange(separator, afterValue, afterValue);
    editor.setCursor({ line: afterValue.line, ch: afterValue.ch + separator.length });
  }
}
