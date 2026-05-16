import React from "react";
import { PlanBlock } from "../components/messages/parts";

export const MarkdownComponents = {
  plan: ({ children }: any) => <PlanBlock>{children}</PlanBlock>,
  p: ({ children }: any) => <p className="mb-2 last:mb-0">{children}</p>,
  h1: ({ children }: any) => (
    <h1 className="text-sm font-bold mb-2 text-norma-text">{children}</h1>
  ),
  h2: ({ children }: any) => (
    <h2 className="text-[13px] font-bold mb-1.5 text-norma-text">{children}</h2>
  ),
  h3: ({ children }: any) => (
    <h3 className="text-[12px] font-semibold mb-1 text-norma-text">
      {children}
    </h3>
  ),
  ul: ({ children }: any) => (
    <ul className="list-disc list-inside mb-2 space-y-0.5">{children}</ul>
  ),
  ol: ({ children }: any) => (
    <ol className="list-decimal list-inside mb-2 space-y-0.5">{children}</ol>
  ),
  li: ({ children }: any) => <li className="text-[12px]">{children}</li>,
  code: ({ children, className }: any) => {
    const isInline = !className;
    return isInline ? (
      <code className="bg-white/[0.06] px-1 py-0.5 rounded text-[11px] font-mono text-norma-accent">
        {children}
      </code>
    ) : (
      <code className={`${className || ""} text-[11px]`}>{children}</code>
    );
  },
  pre: ({ children }: any) => (
    <pre className="bg-white/[0.04] border border-white/[0.06] rounded-lg p-3 overflow-x-auto mb-2 text-[11px] font-mono">
      {children}
    </pre>
  ),
  a: ({ href, children }: any) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-norma-accent hover:underline"
    >
      {children}
    </a>
  ),
  blockquote: ({ children }: any) => (
    <blockquote className="border-l-2 border-norma-accent/40 pl-3 my-2 text-norma-textMuted">
      {children}
    </blockquote>
  ),
  table: ({ children }: any) => (
    <div className="overflow-x-auto mb-2">
      <table className="w-full text-[11px] border-collapse">{children}</table>
    </div>
  ),
  th: ({ children }: any) => (
    <th className="border border-white/[0.06] px-2 py-1 bg-white/[0.03] text-left">
      {children}
    </th>
  ),
  td: ({ children }: any) => (
    <td className="border border-white/[0.06] px-2 py-1">{children}</td>
  ),
};
