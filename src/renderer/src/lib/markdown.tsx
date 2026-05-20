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
    <h2 className="text-[15px] font-bold mb-1.5 text-norma-text">{children}</h2>
  ),
  h3: ({ children }: any) => (
    <h3 className="text-[14px] font-semibold mb-1 text-norma-text">
      {children}
    </h3>
  ),
  ul: ({ children }: any) => (
    <ul className="list-disc list-inside mb-2 space-y-0.5">{children}</ul>
  ),
  ol: ({ children }: any) => (
    <ol className="list-decimal list-inside mb-2 space-y-0.5">{children}</ol>
  ),
  li: ({ children }: any) => <li className="text-[14px]">{children}</li>,
  code: ({ node, inline, className, children, ...props }: any) => {
    const match = /language-(\w+)/.exec(className || '');
    const isInline = inline || !match;
    return isInline ? (
      <code className="bg-white/[0.06] px-1 py-0.5 rounded text-[13px] font-mono text-norma-accent" {...props}>
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
      <table className="w-full text-[13px] border-collapse">{children}</table>
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

const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const renderInline = (text: string): string => {
  return text
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/`([^`]+)`/g, '<code class="bg-white/[0.06] px-1 py-0.5 rounded text-[13px] font-mono text-norma-accent">$1</code>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-norma-accent hover:underline">$1</a>');
};

const SimpleMarkdown: React.FC<{
  children?: any;
  preprocess?: (t: string) => string;
}> = ({ children, preprocess }) => {
  const raw = typeof children === 'string' ? children : (children?.props?.children?.[0]) || '';
  const text = preprocess ? preprocess(raw) : raw;
  const lines = escapeHtml(text).split('\n');
  const html: string[] = [];
  let inCodeBlock = false;
  let codeContent = '';
  let codeLang = '';

  for (const line of lines) {
    if (line.startsWith('```')) {
      if (inCodeBlock) {
        html.push(`<pre class="bg-white/[0.04] rounded-lg p-3 my-2 text-[13px] font-mono overflow-x-auto border border-white/[0.06]"><code>${codeContent}</code></pre>`);
        codeContent = '';
        inCodeBlock = false;
      } else {
        codeLang = line.slice(3).trim();
        inCodeBlock = true;
      }
      continue;
    }
    if (inCodeBlock) { codeContent += line + '\n'; continue; }
    if (line.startsWith('### ')) { html.push(`<h3 class="text-[14px] font-semibold text-norma-text mt-2 mb-1">${renderInline(line.slice(4))}</h3>`); continue; }
    if (line.startsWith('## ')) { html.push(`<h2 class="text-[15px] font-bold text-norma-text mt-2 mb-1">${renderInline(line.slice(3))}</h2>`); continue; }
    if (line.startsWith('# ')) { html.push(`<h1 class="text-sm font-bold text-norma-text mt-2 mb-1">${renderInline(line.slice(2))}</h1>`); continue; }
    if (line.startsWith('- ')) { html.push(`<div class="flex gap-1.5 ml-2"><span class="text-norma-textDim">•</span><span>${renderInline(line.slice(2))}</span></div>`); continue; }
    if (line.startsWith('> ')) { html.push(`<blockquote class="border-l-2 border-norma-accent/40 pl-3 my-1 text-norma-textMuted">${renderInline(line.slice(2))}</blockquote>`); continue; }
    if (line.trim() === '') { html.push('<div class="h-1"></div>'); continue; }
    html.push(`<p class="mb-1.5 last:mb-0">${renderInline(line)}</p>`);
  }

  return <div dangerouslySetInnerHTML={{ __html: html.join('') }} />;
};

export { SimpleMarkdown };
