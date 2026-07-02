// EditableText 负责为任意文本块提供统一的可编辑触发入口。
import type { ReactNode } from 'react';
import { Pencil } from 'lucide-react';
import './EditableText.css';

interface EditableTextProps<TAnchor = unknown> {
  title: string;
  value: string;
  anchor: TAnchor;
  onRequestEdit: (payload: { title: string; value: string; anchor: TAnchor }) => void;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
  triggerClassName?: string;
  triggerPlacement?: 'overlay' | 'inline';
}

export const EditableText = <TAnchor,>({
  title,
  value,
  anchor,
  onRequestEdit,
  children,
  className,
  contentClassName,
  triggerClassName,
  triggerPlacement = 'overlay',
}: EditableTextProps<TAnchor>) => (
  <div
    className={[
      'leary-editable-text',
      triggerPlacement === 'inline' ? 'leary-editable-text--inline' : 'leary-editable-text--overlay',
      className ?? '',
    ].join(' ')}
    data-trigger-placement={triggerPlacement}
  >
    <div className={['leary-editable-text__content', contentClassName ?? ''].join(' ')}>{children}</div>
    <button
      type="button"
      className={[
        'leary-editable-text__trigger',
        triggerPlacement === 'inline' ? 'leary-editable-text__trigger--inline' : 'leary-editable-text__trigger--overlay',
        triggerClassName ?? '',
      ].join(' ')}
      onClick={(event) => {
        event.stopPropagation();
        onRequestEdit({ title, value, anchor });
      }}
    >
      <Pencil size={12} />
      编辑
    </button>
  </div>
);
