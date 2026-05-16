import React, { useState } from "react";
import { useStoredState } from "../../lib/shared";

interface KnowledgeDoc {
  id: string;
  name: string;
  size: string;
  date: string;
  chunks: number;
}

const KnowledgePage: React.FC = () => {
  const [docs, setDocs] = useStoredState<KnowledgeDoc[]>("norma-docs", [
    {
      id: "1",
      name: "项目架构文档.pdf",
      size: "2.3 MB",
      date: "2天前",
      chunks: 45,
    },
    {
      id: "2",
      name: "API 接口规范.md",
      size: "128 KB",
      date: "5天前",
      chunks: 12,
    },
    {
      id: "3",
      name: "产品需求 PRD.docx",
      size: "890 KB",
      date: "1周前",
      chunks: 23,
    },
    {
      id: "4",
      name: "设计系统指南.pdf",
      size: "4.1 MB",
      date: "2周前",
      chunks: 67,
    },
  ]);
  const [search, setSearch] = useState("");
  const [showUpload, setShowUpload] = useState(false);
  const [uploadName, setUploadName] = useState("");
  const filtered = docs.filter((d) =>
    d.name.toLowerCase().includes(search.toLowerCase()),
  );

  const addDoc = () => {
    if (!uploadName.trim()) return;
    const doc: KnowledgeDoc = {
      id: Date.now().toString(),
      name: uploadName.trim(),
      size: `${Math.floor(Math.random() * 5000 + 100)} KB`,
      date: "刚刚",
      chunks: Math.floor(Math.random() * 50 + 1),
    };
    setDocs((prev) => [...prev, doc]);
    setUploadName("");
    setShowUpload(false);
  };

  const deleteDoc = (id: string) => {
    setDocs((prev) => prev.filter((d) => d.id !== id));
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      <div className="flex-1 overflow-y-auto px-5 py-4">
        <div className="flex items-center gap-2 mb-4">
          <div className="flex-1 relative">
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="absolute left-3 top-1/2 -translate-y-1/2 text-norma-textDim"
            >
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.3-4.3" />
            </svg>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="搜索文档..."
              className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.06] text-[11px] text-norma-text placeholder-norma-textMuted outline-none focus:border-norma-accent/40 transition-colors"
            />
          </div>
        </div>

        {showUpload && (
          <div className="mb-4 p-4 rounded-xl bg-white/[0.04] border border-white/[0.08] space-y-2">
            <div className="text-[11px] text-norma-textMuted mb-1">
              添加文档
            </div>
            <input
              value={uploadName}
              onChange={(e) => setUploadName(e.target.value)}
              placeholder="文档名称 (如: 技术方案.md)"
              className="w-full bg-white/[0.04] border border-white/[0.06] rounded-lg px-3 py-1.5 text-[11px] text-norma-text placeholder-norma-textDim outline-none focus:border-norma-accent/40"
            />
            <div className="flex items-center gap-2 pt-1">
              <button
                onClick={addDoc}
                className="px-3 py-1 rounded-lg bg-norma-accent text-white text-[11px] hover:opacity-90"
              >
                添加
              </button>
              <button
                onClick={() => setShowUpload(false)}
                className="px-3 py-1 rounded-lg bg-white/[0.06] text-norma-textMuted text-[11px] hover:bg-white/[0.1]"
              >
                取消
              </button>
            </div>
          </div>
        )}

        <div className="flex items-center gap-4 mb-3 text-[10px] text-norma-textDim">
          <span>{filtered.length} 个文档</span>
          <span>{filtered.reduce((s, d) => s + d.chunks, 0)} 个分块</span>
        </div>
        <div className="flex flex-col gap-2">
          {filtered.map((doc) => (
            <div
              key={doc.id}
              className="rounded-xl bg-white/[0.03] border border-white/[0.06] px-4 py-3 hover:border-white/[0.1] transition-colors flex items-center gap-3 group"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className="text-norma-accent flex-none"
              >
                <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
                <path d="M14 2v4a2 2 0 0 0 2 2h4" />
              </svg>
              <div className="flex-1 min-w-0">
                <div className="text-[11px] font-medium text-norma-text truncate">
                  {doc.name}
                </div>
                <div className="text-[9px] text-norma-textDim mt-0.5">
                  {doc.size} · {doc.chunks} 分块 · {doc.date}
                </div>
              </div>
              <button
                onClick={() => deleteDoc(doc.id)}
                className="p-0.5 rounded opacity-0 group-hover:opacity-100 hover:bg-white/[0.08] text-norma-textDim hover:text-red-400 transition-all flex-none"
                title="删除"
              >
                <svg
                  width="10"
                  height="10"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M3 6h18" />
                  <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                  <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                </svg>
              </button>
            </div>
          ))}
          {filtered.length === 0 && (
            <div className="text-[11px] text-norma-textDim text-center py-8">
              未找到匹配的文档
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export { KnowledgePage };
