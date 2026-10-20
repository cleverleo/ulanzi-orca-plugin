# Ulanzi Orca Projects

用于 macOS Ulanzi Studio 的 Orca 项目按键插件。显示工作区与 Agent 状态，按下后跳到 Orca 对应终端。第一版仅使用 Orca CLI，不包含账号额度。

## 开发

开发环境由 [mise](https://mise.jdx.dev/) 管理，Node.js 固定为 20.18.0，与本机 Studio 内置运行时一致。

```sh
mise trust
mise install
git clone --recurse-submodules https://github.com/UlanziTechnology/UlanziDeckPlugin-SDK.git vendor/UlanziDeckPlugin-SDK
mise run setup
mise run check
mise run integration
mise run build
mise run probe
mise run package
```

官方 SDK 主仓库版本以 `sdk-versions.json` 为准，构建会验证版本；已有 vendor 目录时无需再次 clone。构建前应按该文件 checkout 主仓库，再执行 `git submodule update --init --recursive`。构建目录自带 SDK 和 ws，无需目标电脑安装 npm 依赖。任务显式通过 `mise exec` 启动 Node.js，避免本机 shell 的 PATH 配置覆盖固定版本。

## 安装和使用

`mise run install` 将构建产物复制到 `~/Library/Application Support/Ulanzi/UlanziDeck/Plugins/`。它拒绝覆盖已有插件目录。也可将 dist 中完整的 `com.ulanzi.orcaprojects.ulanziPlugin` 文件夹手动复制到该位置。安装不会修改已有按键配置；如 Studio 没有显示插件，重新启动 Studio。

把「Orca 项目」拖到按键，在配置页选择工作区。每个按键可分别指定本机或 Orca 已保存的远端环境名称，例如 `macbook-home`。CLI 默认路径为 `/Applications/Orca.app/Contents/Resources/bin/orca`，可自定义绝对路径。

每 2.5 秒查询一次；相同 CLI 路径和环境共享查询，查询不会重叠。按下时重新获取终端句柄，优先定位等待确认或工作中的 Agent，随后选择最近输出的终端。没有终端时显示提示，不会创建会话或发送输入。

## 状态含义

| 显示 | 含义 |
|---|---|
| 待确认 | Agent waiting/blocked，或程序报告阻塞 |
| 工作中 | Agent working |
| 已完成 | Agent done，代表当前轮完成，不代表整个项目完成 |
| 空闲 | Agent idle，或只有存活的普通终端 |
| 未运行 | 未发现存活终端，或选定工作区不在成功查询的列表中 |
| 未知 | 查询失败、无法确认终端存活或未知的 Agent 状态 |

管理字段 workspaceStatus 不作为 Agent 工作状态；查询失败不会继续显示缓存中的工作状态。远端的未覆盖范围显示在配置页，不等同于远端已停止。项目以工作区和 host 区分，不只按项目名称匹配。

## 验证与限制

`mise run check` 验证状态优先级、跨主机终端选择、CLI 参数传递和错误处理。`mise run integration` 用模拟 Studio 和 Orca 验证构建产物的连接、图标、配置页数据、按键跳转请求以及按键清理。`mise run probe` 只输出项目元信息，不输出对话、终端正文或工具参数。最终屏幕排版、Studio 加载及窗口前台行为仍需真机验证。

首次安装后可以依次验证：选择项目后图标变化；等待确认时变为黄色；本轮完成时变为绿色；按下跳转对应终端；退出 Orca 后显示未知并提示无法连接。

第三方 SDK 使用 Apache-2.0，构建保留其 LICENSE；ws 使用 MIT，保留包内声明。
