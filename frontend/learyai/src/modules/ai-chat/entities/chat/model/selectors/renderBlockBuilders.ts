// renderBlockBuilders 负责把聚合后的中间结构映射为稳定的渲染 view model。
import { replaceCitationDocId } from '../../lib/citationText';
import type { ChatSender } from '../types/schema';
import type { GroupedBlock } from '../view/groupedBlock';
import type { RenderBlock, RenderSubagentGroup, RenderTextBlock } from '../view/renderMessage';

const createRenderTextBlock = (
  key: string,
  text: string,
  docNameMap: Record<string, string>,
  sender: ChatSender
): RenderTextBlock => ({
  kind: 'text',
  key,
  text,
  copyText: sender === 'assistant' ? replaceCitationDocId(text, docNameMap) : text,
  saveText: text,
});

const buildRenderBlock = (
  block: GroupedBlock,
  sender: ChatSender,
  docNameMap: Record<string, string>
): RenderBlock => {
  switch (block.kind) {
    case 'grouped_text':
      return createRenderTextBlock(block.key, block.text, docNameMap, sender);
    case 'grouped_thinking':
      return { kind: 'thinking', key: block.key, text: block.text };
    case 'grouped_plan':
      return { kind: 'plan', key: block.key, content: block.content, filePath: block.filePath };
    case 'grouped_notification':
      return { kind: 'notification', key: block.key, notification: block.notification };
    case 'grouped_status':
      return { kind: 'status', key: block.key, status: block.status };
    case 'grouped_tool_call':
      return { kind: 'tool_call', key: block.key, call: block.call };
    case 'grouped_tool_group':
      return {
        kind: 'tool_group',
        key: block.key,
        call: block.call,
        result: block.result,
      };
    case 'grouped_user_question':
      return { kind: 'user_question', key: block.key, text: block.text };
    case 'grouped_subagent_group': {
      const resultBlocks = block.resultBlocks.map((resultBlock, resultIndex) =>
        createRenderTextBlock(
          `${block.key}-result-${resultBlock.toolCallId}-${resultIndex}`,
          resultBlock.result,
          docNameMap,
          sender
        )
      );
      const renderGroup: RenderSubagentGroup = {
        kind: 'subagent_group',
        key: block.key,
        name: block.name,
        status: block.status,
        description: block.description,
        hasResult: resultBlocks.length > 0,
        flowBlocks: block.flowBlocks.map((flowBlock) =>
          buildRenderBlock(flowBlock, sender, docNameMap)
        ),
        resultBlocks,
      };
      return renderGroup;
    }
  }
};

export const buildRenderBlocksFromGrouped = (
  groupedBlocks: GroupedBlock[],
  options: {
    sender: ChatSender;
    docNameMap: Record<string, string>;
  }
): RenderBlock[] =>
  groupedBlocks.map((block) => buildRenderBlock(block, options.sender, options.docNameMap));
