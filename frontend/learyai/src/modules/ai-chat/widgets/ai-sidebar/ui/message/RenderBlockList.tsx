// RenderBlockList 负责按 render model 遍历消息块并渲染对应 UI。
import React from 'react';
import type { RenderBlock } from '../../../../entities';
import ContentBlockRenderer from './ContentBlockRenderer';
import { ToolCallCard, ToolCallGroup } from '../tools';
import SubagentActivity from './SubagentActivity';

interface RenderBlockListProps {
  blocks: RenderBlock[];
  isStreaming?: boolean;
  renderTextBlock: (block: Extract<RenderBlock, { kind: 'text' }>) => React.ReactNode;
  onPermissionDecision?: (payload: {
    toolCallId: string;
    requestId?: string;
    decision: 'approve' | 'reject' | 'approve_for_session';
  }) => void;
  onQuestionSubmit?: (payload: { requestId: string; answers: Record<string, string> }) => void;
  onHookSubmit?: (payload: { requestId: string; action: 'allow' | 'block'; reason?: string }) => void;
  onToolSubmit?: (payload: {
    toolCallId: string;
    output: string;
    isError?: boolean;
    message?: string;
  }) => void;
}

const RenderBlockList: React.FC<RenderBlockListProps> = ({
  blocks,
  isStreaming,
  renderTextBlock,
  onPermissionDecision,
  onQuestionSubmit,
  onHookSubmit,
  onToolSubmit,
}) => {
  const renderBlockNode = (block: RenderBlock): React.ReactNode => {
    if (block.kind === 'text') {
      return renderTextBlock(block);
    }
    if (
      block.kind === 'thinking' ||
      block.kind === 'plan' ||
      block.kind === 'notification' ||
      block.kind === 'status' ||
      block.kind === 'permission_request' ||
      block.kind === 'question_request' ||
      block.kind === 'hook_request' ||
      block.kind === 'tool_request' ||
      block.kind === 'tool_call' ||
      block.kind === 'user_question'
    ) {
      return (
        <ContentBlockRenderer
          block={block}
          isStreaming={isStreaming}
          onPermissionDecision={onPermissionDecision}
          onQuestionSubmit={onQuestionSubmit}
          onHookSubmit={onHookSubmit}
          onToolSubmit={onToolSubmit}
        />
      );
    }
    if (block.kind === 'tool_group') {
      if (block.result) {
        return (
          <ToolCallGroup
            call={block.call}
            result={block.result}
            isStreaming={isStreaming}
          />
        );
      }
      return <ToolCallCard call={block.call} isStreaming={isStreaming} />;
    }
    if (block.kind === 'subagent_group') {
      return (
        <SubagentActivity
          name={block.name}
          status={block.status}
          description={block.description}
          hasResult={block.hasResult}
          flowChildren={
            block.flowBlocks.length > 0 ? (
              <div className="space-y-2">
                {block.flowBlocks.map((flowBlock) => (
                  <React.Fragment key={flowBlock.key}>
                    {renderBlockNode(flowBlock)}
                  </React.Fragment>
                ))}
              </div>
            ) : (
              <div className="text-slate-400">暂无输出</div>
            )
          }
          resultChildren={
            block.resultBlocks.length > 0 ? (
              <div className="space-y-2">
                {block.resultBlocks.map((resultBlock) => (
                  <React.Fragment key={resultBlock.key}>
                    {renderBlockNode(resultBlock)}
                  </React.Fragment>
                ))}
              </div>
            ) : (
              <></>
            )
          }
        />
      );
    }
    return null;
  };

  return (
    <>
      {blocks.map((block) => (
        <div key={block.key}>{renderBlockNode(block)}</div>
      ))}
    </>
  );
};

export default RenderBlockList;
