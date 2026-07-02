// citationText 负责处理 AI 文本中的引用编号替换规则。
import { splitTextByCitations } from '@/shared/lib/citation';

export const replaceCitationDocId = (
  text: string,
  docNameMap: Record<string, string>
) => {
  return splitTextByCitations(text)
    .map((segment) => {
      if (segment.kind === 'text') {
        return segment.value;
      }

      const mappedName = docNameMap[segment.value.type];
      if (!mappedName) return '';
      return `${mappedName}${segment.value.pages.join('、')}页`;
    })
    .join('');
};
