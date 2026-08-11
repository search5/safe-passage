import { keymap } from '@codemirror/view';
import { Extension, Prec } from '@codemirror/state';
import { computeEntriesListContinuation } from './token-trigger';

// Obsidian의 "스마트 리스트" 자동 들여쓰기가 safe-passage 코드펜스 안의 "- " 줄도
// 마크다운 리스트로 오인해서, entries: 항목 줄 끝에서 Enter를 누를 때마다 들여쓰기가
// 계속 늘어나는 문제가 있다(코드펜스 안 텍스트는 원래 리스트로 취급되면 안 됨). 이
// 확장은 그 상황에서만 Enter를 가로채 같은 들여쓰기로 "- "를 이어 입력하고, 그 외의
// 모든 경우는 false를 반환해 Obsidian의 기본 처리에 그대로 맡긴다.
export function buildEntriesListKeymap(): Extension {
  return Prec.highest(
    keymap.of([
      {
        key: 'Enter',
        run: (view) => {
          const { state } = view;
          const sel = state.selection.main;
          if (!sel.empty) return false;

          const cursorLine = state.doc.lineAt(sel.head);
          const lines = state.doc.toString().split('\n');
          const continuation = computeEntriesListContinuation(
            lines,
            cursorLine.number - 1,
            sel.head - cursorLine.from
          );
          if (continuation === null) return false;

          view.dispatch({
            changes: { from: sel.head, to: sel.head, insert: continuation },
            selection: { anchor: sel.head + continuation.length },
            scrollIntoView: true,
          });
          return true;
        },
      },
    ])
  );
}
