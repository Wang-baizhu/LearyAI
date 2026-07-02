import { describe, expect, it } from 'vitest';
import { mergeGeneratePromptVars } from '../mergeGeneratePromptVars';

describe('mergeGeneratePromptVars', () => {
  it('merges CUSTOM_PROMPT into promptVars without overriding existing keys', () => {
    expect(mergeGeneratePromptVars({ FOCUS_SECTION: '第二章' }, '  请突出关键概念之间的依赖关系  ')).toEqual({
      FOCUS_SECTION: '第二章',
      CUSTOM_PROMPT: '请突出关键概念之间的依赖关系',
    });
  });

  it('keeps CUSTOM_PROMPT as empty string when user leaves it blank', () => {
    expect(mergeGeneratePromptVars(undefined, '   ')).toEqual({
      CUSTOM_PROMPT: '',
    });
  });
});
