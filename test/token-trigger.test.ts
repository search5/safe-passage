import { describe, expect, it } from 'vitest';
import { detectTriggerContext, detectProfileFieldTrigger, isInsideSafePassageBlock, findEntriesListTrigger, computeEntriesListContinuation } from '../src/ui/token-trigger';

describe('detectTriggerContext', () => {
  it('returns null when there is no {{sp: on the line', () => {
    expect(detectTriggerContext('just some regular text')).toBeNull();
  });

  it('detects the profile stage right after {{sp:', () => {
    const result = detectTriggerContext('{{sp:wo');

    expect(result).toEqual({ stage: 'profile', query: 'wo', start: 5 });
  });

  it('detects the reference stage after profileId/', () => {
    const result = detectTriggerContext('{{sp:p1/Fin');

    expect(result).toEqual({ stage: 'reference', profileId: 'p1', query: 'Fin', start: 8 });
  });

  it('detects the field stage after profileId/reference#', () => {
    const result = detectTriggerContext('{{sp:p1/Finance/API#Pas');

    expect(result).toEqual({
      stage: 'field',
      profileId: 'p1',
      reference: 'Finance/API',
      query: 'Pas',
      start: 20,
    });
  });

  it('returns null once the token is already closed before the cursor', () => {
    expect(detectTriggerContext('{{sp:p1/Fin#Password}} rest')).toBeNull();
  });

  it('still triggers on the most recent {{sp: occurrence on the line', () => {
    const result = detectTriggerContext('{{sp:p1/Fin#Password}} typing here {{sp:p2/');

    expect(result).toEqual({ stage: 'reference', profileId: 'p2', query: '', start: 43 });
  });

  it('returns null when the profile-stage query contains whitespace', () => {
    expect(detectTriggerContext('{{sp:hello world')).toBeNull();
  });

  it('returns null when the reference-stage query contains whitespace', () => {
    expect(detectTriggerContext('{{sp:p1/hello world')).toBeNull();
  });

  it('returns null when the field-stage query contains whitespace', () => {
    expect(detectTriggerContext('{{sp:p1/Fin#hello world')).toBeNull();
  });

  it('returns null for a malformed field stage with no profileId/reference separator', () => {
    expect(detectTriggerContext('{{sp:p1#Pas')).toBeNull();
  });
});

describe('detectProfileFieldTrigger', () => {
  it('detects a query right after "profile:"', () => {
    expect(detectProfileFieldTrigger('profile:wo')).toEqual({ query: 'wo', start: 8 });
  });

  it('tolerates leading indentation and a space after the colon', () => {
    expect(detectProfileFieldTrigger('  profile: jiho')).toEqual({ query: 'jiho', start: 11 });
  });

  it('detects an empty query right after "profile:"', () => {
    expect(detectProfileFieldTrigger('profile:')).toEqual({ query: '', start: 8 });
  });

  it('returns null for lines that are not the profile field', () => {
    expect(detectProfileFieldTrigger('entries:')).toBeNull();
    expect(detectProfileFieldTrigger('  - Finance/API/OpenAI')).toBeNull();
  });

  it('returns null once the query contains whitespace', () => {
    expect(detectProfileFieldTrigger('profile: work db')).toBeNull();
  });
});

describe('isInsideSafePassageBlock', () => {
  it('is true right after an opening ```safe-passage fence', () => {
    const lines = ['before', '```safe-passage', 'profile:'];
    expect(isInsideSafePassageBlock(lines, 2)).toBe(true);
  });

  it('is false before any fence has been opened', () => {
    const lines = ['profile:'];
    expect(isInsideSafePassageBlock(lines, 0)).toBe(false);
  });

  it('is false once the block has been closed', () => {
    const lines = ['```safe-passage', 'profile: p1', '```', 'profile:'];
    expect(isInsideSafePassageBlock(lines, 3)).toBe(false);
  });

  it('is false inside a fenced block of a different language', () => {
    const lines = ['```yaml', 'profile:'];
    expect(isInsideSafePassageBlock(lines, 1)).toBe(false);
  });
});

describe('findEntriesListTrigger', () => {
  it('detects a list-item query under entries: and finds the profile above it', () => {
    const lines = ['```safe-passage', 'profile: p1', 'entries:', '  - Open'];

    expect(findEntriesListTrigger(lines, 3, '  - Open')).toEqual({
      query: 'Open',
      start: 4,
      profileId: 'p1',
    });
  });

  it('detects an empty query right after "- "', () => {
    const lines = ['```safe-passage', 'entries:', '- '];

    expect(findEntriesListTrigger(lines, 2, '- ')).toEqual({
      query: '',
      start: 2,
      profileId: null,
    });
  });

  it('returns profileId null when no profile: line exists in the block', () => {
    const lines = ['```safe-passage', 'entries:', '  - Open'];

    expect(findEntriesListTrigger(lines, 2, '  - Open')).toEqual({
      query: 'Open',
      start: 4,
      profileId: null,
    });
  });

  it('finds profile: even when it appears after the entries: list in the block', () => {
    const lines = ['```safe-passage', 'entries:', '  - Open', 'profile: p1'];

    expect(findEntriesListTrigger(lines, 2, '  - Open')?.profileId).toBe('p1');
  });

  it('returns null when the nearest section header above is not entries:', () => {
    const lines = ['```safe-passage', 'profile: p1', 'fields: [Password]', '  - Open'];

    expect(findEntriesListTrigger(lines, 3, '  - Open')).toBeNull();
  });

  it('returns null when not inside a safe-passage block', () => {
    const lines = ['- Open'];

    expect(findEntriesListTrigger(lines, 0, '- Open')).toBeNull();
  });

  it('returns null when the query contains whitespace', () => {
    const lines = ['```safe-passage', 'entries:', '  - Open AI'];

    expect(findEntriesListTrigger(lines, 2, '  - Open AI')).toBeNull();
  });

  it('returns null for a non-list line inside the entries: section', () => {
    const lines = ['```safe-passage', 'entries:', 'not a list item'];

    expect(findEntriesListTrigger(lines, 2, 'not a list item')).toBeNull();
  });
});

describe('computeEntriesListContinuation', () => {
  it('continues at the same indentation when Enter is pressed at the end of a list item', () => {
    const lines = ['```safe-passage', 'entries:', '  - uuid:xxx'];

    expect(computeEntriesListContinuation(lines, 2, lines[2].length)).toBe('\n  -');
  });

  it('preserves deeper indentation as-is (does not add extra levels)', () => {
    const lines = ['```safe-passage', 'entries:', '      - uuid:xxx'];

    expect(computeEntriesListContinuation(lines, 2, lines[2].length)).toBe('\n      -');
  });

  it('returns null when the cursor is not at the end of the line', () => {
    const lines = ['```safe-passage', 'entries:', '  - uuid:xxx'];

    expect(computeEntriesListContinuation(lines, 2, 4)).toBeNull();
  });

  it('returns null for an empty list item (lets Obsidian outdent as usual)', () => {
    const lines = ['```safe-passage', 'entries:', '  - '];

    expect(computeEntriesListContinuation(lines, 2, lines[2].length)).toBeNull();
  });

  it('returns null when not inside the entries: section', () => {
    const lines = ['```safe-passage', 'profile: p1', 'fields: [Password]', '  - uuid:xxx'];

    expect(computeEntriesListContinuation(lines, 3, lines[3].length)).toBeNull();
  });

  it('returns null when not inside a safe-passage block', () => {
    const lines = ['  - uuid:xxx'];

    expect(computeEntriesListContinuation(lines, 0, lines[0].length)).toBeNull();
  });

  it('returns null for a non-list line', () => {
    const lines = ['```safe-passage', 'entries:', 'not a list item'];

    expect(computeEntriesListContinuation(lines, 2, lines[2].length)).toBeNull();
  });
});
