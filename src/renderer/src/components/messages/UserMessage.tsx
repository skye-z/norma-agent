import React from "react";
import { MessagePrimitive } from "@assistant-ui/react";
import { FilePartView, ImagePartView } from "./parts";

const GENERIC_COMMAND_ICON = (
  <>
    <polyline points="4 17 10 11 4 5" />
    <line x1="12" y1="19" x2="20" y2="19" />
  </>
);

const GENERIC_AGENT_ICON = (
  <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
);

export const UserMessage: React.FC = () => {
  return (
    <MessagePrimitive.Root className="flex justify-end">
      <div className="max-w-[80%]">
        <div className="bubble bubble-user">
          <div className="flex flex-col gap-[5px] w-full min-w-0">
            <MessagePrimitive.Content
              components={{
                Text: ({ text }) => {
                  const renderHighlightedText = (content: string) => {
                    const parts = content.split(
                      /(\/[a-zA-Z0-9_-]+|@[a-zA-Z0-9_-]+)/g,
                    );
                    return parts.map((part, i) => {
                      if (part.startsWith("/")) {
                        return (
                          <span
                            key={i}
                            className="inline-flex items-center px-1.5 py-0.5 rounded bg-black/20 text-white/90 font-mono text-[11px] align-bottom mx-0.5 border border-black/10 shadow-sm leading-none mt-0.5"
                          >
                            <svg
                              width="10"
                              height="10"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              className="mr-1 opacity-70"
                            >
                              {GENERIC_COMMAND_ICON}
                            </svg>
                            {part.slice(1)}
                          </span>
                        );
                      }
                      if (part.startsWith("@")) {
                        return (
                          <span
                            key={i}
                            className="inline-flex items-center px-1.5 py-0.5 rounded bg-white/20 text-white font-medium text-[11px] align-bottom mx-0.5 border border-white/20 shadow-sm leading-none mt-0.5"
                          >
                            <svg
                              width="10"
                              height="10"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              className="mr-1 opacity-70"
                            >
                              {GENERIC_AGENT_ICON}
                            </svg>
                            {part.slice(1)}
                          </span>
                        );
                      }
                      return part;
                    });
                  };

                  return (
                    <span className="whitespace-pre-wrap text-[12px] leading-relaxed">
                      {renderHighlightedText(text)}
                    </span>
                  );
                },
                File: () => <FilePartView />,
                Image: () => <ImagePartView />,
              }}
            />
          </div>
        </div>
      </div>
    </MessagePrimitive.Root>
  );
};
