# OCR 优化 read_screen 工具设计文档

## 目标

将 `read_screen` 工具从"截图发 LLM"模式改为"截图 → 原生 OCR → 结构化 JSON"模式，**始终 OCR 优先**，消除图片 token 消耗。

## 参考实现

- [native-devtools-mcp (macOS OCR)](https://github.com/sh3ll3x3c/native-devtools-mcp/blob/main/src/macos/ocr.rs) — Apple Vision `VNRecognizeTextRequest`
- [native-devtools-mcp (Windows OCR)](https://github.com/sh3ll3x3c/native-devtools-mcp/blob/main/src/windows/ocr.rs) — WinRT `Windows.Media.Ocr.OcrEngine`
- [screenshot tool](https://github.com/sh3ll3x3c/native-devtools-mcp/blob/main/src/tools/screenshot.rs) — 截图 + OCR 整合示例

## 架构

```
┌─────────────────────────────────────────────────┐
│  read_screen tool (read-screen.ts)              │
│                                                 │
│  1. Electron desktopCapturer 截图 (PNG buffer)  │
│  2. 调用 platform OCR bridge                    │
│  3. 整理结构化 JSON 返回 LLM                    │
└───────────────┬────────────────────┬────────────┘
                │                    │
       ┌────────▼────────┐  ┌───────▼──────────┐
       │  macOS Bridge    │  │  Windows Bridge   │
       │  (Swift CLI)     │  │  (PowerShell)     │
       │                  │  │                    │
       │  Vision.framework│  │  Windows.Media.Ocr│
       │  VNRecognizeText│  │  OcrEngine        │
       │  Request         │  │                    │
       └─────────────────┘  └───────────────────┘
```

### 核心思路

项目是 Electron (Node.js/TypeScript)，不能直接调用 Rust 原生库。采用 **CLI Bridge** 方案：

- **macOS**: 编译一个 Swift 小工具，调用 `Vision.framework` 的 `VNRecognizeTextRequest`，读取 stdin PNG → 输出 JSON 到 stdout
- **Windows**: 用 PowerShell 脚本调用 `Windows.Media.Ocr.OcrEngine`（通过 C# inline），读取文件路径 → 输出 JSON 到 stdout
- **Electron 侧**: `child_process.execFile()` 调用 bridge，解析 JSON 结果

## 数据结构

### OCR 文本块 (TextMatch)

```typescript
interface TextMatch {
  text: string;       // 识别出的文本
  x: number;          // 中心点 X (屏幕坐标/逻辑点)
  y: number;          // 中心点 Y (屏幕坐标/逻辑点)
  confidence: number; // 置信度 0-1 (Windows 无此值，默认 1.0)
  bounds: {
    x: number;        // 左上角 X
    y: number;        // 左上角 Y
    width: number;    // 宽度
    height: number;   // 高度
  };
}
```

### read_screen 工具输出

```typescript
interface ReadScreenOutput {
  success: boolean;
  timestamp: string;
  mode: 'ocr';                    // 固定为 ocr
  ocr_results: TextMatch[];       // OCR 文本块列表
  summary: {
    window_title: string | null;  // 窗口标题 (从 ocr_results 推断)
    text_count: number;           // 检测到的文本块数量
    text_lines: string[];         // 所有识别文本 (供快速预览)
  };
  screenshot_path?: string;       // 截图本地路径 (UI 预览用)
}
```

### toModelOutput (发往 LLM 的格式)

始终返回**文本**，不再发图片：

```typescript
// 结构化 OCR 文本，带坐标信息
`## Screen OCR Results (${text_count} text elements detected)

Window: "Calculator"
Timestamp: 2026-05-18T10:30:00Z

### Detected Text (clickable coordinates):
- "File" at (45, 12) bounds: {x:20, y:4, w:50, h:16}
- "Edit" at (110, 12) bounds: {x:85, y:4, w:50, h:16}
- "Hello World" at (400, 300) bounds: {x:200, y:285, w:400, h:30}
- "Submit" at (450, 500) bounds: {x:400, y:480, w:100, h:40}
...`
```

## 文件结构

```
src/main/
  ocr/
    index.ts              # OCR 入口：平台检测 + 调用 bridge
    macos-bridge.swift    # Swift 源码：Vision OCR
    win-ocr.ps1           # PowerShell：WinRT OCR
    types.ts              # TextMatch 等类型定义
  tools/
    read-screen.ts        # 改造：OCR 优先管道
```

### 构建时处理

- `macos-bridge.swift` 需预编译为二进制，放在 `resources/` 目录
- electron-builder `extraResources` 配置将 bridge 二进制打包
- 开发时通过 npm script 编译 Swift

## macOS Swift Bridge 实现

参考 native-devtools-mcp 的 `ocr.rs`，核心逻辑：

```swift
// 伪代码
import Vision
import CoreImage
import Foundation

// 从 stdin 读取 PNG 数据
// 创建 CGImage
// 创建 VNImageRequestHandler
// 创建 VNRecognizeTextRequest (recognitionLevel: .accurate, usesLanguageCorrection: false)
// 遍历 results → VNRecognizedTextObservation
//   取 topCandidate(1) → text + confidence
//   boundingBox → 转换为屏幕坐标 (考虑 scale factor)
// 输出 JSON array 到 stdout
```

关键参数（参考 Rust 实现）：
- `recognitionLevel = 0` (accurate)
- `usesLanguageCorrection = false` (UI 自动化场景，提高单字符检测)
- 需要处理 Vision 的归一化坐标 (0-1, bottom-left origin) → 屏幕坐标转换
- 需要 `scale` 参数 (Retina = 2.0) 将像素转为逻辑点

### 坐标转换公式（直接参考 Rust 实现）

```swift
// Vision normalized → screen points
let px = normX * imgWidth
let pw = normW * imgWidth
let ph = normH * imgHeight
let py = (1.0 - normY - normH) * imgHeight  // Y 轴翻转

let screenX = px / scale
let screenY = py / scale
let centerX = (px + pw / 2.0) / scale
let centerY = (py + ph / 2.0) / scale
```

## Windows PowerShell Bridge 实现

参考 `windows/ocr.rs`，Windows 侧用 PowerShell + C# inline：

```powershell
# 加载 WinRT 程序集
Add-Type -AssemblyName System.Runtime.WindowsRuntime
# 调用 Windows.Media.Ocr.OcrEngine
# 调用 Windows.Graphics.Imaging.BitmapDecoder
# 遍历 result.Lines → Words
# 每个 word: Text, BoundingRect (X, Y, Width, Height)
# 输出 JSON
```

关键注意（参考 Rust 实现）：
- WinRT OCR **不提供 per-word confidence**，统一设 `1.0`
- `BitBlt` 截图在 Windows 上是逻辑坐标，scale_factor = 1.0
- 需要处理 async WinRT API（PowerShell 中用 `[WindowsRuntimeSystemExtensions.GetAwaiter]`）

## read-screen.ts 改造方案

### 新的 execute 流程

```typescript
execute: async ({ targetWindow, mode }) => {
  // 1. 截图 (复用现有 captureScreen)
  const pngBuffer = await captureScreenBuffer(targetWindow);

  // 2. 保存截图到临时文件 (UI 预览用)
  const screenshotPath = saveScreenshot(pngBuffer);

  // 3. 调用 OCR bridge
  const ocrResults = await runOCR(pngBuffer, getScaleFactor());

  // 4. 整理结构化输出
  return {
    success: true,
    timestamp: new Date().toISOString(),
    mode: 'ocr',
    ocr_results: ocrResults,
    summary: {
      window_title: inferWindowTitle(ocrResults),
      text_count: ocrResults.length,
      text_lines: ocrResults.map(m => m.text),
    },
    screenshot_path: screenshotPath,
  };
}
```

### 新的 toModelOutput

```typescript
toModelOutput: (output) => {
  if (!output.success) return { type: 'text', text: output.message };

  // 过滤低置信度
  const filtered = output.ocr_results.filter(m => m.confidence > 0.5);

  const lines = filtered.map(m =>
    `- "${m.text}" at (${Math.round(m.x)}, ${Math.round(m.y)}) ` +
    `bounds: {x:${Math.round(m.bounds.x)}, y:${Math.round(m.bounds.y)}, ` +
    `w:${Math.round(m.bounds.width)}, h:${Math.round(m.bounds.height)}}`
  );

  const text = [
    `## Screen OCR Results (${filtered.length} text elements)`,
    `Window: ${output.summary.window_title || 'Unknown'}`,
    `Timestamp: ${output.timestamp}\n`,
    '### Detected Text (coordinates are clickable):',
    ...lines,
  ].join('\n');

  return { type: 'text', text };
}
```

### inputSchema 变更

```typescript
inputSchema: z.object({
  reason: z.string().optional(),
  targetWindow: z.string().optional(),
  // 新增: 是否返回图片给 LLM (默认 false，OCR 优先)
  includeImage: z.boolean().optional().default(false),
}),
```

## UI 渲染变更 (ReadScreenTool.tsx)

当前显示截图缩略图。改造后：
- 保留截图缩略图 (从 screenshot_path 加载本地文件)
- 新增 OCR 文本块列表预览（前 10 个）
- 显示 "OCR 模式" 标识

## Agent 系统提示词调整

关键变更：
- `read_screen` 现在返回**文本坐标**而非图片
- LLM 不需要"看"图片，直接根据文本坐标定位元素
- `execute_action` 的坐标可以直接使用 OCR 返回的坐标

## Token 节省估算

| 场景 | 当前 (图片) | 优化后 (OCR 文本) | 节省 |
|------|-------------|-------------------|------|
| 1920x1080 PNG | ~500K-2M tokens | ~1K-5K tokens | **99%+** |
| 单窗口截图 | ~200K-800K tokens | ~500-2K tokens | **99%+** |

## 实现顺序

1. **Swift bridge** — macOS OCR CLI 工具
2. **PowerShell bridge** — Windows OCR 脚本
3. **OCR 模块** (`src/main/ocr/`) — Node.js 封装
4. **read-screen.ts 改造** — 新管道
5. **UI 更新** — ReadScreenTool.tsx
6. **Agent 提示词** — 系统指令适配
