import React, { useState, useEffect } from "react";
import { PROVIDER_COLORS } from "../../lib/shared";

interface EnabledModel {
  providerId: string;
  modelId: string;
}

interface SavedProviderFull {
  id: string;
  presetId: string;
  name: string;
  type: string;
  baseUrl: string;
  apiKey: string;
}

const fmtCtx = (tokens: number) => {
  if (tokens <= 0) return '';
  if (tokens >= 1048576) return `${Math.round(tokens / 1048576)}M`;
  if (tokens >= 1024) return `${Math.round(tokens / 1024)}K`;
  return String(tokens);
};

const MiniCapBadges: React.FC<{ modelId: string }> = ({ modelId }) => {
  const [caps, setCaps] = React.useState<{ vision: boolean; contextLength: number } | null>(null);
  React.useEffect(() => {
    window.electronAPI?.getCapabilitiesWithOverride?.(modelId).then((c: any) => {
      if (c) setCaps({ vision: c.vision, contextLength: c.contextLength });
    }).catch(() => {});
  }, [modelId]);
  if (!caps) return null;
  return (
    <span className="inline-flex items-center gap-0.5 flex-none">
      {caps.vision && (
        <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-violet-400" title="支持视觉">
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
        </svg>
      )}
      {caps.contextLength > 0 && (
        <span className="text-[7px] font-mono text-sky-400">{fmtCtx(caps.contextLength)}</span>
      )}
    </span>
  );
};

const ModelSelector: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [models, setModels] = useState<
    Array<{
      modelId: string;
      displayName: string;
      providerName: string;
      providerPreset: string;
      providerId: string;
    }>
  >([]);
  const [selectedIdx, setSelectedIdx] = useState(0);

  const buildModelString = (model: {
    modelId: string;
    providerPreset: string;
  }) => {
    const providerType =
      model.providerPreset === "custom" ? "openai" : model.providerPreset;
    return `${providerType}/${model.modelId}`;
  };

  useEffect(() => {
    (window as any).electronAPI
      ?.configGet?.("norma-providers")
      .then((providersRaw: any) => {
        const providers: SavedProviderFull[] = Array.isArray(providersRaw)
          ? providersRaw
          : [];
        return (window as any).electronAPI
          ?.configGet?.("norma-enabled-models")
          .then((enabledRaw: any) => {
            const enabled: EnabledModel[] = Array.isArray(enabledRaw)
              ? enabledRaw
              : [];
            if (providers.length === 0 || enabled.length === 0) return;

            (window as any).electronAPI
              ?.configGet?.("norma-cached-models")
              .then(async (cachedRaw: any) => {
                const cached: Record<string, any[]> =
                  cachedRaw && typeof cachedRaw === "object" ? cachedRaw : {};

                const result = await Promise.all(enabled.map(async (em) => {
                  const prov = providers.find((p) => p.id === em.providerId);
                  const modelCache = cached[em.providerId] || [];
                  const modelInfo = modelCache.find(
                    (m: any) => m.id === em.modelId,
                  );
                  let displayName = modelInfo?.display_name || modelInfo?.name || '';
                  if (!displayName) {
                    const ipcName = await window.electronAPI?.getModelDisplayName?.(em.modelId);
                    displayName = ipcName || em.modelId.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
                  }
                  return {
                    modelId: em.modelId,
                    displayName,
                    providerName: prov?.name || "未知",
                    providerPreset: prov?.presetId || "custom",
                    providerId: em.providerId,
                  };
                }));

                if (result.length > 0) setModels(result);
              });
          });
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (models.length === 0) return;
    (window as any).electronAPI
      ?.getActiveModel?.()
      .then((activeModel: string | null) => {
        if (activeModel) {
          const idx = models.findIndex(
            (m) => buildModelString(m) === activeModel,
          );
          if (idx >= 0) setSelectedIdx(idx);
        }
      });
  }, [models]);

  const handleSelect = (idx: number) => {
    setSelectedIdx(idx);
    setOpen(false);
    const model = models[idx];
    const modelString = buildModelString(model);
    (window as any).electronAPI
      ?.configGet?.("norma-providers")
      .then((providersRaw: any) => {
        const providers: SavedProviderFull[] = Array.isArray(providersRaw)
          ? providersRaw
          : [];
        const prov = providers.find((p) => p.id === model.providerId);
        if (prov) {
          (window as any).electronAPI?.setActiveModel?.(modelString, {
            providerType: prov.presetId === "custom" ? "openai" : prov.presetId,
            baseUrl: prov.baseUrl,
            apiKey: prov.apiKey,
          });
        } else {
          (window as any).electronAPI?.setActiveModel?.(modelString);
        }
      })
      .catch(() => {
        (window as any).electronAPI?.setActiveModel?.(modelString);
      });
  };

  if (models.length === 0) return null;

  const safeIdx = Math.min(selectedIdx, models.length - 1);
  const selected = models[safeIdx];

  return (
    <div className="relative flex-none">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] text-norma-textDim hover:text-norma-textMuted hover:bg-white/[0.06] transition-colors"
        title={`当前模型: ${selected.displayName}`}
      >
        <span
          className="w-1.5 h-1.5 rounded-full"
          style={{
            backgroundColor:
              PROVIDER_COLORS[selected.providerPreset] || "#8b8b8b",
          }}
        />
        <span className="max-w-[90px] truncate">{selected.displayName}</span>
        {models.length > 1 && (
          <svg
            width="8"
            height="8"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className={`transition-transform ${open ? "rotate-180" : ""}`}
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute bottom-full left-0 mb-2 w-56 rounded-xl bg-[#1a1a1f] border border-white/[0.08] shadow-2xl z-50 overflow-hidden">
            {models.map((model, idx) => (
              <button
                key={`${model.providerPreset}-${model.modelId}`}
                onClick={() => handleSelect(idx)}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-[11px] hover:bg-white/[0.06] transition-colors ${idx === selectedIdx ? "bg-white/[0.04]" : ""}`}
              >
                <span
                  className="w-2 h-2 rounded-full flex-none"
                  style={{
                    backgroundColor:
                      PROVIDER_COLORS[model.providerPreset] || "#8b8b8b",
                  }}
                />
                <div className="flex-1 text-left min-w-0">
                  <div className="flex items-center gap-1">
                    <span
                      className={`font-medium truncate ${idx === selectedIdx ? "text-norma-accent" : "text-norma-text"}`}
                    >
                      {model.displayName}
                    </span>
                    <MiniCapBadges modelId={model.modelId} />
                  </div>
                  <div className="text-[9px] text-norma-textDim truncate">
                    {model.providerName} · <span className="font-mono">{model.modelId}</span>
                  </div>
                </div>
                {idx === selectedIdx && (
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                    className="text-norma-accent flex-none"
                  >
                    <path d="M20 6 9 17l-5-5" />
                  </svg>
                )}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export { ModelSelector };
