// text-editable/model/types.ts 负责定义横切文本编辑能力的通用类型。
export interface EditableTextSession<TAnchor = unknown> {
  title: string;
  value: string;
  anchor: TAnchor;
  multiline?: boolean;
}
