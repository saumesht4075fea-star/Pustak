import { useState, useRef, useEffect } from 'react';
import { Sparkles, Send, X, Bot, User as UserIcon, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';

interface Message {
  role: 'user' | 'ai';
  text: string;
}

interface AIHelperProps {
  user: any;
  isAdmin: boolean;
}

// Groq API Configuration
const GROQ_API_KEY = import.meta.env.VITE_GROQ_API_KEY || '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';
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';

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

    try {
      const response = await fetch(GROQ_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${GROQ_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          messages: [
            {
              role: "system",
              content: `You are PUSTAK Assist, the high-performance AI guide for PUSTAK - India's Premium Ebook Marketplace.
              Your personality is technical, elite, professional, and slightly bold. You focus on "Intellectual Dominance" and "Market Success".
              
              Operational Intel:
              - PUSTAK is a digital-first marketplace for elite ebooks.
              - Payments: UPI based. Users MUST provide correct UTR (12-digit Transaction ID) for manual admin verification.
              - TAT (Turnaround Time): 5-30 minutes for verification during business hours.
              - Content Delivery: Books appear in 'My Library' or 'Orders' post-verification.
              - Selling: Register as seller, upload high-quality PDFs, set premium pricing.
              - Payouts: Minimum withdrawal threshold: ₹500.
              - Affiliate Network: High-conversion referral system where users earn passive rewards.
              - Official Support: support@pustak.online
              
              Engagement Protocol:
              - Response Style: Direct, bold, and authoritative. Use formatting (bolding, lists) for maximum readability.
              - Mention 'Bug Hunter' for any UI/UX issues.
              - Strategic Advice: If users ask "how to make money", point them to the Affiliate system and high-demand topics.
              - Cultural Context: Respect Indian market nuances. Use 'Namaste' and '₹' naturally.
              - Never say "I am just an AI". You are PUSTAK Assist.`
            },
            ...messages.map(m => ({
              role: m.role === 'user' ? 'user' : 'assistant',
              content: m.text
            })),
            { role: 'user', content: userMessage }
          ],
          temperature: 0.7,
          max_tokens: 1024
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || `HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      const aiText = data.choices?.[0]?.message?.content;
      
      if (!aiText) {
        throw new Error('Empty response from AI engine');
      }
      
      setMessages(prev => [...prev, { role: 'ai', text: aiText }]);
    } catch (error) {
      console.error('AI Error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown technical failure';
      setMessages(prev => [...prev, { role: 'ai', text: `Diagnostic Error: ${errorMessage}. Please verify API link and retry.` }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <motion.div 
      drag
      dragMomentum={false}
      initial={{ x: 0, y: 0 }}
      className="fixed bottom-28 right-5 z-[100] flex flex-col items-end"
      style={{ touchAction: 'none' }}
    >
      <div className="flex flex-col items-end">
        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.95, transformOrigin: 'bottom right' }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.95 }}
              onPointerDown={e => e.stopPropagation()}
              className="w-[350px] max-w-[calc(100vw-40px)] bg-white rounded-[2.5rem] shadow-[0_20px_50px_rgba(0,0,0,0.2)] border border-zinc-100 overflow-hidden mb-5 flex flex-col h-[500px] sm:h-[600px]"
            >
              {/* Header */}
              <div className="p-5 bg-zinc-900 text-white flex items-center justify-between" onPointerDown={e => e.stopPropagation()}>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-orange-600 rounded-2xl flex items-center justify-center shadow-lg transform -rotate-6">
                    <Bot className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black italic uppercase tracking-widest leading-tight">PUSTAK Assist</h3>
                    <div className="flex items-center gap-1">
                      <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                      <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Core Online</span>
                    </div>
                  </div>
                </div>
                <button onClick={() => setIsOpen(false)} className="p-2 hover:bg-zinc-800 rounded-xl transition-colors">
                  <X className="w-5 h-5 text-zinc-500" />
                </button>
              </div>

              {/* Messages */}
              <div 
                ref={scrollRef}
                className="flex-1 overflow-y-auto p-5 space-y-5 bg-zinc-50/30 custom-scrollbar"
                onPointerDown={e => e.stopPropagation()}
              >
                {messages.map((msg, i) => (
                  <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 shadow-md ${
                      msg.role === 'ai' ? 'bg-white text-orange-600 border border-zinc-100' : 'bg-zinc-900 text-white'
                    }`}>
                      {msg.role === 'ai' ? <Sparkles className="w-4 h-4" /> : <UserIcon className="w-4 h-4" />}
                    </div>
                    <div className={`p-4 rounded-3xl text-sm font-medium leading-relaxed max-w-[85%] ${
                      msg.role === 'ai' 
                        ? 'bg-white border border-zinc-100 text-zinc-800 rounded-tl-sm shadow-sm' 
                        : 'bg-zinc-900 text-white rounded-tr-sm shadow-xl shadow-zinc-900/10'
                    }`}>
                      {msg.text}
                    </div>
                  </div>
                ))}
                {isLoading && (
                  <div className="flex gap-3">
                    <div className="w-8 h-8 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center animate-bounce">
                      <Bot className="w-4 h-4" />
                    </div>
                    <div className="p-4 rounded-3xl bg-white border border-zinc-100 flex items-center gap-3">
                      <Loader2 className="w-4 h-4 animate-spin text-orange-500" />
                      <span className="text-[10px] font-black uppercase text-zinc-400 tracking-widest">Analyzing...</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Input */}
              <form onSubmit={handleSend} className="p-5 bg-white border-t border-zinc-100 flex gap-2" onPointerDown={e => e.stopPropagation()}>
                <Input 
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Engage PUSTAK AI..."
                  className="h-12 rounded-2xl bg-zinc-50 border-none shadow-inner text-sm font-bold focus-visible:ring-2 focus-visible:ring-orange-500/20"
                />
                <Button 
                  type="submit"
                  disabled={!input.trim() || isLoading}
                  className="w-12 h-12 bg-orange-600 hover:bg-orange-700 rounded-2xl flex items-center justify-center shadow-xl shadow-orange-600/20 shrink-0"
                >
                  <Send className="w-5 h-5 text-white" />
                </Button>
              </form>
            </motion.div>
          )}
        </AnimatePresence>

        <motion.div
          layout
          initial={false}
        >
          <Button
            onClick={() => setIsOpen(!isOpen)}
            className={`h-14 w-14 sm:h-16 sm:w-16 rounded-[1.5rem] sm:rounded-[2rem] shadow-2xl flex items-center justify-center transition-all group relative ${
              isOpen ? 'bg-zinc-900' : 'bg-orange-600'
            }`}
          >
            {!isOpen && (
              <span className="absolute -top-1 -right-1 flex h-4 w-4">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-4 w-4 bg-orange-500"></span>
              </span>
            )}
            <Sparkles className={`w-6 h-6 sm:w-8 h-8 text-white transition-transform ${!isOpen && 'group-hover:rotate-12'}`} />
          </Button>
        </motion.div>
      </div>
    </motion.div>
  );
}
