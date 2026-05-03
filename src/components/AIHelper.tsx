import React, { useState, useRef, useEffect } from 'react';
import { Sparkles, Send, X, Bot, User as UserIcon, Loader2, MessageCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { getAIResponse } from '../services/aiService';

interface Message {
  role: 'user' | 'ai';
  text: string;
}

interface AIHelperProps {
  user: any;
  isAdmin: boolean;
}

export default function AIHelper({ user, isAdmin }: AIHelperProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { role: 'ai', text: `Namaste${user?.user_metadata?.display_name ? ' ' + user.user_metadata.display_name : ''}! I am your PUSTAK AI Assistant. How can I help you dominate the market today?` }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: userMessage }]);
    setIsLoading(true);

    const history = messages.map(m => ({ 
      role: m.role === 'user' ? 'user' : 'model', 
      text: m.text 
    }));

    const aiResponse = await getAIResponse(userMessage, history);
    
    setMessages(prev => [...prev, { role: 'ai', text: aiResponse || 'I am sorry, something went wrong.' }]);
    setIsLoading(false);
  };

  return (
    <div className="fixed bottom-24 right-5 sm:bottom-24 sm:right-5 left-5 sm:left-auto z-[50] flex flex-col items-start sm:items-end">
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95, transformOrigin: 'bottom left sm:bottom-right' }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="w-[350px] max-w-[calc(100vw-40px)] bg-white rounded-[2.5rem] shadow-2xl border border-zinc-100 overflow-hidden mb-4 flex flex-col h-[500px]"
          >
            {/* Header */}
            <div className="p-4 bg-zinc-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-orange-600 rounded-2xl flex items-center justify-center shadow-lg">
                  <Bot className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-sm font-black italic uppercase tracking-widest leading-tight">PUSTAK AI</h3>
                  <div className="flex items-center gap-1">
                    <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                    <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Active 24/7</span>
                  </div>
                </div>
              </div>
              <button onClick={() => setIsOpen(false)} className="p-2 hover:bg-zinc-800 rounded-xl transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Messages */}
            <div 
              ref={scrollRef}
              className="flex-1 overflow-y-auto p-4 space-y-4 bg-zinc-50/50"
            >
              {messages.map((msg, i) => (
                <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 shadow-sm ${
                    msg.role === 'ai' ? 'bg-orange-100 text-orange-600' : 'bg-zinc-900 text-white'
                  }`}>
                    {msg.role === 'ai' ? <Bot className="w-4 h-4" /> : <UserIcon className="w-4 h-4" />}
                  </div>
                  <div className={`p-4 rounded-2xl text-sm font-medium leading-relaxed max-w-[80%] ${
                    msg.role === 'ai' 
                      ? 'bg-white border border-zinc-100 text-zinc-800 rounded-tl-none shadow-sm' 
                      : 'bg-zinc-900 text-white rounded-tr-none shadow-md'
                  }`}>
                    {msg.text}
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="flex gap-3">
                  <div className="w-8 h-8 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center animate-pulse">
                    <Bot className="w-4 h-4" />
                  </div>
                  <div className="p-4 rounded-2xl bg-white border border-zinc-100 flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin text-zinc-400" />
                    <span className="text-[10px] font-black uppercase text-zinc-400 tracking-widest">Thinking...</span>
                  </div>
                </div>
              )}
            </div>

            {/* Input */}
            <form onSubmit={handleSend} className="p-4 bg-white border-t border-zinc-100 flex gap-2">
              <Input 
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask me anything..."
                className="h-12 rounded-2xl bg-zinc-50 border-none shadow-inner text-sm font-medium focus-visible:ring-orange-200"
              />
              <Button 
                type="submit"
                disabled={!input.trim() || isLoading}
                className="w-12 h-12 bg-zinc-900 hover:bg-black rounded-2xl flex items-center justify-center shadow-lg shrink-0"
              >
                <Send className="w-5 h-5 text-white" />
              </Button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      <Button
        onClick={() => setIsOpen(!isOpen)}
        className={`h-16 w-16 rounded-3xl shadow-2xl flex items-center justify-center transition-all hover:scale-110 active:scale-95 ${
          isOpen ? 'bg-zinc-900' : 'bg-orange-600 ring-8 ring-orange-500/10'
        }`}
      >
        <Sparkles className={`w-8 h-8 text-white ${!isOpen && 'animate-pulse'}`} />
      </Button>
    </div>
  );
}
