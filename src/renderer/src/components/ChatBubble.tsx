import React from 'react';
import { motion } from 'framer-motion';

interface Message {
  role: 'user' | 'assistant';
  text: string;
}

interface ChatBubbleProps {
  message: Message;
  index: number;
}

export const ChatBubble: React.FC<ChatBubbleProps> = ({ message, index }) => {
  const isUser = message.role === 'user';

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.04, ease: [0.16, 1, 0.3, 1] }}
      className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}
    >
      <div className={`bubble ${isUser ? 'bubble-user' : 'bubble-assistant'}`}>
        <span className="whitespace-pre-wrap">{message.text}</span>
        {message.text === '' && (
          <span className="inline-flex gap-1 items-center">
            <span className="w-1 h-1 bg-norma-accent rounded-full animate-pulse" />
            <span className="w-1 h-1 bg-norma-accent rounded-full animate-pulse [animation-delay:0.2s]" />
            <span className="w-1 h-1 bg-norma-accent rounded-full animate-pulse [animation-delay:0.4s]" />
          </span>
        )}
      </div>
    </motion.div>
  );
};
