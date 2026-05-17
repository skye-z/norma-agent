# Norma MVP 实施计划

基于 PRD 设计，MVP (Minimum Viable Product) 划分为 10+ 个可运行的版本迭代。每个版本都保证项目能够正常启动，逐步叠加核心能力。

- [x] **v0.1 - 骨架搭建 (Project Init)**
- [x] **v0.2 - 核心 UI 接入 (UI Shell)**
- [x] **v0.3 - 大脑接入 (Mastra Base)**
- [x] **v0.4 - 双模态 UI (Command Bar)**
- [x] **v0.5 - 前端页面完善 (Frontend Pages)**
- [x] **v0.6 - 兜底引擎 V1：感知 (Native Sensing)**
- [x] **v0.7 - 兜底引擎 V2：控制 (Native Action)**
- [x] **v0.8 - 扩展生态 (MCP Support)**
- [x] **v0.9 - 记忆系统初探 (Semantic Memory)**
- [x] **v0.10 - 群聊与工作流 (SubAgent & UI Reveal)**
- [x] **v0.11 - 自愈机制与打磨 (Self-Healing & Polish)**

---

## v0.12 — 严重缺陷修复

### 🔴 Critical（功能崩溃级）

- [x] **C1: `preload.ts` onMessage 监听器注册 bug**
  - `onMessage` 多了一层 `() =>` 包装，返回值是 `() => (() => void)` 而非 `() => void`
  - 后果：`chat:chunk/done/error` 监听器永远不注册，聊天流式响应完全不工作
  - "取消订阅"时反向创建新监听器，每次聊天泄漏 3 个监听器
  - 修复：移除多余 `() =>`，让函数体立即执行

- [x] **C2: 并发 chat:send 无隔离**
  - 两条流式响应交替往同一窗口发 `chat:chunk`，输出乱码
  - 第一条 `chat:done` 终止渲染端生成器，第二条后续 chunk 丢失
  - 修复：加 AbortController 互斥，新一代请求取消旧请求

- [x] **C3: AutoQueueSender 只发第一条排队消息**
  - `useEffect` 依赖 `[thread.isRunning]`，`isRunning` 变 false 时只触发一次 `dequeueFirst`
  - 后续排队消息永远留在队列
  - 修复：加 `queue.length` 到依赖数组，每次 completion 后检查队列

- [ ] **C4: 模型切换实装验证**
  - `_activeModel` 存了但从未使用；agent 硬编码为 `gpt-4o-mini` / `gpt-4o`
  - `streamOptions.model` 虽然传入但 Mastra Agent 可能不尊重覆写
  - 修复：验证 Mastra stream model override 是否生效，必要时动态创建 model instance

- [ ] **C5: 自动化触发器永远是 true**
  - `triggerStep` 忽略 `trigger` 参数始终返回 `shouldRun: true`
  - `executeStep` 是空操作，只拼接字符串
  - 修复：实现真正的 trigger 评估逻辑和 agent 调用执行

### 🟠 High（严重但不会立即崩溃）

- [x] **H1: window 操作目标错误窗口**
  - `getFocusedWindow()` 可能操作命令栏而非主窗口
  - 修复：改 `BrowserWindow.fromWebContents(event.sender)`

- [x] **H2: API key 并发覆盖 + 环境变量破坏**
  - `process.env` 写入在并发请求时互相覆盖
  - `delete process.env.OPENAI_BASE_URL` 破坏用户 .env 配置
  - 修复：finally 块中恢复原始环境变量值

- [x] **H3: fallback 响应拼接用户输入（XSS 向量）**
  - `"I received your message: " + message` 直接拼入流式响应
  - 修复：移除用户输入拼接，改为固定提示文本 "请先在设置中配置 API Key。"

- [ ] **H4: sendMessage/onMessage 暴露任意 IPC channel**
  - `sendMessage` 和 `onMessage` 是原始 `ipcRenderer.send/on` 的透传
  - 修复：移除这两个通用方法，改为具体的 channel 方法（暂缓，影响 chat IPC）

- [x] **H5: config CREATE TABLE 异步未等待**
  - `initConfig` 中 `_client.execute(CREATE TABLE)` 是 async 但 fire-and-forget
  - 后续 `setConfig` 可能在表不存在时写入丢失
  - 修复：`initConfig` 改为 async，用 Promise 锁确保表创建完成

- [x] **H6: Windows 路径 file: URL 未转义**
  - `file:C:\Users\...` 中反斜杠和冒号不合法
  - 修复：Windows 平台路径替换反斜杠为正斜杠

- [ ] **H7: QueueDisplay handleSendNext 消息丢失**
  - async 函数无错误处理；先 dequeue 再 append，append 失败则消息丢失
  - 300ms 等待 `cancelRun` 是不可靠的魔数
  - 修复：先 append 再 dequeue（或失败时 re-enqueue）；监听 cancel 完成事件而非硬等时间

- [x] **H8: queue.ts dequeue 越界返回 undefined**
  - `dequeue(index)` 不检查边界，返回 `undefined` 被当文本发送
  - 修复：加边界检查，越界时返回 null 并在调用方处理

- [x] **H9: chat:cancel 未实现**
  - 用户点停止只取消前端监听器，后端继续消耗 token 生成响应
  - 修复：实现 `chat:cancel` IPC，后端用 AbortController 终止流，前端 abortSignal 时发送取消

- [x] **H10: ModelSelector selectedIdx 越界 crash**
  - `models` 列表缩短后 `selectedIdx` 指向不存在的元素
  - 修复：用 `Math.min(selectedIdx, models.length - 1)` 保护

### 🟡 Medium（逻辑漏洞/设计缺陷）

- [ ] **M1: _activeModel/_providerConfig 全局变量无互斥**
  - 多个 IPC 调用可同时读写
  - 修复：加锁或使用 per-session context

- [x] **M2: config.ts getClient() 并发创建两个 Client**
  - `_client` null 时两路并发均创建 Client，第一个连接泄漏
  - 修复：加 `_initPromise` 初始化锁

- [x] **M3: config.ts setConfig 三元表达式无意义**
  - `typeof value === 'string' ? JSON.stringify(value) : JSON.stringify(value)` 两分支相同
  - 修复：直接 `JSON.stringify(value)`

- [ ] **M4: configGetAll 泄露 API key**
  - 返回所有配置含 API key，渲染进程可读
  - 修复：过滤敏感字段，或限制 key 前缀

- [ ] **M5: useDbState 首次渲染值闪烁**
  - 初始值是空/默认，DB 数据异步加载后替换，造成闪烁
  - 修复：使用 `loaded` flag 控制渲染，加载完成前显示骨架屏/空白

- [ ] **M6: _state.activeThreadId 非响应式**
  - 普通对象，React 无法追踪变化
  - 修复：改用 React context 或 event emitter

- [ ] **M7: syncActiveModelConfig 只跑一次**
  - 依赖 `[]`，设置页改模型后不同步到后端
  - 修复：监听 `norma-providers` / `norma-enabled-models` 变化重新同步

- [ ] **M8: WebSpeechDictationAdapter 每次渲染重建**
  - 修复：`useMemo` / `useRef`

- [ ] **M9: handleSwitchSession 读取过期 sessions 闭包**
  - `sessions.find()` 使用的是旧值
  - 修复：用 `setSessions` 的 callback 形式或 `useRef`

- [ ] **M10: 线程列表只同步一次**
  - 创建/删除后本地与后端不同步
  - 修复：加事件驱动或定时轮询同步

- [ ] **M11: 无 API key 时 embedder 返回空数组**
  - 语义搜索静默失败无提示
  - 修复：搜索时检查返回条数，0 条时提示用户配置 API key

- [ ] **M12: knowledge.ts listDocuments 用零向量查询**
  - 返回结果随机
  - 修复：改用 metadata 直查或独立文档表

- [ ] **M13: ensureIndex 吞掉所有错误**
  - 索引不存在时后续查询报不明确错误
  - 修复：抛出或记录错误

- [ ] **M14: readFileSync 阻塞主线程**
  - 大文件导致 UI 卡死
  - 修复：改 `await fs.promises.readFile()` + 文件大小限制

- [ ] **M15: docId 用 Date.now() 毫秒精度并发冲突**
  - 修复：加随机后缀或 UUID

- [x] **M16: metadata spread 覆盖 docId/chunkIndex**
  - 修复：将关键字段放在 spread 之后

---

## v0.13 — 前端功能实装

以下功能已有 UI 但后端未实装或逻辑是空壳，需要完整接入。

### 核心链路

- [ ] **聊天取消机制**
  - 前端 `ComposerPrimitive.Cancel` 点击后只断开前端监听器，后端继续消耗 token
  - 需实现 `chat:cancel` IPC，后端收到后用 AbortController 终止 `agent.stream()`
  - 前端 `ipc-chat.ts` 增加 abort 信号到 `run()` 参数，abort 时发 IPC 取消

- [ ] **模型切换实装**
  - 后端 `_activeModel` 虽存储但 agent.stream 从未使用
  - 需验证 Mastra `agent.stream(msg, { model: modelString })` 是否真正覆写默认模型
  - 若不支持，需在 stream 时动态创建 `new Model(modelString)` 实例传入

- [ ] **并发消息隔离**
  - 当前多消息并发会导致流式输出交替混乱
  - 方案：为每个 chat:send 生成唯一 requestId，stream chunk 带 requestId，前端按 id 过滤
  - 或：后端强制串行，新请求自动取消旧请求

### 自动化系统

- [ ] **触发器评估引擎**
  - 当前 `triggerStep` 硬编码返回 `{ shouldRun: true }`
  - 需实现触发器语法解析器：支持时间(cron)、事件(webhook)、条件表达式
  - UI 端增加触发器类型选择和参数配置

- [ ] **自动化执行引擎**
  - 当前 `executeStep` 是空操作，只拼字符串
  - 需接入 Agent 系统：创建独立 Agent 实例执行自动化任务
  - 执行结果需持久化，支持历史查看

- [ ] **自动化状态持久化**
  - 当前自动化配置只在 config DB，创建/删除/启停没有后端存储
  - 需设计 workflow 实例表：id、name、trigger、status、lastRun、result

### 知识库系统

- [ ] **文档列表准确获取**
  - 当前用零向量做相似度搜索来列出所有文档，结果随机且不完整
  - 需独立文档元数据表（docId、name、createdAt、chunkCount），ingest 时写入，delete 时删除

- [ ] **文档大小/类型限制**
  - 无文件大小限制，大文件可卡死主线程
  - 无文件类型校验（All Files 允许任意类型）
  - 需限制文件大小（如 5MB）、白名单扩展名、异步读取

- [ ] **搜索结果展示增强**
  - 当前搜索只显示 score 和 metadata，用户无法预览匹配片段
  - 需返回匹配文本片段（chunk text），前端高亮显示

### 会话系统

- [ ] **线程列表实时同步**
  - 当前只在 mount 时同步一次，之后创建/删除不会更新
  - 方案 A：后端 thread 变更时 IPC push 通知
  - 方案 B：前端定时轮询（每 30s）
  - 方案 C：操作后手动刷新

- [ ] **会话标题自动生成**
  - Mastra Memory 有 generateTitle 配置但需验证实际效果
  - 需 IPC 监听 title 变更事件并更新前端

- [ ] **排队消息自动清空**
  - AutoQueueSender 只发第一条，后续永远留在队列
  - 修复：发完一条后检查队列是否还有，若还有且有模型空闲则继续

### 设置系统

- [ ] **Provider 配置实时同步**
  - 当前 ModelSelector/runtime syncActiveModelConfig 只在 mount 时跑一次
  - 设置页改 provider/model 后，运行中的对话不会感知新配置
  - 需要：设置页保存时 IPC push 通知 → 各组件监听刷新

- [ ] **maxSteps 实时生效**
  - `getMaxSteps()` 只在 runtime 创建时读取一次
  - 修改设置后需要重启对话才生效
  - 修复：useEffect 监听 storage 变化，更新 runtime options

### 诊断系统

- [ ] **日志内容脱敏**
  - 当前用户消息原文被写入诊断日志，可能含敏感信息
  - 需截断或 hash 处理

- [ ] **日志持久化**
  - 当前日志只存在内存 buffer（2000 条），重启丢失
  - 需持久化到 DB 或文件

### 安全加固

- [ ] **IPC channel 白名单**
  - 移除 `sendMessage`/`onMessage` 通用方法
  - 所有 IPC 通信改为具体 channel 方法（`chat:send`, `chat:chunk` 监听等）

- [ ] **configGetAll API key 过滤**
  - `configGetAll` 不应返回 `apiKey` 等敏感字段
  - 渲染进程获取 provider 列表时 API key 应掩码显示

- [ ] **window 操作绑定发送者窗口**
  - `window:hide/minimize/resize` 应 `BrowserWindow.fromWebContents(event.sender)`

- [ ] **fallback 响应移除用户输入拼接**
  - 改为固定文本："请先在设置中配置 API Key"

---

## v0.14+ 规划（暂缓）

- [ ] WebSpeechDictationAdapter 内存优化
- [ ] queue.ts 改为 per-instance 而非全局单例
- [ ] ModelSelector dropdown 键盘交互（Escape 关闭、方向键导航）
- [ ] useDbState 初始值闪烁骨架屏
- [ ] 长时间流式响应 toolCalls Map 内存增长
- [ ] MCP 进程环境变量最小化（仅传必需 key）
- [ ] config DB 优雅关闭（app quit 时 flush）
- [ ] formatTimeAgo NaN 兜底