// 职责: 提供 PPT 预览样式编辑面板与字段表单，供正式预览与工作台复用。
import { useEffect, useRef, useState } from 'react';
import type { PptEditSelectionSnapshot } from './pptEditProtocol';

export type PptStyleEditorFieldName = keyof PptEditSelectionSnapshot['style'] | 'text';

export interface PptStyleEditorPanelProps {
  editMode: boolean;
  isCollapsed: boolean;
  selection: PptEditSelectionSnapshot | null;
  canUndo?: boolean;
  disabled?: boolean;
  onToggleEditMode: () => void;
  onToggleCollapsed: () => void;
  onFieldChange: (field: PptStyleEditorFieldName, value: string) => void;
  onUndo: () => void;
}

const PPT_COLOR_PALETTE = [
  '#0f172a',
  '#334155',
  '#475569',
  '#64748b',
  '#94a3b8',
  '#e2e8f0',
  '#ffffff',
  '#dc2626',
  '#ea580c',
  '#d97706',
  '#ca8a04',
  '#65a30d',
  '#16a34a',
  '#059669',
  '#0f766e',
  '#0891b2',
  '#2563eb',
  '#4f46e5',
  '#7c3aed',
  '#c026d3',
];
const COLOR_COMMIT_DELAY_MS = 180;

type ParsedCssColor = {
  hex: string;
  alpha: number;
};

const clampChannel = (value: number) => Math.min(Math.max(Math.round(value), 0), 255);

const clampAlpha = (value: number) => Math.min(Math.max(value, 0), 1);

const hexToRgb = (value: string) => ({
  r: Number.parseInt(value.slice(1, 3), 16),
  g: Number.parseInt(value.slice(3, 5), 16),
  b: Number.parseInt(value.slice(5, 7), 16),
});

const rgbToHex = (r: number, g: number, b: number) =>
  `#${[r, g, b].map((part) => clampChannel(part).toString(16).padStart(2, '0')).join('')}`.toLowerCase();

const parseCssColor = (value: string): ParsedCssColor => {
  const trimmed = value.trim();
  if (/^#[0-9a-f]{6}$/i.test(trimmed)) {
    return {
      hex: trimmed.toLowerCase(),
      alpha: 1,
    };
  }
  if (/^#[0-9a-f]{8}$/i.test(trimmed)) {
    return {
      hex: trimmed.slice(0, 7).toLowerCase(),
      alpha: clampAlpha(Number.parseInt(trimmed.slice(7, 9), 16) / 255),
    };
  }
  if (trimmed.toLowerCase() === 'transparent') {
    return {
      hex: '#ffffff',
      alpha: 0,
    };
  }
  const rgbMatch = trimmed.match(
    /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*((?:\d+|\d*\.\d+)))?\s*\)$/i,
  );
  if (!rgbMatch) {
    return {
      hex: '#ffffff',
      alpha: 1,
    };
  }
  return {
    hex: rgbToHex(Number(rgbMatch[1]), Number(rgbMatch[2]), Number(rgbMatch[3])),
    alpha: clampAlpha(rgbMatch[4] === undefined ? 1 : Number.parseFloat(rgbMatch[4])),
  };
};

const opacityToPercent = (value: string) => {
  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed)) {
    return 100;
  }
  return Math.round(Math.min(Math.max(parsed, 0), 1) * 100);
};

interface PptColorFieldProps {
  label: string;
  value: string;
  disabled?: boolean;
  onChange: (value: string) => void;
}

const buildRgbaColor = (hex: string, alpha: number) => {
  const { r, g, b } = hexToRgb(hex);
  const normalizedAlpha = clampAlpha(alpha);
  if (normalizedAlpha >= 1) {
    return rgbToHex(r, g, b);
  }
  return `rgba(${r}, ${g}, ${b}, ${normalizedAlpha.toFixed(2).replace(/0+$/, '').replace(/\.$/, '')})`;
};

const PptColorField = ({
  label,
  value,
  disabled = false,
  onChange,
}: PptColorFieldProps) => {
  const [draftValue, setDraftValue] = useState(value);
  const draftValueRef = useRef(value);
  const dirtyRef = useRef(false);
  const onChangeRef = useRef(onChange);
  const commitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => () => {
    if (commitTimerRef.current) {
      clearTimeout(commitTimerRef.current);
    }
  }, []);

  const commitDraftValue = () => {
    if (!dirtyRef.current) {
      return;
    }
    if (commitTimerRef.current) {
      clearTimeout(commitTimerRef.current);
      commitTimerRef.current = null;
    }
    dirtyRef.current = false;
    if (draftValueRef.current !== value) {
      onChangeRef.current(draftValueRef.current);
    }
  };

  const updateDraftValue = (nextValue: string) => {
    draftValueRef.current = nextValue;
    setDraftValue(nextValue);
    dirtyRef.current = true;
    if (commitTimerRef.current) {
      clearTimeout(commitTimerRef.current);
    }
    commitTimerRef.current = setTimeout(() => {
      commitTimerRef.current = null;
      commitDraftValue();
    }, COLOR_COMMIT_DELAY_MS);
  };

  const parsedColor = parseCssColor(draftValue);
  const opacityPercent = Math.round(parsedColor.alpha * 100);

  return (
    <div className="flex flex-col gap-3" onBlur={commitDraftValue}>
      <span className="text-xs font-medium text-slate-600 dark:text-slate-300">{label}</span>
      <div className="flex flex-wrap gap-2" role="group" aria-label={`${label}调色板`}>
        {PPT_COLOR_PALETTE.map((color) => {
          const active = parsedColor.hex === color;
          return (
            <button
              key={color}
              type="button"
              className={`h-7 w-7 rounded-full border transition ${
                active
                  ? 'border-slate-900 ring-2 ring-slate-300 dark:border-white dark:ring-slate-600'
                  : 'border-slate-300 hover:border-slate-400 dark:border-slate-600 dark:hover:border-slate-500'
              } ${disabled ? 'cursor-not-allowed opacity-50' : ''}`}
              style={{ backgroundColor: buildRgbaColor(color, parsedColor.alpha) }}
              onClick={() => updateDraftValue(buildRgbaColor(color, parsedColor.alpha))}
              disabled={disabled}
              aria-label={`${label}${color}`}
              title={color}
            />
          );
        })}
      </div>
      <div className="grid grid-cols-[minmax(0,1fr)_88px] gap-3">
        <input
          type="color"
          value={parsedColor.hex}
          onChange={(event) => updateDraftValue(buildRgbaColor(event.target.value, parsedColor.alpha))}
          onPointerUp={commitDraftValue}
          disabled={disabled}
          className="h-10 w-full cursor-pointer rounded-xl border border-slate-200 bg-white p-1 dark:border-slate-700 dark:bg-slate-900"
        />
        <div
          className="h-10 rounded-xl border border-slate-200 dark:border-slate-700"
          style={{
            backgroundImage:
              'linear-gradient(45deg, #cbd5e1 25%, transparent 25%, transparent 75%, #cbd5e1 75%, #cbd5e1), linear-gradient(45deg, #cbd5e1 25%, transparent 25%, transparent 75%, #cbd5e1 75%, #cbd5e1)',
            backgroundPosition: '0 0, 6px 6px',
            backgroundSize: '12px 12px',
            backgroundColor: buildRgbaColor(parsedColor.hex, parsedColor.alpha),
          }}
          aria-label={`${label}预览`}
        />
      </div>
      <label className="flex flex-col gap-2">
        <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
          {label}透明度 {opacityPercent}%
        </span>
        <div className="flex items-center gap-3">
          <input
            type="range"
            min="0"
            max="100"
            step="1"
            value={opacityPercent}
            onChange={(event) => updateDraftValue(buildRgbaColor(parsedColor.hex, Number(event.target.value) / 100))}
            onPointerUp={commitDraftValue}
            disabled={disabled}
            className="w-full accent-slate-800 dark:accent-slate-200"
          />
          <output className="w-12 text-right text-xs font-medium text-slate-500 dark:text-slate-400">
            {opacityPercent}%
          </output>
        </div>
      </label>
    </div>
  );
};

interface PptStyleEditorFieldsProps {
  selection: PptEditSelectionSnapshot;
  disabled?: boolean;
  onFieldChange: (field: PptStyleEditorFieldName, value: string) => void;
}

export const PptStyleEditorFields = ({
  selection,
  disabled = false,
  onFieldChange,
}: PptStyleEditorFieldsProps) => (
  <div className="flex flex-col gap-4">
    <label className="flex flex-col gap-2">
      <span className="text-xs font-medium text-slate-600 dark:text-slate-300">文本</span>
      <textarea
        value={selection.text}
        onChange={(event) => onFieldChange('text', event.target.value)}
        disabled={disabled}
        className="min-h-28 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-50 dark:focus:border-slate-500"
      />
    </label>
    <PptColorField
      key={`${selection.selector}:color:${selection.style.color}`}
      label="文字颜色"
      value={selection.style.color}
      onChange={(nextValue) => onFieldChange('color', nextValue)}
      disabled={disabled}
    />
    <label className="flex flex-col gap-2">
      <span className="text-xs font-medium text-slate-600 dark:text-slate-300">字号</span>
      <input
        type="text"
        value={selection.style.fontSize}
        onChange={(event) => onFieldChange('fontSize', event.target.value)}
        disabled={disabled}
        className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-50 dark:focus:border-slate-500"
      />
    </label>
    <label className="flex flex-col gap-2">
      <span className="text-xs font-medium text-slate-600 dark:text-slate-300">字重</span>
      <input
        type="text"
        value={selection.style.fontWeight}
        onChange={(event) => onFieldChange('fontWeight', event.target.value)}
        disabled={disabled}
        className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-50 dark:focus:border-slate-500"
      />
    </label>
    <PptColorField
      key={`${selection.selector}:background:${selection.style.backgroundColor}`}
      label="背景色"
      value={selection.style.backgroundColor}
      onChange={(nextValue) => onFieldChange('backgroundColor', nextValue)}
      disabled={disabled}
    />
    <label className="flex flex-col gap-2">
      <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
        整体透明度 {opacityToPercent(selection.style.opacity)}%
      </span>
      <div className="flex items-center gap-3">
        <input
          type="range"
          min="0"
          max="100"
          step="1"
          value={opacityToPercent(selection.style.opacity)}
          onChange={(event) => onFieldChange('opacity', String(Number(event.target.value) / 100))}
          disabled={disabled}
          className="w-full accent-slate-800 dark:accent-slate-200"
        />
        <output className="w-12 text-right text-xs font-medium text-slate-500 dark:text-slate-400">
          {opacityToPercent(selection.style.opacity)}%
        </output>
      </div>
    </label>
    <label className="flex flex-col gap-2">
      <span className="text-xs font-medium text-slate-600 dark:text-slate-300">层级</span>
      <input
        type="text"
        value={selection.style.zIndex}
        onChange={(event) => onFieldChange('zIndex', event.target.value)}
        disabled={disabled}
        className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-50 dark:focus:border-slate-500"
      />
    </label>
    <div className="grid grid-cols-2 gap-3">
      {(['left', 'top', 'width', 'height'] as const).map((field) => (
        <label key={field} className="flex flex-col gap-2">
          <span className="text-xs font-medium uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
            {field}
          </span>
          <input
            type="text"
            value={selection.style[field]}
            onChange={(event) => onFieldChange(field, event.target.value)}
            disabled={disabled}
            className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-50 dark:focus:border-slate-500"
          />
        </label>
      ))}
    </div>
  </div>
);

export const PptStyleEditorPanel = ({
  editMode,
  isCollapsed,
  selection,
  canUndo = true,
  disabled = false,
  onToggleEditMode,
  onToggleCollapsed,
  onFieldChange,
  onUndo,
}: PptStyleEditorPanelProps) => (
  <aside
    className={`hidden shrink-0 border-l border-slate-200 bg-slate-50/80 backdrop-blur dark:border-slate-800 dark:bg-[#111827]/90 lg:flex ${
      isCollapsed ? 'w-12' : 'w-[360px]'
    }`}
  >
    <button
      type="button"
      onClick={onToggleCollapsed}
      className="flex w-12 items-center justify-center border-r border-slate-200 text-sm font-semibold text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 dark:border-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-50"
      aria-label={isCollapsed ? '展开 PPT 样式编辑面板' : '收起 PPT 样式编辑面板'}
      title={isCollapsed ? '展开样式编辑' : '收起样式编辑'}
    >
      {isCollapsed ? '<' : '>'}
    </button>
    {!isCollapsed ? (
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="border-b border-slate-200 px-5 py-4 dark:border-slate-800">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-50">PPT 样式编辑</h2>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                选择右侧预览中的元素后，可直接调整文本、颜色与位置。
              </p>
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <button
              type="button"
              className={`rounded-full px-3 py-2 text-sm font-medium transition ${
                editMode
                  ? 'bg-slate-900 text-white hover:bg-slate-700 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white'
                  : 'border border-slate-300 bg-white text-slate-700 hover:border-slate-400 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-slate-500 dark:hover:text-white'
              } ${disabled ? 'cursor-not-allowed opacity-50' : ''}`}
              onClick={onToggleEditMode}
              disabled={disabled}
            >
              {editMode ? '退出编辑模式' : '进入编辑模式'}
            </button>
            <button
              type="button"
              className={`rounded-full border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-slate-500 dark:hover:text-white ${
                disabled || !canUndo ? 'cursor-not-allowed opacity-50' : ''
              }`}
              onClick={onUndo}
              disabled={disabled || !canUndo}
            >
              撤销上一步
            </button>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {editMode && selection ? (
            <PptStyleEditorFields selection={selection} disabled={disabled} onFieldChange={onFieldChange} />
          ) : (
            <div className="rounded-3xl border border-dashed border-slate-300 bg-white/70 px-4 py-6 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-400">
              {editMode ? '点击预览中的 PPT 元素后开始编辑。' : '开启编辑模式后，右侧会显示所选元素的样式字段。'}
            </div>
          )}
        </div>
      </div>
    ) : null}
  </aside>
);
