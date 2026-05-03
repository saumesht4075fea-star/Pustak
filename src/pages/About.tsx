import React from 'react';
import { motion } from 'motion/react';
import { BookOpen, Target, Users, ShieldCheck } from 'lucide-react';

export default function About() {
  return (
    <div className="max-w-4xl mx-auto space-y-12 py-10 px-4 sm:px-0">
      <header className="text-center space-y-4">
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="inline-flex items-center justify-center w-20 h-20 bg-orange-100 rounded-[2.5rem] mb-4"
        >
          <BookOpen className="w-10 h-10 text-orange-600" />
        </motion.div>
        <motion.h1 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-5xl font-black tracking-tight text-zinc-900 uppercase italic"
        >
          About Pustak
        </motion.h1>
        <motion.p 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="text-zinc-500 font-medium text-lg max-w-2xl mx-auto"
        >
          Knowledge is the most powerful weapon. At Pustak, we provide the ammunition for your intellectual growth.
        </motion.p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
          className="p-8 bg-white rounded-[2rem] border border-zinc-100 shadow-xl shadow-zinc-200/50 space-y-4"
        >
          <div className="w-12 h-12 bg-zinc-900 rounded-2xl flex items-center justify-center shadow-lg">
            <Target className="w-6 h-6 text-orange-500" />
          </div>
          <h2 className="text-2xl font-black text-zinc-900 uppercase italic">Our Mission</h2>
          <p className="text-zinc-600 leading-relaxed font-medium">
            We aim to democratize access to high-quality educational and skill-based content. By connecting brilliant authors with ambitious readers, we create a ecosystem where knowledge leads to real-world dominance.
          </p>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.3 }}
          className="p-8 bg-white rounded-[2rem] border border-zinc-100 shadow-xl shadow-zinc-200/50 space-y-4"
        >
          <div className="w-12 h-12 bg-orange-600 rounded-2xl flex items-center justify-center shadow-lg">
            <Users className="w-6 h-6 text-white" />
          </div>
          <h2 className="text-2xl font-black text-zinc-900 uppercase italic">The Community</h2>
          <p className="text-zinc-600 leading-relaxed font-medium">
            PUSTAK isn't just a store; it's a movement. With thousands of members and top-tier authors, we are building the largest digital ebook community in India, focused on growth, finance, and success.
          </p>
        </motion.div>
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="p-10 bg-zinc-900 rounded-[3rem] text-white overflow-hidden relative"
      >
        <div className="relative z-10 space-y-6">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-orange-500" />
            <h3 className="text-xl font-black uppercase italic tracking-wider">Trusted by Professionals</h3>
          </div>
          <p className="text-zinc-400 font-medium text-lg leading-relaxed max-w-3xl">
            Every product on our platform undergoes a rigorous verification process. We ensure that our readers get only the best, most actionable content to help them stay ahead in their respective fields.
          </p>
          <div className="flex flex-wrap gap-8 pt-4">
            <div className="space-y-1">
              <p className="text-4xl font-black text-white italic tracking-tighter">10K+</p>
              <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Active Readers</p>
            </div>
            <div className="space-y-1">
              <p className="text-4xl font-black text-white italic tracking-tighter">500+</p>
              <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Premium Authors</p>
            </div>
            <div className="space-y-1">
              <p className="text-4xl font-black text-white italic tracking-tighter">1500+</p>
              <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Ebooks Verified</p>
            </div>
          </div>
        </div>
        <div className="absolute top-0 right-0 w-64 h-64 bg-orange-600/10 rounded-full blur-3xl -mr-32 -mt-32" />
      </motion.div>
    </div>
  );
}
