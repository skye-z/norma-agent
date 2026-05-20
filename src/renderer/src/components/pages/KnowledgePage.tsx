import React, { useState, useEffect, useCallback } from "react";
import { SimpleMarkdown } from "../../lib/markdown";

interface KnowledgeDoc {
  docId: string;
  name: string;
  chunkCount: number;
  date: string;
}

interface ThreadInfo {
  id: string;
  title: string;
  resourceId: string;
  createdAt: string;
  updatedAt: string;
}

const formatDate = (iso: string) => {
  if (!iso) return "";
  const d = new Date(iso);
  const now = Date.now();
  const diff = now - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "刚刚";
  if (mins < 60) return `${mins}分钟前`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}小时前`;
  return `${Math.floor(hours / 24)}天前`;
};

type FileCategory =
  | "pdf"
  | "doc"
  | "spreadsheet"
  | "image"
  | "code"
  | "text"
  | "unknown";

function getFileCategory(name: string): FileCategory {
  const ext = name.split(".").pop()?.toLowerCase() || "";
  if (ext === "pdf") return "pdf";
  if (["docx", "doc"].includes(ext)) return "doc";
  if (["xlsx", "xls", "csv"].includes(ext)) return "spreadsheet";
  if (["png", "jpg", "jpeg", "bmp", "webp", "tiff"].includes(ext))
    return "image";
  if (
    [
      "js",
      "ts",
      "py",
      "java",
      "c",
      "cpp",
      "go",
      "rs",
      "sh",
      "bat",
      "sql",
    ].includes(ext)
  )
    return "code";
  if (
    [
      "txt",
      "md",
      "json",
      "yaml",
      "yml",
      "xml",
      "html",
      "log",
      "env",
      "ini",
      "toml",
      "conf",
    ].includes(ext)
  )
    return "text";
  return "unknown";
}

const FILE_ICONS: Record<FileCategory, { color: string; paths: string[] }> = {
  pdf: {
    color: "#ef4444",
    paths: [
      "M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z",
      "M14 2v4a2 2 0 0 0 2 2h4",
      "M10 12h4",
      "M10 16h4",
    ],
  },
  doc: {
    color: "#3b82f6",
    paths: [
      "M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z",
      "M14 2v4a2 2 0 0 0 2 2h4",
      "M10 12h4",
      "M10 16h2",
    ],
  },
  spreadsheet: {
    color: "#22c55e",
    paths: [
      "M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z",
      "M14 2v4a2 2 0 0 0 2 2h4",
      "M8 13h2v2H8z",
      "M12 13h2v2h-2z",
      "M8 17h2v2H8z",
      "M12 17h2v2h-2z",
    ],
  },
  image: {
    color: "#a855f7",
    paths: [
      "M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z",
      "M14 2v4a2 2 0 0 0 2 2h4",
      "M8 18l3-3 2 2 3-4 4 5H8z",
      "M10 12a1 1 0 1 0 0-2 1 1 0 0 0 0 2z",
    ],
  },
  code: {
    color: "#f59e0b",
    paths: [
      "M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z",
      "M14 2v4a2 2 0 0 0 2 2h4",
      "M10 14l-2 2 2 2",
      "M14 14l2 2-2 2",
    ],
  },
  text: {
    color: "#64748b",
    paths: [
      "M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z",
      "M14 2v4a2 2 0 0 0 2 2h4",
      "M10 12h4",
      "M10 16h4",
    ],
  },
  unknown: {
    color: "#64748b",
    paths: [
      "M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z",
      "M14 2v4a2 2 0 0 0 2 2h4",
    ],
  },
};

function FileIcon({ category }: { category: FileCategory }) {
  const icon = FILE_ICONS[category];
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke={icon.color}
      strokeWidth="2"
      className="flex-none"
    >
      {icon.paths.map((d, i) => (
        <path key={i} d={d} />
      ))}
    </svg>
  );
}

const MemoryTab: React.FC = () => {
  const [workingMemory, setWorkingMemory] = useState<string | null>(null);
  const [threads, setThreads] = useState<ThreadInfo[]>([]);
  const [totalMessages, setTotalMessages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [clearConfirm, setClearConfirm] = useState(false);
  const [expandedThread, setExpandedThread] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [wm, threadList] = await Promise.all([
        window.electronAPI?.getWorkingMemory?.() ?? null,
        window.electronAPI?.listThreads?.() ?? [],
      ]);
      setWorkingMemory(wm);
      let msgCount = 0;
      const enriched = await Promise.all(
        threadList.map(async (t: ThreadInfo) => {
          try {
            const msgs = await window.electronAPI?.getThreadMessages?.(t.id);
            msgCount += msgs?.length ?? 0;
            if (
              (!t.title || t.title === "新会话") &&
              Array.isArray(msgs) &&
              msgs.length > 0
            ) {
              const firstUser = msgs.find((m: any) => m.role === "user");
              const preview =
                firstUser?.content?.text || firstUser?.content || "";
              if (typeof preview === "string" && preview.trim()) {
                return {
                  ...t,
                  title:
                    preview.trim().slice(0, 30) +
                    (preview.trim().length > 30 ? "..." : ""),
                };
              }
            }
            return t;
          } catch {
            return t;
          }
        }),
      );
      setThreads(enriched);
      setTotalMessages(msgCount);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleClearMemory = async () => {
    if (!clearConfirm) {
      setClearConfirm(true);
      setTimeout(() => setClearConfirm(false), 3000);
      return;
    }
    await window.electronAPI?.clearWorkingMemory?.();
    setClearConfirm(false);
    await fetchData();
  };

  const handleDeleteThread = async (threadId: string) => {
    await window.electronAPI?.deleteThread?.(threadId);
    await fetchData();
  };

  const isMemoryEmpty =
    !workingMemory ||
    workingMemory.trim().length === 0 ||
    ((workingMemory.trim().startsWith("# 用户档案") ||
      workingMemory.trim().startsWith("# User Profile")) &&
      !workingMemory.includes("- **"));

  return (
    <div className="flex-1 overflow-y-auto scrollbar-show px-5 py-4">
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-4 h-4 border-2 border-norma-accent/30 border-t-norma-accent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center gap-3 mb-3">
            <span className="text-[12px] text-norma-textDim">
              {threads.length} 个会话 · {totalMessages} 条消息
            </span>
            <button
              onClick={handleClearMemory}
              className={`ml-auto px-2.5 py-1 rounded-lg text-[12px] transition-colors ${
                clearConfirm
                  ? "bg-red-500/20 text-red-400 border border-red-500/30"
                  : "bg-white/[0.06] text-norma-textMuted hover:bg-white/[0.1]"
              }`}
            >
              {clearConfirm ? "确认清除？" : "清除记忆"}
            </button>
          </div>

          <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-4">
            <div className="flex items-center gap-2 mb-3">
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className="text-norma-accent"
              >
                <path d="M12 2a7 7 0 0 1 7 7c0 2.38-1.19 4.47-3 5.74V17a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1v-2.26C6.19 13.47 5 11.38 5 9a7 7 0 0 1 7-7z" />
                <path d="M9 22h6" />
                <path d="M9 18h6" />
              </svg>
              <span className="text-[13px] font-semibold text-norma-text">
                工作记忆
              </span>
            </div>
            {isMemoryEmpty ? (
              <div className="text-[13px] text-norma-textDim text-center py-6 leading-relaxed">
                Norma 还没有积累任何记忆，随着对话的进行，Norma
                会自动记住你的偏好和习惯。
              </div>
            ) : (
              <div className="text-[13px] text-norma-text/90 leading-relaxed prose-norma max-w-none [&_p]:mb-2 [&_h1]:text-[14px] [&_h2]:text-[13px] [&_h3]:text-[13px] [&_ul]:list-disc [&_ol]:list-decimal [&_li]:text-[13px] [&_strong]:text-norma-text [&_code]:bg-white/[0.06] [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-[12px] [&_code]:font-mono [&_code]:text-norma-accent">
                <SimpleMarkdown>{workingMemory || ""}</SimpleMarkdown>
              </div>
            )}
          </div>

          <div>
            <div className="flex items-center gap-2 mb-2">
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className="text-norma-textMuted"
              >
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
              <span className="text-[13px] font-medium text-norma-text">
                会话记录
              </span>
            </div>
            <div className="flex flex-col gap-1.5">
              {threads.map((thread) => (
                <div
                  key={thread.id}
                  className="rounded-xl bg-white/[0.03] border border-white/[0.06] px-4 py-2.5 hover:border-white/[0.1] transition-colors flex items-center gap-3 group"
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    className="text-norma-textDim flex-none"
                  >
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                  </svg>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] text-norma-text truncate">
                      {thread.title || "未命名会话"}
                    </div>
                    <div className="text-[11px] text-norma-textDim mt-0.5">
                      {formatDate(thread.updatedAt || thread.createdAt)}
                    </div>
                  </div>
                  <button
                    onClick={() => handleDeleteThread(thread.id)}
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
              {threads.length === 0 && (
                <div className="text-[13px] text-norma-textDim text-center py-4">
                  暂无会话记录
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

interface ImportTask {
  id: string;
  name: string;
  status: "pending" | "processing" | "done" | "error";
  progress: number;
  chunks?: number;
  error?: string;
  docId?: string;
  filePath?: string;
}

const _embedderBaseUrl = (s: { configured: boolean; baseUrl?: string }) =>
  s.baseUrl
    ? s.baseUrl.replace(/^https?:\/\//, "").replace(/\/v\d+$/, "")
    : "unknown";

const KnowledgeTab: React.FC = () => {
  const [docs, setDocs] = useState<KnowledgeDoc[]>([]);
  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState<Array<{ id: string; score: number; metadata: Record<string, any> }> | null>(null);
  const [expandedResult, setExpandedResult] = useState<number | null>(null);
  const [showUpload, setShowUpload] = useState(false);
  const [uploadName, setUploadName] = useState("");
  const [uploadText, setUploadText] = useState("");
  const [loading, setLoading] = useState(false);
  const [queryText, setQueryText] = useState("");
  const [importTasks, setImportTasks] = useState<ImportTask[]>([]);
  const [embedderStatus, setEmbedderStatus] = useState<{ configured: boolean; mode: 'remote' | 'local'; baseUrl?: string; localReady?: boolean } | null>(null);
  const [previewDocId, setPreviewDocId] = useState<string | null>(null);
  const [previewChunks, setPreviewChunks] = useState<Array<{ text: string; chunkIndex: number }> | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const fetchDocs = useCallback(async () => {
    try {
      const [listRes, statusRes] = await Promise.all([
        window.electronAPI?.knowledgeList?.(),
        window.electronAPI?.knowledgeStatus?.(),
      ]);
      if (listRes?.success) {
        setDocs(listRes.documents || []);
      }
      setEmbedderStatus(statusRes || null);
    } catch {}
  }, []);

  useEffect(() => { fetchDocs(); }, [fetchDocs]);

  useEffect(() => {
    if (!window.electronAPI?.onKnowledgeIngestProgress) return;
    return window.electronAPI.onKnowledgeIngestProgress((taskId, progress) => {
      setImportTasks((prev) => prev.map((t) =>
        t.id === taskId ? { ...t, progress } : t
      ));
    });
  }, []);

  const handlePreview = async (docId: string) => {
    if (previewDocId === docId) {
      setPreviewDocId(null);
      setPreviewChunks(null);
      return;
    }
    setPreviewDocId(docId);
    setPreviewLoading(true);
    setPreviewChunks(null);
    try {
      const res = await window.electronAPI?.knowledgeQuery?.('', 50);
      if (res?.success) {
        const chunks = (res.results || [])
          .filter((r: any) => r.metadata?.docId === docId)
          .sort((a: any, b: any) => (a.metadata?.chunkIndex ?? 0) - (b.metadata?.chunkIndex ?? 0))
          .map((r: any) => ({ text: r.metadata?.text || '', chunkIndex: r.metadata?.chunkIndex ?? 0 }));
        setPreviewChunks(chunks);
      }
    } catch {}
    setPreviewLoading(false);
  };

  const handleDelete = async (docId: string) => {
    if (deleteConfirm !== docId) {
      setDeleteConfirm(docId);
      setTimeout(() => setDeleteConfirm(null), 3000);
      return;
    }
    try {
      await window.electronAPI?.knowledgeDelete?.(docId);
      setDeleteConfirm(null);
      if (previewDocId === docId) {
        setPreviewDocId(null);
        setPreviewChunks(null);
      }
      await fetchDocs();
    } catch {}
  };

  const handleIngestFile = async () => {
    try {
      const res = await window.electronAPI?.knowledgeIngestFile?.();
      if (!res?.success || !res.files?.length) return;

      const tasks: ImportTask[] = res.files.map((f: any, i: number) => ({
        id: `task_${Date.now()}_${i}`,
        name: f.name,
        status: f.tooLarge ? 'error' : 'pending',
        progress: 0,
        error: f.tooLarge ? `文件超过 5MB 限制 (${(f.size / 1024 / 1024).toFixed(1)}MB)` : undefined,
        filePath: f.tooLarge ? undefined : f.path,
      }));
      setImportTasks((prev) => [...prev, ...tasks]);

      for (const task of tasks) {
        if (task.error) continue;
        setImportTasks((prev) => prev.map((t) => t.id === task.id ? { ...t, status: 'processing', progress: 30 } : t));
        try {
          const ingestRes = await window.electronAPI?.knowledgeIngestFilePath?.(task.filePath!, task.name, task.id);
          if (ingestRes?.success) {
            await fetchDocs();
          }
          setImportTasks((prev) =>
            ingestRes?.success
              ? prev.filter((t) => t.id !== task.id)
              : prev.map((t) => t.id === task.id ? { ...t, status: 'error', progress: 100, error: ingestRes?.error } : t)
          );
        } catch (err: any) {
          setImportTasks((prev) => prev.map((t) =>
            t.id === task.id ? { ...t, status: 'error', error: err?.message || String(err) } : t
          ));
        }
      }
    } catch (err: any) {
      alert(`选择文件失败: ${err?.message || err}`);
    }
  };

  const handleIngestText = async () => {
    if (!uploadName.trim() || !uploadText.trim()) return;
    const task: ImportTask = {
      id: `task_${Date.now()}`,
      name: uploadName.trim(),
      status: "processing",
      progress: 50,
    };
    setImportTasks((prev) => [...prev, task]);
    setShowUpload(false);
    try {
      const res = await window.electronAPI?.knowledgeIngest?.(
        uploadName.trim(),
        uploadText.trim(),
        task.id,
      );
      if (res?.success) {
        setUploadName("");
        setUploadText("");
        await fetchDocs();
        setImportTasks((prev) => prev.filter((t) => t.id !== task.id));
      } else {
        setImportTasks((prev) =>
          prev.map((t) =>
            t.id === task.id
              ? { ...t, status: "error", progress: 100, error: res?.error }
              : t,
          ),
        );
      }
    } catch (err: any) {
      setImportTasks((prev) =>
        prev.map((t) =>
          t.id === task.id
            ? { ...t, status: "error", error: err?.message || String(err) }
            : t,
        ),
      );
    }
  };

  const handleQuery = async () => {
    if (!queryText.trim()) return;
    setLoading(true);
    setSearchResults(null);
    try {
      const res = await window.electronAPI?.knowledgeQuery?.(
        queryText.trim(),
        5,
      );
      if (res?.success) {
        setSearchResults(res.results || []);
        setExpandedResult(null);
      }
    } catch {}
    setLoading(false);
  };

  return (
    <div className="flex-1 overflow-y-auto scrollbar-show px-5 py-4 relative">
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
            value={queryText || search}
            onChange={(e) => {
              const v = e.target.value;
              setQueryText(v);
              setSearch(v);
              setSearchResults(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && queryText.trim()) handleQuery();
            }}
            placeholder="搜索知识库..."
            className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.06] text-[13px] text-norma-text placeholder-norma-textMuted outline-none focus:border-norma-accent/40 transition-colors"
          />
        </div>
      </div>

      <div className="flex items-center gap-2 mb-3">
        <button
          onClick={() => setShowUpload(true)}
          className="px-3 py-1 rounded-lg bg-norma-accent text-white text-[13px] hover:opacity-90"
        >
          + 添加文本
        </button>
        <button
          onClick={handleIngestFile}
          className="px-3 py-1 rounded-lg bg-white/[0.06] text-norma-textMuted text-[13px] hover:bg-white/[0.1]"
        >
          导入文件
        </button>
        <span className="ml-auto text-[12px] text-norma-textDim">
          {docs.length} 个文档 · {docs.reduce((s, d) => s + d.chunkCount, 0)}{" "}
          个分块
        </span>
      </div>

      {embedderStatus && !embedderStatus.configured && (
        <div className="mb-3 px-4 py-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-[13px] text-amber-400/90 leading-relaxed">
          {embedderStatus.mode === "local"
            ? "离线 Embedding 模型尚未下载，请在 设置 > 知识库 中下载模型。"
            : "远程 Embedding 未配置，请在设置中配置支持 Embedding 的提供商，或切换为离线模式。"}
        </div>
      )}

      {showUpload && (
        <div
          className="absolute inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
          onClick={() => {
            setShowUpload(false);
            setUploadName("");
            setUploadText("");
          }}
        >
          <div
            className="w-[480px] max-h-[70vh] rounded-2xl bg-[#1c1c20] border border-white/[0.08] shadow-2xl flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 px-4 py-3 border-b border-white/[0.06]">
              <span className="text-[15px] font-medium text-norma-text flex-1">
                添加文档到知识库
              </span>
              <button
                onClick={() => {
                  setShowUpload(false);
                  setUploadName("");
                  setUploadText("");
                }}
                className="p-1 rounded hover:bg-white/[0.06] text-norma-textMuted hover:text-norma-text transition-colors"
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto scrollbar-show p-4 space-y-3">
              <div>
                <div className="text-[12px] text-norma-textDim mb-1">
                  文档名称
                </div>
                <input
                  value={uploadName}
                  onChange={(e) => setUploadName(e.target.value)}
                  placeholder="输入文档名称"
                  className="w-full bg-white/[0.04] border border-white/[0.06] rounded-lg px-3 py-1.5 text-[13px] text-norma-text placeholder-norma-textDim outline-none focus:border-norma-accent/40"
                />
              </div>
              <div>
                <div className="text-[12px] text-norma-textDim mb-1">
                  文档内容
                </div>
                <textarea
                  value={uploadText}
                  onChange={(e) => setUploadText(e.target.value)}
                  placeholder="粘贴文档内容..."
                  rows={8}
                  className="w-full bg-white/[0.04] border border-white/[0.06] rounded-lg px-3 py-1.5 text-[13px] text-norma-text placeholder-norma-textDim outline-none focus:border-norma-accent/40 resize-none"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 px-4 py-3 border-t border-white/[0.06]">
              <button
                onClick={() => {
                  setShowUpload(false);
                  setUploadName("");
                  setUploadText("");
                }}
                className="px-3 py-1.5 rounded-lg bg-white/[0.06] text-norma-textMuted text-[13px] hover:bg-white/[0.1] transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleIngestText}
                disabled={loading || !uploadName.trim() || !uploadText.trim()}
                className="px-4 py-1.5 rounded-lg bg-norma-accent text-white text-[13px] hover:opacity-90 disabled:opacity-50 transition-opacity"
              >
                {loading ? "添加中..." : "添加"}
              </button>
            </div>
          </div>
        </div>
      )}

      {searchResults && (
        <div className="mb-4">
          <div className="text-[13px] text-norma-textMuted mb-2">
            搜索结果 ({searchResults.length})
          </div>
          <div className="flex flex-col gap-2">
            {searchResults.map((r, i) => (
              <div
                key={r.id}
                className="rounded-xl bg-white/[0.03] border border-norma-accent/20 px-4 py-3"
              >
                <div
                  className={`text-[13px] text-norma-text leading-relaxed whitespace-pre-wrap ${expandedResult === i ? "" : "line-clamp-4"}`}
                >
                  {r.metadata?.text || JSON.stringify(r.metadata)}
                </div>
                {r.metadata?.text && r.metadata.text.length > 200 && (
                  <button
                    onClick={() =>
                      setExpandedResult(expandedResult === i ? null : i)
                    }
                    className="text-[11px] text-norma-accent hover:underline mt-0.5"
                  >
                    {expandedResult === i ? "收起" : "展开全文"}
                  </button>
                )}
                <div className="text-[11px] text-norma-textDim mt-1">
                  相关度: {(r.score * 100).toFixed(1)}% · 来源:{" "}
                  {r.metadata?.name || r.metadata?.docId}
                </div>
              </div>
            ))}
            {searchResults.length === 0 && (
              <div className="text-[13px] text-norma-textDim text-center py-4">
                未找到相关内容
              </div>
            )}
          </div>
        </div>
      )}

      <div className="flex flex-col gap-2">
        {importTasks.map((task) => (
          <div
            key={task.id}
            className={`rounded-xl border px-4 py-3 flex items-center gap-3 ${
              task.status === "error"
                ? "bg-red-500/[0.06] border-red-500/20"
                : task.status === "done"
                  ? "bg-green-500/[0.06] border-green-500/20"
                  : "bg-white/[0.03] border-norma-accent/20"
            }`}
          >
            {task.status === "processing" ? (
              <div className="w-4 h-4 border-2 border-norma-accent/30 border-t-norma-accent rounded-full animate-spin flex-none" />
            ) : task.status === "done" ? (
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className="text-green-400 flex-none"
              >
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <path d="m9 11 3 3L22 4" />
              </svg>
            ) : task.status === "error" ? (
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className="text-red-400 flex-none"
              >
                <circle cx="12" cy="12" r="10" />
                <line x1="15" y1="9" x2="9" y2="15" />
                <line x1="9" y1="9" x2="15" y2="15" />
              </svg>
            ) : (
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className="text-norma-textDim flex-none"
              >
                <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
                <path d="M14 2v4a2 2 0 0 0 2 2h4" />
              </svg>
            )}
            <div className="flex-1 min-w-0">
              <div className="text-[13px] font-medium text-norma-text truncate">
                {task.name}
              </div>
              <div className="text-[11px] text-norma-textDim mt-0.5">
                {task.status === "processing" && "正在生成嵌入向量..."}
                {task.status === "done" &&
                  `${task.chunks || 0} 分块 · 导入完成`}
                {task.status === "error" && (task.error || "导入失败")}
                {task.status === "pending" && "等待中..."}
              </div>
              {task.status === "processing" && (
                <div className="w-full bg-white/[0.06] rounded-full h-1 mt-1.5 overflow-hidden">
                  <div
                    className="bg-norma-accent h-full rounded-full transition-all duration-300"
                    style={{ width: `${task.progress}%` }}
                  />
                </div>
              )}
            </div>
            {(task.status === "done" || task.status === "error") && (
              <button
                onClick={() =>
                  setImportTasks((prev) => prev.filter((t) => t.id !== task.id))
                }
                className="p-0.5 rounded hover:bg-white/[0.08] text-norma-textDim hover:text-norma-text transition-all flex-none"
              >
                <svg
                  width="10"
                  height="10"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            )}
          </div>
        ))}

        {docs.map((doc) => {
          const cat = getFileCategory(doc.name);
          return (
            <div key={doc.docId}>
              <div
                className={`rounded-xl bg-white/[0.03] border border-white/[0.06] px-4 py-3 hover:border-white/[0.1] transition-colors flex items-center gap-3 group ${previewDocId === doc.docId ? 'border-norma-accent/20' : ''}`}
              >
                <FileIcon category={cat} />
                <div className="flex-1 min-w-0 cursor-pointer" onClick={() => handlePreview(doc.docId)}>
                  <div className="text-[13px] font-medium text-norma-text truncate">
                    {doc.name}
                  </div>
                  <div className="text-[11px] text-norma-textDim mt-0.5">
                    {doc.chunkCount} 分块 · {formatDate(doc.date)}
                  </div>
                </div>
                <button
                  onClick={() => handleDelete(doc.docId)}
                  className={`p-1 rounded text-[11px] transition-all flex-none ${
                    deleteConfirm === doc.docId
                      ? 'bg-red-500/20 text-red-400 border border-red-500/30 opacity-100 px-2'
                      : 'opacity-0 group-hover:opacity-100 hover:bg-white/[0.08] text-norma-textDim hover:text-red-400'
                  }`}
                  title="删除"
                >
                  {deleteConfirm === doc.docId ? '确认删除' : (
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M3 6h18" />
                      <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                      <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                    </svg>
                  )}
                </button>
              </div>
              {previewDocId === doc.docId && (
                <div className="mt-1 mb-2 rounded-xl bg-white/[0.02] border border-white/[0.04] px-4 py-3 max-h-[300px] overflow-y-auto scrollbar-show">
                  {previewLoading ? (
                    <div className="flex items-center justify-center py-4">
                      <div className="w-3 h-3 border-2 border-norma-accent/30 border-t-norma-accent rounded-full animate-spin" />
                    </div>
                  ) : previewChunks && previewChunks.length > 0 ? (
                    <div className="space-y-2">
                      {previewChunks.slice(0, 20).map((chunk, i) => (
                        <div key={i} className="text-[12px] text-norma-textMuted leading-relaxed whitespace-pre-wrap break-all">
                          <span className="text-norma-textDim text-[11px] mr-1.5">#{chunk.chunkIndex}</span>
                          {chunk.text.slice(0, 200)}{chunk.text.length > 200 ? '...' : ''}
                        </div>
                      ))}
                      {previewChunks.length > 20 && (
                        <div className="text-[11px] text-norma-textDim text-center pt-1">
                          仅显示前 20 个分块（共 {previewChunks.length} 个）
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-[12px] text-norma-textDim text-center py-4">无法加载预览</div>
                  )}
                </div>
              )}
            </div>
          );
        })}
        {docs.length === 0 && !searchResults && importTasks.length === 0 && (
          <div className="text-[13px] text-norma-textDim text-center py-8">
            暂无文档，点击"添加文本"或"导入文件"
          </div>
        )}
      </div>
    </div>
  );
};

const KnowledgePage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<"memory" | "knowledge">("memory");

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      <div className="flex-none flex items-center gap-1 px-5 pt-3 pb-2 border-b border-white/[0.06]">
        <button
          onClick={() => setActiveTab("memory")}
          className={`px-3 py-1.5 rounded-lg text-[13px] transition-colors ${
            activeTab === "memory"
              ? "bg-norma-accent/20 text-norma-accent border border-norma-accent/30"
              : "bg-white/[0.03] text-norma-textMuted hover:text-norma-text hover:bg-white/[0.06]"
          }`}
        >
          记忆
        </button>
        <button
          onClick={() => setActiveTab("knowledge")}
          className={`px-3 py-1.5 rounded-lg text-[13px] transition-colors ${
            activeTab === "knowledge"
              ? "bg-norma-accent/20 text-norma-accent border border-norma-accent/30"
              : "bg-white/[0.03] text-norma-textMuted hover:text-norma-text hover:bg-white/[0.06]"
          }`}
        >
          知识
        </button>
      </div>
      {activeTab === "memory" && <MemoryTab />}
      {activeTab === "knowledge" && <KnowledgeTab />}
    </div>
  );
};

export { KnowledgePage };
