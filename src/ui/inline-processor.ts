import { MarkdownPostProcessorContext } from 'obsidian';
import SafePassagePlugin from '../main';
import { parseToken, buildChipElement } from './chip-component';

/**
 * DOM 트리 상에서 인접 노드 쪼개짐 현상과 관계없이 선형화된 텍스트 위치를 찾아 Range API로 칩으로 치환하는 헬퍼 함수
 */
function replaceTextWithWidget(el: HTMLElement, targetText: string, widget: HTMLElement): boolean {
  const doc = el.ownerDocument;
  const walk = doc.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  let node: Node | null;

  let accumulatedText = "";
  const nodes: { node: Node; start: number; end: number }[] = [];

  while ((node = walk.nextNode())) {
    const text = node.nodeValue ?? "";
    const start = accumulatedText.length;
    accumulatedText += text;
    nodes.push({ node, start, end: accumulatedText.length });
  }

  const index = accumulatedText.indexOf(targetText);
  if (index === -1) return false;

  const targetEnd = index + targetText.length;

  let startNodeInfo = nodes.find(n => index >= n.start && index < n.end);
  let endNodeInfo = nodes.find(n => targetEnd > n.start && targetEnd <= n.end);

  if (!startNodeInfo || !endNodeInfo) return false;

  try {
    const range = doc.createRange();
    range.setStart(startNodeInfo.node, index - startNodeInfo.start);
    range.setEnd(endNodeInfo.node, targetEnd - endNodeInfo.start);

    // 지정된 텍스트 범위 삭제 후 칩 엘리먼트 주입
    range.deleteContents();
    range.insertNode(widget);

    // 부모가 <code> 태그인 경우 인라인 코드 네모 박스 스타일 중화
    const parent = widget.parentElement;
    if (parent && parent.tagName === 'CODE') {
      parent.addClass('sp-code-override');
    }
    return true;
  } catch (e) {
    console.error("[SafePassage] Range 치환 중 오류:", e);
    return false;
  }
}

export function registerInlineProcessor(plugin: SafePassagePlugin): void {
  // 읽기 모드 포스트 프로세서 등록 (sortOrder를 -10000으로 주어 텍스트 조각화 전에 최우선 처리)
  plugin.registerMarkdownPostProcessor((el: HTMLElement, ctx: MarkdownPostProcessorContext) => {
    // 1. 쪼개진 인접 텍스트 노드가 있을 수 있으므로 1차 병합
    el.normalize();

    // 2. 전체 문자열 추출하여 토큰 포함 여부 판단
    const text = el.textContent ?? '';
    if (!text.includes('{{sp:')) return;

    console.log("[SafePassage] 읽기 모드 포스트 프로세서(inline-processor) 시작");

    const regex = /\{\{sp:([^/]+)\/(.+?)#([^}]+)\}\}/g;
    let match;

    // 매칭되는 토큰들을 일단 전부 스캔하여 수집
    const tokens: string[] = [];
    while ((match = regex.exec(text)) !== null) {
      tokens.push(match[0]);
    }

    // 각 수집된 토큰을 DOM 상에서 찾아 순차적으로 칩 엘리먼트로 교체
    for (const rawToken of tokens) {
      console.log(`[SafePassage] 찾은 토큰 치환 시도: ${rawToken}`);
      const parsed = parseToken(rawToken);
      if (parsed) {
        const chip = buildChipElement(parsed, plugin);
        const success = replaceTextWithWidget(el, rawToken, chip);
        console.log(`[SafePassage] 토큰 치환 결과: ${success}`);
      }
    }
  }, -10000);
}
