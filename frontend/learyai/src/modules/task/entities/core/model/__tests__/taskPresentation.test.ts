// taskPresentation.test.ts 负责验证任务展示语义解析规则。
import { describe, expect, it } from 'vitest';
import { parseTaskStage, resolveTaskFamily, resolveTaskPresentation } from '../taskPresentation';

describe('taskPresentation', () => {
  it('parseTaskStage 会解析模板与内置阶段键', () => {
    expect(parseTaskStage('agent:template:plugin-1')).toEqual({
      kind: 'template_generate',
      raw: 'agent:template:plugin-1',
      templatePluginId: 'plugin-1',
    });
    expect(parseTaskStage('agent:kbview')).toEqual({
      kind: 'kbview_generate',
      raw: 'agent:kbview',
    });
  });

  it('resolveTaskFamily 会基于 pipelineType 收口任务大类', () => {
    expect(resolveTaskFamily('document_pipeline', 'doc:main')).toBe('document');
    expect(resolveTaskFamily('template_pipeline', 'agent:template:plugin-1')).toBe('template');
    expect(resolveTaskFamily('agent_pipeline', 'agent:kbview')).toBe('kbview');
    expect(resolveTaskFamily('pptprompt_pipeline', 'agent:pptprompt')).toBe('pptprompt');
  });

  it('resolveTaskPresentation 会为缺少阶段的 agent_pipeline 提供智能体任务兜底文案', () => {
    const presentation = resolveTaskPresentation(
      {
        type: 'agent_pipeline',
        currentStage: null,
      },
      {},
    );

    expect(presentation).toMatchObject({
      family: 'unknown',
      pipelineLabel: '智能体任务',
      stageLabel: '处理中',
    });
  });

  it('resolveTaskPresentation 会优先展示模板插件 displayName', () => {
    const presentation = resolveTaskPresentation(
      {
        type: 'template_pipeline',
        currentStage: 'agent:template:plugin-1',
      },
      {
        'plugin-1': {
          pluginId: 'plugin-1',
          name: 'mindmap',
          displayName: '思维导图',
          available: true,
          iconKey: 'hub',
          resourceLabel: '导图',
          generateLabel: '生成导图',
          sortOrder: 1,
        },
      },
    );

    expect(presentation).toMatchObject({
      family: 'template',
      pipelineLabel: '思维导图',
      stageLabel: '思维导图生成',
      templatePluginId: 'plugin-1',
    });
  });

  it('resolveTaskPresentation 会给 pptprompt_pipeline 返回固定文案', () => {
    const presentation = resolveTaskPresentation(
      {
        type: 'pptprompt_pipeline',
        currentStage: 'agent:pptprompt',
      },
      {},
    );

    expect(presentation).toMatchObject({
      family: 'pptprompt',
      pipelineLabel: 'PPT Prompt',
      stageLabel: 'PPT 内容生成',
    });
  });
});
