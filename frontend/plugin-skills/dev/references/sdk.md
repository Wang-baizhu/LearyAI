# `@leary/template-plugin-sdk-react` 接入指南

## 1. 适用对象

这份文档面向“模板插件开发者”，重点说明如何在自己的 React 模板中接入 SDK 并调用宿主能力。

如果你的目标是：

- 在 iframe 模板里接收宿主下发的数据并渲染页面
- 根据宿主主题或能力开关调整 UI
- 向宿主请求存储、文本编辑、AI 动作、引用跳转等能力
- 直接复用一套可编辑正文组件

## 2. 这个 SDK 解决什么问题

模板插件运行在宿主提供的 iframe 环境里。模板侧通常需要做两类事情：

- 接收宿主数据，例如渲染内容、主题、能力开关
- 在用户操作时向宿主发请求，例如保存数据、发起编辑、调用 AI

`@leary/template-plugin-sdk-react` 提供的是 React 侧的标准接入层，让模板开发者通过统一 API 完成这些动作，而不是自己维护消息监听和通信细节。

你可以把它理解为：

- `useTemplatePluginClient()`：模板与宿主交互的统一入口
- `EditableContent`：适合正文展示与编辑的现成 React 组件

## 3. 接入前提

开始接入前，需要先确认三件事：

1. 你的页面运行在宿主提供的模板 iframe 环境或dev-playground中
2. 宿主会在运行时下发渲染数据、主题信息和可用能力
3. 你的模板已经明确哪些交互由宿主完成，例如存储、文本编辑、AI 调用

如果当前页面只是一个普通独立 React 页面，不运行在模板插件环境里，那么这个 SDK 并不适用。

## 4. 安装与导入

在模板工程中安装后，直接从包名导入：

```tsx
import { useTemplatePluginClient } from '@leary/template-plugin-sdk-react';
import { EditableContent } from '@leary/template-plugin-sdk-react/content';
```

如果你在本仓库内开发示例或业务模板，工程通常已经完成 workspace 解析；如果你在外部项目中使用，需要保证构建工具能正确解析这个包。

## 5. 最小接入示例

最小接入方式是：在模板入口组件中创建 client，并订阅宿主下发的渲染数据。

```tsx
import { useEffect, useState } from 'react';
import { useTemplatePluginClient } from '@leary/template-plugin-sdk-react';

export const App = () => {
  const client = useTemplatePluginClient();
  const [content, setContent] = useState('');

  useEffect(() => {
    return client.onRender((payload) => {
      setContent(payload.content ?? '');
    });
  }, [client]);

  return <pre>{content}</pre>;
};
```

建议：

- 在应用入口或顶层页面创建一次 client
- 如果页面内部还会使用 `EditableContent` 或 runtime 组件，不需要额外包一层 Provider；SDK 会在当前页面内自动复用同一份 client 单例
- 页面组件尽量只消费状态，不直接分散处理宿主协议

## 6. 常见接入结构

外部模板建议按三层组织：

- 入口层：创建 `client`，负责接入 SDK
- 适配层：把宿主数据转换成页面状态，把页面操作转换成宿主请求
- 页面层：只负责 UI 渲染和交互表现

一个常见目录组织方式如下：

- `App.tsx`：接入 `useTemplatePluginClient`
- `hooks/*`：封装 `onRender`、`onThemeSync`、请求调用等逻辑
- `store/*`：维护本地页面状态
- `components/*`：渲染页面内容

这样做的好处是：模板页面不会和宿主交互细节耦合在一起，后续更容易扩展。

### 6.1 未接宿主时的开发调试

SDK 不再内置任何 debug/mock UI。  
如果你本地单独跑模板页面、暂时没有接入真实宿主，统一使用 `frontend/template-plugins/dev-playground` 作为外层宿主：

- 它通过 iframe 加载任意 localhost 模板页
- 由宿主侧下发 `host.render`、`host.capabilities.sync`、`host.theme.sync`
- 同时承接协议日志、评论截图和 Electron `capturePage`

模板页本身只保留标准 `useTemplatePluginClient()` 协议接入，不再向 SDK 传入本地调试配置。

## 7. 你可以直接使用的能力

### 7.1 接收宿主数据

常用订阅能力有：

- `onRender(handler)`：接收页面渲染数据
- `onThemeSync(handler)`：接收主题变化
- `onCapabilitiesSync(handler)`：接收能力开关
- `onDispose(handler)`：接收宿主关闭通知

一个典型用法是把宿主数据同步到模板自己的状态中：

```tsx
useEffect(() => {
  return client.onThemeSync((payload) => {
    setIsDark(Boolean(payload.isDark));
  });
}, [client]);
```

推荐做法：

- 宿主数据进入页面前，先映射成你自己的业务状态
- 不要让页面组件直接依赖大量原始宿主字段

### 7.2 向宿主发请求

常用请求能力有：

- `requestGetStorage({ key })`
- `requestGetStorageInfo()`
- `requestSetStorage({ key, value })`
- `requestRemoveStorage({ key })`
- `requestClearStorage()`
- `requestTextEdit(payload)`
- `requestSaveContent({ content })`
- `requestAiAction(payload)`
- `requestCitationJump(payload)`

这些方法都返回 `Promise`，模板侧只需要 `await` 结果即可。

```tsx
const handleSave = async () => {
  const result = await client.requestSetStorage({
    key: 'my-template:data',
    value: { score: 95 },
  });

  if (!result.success) {
    throw new Error('保存失败');
  }
};
```

推荐做法：

- 把每类宿主请求封装成清晰的业务动作，例如“保存表单”“打开编辑器”“执行 AI 分析”
- 请求失败时在业务层明确暴露错误，不要吞掉失败结果

### 7.3 `request*` API 用法与协议

所有请求方法都有两个共同点：

- 由 SDK 自动生成并维护 `requestId`，模板侧不要自己拼接
- 返回值里至少包含 `success`，业务层要显式处理失败分支

如果你只想快速查“这个 request 该怎么调”，优先看这一节。

### 7.4 存储类 request

存储能力统一采用 `key/value` 语义，适合保存草稿、作答记录、评论列表这类模板私有数据。

#### `requestGetStorage({ key })`

- 用途：读取单条存储记录
- 请求协议：`{ key: string }`
- 返回协议：`{ key: string; success: boolean; value?: unknown }`

```tsx
const draft = await client.requestGetStorage({
  key: 'quiz-record:record-1',
});

if (!draft.success) {
  throw new Error('读取记录失败');
}

const record = draft.value;
```

适用场景：

- 打开模板时恢复单条草稿
- 根据已知 key 读取某条业务记录

#### `requestGetStorageInfo()`

- 用途：读取当前模板在宿主侧的存储概览
- 请求协议：`{}`
- 返回协议：`{ success: boolean; keys: string[]; currentSize: number; limitSize: number }`

```tsx
const info = await client.requestGetStorageInfo();

if (!info.success) {
  throw new Error('读取存储概览失败');
}

const recordKeys = info.keys.filter((key) => key.startsWith('quiz-record:'));
```

适用场景：

- 启动时扫描当前模板已存在的业务 key
- 展示“已用空间 / 剩余空间”这类宿主持久化信息

#### `requestSetStorage({ key, value })`

- 用途：写入或覆盖单条存储记录
- 请求协议：`{ key: string; value: unknown }`
- 返回协议：`{ key: string; success: boolean; value?: unknown }`

```tsx
const result = await client.requestSetStorage({
  key: 'quiz-record:record-1',
  value: { score: 95, updatedAt: Date.now() },
});

if (!result.success) {
  throw new Error('保存记录失败');
}
```

适用场景：

- 保存表单草稿
- 覆盖某条答题记录

#### 高频写入时使用 `createBufferedStorageWriter(client, options)`

`requestSetStorage` 本身是“调一次，发一次”的直接写入接口，不会自动按 key 合并高频写入。

如果你的模板存在“同一个 key 在短时间内被连续覆盖”的场景，例如：

- 输入过程中持续保存草稿
- 做题过程中频繁覆盖同一条作答记录
- 学习过程里不断刷新同一条进度状态

那么推荐在业务层额外包一层 `createBufferedStorageWriter`。

导入方式：

```tsx
import {
  createBufferedStorageWriter,
  useTemplatePluginClient,
} from '@leary/template-plugin-sdk-react';
```

最小示例：

```tsx
import { useEffect, useMemo } from 'react';
import {
  createBufferedStorageWriter,
  useTemplatePluginClient,
} from '@leary/template-plugin-sdk-react';

export const DraftEditor = () => {
  const client = useTemplatePluginClient();
  const writer = useMemo(
    () => createBufferedStorageWriter(client, { delay: 600 }),
    [client],
  );

  useEffect(() => {
    return () => {
      void writer.dispose();
    };
  }, [writer]);

  const handleChange = (value: string) => {
    void writer.scheduleSet({
      key: 'draft:article-1',
      value: { content: value, updatedAt: Date.now() },
    });
  };

  return <textarea onChange={(event) => handleChange(event.target.value)} />;
};
```

这里的行为边界是：

- `scheduleSet({ key, value })`：延迟发送，并把同一个 key 的连续写入合并成最后一次
- `remove({ key })`：先取消这个 key 的 pending set，再立即删除
- `clear()`：先取消全部 pending set，再立即清空
- `dispose()`：立即 flush 全部 pending set，适合在页面卸载前调用，避免最后一次修改丢失

推荐做法：

- 只在“同 key 高频覆盖写”的场景使用它
- `delay` 按业务体验调整，常见范围是 `300` 到 `1000` 毫秒
- 页面卸载前调用一次 `dispose()`

不推荐的用法：

- 不要把它当成所有存储请求的默认入口
- 删除和清空不要继续走 `scheduleSet`，统一使用 `remove` / `clear`

#### `requestRemoveStorage({ key })`

- 用途：删除单条存储记录
- 请求协议：`{ key: string }`
- 返回协议：`{ key: string; success: boolean }`

```tsx
const result = await client.requestRemoveStorage({
  key: 'quiz-record:record-1',
});

if (!result.success) {
  throw new Error('删除记录失败');
}
```

适用场景：

- 删除某条评论、草稿或作答记录

#### `requestClearStorage()`

- 用途：清空当前模板在宿主侧的全部存储
- 请求协议：`{}`
- 返回协议：`{ success: boolean }`

```tsx
const result = await client.requestClearStorage();

if (!result.success) {
  throw new Error('清空存储失败');
}
```

适用场景：

- 提供“清空本模板所有本地记录”的管理入口

推荐做法：

- 先约定清晰稳定的 key 前缀，例如 `quiz-record:`、`draft:`
- `requestGetStorageInfo()` 用于发现 key，`requestGetStorage()` 用于读取具体内容
- 高频同 key 写入优先在业务层做节流或缓冲，不要把每次输入都直接打到宿主

### 7.5 文本编辑与整份内容保存

正文编辑分成两步，不要混淆：

1. `requestTextEdit`：让宿主打开统一编辑入口，并拿回用户最终输入
2. `requestSaveContent`：把模板侧 patch 后的整份 `content` 提交给宿主保存

#### `requestTextEdit(payload)`

- 用途：发起文本编辑弹窗
- 请求协议：`{ title: string; value: string; multiline?: boolean; anchor: unknown }`
- 返回协议：`{ success: boolean; value?: string }`

```tsx
const editResult = await client.requestTextEdit({
  title: '编辑正文',
  value: currentText,
  multiline: true,
  anchor: {
    kind: 'card-section',
    cardId: 'card-1',
    field: 'body',
  },
});

if (!editResult.success || typeof editResult.value !== 'string') {
  return;
}
```

字段说明：

- `title`：宿主编辑入口展示的业务标题
- `value`：当前要交给宿主编辑的文本
- `multiline`：单行字段传 `false`，正文说明类字段传 `true`
- `anchor`：模板和宿主约定的定位信息，SDK 只透传，不做解释

#### `requestSaveContent({ content })`

- 用途：提交模板最终确认后的整份正文
- 请求协议：`{ content: string }`
- 返回协议：`{ success: boolean; content?: string }`

```tsx
const saveResult = await client.requestSaveContent({
  content: nextContent,
});

if (!saveResult.success) {
  throw new Error('保存正文失败');
}
```

这是一个很重要的边界：

- `requestTextEdit` 不负责帮模板 patch 原始文档结构
- 模板要自己把编辑结果合并回完整 `content`
- 真正保存给宿主时，统一走 `requestSaveContent`

一个常见流程如下：

```tsx
const handleEditSection = async () => {
  const editResult = await client.requestTextEdit({
    title: '编辑节点说明',
    value: sectionText,
    multiline: true,
    anchor: { sectionId: 'node-1', field: 'description' },
  });

  if (!editResult.success || typeof editResult.value !== 'string') {
    return;
  }

  const nextContent = patchSectionText({
    rawContent,
    sectionId: 'node-1',
    nextValue: editResult.value,
  });

  const saveResult = await client.requestSaveContent({
    content: nextContent,
  });

  if (!saveResult.success) {
    throw new Error('保存节点说明失败');
  }
};
```

适用场景：

- 卡片、文档、报纸、说明书这类“模板自己懂结构，宿主只保存整份内容”的场景

### 7.6 AI 与引用跳转 request

#### `requestAiAction(payload)`

- 用途：通知宿主发起 AI 动作
- 请求协议：`{ actionType: string; title?: string; content: string; metadata?: unknown }`
- 返回协议：`{ success: boolean }`

```tsx
const result = await client.requestAiAction({
  actionType: 'quiz.result-summary',
  title: '测验结果总结',
  content: reportMarkdown,
  metadata: {
    total: 20,
    correct: 18,
  },
});

if (!result.success) {
  throw new Error('AI 总结请求失败');
}
```

字段说明：

- `actionType`：模板和宿主约定的动作标识，例如 `quiz.result-summary`
- `title`：AI 面板上展示的业务标题，可选
- `content`：发送给宿主的原始文本
- `metadata`：模板自定义附加信息

适用场景：

- 发起总结、讲解、分析、润色等 AI 动作

#### `requestCitationJump(payload)`

- 用途：通知宿主跳转到某个引用来源
- 请求协议：`{ source: string; pageText: string; label?: string; page?: string }`
- 返回协议：`{ success: boolean }`

```tsx
const result = await client.requestCitationJump({
  source: 'doc-123',
  pageText: '12',
  label: '《产业报告》',
  page: '12',
});

if (!result.success) {
  throw new Error('引用跳转失败');
}
```

字段说明：

- `source`：引用来源标识，通常是文档 id 或资源类型
- `pageText`：要给宿主展示或解析的页码文本
- `label`：可选的引用标题
- `page`：可选的标准化页码字符串

适用场景：

- 点击正文里的引用标签后通知宿主打开资源中心
- 点击图谱节点来源后跳到原文页面

### 7.7 capability 和 request 的关系

宿主会通过 `onCapabilitiesSync` 下发当前允许的能力开关。常见字段包括：

- `storage`
- `textEdit`
- `aiAction`
- `citationJump`

推荐在发起请求前先根据能力开关决定是否展示入口：

```tsx
useEffect(() => {
  return client.onCapabilitiesSync((payload) => {
    setCapabilities(payload);
  });
}, [client]);

const canEdit = capabilities?.textEdit === true;
```

推荐做法：

- capability 用来控制按钮、入口和交互文案
- 即使 capability 已开启，业务层仍要处理 request 返回失败的情况
- 不要把 capability 当成完整权限系统，它只代表当前宿主是否开放这类能力

### 7.8 什么时候需要手动调用 `signalReady`

一般接入场景下，不需要手动调用 `signalReady()`。

只有在你做了特殊重连、重置或调试逻辑，希望重新通知宿主“模板已经就绪”时，才需要显式调用它。

如果你只是正常开发模板页面，可以忽略这个 API。

## 8. 正文场景优先使用 `EditableContent`

如果宿主下发的是一段正文内容，并且你希望：

- 按正文形式渲染文本
- 自动识别并展示引用片段
- 在合适条件下发起文本编辑
- 点击引用时通知宿主跳转

那么优先使用 `@leary/template-plugin-sdk-react/content` 提供的 `EditableContent`，而不是自己从零实现一套正文组件。

最小用法：

```tsx
import { EditableContent } from '@leary/template-plugin-sdk-react/content';

<EditableContent title="正文" content={content} />
```

这适合“先把内容显示出来”的场景。只要你已经拿到正文字符串，就可以直接接入。

## 9. `EditableContent` 应该怎么选用

### 9.1 只读展示

如果你当前只需要展示内容，不需要发起局部编辑，那么直接传：

```tsx
<EditableContent title="正文" content={text} />
```

适用场景：

- 页面只负责展示内容
- 编辑能力尚未设计完成
- 当前内容无法稳定定位到可编辑位置

### 9.2 可编辑展示

如果你已经知道当前内容在业务中的定位信息，可以传入 `anchor`，让正文支持编辑请求：

```tsx
<EditableContent
  title="节点说明"
  content={text}
  anchor={{ templateId: 'tpl-1', nodeId: 'node-1' }}
/>
```

这里的 `anchor` 可以理解为“这段内容在你业务里的定位信息”。它的具体结构由模板和宿主约定，SDK 只负责原样透传。

适用场景：

- 你明确知道当前片段对应哪个节点、区块或 section
- 宿主可以根据这份定位信息打开对应编辑入口

### 9.3 自定义排版但保留正文能力

如果你想改正文排版，但仍然保留引用解析和宿主交互能力，可以使用 `renderContent`：

```tsx
<EditableContent
  title="正文"
  content={text}
  anchor={{ section: 'body' }}
  renderContent={({ parts, requestReferenceJump }) => (
    <div>
      {parts.map((part, index) =>
        part.kind === 'text' ? (
          <p key={index}>{part.value}</p>
        ) : (
          <button
            key={part.value.raw}
            type="button"
            onClick={() =>
              requestReferenceJump({
                label: part.value.label,
                source: part.value.source,
                page: part.value.page,
                pageValue: part.value.page,
              })
            }
          >
            {part.value.label}
          </button>
        ),
      )}
    </div>
  )}
/>
```

适用场景：

- 你有自己的正文布局样式
- 你只想复用引用与编辑能力，不想接受默认排版

## 10. `EditableContent` 常用参数

以下是外部开发最常用的几个参数。

### `title`

- 类型：`string`
- 是否必填：是
- 作用：标识这段内容的业务名称，通常用于编辑入口展示

```tsx
<EditableContent title="摘要" content={summary} />
```

建议用业务语义明确的标题，例如“正文”“摘要”“节点说明”，不要都写成“内容”。

### `content`

- 类型：`string`
- 是否必填：是
- 作用：当前要展示的正文内容

```tsx
<EditableContent title="正文" content={article.body} />
```

### `anchor`

- 类型：业务自定义对象
- 是否必填：否
- 作用：告诉宿主“当前编辑的是哪一段内容”

```tsx
<EditableContent
  title="节点说明"
  content={text}
  anchor={{ templateId: 'tpl-1', nodeId: 'node-1' }}
/>
```

建议：

- 能明确定位时再传 `anchor`
- 如果定位不稳定，宁可先只读展示，也不要传一份不可靠的定位信息

### `multiline`

- 类型：`boolean`
- 默认值：`true`
- 作用：告诉宿主这次编辑更接近单行还是多行文本

```tsx
<EditableContent
  title="标题"
  content={headline}
  anchor={{ section: 'title' }}
  multiline={false}
/>
```

常见约定：

- 标题、标签、短字段：`false`
- 正文、说明、摘要：`true`

### `referenceDisabled`

- 类型：`boolean`
- 默认值：`false`
- 作用：禁用引用跳转

```tsx
<EditableContent title="正文" content={text} referenceDisabled />
```

适用场景：

- 当前页面不希望引用可点击
- 宿主没有开放引用跳转能力

### `className` / `contentClassName` / `triggerClassName` / `textClassName`

这几个参数都用于样式定制：

- `className`：根节点样式
- `contentClassName`：正文容器样式
- `triggerClassName`：编辑触发区样式
- `textClassName`：默认文本片段样式

如果你只是调整外观，优先使用这些样式参数，不要一开始就重写整套渲染逻辑。

### `renderContent`

- 类型：`(params) => ReactNode`
- 作用：自定义正文整体渲染

适合：

- 页面需要自己的正文布局
- 你想复用 SDK 已经拆分好的文本与引用片段

### `extensions`

- 类型：`EditableContentExtension[]`
- 作用：为正文组件补充可复用扩展能力

适合：

- 多个页面复用同一种正文行为
- 你要统一处理某类文本片段或引用片段

如果只是单页定制，通常优先考虑 `renderContent`；如果要沉淀成可复用能力，再考虑 `extensions`。

## 11. 什么时候直接调用 request API，什么时候用 `EditableContent`

可以按下面方式判断：

- 只是普通按钮、表单、操作面板与宿主交互：直接调用 `request*` API
- 需要展示正文、引用、编辑入口这类内容型区域：优先用 `EditableContent`
- 只是读取宿主数据后自行渲染：订阅 `onRender` / `onThemeSync` / `onCapabilitiesSync`

一个常见组合是：

- 页面主体数据通过 `onRender` 初始化
- 普通操作按钮通过 `requestSetStorage`、`requestAiAction` 等 API 处理
- 正文区域通过 `EditableContent` 处理展示、引用和编辑

## 12. 推荐实践

- 入口层只创建一次 `client`
- 宿主数据先映射成自己的业务状态，再交给页面组件
- 正文场景优先复用 `EditableContent`
- 请求能力按业务语义封装，不要把 SDK 方法散落在各个组件里
- 当内容定位不稳定时，优先只读展示，不要强行接编辑

## 13. 不推荐的用法

- 不要在模板里直接操作 `window.parent.postMessage`
- 不要在多个组件里重复创建多个 client
- 不要把页面 UI 和宿主交互逻辑完全写在同一个组件里
- 不要为了显示正文而自己重写一套引用解析和编辑触发逻辑
- 不要在定位信息不明确时勉强启用编辑能力

## 14. 排查思路

### 页面没有拿到内容

优先检查：

1. 模板入口是否已经调用 `useTemplatePluginClient()`
2. 是否已经订阅 `onRender`
3. 页面状态是否正确接收并渲染了 `onRender` 的回调结果
4. 当前模板是否确实运行在宿主提供的插件环境中

### 主题没有同步

优先检查：

1. 是否已经订阅 `onThemeSync`
2. 页面是否把主题数据真正映射到了样式状态

### 请求没有效果

优先检查：

1. 当前宿主是否提供对应能力
2. 请求参数是否完整
3. 业务层是否正确处理了 Promise 结果和失败分支

### 正文可展示但不能编辑

优先检查：

1. 当前场景是否真的需要编辑，而不是只读展示
2. 是否提供了宿主可识别的 `anchor`
3. 当前内容定位方式是否稳定

## 15. 一个完整的最小流程

一个典型模板通常按下面顺序工作：

1. 页面挂载，创建 `client`
2. 通过 `onRender` 初始化页面内容
3. 通过 `onThemeSync`、`onCapabilitiesSync` 同步运行时状态
4. 用户操作时调用对应 `request*` API
5. 正文区域按需使用 `EditableContent`
6. 页面卸载时由 React 生命周期自动完成清理
