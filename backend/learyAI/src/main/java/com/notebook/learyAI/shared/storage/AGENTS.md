# Agent说明（shared/storage）

## 模块目标

负责提供跨模块复用的对象存储技术抽象与实现，当前被 `kbdoc` 上传/预览链路与 `template` 插件 phase2 发布链路共同依赖。
- 这里只承载对象存储的通用技术能力：上传策略申请、对象校验、对象读写、临时 URL、STS 凭证、前缀删除。
- 这里不是业务模块，禁止沉淀 `kbdoc`、`template` 等特定领域的状态机、权限、命名规则和流程编排。

## 关键入口

- `StorageClient.java`
- `UploadPolicy.java`
- `TemporaryUrl.java`
- `StsCredentials.java`
- `MinioStorageClient.java`
- `MinioStubStorageClient.java`
- `OssStorageClient.java`

## 协作约束

- `StorageClient` 是共享 port，新增方法前必须确认至少有明确的跨模块复用价值，避免为了单一业务场景污染共享接口。
- 允许放在这里的能力仅限对象存储技术语义：presign、STS、对象存在性校验、对象内容读写、前缀级删除。
- `verifyObject` 是发布/确认阶段的硬门槛：对象不存在、size 不匹配、etag 不匹配都必须抛错，不能只记录日志后继续流程。
- 禁止把以下内容下沉到这里：
  - `kbdoc` 的 `docId`、用户前缀规则、预览权限判断，以及共享 `TemporaryUrlPurpose` 之外的业务决策
  - `template` 的 staging object key 规则、版本不可变发布约束、发布校验状态机、artifact 生命周期
  - 任意模块自己的 DTO、Controller 协议、任务上下文字段约定
- provider 实现只负责对接 MinIO / OSS 等外部存储，不负责应用层编排，不做模块级缓存失效、MQ 推送或事务控制。
- 新增 provider 或扩展能力时，要同时回看 `kbdoc` 与 `template` 的调用影响，避免只满足单侧场景。

## 变更提示

- 若修改 `StorageClient` 方法签名，必须同步检查：
  - `module/kbdoc/application/**`
  - `module/template/application/TemplatePluginManagementAppService.java`
  - 相关测试桩与集成测试
- 若新增共享存储规则，优先保持 provider 无关；只有云厂商差异确实不可避免时，才放入具体实现类。
