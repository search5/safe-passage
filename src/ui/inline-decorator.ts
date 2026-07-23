import { editorLivePreviewField } from 'obsidian';
import { Decoration, DecorationSet, EditorView, ViewPlugin, ViewUpdate, WidgetType } from '@codemirror/view';
import { Extension, RangeSetBuilder, StateEffect } from '@codemirror/state';
import { parseToken, buildChipElement, TokenParseResult, getProfileByIdOrName } from './chip-component';
import SafePassagePlugin from '../main';

export const refreshChipsEffect = StateEffect.define<void>();

// registerEditorExtension()이 공식적으로 넘겨주는 EditorView들을 자체 등록해두고,
// 외부(main.ts)에서 Obsidian의 비공개 Editor.cm에 접근하지 않고도 dispatch할 수 있게 함
const activeEditorViews = new Set<EditorView>();

export function getActiveEditorViews(): EditorView[] {
  return Array.from(activeEditorViews);
}

class SpTokenWidget extends WidgetType {
  private readonly isUnlockedSnapshot: boolean;

  constructor(
    private readonly token: TokenParseResult,
    private readonly plugin: SafePassagePlugin
  ) {
    super();
    const profile = getProfileByIdOrName(this.plugin, this.token.profileId);
    this.isUnlockedSnapshot = profile ? this.plugin.kdbxService.isUnlocked(profile.id) : false;
  }

  toDOM(): HTMLElement {
    return buildChipElement(this.token, this.plugin);
  }

  eq(other: SpTokenWidget): boolean {
    return this.token.raw === other.token.raw && this.isUnlockedSnapshot === other.isUnlockedSnapshot;
  }

  ignoreEvent(): boolean {
    return true;
  }
}

function parseTokensFromText(text: string): { from: number; to: number; token: TokenParseResult }[] {
  const results: { from: number; to: number; token: TokenParseResult }[] = [];
  const regex = /\{\{sp:([^/]+)\/(.+?)#([^}]+)\}\}/g;
  let match;

  while ((match = regex.exec(text)) !== null) {
    const raw = match[0];
    const parsed = parseToken(raw);
    if (parsed) {
      results.push({
        from: match.index,
        to: match.index + raw.length,
        token: parsed,
      });
    }
  }

  return results;
}

function buildDecorations(view: EditorView, plugin: SafePassagePlugin): DecorationSet {
  const isLivePreview = view.state.field(editorLivePreviewField, false) ?? false;
  const builder = new RangeSetBuilder<Decoration>();
  const cursorPos = view.state.selection.main.head;

  for (const { from, to } of view.visibleRanges) {
    const text = view.state.doc.sliceString(from, to);
    const tokens = parseTokensFromText(text);

    for (const token of tokens) {
      const absFrom = from + token.from;
      const absTo = from + token.to;
      
      // 커서가 토큰 영역 바로 안에 있으면 원본 텍스트를 편집할 수 있게 데코레이터를 적용하지 않음
      const tokenSelected = cursorPos >= absFrom && cursorPos <= absTo;
      if (tokenSelected) continue;

      if (isLivePreview) {
        builder.add(
          absFrom,
          absTo,
          Decoration.replace({ widget: new SpTokenWidget(token.token, plugin) })
        );
      } else {
        builder.add(
          absFrom,
          absTo,
          Decoration.mark({ class: 'sp-token-source' })
        );
      }
    }
  }

  return builder.finish();
}

export function buildEditorExtension(plugin: SafePassagePlugin): Extension {
  return ViewPlugin.fromClass(
    class {
      decorations: DecorationSet;
      private readonly view: EditorView;

      constructor(view: EditorView) {
        this.view = view;
        this.decorations = buildDecorations(view, plugin);
        activeEditorViews.add(view);
      }

      update(update: ViewUpdate) {
        const hasRefreshEffect = update.transactions.some(tr =>
          tr.effects.some(e => e.is(refreshChipsEffect))
        );
        if (update.docChanged || update.viewportChanged || update.selectionSet || hasRefreshEffect) {
          this.decorations = buildDecorations(update.view, plugin);
        }
      }

      destroy() {
        activeEditorViews.delete(this.view);
      }
    },
    { decorations: v => v.decorations }
  );
}
