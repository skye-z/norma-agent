import React from "react";
import { ComposerPrimitive, AuiIf } from "@assistant-ui/react";
import { ComposerAttachmentItem, ContextRing, VoiceButton } from "./parts";
import { SlashCommandTrigger, MentionTrigger } from "./SlashCommandTrigger";

const ComposerPill: React.FC = () => {
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
                <svg
                  width="10"
                  height="10"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
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
                placeholder="让 Norma 帮你做点什么...  输入 / 命令  @ 指定智能体"
                rows={1}
                className="flex-1 min-w-0 break-words bg-transparent text-[12px] text-norma-text placeholder-norma-textMuted
                           outline-none resize-none leading-relaxed min-h-[20px] max-h-[120px] py-1"
              />

              <div className="mb-px">
                <VoiceButton />
              </div>

              <AuiIf condition={(s: any) => !s.thread.isRunning}>
                <div className="mb-px">
                  <ComposerPrimitive.Send
                    className="flex-none p-1.5 rounded-full transition-all duration-200
                               bg-norma-accent text-white hover:opacity-90
                               disabled:bg-white/[0.05] disabled:text-norma-textDim disabled:cursor-not-allowed"
                    title="发送"
                  >
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="m5 12 7-7 7 7" />
                      <path d="M12 19V5" />
                    </svg>
                  </ComposerPrimitive.Send>
                </div>
              </AuiIf>
              <AuiIf condition={(s: any) => s.thread.isRunning}>
                <div className="mb-px">
                  <ComposerPrimitive.Cancel
                    className="flex-none p-1.5 rounded-full bg-norma-accent text-white hover:opacity-90 transition-all duration-200"
                    title="停止生成"
                  >
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                    >
                      <rect x="6" y="6" width="12" height="12" rx="2" />
                    </svg>
                  </ComposerPrimitive.Cancel>
                </div>
              </AuiIf>
            </div>
          </ComposerPrimitive.Unstable_TriggerPopoverRoot>
        </div>
      </ComposerPrimitive.AttachmentDropzone>
    </ComposerPrimitive.Root>
  );
};

export { ComposerPill };
