import React, { useState, useEffect, useCallback } from "react";

interface KnowledgeDoc {
  docId: string;
  name: string;
  chunkCount: number;
  date: string;
}

const KnowledgePage: React.FC = () => {
  const [docs, setDocs] = useState<KnowledgeDoc[]>([]);
  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState<Array<{ id: string; score: number; metadata: Record<string, any> }> | null>(null);
  const [showUpload, setShowUpload] = useState(false);
  const [uploadName, setUploadName] = useState("");
  const [uploadText, setUploadText] = useState("");
  const [loading, setLoading] = useState(false);
  const [queryText, setQueryText] = useState("");

  const fetchDocs = useCallback(async () => {
    try {
      const res = await window.electronAPI?.knowledgeList?.();
      if (res?.success) {
        setDocs(res.documents || []);
      }
    } catch {}
  }, []);

  useEffect(() => { fetchDocs(); }, [fetchDocs]);

  const handleIngest = async () => {
    if (!uploadName.trim() || !uploadText.trim()) return;
    setLoading(true);
    try {
      const res = await window.electronAPI?.knowledgeIngest?.(uploadName.trim(), uploadText.trim());
      if (res?.success) {
        setUploadName("");
        setUploadText("");
        setShowUpload(false);
        await fetchDocs();
      }
    } catch {}
    setLoading(false);
  };

  const handleIngestFile = async () => {
    setLoading(true);
    try {
      const res = await window.electronAPI?.knowledgeIngestFile?.();
      if (res?.success) {
        await fetchDocs();
      }
    } catch {}
    setLoading(false);
  };

  const handleDelete = async (docId: string) => {
    try {
      await window.electronAPI?.knowledgeDelete?.(docId);
      await fetchDocs();
    } catch {}
  };

  const handleQuery = async () => {
    if (!queryText.trim()) return;
    setLoading(true);
    setSearchResults(null);
    try {
      const res = await window.electronAPI?.knowledgeQuery?.(queryText.trim(), 5);
      if (res?.success) {
        setSearchResults(res.results || []);
      }
    } catch {}
    setLoading(false);
  };

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

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      <div className="flex-1 overflow-y-auto px-5 py-4">
        <div className="flex items-center gap-2 mb-4">
          <div className="flex-1 relative">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="absolute left-3 top-1/2 -translate-y-1/2 text-norma-textDim">
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
              onKeyDown={(e) => { if (e.key === "Enter" && queryText.trim()) handleQuery(); }}
              placeholder="搜索知识库..."
              className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.06] text-[11px] text-norma-text placeholder-norma-textMuted outline-none focus:border-norma-accent/40 transition-colors"
            />
          </div>
        </div>

        <div className="flex items-center gap-2 mb-3">
          <button
            onClick={() => setShowUpload(true)}
            className="px-3 py-1 rounded-lg bg-norma-accent text-white text-[11px] hover:opacity-90"
          >
            + 添加文本
          </button>
          <button
            onClick={handleIngestFile}
            disabled={loading}
            className="px-3 py-1 rounded-lg bg-white/[0.06] text-norma-textMuted text-[11px] hover:bg-white/[0.1] disabled:opacity-50"
          >
            导入文件
          </button>
          <span className="ml-auto text-[10px] text-norma-textDim">
            {docs.length} 个文档 · {docs.reduce((s, d) => s + d.chunkCount, 0)} 个分块
          </span>
        </div>

        {showUpload && (
          <div className="mb-4 p-4 rounded-xl bg-white/[0.04] border border-white/[0.08] space-y-2">
            <div className="text-[11px] text-norma-textMuted mb-1">添加文档</div>
            <input
              value={uploadName}
              onChange={(e) => setUploadName(e.target.value)}
              placeholder="文档名称"
              className="w-full bg-white/[0.04] border border-white/[0.06] rounded-lg px-3 py-1.5 text-[11px] text-norma-text placeholder-norma-textDim outline-none focus:border-norma-accent/40"
            />
            <textarea
              value={uploadText}
              onChange={(e) => setUploadText(e.target.value)}
              placeholder="粘贴文档内容..."
              rows={4}
              className="w-full bg-white/[0.04] border border-white/[0.06] rounded-lg px-3 py-1.5 text-[11px] text-norma-text placeholder-norma-textDim outline-none focus:border-norma-accent/40 resize-none"
            />
            <div className="flex items-center gap-2 pt-1">
              <button
                onClick={handleIngest}
                disabled={loading || !uploadName.trim() || !uploadText.trim()}
                className="px-3 py-1 rounded-lg bg-norma-accent text-white text-[11px] hover:opacity-90 disabled:opacity-50"
              >
                添加
              </button>
              <button
                onClick={() => { setShowUpload(false); setUploadName(""); setUploadText(""); }}
                className="px-3 py-1 rounded-lg bg-white/[0.06] text-norma-textMuted text-[11px] hover:bg-white/[0.1]"
              >
                取消
              </button>
            </div>
          </div>
        )}

        {searchResults && (
          <div className="mb-4">
            <div className="text-[11px] text-norma-textMuted mb-2">
              搜索结果 ({searchResults.length})
            </div>
            <div className="flex flex-col gap-2">
              {searchResults.map((r, i) => (
                <div key={r.id} className="rounded-xl bg-white/[0.03] border border-norma-accent/20 px-4 py-3">
                  <div className="text-[11px] text-norma-text leading-relaxed whitespace-pre-wrap line-clamp-4">
                    {r.metadata?.text || JSON.stringify(r.metadata)}
                  </div>
                  <div className="text-[9px] text-norma-textDim mt-1">
                    相关度: {(r.score * 100).toFixed(1)}% · 来源: {r.metadata?.name || r.metadata?.docId}
                  </div>
                </div>
              ))}
              {searchResults.length === 0 && (
                <div className="text-[11px] text-norma-textDim text-center py-4">未找到相关内容</div>
              )}
            </div>
          </div>
        )}

        <div className="flex flex-col gap-2">
          {docs.map((doc) => (
            <div
              key={doc.docId}
              className="rounded-xl bg-white/[0.03] border border-white/[0.06] px-4 py-3 hover:border-white/[0.1] transition-colors flex items-center gap-3 group"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-norma-accent flex-none">
                <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
                <path d="M14 2v4a2 2 0 0 0 2 2h4" />
              </svg>
              <div className="flex-1 min-w-0">
                <div className="text-[11px] font-medium text-norma-text truncate">
                  {doc.name}
                </div>
                <div className="text-[9px] text-norma-textDim mt-0.5">
                  {doc.chunkCount} 分块 · {formatDate(doc.date)}
                </div>
              </div>
              <button
                onClick={() => handleDelete(doc.docId)}
                className="p-0.5 rounded opacity-0 group-hover:opacity-100 hover:bg-white/[0.08] text-norma-textDim hover:text-red-400 transition-all flex-none"
                title="删除"
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M3 6h18" />
                  <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                  <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                </svg>
              </button>
            </div>
          ))}
          {docs.length === 0 && !searchResults && (
            <div className="text-[11px] text-norma-textDim text-center py-8">
              暂无文档，点击"添加文本"或"导入文件"
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export { KnowledgePage };
