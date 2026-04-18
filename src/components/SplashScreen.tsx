import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { BookOpen } from 'lucide-react';

interface SplashScreenProps {
  onComplete: () => void;
}

export default function SplashScreen({ onComplete }: SplashScreenProps) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onComplete();
    }, 2500);
    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <motion.div
      initial={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.8, ease: "easeInOut" }}
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-zinc-950 text-white"
    >
      <motion.div
        initial={{ scale: 0.5, opacity: 0, rotate: -10 }}
        animate={{ scale: 1, opacity: 1, rotate: 0 }}
        transition={{ 
          duration: 1, 
          ease: "backOut",
          delay: 0.2
        }}
        className="relative"
      >
        <div className="absolute inset-0 blur-2xl bg-orange-500/20 rounded-full" />
        <BookOpen className="w-24 h-24 text-orange-500 relative z-10" />
      </motion.div>
      
      <motion.h1
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.8, delay: 0.8 }}
        className="mt-8 text-4xl font-bold tracking-tighter"
      >
        PUSTAK
      </motion.h1>
      
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.6 }}
        transition={{ duration: 0.8, delay: 1.2 }}
        className="mt-2 text-sm uppercase tracking-[0.3em] font-medium"
      >
        Premium Indian Ebooks
      </motion.p>

      <motion.div 
        className="absolute bottom-12 w-48 h-[2px] bg-zinc-800 overflow-hidden"
      >
        <motion.div 
          initial={{ x: "-100%" }}
          animate={{ x: "100%" }}
          transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
          className="w-full h-full bg-orange-500"
        />
      </motion.div>
    </motion.div>
  );
}
