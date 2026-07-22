import { Notice } from 'obsidian';
import { t } from '../i18n/i18n';

export class ClipboardService {
  private clearTimer: ReturnType<typeof setTimeout> | null = null;
  private lastCopiedValue: string | null = null;

  async copyText(text: string, clearSeconds: number): Promise<void> {
    try {
      await navigator.clipboard.writeText(text);
      this.lastCopiedValue = text;

      if (this.clearTimer) {
        clearTimeout(this.clearTimer);
        this.clearTimer = null;
      }

      if (clearSeconds > 0) {
        new Notice(t('COPIED_TIMEOUT', { seconds: clearSeconds }), 3000);
        this.clearTimer = setTimeout(async () => {
          try {
            // 현재 클립보드에 있는 값이 우리가 복사한 값과 동일할 때만 지움
            const currentText = await navigator.clipboard.readText();
            if (currentText === this.lastCopiedValue) {
              await navigator.clipboard.writeText('');
              new Notice(t('CLIPBOARD_CLEARED'), 3000);
            }
          } catch (err) {
            // readText()가 차단되거나 모바일 환경에 의해 오류 발생 시 무조건 공백 쓰기 시도
            await navigator.clipboard.writeText('');
          }
        }, clearSeconds * 1000);
      } else {
        new Notice(t('COPIED'), 3000);
      }
    } catch (err) {
      new Notice(t('CLIPBOARD_FAILED'), 5000);
      console.error('클립보드 복사 실패:', err);
    }
  }

  clearPending() {
    if (this.clearTimer) {
      clearTimeout(this.clearTimer);
      this.clearTimer = null;
    }
    this.lastCopiedValue = null;
  }
}
