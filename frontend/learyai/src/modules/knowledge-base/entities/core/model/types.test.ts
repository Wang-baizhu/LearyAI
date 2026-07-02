// types.test.ts 负责以最小运行时断言验证知识库实体类型的使用约定。
import { describe, expect, it } from 'vitest';
import type { KnowledgeBase } from './types';

describe('knowledge-base types', () => {
  it('KnowledgeBase 结构满足当前实体字段约定', () => {
    const knowledgeBase: KnowledgeBase = {
      kbId: 'kb-1',
      name: '产品知识库',
      description: '沉淀需求与设计资料',
      tags: ['product', 'design'],
      enabledTemplatePluginIds: [],
      userId: 1001,
      visibility: 'TEAM',
      visitedAt: '2026-03-29T00:00:00.000Z',
    };

    expect(knowledgeBase).toMatchObject({
      kbId: 'kb-1',
      visibility: 'TEAM',
      tags: ['product', 'design'],
    });
  });
});
