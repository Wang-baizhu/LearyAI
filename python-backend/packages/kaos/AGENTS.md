## kaos包文件职责与功能总结

kaos包（pykaos）是一个轻量级Python库，为AI代理提供操作系统交互的抽象层，支持本地和远程（SSH）环境切换 [1](#0-0) 。

### 核心文件

#### `packages/kaos/src/kaos/__init__.py`
定义KAOS的核心协议和接口：
- `Kaos`协议：定义操作系统抽象接口，包含文件操作、目录操作、进程执行等方法 [2](#0-1) 
- `KaosProcess`协议：定义进程接口，包含stdin/stdout/stderr流和进程管理 [3](#0-2) 
- `AsyncReadable`/`AsyncWritable`协议：定义异步读写流接口 [4](#0-3) 
- 提供上下文管理函数：`get_current_kaos()`、`set_current_kaos()`等 [5](#0-4) 
- 导出便捷函数，直接委托给当前KAOS实例 [6](#0-5) 

#### `packages/kaos/src/kaos/local.py`
本地KAOS实现：
- `LocalKaos`类：实现本地文件系统和进程操作 [7](#0-6) 
- `Process`内部类：包装`asyncio.subprocess.Process`，提供标准进程接口 [8](#0-7) 
- 使用`aiofiles`进行异步文件操作，支持跨平台（Windows/POSIX）路径处理 [9](#0-8) 
- 导出默认实例`local_kaos` [10](#0-9) 

#### `packages/kaos/src/kaos/ssh.py`
SSH远程KAOS实现：
- `SSHKaos`类：通过SSH/SFTP与远程机器交互 [11](#0-10) 
- `Process`内部类：包装`asyncssh.SSHClientProcess`，注意PID返回-1（SSH限制） [12](#0-11) 
- `create()`类方法：建立SSH连接并初始化SFTP客户端 [13](#0-12) 
- 处理SFTP属性到Unix stat模式的转换 [14](#0-13) 

#### `packages/kaos/src/kaos/path.py`
`KaosPath` 提供跨 KAOS 实现的路径抽象，基于当前后端的 `pathclass`/`normpath` 计算路径。
- `unsafe_from_local_path`/`unsafe_to_local_path` 让本地路径与 `KaosPath` 互转，便于在只支持本地的用例中复用 `pathlib`。
- 支持比较、父路径、join、canonical、relative_to、expanduser 等路径逻辑。
- 封装 `iterdir`、`glob`、`stat`、`exists`、`is_file`、`is_dir`、`read_bytes`/`read_text`/`read_lines`、`write_bytes`/`write_text`/`append_text`、`mkdir` 等异步 API，使上层无需直接面对 KAOS 实例。

#### `packages/kaos/src/kaos/_current.py`
通过 `ContextVar` 保存当前 KAOS 实例，默认指向 `local_kaos`，由 `kaos.get_current_kaos`/`set_current_kaos` 等帮手函数访问，以便在不同上下文（测试、协程）间切换 KAOS。

### 配置与文档文件

#### `packages/kaos/pyproject.toml`
- 项目名称：pykaos，当前版本0.7.0 [15](#0-14) 
- 依赖：aiofiles（异步文件IO）、asyncssh（SSH客户端） [16](#0-15) 
- 要求Python >=3.12 [17](#0-16) 

#### `packages/kaos/CHANGELOG.md`
记录版本演进：
- 0.7.0：exec方法增加env参数支持环境变量 [18](#0-17) 
- 0.6.0：readbytes增加n参数限制读取字节数 [19](#0-18) 
- 0.5.0：添加SSHKaos实现、AsyncReadable/AsyncWritable协议 [20](#0-19) 

#### `packages/kaos/README.md`
- 简要介绍 PyKAOS 的定位（代理可在本地与远程之间切换操作系统交互）并作为包级文档入口。

#### `packages/kaos/.pre-commit-config.yaml`
- 定义 `format-pykaos` 和 `check-pykaos` 两个本地钩子，通过根目录 `make` 脚本统一运行格式化与检查，保持子包与主仓库一致的质量标准。

#### `packages/kaos/py.typed`
- 空标记文件，指示打包器该包包含类型声明，保证分发给其他项目时类型检查器能正确识别。

#### `packages/kaos/LICENSE`
- Apache 2.0 许可证全文，明确披露权利与限制，提示使用者遵守版权/专利/免责等条款。

#### `packages/kaos/NOTICE`
- 列出 PyKAOS 所属 Moonshot AI 的版权与第三方信息，满足 Apache License 对 NOTICE 文件的要求。

### 集成文件

#### `src/kimi_cli/acp/kaos.py`
ACP（Agent Communication Protocol）后端实现：
- `ACPKaos`类：将KAOS操作路由到ACP客户端，支持回退到本地实现 [21](#0-20) 
- 大部分操作委托给fallback（默认local_kaos） [22](#0-21) 
- 仅readtext/write_text_file在ACP支持时使用ACP协议 [23](#0-22) 

### 测试文件

#### `tests/test_kaos_path.py`
- 在本地 `LocalKaos` 作用域内验证 `KaosPath` 的拼接/父路径等算子，以及 `expanduser`、`canonical`、`relative_to`。
- 通过写入/追加/读取文本与字节、`iterdir` 与 `glob`，确保封装的异步文件操作与 `kaos.*` 接口行为一致。

#### `tests/test_local_kaos.py`
- 重点验证 `LocalKaos` 的路径类、`stat`、`chdir`、`iterdir`、`glob`、`readlines`/`readtext`/`readbytes`、`write*` 系列和 `mkdir`。
- 拉起 Python 子进程检查 `exec` 返回的 `Process` 支持 stdin/stdout/stderr、`wait`、`kill`、非零退出、超时等交互边界。

#### `tests/test_local_kaos_cmd.py`
- 仅在 Windows 运行，借助 `cmd.exe /c` 执行命令链、错误码与重定向，并用 `inline_snapshot` 验证输出，保证 Windows shell 下 `kaos.exec` 正常工作。

#### `tests/test_local_kaos_sh.py`
- 仅在 POSIX 系统运行，通过 `/bin/sh -c` 练习管道、串联、条件、异步 stdin、超时与环境变量等复杂场景，确保 `LocalKaos.exec` 在类 Unix Shell 中可靠。

#### `tests/test_ssh_kaos.py`
- 依赖环境变量配置 SSH 连接，创建临时远程目录后验证 `SSHKaos` 的 `chdir`、`stat`、`mkdir`、`iterdir`、`glob`、文件读写、`exec`、进程 kill 等功能，并清理远端资源。

## Notes

- kaos包采用协议（Protocol）设计模式，便于扩展不同后端实现
- 当前提供本地、SSH和ACP三种实现方式
- 所有文件操作都是异步的，适合AI代理的并发需求
- 路径抽象通过KaosPath实现，屏蔽本地与远程差异
