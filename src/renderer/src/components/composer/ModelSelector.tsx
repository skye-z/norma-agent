import React, { useState } from "react";
import { MODELS } from "../../lib/shared";

const ModelSelector: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState(MODELS[0]);
  return (
    <div className="relative flex-none">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1 px-2 py-1 rounded-full text-[10px] text-norma-textDim hover:text-norma-textMuted hover:bg-white/[0.06] transition-colors"
        title="选择模型"
      >
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
        <span>{selected.name}</span>
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
      </button>
      {open && (
        <div className="glass-popover absolute bottom-full left-0 mb-2 w-44 overflow-hidden">
          {MODELS.map((model) => (
            <button
              key={model.id}
              onClick={() => {
                setSelected(model);
                setOpen(false);
              }}
              className={`w-full flex items-center gap-2 px-3 py-2 text-[11px] hover:bg-white/[0.08] transition-colors ${selected.id === model.id ? "text-norma-accent" : "text-norma-textMuted"}`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              <div className="flex-1 text-left">
                <div>{model.name}</div>
                <div className="text-[9px] text-norma-textDim">
                  {model.desc}
                </div>
              </div>
              {selected.id === model.id && (
                <svg
                  width="10"
                  height="10"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3"
                >
                  <path d="M20 6 9 17l-5-5" />
                </svg>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export { ModelSelector };
