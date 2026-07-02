### 模块目标
- `packages/knowledge-base` 提供知识库检索、文档入库、语言路由、模型准备、`kb_doc.metadata` 读写等能力。
- 当前模块已按分层结构整理为 `api / application / domain / infrastructure` 四层。
- 对外统一通过 `knowledge_base` 根包导出能力，外部模块不应穿透到内部子目录。

### 目录结构与文件职责

#### 1. 包入口
- `src/knowledge_base/__init__.py`
  - 对外暴露 knowledge_base 根级统一入口。
  - 当前根级导出：
    - `rag_search`
    - `rag_fetch`
    - `get_tools`
    - `get_doc_info`
    - `update_doc_info`
    - `store_pdf`
    - `store_text`
    - `get_kb_doc_instructions`
    - `update_kb_doc_instructions`
    - `update_kb_doc_name`
    - `get_kb_doc_engine`
  - 约束：
    - `kb_server`、其他 service、测试或外部调用方，只允许从 `knowledge_base` 根包导入
    - 不允许在外部模块中直接引用：
      - `knowledge_base.api.*`
      - `knowledge_base.application.*`
      - `knowledge_base.domain.*`
      - `knowledge_base.infrastructure.*`
    - 子目录仅供 `knowledge_base` 模块内部组织代码使用

#### 2. API 层（`src/knowledge_base/api/`）
- `api/tools.py`
  - 面向外部调用的主入口。
  - 提供：
    - `rag_search`
    - `rag_fetch`
    - `get_doc_info`
    - `update_doc_info`
  - 负责把外部请求转换为应用层 / 基础设施层调用，不承载底层 pgvector 细节。
- `api/tools_schema.py`
  - 为 AI 工具暴露 OpenAI tools schema。
  - 当工具参数或返回契约变化时，同步修改这里。

#### 3. Application 层（`src/knowledge_base/application/`）
- `application/document_service.py`
  - 文档处理外观服务。
  - 编排：
    - 文档逐页抽取
    - OCR 占位调用
    - 语言检测
    - 节点构建
    - 分语言 embedding 与持久化
  - 本模块内真正的文档处理主流程应优先放这里。
- `application/document_ingestion.py`
  - 为 `kb_server` 等调用方提供文档入库兼容入口。
  - 暴露 `store_pdf()`、`store_text()`、`split_doc()`、`build_page_nodes()` 等过程化方法。
  - 若后续没有外部兼容需求，可逐步收敛到 `document_service.py`。
- `application/kb_doc_service.py`
  - 负责 `kb_doc.metadata` 与 `kb_doc.name` 的查询、更新、拼接。
  - 所有 `kb_doc` 说明信息读写统一走这里。
- `application/__init__.py`
  - 聚合应用层可复用能力。

#### 4. Domain 层（`src/knowledge_base/domain/`）
- `domain/types.py`
  - 定义领域基础类型：
    - `SupportedLanguage`
    - `ExtractedPage`
    - `RoutedPage`
    - `TURNPAGE_DELIMITER`
    - `split_turnpage_text()`
  - 涉及分页语义、结构化页对象时统一改这里。
- `domain/language_detector.py`
  - 定义语言检测抽象与 `fast_langdetect` 适配实现。
  - 语言识别策略、支持语种映射统一在这里维护。
- `domain/__init__.py`
  - 聚合领域对象与领域服务抽象。

#### 5. Infrastructure 层（`src/knowledge_base/infrastructure/`）
- `infrastructure/provider_config.py`
  - 管理多语言 provider 配置。
  - 提供：
    - provider 配置加载
    - embedding model 获取
    - vector store 获取
    - DB engine 获取
    - OCR 模型基础目录获取
  - 当前 provider：
    - `zh`
    - `en`
  - 默认模型目录：
    - 中文 embedding：`models/BAAI/bge-base-zh`
    - 英文 embedding：`models/BAAI/bge-base-en-v1.5`
    - PaddleOCR：`models/paddleocr`
- `infrastructure/model_preparer.py`
  - 负责 embedding 模型目录检查与自动下载。
  - 模型下载逻辑统一放这里，不要散落到业务流程中。
- `infrastructure/paddle_ocr_provider.py`
  - 提供基于 PaddleOCR 的默认 OCR provider。
  - 负责：
    - PDF 单页渲染为图片
    - 调用 PaddleOCR 提取文字
    - 兼容 `predict` / 旧 `ocr` 两种结果格式解析
  - 注意：
    - 当前已将 `paddleocr` / `paddlepaddle` / `pymupdf` 写入 `knowledge-base` 运行时依赖
    - 部署环境仍需执行 `uv sync --group all-services` 或等价安装步骤，使 OCR 依赖实际进入运行环境
    - 默认通过 `provider_config.py` 中的配置将 OCR 模型目录指向 `models/paddleocr`
- `infrastructure/pgvector/node_parser.py`
  - 负责结构化页对象到 `TextNode` 的转换。
- `infrastructure/pgvector/pgvector_schema.py`
  - 管理 pgvector 表结构、索引、FK、扩展等初始化逻辑。
- `infrastructure/pgvector/pgvector_query.py`
  - 提供 dense / sparse / hybrid 查询与 fetch SQL 逻辑。
- `infrastructure/pgvector/pgvector_store.py`
  - 提供 `CustomPGVectorStore`，负责 pgvector store 组装与调用。
- `infrastructure/pgvector/__init__.py`
  - 聚合 pgvector 基础设施导出。
- `infrastructure/__init__.py`
  - 聚合基础设施层导出。

### 当前推荐调用方式

#### 1. 对外检索
- 统一使用：
  - `knowledge_base.rag_search(query, doc_ids=None)`
  - `knowledge_base.rag_fetch(doc_ids, page_nums, store_keys=None)`
- 不建议业务方直接调用 pgvector 层。
- 查询路由规则：
  - 检测为 `zh` 时只查 `kb_chunk_zh`
  - 检测为 `en` 时只查 `kb_chunk_en`
  - 若 query 被检测为其他语言（如短词误判为 `de` / `hu` / `ko`），会先按原文本中的中文字符数与 ASCII 英文字母数在 `zh` / `en` 之间二选一

#### 2. 文档入库
- `kb_server` 或其他调用方统一使用：
  - `knowledge_base.store_pdf(file_path, doc_id)`：PDF 入库
  - `knowledge_base.store_text(text, doc_id, source_type=\"text\")`：纯文本入库
- 若需要扩展文档处理主流程，优先改：
  - `knowledge_base.application.document_service.DocumentProcessingFacade`
- 当前输入契约：
  - `knowledge_base.store_pdf()` 仅接受 PDF 文件路径
  - `knowledge_base.store_text()` 接受完整纯文本，并在包内按 500 字切割为分页文本后入库
  - `.docx` 等版式文档仍建议由上游先转换为 PDF，再调用 `store_pdf()`
  - `audio/url/md/txt` 等纯文本来源可逐步改为由上游直接传入完整文本，再调用 `store_text()`
- 当前默认 OCR 行为：
  - `DefaultDocumentTextExtractor` 会默认使用 PaddleOCR provider
  - PDF 页直接提取不到文本时，会自动走 OCR
  - 若环境缺少 `paddleocr` / `paddlepaddle` / `pymupdf`，会在触发 OCR 时显式报错
  - OCR 后若语言检测得到非 `zh` / `en` 结果，会按原页面文本字符分布回退到 `zh` 或 `en` 路由，不再直接因 `ko` / `ja` 等结果失败

#### 3. kb_doc 说明信息
- 统一使用：
  - `knowledge_base.get_kb_doc_instructions`
  - `knowledge_base.update_kb_doc_instructions`
  - `knowledge_base.update_kb_doc_name`

#### 4. 外部模块依赖规则
- 外部模块调用 `knowledge_base` 时，只允许：
  - `from knowledge_base import ...`
- 不允许：
  - `from knowledge_base.api.tools import ...`
  - `from knowledge_base.application...`
  - `from knowledge_base.infrastructure...`
- 如果外部模块需要新的能力，应先在 `knowledge_base/__init__.py` 增加根级导出，再由外部模块接入。

### 开发约定
- 新的对外工具接口放 `api/`。
- 新的业务编排、用例流程放 `application/`。
- 新的领域对象、规则、纯策略抽象放 `domain/`。
- 新的模型下载、DB、向量库、第三方适配实现放 `infrastructure/`。
- 不要重新在根目录新增平铺文件，除非是包入口 `__init__.py`。
- 不要把跨语言路由、OCR、模型准备逻辑直接塞进 `api/tools.py` 或 pgvector store。
- 若修改分页语义，只允许使用 `--turnpage--`；相关逻辑统一收敛到 `domain/types.py`。

### 测试建议
- 知识库模块单测优先放：
  - `python-backend/tests/knowledge_base/`
- 典型覆盖点：
  - 分页分隔符语义
  - 语言路由
  - OCR 占位错误路径
  - 模型准备失败路径
  - `rag_search` / `rag_fetch` 的返回契约
