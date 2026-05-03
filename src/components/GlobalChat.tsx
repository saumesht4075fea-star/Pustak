import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { ChatMessage } from '../types';
import { User } from '@supabase/supabase-js';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { MessageSquare, Send, X, Minimize2, Maximize2, Megaphone, Bell, ShieldCheck } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';

interface GlobalChatProps {
  user: User | null;
  isAdmin: boolean;
}

export default function GlobalChat({ user, isAdmin }: GlobalChatProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      fetchMessages();
      
      const channel = supabase
        .channel('public:messages')
        .on('postgres_changes', { 
          event: 'INSERT', 
          schema: 'public', 
          table: 'messages' 
        }, payload => {
          setMessages(prev => [...prev, payload.new as ChatMessage]);
        })
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [isOpen]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const fetchMessages = async () => {
    try {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .order('created_at', { ascending: true })
        .limit(50);
      
      if (error) throw error;
      if (data) setMessages(data as ChatMessage[]);
    } catch (err) {
      console.error('Failed to fetch messages:', err);
      // If table doesn't exist, we might get an error.
      // In a real app, we'd handle this better.
    }
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !inputText.trim() || isLoading) return;

    setIsLoading(true);
    try {
      const newMessage = {
        user_id: user.id,
        display_name: user.user_metadata?.display_name || user.email?.split('@')[0] || 'User',
        avatar_url: user.user_metadata?.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.id}`,
        text: inputText.trim(),
        created_at: new Date().toISOString()
      };

      const { error } = await supabase.from('messages').insert(newMessage);
      if (error) throw error;
      setInputText('');
    } catch (err) {
      toast.error('Failed to send message. Make sure "messages" table exists.');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  if (!user) return null;

  return (
    <div className="fixed bottom-6 right-6 z-[100] flex flex-col items-end">
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ 
              opacity: 1, 
              y: 0, 
              scale: 1,
              height: isMinimized ? '60px' : '450px' 
            }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="w-[350px] bg-white border border-zinc-200 rounded-3xl shadow-2xl overflow-hidden mb-4 flex flex-col"
          >
            {/* Header */}
            <div className="p-4 bg-zinc-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-orange-500 rounded-full flex items-center justify-center">
                  <Megaphone className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h3 className="text-sm font-black italic uppercase tracking-tight">Admin Announcements</h3>
                  <div className="flex items-center gap-1">
                    <span className="w-1.5 h-1.5 bg-orange-500 rounded-full animate-pulse" />
                    <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Official Feed</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-8 w-8 text-zinc-400 hover:text-white hover:bg-white/10"
                  onClick={() => setIsMinimized(!isMinimized)}
                >
                  {isMinimized ? <Maximize2 className="w-4 h-4" /> : <Minimize2 className="w-4 h-4" />}
                </Button>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-8 w-8 text-zinc-400 hover:text-white hover:bg-white/10"
                  onClick={() => setIsOpen(false)}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {!isMinimized && (
              <>
                {/* Messages Area */}
                <div 
                  ref={scrollRef}
                  className="flex-1 overflow-y-auto p-4 space-y-4 bg-zinc-50/50"
                >
                  {messages.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center space-y-2 opacity-50">
                      <Bell className="w-8 h-8 text-zinc-300" />
                      <p className="text-xs font-bold uppercase tracking-widest text-zinc-400">No announcements yet</p>
                    </div>
                  ) : (
                    messages.map((msg) => (
                      <div 
                        key={msg.id || Math.random()} 
                        className="flex gap-3"
                      >
                        <div className="w-8 h-8 rounded-full bg-zinc-900 flex items-center justify-center overflow-hidden shrink-0 shadow-lg border border-zinc-800">
                           <ShieldCheck className="w-4 h-4 text-orange-500" />
                        </div>
                        <div className="space-y-1 max-w-[85%]">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-black uppercase tracking-widest text-orange-600">ADMINISTRATOR</span>
                            <span className="text-[8px] font-bold text-zinc-400">{new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          </div>
                          <div className="p-4 rounded-2xl text-sm bg-white border border-zinc-200 text-zinc-800 rounded-tl-none font-medium leading-relaxed shadow-sm">
                            {msg.text}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Input Area - Only for Admins */}
                {isAdmin ? (
                  <form onSubmit={sendMessage} className="p-4 bg-white border-t border-zinc-100 flex gap-2">
                    <Input 
                      placeholder="Post an official announcement..."
                      value={inputText}
                      onChange={(e) => setInputText(e.target.value)}
                      className="h-10 rounded-xl bg-zinc-50 border-zinc-200 text-sm focus:ring-orange-200 shadow-inner"
                    />
                    <Button 
                      type="submit" 
                      size="icon"
                      disabled={!inputText.trim() || isLoading}
                      className="h-10 w-10 bg-orange-600 hover:bg-orange-700 rounded-xl shrink-0 shadow-lg"
                    >
                      <Send className="w-4 h-4" />
                    </Button>
                  </form>
                ) : (
                  <div className="p-4 bg-zinc-50 border-t border-zinc-100 text-center">
                    <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest italic">Viewing Official Announcements Only</p>
                  </div>
                )}
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <Button 
        onClick={() => {
          setIsOpen(!isOpen);
          setIsMinimized(false);
        }}
        className={`h-14 w-14 rounded-full shadow-2xl transition-all ${
          isOpen ? 'bg-zinc-900 hover:bg-black' : 'bg-orange-600 hover:bg-orange-700 ring-4 ring-orange-500/20'
        }`}
      >
        <Bell className="w-6 h-6" />
      </Button>
    </div>
  );
}
