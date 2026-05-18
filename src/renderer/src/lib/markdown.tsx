import React from "react";
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

export const MarkdownComponents = {
  plan: ({ children }: any) => null,
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
  code: ({ node, inline, className, children, ...props }: any) => {
    const match = /language-(\w+)/.exec(className || '');
    const isInline = inline || !match;
    return isInline ? (
      <code className="bg-white/[0.06] px-1 py-0.5 rounded text-[11px] font-mono text-norma-accent" {...props}>
        {children}
      </code>
    ) : (
      <SyntaxHighlighter
        style={vscDarkPlus as any}
        language={match ? match[1] : 'text'}
        PreTag="div"
        customStyle={{
          margin: '0 0 8px 0',
          borderRadius: '8px',
          padding: '12px',
          fontSize: '11px',
          lineHeight: '1.5',
          background: 'rgba(255, 255, 255, 0.04)',
          border: '1px solid rgba(255, 255, 255, 0.06)'
        }}
        {...props}
      >
        {String(children).replace(/\n$/, '')}
      </SyntaxHighlighter>
    );
  },
  pre: ({ children }: any) => <>{children}</>, // SyntaxHighlighter handles the pre tag
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
