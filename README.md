# Norma - 你的智能桌面助理

这是一个基于 Mastra + Electron 的本地桌面端人格化智能体, 能执行复杂任务并自我学习自我改进的超级代理

## 选型

| 组件 | 选型 |
| --- | ---- |
| 基座 | Node.js 24+ LTS |
| 语言 | TypeScript |
| 桌面 | Electron 42+ |
| 包管理 | PNPM |
| JSON | Zod |
| 智能体框架 | Mastra |
| UI框架 | AssistantUI |
| 技能标准 | AgentSkills |

## 功能模块

- 代理基座
  - 模型接入
  - 工具调用
  - 敏感操作审批
  - SubAgent
- 记忆层
- 能力库
- 自动化

## 预设目标

内建大量原子能力库(调用本地应用、模拟键鼠操作、调用MCP)可供智能体调用或由智能体编排本地工作流来完成复杂任务, 同时支持群聊式智能体互相调用和强大的SubAgent能力

## 目录结构规划

```text
.
├── docs/                   # 项目文档与 PRD 设计
├── src/                    # 源代码
│   ├── main/               # Electron 主进程 (Node.js 环境)
│   │   ├── agent/          # Mastra 智能体、SubAgent、Tools 定义
│   │   ├── core/           # 兜底引擎 (原生截屏、键鼠控制)
│   │   ├── mcp/            # MCP Client 与扩展管理
│   │   ├── memory/         # 记忆层与 SQLite 数据库交互
│   │   ├── ipc/            # 主进程与渲染进程 IPC 通信处理
│   │   └── index.ts        # 主进程入口
│   ├── renderer/           # Electron 渲染进程 (浏览器界面环境)
│   │   ├── src/            # 前端 React 源码 (使用 AssistantUI)
│   │   │   ├── components/ # UI 组件 (聊天气泡、命令栏、思考面板)
│   │   │   ├── hooks/      # 自定义 Hooks
│   │   │   ├── store/      # 状态管理
│   │   │   └── App.tsx     # 前端入口
│   │   └── index.html      # 页面模板
│   └── shared/             # 主进程与渲染进程共享的数据类型、Zod Schema 等
├── scripts/                # 构建与开发自动化脚本
├── .gitignore              # Git 忽略配置
├── TODO.md                 # MVP 迭代实施计划
├── package.json            # 项目依赖配置
└── README.md               # 项目说明
```

