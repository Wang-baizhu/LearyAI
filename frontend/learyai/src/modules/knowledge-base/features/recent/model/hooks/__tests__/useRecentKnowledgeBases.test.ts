// useRecentKnowledgeBases.test.ts 负责验证最近知识库查询 hook 的 query 配置。
import { describe, expect, it, vi } from 'vitest';
import { useQuery } from '@tanstack/react-query';
import { knowledgeBaseRecentApi } from '../../../api/knowledgeBaseRecentApi';
import { useRecentKnowledgeBases } from '../../useRecentKnowledgeBases';

vi.mock('@tanstack/react-query', () => ({
  useQuery: vi.fn(),
}));

vi.mock('../../../api/knowledgeBaseRecentApi', () => ({
  knowledgeBaseRecentApi: {
    fetchRecent: vi.fn(),
  },
}));

describe('useRecentKnowledgeBases', () => {
  it('会在存在 projectId 时组装 queryKey、queryFn 与 enabled', async () => {
    vi.mocked(useQuery).mockReturnValue('query-result' as never);
    vi.mocked(knowledgeBaseRecentApi.fetchRecent).mockResolvedValue([]);

    const result = useRecentKnowledgeBases(8, 'project-1');
    const options = vi.mocked(useQuery).mock.calls[0]?.[0];
    const queryFn = typeof options?.queryFn === 'function' ? options.queryFn : null;

    expect(result).toBe('query-result');
    expect(options?.queryKey).toEqual(['knowledge-base', 'recent', 'project-1', 8]);
    expect(options?.enabled).toBe(true);
    expect(queryFn).toBeTypeOf('function');
    await expect(queryFn?.({} as never)).resolves.toEqual([]);
    expect(knowledgeBaseRecentApi.fetchRecent).toHaveBeenCalledWith(8, 'project-1');
  });

  it('会在缺少 projectId 时禁用查询', () => {
    vi.mocked(useQuery).mockReturnValue('query-result' as never);

    useRecentKnowledgeBases(10);
    const options = vi.mocked(useQuery).mock.calls.at(-1)?.[0];

    expect(options?.enabled).toBe(false);
    expect(options?.queryKey).toEqual(['knowledge-base', 'recent', undefined, 10]);
  });
});
