export type TriggerStage = 'profile' | 'reference' | 'field';

export interface TriggerContext {
  stage: TriggerStage;
  profileId?: string;
  reference?: string;
  query: string;
  start: number;
}

const OPEN = '{{sp:';

// 커서 앞 한 줄 텍스트만으로 현재 {{sp:profileId/reference#field}} 토큰의 어느 단계를
// 작성 중인지 판별하는 순수 함수. Obsidian 의존성이 없어 vitest로 직접 테스트한다.
export function detectTriggerContext(lineTextBeforeCursor: string): TriggerContext | null {
  const openIdx = lineTextBeforeCursor.lastIndexOf(OPEN);
  if (openIdx === -1) return null;

  const afterOpen = lineTextBeforeCursor.slice(openIdx + OPEN.length);
  if (afterOpen.includes('}}')) return null;

  const hashIdx = afterOpen.indexOf('#');
  if (hashIdx !== -1) {
    const beforeHash = afterOpen.slice(0, hashIdx);
    const slashIdx = beforeHash.indexOf('/');
    if (slashIdx === -1) return null;

    const query = afterOpen.slice(hashIdx + 1);
    if (/\s/.test(query)) return null;

    return {
      stage: 'field',
      profileId: beforeHash.slice(0, slashIdx),
      reference: beforeHash.slice(slashIdx + 1),
      query,
      start: openIdx + OPEN.length + hashIdx + 1,
    };
  }

  const slashIdx = afterOpen.indexOf('/');
  if (slashIdx !== -1) {
    const query = afterOpen.slice(slashIdx + 1);
    if (/\s/.test(query)) return null;

    return {
      stage: 'reference',
      profileId: afterOpen.slice(0, slashIdx),
      query,
      start: openIdx + OPEN.length + slashIdx + 1,
    };
  }

  if (/\s/.test(afterOpen)) return null;

  return { stage: 'profile', query: afterOpen, start: openIdx + OPEN.length };
}

export interface ProfileFieldTrigger {
  query: string;
  start: number;
}

// safe-passage 코드블록의 "profile:" 줄에서 커서 앞 텍스트만으로 프로필 후보 검색어를
// 판별하는 순수 함수. 실제로 코드펜스 내부인지는 isInsideSafePassageBlock으로 별도 확인한다.
export function detectProfileFieldTrigger(lineTextBeforeCursor: string): ProfileFieldTrigger | null {
  const match = lineTextBeforeCursor.match(/^(\s*profile:\s*)(\S*)$/);
  if (!match) return null;

  return { query: match[2], start: match[1].length };
}

// 주어진 줄 번호가 ```safe-passage 코드펜스 내부에 있는지 판별한다. 가장 가까운 이전
// 펜스 라인(```로 시작)이 열림/닫힘 중 어느 쪽인지로 판단한다(펜스는 중첩되지 않는다는
// 전제).
export function isInsideSafePassageBlock(lines: string[], lineIndex: number): boolean {
  for (let i = lineIndex - 1; i >= 0; i--) {
    const trimmed = lines[i].trim();
    if (trimmed.startsWith('```')) {
      const lang = trimmed.slice(3).trim().split(/\s+/)[0]?.toLowerCase() ?? '';
      return lang === 'safe-passage';
    }
  }
  return false;
}

interface BlockBounds {
  startLine: number;
  endLine: number;
}

function findSafePassageBlockBounds(lines: string[], lineIndex: number): BlockBounds | null {
  let startLine = -1;
  for (let i = lineIndex - 1; i >= 0; i--) {
    const trimmed = lines[i].trim();
    if (trimmed.startsWith('```')) {
      const lang = trimmed.slice(3).trim().split(/\s+/)[0]?.toLowerCase() ?? '';
      if (lang === 'safe-passage') startLine = i;
      break;
    }
  }
  if (startLine === -1) return null;

  let endLine = lines.length;
  for (let i = lineIndex; i < lines.length; i++) {
    if (lines[i].trim() === '```') {
      endLine = i;
      break;
    }
  }

  return { startLine, endLine };
}

// 주어진 줄이 safe-passage 코드블록의 entries: 섹션에 속하는지 판별한다(가장 가까운
// 이전 섹션 헤더가 title:/profile:/fields: 중 하나가 아니라 entries:여야 함).
export function isEntriesListLine(lines: string[], lineIndex: number): boolean {
  const bounds = findSafePassageBlockBounds(lines, lineIndex);
  if (!bounds) return false;

  for (let i = lineIndex - 1; i > bounds.startLine; i--) {
    const headerMatch = lines[i].trim().match(/^(title|profile|fields|entries):/);
    if (headerMatch) return headerMatch[1] === 'entries';
  }
  return false;
}

export interface EntriesListTrigger {
  query: string;
  start: number;
  profileId: string | null;
}

// safe-passage 코드블록의 entries: 리스트 항목("- ...")에서 커서 앞 텍스트만으로 검색어를
// 판별한다. entries: 섹션이 아니면 트리거하지 않고, 같은 블록 안 어디에 있든 profile:
// 값을 찾아 함께 반환한다.
export function findEntriesListTrigger(
  lines: string[],
  lineIndex: number,
  lineTextBeforeCursor: string
): EntriesListTrigger | null {
  if (!isEntriesListLine(lines, lineIndex)) return null;

  const itemMatch = lineTextBeforeCursor.match(/^(\s*-\s*)(\S*)$/);
  if (!itemMatch) return null;

  const bounds = findSafePassageBlockBounds(lines, lineIndex);
  if (!bounds) return null;

  let profileId: string | null = null;
  for (let i = bounds.startLine + 1; i < bounds.endLine; i++) {
    const profileMatch = lines[i].trim().match(/^profile:\s*(\S*)/);
    if (profileMatch) {
      profileId = profileMatch[1];
      break;
    }
  }

  return { query: itemMatch[2], start: itemMatch[1].length, profileId };
}

// safe-passage 코드블록의 entries: 리스트 항목 줄 끝에서 Enter를 눌렀을 때 삽입할
// 문자열을 계산한다. Obsidian 자체의 "스마트 리스트" 기능이 코드펜스 안 텍스트도 마크다운
// 리스트로 오인해서 Enter를 누를 때마다 들여쓰기가 계속 늘어나는 문제가 있어서, 이 함수가
// null이 아닌 값을 반환하면 호출부(키맵)가 Obsidian 기본 처리 대신 이 문자열을 직접
// 삽입하고 이벤트를 소비한다. 조건에 맞지 않으면 null을 반환해 기본 동작에 맡긴다.
export function computeEntriesListContinuation(
  lines: string[],
  lineIndex: number,
  cursorCh: number
): string | null {
  const line = lines[lineIndex];
  if (line === undefined || cursorCh !== line.length) return null;

  const match = line.match(/^(\s*)-\s/);
  if (!match) return null;

  const content = line.slice(match[0].length).trim();
  if (!content) return null;

  if (!isEntriesListLine(lines, lineIndex)) return null;

  return `\n${match[1]}-`;
}
