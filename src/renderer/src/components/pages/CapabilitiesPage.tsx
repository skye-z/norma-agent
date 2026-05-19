import React, { useState, useEffect, useCallback } from "react";
import { setToolMeta } from "../../lib/tool-registry";

interface Capability {
  id: string;
  name: string;
  desc: string;
  icon: React.ReactNode;
  status: "ready" | "coming";
  category: string;
}

interface TestResult {
  success: boolean;
  output: any;
  duration: number;
  error?: string;
}

interface InputField {
  name: string;
  type: "string" | "boolean" | "number" | "enum";
  required: boolean;
  description: string;
  defaultVal: any;
  enumOptions?: string[];
}

const TOOL_CATEGORY_MAP: Record<string, "TOOLS" | "SKILLS" | "MCP"> = {
  read_screen: "TOOLS",
  execute_action: "TOOLS",
  list_windows: "TOOLS",
  window_control: "TOOLS",
  open_file: "TOOLS",
  list_directory: "TOOLS",
  system_tray: "TOOLS",
  system_info: "TOOLS",
};

const CATEGORY_META: Record<
  string,
  { label: string; desc: string; icon: React.ReactNode }
> = {
  TOOLS: {
    label: "先天能力",
    desc: "Norma 内置的系统级能力，提供屏幕感知、窗口管理等核心功能",
    icon: (
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        className="text-violet-400"
      >
        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
      </svg>
    ),
  },
  SKILLS: {
    label: "后天技能",
    desc: "通过学习和配置获得的技能，如知识库检索、自动化工作流等",
    icon: (
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        className="text-amber-400"
      >
        <path d="M12 2a8 8 0 0 0-8 8c0 6 8 12 8 12s8-6 8-12a8 8 0 0 0-8-8z" />
        <circle cx="12" cy="10" r="3" />
      </svg>
    ),
  },
  MCP: {
    label: "外部工具",
    desc: "通过 MCP 协议接入的第三方工具，如浏览器、搜索等外部服务",
    icon: (
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        className="text-sky-400"
      >
        <circle cx="12" cy="12" r="10" />
        <line x1="2" y1="12" x2="22" y2="12" />
        <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
      </svg>
    ),
  },
};

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
  const [testingId, setTestingId] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [modalTitle, setModalTitle] = useState("");
  const [modalToolId, setModalToolId] = useState("");
  const [inputFields, setInputFields] = useState<InputField[]>([]);
  const [inputValues, setInputValues] = useState<Record<string, any>>({});
  const [disabledTools, setDisabledTools] = useState<Set<string>>(new Set());

  useEffect(() => {
    window.electronAPI
      ?.configGet?.("tools:disabled")
      .then((val: string[] | null) => {
        if (Array.isArray(val)) setDisabledTools(new Set(val));
      })
      .catch(() => {});
  }, []);

  const toggleTool = useCallback(
    async (toolId: string) => {
      const next = new Set(disabledTools);
      if (next.has(toolId)) next.delete(toolId);
      else next.add(toolId);
      setDisabledTools(next);
      try {
        await window.electronAPI?.configSet?.("tools:disabled", [...next]);
      } catch {}
    },
    [disabledTools],
  );

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

  const handleTest = useCallback(async (cap: Capability) => {
    if (
      !window.electronAPI?.testTool ||
      !window.electronAPI?.getToolInputFields
    )
      return;
    setTestingId(null);
    setTestResult(null);
    setModalTitle(cap.name);
    setModalToolId(cap.id);
    setInputValues({});
    setShowModal(true);
    try {
      const fields = await window.electronAPI.getToolInputFields(cap.id);
      setInputFields(fields);
      const defaults: Record<string, any> = {};
      for (const f of fields) defaults[f.name] = f.defaultVal;
      setInputValues(defaults);
    } catch {
      setInputFields([]);
    }
  }, []);

  const runTest = useCallback(async () => {
    if (!window.electronAPI?.testTool || !modalToolId) return;
    setTestingId(modalToolId);
    setTestResult(null);
    try {
      const args: Record<string, any> = {};
      for (const f of inputFields) {
        if (inputValues[f.name] !== undefined && inputValues[f.name] !== "") {
          args[f.name] = inputValues[f.name];
        }
      }
      const result = await window.electronAPI.testTool(modalToolId, args);
      setTestResult(result);
    } catch (e: any) {
      setTestResult({
        success: false,
        output: null,
        duration: 0,
        error: e.message,
      });
    } finally {
      setTestingId(null);
    }
  }, [modalToolId, inputFields, inputValues]);

  const getToolCategory = useCallback((cap: Capability) => {
    return TOOL_CATEGORY_MAP[cap.id] || "MCP";
  }, []);

  const sections =
    filter === "all"
      ? [
          {
            key: "TOOLS",
            items: capabilities.filter((c) => getToolCategory(c) === "TOOLS"),
          },
          {
            key: "SKILLS",
            items: capabilities.filter((c) => getToolCategory(c) === "SKILLS"),
          },
          {
            key: "MCP",
            items: capabilities.filter((c) => getToolCategory(c) === "MCP"),
          },
        ].filter((s) => s.items.length > 0)
      : [
          {
            key: filter,
            items: capabilities.filter((c) => getToolCategory(c) === filter),
          },
        ];

  const categoryTabs = [
    { id: "all", label: `全部 (${capabilities.length})` },
    { id: "TOOLS", label: "先天能力" },
    { id: "SKILLS", label: "后天技能" },
    { id: "MCP", label: "外部工具" },
  ];
  const readyCount = capabilities.filter((c) => c.status === "ready").length;

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      <div className="flex-1 overflow-y-auto scrollbar-show px-5 py-4">
        <div className="flex items-center gap-2 mb-3">
          {categoryTabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilter(tab.id)}
              className={`px-2.5 py-1 rounded-full text-[10px] transition-colors ${
                filter === tab.id
                  ? "bg-norma-accent/20 text-norma-accent border border-norma-accent/30"
                  : "bg-white/[0.03] text-norma-textMuted border border-white/[0.06] hover:border-white/[0.1]"
              }`}
            >
              {tab.label}
            </button>
          ))}
          <span className="ml-auto text-[10px] text-norma-textDim">
            {readyCount}/{capabilities.length} 就绪
          </span>
        </div>
        {sections.map((section) => {
          const meta = CATEGORY_META[section.key];
          return (
            <div key={section.key} className="mb-5">
              <div className="flex items-center gap-2 mb-2.5">
                {meta?.icon}
                <span className="text-[12px] font-semibold text-norma-text">
                  {meta?.label || section.key}
                </span>
                <span className="text-[9px] text-norma-textDim">
                  {meta?.desc}
                </span>
                <span className="ml-auto text-[9px] text-norma-textDim">
                  {section.items.length} 项
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {section.items.map((cap) => (
                  <div
                    key={cap.id}
                    className="rounded-xl bg-white/[0.03] border border-white/[0.06] px-4 py-3 hover:border-white/[0.1] transition-colors flex flex-col"
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-norma-accentMuted text-norma-accent flex-shrink-0">
                        {cap.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className="text-[12px] font-medium text-norma-text">
                          {cap.name}
                        </span>
                        <div className="text-[10px] text-norma-textDim mt-0.5 line-clamp-2">
                          {cap.desc}
                        </div>
                      </div>
                      <button
                        onClick={() => toggleTool(cap.id)}
                        className={`flex-shrink-0 inline-flex h-4 w-7 items-center rounded-full transition-colors cursor-pointer ${disabledTools.has(cap.id) ? "bg-white/10" : "bg-emerald-500"}`}
                      >
                        <span
                          className={`inline-block h-3 w-3 rounded-full bg-white transition-transform ${disabledTools.has(cap.id) ? "translate-x-[3px]" : "translate-x-[14px]"}`}
                        />
                      </button>
                    </div>
                    <div className="flex items-center mt-2">
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/[0.05] text-norma-textDim">
                        {cap.category}
                      </span>
                      <span className="text-[9px] text-norma-textDim/50 font-mono ml-1.5">
                        {cap.id}
                      </span>
                      <button
                        onClick={() => handleTest(cap)}
                        disabled={testingId === cap.id}
                        className="ml-auto px-2.5 py-1 rounded-lg text-[10px] font-medium bg-norma-accent/15 text-norma-accent hover:bg-norma-accent hover:text-white disabled:opacity-50 flex items-center gap-1 transition-all"
                      >
                        {testingId === cap.id ? (
                          <span className="w-3 h-3 border-2 border-norma-accent/40 border-t-norma-accent rounded-full animate-spin" />
                        ) : (
                          <svg
                            width="10"
                            height="10"
                            viewBox="0 0 24 24"
                            fill="currentColor"
                          >
                            <polygon points="5 3 19 12 5 21 5 3" />
                          </svg>
                        )}
                        {testingId === cap.id ? "..." : "测试"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {showModal && (
        <div
          className="absolute inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
          onClick={() => setShowModal(false)}
        >
          <div
            className="w-[460px] max-h-[80vh] rounded-2xl bg-[#1c1c20] border border-white/[0.08] shadow-2xl flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 px-4 py-3 border-b border-white/[0.06]">
              <span className="text-[13px] font-medium text-norma-text flex-1">
                {modalTitle}
              </span>
              <button
                onClick={() => setShowModal(false)}
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

            <div className="flex-1 overflow-y-auto scrollbar-show p-4 space-y-4">
              {inputFields.length > 0 ? (
                <div className="space-y-2.5">
                  {inputFields.map((field) => (
                    <div key={field.name} className="flex items-center gap-2.5">
                      <label className="flex items-center gap-1 text-[11px] text-norma-text whitespace-nowrap flex-shrink-0 min-w-[90px]">
                        <span className="font-mono text-norma-accent">
                          {field.name}
                        </span>
                        {field.required && (
                          <span className="text-red-400">*</span>
                        )}
                      </label>
                      {field.type === "boolean" ? (
                        <button
                          onClick={() =>
                            setInputValues((v) => ({
                              ...v,
                              [field.name]: !v[field.name],
                            }))
                          }
                          className={`inline-flex h-5 w-9 items-center rounded-full transition-colors ${inputValues[field.name] ? "bg-norma-accent" : "bg-white/10"}`}
                        >
                          <span
                            className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${inputValues[field.name] ? "translate-x-[18px]" : "translate-x-[3px]"}`}
                          />
                        </button>
                      ) : field.type === "enum" && field.enumOptions ? (
                        <select
                          value={inputValues[field.name] ?? ""}
                          onChange={(e) =>
                            setInputValues((v) => ({
                              ...v,
                              [field.name]: e.target.value,
                            }))
                          }
                          className="flex-1 rounded-lg bg-white/[0.06] border border-white/[0.08] px-2.5 py-1.5 text-[11px] text-norma-text outline-none focus:border-norma-accent/40"
                        >
                          {field.enumOptions.map((opt) => (
                            <option key={opt} value={opt}>
                              {opt}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <input
                          type={field.type === "number" ? "number" : "text"}
                          value={inputValues[field.name] ?? ""}
                          onChange={(e) =>
                            setInputValues((v) => ({
                              ...v,
                              [field.name]:
                                field.type === "number"
                                  ? Number(e.target.value)
                                  : e.target.value,
                            }))
                          }
                          placeholder={field.description || field.name}
                          className="flex-1 rounded-lg bg-white/[0.06] border border-white/[0.08] px-2.5 py-1.5 text-[11px] text-norma-text outline-none focus:border-norma-accent/40 placeholder:text-norma-textDim/50"
                        />
                      )}
                    </div>
                  ))}
                </div>
              ) : !testingId && !testResult ? (
                <div className="text-center py-3">
                  <span className="text-[11px] text-norma-textDim/60">
                    无需额外参数
                  </span>
                </div>
              ) : null}
              {testingId && (
                <div className="flex items-center justify-center gap-2 py-4">
                  <div className="w-5 h-5 border-2 border-norma-accent/30 border-t-norma-accent rounded-full animate-spin" />
                  <span className="text-[11px] text-norma-textMuted">
                    正在执行测试...
                  </span>
                </div>
              )}

              {testResult && (
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-7 h-7 rounded-full flex items-center justify-center ${testResult.success ? "bg-emerald-500/20" : "bg-red-500/20"}`}
                    >
                      {testResult.success ? (
                        <svg
                          width="14"
                          height="14"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="#34d399"
                          strokeWidth="2.5"
                        >
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      ) : (
                        <svg
                          width="14"
                          height="14"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="#f87171"
                          strokeWidth="2.5"
                        >
                          <line x1="18" y1="6" x2="6" y2="18" />
                          <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                      )}
                    </div>
                    <div>
                      <span
                        className={`text-[12px] font-medium ${testResult.success ? "text-emerald-400" : "text-red-400"}`}
                      >
                        {testResult.success ? "通过" : "失败"}
                      </span>
                      <span className="text-[10px] text-norma-textDim ml-2">
                        {testResult.duration}ms
                      </span>
                    </div>
                  </div>

                  {testResult.error && (
                    <div className="rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-2 text-[11px] text-red-400 font-mono">
                      {testResult.error}
                    </div>
                  )}

                  {testResult.output && (
                    <div>
                      <div className="text-[10px] text-norma-textDim mb-1.5 uppercase tracking-wider">
                        输出
                      </div>
                      <pre className="rounded-lg bg-white/[0.04] border border-white/[0.06] p-3 text-[10px] text-norma-textMuted font-mono leading-relaxed overflow-auto scrollbar-show max-h-[250px] whitespace-pre-wrap break-all">
                        {typeof testResult.output === "string"
                          ? testResult.output
                          : JSON.stringify(testResult.output, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 px-4 py-3 border-t border-white/[0.06]">
              <button
                onClick={() => setShowModal(false)}
                className="px-3 py-1.5 rounded-lg bg-white/[0.06] text-norma-textMuted text-[11px] hover:bg-white/[0.1] transition-colors"
              >
                关闭
              </button>
              <button
                onClick={runTest}
                disabled={!!testingId}
                className="px-4 py-1.5 rounded-lg bg-norma-accent text-white text-[11px] hover:opacity-90 disabled:opacity-50 transition-opacity flex items-center gap-1.5"
              >
                <svg
                  width="11"
                  height="11"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <polygon points="5 3 19 12 5 21 5 3" />
                </svg>
                运行测试
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export { CapabilitiesPage };
