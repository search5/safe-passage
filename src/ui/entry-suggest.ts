import { App, AbstractInputSuggest } from 'obsidian';
import { KeePassEntryInfo } from '../types';
import { KdbxService, fullEntryPath } from '../services/kdbx-service';

export class EntryInputSuggest extends AbstractInputSuggest<KeePassEntryInfo> {
  constructor(
    app: App,
    private textInputEl: HTMLInputElement,
    private kdbxService: KdbxService,
    private getProfileId: () => string | undefined,
    private onPick: (entry: KeePassEntryInfo) => void
  ) {
    super(app, textInputEl);
  }

  protected getSuggestions(query: string): KeePassEntryInfo[] {
    const profileId = this.getProfileId();
    // 프로필이 없거나 잠겨 있으면 후보를 조회할 수 없으므로 빈 배열을 반환한다.
    // 드롭다운이 그냥 비어 있게 되어 기존처럼 자유 텍스트 입력이 자연히 허용된다.
    if (!profileId || !this.kdbxService.isUnlocked(profileId)) return [];

    const entries = query
      ? this.kdbxService.findEntries(profileId, query)
      : this.kdbxService.getAllEntries(profileId);

    return entries.slice(0, 50);
  }

  renderSuggestion(entry: KeePassEntryInfo, el: HTMLElement): void {
    el.createDiv({ text: entry.title });
    if (entry.groupPath) {
      el.createDiv({ text: fullEntryPath(entry), cls: 'sp-suggest-path' });
    }
  }

  selectSuggestion(entry: KeePassEntryInfo): void {
    this.setValue(fullEntryPath(entry));
    this.close();
    this.onPick(entry);
  }
}
