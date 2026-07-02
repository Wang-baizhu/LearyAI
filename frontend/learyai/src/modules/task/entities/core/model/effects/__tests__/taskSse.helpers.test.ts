// taskSse.helpers.test.ts 负责验证任务 SSE 的纯逻辑辅助函数。
import { describe, expect, it } from 'vitest';
import {
  parseTaskPayload,
  resolveFailedMessage,
  resolveTemplatePluginIdFromTask,
  isDocumentTask,
  normalizeScope,
  shouldMatchKbId,
  shouldMatchProject,
} from '../taskSse.helpers';

describe('taskSse helpers', () => {
  it('parseTaskPayload 会解析合法 JSON，并过滤非法输入', () => {
    expect(
      parseTaskPayload('{"taskId":"task-1","projectId":"project-1","status":"PROCESSING"}')
    ).toEqual({
      taskId: 'task-1',
      projectId: 'project-1',
      status: 'PROCESSING',
    });
    expect(parseTaskPayload('')).toBeNull();
    expect(parseTaskPayload('{invalid json')).toBeNull();
    expect(parseTaskPayload('[]')).toBeNull();
  });

  it('resolveTemplatePluginIdFromTask 会从模板阶段键提取 pluginId', () => {
    expect(resolveTemplatePluginIdFromTask('template_pipeline', 'agent:template:plugin-1')).toBe('plugin-1');
    expect(resolveTemplatePluginIdFromTask('template_pipeline', 'agent:summary')).toBeNull();
    expect(resolveTemplatePluginIdFromTask('document_pipeline', 'agent:template:plugin-1')).toBeNull();
  });

  it('isDocumentTask 会基于 pipelineType 判断文档任务', () => {
    expect(isDocumentTask('document_pipeline', 'doc:main')).toBe(true);
    expect(isDocumentTask('template_pipeline', 'agent:template:plugin-1')).toBe(false);
  });

  it('shouldMatchProject 与 shouldMatchKbId 会按作用域匹配参数', () => {
    expect(shouldMatchProject(undefined, 'project-1')).toBe(true);
    expect(shouldMatchProject('project-1', 'project-1')).toBe(true);
    expect(shouldMatchProject('project-1', 'project-2')).toBe(false);
    expect(shouldMatchProject('project-1', 1)).toBe(false);

    expect(shouldMatchKbId(undefined, 'kb-1')).toBe(true);
    expect(shouldMatchKbId('kb-1', 'kb-1')).toBe(true);
    expect(shouldMatchKbId('kb-1', 'kb-2')).toBe(false);
    expect(shouldMatchKbId('kb-1', null)).toBe(false);
  });

  it('normalizeScope 会 trim projectId 与 kbId', () => {
    expect(normalizeScope(' project-1 ', ' kb-1 ')).toEqual({
      projectId: 'project-1',
      kbId: 'kb-1',
    });
    expect(normalizeScope()).toEqual({
      projectId: '',
      kbId: '',
    });
  });

  it('resolveFailedMessage 会基于 pipelineType 与 failedReason 生成稳定文案', () => {
    expect(
      resolveFailedMessage('document_pipeline', 'doc:main', { failedReason: '解析失败' })
    ).toBe('文档任务处理失败：解析失败');
    expect(
      resolveFailedMessage('agent_pipeline', 'agent:kbview', { failedReason: '连接超时' })
    ).toBe('关系图任务处理失败：连接超时');
    expect(
      resolveFailedMessage('agent_pipeline', null, { failedReason: '调用失败' })
    ).toBe('智能体任务处理失败：调用失败');
    expect(resolveFailedMessage('template_pipeline', 'agent:template:plugin-1')).toBe('模板任务处理失败，请重试。');
  });
});
