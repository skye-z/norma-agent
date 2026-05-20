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
  const [providers, setProviders, providersLoaded] = useDbState<
    SavedProvider[]
  >("norma-providers", []);
  const [enabledModels, setEnabledModels, enabledLoaded] = useDbState<
    EnabledModel[]
  >("norma-enabled-models", []);
  const [cachedModels, setCachedModels, cachedLoaded] = useDbState<
    Record<string, any[]>
  >("norma-cached-models", {});
  const [selectedProviderId, setSelectedProviderId] = useState<string>("");
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [modelCaps, setModelCaps] = useState<
    Record<string, { vision: boolean; contextLength: number; known: boolean }>
  >({});
  const [modelOverrides, setModelOverrides, overridesLoaded] = useDbState<
    Record<string, { vision?: boolean; contextLength?: number }>
  >("norma-model-overrides", {});

  const [testingConn, setTestingConn] = useState(false);
  const [connResult, setConnResult] = useState<{
    success: boolean;
    latency?: number;
    error?: string;
  } | null>(null);

  const [fetchingModels, setFetchingModels] = useState(false);
  const [fetchError, setFetchError] = useState("");

  const [testingModelId, setTestingModelId] = useState<string | null>(null);
  const [modelResults, setModelResults] = useState<
    Record<string, { success: boolean; latency?: number; error?: string }>
  >({});

  const selected = providers.find((p) => p.id === selectedProviderId) || null;

  const enabledForSelected = enabledModels.filter(
    (m) => m.providerId === selectedProviderId,
  );
  const fetchedModels = cachedModels[selectedProviderId] || [];

  const fetchCaps = async (modelId: string) => {
    if (modelCaps[modelId]) return;
    try {
      const caps =
        await window.electronAPI?.getCapabilitiesWithOverride?.(modelId);
      if (caps) setModelCaps((prev) => ({ ...prev, [modelId]: caps }));
    } catch {}
  };

  useEffect(() => {
    window.electronAPI
      ?.invokeProviderPresets?.()
      .then(setPresets)
      .catch(() => {});
  }, []);

  useEffect(() => {
    enabledForSelected.forEach((em) => fetchCaps(em.modelId));
    fetchedModels.forEach((m: any) => fetchCaps(m.id));
  }, [enabledForSelected, fetchedModels]);

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
    setCachedModels((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
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
      const r = await window.electronAPI?.testProviderConnectivity?.(
        updated || selected,
      );
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
      const r = await window.electronAPI?.fetchProviderModels?.(
        updated || selected,
      );
      if (r?.success) {
        setCachedModels((prev) => ({
          ...prev,
          [selectedProviderId]: r.models || [],
        }));
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
      const r = await window.electronAPI?.testModelAvailability?.(
        updated || selected,
        modelId,
      );
      setModelResults((prev) => ({
        ...prev,
        [modelId]: r ?? { success: false, error: "无响应" },
      }));
    } catch (e: any) {
      setModelResults((prev) => ({
        ...prev,
        [modelId]: { success: false, error: e.message },
      }));
    }
    setTestingModelId(null);
  };

  const toggleModel = (modelId: string) => {
    setEnabledModels((prev) => {
      const idx = prev.findIndex(
        (m) => m.providerId === selectedProviderId && m.modelId === modelId,
      );
      if (idx >= 0) return prev.filter((_, i) => i !== idx);
      return [...prev, { providerId: selectedProviderId, modelId }];
    });
  };

  const isModelOn = (modelId: string) =>
    enabledModels.some(
      (m) => m.providerId === selectedProviderId && m.modelId === modelId,
    );

  const notEnabledModels = fetchedModels.filter((m: any) => !isModelOn(m.id));

  const loaded = providersLoaded && enabledLoaded && cachedLoaded;

  const fmtCtx = (tokens: number) => {
    if (tokens <= 0) return "";
    if (tokens >= 1048576) return `${Math.round(tokens / 1048576)}M`;
    if (tokens >= 1024) return `${Math.round(tokens / 1024)}K`;
    return String(tokens);
  };

  const toggleOverrideVision = (modelId: string) => {
    setModelOverrides((prev) => {
      const cur = prev[modelId] || {};
      return { ...prev, [modelId]: { ...cur, vision: !cur.vision } };
    });
    setModelCaps((prev) => {
      const c = prev[modelId];
      if (!c) return prev;
      return { ...prev, [modelId]: { ...c, vision: !c.vision } };
    });
  };

  const setOverrideCtx = (modelId: string, val: number) => {
    setModelOverrides((prev) => {
      const cur = prev[modelId] || {};
      return { ...prev, [modelId]: { ...cur, contextLength: val } };
    });
    setModelCaps((prev) => {
      const c = prev[modelId];
      if (!c) return prev;
      return { ...prev, [modelId]: { ...c, contextLength: val } };
    });
  };

  const CapBadges: React.FC<{ modelId: string }> = ({ modelId }) => {
    const caps = modelCaps[modelId];
    if (!caps) return null;
    return (
      <span className="inline-flex items-center gap-1 flex-none">
        {caps.known && (
          <span
            className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full bg-emerald-500/20 text-emerald-300"
            title="已验证（官方清单）"
          >
            <svg width="8" height="8" viewBox="0 0 24 24" fill="currentColor">
              <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" />
            </svg>
          </span>
        )}
        {caps.known ? (
          <>
            {caps.vision && (
              <span className="inline-flex items-center gap-0.5 px-1 py-px rounded bg-violet-500/20 text-violet-300 text-[10px] font-medium">
                <svg
                  width="7"
                  height="7"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                >
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
                视觉
              </span>
            )}
            {caps.contextLength > 0 && (
              <span className="px-1 py-px rounded bg-sky-500/20 text-sky-300 text-[10px] font-mono">
                {fmtCtx(caps.contextLength)}
              </span>
            )}
          </>
        ) : (
          <>
            <button
              onClick={(e) => {
                e.stopPropagation();
                toggleOverrideVision(modelId);
              }}
              className={`px-1 py-px rounded text-[10px] transition-colors ${caps.vision ? "bg-violet-500/20 text-violet-300" : "bg-white/[0.06] text-norma-textDim"}`}
              title={
                caps.vision ? "点击标记为不支持视觉" : "点击标记为支持视觉"
              }
            >
              {caps.vision ? "视觉 ✓" : "视觉 ✗"}
            </button>
            <input
              type="text"
              inputMode="numeric"
              value={caps.contextLength || ""}
              onChange={(e) => {
                e.stopPropagation();
                setOverrideCtx(
                  modelId,
                  parseInt(e.target.value.replace(/\D/g, "")) || 0,
                );
              }}
              onClick={(e) => e.stopPropagation()}
              placeholder="上下文"
              className="w-[48px] px-1 py-px rounded bg-white/[0.06] text-[10px] text-norma-textMuted font-mono text-center outline-none border border-white/[0.06] focus:border-sky-500/40"
            />
          </>
        )}
      </span>
    );
  };

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
        <div className="flex-1 overflow-y-auto scrollbar-show py-2 px-2 space-y-1">
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
                style={{
                  backgroundColor: PROVIDER_COLORS[p.presetId] || "#888",
                }}
              />
              <span className="text-[13px] text-norma-text truncate flex-1">
                {p.name}
              </span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleRemoveProvider(p.id);
                }}
                className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-white/[0.08] text-norma-textDim hover:text-red-400 transition-all flex-none"
              >
                <svg
                  width="10"
                  height="10"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M18 6 6 18" />
                  <path d="m6 6 12 12" />
                </svg>
              </button>
            </div>
          ))}
          {providers.length === 0 && (
            <div className="text-[12px] text-norma-textDim text-center py-6">
              尚未添加供应商
            </div>
          )}
        </div>
        <div className="flex-none p-2 border-t border-white/[0.06] relative">
          <button
            onClick={() => setShowAddMenu(!showAddMenu)}
            className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-norma-accent text-white text-[13px] hover:opacity-90 transition-opacity"
          >
            <svg
              width="10"
              height="10"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M12 5v14" />
              <path d="M5 12h14" />
            </svg>
            添加供应商
          </button>
          {showAddMenu && (
            <div className="absolute bottom-full left-2 right-2 mb-1 glass-popover py-1.5 px-2 z-50 max-h-[280px] overflow-y-auto scrollbar-show">
              <div className="flex flex-col gap-0.5">
                {presets.map((preset) => (
                  <button
                    key={preset.id}
                    onClick={() => handleAddProvider(preset)}
                    className="flex items-center gap-1.5 px-2 py-1.5 text-[12px] text-norma-textMuted hover:bg-white/[0.06] hover:text-norma-text transition-colors text-left rounded-md"
                  >
                    <div
                      className="w-1.5 h-1.5 rounded-full flex-none"
                      style={{
                        backgroundColor: PROVIDER_COLORS[preset.id] || "#888",
                      }}
                    />
                    <span className="flex-1 truncate">{preset.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-show px-5 py-4 min-w-0">
        {selected ? (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <div
                className="w-3 h-3 rounded-full"
                style={{
                  backgroundColor: PROVIDER_COLORS[selected.presetId] || "#888",
                }}
              />
              <input
                value={selected.name}
                onChange={(e) => updateProvider({ name: e.target.value })}
                className={`bg-transparent text-[15px] font-semibold text-norma-text outline-none border-b border-transparent focus:border-norma-accent/40 transition-colors ${selected.presetId === "custom" ? "w-[160px]" : ""}`}
                readOnly={selected.presetId !== "custom"}
              />
              <span className="text-[11px] px-1.5 py-0.5 rounded bg-white/[0.06] text-norma-textDim font-mono">
                {selected.type}
              </span>
            </div>

            <div className="space-y-2">
              <div>
                <div className="text-[11px] text-norma-textDim mb-1">
                  Base URL
                </div>
                <input
                  value={selected.baseUrl}
                  onChange={(e) => updateProvider({ baseUrl: e.target.value })}
                  placeholder="https://..."
                  className="w-full bg-white/[0.04] border border-white/[0.06] rounded-lg px-3 py-1.5 text-[13px] text-norma-text placeholder-norma-textDim outline-none focus:border-norma-accent/40 font-mono"
                />
              </div>
              <div>
                <div className="text-[11px] text-norma-textDim mb-1">
                  API Key
                </div>
                <input
                  type="password"
                  value={selected.apiKey}
                  onChange={(e) => updateProvider({ apiKey: e.target.value })}
                  placeholder={
                    presets.find((p) => p.id === selected.presetId)?.keyHint ||
                    "API Key"
                  }
                  className="w-full bg-white/[0.04] border border-white/[0.06] rounded-lg px-3 py-1.5 text-[13px] text-norma-text placeholder-norma-textDim outline-none focus:border-norma-accent/40 font-mono"
                />
              </div>
              <div className="flex items-center gap-2 pt-1">
                <button
                  onClick={handleTestConn}
                  disabled={testingConn || !selected.baseUrl}
                  className="px-3 py-1.5 rounded-lg bg-white/[0.06] border border-white/[0.08] text-norma-textMuted text-[13px] hover:bg-white/[0.1] hover:text-norma-text transition-colors disabled:opacity-40"
                >
                  {testingConn ? "测试中..." : "测试连通性"}
                </button>
                {connResult && (
                  <span
                    className={`text-[12px] flex items-center gap-1 ${connResult.success ? "text-emerald-400" : "text-red-400"}`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${connResult.success ? "bg-emerald-400" : "bg-red-400"}`}
                    />
                    {connResult.success
                      ? `已连通 ${connResult.latency}ms`
                      : connResult.error}
                  </span>
                )}
              </div>
            </div>

            <div className="hairline" />

            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-[13px] font-semibold text-norma-text">
                    已启用
                  </span>
                  <span className="text-[11px] text-norma-textDim">
                    {enabledForSelected.length} 个模型
                  </span>
                </div>
                <button
                  onClick={handleFetchModels}
                  disabled={fetchingModels}
                  className="px-2.5 py-1 rounded-lg bg-norma-accent text-white text-[12px] hover:opacity-90 transition-opacity disabled:opacity-40"
                >
                  {fetchingModels
                    ? "获取中..."
                    : fetchedModels.length > 0
                      ? "刷新模型"
                      : "获取模型"}
                </button>
              </div>

              {enabledForSelected.length > 0 && (
                <div className="space-y-1 mb-3">
                  {enabledForSelected.map((em) => {
                    const info = fetchedModels.find(
                      (m: any) => m.id === em.modelId,
                    );
                    const testing = testingModelId === em.modelId;
                    const result = modelResults[em.modelId];
                    return (
                      <div
                        key={em.modelId}
                        className="flex items-center gap-2 rounded-lg border border-norma-accent/30 bg-norma-accent/10 px-3 py-1.5"
                      >
                        <div className="w-1.5 h-1.5 rounded-full bg-norma-accent flex-none" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[13px] text-norma-text truncate">
                              {info?.display_name ||
                                em.modelId
                                  .replace(/-/g, " ")
                                  .replace(/\b\w/g, (c) => c.toUpperCase())}
                            </span>
                            <CapBadges modelId={em.modelId} />
                          </div>
                          <div className="text-[11px] text-norma-textDim font-mono truncate">
                            {em.modelId}
                          </div>
                        </div>
                        <button
                          onClick={() => toggleModel(em.modelId)}
                          className="px-1.5 py-0.5 rounded text-[11px] bg-white/[0.06] text-norma-textDim hover:text-red-400 transition-colors flex-none"
                        >
                          停用
                        </button>
                        <button
                          onClick={() => handleTestModel(em.modelId)}
                          disabled={testing}
                          className="px-2 py-0.5 rounded text-[11px] bg-white/[0.04] border border-white/[0.06] text-norma-textMuted hover:text-norma-text transition-colors disabled:opacity-40 flex-none"
                        >
                          {testing ? "..." : "测试"}
                        </button>
                        {result && (
                          <span
                            className={`text-[11px] flex items-center gap-0.5 flex-none ${result.success ? "text-emerald-400" : "text-red-400"}`}
                          >
                            <span
                              className={`w-1 h-1 rounded-full ${result.success ? "bg-emerald-400" : "bg-red-400"}`}
                            />
                            {result.success ? `${result.latency}ms` : "失败"}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {fetchError && (
                <div className="text-[12px] text-red-400 mb-2">
                  {fetchError}
                </div>
              )}

              {notEnabledModels.length > 0 && (
                <div>
                  <div className="text-[11px] text-norma-textDim uppercase tracking-wider mb-1">
                    可用模型
                  </div>
                  <div className="space-y-1 max-h-[240px] overflow-y-auto scrollbar-show">
                    {notEnabledModels.map((model: any) => {
                      const testing = testingModelId === model.id;
                      const result = modelResults[model.id];
                      return (
                        <div
                          key={model.id}
                          className="flex items-center gap-2 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-1.5 hover:border-white/[0.1] transition-colors"
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="text-[13px] text-norma-text truncate">
                                {model.display_name ||
                                  model.id
                                    .replace(/-/g, " ")
                                    .replace(/\b\w/g, (c) => c.toUpperCase())}
                              </span>
                              <CapBadges modelId={model.id} />
                            </div>
                            <div className="text-[11px] text-norma-textDim font-mono truncate">
                              {model.id}
                            </div>
                          </div>
                          {model.owned_by && (
                            <span className="text-[11px] text-norma-textDim flex-none">
                              {model.owned_by}
                            </span>
                          )}
                          {model.created && (
                            <span className="text-[10px] text-norma-textDim font-mono flex-none">
                              {new Date(
                                model.created * 1000,
                              ).toLocaleDateString()}
                            </span>
                          )}
                          <button
                            onClick={() => toggleModel(model.id)}
                            className="px-2 py-0.5 rounded text-[11px] bg-norma-accent/20 text-norma-accent hover:bg-norma-accent/30 transition-colors flex-none"
                          >
                            启用
                          </button>
                          <button
                            onClick={() => handleTestModel(model.id)}
                            disabled={testing}
                            className="px-2 py-0.5 rounded text-[11px] bg-white/[0.04] border border-white/[0.06] text-norma-textMuted hover:text-norma-text transition-colors disabled:opacity-40 flex-none"
                          >
                            {testing ? "..." : "测试"}
                          </button>
                          {result && (
                            <span
                              className={`text-[11px] flex items-center gap-0.5 flex-none ${result.success ? "text-emerald-400" : "text-red-400"}`}
                            >
                              <span
                                className={`w-1 h-1 rounded-full ${result.success ? "bg-emerald-400" : "bg-red-400"}`}
                              />
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
                <div className="text-[12px] text-norma-textDim text-center py-4">
                  点击「获取模型」加载可用模型
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <svg
              width="32"
              height="32"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              className="text-norma-textDim mb-3"
            >
              <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
              <line x1="8" y1="21" x2="16" y2="21" />
              <line x1="12" y1="17" x2="12" y2="21" />
            </svg>
            <div className="text-[14px] text-norma-textMuted mb-1">
              选择或添加供应商
            </div>
            <div className="text-[12px] text-norma-textDim">
              从左侧选择一个供应商查看详情
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const BasicTab: React.FC<{
  theme: string;
  setTheme: (t: string) => void;
  isMac: boolean;
}> = ({ theme, setTheme, isMac }) => {
  const [dataDir, setDataDir] = useState<string>("加载中...");
  const [movingDir, setMovingDir] = useState(false);
  const [dirError, setDirError] = useState("");
  const [shortcuts, setShortcuts] = useState<{
    commandBar: string;
    newSession: string;
    hideWindow: string;
  } | null>(null);
  const [recordingKey, setRecordingKey] = useState<string | null>(null);

  const DEFAULTS = {
    commandBar: isMac ? "Option+Space" : "Ctrl+Shift+Space",
    newSession: isMac ? "Cmd+N" : "Ctrl+N",
    hideWindow: isMac ? "Cmd+Shift+W" : "Ctrl+Shift+W",
  };

  useEffect(() => {
    Promise.all([
      window.electronAPI?.configGet?.("norma:data-dir"),
      window.electronAPI?.getDefaultDataDir?.(),
    ])
      .then(([customDir, defaultDir]) => {
        setDataDir((customDir as string) || (defaultDir as string) || "未设置");
      })
      .catch(() => setDataDir("未设置"));
    window.electronAPI
      ?.shortcutsGet?.()
      .then(setShortcuts)
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!recordingKey) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const parts: string[] = [];
      if (e.ctrlKey) parts.push("Ctrl");
      if (e.altKey) parts.push("Alt");
      if (e.shiftKey) parts.push("Shift");
      if (e.metaKey) parts.push(isMac ? "Cmd" : "Meta");
      if (["Control", "Alt", "Shift", "Meta"].includes(e.key)) return;
      if (e.key === "Escape") {
        setRecordingKey(null);
        return;
      }
      if (e.key === " ") parts.push("Space");
      else parts.push(e.key.length === 1 ? e.key.toUpperCase() : e.key);
      const combo = parts.join("+");
      if (shortcuts) {
        const updated = { ...shortcuts, [recordingKey]: combo };
        window.electronAPI
          ?.shortcutsSet?.(updated)
          .then(() => setShortcuts(updated));
      }
      setRecordingKey(null);
    };
    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [recordingKey, shortcuts, isMac]);

  const handleChangeDir = async () => {
    const selected = await window.electronAPI?.selectDirectory?.();
    if (!selected) return;
    setDirError("");
    setMovingDir(true);
    try {
      const result = await window.electronAPI?.moveDataDir?.(selected);
      if (result?.success) {
        setDataDir(selected);
      } else {
        setDirError(result?.error || "移动数据失败");
      }
    } catch (e: any) {
      setDirError(e.message || "移动数据失败");
    }
    setMovingDir(false);
  };

  const resetShortcut = async (key: string) => {
    if (!shortcuts) return;
    const updated = {
      ...shortcuts,
      [key]: DEFAULTS[key as keyof typeof DEFAULTS],
    };
    await window.electronAPI?.shortcutsSet?.({
      [key]: DEFAULTS[key as keyof typeof DEFAULTS],
    });
    setShortcuts(updated);
  };

  const formatShortcut = (combo: string) => {
    return combo.split("+").map((part, i) => (
      <kbd
        key={i}
        className="px-1.5 py-0.5 rounded bg-white/[0.06] border border-white/[0.08] text-[12px] text-norma-text font-mono"
      >
        {part.trim()}
      </kbd>
    ));
  };

  const shortcutItems = [
    { key: "commandBar" as const, label: "唤出命令栏" },
    { key: "newSession" as const, label: "新建会话" },
    { key: "hideWindow" as const, label: "显示/隐藏窗口" },
  ];

  return (
    <div className="px-5 py-4">
      <div className="space-y-5 max-w-[400px]">
        <section>
          <h3 className="text-[13px] font-semibold text-norma-text mb-2 flex items-center gap-1.5">
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="text-norma-accent"
            >
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
              {
                id: "dark",
                label: "暗色",
                icon: (
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                  </svg>
                ),
              },
              {
                id: "light",
                label: "亮色",
                icon: (
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <circle cx="12" cy="12" r="5" />
                    <line x1="12" y1="1" x2="12" y2="3" />
                    <line x1="12" y1="21" x2="12" y2="23" />
                    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                    <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                    <line x1="1" y1="12" x2="3" y2="12" />
                    <line x1="21" y1="12" x2="23" y2="12" />
                    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                    <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
                  </svg>
                ),
              },
              {
                id: "system",
                label: "跟随系统",
                icon: (
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <rect x="2" y="3" width="20" height="14" rx="2" />
                    <line x1="8" y1="21" x2="16" y2="21" />
                    <line x1="12" y1="17" x2="12" y2="21" />
                  </svg>
                ),
              },
            ].map((t) => (
              <button
                key={t.id}
                onClick={() => setTheme(t.id)}
                className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-[13px] transition-colors ${theme === t.id ? "bg-norma-accent/20 border border-norma-accent/50 text-norma-accent" : "bg-white/[0.04] border border-white/[0.06] text-norma-textMuted hover:border-white/[0.1]"}`}
              >
                {t.icon}
                {t.label}
              </button>
            ))}
          </div>
        </section>
        <section>
          <h3 className="text-[13px] font-semibold text-norma-text mb-2 flex items-center gap-1.5">
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="text-norma-accent"
            >
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
            </svg>
            数据目录
          </h3>
          <div className="flex items-center gap-2 rounded-lg bg-white/[0.03] border border-white/[0.06] px-3 py-2">
            <div className="flex-1 text-[12px] text-norma-textMuted font-mono truncate break-all min-w-0">
              {dataDir}
            </div>
            <button
              onClick={handleChangeDir}
              disabled={movingDir}
              className="px-3 py-1 rounded-lg bg-white/[0.06] border border-white/[0.08] text-norma-textMuted text-[12px] hover:bg-white/[0.1] hover:text-norma-text transition-colors disabled:opacity-40 flex-none"
            >
              {movingDir ? "移动中..." : "修改"}
            </button>
            {dirError && (
              <span className="text-[11px] text-red-400 flex-none">
                {dirError}
              </span>
            )}
          </div>
        </section>
        <section>
          <h3 className="text-[13px] font-semibold text-norma-text mb-2 flex items-center gap-1.5">
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="text-norma-accent"
            >
              <path d="M10 8V6a2 2 0 0 0-2-2" />
              <path d="M14 8V6a2 2 0 0 1 2-2" />
              <path d="M12 2a2 2 0 0 0-2 2v2" />
              <rect width="16" height="12" x="4" y="8" rx="2" />
            </svg>
            快捷键
          </h3>
          <div className="space-y-2">
            {shortcutItems.map((item) => (
              <div
                key={item.key}
                className="flex items-center gap-3 rounded-lg bg-white/[0.03] border border-white/[0.06] px-3 py-2"
              >
                <span className="text-[12px] text-norma-textMuted flex-1">
                  {item.label}
                </span>
                <button
                  onClick={() => setRecordingKey(item.key)}
                  className={`flex items-center gap-1 min-w-[80px] justify-center px-2 py-1 rounded-lg transition-colors ${
                    recordingKey === item.key
                      ? "ring-1 ring-norma-accent/50 bg-norma-accent/10"
                      : "hover:bg-white/[0.04]"
                  }`}
                >
                  {recordingKey === item.key ? (
                    <span className="text-[12px] text-norma-accent animate-pulse">
                      按下快捷键...
                    </span>
                  ) : shortcuts ? (
                    formatShortcut(shortcuts[item.key])
                  ) : null}
                </button>
                <button
                  onClick={() => resetShortcut(item.key)}
                  className="p-1 rounded hover:bg-white/[0.08] text-norma-textDim hover:text-norma-text transition-colors"
                  title="重置为默认"
                >
                  <svg
                    width="10"
                    height="10"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                    <path d="M3 3v5h5" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
};

const AboutTab: React.FC = () => {
  const [versionInfo, setVersionInfo] = useState<{
    version: string;
    electron: string;
    node: string;
    chrome: string;
  } | null>(null);

  useEffect(() => {
    window.electronAPI
      ?.getSystemVersion?.()
      .then(setVersionInfo)
      .catch(() => {});
  }, []);

  return (
    <div className="px-5 py-6 flex flex-col items-center">
      <div className="max-w-[300px] w-full text-center">
        <div className="mb-4">
          <img
            src="./logo.png"
            alt="Norma"
            width="120"
            height="120"
            className="mx-auto rounded-xl"
            style={{ imageRendering: "auto" }}
          />
        </div>
        <div className="text-[20px] font-semibold text-norma-text mb-0.5">
          Norma
        </div>
        <div className="text-[13px] text-norma-textDim font-mono">
          v{versionInfo?.version ?? "—"}
        </div>
        <div className="hairline my-5" />

        <div className="text-left mb-1">
          <button
            onClick={() =>
              window.electronAPI?.openExternal?.("https://github.com/skye-z")
            }
            className="w-full rounded-xl bg-white/[0.03] border border-white/[0.06] px-4 py-3 mb-2 text-left hover:bg-white/[0.06] transition-colors"
          >
            <div className="flex items-center gap-2.5">
              <span className="text-[15px]">🧑‍💻</span>
              <div>
                <div className="text-[13px] text-norma-text">Skye</div>
                <div className="text-[11px] text-norma-textDim">
                  github.com/skye-z
                </div>
              </div>
            </div>
          </button>
          <button
            onClick={() =>
              window.electronAPI?.openExternal?.("https://betax.dev/")
            }
            className="w-full rounded-xl bg-white/[0.03] border border-white/[0.06] px-4 py-3 text-left hover:bg-white/[0.06] transition-colors"
          >
            <div className="flex items-center gap-2.5">
              <span className="text-[15px]">🏢</span>
              <div>
                <div className="text-[13px] text-norma-text">
                  BetaX Dev Team
                </div>
                <div className="text-[11px] text-norma-textDim">betax.dev</div>
              </div>
            </div>
          </button>
        </div>

        <div className="hairline my-4" />

        <div className="flex items-center justify-center gap-2 flex-wrap">
          <span className="text-[11px] text-norma-textDim font-mono">
            Electron {versionInfo?.electron ?? "—"}
          </span>
          <span className="text-[11px] text-norma-textDim opacity-40">│</span>
          <span className="text-[11px] text-norma-textDim font-mono">
            Node {versionInfo?.node ?? "—"}
          </span>
          <span className="text-[11px] text-norma-textDim opacity-40">│</span>
          <span className="text-[11px] text-norma-textDim font-mono">
            Chrome {versionInfo?.chrome ?? "—"}
          </span>
          <span className="text-[11px] text-norma-textDim opacity-40">│</span>
          <span className="text-[11px] text-norma-textDim font-mono">
            Mastra 1.35
          </span>
        </div>

        <div className="text-[11px] text-norma-textDim mt-3">
          © 2024-2026 Skye & BetaX
        </div>
      </div>
    </div>
  );
};

interface MemoryConfig {
  lastMessages: number;
  semanticRecall: boolean;
  semanticTopK: number;
  semanticMessageRange: number;
  workingMemory: boolean;
  generateTitle: boolean;
  compressAlgorithm: "sliding" | "observational" | "hybrid";
  compressThreshold: number;
  systemPrompt: string;
  maxSteps: number;
  temperature: number;
  knowledgeAutoRetrieve: boolean;
  knowledgeTopK: number;
  knowledgeScoreThreshold: number;
}

const DEFAULT_MEMORY_CONFIG: MemoryConfig = {
  lastMessages: 20,
  semanticRecall: true,
  semanticTopK: 3,
  semanticMessageRange: 2,
  workingMemory: true,
  generateTitle: true,
  compressThreshold: 80,
  compressAlgorithm: "sliding",
  systemPrompt: "",
  maxSteps: 20,
  temperature: 0.7,
  knowledgeAutoRetrieve: true,
  knowledgeTopK: 5,
  knowledgeScoreThreshold: 0.5,
};

const Toggle: React.FC<{
  value: boolean;
  onChange: (v: boolean) => void;
}> = ({ value, onChange }) => (
  <button
    onClick={() => onChange(!value)}
    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors flex-none ${value ? "bg-norma-accent" : "bg-white/[0.12]"}`}
  >
    <span
      className={`inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform ${value ? "translate-x-[16px]" : "translate-x-[2px]"}`}
    />
  </button>
);

const ContextTab: React.FC = () => {
  const [config, setConfig] = useState<MemoryConfig>({
    ...DEFAULT_MEMORY_CONFIG,
  });

  useEffect(() => {
    window.electronAPI
      ?.getMemoryConfig?.()
      .then((c) => {
        if (c) setConfig({ ...DEFAULT_MEMORY_CONFIG, ...c });
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      window.electronAPI?.setMemoryConfig?.(config).catch(() => {});
    }, 500);
    return () => clearTimeout(timer);
  }, [config]);

  const updateConfig = (patch: Partial<MemoryConfig>) => {
    setConfig((prev) => ({ ...prev, ...patch }));
  };

  return (
    <div className="px-5 py-4">
      <div className="space-y-5 max-w-[400px]">
        <section>
          <h3 className="text-[13px] font-semibold text-norma-text mb-2 flex items-center gap-1.5">
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="text-norma-accent"
            >
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            上下文窗口
          </h3>
          <div className="rounded-lg bg-white/[0.03] border border-white/[0.06] px-3 py-2 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[12px] text-norma-textMuted">
                  最近消息数
                </div>
                <div className="text-[11px] text-norma-textDim">
                  每次对话保留的最近消息数
                </div>
              </div>
              <input
                type="number"
                min={5}
                max={100}
                value={config.lastMessages}
                onChange={(e) =>
                  updateConfig({
                    lastMessages: Math.min(
                      100,
                      Math.max(5, parseInt(e.target.value) || 5),
                    ),
                  })
                }
                className="w-[60px] bg-white/[0.04] border border-white/[0.06] rounded px-2 py-1 text-[13px] text-norma-text text-center font-mono outline-none focus:border-norma-accent/40"
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[12px] text-norma-textMuted">
                  最大工具调用步数
                </div>
                <div className="text-[11px] text-norma-textDim">
                  单次对话中最多执行的自动工具调用轮数
                </div>
              </div>
              <input
                type="number"
                min={1}
                max={50}
                value={config.maxSteps}
                onChange={(e) =>
                  updateConfig({
                    maxSteps: Math.min(
                      50,
                      Math.max(1, parseInt(e.target.value) || 20),
                    ),
                  })
                }
                className="w-[60px] bg-white/[0.04] border border-white/[0.06] rounded px-2 py-1 text-[13px] text-norma-text text-center font-mono outline-none focus:border-norma-accent/40"
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[12px] text-norma-textMuted">温度</div>
                <div className="text-[11px] text-norma-textDim">
                  控制回复的随机性，越高越有创意
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={Math.round(config.temperature * 100)}
                  onChange={(e) =>
                    updateConfig({
                      temperature: parseInt(e.target.value) / 100,
                    })
                  }
                  className="w-[80px] accent-norma-accent"
                />
                <span className="text-[13px] text-norma-text font-mono w-[32px] text-right">
                  {config.temperature.toFixed(2)}
                </span>
              </div>
            </div>
          </div>
        </section>

        <section>
          <h3 className="text-[13px] font-semibold text-norma-text mb-2 flex items-center gap-1.5">
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="text-norma-accent"
            >
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.3-4.3" />
            </svg>
            语义召回
          </h3>
          <div className="rounded-lg bg-white/[0.03] border border-white/[0.06] px-3 py-2 space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-[12px] text-norma-textMuted">
                启用语义召回
              </div>
              <Toggle
                value={config.semanticRecall}
                onChange={(v) => updateConfig({ semanticRecall: v })}
              />
            </div>
            {config.semanticRecall && (
              <div className="space-y-2 pl-2 border-l border-white/[0.06]">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-[12px] text-norma-textMuted">
                      Top K
                    </div>
                    <div className="text-[11px] text-norma-textDim">
                      检索最相似的 K 条消息
                    </div>
                  </div>
                  <input
                    type="number"
                    min={1}
                    max={10}
                    value={config.semanticTopK}
                    onChange={(e) =>
                      updateConfig({
                        semanticTopK: Math.min(
                          10,
                          Math.max(1, parseInt(e.target.value) || 1),
                        ),
                      })
                    }
                    className="w-[50px] bg-white/[0.04] border border-white/[0.06] rounded px-2 py-1 text-[13px] text-norma-text text-center font-mono outline-none focus:border-norma-accent/40"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-[12px] text-norma-textMuted">
                      消息范围
                    </div>
                    <div className="text-[11px] text-norma-textDim">
                      每条匹配消息前后的上下文范围
                    </div>
                  </div>
                  <input
                    type="number"
                    min={1}
                    max={5}
                    value={config.semanticMessageRange}
                    onChange={(e) =>
                      updateConfig({
                        semanticMessageRange: Math.min(
                          5,
                          Math.max(1, parseInt(e.target.value) || 1),
                        ),
                      })
                    }
                    className="w-[50px] bg-white/[0.04] border border-white/[0.06] rounded px-2 py-1 text-[13px] text-norma-text text-center font-mono outline-none focus:border-norma-accent/40"
                  />
                </div>
              </div>
            )}
          </div>
        </section>

        <section>
          <h3 className="text-[13px] font-semibold text-norma-text mb-2 flex items-center gap-1.5">
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="text-norma-accent"
            >
              <path d="M12 2a8 8 0 0 0-8 8c0 6 8 12 8 12s8-6 8-12a8 8 0 0 0-8-8z" />
              <circle cx="12" cy="10" r="3" />
            </svg>
            工作记忆
          </h3>
          <div className="rounded-lg bg-white/[0.03] border border-white/[0.06] px-3 py-2">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[12px] text-norma-textMuted">
                  启用工作记忆
                </div>
                <div className="text-[11px] text-norma-textDim">
                  Norma 自动记住你的偏好和习惯
                </div>
              </div>
              <Toggle
                value={config.workingMemory}
                onChange={(v) => updateConfig({ workingMemory: v })}
              />
            </div>
          </div>
        </section>

        <section>
          <h3 className="text-[13px] font-semibold text-norma-text mb-2 flex items-center gap-1.5">
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="text-norma-accent"
            >
              <path d="M4 7V4h16v3" />
              <path d="M9 20h6" />
              <path d="M12 4v16" />
            </svg>
            自动生成标题
          </h3>
          <div className="rounded-lg bg-white/[0.03] border border-white/[0.06] px-3 py-2">
            <div className="flex items-center justify-between">
              <div className="text-[12px] text-norma-textMuted">
                根据对话内容自动生成会话标题
              </div>
              <Toggle
                value={config.generateTitle}
                onChange={(v) => updateConfig({ generateTitle: v })}
              />
            </div>
          </div>
        </section>

        <section>
          <h3 className="text-[13px] font-semibold text-norma-text mb-2 flex items-center gap-1.5">
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="text-norma-accent"
            >
              <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
              <path d="M3 3v5h5" />
              <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
              <path d="M21 21v-5h-5" />
            </svg>
            上下文自动压缩
          </h3>
          <div className="rounded-lg bg-white/[0.03] border border-white/[0.06] px-3 py-2 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[12px] text-norma-textMuted">压缩算法</div>
                <div className="text-[11px] text-norma-textDim">
                  上下文接近模型窗口限制时自动压缩历史消息
                </div>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              {(
                [
                  { id: "sliding", label: "滑动窗口", desc: "保留最近N条消息" },
                  {
                    id: "observational",
                    label: "观察摘要",
                    desc: "LLM自动提取关键信息",
                  },
                  { id: "hybrid", label: "混合模式", desc: "滑动+摘要双保险" },
                ] as const
              ).map((algo) => (
                <button
                  key={algo.id}
                  onClick={() => updateConfig({ compressAlgorithm: algo.id })}
                  className={`px-2 py-1.5 rounded-lg text-[12px] text-left transition-colors ${
                    config.compressAlgorithm === algo.id
                      ? "bg-norma-accent/20 border border-norma-accent/40 text-norma-accent"
                      : "bg-white/[0.03] border border-white/[0.06] text-norma-textMuted hover:border-white/[0.1]"
                  }`}
                >
                  <div className="font-medium">{algo.label}</div>
                  <div className="text-[10px] text-norma-textDim mt-0.5 leading-tight">
                    {algo.desc}
                  </div>
                </button>
              ))}
            </div>
            <div className="flex items-center justify-between pt-1">
              <div>
                <div className="text-[12px] text-norma-textMuted">
                  压缩触发阈值
                </div>
                <div className="text-[11px] text-norma-textDim">
                  上下文使用量超过此比例时触发
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min={50}
                  max={95}
                  value={config.compressThreshold}
                  onChange={(e) =>
                    updateConfig({
                      compressThreshold: parseInt(e.target.value),
                    })
                  }
                  className="w-[80px] accent-norma-accent"
                />
                <span className="text-[13px] text-norma-text font-mono w-[32px] text-right">
                  {config.compressThreshold}%
                </span>
              </div>
            </div>
          </div>
        </section>

        <section>
          <h3 className="text-[13px] font-semibold text-norma-text mb-2 flex items-center gap-1.5">
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="text-norma-accent"
            >
              <path d="M12 20h9" />
              <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
            </svg>
            自定义系统提示
          </h3>
          <div className="rounded-lg bg-white/[0.03] border border-white/[0.06] px-3 py-2">
            <textarea
              value={config.systemPrompt}
              onChange={(e) => updateConfig({ systemPrompt: e.target.value })}
              placeholder="添加自定义指令来定制 Norma 的行为..."
              rows={4}
              className="w-full bg-white/[0.02] border border-white/[0.04] rounded-lg px-3 py-2 text-[13px] text-norma-text placeholder-norma-textDim outline-none focus:border-norma-accent/40 resize-none leading-relaxed"
            />
          </div>
        </section>
      </div>
    </div>
  );
};

interface KnowledgeSettings {
  enabled: boolean;
  embeddingMode: "remote" | "local";
  chunkSize: number;
  chunkOverlap: number;
  autoRetrieve: boolean;
  retrievalTopK: number;
  scoreThreshold: number;
}

const DEFAULT_KNOWLEDGE_SETTINGS: KnowledgeSettings = {
  enabled: true,
  embeddingMode: "remote",
  chunkSize: 512,
  chunkOverlap: 50,
  autoRetrieve: true,
  retrievalTopK: 5,
  scoreThreshold: 0.5,
};

const KnowledgeSettingsTab: React.FC = () => {
  const [settings, setSettings, loaded] = useDbState<KnowledgeSettings>(
    "norma-knowledge-settings",
    DEFAULT_KNOWLEDGE_SETTINGS,
  );
  const [stats, setStats] = useState<{
    docCount: number;
    chunkCount: number;
  } | null>(null);
  const [modelStatus, setModelStatus] = useState<{
    ready: boolean;
    downloading: boolean;
    progress: number;
    modelPath: string;
  } | null>(null);
  const [modelLoading, setModelLoading] = useState(false);
  const [downloadStatus, setDownloadStatus] = useState<string>("");

  useEffect(() => {
    window.electronAPI
      ?.knowledgeList?.()
      .then((res) => {
        if (res?.success) {
          const docs = res.documents || [];
          setStats({
            docCount: docs.length,
            chunkCount: docs.reduce((s, d) => s + d.chunkCount, 0),
          });
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (settings.enabled && settings.embeddingMode === "local") {
      window.electronAPI?.knowledgeSetMode?.("local");
    }
  }, [settings.embeddingMode, settings.enabled]);

  useEffect(() => {
    window.electronAPI
      ?.knowledgeModelStatus?.()
      .then((s) => {
        setModelStatus(s);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!window.electronAPI?.onKnowledgeDownloadProgress) return;
    return window.electronAPI.onKnowledgeDownloadProgress(
      (progress, status) => {
        setModelStatus((prev) =>
          prev
            ? {
                ...prev,
                progress,
                downloading:
                  progress < 100 && status !== "error" && status !== "timeout",
              }
            : prev,
        );
        setDownloadStatus(status);
        if (progress >= 100) {
          setModelLoading(false);
          window.electronAPI
            ?.knowledgeModelStatus?.()
            .then((s) => setModelStatus(s))
            .catch(() => {});
        }
        if (status === "error" || status === "timeout") {
          setModelLoading(false);
          setModelStatus((prev) =>
            prev ? { ...prev, ready: false, downloading: false } : prev,
          );
        }
      },
    );
  }, []);

  const updateSettings = (patch: Partial<KnowledgeSettings>) => {
    setSettings((prev) => ({ ...prev, ...patch }));
  };

  const handleDownloadModel = async () => {
    setModelLoading(true);
    setDownloadStatus("connecting");
    setModelStatus((prev) =>
      prev
        ? { ...prev, progress: 0, downloading: true, ready: false }
        : { ready: false, downloading: true, progress: 0, modelPath: "" },
    );
    try {
      await window.electronAPI?.knowledgeLoadModel?.();
    } catch (err: any) {
      alert(`模型加载失败: ${err?.message || err}`);
      setModelLoading(false);
      setModelStatus((prev) => (prev ? { ...prev, downloading: false } : prev));
    }
  };

  const handleDeleteModel = async () => {
    await window.electronAPI?.knowledgeDeleteModel?.();
    setModelStatus((prev) =>
      prev ? { ...prev, ready: false, progress: 0 } : null,
    );
  };

  if (!loaded) {
    return (
      <div className="flex h-full min-h-0 items-center justify-center">
        <div className="w-5 h-5 border-2 border-norma-accent/30 border-t-norma-accent rounded-full animate-spin" />
      </div>
    );
  }

  const isLocal = settings.embeddingMode === "local";
  const isModelReady = modelStatus?.ready;
  const isModelDownloading = modelStatus?.downloading;

  return (
    <div className="px-5 py-4">
      <div className="space-y-5 max-w-[400px]">
        {settings.enabled && (
          <>
            <section>
              <h3 className="text-[13px] font-semibold text-norma-text mb-2 flex items-center gap-1.5">
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className="text-norma-accent"
                >
                  <path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2Z" />
                  <path d="m8 12 3 3 5-5" />
                </svg>
                向量嵌入
              </h3>
              <div className="rounded-lg bg-white/[0.03] border border-white/[0.06] px-3 py-2 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-[12px] text-norma-textMuted">
                      嵌入模式
                    </div>
                    <div className="text-[11px] text-norma-textDim">
                      {isLocal
                        ? "使用本地模型，无需网络"
                        : "使用当前模型供应商的 Embedding API"}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 bg-white/[0.04] rounded-lg p-0.5">
                    <button
                      onClick={() =>
                        updateSettings({ embeddingMode: "remote" })
                      }
                      className={`px-2.5 py-1 rounded-md text-[12px] transition-colors ${
                        !isLocal
                          ? "bg-norma-accent/20 text-norma-accent border border-norma-accent/30"
                          : "text-norma-textDim hover:text-norma-textMuted"
                      }`}
                    >
                      在线
                    </button>
                    <button
                      onClick={() => updateSettings({ embeddingMode: "local" })}
                      className={`px-2.5 py-1 rounded-md text-[12px] transition-colors ${
                        isLocal
                          ? "bg-norma-accent/20 text-norma-accent border border-norma-accent/30"
                          : "text-norma-textDim hover:text-norma-textMuted"
                      }`}
                    >
                      离线
                    </button>
                  </div>
                </div>

                {!isLocal && (
                  <div className="text-[11px] text-norma-textDim bg-white/[0.02] rounded px-2 py-1.5 leading-relaxed">
                    使用当前模型供应商的 Embedding API，请确保已配置支持
                    Embedding 的供应商（如 OpenAI、OpenRouter）。
                  </div>
                )}

                {isLocal && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-[12px] text-norma-textMuted">
                          {isModelReady
                            ? "模型已就绪"
                            : isModelDownloading || modelLoading
                              ? `下载中 ${modelStatus?.progress || 0}%`
                              : "本地嵌入模型"}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {isModelReady && (
                          <button
                            onClick={handleDeleteModel}
                            className="px-2 py-0.5 rounded text-[11px] text-norma-textDim hover:text-red-400 hover:bg-red-500/10 transition-colors"
                          >
                            删除
                          </button>
                        )}
                        {!isModelReady &&
                          !isModelDownloading &&
                          !modelLoading && (
                            <button
                              onClick={handleDownloadModel}
                              className="px-3 py-1 rounded-lg bg-norma-accent text-white text-[12px] hover:opacity-90"
                            >
                              {downloadStatus === "timeout" ||
                              downloadStatus === "error"
                                ? "重试"
                                : "下载模型"}
                            </button>
                          )}
                      </div>
                    </div>
                    {(isModelDownloading || modelLoading) && (
                      <div className="space-y-1">
                        <div className="w-full bg-white/[0.06] rounded-full h-2 overflow-hidden">
                          <div
                            className="bg-norma-accent h-full rounded-full transition-all duration-300 ease-out"
                            style={{ width: `${modelStatus?.progress || 0}%` }}
                          />
                        </div>
                        {downloadStatus && (
                          <div className="text-[10px] text-norma-textDim truncate">
                            {downloadStatus}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </section>

            <section>
              <h3 className="text-[13px] font-semibold text-norma-text mb-2 flex items-center gap-1.5">
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className="text-norma-accent"
                >
                  <path d="M4 7V4h16v3" />
                  <path d="M9 20h6" />
                  <path d="M12 4v16" />
                </svg>
                文档分块
              </h3>
              <div className="rounded-lg bg-white/[0.03] border border-white/[0.06] px-3 py-2 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-[12px] text-norma-textMuted">
                      分块大小
                    </div>
                    <div className="text-[11px] text-norma-textDim">
                      每个文本块的最大 token 数
                    </div>
                  </div>
                  <input
                    type="number"
                    min={128}
                    max={2048}
                    step={64}
                    value={settings.chunkSize}
                    onChange={(e) =>
                      updateSettings({
                        chunkSize: Math.min(
                          2048,
                          Math.max(128, parseInt(e.target.value) || 512),
                        ),
                      })
                    }
                    className="w-[70px] bg-white/[0.04] border border-white/[0.06] rounded px-2 py-1 text-[13px] text-norma-text text-center font-mono outline-none focus:border-norma-accent/40"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-[12px] text-norma-textMuted">
                      分块重叠
                    </div>
                    <div className="text-[11px] text-norma-textDim">
                      相邻分块之间的重叠 token 数
                    </div>
                  </div>
                  <input
                    type="number"
                    min={0}
                    max={200}
                    step={10}
                    value={settings.chunkOverlap}
                    onChange={(e) =>
                      updateSettings({
                        chunkOverlap: Math.min(
                          200,
                          Math.max(0, parseInt(e.target.value) || 50),
                        ),
                      })
                    }
                    className="w-[70px] bg-white/[0.04] border border-white/[0.06] rounded px-2 py-1 text-[13px] text-norma-text text-center font-mono outline-none focus:border-norma-accent/40"
                  />
                </div>
              </div>
            </section>

            <section>
              <h3 className="text-[13px] font-semibold text-norma-text mb-2 flex items-center gap-1.5">
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className="text-norma-accent"
                >
                  <circle cx="11" cy="11" r="8" />
                  <path d="m21 21-4.3-4.3" />
                </svg>
                检索设置
              </h3>
              <div className="rounded-lg bg-white/[0.03] border border-white/[0.06] px-3 py-2 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-[12px] text-norma-textMuted">
                      对话时自动检索
                    </div>
                    <div className="text-[11px] text-norma-textDim">
                      在对话中自动从知识库检索相关内容注入上下文
                    </div>
                  </div>
                  <Toggle
                    value={settings.autoRetrieve}
                    onChange={(v) => updateSettings({ autoRetrieve: v })}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-[12px] text-norma-textMuted">
                      检索数量 (Top K)
                    </div>
                    <div className="text-[11px] text-norma-textDim">
                      每次检索返回的最大结果数
                    </div>
                  </div>
                  <input
                    type="number"
                    min={1}
                    max={20}
                    value={settings.retrievalTopK}
                    onChange={(e) =>
                      updateSettings({
                        retrievalTopK: Math.min(
                          20,
                          Math.max(1, parseInt(e.target.value) || 5),
                        ),
                      })
                    }
                    className="w-[60px] bg-white/[0.04] border border-white/[0.06] rounded px-2 py-1 text-[13px] text-norma-text text-center font-mono outline-none focus:border-norma-accent/40"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-[12px] text-norma-textMuted">
                      相似度阈值
                    </div>
                    <div className="text-[11px] text-norma-textDim">
                      低于此阈值的结果将被过滤
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={Math.round(settings.scoreThreshold * 100)}
                      onChange={(e) =>
                        updateSettings({
                          scoreThreshold: parseInt(e.target.value) / 100,
                        })
                      }
                      className="w-[80px] accent-norma-accent"
                    />
                    <span className="text-[13px] text-norma-text font-mono w-[32px] text-right">
                      {settings.scoreThreshold.toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
};

const DiagTab: React.FC = () => {
  const [enabled, setEnabled] = useState(false);
  const [logs, setLogs] = useState<
    Array<{ ts: string; level: string; source: string; message: string }>
  >([]);
  const bottomRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    (window as any).electronAPI
      ?.diagGetLoggingState?.()
      .then((s: any) => setEnabled(s?.enabled ?? false))
      .catch(() => {});
  }, []);

  useEffect(() => {
    (window as any).electronAPI
      ?.diagGetLogs?.()
      .then((l: any) => setLogs(l || []))
      .catch(() => {});
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    (window as any).electronAPI?.diagSubscribe?.().catch(() => {});
    const unsub = (window as any).electronAPI?.onMessage?.(
      "diag:logEntry",
      (raw: string) => {
        try {
          const entry = JSON.parse(raw);
          setLogs((prev) => [...prev, entry].slice(-2000));
        } catch {}
      },
    );
    return () => {
      unsub?.();
      (window as any).electronAPI?.diagUnsubscribe?.().catch(() => {});
    };
  }, [enabled]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
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
    if (level === "error") return "text-red-400";
    if (level === "warn") return "text-amber-400";
    return "text-norma-textDim";
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-none flex items-center gap-3 px-5 py-3 border-b border-white/[0.06]">
        <button
          onClick={toggleLogging}
          className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${enabled ? "bg-emerald-500" : "bg-white/[0.12]"}`}
        >
          <span
            className={`inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform ${enabled ? "translate-x-[16px]" : "translate-x-[2px]"}`}
          />
        </button>
        <span className="text-[13px] text-norma-text">
          {enabled ? "日志记录中" : "日志已关闭"}
        </span>
        <span className="text-[11px] text-norma-textDim">
          {logs.length} 条记录
        </span>
        <button
          onClick={clearLogs}
          disabled={logs.length === 0}
          className="ml-auto px-2.5 py-1 rounded-lg bg-white/[0.06] text-norma-textMuted text-[12px] hover:bg-white/[0.1] disabled:opacity-30 transition-colors"
        >
          清除
        </button>
      </div>
      <div className="flex-1 overflow-y-auto scrollbar-show px-5 py-2 font-mono text-[12px] min-h-0">
        {logs.length === 0 ? (
          <div className="text-norma-textDim text-center py-8">
            {enabled ? "等待日志..." : "打开日志开关后操作应用，日志会自动记录"}
          </div>
        ) : (
          <div className="space-y-0.5">
            {logs.map((log, i) => (
              <div key={i} className="flex items-start gap-2 py-0.5">
                <span className="text-norma-textDim flex-none opacity-60">
                  {new Date(log.ts).toLocaleTimeString("zh-CN", {
                    hour12: false,
                  })}
                </span>
                <span
                  className={`flex-none w-[38px] uppercase text-[11px] font-bold ${levelColor(log.level)}`}
                >
                  {log.level}
                </span>
                <span className="text-norma-accent flex-none w-[50px] truncate">
                  {log.source}
                </span>
                <span className="text-norma-text/80 break-all">
                  {log.message}
                </span>
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
    { id: "context", label: "上下文" },
    { id: "knowledge", label: "知识库" },
    { id: "model", label: "模型" },
    { id: "diag", label: "诊断" },
    { id: "about", label: "关于" },
  ];

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      <div className="flex-none flex items-center gap-1 px-5 pt-3 pb-2 border-b border-white/[0.06] flex-wrap">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-3 py-1.5 rounded-lg text-[13px] transition-colors ${
              activeTab === tab.id
                ? "bg-norma-accent/20 text-norma-accent"
                : "text-norma-textMuted hover:text-norma-text hover:bg-white/[0.04]"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-y-auto scrollbar-show">
        {activeTab === "basic" && (
          <BasicTab theme={theme} setTheme={setTheme} isMac={isMac} />
        )}
        {activeTab === "context" && <ContextTab />}
        {activeTab === "knowledge" && <KnowledgeSettingsTab />}
        {activeTab === "model" && <ModelTab />}
        {activeTab === "diag" && <DiagTab />}
        {activeTab === "about" && <AboutTab />}
      </div>
    </div>
  );
};

export { SettingsPage };
