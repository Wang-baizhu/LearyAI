// 职责: 提供 content 组件内部使用的引用标签 UI，并在页码点击时回调跳转意图。
import { useMemo, useState, type CSSProperties } from 'react';
import { normalizeReferencePageValue } from './reference';

export interface ReferenceTagProps {
  label: string;
  source: string;
  page: string;
  pages?: string[];
  docName?: string;
  disabled?: boolean;
  onPageClick?: (payload: { label: string; source: string; page: string; pageValue: string }) => void;
}

const containerStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '8px',
  maxWidth: '100%',
  margin: '4px 6px 4px 0',
  padding: '8px 10px',
  border: '1px solid rgba(23, 23, 23, 0.16)',
  borderRadius: '999px',
  background: 'linear-gradient(180deg, rgba(255,255,255,0.78), rgba(244,236,224,0.82))',
  boxShadow: '0 10px 24px rgba(48, 37, 25, 0.1)',
  verticalAlign: 'middle',
};

const titleButtonStyle: CSSProperties = {
  border: 'none',
  background: 'transparent',
  padding: 0,
  color: 'inherit',
  font: 'inherit',
  cursor: 'pointer',
  textAlign: 'left',
};

const pageButtonStyle: CSSProperties = {
  border: '1px solid rgba(19, 96, 74, 0.2)',
  borderRadius: '999px',
  background: 'rgba(235, 249, 244, 0.96)',
  color: '#13604a',
  padding: '4px 8px',
  fontSize: '11px',
  fontWeight: 700,
  letterSpacing: '0.08em',
  cursor: 'pointer',
};

const disabledPageButtonStyle: CSSProperties = {
  ...pageButtonStyle,
  cursor: 'not-allowed',
  opacity: 0.55,
};

export const ReferenceTag = ({
  label,
  source,
  page,
  pages,
  docName,
  disabled = false,
  onPageClick,
}: ReferenceTagProps) => {
  const [expanded, setExpanded] = useState(false);
  const resolvedDocName = String(docName ?? label ?? source ?? '').trim() || '文档';
  const resolvedPages = useMemo(
    () => (pages && pages.length > 0 ? pages : [page]).map((item) => normalizeReferencePageValue(item)),
    [page, pages],
  );
  const previewText = resolvedDocName.slice(0, 6);
  const hasOverflow = resolvedDocName.length > 6;
  const displayName = expanded || !hasOverflow ? resolvedDocName : `${previewText}...`;

  return (
    <span title={resolvedDocName} style={containerStyle}>
      <button type="button" style={titleButtonStyle} onClick={() => setExpanded((value) => !value)}>
        <span style={{ fontSize: 12, fontWeight: 700 }}>{displayName}</span>
        {hasOverflow ? (
          <span style={{ marginLeft: 6, color: '#13604a', fontSize: 11, fontWeight: 700 }}>
            {expanded ? '收起' : '展开'}
          </span>
        ) : null}
      </button>

      <span style={{ display: 'inline-flex', gap: 6, flexWrap: 'wrap' }}>
        {resolvedPages.map((pageValue) => (
          <button
            key={pageValue}
            type="button"
            disabled={disabled}
            style={disabled ? disabledPageButtonStyle : pageButtonStyle}
            onClick={() =>
              onPageClick?.({
                label,
                source,
                page: pageValue,
                pageValue: normalizeReferencePageValue(pageValue),
              })
            }
            title={`跳转到 ${resolvedDocName} 第 ${pageValue} 页`}
          >
            {`P${pageValue}`}
          </button>
        ))}
      </span>
    </span>
  );
};
