import React, { useState, useEffect } from "react";
import { setToolMeta } from "../../lib/tool-registry";

interface Capability {
  id: string;
  name: string;
  desc: string;
  icon: React.ReactNode;
  status: "ready" | "coming";
  category: string;
}

const ICON_MAP: Record<string, string> = {
  read_screen: "screen",
  execute_action: "action",
  list_windows: "window",
  window_control: "window",
  open_file: "file",
  list_directory: "folder",
  system_tray: "tray",
  system_info: "info",
};

const ICONS: Record<string, React.ReactNode> = {
  screen: (
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
  action: (
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
  window: (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <rect x="2" y="3" width="20" height="14" rx="2" />
      <line x1="8" y1="21" x2="16" y2="21" />
    </svg>
  ),
  file: (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
      <path d="M14 2v4a2 2 0 0 0 2 2h4" />
    </svg>
  ),
  folder: (
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
  tray: (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  ),
  info: (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="16" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12.01" y2="8" />
    </svg>
  ),
  default: (
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
};

const CapabilitiesPage: React.FC = () => {
  const [capabilities, setCapabilities] = useState<Capability[]>([]);
  const [filter, setFilter] = useState<string>("all");

  useEffect(() => {
    window.electronAPI
      ?.getCapabilities?.()
      .then(
        (
          tools: Array<{
            id: string;
            name: string;
            description: string;
            category: string;
          }>,
        ) => {
          if (!tools || tools.length === 0) return;
          const metaRecord: Record<string, any> = {};
          const caps: Capability[] = tools.map((t) => {
            const iconKey = ICON_MAP[t.id] || "default";
            metaRecord[t.id] = {
              name: t.name,
              description: t.description,
              category: t.category,
            };
            return {
              id: t.id,
              name: t.name,
              desc: t.description,
              icon: ICONS[iconKey] || ICONS.default,
              status: "ready" as const,
              category: t.category,
            };
          });
          setToolMeta(metaRecord);
          setCapabilities(caps);
        },
      )
      .catch(() => {});
  }, []);

  const categories = ["all", ...new Set(capabilities.map((c) => c.category))];
  const filtered =
    filter === "all"
      ? capabilities
      : capabilities.filter((c) => c.category === filter);
  const readyCount = capabilities.filter((c) => c.status === "ready").length;

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
              {cat === "all" ? `全部 (${capabilities.length})` : cat}
            </button>
          ))}
          <span className="ml-auto text-[10px] text-norma-textDim">
            {readyCount}/{capabilities.length} 就绪
          </span>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {filtered.map((cap) => (
            <div
              key={cap.id}
              className="rounded-xl bg-white/[0.03] border border-white/[0.06] px-4 py-3 hover:border-white/[0.1] transition-colors group"
            >
              <div className="flex items-center gap-2 mb-1.5">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-norma-accentMuted text-norma-accent">
                  {cap.icon}
                </div>
                <span className="text-[12px] font-medium text-norma-text">
                  {cap.name}
                </span>
                {cap.status === "ready" && (
                  <span className="ml-auto inline-flex h-4 w-7 items-center rounded-full bg-emerald-500">
                    <span className="inline-block h-3 w-3 rounded-full bg-white translate-x-[14px]" />
                  </span>
                )}
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
