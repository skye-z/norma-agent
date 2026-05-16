# Norma MVP 实施计划

基于 PRD 设计，MVP (Minimum Viable Product) 划分为 10 个可运行的版本迭代。每个版本都保证项目能够正常启动，逐步叠加核心能力。

- [x] **v0.1 - 骨架搭建 (Project Init)**
  - [x] 初始化 Node.js 24 + pnpm 项目。
  - [x] 配置 TypeScript 环境。
  - [x] 集成 Electron 42 框架，实现最基础的 Hello World 主窗口显示。
  - [x] 配置基本的开发脚本 (start, build)。

- [x] **v0.2 - 核心 UI 接入 (UI Shell)**
  - [x] 在渲染进程中接入 AssistantUI 框架。
  - [x] 实现基础的聊天气泡、输入框交互界面。
  - [x] 构建主进程 (Main) 与渲染进程 (Renderer) 的 IPC (进程间通信) 桥梁。

- [x] **v0.3 - 大脑接入 (Mastra Base)**
  - [x] 在主进程中集成 Mastra 框架。
  - [x] 实例化一个基础的 Router Agent，接入 LLM (如 OpenAI/Anthropic 接口)。
  - [x] 实现用户在前端发送消息 -> IPC 转发 -> Mastra Agent 处理 -> 流式返回 UI 的完整链路。

- [x] **v0.4 - 双模态 UI (Command Bar)**
  - [x] 开发全局唤出命令栏的独立透明窗口。
  - [x] 注册全局系统快捷键 (如 Cmd+Space 变体) 控制命令栏的显示/隐藏。
  - [x] 实现命令栏输入内容与后台 Agent 的快捷交互及结果轻量化展示。

- [x] **v0.5 - 前端页面完善 (Frontend Pages)**
  - [x] 实现导航路由：`activeNav` 切换右侧内容区域渲染不同页面
  - [x] 自动化页面：任务列表、创建/启用/停用自动化工作流的 UI 骨架
  - [x] 能力页面：展示 Agent 已注册工具/技能的卡片网格（read_screen、execute_action 等）
  - [x] 知识库页面：文档列表、上传入口、搜索/检索 UI 骨架
  - [x] 设置页面：模型选择、API Key 管理、快捷键显示、主题/关于信息
  - [x] 会话管理：新建会话、删除会话、切换会话（前端状态管理）

- [x] **v0.6 - 兜底引擎 V1：感知 (Native Sensing)**
  - [x] 集成屏幕截图相关 Node/Electron 原生能力 (如 `desktopCapturer`)。
  - [x] 将截图能力封装为 Mastra Tool (工具)，让 Agent 能够根据指令"看"屏幕。
  - [x] (可选) 接入轻量级本地 OCR 或依赖大模型 Vision 能力解析截图内容。
  - [x] 更新 Chat IPC 使用 `fullStream` 以支持 tool-call/tool-result 结构化流传输。
  - [x] 测试完整的截屏 → Agent 分析 → 返回结果流程。

- [x] **v0.7 - 兜底引擎 V2：控制 (Native Action)**
  - [x] 引入 `robotjs` 或 `nut.js` 库，获得操作系统的键鼠控制权限。
  - [x] 封装基础操作工具 (鼠标移动、点击、键盘输入) 给 Agent 调用。
  - [x] 测试 Agent 根据屏幕截图坐标，执行一次完整的“点击指定位置”的自动化流。

- [ ] **v0.8 - 扩展生态 (MCP Support)**
  - [ ] 在主进程实现基础的 MCP Client 协议。
  - [ ] 编写代码支持连接一个本地的测试 MCP Server (例如读取本地文件系统的 MCP)。
  - [ ] 让 Norma 能够通过 MCP 协议感知并调用 Server 提供的工具。

- [ ] **v0.9 - 记忆系统初探 (Semantic Memory)**
  - [ ] 集成本地 SQLite 数据库。
  - [ ] 编写简单的 Memory Consolidation 逻辑：拦截对话，提取关键信息。
  - [ ] 将提取的记忆在下一次对话的 System Prompt 中进行 Context 注入。

- [ ] **v0.10 - 群聊与工作流 (SubAgent & UI Reveal)**
  - [ ] 利用 Mastra 创建至少两个专门的 SubAgent (例如 `ResearchAgent`, `SystemAgent`)。
  - [ ] 实现 Router Agent 根据任务复杂度向 SubAgent 派发任务的逻辑。
  - [ ] 在主窗口 UI 侧增加“思考过程 (Thinking Panel)”折叠组件，展示内部 Agent 的对话和工具调用日志。

- [ ] **v0.11 - 自愈机制与打磨 (Self-Healing & Polish)**
  - [ ] 完善 Tool 调用的错误捕获机制 (try-catch std/err)。
  - [ ] 编写发生错误时 Agent 的重试 Prompt 模板，实现简单的闭环自修复逻辑。
  - [ ] 调整 UI 样式，统一主题，完成 Electron 应用的基础打包配置 (electron-builder)，输出可执行程序。
