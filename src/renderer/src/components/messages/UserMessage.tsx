import React from "react";
import { MessagePrimitive } from "@assistant-ui/react";
import { FilePartView, ImagePartView } from "./parts";

const getCommandIcon = (cmd: string) => {
  switch (cmd) {
    case "/screen":
      return (
        <>
          <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
          <line x1="8" y1="21" x2="16" y2="21" />
          <line x1="12" y1="17" x2="12" y2="21" />
        </>
      );
    case "/action":
      return <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />;
    case "/file":
      return (
        <>
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" y1="13" x2="8" y2="13" />
          <line x1="16" y1="17" x2="8" y2="17" />
          <polyline points="10 9 9 9 8 9" />
        </>
      );
    case "/search":
      return (
        <>
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </>
      );
    case "/code":
      return (
        <>
          <polyline points="16 18 22 12 16 6" />
          <polyline points="8 6 2 12 8 18" />
        </>
      );
    case "/help":
      return (
        <>
          <circle cx="12" cy="12" r="10" />
          <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </>
      );
    default:
      return (
        <>
          <polyline points="4 17 10 11 4 5"></polyline>
          <line x1="12" y1="19" x2="20" y2="19"></line>
        </>
      );
  }
};

const getAgentIcon = (agent: string) => {
  switch (agent.toLowerCase()) {
    case "@norma":
      return (
        <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
      );
    case "@coder":
      return (
        <>
          <polyline points="16 18 22 12 16 6" />
          <polyline points="8 6 2 12 8 18" />
        </>
      );
    case "@screen":
      return (
        <>
          <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
          <circle cx="12" cy="12" r="3" />
        </>
      );
    default:
      return (
        <>
          <rect width="18" height="14" x="3" y="8" rx="2" />
          <path d="M12 5a3 3 0 1 0-3 3" />
          <line x1="9" x2="15" y1="15" y2="15" />
          <line x1="9" x2="9.01" y1="12" y2="12" />
          <line x1="15" x2="15.01" y1="12" y2="12" />
        </>
      );
  }
};

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
                              {getCommandIcon(part)}
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
                              {getAgentIcon(part)}
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
