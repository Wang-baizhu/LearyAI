// api.helpers.test.ts 负责验证任务接口层纯逻辑辅助函数。
import { describe, expect, it } from 'vitest';
import { hasInProgressTask, joinParam } from '../api.helpers';

describe('task api helpers', () => {
  it('joinParam 会把数组拼接为逗号分隔字符串', () => {
    expect(joinParam(['document_pipeline', 'template_pipeline'])).toBe(
      'document_pipeline,template_pipeline'
    );
  });

  it('joinParam 会在空数组或未传值时返回 undefined', () => {
    expect(joinParam([])).toBeUndefined();
    expect(joinParam()).toBeUndefined();
  });

  it('hasInProgressTask 会识别进行中的任务状态', () => {
    expect(
      hasInProgressTask({
        items: [
          {
            taskId: 'task-1',
            type: 'template_pipeline',
            typeId: 'type-1',
            status: 'PROCESSING',
            createdAt: '2026-03-29T00:00:00.000Z',
            updatedAt: '2026-03-29T00:00:00.000Z',
          },
        ],
        total: 1,
        page: 1,
        size: 20,
      })
    ).toBe(true);
  });

  it('hasInProgressTask 会忽略非进行中状态', () => {
    expect(
      hasInProgressTask({
        items: [
          {
            taskId: 'task-2',
            type: 'template_pipeline',
            typeId: 'type-2',
            status: 'DONE',
            createdAt: '2026-03-29T00:00:00.000Z',
            updatedAt: '2026-03-29T00:00:00.000Z',
          },
        ],
        total: 1,
        page: 1,
        size: 20,
      })
    ).toBe(false);
    expect(hasInProgressTask()).toBe(false);
  });
});
