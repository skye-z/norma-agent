import React, { useState, useEffect } from "react";
import { useStoredState } from "../../lib/shared";

interface SavedProvider {
  id: string;
  presetId: string;
  name: string;
  type: string;
  baseUrl: string;
  apiKey: string;
}

interface EnabledModel {
  providerId: string;
  modelId: string;
}

const PROVIDER_PRESET_LIST = [
  { id: "openai", name: "OpenAI", type: "openai", baseUrl: "https://api.openai.com/v1", keyHint: "sk-..." },
  { id: "anthropic", name: "Anthropic", type: "anthropic", baseUrl: "https://api.anthropic.com", keyHint: "sk-ant-..." },
  { id: "deepseek", name: "DeepSeek", type: "openai", baseUrl: "https://api.deepseek.com", keyHint: "sk-..." },
  { id: "openrouter", name: "OpenRouter", type: "openai", baseUrl: "https://openrouter.ai/api/v1", keyHint: "sk-or-..." },
  { id: "google", name: "Google AI", type: "google", baseUrl: "https://generativelanguage.googleapis.com/v1beta", keyHint: "AIza..." },
  { id: "ollama", name: "Ollama", type: "ollama", baseUrl: "http://localhost:11434", keyHint: "无需密钥" },
  { id: "custom", name: "自定义", type: "openai", baseUrl: "", keyHint: "API Key" },
];

const PRESET_COLORS: Record<string, string> = {
  openai: "#10a37f",
  anthropic: "#d4a27f",
  deepseek: "#4d6bfe",
  openrouter: "#6d28d9",
  google: "#4285f4",
  ollama: "#6366f1",
  custom: "#8b8b8b",
};

const ModelTab: React.FC = () => {
  const [presets, setPresets] = useState<any[]>([]);
  const [providers, setProviders] = useStoredState<SavedProvider[]>("norma-providers", []);
  const [enabledModels, setEnabledModels] = useStoredState<EnabledModel[]>("norma-enabled-models", []);
  const [cachedModels, setCachedModels] = useStoredState<Record<string, any[]>>("norma-cached-models", {});
  const [selectedProviderId, setSelectedProviderId] = useState<string>("");
  const [showAddMenu, setShowAddMenu] = useState(false);

  const [testingConn, setTestingConn] = useState(false);
  const [connResult, setConnResult] = useState<{ success: boolean; latency?: number; error?: string } | null>(null);

  const [fetchingModels, setFetchingModels] = useState(false);
  const [fetchError, setFetchError] = useState("");

  const [testingModelId, setTestingModelId] = useState<string | null>(null);
  const [modelResults, setModelResults] = useState<Record<string, { success: boolean; latency?: number; error?: string }>>({});

  const selected = providers.find((p) => p.id === selectedProviderId) || null;

  const enabledForSelected = enabledModels.filter((m) => m.providerId === selectedProviderId);
  const fetchedModels = cachedModels[selectedProviderId] || [];

  useEffect(() => {
    window.electronAPI?.invokeProviderPresets?.().then(setPresets).catch(() => {});
  }, []);

  const handleSelectProvider = (id: string) => {
    setSelectedProviderId(id);
    setFetchError("");
    setConnResult(null);
    setModelResults({});
  };

  const handleAddProvider = (preset: any) => {
    const newP: SavedProvider = {
      id: Date.now().toString(),
      presetId: preset.id,
      name: preset.name,
      type: preset.type,
      baseUrl: preset.baseUrl || "",
      apiKey: "",
    };
    setProviders((prev) => [...prev, newP]);
    setSelectedProviderId(newP.id);
    setShowAddMenu(false);
    setFetchError("");
    setConnResult(null);
    setModelResults({});
  };

  const handleRemoveProvider = (id: string) => {
    setProviders((prev) => prev.filter((p) => p.id !== id));
    setCachedModels((prev) => { const next = { ...prev }; delete next[id]; return next; });
    setEnabledModels((prev) => prev.filter((m) => m.providerId !== id));
    if (selectedProviderId === id) {
      setSelectedProviderId("");
      setConnResult(null);
      setModelResults({});
    }
  };

  const updateProvider = (patch: Partial<SavedProvider>) => {
    setProviders((prev) =>
      prev.map((p) => (p.id === selectedProviderId ? { ...p, ...patch } : p)),
    );
  };

  const handleTestConn = async () => {
    if (!selected) return;
    setTestingConn(true);
    setConnResult(null);
    try {
      const updated = providers.find((p) => p.id === selectedProviderId);
      const r = await window.electronAPI?.testProviderConnectivity?.(updated || selected);
      setConnResult(r ?? null);
    } catch (e: any) {
      setConnResult({ success: false, error: e.message });
    }
    setTestingConn(false);
  };

  const handleFetchModels = async () => {
    if (!selected) return;
    setFetchingModels(true);
    setFetchError("");
    try {
      const updated = providers.find((p) => p.id === selectedProviderId);
      const r = await window.electronAPI?.fetchProviderModels?.(updated || selected);
      if (r?.success) {
        setCachedModels((prev) => ({ ...prev, [selectedProviderId]: r.models || [] }));
      } else {
        setFetchError(r?.error || "获取失败");
      }
    } catch (e: any) {
      setFetchError(e.message);
    }
    setFetchingModels(false);
  };

  const handleTestModel = async (modelId: string) => {
    if (!selected) return;
    setTestingModelId(modelId);
    try {
      const updated = providers.find((p) => p.id === selectedProviderId);
      const r = await window.electronAPI?.testModelAvailability?.(updated || selected, modelId);
      setModelResults((prev) => ({ ...prev, [modelId]: r ?? { success: false, error: "无响应" } }));
    } catch (e: any) {
      setModelResults((prev) => ({ ...prev, [modelId]: { success: false, error: e.message } }));
    }
    setTestingModelId(null);
  };

  const toggleModel = (modelId: string) => {
    setEnabledModels((prev) => {
      const idx = prev.findIndex((m) => m.providerId === selectedProviderId && m.modelId === modelId);
      if (idx >= 0) return prev.filter((_, i) => i !== idx);
      return [...prev, { providerId: selectedProviderId, modelId }];
    });
  };

  const isModelOn = (modelId: string) =>
    enabledModels.some((m) => m.providerId === selectedProviderId && m.modelId === modelId);

  const notEnabledModels = fetchedModels.filter((m: any) => !isModelOn(m.id));

  return (
    <div className="flex h-full min-h-0">
      <div className="w-[200px] flex-none border-r border-white/[0.06] flex flex-col">
        <div className="flex-1 overflow-y-auto py-2 px-2 space-y-1">
          {providers.map((p) => (
            <div
              key={p.id}
              onClick={() => handleSelectProvider(p.id)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors group ${
                selectedProviderId === p.id
                  ? "bg-norma-accent/15 border border-norma-accent/30"
                  : "hover:bg-white/[0.04] border border-transparent"
              }`}
            >
              <div
                className="w-2 h-2 rounded-full flex-none"
                style={{ backgroundColor: PRESET_COLORS[p.presetId] || "#888" }}
              />
              <span className="text-[11px] text-norma-text truncate flex-1">{p.name}</span>
              <button
                onClick={(e) => { e.stopPropagation(); handleRemoveProvider(p.id); }}
                className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-white/[0.08] text-norma-textDim hover:text-red-400 transition-all flex-none"
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
              </button>
            </div>
          ))}
          {providers.length === 0 && (
            <div className="text-[10px] text-norma-textDim text-center py-6">尚未添加供应商</div>
          )}
        </div>
        <div className="flex-none p-2 border-t border-white/[0.06] relative">
          <button
            onClick={() => setShowAddMenu(!showAddMenu)}
            className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-norma-accent text-white text-[11px] hover:opacity-90 transition-opacity"
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14"/><path d="M5 12h14"/></svg>
            添加供应商
          </button>
          {showAddMenu && (
            <div className="absolute bottom-full left-2 right-2 mb-1 glass-popover py-1 max-h-[260px] overflow-y-auto z-50">
              {PROVIDER_PRESET_LIST.map((preset) => (
                <button
                  key={preset.id}
                  onClick={() => handleAddProvider(preset)}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-[11px] text-norma-textMuted hover:bg-white/[0.06] hover:text-norma-text transition-colors text-left"
                >
                  <div className="w-2 h-2 rounded-full flex-none" style={{ backgroundColor: PRESET_COLORS[preset.id] || "#888" }} />
                  <span className="flex-1">{preset.name}</span>
                  <span className="text-[9px] text-norma-textDim font-mono">{preset.type}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4 min-w-0">
        {selected ? (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: PRESET_COLORS[selected.presetId] || "#888" }} />
              <input
                value={selected.name}
                onChange={(e) => updateProvider({ name: e.target.value })}
                className={`bg-transparent text-[13px] font-semibold text-norma-text outline-none border-b border-transparent focus:border-norma-accent/40 transition-colors ${selected.presetId === "custom" ? "w-[160px]" : ""}`}
                readOnly={selected.presetId !== "custom"}
              />
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/[0.06] text-norma-textDim font-mono">{selected.type}</span>
            </div>

            <div className="space-y-2">
              <div>
                <div className="text-[9px] text-norma-textDim mb-1">Base URL</div>
                <input
                  value={selected.baseUrl}
                  onChange={(e) => updateProvider({ baseUrl: e.target.value })}
                  placeholder="https://..."
                  className="w-full bg-white/[0.04] border border-white/[0.06] rounded-lg px-3 py-1.5 text-[11px] text-norma-text placeholder-norma-textDim outline-none focus:border-norma-accent/40 font-mono"
                />
              </div>
              <div>
                <div className="text-[9px] text-norma-textDim mb-1">API Key</div>
                <input
                  type="password"
                  value={selected.apiKey}
                  onChange={(e) => updateProvider({ apiKey: e.target.value })}
                  placeholder={PROVIDER_PRESET_LIST.find((p) => p.id === selected.presetId)?.keyHint || "API Key"}
                  className="w-full bg-white/[0.04] border border-white/[0.06] rounded-lg px-3 py-1.5 text-[11px] text-norma-text placeholder-norma-textDim outline-none focus:border-norma-accent/40 font-mono"
                />
              </div>
              <div className="flex items-center gap-2 pt-1">
                <button
                  onClick={handleTestConn}
                  disabled={testingConn || !selected.baseUrl}
                  className="px-3 py-1.5 rounded-lg bg-white/[0.06] border border-white/[0.08] text-norma-textMuted text-[11px] hover:bg-white/[0.1] hover:text-norma-text transition-colors disabled:opacity-40"
                >
                  {testingConn ? "测试中..." : "测试连通性"}
                </button>
                {connResult && (
                  <span className={`text-[10px] flex items-center gap-1 ${connResult.success ? "text-emerald-400" : "text-red-400"}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${connResult.success ? "bg-emerald-400" : "bg-red-400"}`} />
                    {connResult.success ? `已连通 ${connResult.latency}ms` : connResult.error}
                  </span>
                )}
              </div>
            </div>

            <div className="hairline" />

            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-semibold text-norma-text">已启用</span>
                  <span className="text-[9px] text-norma-textDim">{enabledForSelected.length} 个模型</span>
                </div>
                <button
                  onClick={handleFetchModels}
                  disabled={fetchingModels}
                  className="px-2.5 py-1 rounded-lg bg-norma-accent text-white text-[10px] hover:opacity-90 transition-opacity disabled:opacity-40"
                >
                  {fetchingModels ? "获取中..." : fetchedModels.length > 0 ? "刷新模型" : "获取模型"}
                </button>
              </div>

              {enabledForSelected.length > 0 && (
                <div className="space-y-1 mb-3">
                  {enabledForSelected.map((em) => {
                    const info = fetchedModels.find((m: any) => m.id === em.modelId);
                    const testing = testingModelId === em.modelId;
                    const result = modelResults[em.modelId];
                    return (
                      <div key={em.modelId} className="flex items-center gap-2 rounded-lg border border-norma-accent/30 bg-norma-accent/10 px-3 py-1.5">
                        <div className="w-1.5 h-1.5 rounded-full bg-norma-accent flex-none" />
                        <div className="flex-1 min-w-0">
                          <div className="text-[11px] font-mono text-norma-text truncate">{em.modelId}</div>
                          {info?.owned_by && <div className="text-[9px] text-norma-textDim">{info.owned_by}</div>}
                        </div>
                        <button
                          onClick={() => toggleModel(em.modelId)}
                          className="px-1.5 py-0.5 rounded text-[9px] bg-white/[0.06] text-norma-textDim hover:text-red-400 transition-colors flex-none"
                        >
                          停用
                        </button>
                        <button
                          onClick={() => handleTestModel(em.modelId)}
                          disabled={testing}
                          className="px-2 py-0.5 rounded text-[9px] bg-white/[0.04] border border-white/[0.06] text-norma-textMuted hover:text-norma-text transition-colors disabled:opacity-40 flex-none"
                        >
                          {testing ? "..." : "测试"}
                        </button>
                        {result && (
                          <span className={`text-[9px] flex items-center gap-0.5 flex-none ${result.success ? "text-emerald-400" : "text-red-400"}`}>
                            <span className={`w-1 h-1 rounded-full ${result.success ? "bg-emerald-400" : "bg-red-400"}`} />
                            {result.success ? `${result.latency}ms` : "失败"}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {fetchError && <div className="text-[10px] text-red-400 mb-2">{fetchError}</div>}

              {notEnabledModels.length > 0 && (
                <div>
                  <div className="text-[9px] text-norma-textDim uppercase tracking-wider mb-1">可用模型</div>
                  <div className="space-y-1 max-h-[240px] overflow-y-auto">
                    {notEnabledModels.map((model: any) => {
                      const testing = testingModelId === model.id;
                      const result = modelResults[model.id];
                      return (
                        <div key={model.id} className="flex items-center gap-2 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-1.5 hover:border-white/[0.1] transition-colors">
                          <div className="flex-1 min-w-0">
                            <div className="text-[11px] font-mono text-norma-text truncate">{model.id}</div>
                            {model.name !== model.id && <div className="text-[9px] text-norma-textDim truncate">{model.name}</div>}
                          </div>
                          {model.owned_by && <span className="text-[9px] text-norma-textDim flex-none">{model.owned_by}</span>}
                          {model.created && <span className="text-[8px] text-norma-textDim font-mono flex-none">{new Date(model.created * 1000).toLocaleDateString()}</span>}
                          <button
                            onClick={() => toggleModel(model.id)}
                            className="px-2 py-0.5 rounded text-[9px] bg-norma-accent/20 text-norma-accent hover:bg-norma-accent/30 transition-colors flex-none"
                          >
                            启用
                          </button>
                          <button
                            onClick={() => handleTestModel(model.id)}
                            disabled={testing}
                            className="px-2 py-0.5 rounded text-[9px] bg-white/[0.04] border border-white/[0.06] text-norma-textMuted hover:text-norma-text transition-colors disabled:opacity-40 flex-none"
                          >
                            {testing ? "..." : "测试"}
                          </button>
                          {result && (
                            <span className={`text-[9px] flex items-center gap-0.5 flex-none ${result.success ? "text-emerald-400" : "text-red-400"}`}>
                              <span className={`w-1 h-1 rounded-full ${result.success ? "bg-emerald-400" : "bg-red-400"}`} />
                              {result.success ? `${result.latency}ms` : "失败"}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {!fetchingModels && fetchedModels.length === 0 && !fetchError && (
                <div className="text-[10px] text-norma-textDim text-center py-4">点击「获取模型」加载可用模型</div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-norma-textDim mb-3">
              <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>
            </svg>
            <div className="text-[12px] text-norma-textMuted mb-1">选择或添加供应商</div>
            <div className="text-[10px] text-norma-textDim">从左侧选择一个供应商查看详情</div>
          </div>
        )}
      </div>
    </div>
  );
};

const BasicTab: React.FC<{ theme: string; setTheme: (t: string) => void; isMac: boolean }> = ({ theme, setTheme, isMac }) => (
  <div className="px-5 py-4">
    <div className="space-y-5 max-w-[400px]">
      <section>
        <h3 className="text-[11px] font-semibold text-norma-text mb-2">主题</h3>
        <div className="flex gap-2">
          {[{ id: "dark", label: "暗色" }, { id: "light", label: "亮色" }, { id: "system", label: "跟随系统" }].map((t) => (
            <button
              key={t.id}
              onClick={() => setTheme(t.id)}
              className={`flex-1 px-3 py-2 rounded-lg text-[11px] transition-colors ${theme === t.id ? "bg-norma-accent/20 border border-norma-accent/50 text-norma-accent" : "bg-white/[0.04] border border-white/[0.06] text-norma-textMuted hover:border-white/[0.1]"}`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </section>
      <section>
        <h3 className="text-[11px] font-semibold text-norma-text mb-2">快捷键</h3>
        <div className="space-y-2">
          <div className="flex items-center gap-3 rounded-lg bg-white/[0.03] border border-white/[0.06] px-3 py-2">
            <span className="text-[10px] text-norma-textMuted flex-1">唤出命令栏</span>
            <kbd className="px-1.5 py-0.5 rounded bg-white/[0.06] border border-white/[0.08] text-[10px] text-norma-text font-mono">{isMac ? "⌥ Space" : "Ctrl+Shift+Space"}</kbd>
          </div>
          <div className="flex items-center gap-3 rounded-lg bg-white/[0.03] border border-white/[0.06] px-3 py-2">
            <span className="text-[10px] text-norma-textMuted flex-1">隐藏窗口</span>
            <kbd className="px-1.5 py-0.5 rounded bg-white/[0.06] border border-white/[0.08] text-[10px] text-norma-text font-mono">Esc</kbd>
          </div>
        </div>
      </section>
    </div>
  </div>
);

const AboutTab: React.FC = () => (
  <div className="px-5 py-4">
    <div className="space-y-1.5 text-[10px] text-norma-textMuted max-w-[400px]">
      <div className="flex justify-between"><span>版本</span><span className="text-norma-text font-mono">v0.5.0</span></div>
      <div className="flex justify-between"><span>运行时</span><span className="text-norma-text font-mono">Electron 42 + React 19</span></div>
      <div className="flex justify-between"><span>AI 框架</span><span className="text-norma-text font-mono">AssistantUI 0.14 + Mastra</span></div>
    </div>
  </div>
);

const SettingsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState("basic");
  const isMac = window.electronAPI?.platform === "darwin";
  const [theme, setTheme] = useStoredState<string>("norma-theme", "dark");

  const tabs = [
    { id: "basic", label: "基础" },
    { id: "model", label: "模型" },
    { id: "about", label: "关于" },
  ];

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      <div className="flex-none flex items-center gap-1 px-5 pt-3 pb-2 border-b border-white/[0.06]">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-3 py-1.5 rounded-lg text-[11px] transition-colors ${
              activeTab === tab.id
                ? "bg-norma-accent/20 text-norma-accent"
                : "text-norma-textMuted hover:text-norma-text hover:bg-white/[0.04]"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-y-auto">
        {activeTab === "basic" && <BasicTab theme={theme} setTheme={setTheme} isMac={isMac} />}
        {activeTab === "model" && <ModelTab />}
        {activeTab === "about" && <AboutTab />}
      </div>
    </div>
  );
};

export { SettingsPage };
