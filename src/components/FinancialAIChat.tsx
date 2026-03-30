import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Send, Bot, User, Loader2 } from 'lucide-react';
import { useFinance } from '../hooks/useFinance';
import { askFinancialAssistant } from '../services/geminiService';
import { cn } from '../utils';

interface Message {
  id: string;
  role: 'user' | 'model';
  text: string;
}

interface FinancialAIChatProps {
  isOpen: boolean;
  onClose: () => void;
}

export const FinancialAIChat = ({ isOpen, onClose }: FinancialAIChatProps) => {
  const { incomes, expenses, cards } = useFinance();
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'model',
      text: 'Olá! Sou seu assistente financeiro. Como posso ajudar com suas finanças hoje?'
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput('');
    
    const newUserMsg: Message = { id: Date.now().toString(), role: 'user', text: userMessage };
    setMessages(prev => [...prev, newUserMsg]);
    setIsLoading(true);

    try {
      // Format history for Gemini, skipping the initial greeting to avoid role order errors
      const history = messages.slice(1).map(m => ({
        role: m.role,
        parts: [{ text: m.text }]
      }));

      const response = await askFinancialAssistant(
        userMessage,
        history,
        { incomes, expenses, cards }
      );

      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: 'model',
        text: response
      }]);
    } catch (error) {
      console.error("Chat error:", error);
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: 'model',
        text: 'Desculpe, ocorreu um erro ao processar sua mensagem.'
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
          />
          <motion.div
            initial={{ opacity: 0, x: '100%' }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed inset-y-0 right-0 w-full md:w-[400px] bg-zinc-950 border-l border-zinc-800 shadow-2xl z-50 flex flex-col"
          >
            <div className="flex items-center justify-between p-4 border-b border-zinc-800 bg-zinc-900/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-yellow-500/10 flex items-center justify-center">
                  <Bot className="w-5 h-5 text-yellow-500" />
                </div>
                <div>
                  <h2 className="font-semibold text-zinc-100">Assistente IA</h2>
                  <p className="text-xs text-zinc-500">gemini-3.1-flash-lite-preview</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={cn(
                    "flex gap-3 max-w-[85%]",
                    msg.role === 'user' ? "ml-auto flex-row-reverse" : ""
                  )}
                >
                  <div className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center shrink-0",
                    msg.role === 'user' ? "bg-zinc-800" : "bg-yellow-500/10"
                  )}>
                    {msg.role === 'user' ? (
                      <User className="w-4 h-4 text-zinc-400" />
                    ) : (
                      <Bot className="w-4 h-4 text-yellow-500" />
                    )}
                  </div>
                  <div className={cn(
                    "p-3 rounded-2xl text-sm whitespace-pre-wrap",
                    msg.role === 'user' 
                      ? "bg-yellow-500 text-black rounded-tr-sm" 
                      : "bg-zinc-900 text-zinc-300 rounded-tl-sm border border-zinc-800"
                  )}>
                    {msg.text}
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="flex gap-3 max-w-[85%]">
                  <div className="w-8 h-8 rounded-full bg-yellow-500/10 flex items-center justify-center shrink-0">
                    <Bot className="w-4 h-4 text-yellow-500" />
                  </div>
                  <div className="p-4 rounded-2xl bg-zinc-900 border border-zinc-800 rounded-tl-sm flex items-center gap-2">
                    <Loader2 className="w-4 h-4 text-yellow-500 animate-spin" />
                    <span className="text-xs text-zinc-500">Analisando dados...</span>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            <div className="p-4 border-t border-zinc-800 bg-zinc-950">
              <form 
                onSubmit={(e) => { e.preventDefault(); handleSend(); }}
                className="flex gap-2"
              >
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Pergunte sobre suas finanças..."
                  className="flex-1 bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-yellow-500/50"
                  disabled={isLoading}
                />
                <button
                  type="submit"
                  disabled={!input.trim() || isLoading}
                  className="p-3 bg-yellow-500 text-black rounded-xl hover:bg-yellow-400 disabled:opacity-50 disabled:hover:bg-yellow-500 transition-colors flex items-center justify-center"
                >
                  <Send className="w-5 h-5" />
                </button>
              </form>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
