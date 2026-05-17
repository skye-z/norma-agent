import React, { useState, useEffect } from "react";
import { useDbState, PROVIDER_COLORS } from "../../lib/shared";

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

const ModelTab: React.FC = () => {
  const [presets, setPresets] = useState<any[]>([]);
  const [providers, setProviders, providersLoaded] = useDbState<SavedProvider[]>("norma-providers", []);
  const [enabledModels, setEnabledModels, enabledLoaded] = useDbState<EnabledModel[]>("norma-enabled-models", []);
  const [cachedModels, setCachedModels, cachedLoaded] = useDbState<Record<string, any[]>>("norma-cached-models", {});
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

  const loaded = providersLoaded && enabledLoaded && cachedLoaded;

  if (!loaded) {
    return (
      <div className="flex h-full min-h-0 items-center justify-center">
        <div className="w-5 h-5 border-2 border-norma-accent/30 border-t-norma-accent rounded-full animate-spin" />
      </div>
    );
  }

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
                style={{ backgroundColor: PROVIDER_COLORS[p.presetId] || "#888" }}
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
              {presets.map((preset) => (
                <button
                  key={preset.id}
                  onClick={() => handleAddProvider(preset)}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-[11px] text-norma-textMuted hover:bg-white/[0.06] hover:text-norma-text transition-colors text-left"
                >
                  <div className="w-2 h-2 rounded-full flex-none" style={{ backgroundColor: PROVIDER_COLORS[preset.id] || "#888" }} />
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
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: PROVIDER_COLORS[selected.presetId] || "#888" }} />
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
                  placeholder={presets.find((p) => p.id === selected.presetId)?.keyHint || "API Key"}
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
                            <div className="text-[11px] text-norma-text truncate">{info?.display_name || em.modelId}</div>
                            <div className="text-[9px] text-norma-textDim font-mono truncate">{em.modelId}</div>
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
                            <div className="text-[11px] text-norma-text truncate">{model.display_name || model.id}</div>
                            <div className="text-[9px] text-norma-textDim font-mono truncate">{model.id}</div>
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
        <h3 className="text-[11px] font-semibold text-norma-text mb-2 flex items-center gap-1.5">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-norma-accent">
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2" />
            <path d="M12 20v2" />
            <path d="m4.93 4.93 1.41 1.41" />
            <path d="m17.66 17.66 1.41 1.41" />
            <path d="M2 12h2" />
            <path d="M20 12h2" />
            <path d="m6.34 17.66-1.41 1.41" />
            <path d="m19.07 4.93-1.41 1.41" />
          </svg>
          主题
        </h3>
        <div className="flex gap-2">
          {[
            { id: "dark", label: "暗色", icon: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg> },
            { id: "light", label: "亮色", icon: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg> },
            { id: "system", label: "跟随系统", icon: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg> },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setTheme(t.id)}
              className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-[11px] transition-colors ${theme === t.id ? "bg-norma-accent/20 border border-norma-accent/50 text-norma-accent" : "bg-white/[0.04] border border-white/[0.06] text-norma-textMuted hover:border-white/[0.1]"}`}
            >
              {t.icon}
              {t.label}
            </button>
          ))}
        </div>
      </section>
      <section>
        <h3 className="text-[11px] font-semibold text-norma-text mb-2 flex items-center gap-1.5">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-norma-accent">
            <path d="M10 8V6a2 2 0 0 0-2-2" />
            <path d="M14 8V6a2 2 0 0 1 2-2" />
            <path d="M12 2a2 2 0 0 0-2 2v2" />
            <rect width="16" height="12" x="4" y="8" rx="2" />
          </svg>
          快捷键
        </h3>
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

const AboutTab: React.FC = () => {
  const [versionInfo, setVersionInfo] = useState<{ version: string; electron: string; node: string; chrome: string } | null>(null);

  useEffect(() => {
    (window as any).electronAPI?.getSystemVersion?.().then(setVersionInfo).catch(() => {});
  }, []);

  return (
    <div className="px-5 py-4">
      <div className="space-y-1.5 text-[10px] text-norma-textMuted max-w-[400px]">
        <div className="flex justify-between"><span>版本</span><span className="text-norma-text font-mono">v{versionInfo?.version ?? "—"}</span></div>
        <div className="flex justify-between"><span>Electron</span><span className="text-norma-text font-mono">{versionInfo?.electron ?? "—"}</span></div>
        <div className="flex justify-between"><span>Node.js</span><span className="text-norma-text font-mono">{versionInfo?.node ?? "—"}</span></div>
        <div className="flex justify-between"><span>Chrome</span><span className="text-norma-text font-mono">{versionInfo?.chrome ?? "—"}</span></div>
      </div>
    </div>
  );
};

const DiagTab: React.FC = () => {
  const [enabled, setEnabled] = useState(false);
  const [logs, setLogs] = useState<Array<{ ts: string; level: string; source: string; message: string }>>([]);
  const bottomRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    (window as any).electronAPI?.diagGetLoggingState?.().then((s: any) => setEnabled(s?.enabled ?? false)).catch(() => {});
  }, []);

  useEffect(() => {
    (window as any).electronAPI?.diagGetLogs?.().then((l: any) => setLogs(l || [])).catch(() => {});
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    (window as any).electronAPI?.diagSubscribe?.().catch(() => {});
    const unsub = (window as any).electronAPI?.onMessage?.('diag:logEntry', (raw: string) => {
      try {
        const entry = JSON.parse(raw);
        setLogs((prev) => [...prev, entry].slice(-2000));
      } catch {}
    });
    return () => { unsub?.(); (window as any).electronAPI?.diagUnsubscribe?.().catch(() => {}); };
  }, [enabled]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs.length]);

  const toggleLogging = async () => {
    const next = !enabled;
    const res = await (window as any).electronAPI?.diagSetLogging?.(next);
    setEnabled(res?.enabled ?? next);
    if (next) setLogs([]);
  };

  const clearLogs = async () => {
    await (window as any).electronAPI?.diagClearLogs?.();
    setLogs([]);
  };

  const levelColor = (level: string) => {
    if (level === 'error') return 'text-red-400';
    if (level === 'warn') return 'text-amber-400';
    return 'text-norma-textDim';
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-none flex items-center gap-3 px-5 py-3 border-b border-white/[0.06]">
        <button
          onClick={toggleLogging}
          className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${enabled ? 'bg-emerald-500' : 'bg-white/[0.12]'}`}
        >
          <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform ${enabled ? 'translate-x-[16px]' : 'translate-x-[2px]'}`} />
        </button>
        <span className="text-[11px] text-norma-text">{enabled ? '日志记录中' : '日志已关闭'}</span>
        <span className="text-[9px] text-norma-textDim">{logs.length} 条记录</span>
        <button
          onClick={clearLogs}
          disabled={logs.length === 0}
          className="ml-auto px-2.5 py-1 rounded-lg bg-white/[0.06] text-norma-textMuted text-[10px] hover:bg-white/[0.1] disabled:opacity-30 transition-colors"
        >
          清除
        </button>
      </div>
      <div className="flex-1 overflow-y-auto px-5 py-2 font-mono text-[10px] min-h-0">
        {logs.length === 0 ? (
          <div className="text-norma-textDim text-center py-8">
            {enabled ? '等待日志...' : '打开日志开关后操作应用，日志会自动记录'}
          </div>
        ) : (
          <div className="space-y-0.5">
            {logs.map((log, i) => (
              <div key={i} className="flex items-start gap-2 py-0.5">
                <span className="text-norma-textDim flex-none opacity-60">{new Date(log.ts).toLocaleTimeString('zh-CN', { hour12: false })}</span>
                <span className={`flex-none w-[38px] uppercase text-[9px] font-bold ${levelColor(log.level)}`}>{log.level}</span>
                <span className="text-norma-accent flex-none w-[50px] truncate">{log.source}</span>
                <span className="text-norma-text/80 break-all">{log.message}</span>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>
        )}
      </div>
    </div>
  );
};

const SettingsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState("basic");
  const isMac = window.electronAPI?.platform === "darwin";
  const [theme, setTheme] = useDbState<string>("norma-theme", "dark");

  const tabs = [
    { id: "basic", label: "基础" },
    { id: "model", label: "模型" },
    { id: "diag", label: "诊断" },
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
        {activeTab === "diag" && <DiagTab />}
        {activeTab === "about" && <AboutTab />}
      </div>
    </div>
  );
};

export { SettingsPage };
