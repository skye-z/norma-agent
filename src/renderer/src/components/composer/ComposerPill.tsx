import React, { useRef, useState, useCallback } from "react";
import { ComposerPrimitive, AuiIf, useThread, useThreadRuntime } from "@assistant-ui/react";
import { ComposerAttachmentItem, ContextRing, VoiceButton } from "./parts";
import { SlashCommandTrigger, MentionTrigger } from "./SlashCommandTrigger";
import { useMessageQueue } from "../../lib/queue";

const ComposerPill: React.FC = () => {
  const thread = useThread();
  const runtime = useThreadRuntime();
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const { enqueue } = useMessageQueue();
  const [inputValue, setInputValue] = useState("");

  const isRunning = thread.isRunning;
  const hasText = inputValue.trim().length > 0;

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      if (isRunning) {
        e.preventDefault();
        e.stopPropagation();
        const val = e.currentTarget.value.trim();
        if (val) {
          enqueue(val);
          setInputValue("");
          const ta = e.currentTarget;
          const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value")?.set;
          setter?.call(ta, "");
          ta.dispatchEvent(new Event("input", { bubbles: true }));
        }
      }
    }
  }, [isRunning, enqueue]);

  const handleEnqueueClick = useCallback(() => {
    const val = inputValue.trim();
    if (val) {
      enqueue(val);
      setInputValue("");
      if (inputRef.current) {
        const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value")?.set;
        setter?.call(inputRef.current, "");
        inputRef.current.dispatchEvent(new Event("input", { bubbles: true }));
      }
    }
  }, [inputValue, enqueue]);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputValue(e.target.value);
  }, []);

  return (
    <ComposerPrimitive.Root className="composer-pill flex-1 min-w-0">
      <ComposerPrimitive.AttachmentDropzone
        asChild
        className="transition-all duration-200"
      >
        <div className="flex flex-col">
          <ComposerPrimitive.Attachments className="flex flex-wrap gap-1.5">
            {() => <ComposerAttachmentItem />}
          </ComposerPrimitive.Attachments>

          <ComposerPrimitive.If dictation>
            <div className="flex items-center gap-2 px-1 py-1 text-[11px] text-norma-textMuted">
              <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse flex-none" />
              <ComposerPrimitive.DictationTranscript className="flex-1 text-norma-textDim italic" />
              <ComposerPrimitive.StopDictation className="text-norma-textDim hover:text-red-400 transition-colors cursor-pointer">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
                  <rect x="6" y="6" width="12" height="12" rx="2" />
                </svg>
              </ComposerPrimitive.StopDictation>
            </div>
          </ComposerPrimitive.If>

          <ComposerPrimitive.Unstable_TriggerPopoverRoot>
            <SlashCommandTrigger />
            <MentionTrigger />
            <div className="flex items-end gap-2 relative w-full">
              <div className="mb-[3px]">
                <ContextRing />
              </div>
              <ComposerPrimitive.Input
                ref={inputRef}
                onKeyDown={handleKeyDown}
                onChange={handleInputChange}
                placeholder="让 Norma 帮你做点什么...  输入 / 命令  @ 指定智能体"
                rows={1}
                disabled={false}
                autoFocus
                className="flex-1 min-w-0 break-words bg-transparent text-[12px] text-norma-text placeholder-norma-textMuted
                           outline-none resize-none leading-relaxed min-h-[20px] max-h-[120px] py-1"
              />

              <div className="mb-px">
                <VoiceButton />
              </div>

              {!isRunning && (
                <div className="mb-px">
                  <ComposerPrimitive.Send
                    className="flex-none p-1.5 rounded-full transition-all duration-200
                               bg-norma-accent text-white hover:opacity-90
                               disabled:bg-white/[0.05] disabled:text-norma-textDim disabled:cursor-not-allowed"
                    title="发送"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="m5 12 7-7 7 7" />
                      <path d="M12 19V5" />
                    </svg>
                  </ComposerPrimitive.Send>
                </div>
              )}

              {isRunning && !hasText && (
                <div className="mb-px">
                  <ComposerPrimitive.Cancel
                    className="flex-none p-1.5 rounded-full bg-white/[0.06] text-norma-textDim hover:bg-white/[0.12] hover:text-norma-text transition-all duration-200"
                    title="停止生成"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                      <rect x="6" y="6" width="12" height="12" rx="2" />
                    </svg>
                  </ComposerPrimitive.Cancel>
                </div>
              )}

              {isRunning && hasText && (
                <div className="flex gap-1 mb-px">
                  <button
                    onClick={handleEnqueueClick}
                    className="flex-none p-1.5 rounded-full bg-norma-accent text-white hover:opacity-90 transition-all duration-200"
                    title="插入排队"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 5v14M5 12h14" />
                    </svg>
                  </button>
                  <ComposerPrimitive.Cancel
                    className="flex-none p-1 rounded-full bg-white/[0.06] text-norma-textDim hover:bg-white/[0.12] hover:text-norma-text transition-all duration-200"
                    title="停止生成"
                  >
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
                      <rect x="6" y="6" width="12" height="12" rx="2" />
                    </svg>
                  </ComposerPrimitive.Cancel>
                </div>
              )}
            </div>
          </ComposerPrimitive.Unstable_TriggerPopoverRoot>
        </div>
      </ComposerPrimitive.AttachmentDropzone>
    </ComposerPrimitive.Root>
  );
};

export { ComposerPill };
