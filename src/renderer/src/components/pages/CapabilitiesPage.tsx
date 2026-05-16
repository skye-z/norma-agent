import React, { useState } from "react";

interface Capability {
  id: string;
  name: string;
  desc: string;
  icon: React.ReactNode;
  status: "ready" | "coming";
  category: string;
}

const CAPABILITIES: Capability[] = [
  {
    id: "read_screen",
    name: "屏幕感知",
    desc: "读取并分析当前屏幕内容",
    icon: (
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
        <line x1="8" y1="21" x2="16" y2="21" />
        <line x1="12" y1="17" x2="12" y2="21" />
      </svg>
    ),
    status: "ready",
    category: "感知",
  },
  {
    id: "execute_action",
    name: "系统操控",
    desc: "模拟鼠标键盘操作",
    icon: (
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
      </svg>
    ),
    status: "ready",
    category: "控制",
  },
  {
    id: "file_manager",
    name: "文件管理",
    desc: "文件搜索、读取、整理",
    icon: (
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
      </svg>
    ),
    status: "ready",
    category: "工具",
  },
  {
    id: "web_search",
    name: "网络搜索",
    desc: "搜索互联网信息",
    icon: (
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <circle cx="12" cy="12" r="10" />
        <line x1="2" y1="12" x2="22" y2="12" />
        <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
      </svg>
    ),
    status: "coming",
    category: "知识",
  },
  {
    id: "code_gen",
    name: "代码生成",
    desc: "编写和分析代码",
    icon: (
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <polyline points="16 18 22 12 16 6" />
        <polyline points="8 6 2 12 8 18" />
      </svg>
    ),
    status: "ready",
    category: "工具",
  },
  {
    id: "ocr",
    name: "文字识别",
    desc: "识别图片和屏幕中的文字",
    icon: (
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <path d="M4 7V4a2 2 0 0 1 2-2h2" />
        <path d="M16 2h2a2 2 0 0 1 2 2v3" />
        <path d="M20 17v3a2 2 0 0 1-2 2h-2" />
        <path d="M8 22H6a2 2 0 0 1-2-2v-3" />
        <line x1="12" y1="8" x2="12" y2="16" />
        <line x1="8" y1="12" x2="16" y2="12" />
      </svg>
    ),
    status: "coming",
    category: "感知",
  },
  {
    id: "voice_io",
    name: "语音交互",
    desc: "语音输入和语音合成输出",
    icon: (
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
        <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
        <line x1="12" x2="12" y1="19" y2="22" />
      </svg>
    ),
    status: "ready",
    category: "交互",
  },
  {
    id: "clipboard",
    name: "剪贴板",
    desc: "读写系统剪贴板内容",
    icon: (
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
        <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
      </svg>
    ),
    status: "coming",
    category: "工具",
  },
];

const CapabilitiesPage: React.FC = () => {
  const [filter, setFilter] = useState<string>("all");
  const categories = ["all", ...new Set(CAPABILITIES.map((c) => c.category))];
  const filtered =
    filter === "all"
      ? CAPABILITIES
      : CAPABILITIES.filter((c) => c.category === filter);
  const readyCount = CAPABILITIES.filter((c) => c.status === "ready").length;

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      <div className="flex-1 overflow-y-auto px-5 py-4">
        <div className="flex items-center gap-2 mb-3">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setFilter(cat)}
              className={`px-2.5 py-1 rounded-full text-[10px] transition-colors ${
                filter === cat
                  ? "bg-norma-accent/20 text-norma-accent border border-norma-accent/30"
                  : "bg-white/[0.03] text-norma-textMuted border border-white/[0.06] hover:border-white/[0.1]"
              }`}
            >
              {cat === "all" ? `全部 (${CAPABILITIES.length})` : cat}
            </button>
          ))}
          <span className="ml-auto text-[10px] text-norma-textDim">
            {readyCount}/{CAPABILITIES.length} 就绪
          </span>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {filtered.map((cap) => (
            <div
              key={cap.id}
              className="rounded-xl bg-white/[0.03] border border-white/[0.06] px-4 py-3 hover:border-white/[0.1] transition-colors group"
            >
              <div className="flex items-center gap-2 mb-1.5">
                <div
                  className={`w-7 h-7 rounded-lg flex items-center justify-center ${cap.status === "ready" ? "bg-norma-accentMuted text-norma-accent" : "bg-white/[0.04] text-norma-textDim"}`}
                >
                  {cap.icon}
                </div>
                <span className="text-[12px] font-medium text-norma-text">
                  {cap.name}
                </span>
                {cap.status === "coming" && (
                  <span className="ml-auto text-[8px] px-1.5 py-0.5 rounded-full bg-white/[0.06] text-norma-textDim">
                    即将推出
                  </span>
                )}
                {cap.status === "ready" && (
                  <span className="ml-auto inline-flex h-4 w-7 items-center rounded-full bg-emerald-500">
                    <span className="inline-block h-3 w-3 rounded-full bg-white translate-x-[14px]" />
                  </span>
                )}
              </div>
              <div className="text-[10px] text-norma-textMuted mb-1">
                {cap.desc}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[9px] text-norma-textDim font-mono">
                  {cap.id}
                </span>
                <span className="text-[9px] px-1 py-0.5 rounded bg-white/[0.04] text-norma-textDim">
                  {cap.category}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export { CapabilitiesPage };
