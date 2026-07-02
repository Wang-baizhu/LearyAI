// projectDeleteApi.test.ts 负责验证项目删除接口的请求参数。
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ apiRequest: vi.fn() }));

vi.mock('@/shared/api/client', () => ({ apiRequest: mocks.apiRequest }));

import { projectDeleteApi } from '../projectDeleteApi';

describe('projectDeleteApi', () => {
  beforeEach(() => {
    mocks.apiRequest.mockReset();
  });

  it('remove 会发送 DELETE 请求', async () => {
    mocks.apiRequest.mockResolvedValue(undefined);

    await expect(projectDeleteApi.remove('project-1')).resolves.toBeUndefined();
    expect(mocks.apiRequest).toHaveBeenCalledWith('/projects/project-1', { method: 'DELETE' });
  });
});
