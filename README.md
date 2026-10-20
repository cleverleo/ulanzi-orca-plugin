# Ulanzi Orca Projects

用于 macOS Ulanzi Studio 的 Orca 插件。自动汇总本机和全部已配置远程环境，按实际按钮数量显示 worktree 与 Agent 状态并跳转终端；另外提供可绑定 Agent 类型的额度按钮。

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

`mise run install` 将构建产物复制到 `~/Library/Application Support/Ulanzi/UlanziDeck/Plugins/`。首次安装拒绝覆盖已有插件目录；升级用 `mise run update`，先备份到 UlanziDeck/bak 再更新本插件。也可将 dist 中完整的 `com.ulanzi.orcaprojects.ulanziPlugin` 文件夹手动复制到该位置。安装不会修改已有按键配置；如 Studio 没有显示插件或仍显示旧版本，重新启动 Studio。

把同一种「Orca 工作区」按钮拖到设备上即可：拖几个就启用几个位置，按从左到右、从上到下自动编号，不需要选择坑位或环境。一个按钮对应一个 worktree，同项目的多个 worktree 分别显示，空位显示「空坑位」。

按键图标直接绘制 Agent 品牌图标、项目名、Orca 侧边栏的 worktree 显示名称（例如 Health check all l2）和状态，不依赖 Studio 的文字叠加设置。优先使用 Orca 的 displayName；未设置显示名称时，回退到 worktree 目录名，主工作区回退到 main。支持 Claude、Codex、Gemini、Cursor、OpenCode、Grok；其他 Agent 显示终端图标和实际类型名称，普通终端显示 Terminal。多个 Agent 时优先采用需要确认、异常或工作中的 Agent 图标，图标上不再额外显示 Agent 名称文字，配置页仍可查看检测到的类型。长名称自动换行或省略。 Agent 图标使用 oversize 背景，透明度为 35%，文字区域叠加半透明灰底。SVG 使用单一根节点和显式图形变换，避免 Qt 对嵌套 SVG 视口的缩放差异。

Orca 的 `environment list` 用于自动发现远程环境；随后并发读取本机和各远端的 `worktree ps`，使用各自环境路由跳转。新增或移除环境后自动同步，按钮无需配置。CLI 默认路径为 `/Applications/Orca.app/Contents/Resources/bin/orca`，可自定义绝对路径。

每 2.5 秒尝试刷新一次；相同 CLI 路径共享查询，上一轮未结束时不会重叠。首次按最近活跃时间从新到旧填位，本机与远程环境统一排序；使用 Orca 的 lastActivityAt，缺失时回退到终端 lastOutputAt，相同时间按工作区身份稳定排序。之后已分配的 worktree 保持逻辑位置；活动变化不自动重排。关闭 worktree 后空位按活跃时间补入。

容量与当前页面实际启用的按钮数量一致：未放置的按钮不占位，多余 worktree 在配置页显示等待数量。删除或移动按钮时自动重新计算位置；切换页面导致的 setactive 不是删除，分别保存各布局的分配，返回时恢复。Studio 启动时成批发送的按钮事件会合并处理。远端暂时不可达时保留位置并显示「未知」，从 Orca 移除环境后释放它的位置。

按下时重新获取终端句柄，优先定位等待确认或工作中的 Agent，随后选择最近输出的终端。如刷新期间坑位刚换了 worktree，会提示再按一次，避免跳错项目。没有终端时显示提示，不会创建会话或发送输入。

## 状态含义

「Orca 工作区」按钮：

| 显示 | 含义 |
|---|---|
| 待确认 | Agent waiting/blocked，或程序报告阻塞 |
| 工作中 | Agent working |
| 已完成 | Agent done，代表当前轮完成，不代表整个项目完成 |
| 空闲 | Agent idle，或只有存活的普通终端 |
| 空坑位 | 此位置尚未分配运行中的 worktree |
| 未知 | 查询失败、无法确认终端存活或未知的 Agent 状态 |

管理字段 workspaceStatus 不作为 Agent 工作状态；查询失败不会继续显示缓存中的工作状态。项目以环境、工作区和 host 区分，不只按项目名称匹配。仅有已停止终端、且没有执行中 Agent 的工作区不占位。一个 worktree 内有多个 Agent 时共用一个坑位。

## Agent 额度

只提供一种「Agent 额度」按钮。在每个按钮的设置页选择绑定的 Agent 类型，可以分别配置 Claude、Codex、Cursor、Antigravity 等。它们不参与工作区按钮的容量或位置排序。

图标显示**已用比例**及对应窗口的重置倒计时。支持会话、每周和每月窗口；缺失的窗口不会补成 0%。单窗口放大显示，双窗口分别显示。环境自动发现；同一类型在多个环境都有数据时，优先选新鲜有效数据中已用比例最高的环境，设置页列出所有环境及窗口明细。数据超过 5 分钟会标为过期缓存；读取失败或 Orca 未提供额度时明确显示状态。

每 30 秒读取一次 Orca 当前额度快照，按下按钮或配置页刷新也会重新读取。这里与 Orca 的数据显示同步，刷新不强制向供应商发起额外查询。读取的是每个环境在 Orca 当前额度目标下展示的账号额度，不汇总已用比例或自动切换账号。

工作区仍通过公开 CLI 查询。额度使用安装包自带的 `RuntimeClient` 调用内部只读 `accounts.list`，通过独立 Node.js 子进程执行，适配器只输出白名单内的额度指标，不传出账号详情、令牌或凭据，也不调用额度重置信用等消费操作。已验证 Orca 1.4.232 的本机和远端读取；这是内部接口，未来 Orca 版本变动时可能需要更新适配，失败会显示不可用。

`mise run quota-probe` 可输出脱敏后的真实额度。`mise exec -- node scripts/probe-quotas.mjs --preview` 额外生成 `dist/quota-preview.html`，便于检查图标。生成的倒计时图标缓存会定期清理旧文件，保留当前显示的图标。

## 验证与限制

`mise run check` 验证状态优先级、坑位稳定性和复用、实际按钮容量和物理位置排序、跨主机终端选择、自动环境发现、断线保位与恢复、CLI 参数传递和错误处理。`mise run integration` 用模拟 Studio 和 Orca 验证构建产物的连接、已保存坑位恢复、空坑位、图标、配置页数据、按键跳转请求以及按键清理。`mise run probe` 自动查询全部环境，只输出项目元信息，不输出对话、终端正文或工具参数。最终屏幕排版、Studio 加载及窗口前台行为仍需真机验证。

主服务读写 Studio 全局设置必须携带实际按键 context，首次收到 add 后才发出请求；集成测试也模拟真实 Studio 忽略无 context 请求的行为。插件根目录 `diagnostics.json` 记录连接、设置加载、查询阶段、项目数量和错误，不包含对话正文，便于定位「全部未知」。本机 Studio 3.4.4 已验证全局设置回复、6 个 worktree 数据查询以及按键图标发送。

首次安装后可以依次验证：拖出几个「Orca 工作区」按钮；等待确认时变为黄色；本轮完成时变为绿色；按下跳转对应终端；新增 worktree 自动补位；远端断线显示未知，恢复后原位更新。

第三方 SDK 使用 Apache-2.0，构建保留其 LICENSE；ws 和 Lobe Icons 使用 MIT，保留包内声明。

### 语言

支持简体中文和英文，跟随 Ulanzi Studio 的语言设置；其他语言回退到英文。动作列表、设置页、按键状态和额度倒计时均已本地化，项目及 worktree 名称保留原文。更改 Studio 语言后重启 Studio 生效。

工作区关闭后，剩余工作区按最后活跃时间重新分配坑位；仅活跃时间变化时保持原位置。远程环境暂时断连会保留坑位，不视为工作区关闭。

切回 Deck 页面时，也会重新读取并按最新活跃时间排序；停留在页面期间保持位置稳定。
