import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { motion } from 'framer-motion';
import { Send, Bot, TerminalSquare } from 'lucide-react';
import './index.css';

// Declare electronAPI for TypeScript
declare global {
  interface Window {
    electronAPI: {
      sendMessage: (channel: string, data: any) => void;
      onMessage: (channel: string, callback: (data: any) => void) => () => void;
    };
  }
}

// Mock AssistantUI for MVP v0.2 layout structure
// We'll fully wire @assistant-ui/react hooks in v0.3 when Mastra is integrated
const App = () => {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState([
    { role: 'assistant', text: 'Hello, I am Norma. Your local intelligent agent.' }
  ]);
  const [isStreaming, setIsStreaming] = useState(false);

  useEffect(() => {
    const unsubChunk = window.electronAPI.onMessage('chat:chunk', (chunk: string) => {
      setMessages(prev => {
        const last = prev[prev.length - 1];
        if (last && last.role === 'assistant' && isStreaming) {
          const newMessages = [...prev];
          newMessages[newMessages.length - 1] = { ...last, text: last.text + chunk };
          return newMessages;
        } else {
          return [...prev, { role: 'assistant', text: chunk }];
        }
      });
    });

    const unsubDone = window.electronAPI.onMessage('chat:done', () => {
      setIsStreaming(false);
    });

    const unsubError = window.electronAPI.onMessage('chat:error', (error: string) => {
      setMessages(prev => [...prev, { role: 'assistant', text: `Error: ${error}` }]);
      setIsStreaming(false);
    });

    return () => {
      unsubChunk();
      unsubDone();
      unsubError();
    };
  }, [isStreaming]);

  const handleSend = () => {
    if (!input.trim() || isStreaming) return;
    const userMessage = input.trim();
    setMessages(prev => [...prev, { role: 'user', text: userMessage }]);
    setInput('');
    setIsStreaming(true);
    
    // Add empty assistant message to append chunks to
    setMessages(prev => [...prev, { role: 'assistant', text: '' }]);
    
    window.electronAPI.sendMessage('chat:send', userMessage);
  };

  return (
    <div className="flex flex-col h-screen w-screen p-4 items-center justify-center relative">
      
      {/* Main Glass Panel */}
      <motion.div 
        className="glass-panel w-full max-w-2xl h-full flex flex-col relative overflow-hidden"
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      >
        
        {/* Header */}
        <header className="flex-none p-4 border-b border-norma-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-norma-bg p-2 rounded-xl border border-norma-border">
              <Bot className="w-5 h-5 text-norma-accent" />
            </div>
            <div>
              <h1 className="text-sm font-semibold tracking-wide text-norma-text">Norma</h1>
              <p className="text-[10px] text-norma-textMuted font-mono">Agent Core • Ready</p>
            </div>
          </div>
          <button className="text-norma-textMuted hover:text-norma-text transition-colors p-2 rounded-lg hover:bg-white/5">
            <TerminalSquare className="w-4 h-4" />
          </button>
        </header>

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
          {messages.map((msg, idx) => (
            <motion.div 
              key={idx}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div 
                className={`max-w-[80%] p-3 rounded-2xl text-sm leading-relaxed ${
                  msg.role === 'user' 
                    ? 'bg-norma-accent text-gray-900 font-medium' 
                    : 'bg-white/5 border border-white/10 text-norma-text'
                }`}
              >
                {msg.text}
              </div>
            </motion.div>
          ))}
        </div>

        {/* Input Area */}
        <div className="flex-none p-4 pt-2">
          <div className="relative flex items-center bg-white/5 border border-norma-border rounded-2xl focus-within:border-norma-accent/50 transition-colors shadow-inner overflow-hidden">
            <input 
              type="text" 
              className="w-full bg-transparent text-sm text-norma-text placeholder-norma-textMuted p-4 outline-none font-sans"
              placeholder="Ask Norma to do something..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            />
            <button 
              className="absolute right-2 p-2 bg-norma-accent text-black rounded-xl hover:opacity-90 transition-opacity"
              onClick={handleSend}
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
          <div className="text-center mt-2">
            <p className="text-[10px] text-norma-textMuted flex justify-center items-center gap-1 font-mono tracking-wider">
              <span>Press</span> <kbd className="bg-white/10 px-1 rounded border border-white/10">⌘</kbd> <span>+</span> <kbd className="bg-white/10 px-1 rounded border border-white/10">Space</kbd> <span>for Command Bar</span>
            </p>
          </div>
        </div>

      </motion.div>

    </div>
  );
};

const root = createRoot(document.getElementById('root')!);
root.render(<App />);
