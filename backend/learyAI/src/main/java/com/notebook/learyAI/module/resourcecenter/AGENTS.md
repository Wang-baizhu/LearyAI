# Agent说明（resourcecenter 模块）

## 模块目标

聚合资源中心页面所需的跨域轻量查询能力，避免前端为全局视图分别耦合 kbdoc/template 多个分页接口。

## 关键入口

- `interfaces/controller/ResourceCenterController.java`
- `application/ResourceCenterOptionsAppService.java`

## 协作约束

- 仅承载资源中心聚合读模型，不拥有 kbdoc/template/kb 的生命周期。
- 资源权限必须复用下游模块应用服务，禁止绕过各模块权限校验直接访问 infrastructure。
