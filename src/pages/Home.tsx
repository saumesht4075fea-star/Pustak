import React, { useState, useEffect } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { User } from '@supabase/supabase-js';
import { motion } from 'motion/react';
import { Heart, ShoppingCart, Star, Search, Filter, MessageSquare, Download, ChevronLeft, ChevronRight, Smartphone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Ebook, Review, Profile } from '../types';
import { Link, useNavigate } from 'react-router-dom';
import { AnimatePresence } from 'motion/react';

export default function Home({ user }: { user: User | null }) {
  const [ebooks, setEbooks] = useState<Ebook[]>([]);
  const [banners, setBanners] = useState<any[]>([]);
  const [currentBannerIndex, setCurrentBannerIndex] = useState(0);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  const [wishlist, setWishlist] = useState<string[]>([]);
  const [reviews, setReviews] = useState<Record<string, Review[]>>({});
  const [profile, setProfile] = useState<Profile | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (search.trim().length > 1) {
      const filtered = ebooks
        .filter(e => 
          e.title.toLowerCase().includes(search.toLowerCase()) || 
          e.author.toLowerCase().includes(search.toLowerCase())
        )
        .slice(0, 5)
        .map(e => e.title);
      setSuggestions(Array.from(new Set(filtered)));
      setShowSuggestions(true);
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
    }
  }, [search, ebooks]);

  useEffect(() => {
    if (user && isSupabaseConfigured) {
      const fetchProfile = async () => {
        const { data } = await supabase
          .from('profiles')
          .select('*')
          .eq('uid', user.id)
          .single();
        if (data) setProfile(data as Profile);
      };
      fetchProfile();

      const channel = supabase
        .channel('profile_home')
        .on('postgres_changes', { 
          event: '*', 
          schema: 'public', 
          table: 'profiles',
          filter: `uid=eq.${user.id}`
        }, fetchProfile)
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [user]);

  useEffect(() => {
    if (!isSupabaseConfigured) return;

    const fetchEbooks = async () => {
      const { data } = await supabase
        .from('ebooks')
        .select('id, title, author, description, price, commission_amount, cover_url, file_url, category, cosmofeed_url, seller_id, is_verified, is_deleted, created_at')
        .eq('is_deleted', false)
        .order('created_at', { ascending: false });
      if (data) setEbooks(data as Ebook[]);
    };

    const fetchReviews = async () => {
      const { data } = await supabase
        .from('reviews')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (data) {
        const revs: Record<string, Review[]> = {};
        data.forEach((r: Review) => {
          if (!revs[r.ebook_id]) revs[r.ebook_id] = [];
          revs[r.ebook_id].push(r);
        });
        setReviews(revs);
      }
    };

    fetchEbooks();
    fetchReviews();

    const fetchBanners = async () => {
      const { data } = await supabase
        .from('home_banners')
        .select('*')
        .order('created_at', { ascending: false });
      if (data && data.length > 0) setBanners(data);
    };
    fetchBanners();

    const ebooksChannel = supabase
      .channel('ebooks_home')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ebooks' }, fetchEbooks)
      .subscribe();

    const reviewsChannel = supabase
      .channel('reviews_home')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reviews' }, fetchReviews)
      .subscribe();

    const bannersChannel = supabase
      .channel('banners_home')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'home_banners' }, fetchBanners)
      .subscribe();

    return () => {
      supabase.removeChannel(ebooksChannel);
      supabase.removeChannel(reviewsChannel);
      supabase.removeChannel(bannersChannel);
    };
  }, []);

  useEffect(() => {
    if (user && isSupabaseConfigured) {
      const fetchWishlist = async () => {
        const { data } = await supabase
          .from('wishlist')
          .select('ebook_id')
          .eq('user_id', user.id);
        if (data) setWishlist(data.map(i => i.ebook_id));
      };

      fetchWishlist();

      const channel = supabase
        .channel('wishlist_home')
        .on('postgres_changes', { 
          event: '*', 
          schema: 'public', 
          table: 'wishlist',
          filter: `user_id=eq.${user.id}`
        }, fetchWishlist)
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [user]);

  const toggleWishlist = async (ebookId: string) => {
    if (!user) {
      toast.error('Please login to add to wishlist');
      return;
    }

    if (wishlist.includes(ebookId)) {
      const { error } = await supabase
        .from('wishlist')
        .delete()
        .eq('user_id', user.id)
        .eq('ebook_id', ebookId);
      
      if (!error) {
        setWishlist(prev => prev.filter(id => id !== ebookId));
        toast.success('Removed from wishlist');
      }
    } else {
      const { error } = await supabase
        .from('wishlist')
        .insert({
          user_id: user.id,
          ebook_id: ebookId,
          created_at: new Date().toISOString()
        });
      
      if (!error) {
        setWishlist(prev => [...prev, ebookId]);
        toast.success('Added to wishlist');
      }
    }
  };

  const handleBecomeSeller = async () => {
    if (!user) return;
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ role: 'seller' })
        .eq('uid', user.id);
      
      if (error) throw error;
      toast.success('Congratulations! You are now a seller.');
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const filteredEbooks = ebooks.filter(e => {
    const matchesCategory = (category === 'All' || e.category === category);
    const searchTerm = search.toLowerCase();
    
    // Check if the search term matches title, author OR if it matches the seller_id exactly
    const matchesSearch = 
      e.title.toLowerCase().includes(searchTerm) || 
      e.author.toLowerCase().includes(searchTerm) ||
      e.seller_id === search; 
      
    return matchesCategory && matchesSearch;
  });

  useEffect(() => {
    if (banners.length <= 1) return;
    
    // Auto-slide only on mobile as requested
    const isMobile = window.innerWidth < 768;
    if (!isMobile) return;

    const interval = setInterval(() => {
      setCurrentBannerIndex((prev) => (prev + 1) % banners.length);
    }, 5000);

    return () => clearInterval(interval);
  }, [banners]);

  const categories = ['All', ...Array.from(new Set(ebooks.map(e => e.category)))];

  const nextBanner = () => {
    setCurrentBannerIndex((prev) => (prev + 1) % banners.length);
  };

  const prevBanner = () => {
    setCurrentBannerIndex((prev) => (prev - 1 + banners.length) % banners.length);
  };

  return (
    <div className="space-y-8">
      {/* Hero Section */}
      <section className="relative h-[300px] md:h-[500px] rounded-[2rem] sm:rounded-[3rem] overflow-hidden bg-zinc-900 group">
        <AnimatePresence mode="wait">
          <motion.div 
            key={currentBannerIndex}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.7 }}
            className="absolute inset-0 bg-black"
          >
            {/* Blurred background for different aspect ratios */}
            <div 
              className="absolute inset-0 blur-2xl opacity-50 scale-110"
              style={{ 
                backgroundImage: `url(${banners.length > 0 ? banners[currentBannerIndex].image_url : "https://images.unsplash.com/photo-1524995997946-a1c2e315a42f?auto=format&fit=crop&w=1920&q=80"})`,
                backgroundPosition: 'center',
                backgroundSize: 'cover'
              }}
            />
            <img 
              src={banners.length > 0 ? banners[currentBannerIndex].image_url : "https://images.unsplash.com/photo-1524995997946-a1c2e315a42f?auto=format&fit=crop&w=1920&q=80"} 
              alt="Banner" 
              className="w-full h-full object-contain relative z-10"
              referrerPolicy="no-referrer"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/40 to-transparent flex items-center px-8 sm:px-16 z-20">
              <div className="max-w-2xl space-y-4 md:space-y-6">
                <motion.div
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.2 }}
                >
                  <Badge className="bg-orange-600 hover:bg-orange-600 text-white border-none px-4 py-1 mb-4 hidden sm:inline-flex">PREMIUM COLLECTION</Badge>
                  <h1 className="text-4xl sm:text-7xl font-black text-white tracking-tighter leading-[0.9]">
                    {banners.length > 0 && banners[currentBannerIndex].title ? (
                      banners[currentBannerIndex].title
                    ) : (
                      <>READ. LEARN. <br /><span className="text-orange-500 italic">DOMINATE.</span></>
                    )}
                  </h1>
                </motion.div>
                <motion.p 
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.3 }}
                  className="text-zinc-300 text-sm sm:text-lg max-w-lg font-medium"
                >
                  {banners.length > 0 && banners[currentBannerIndex].subtitle ? (
                    banners[currentBannerIndex].subtitle
                  ) : (
                    "Access thousands of premium ebooks from top authors. Knowledge is the best investment you'll ever make."
                  )}
                </motion.p>
                <motion.div
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.4 }}
                  className="flex gap-4"
                >
                  <Button className="bg-white text-zinc-900 hover:bg-zinc-200 h-10 sm:h-12 px-6 sm:px-8 rounded-xl font-black text-xs sm:text-sm shadow-xl active:scale-95 transition-transform">
                    EXPLORE NOW
                  </Button>
                </motion.div>
              </div>
            </div>
          </motion.div>
        </AnimatePresence>

        {/* Manual Controls */}
        {banners.length > 1 && (
          <>
            <button 
              onClick={(e) => { e.stopPropagation(); prevBanner(); }}
              className="absolute left-4 top-1/2 -translate-y-1/2 w-10 sm:w-12 h-10 sm:h-12 rounded-full bg-black/20 backdrop-blur-md border border-white/10 flex items-center justify-center text-white md:opacity-0 md:group-hover:opacity-100 transition-opacity hover:bg-black/40 z-20"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
            <button 
              onClick={(e) => { e.stopPropagation(); nextBanner(); }}
              className="absolute right-4 top-1/2 -translate-y-1/2 w-10 sm:w-12 h-10 sm:h-12 rounded-full bg-black/20 backdrop-blur-md border border-white/10 flex items-center justify-center text-white md:opacity-0 md:group-hover:opacity-100 transition-opacity hover:bg-black/40 z-20"
            >
              <ChevronRight className="w-6 h-6" />
            </button>

            {/* Indicator Dots */}
            <div className="absolute bottom-6 sm:bottom-10 left-1/2 -translate-x-1/2 flex gap-2 z-20">
              {banners.map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => setCurrentBannerIndex(idx)}
                  className={`h-1.5 rounded-full transition-all duration-300 ${idx === currentBannerIndex ? 'w-8 bg-orange-500' : 'w-2 bg-white/30'}`}
                />
              ))}
            </div>
          </>
        )}
      </section>

      {/* Filters */}
      <div id="search-section" className="flex flex-col sm:flex-row gap-4 items-center justify-between bg-white p-2 sm:p-4 rounded-2xl border border-zinc-200 shadow-sm relative z-40">
        <div className="relative w-full sm:w-96">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none" />
          <Input 
            placeholder="Search by title or author..." 
            className="pl-10 bg-zinc-50 border-zinc-200 h-10 sm:h-12 text-sm"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onFocus={() => setShowSuggestions(suggestions.length > 0)}
          />
          
          <AnimatePresence>
            {showSuggestions && suggestions.length > 0 && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl border border-zinc-100 shadow-2xl overflow-hidden z-50 py-2"
              >
                {suggestions.map((s, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      setSearch(s);
                      setShowSuggestions(false);
                    }}
                    className="w-full text-left px-4 py-3 hover:bg-zinc-50 text-sm font-bold text-zinc-900 flex items-center gap-3 transition-colors"
                  >
                    <Search className="w-3.5 h-3.5 text-zinc-400" />
                    {s}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        <div className="flex gap-2 overflow-x-auto w-full sm:w-auto pb-2 sm:pb-0 scrollbar-hide no-scrollbar">
          {categories.map(c => (
            <Button 
              key={c}
              variant={category === c ? "default" : "outline"}
              size="sm"
              onClick={() => setCategory(c)}
              className={`${category === c ? "bg-zinc-900" : "text-zinc-600"} whitespace-nowrap h-8 sm:h-10 px-4 rounded-lg font-bold text-[10px] sm:text-xs uppercase tracking-widest`}
            >
              {c}
            </Button>
          ))}
        </div>
      </div>

      {/* Become a Seller Banner */}
      {user && profile?.role === 'customer' && (
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="p-8 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-3xl text-white flex flex-col md:flex-row items-center justify-between gap-6 shadow-xl shadow-blue-600/20"
        >
          <div className="space-y-2 text-center md:text-left">
            <h2 className="text-2xl font-black tracking-tight">Sell your books on Pustak! 📚</h2>
            <p className="text-blue-100 font-medium max-w-lg">Join our community of authors. Set your own price, keep your earnings, and reach thousands of readers.</p>
          </div>
          <Button 
            onClick={handleBecomeSeller}
            className="bg-white text-blue-600 hover:bg-zinc-100 h-14 px-8 rounded-2xl font-bold text-lg shadow-lg whitespace-nowrap"
          >
            Start Selling & Earn
          </Button>
        </motion.div>
      )}

      {/* Ebook Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-6">
        {filteredEbooks.map((ebook) => (
          <motion.div
            key={ebook.id}
            layout
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="group"
          >
            <Card className="overflow-hidden border-zinc-200 hover:shadow-xl transition-all duration-300 rounded-[1.5rem] bg-white flex flex-col h-full cursor-pointer relative" onClick={() => navigate(`/ebook/${ebook.id}`)}>
              <div className="relative aspect-[3/4] overflow-hidden block">
                {ebook.cover_url && (
                  <img 
                    src={ebook.cover_url} 
                    alt={ebook.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    referrerPolicy="no-referrer"
                  />
                )}
                <div className="absolute top-2 right-2 sm:top-3 sm:right-3 z-10">
                  <Button 
                    variant="secondary" 
                    size="icon" 
                    className={`rounded-full h-8 w-8 sm:h-10 sm:w-10 shadow-lg ${wishlist.includes(ebook.id) ? 'text-red-500' : 'text-zinc-400'}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      toggleWishlist(ebook.id);
                    }}
                  >
                    <Heart className={`w-3.5 h-3.5 sm:w-5 h-5 ${wishlist.includes(ebook.id) ? 'fill-current' : ''}`} />
                  </Button>
                </div>
                
                <div className="absolute bottom-2 left-2 z-10">
                   <Badge className="bg-black/60 backdrop-blur-md border-none text-[8px] sm:text-xs text-white">
                      {ebook.category}
                   </Badge>
                </div>
              </div>
              
              <div className="flex-1 flex flex-col p-2 sm:p-4">
                <div className="flex-1 space-y-1">
                  <h3 className="text-xs sm:text-sm font-black italic uppercase leading-tight line-clamp-1 group-hover:text-orange-600 transition-colors tracking-tight">
                    {ebook.title}
                  </h3>
                  <div className="flex items-center gap-1">
                    <span className="text-[8px] sm:text-[10px] font-bold text-zinc-400 uppercase tracking-widest truncate max-w-[80px]">
                      {ebook.author}
                    </span>
                    <div className="flex items-center text-orange-500 ml-auto">
                      <Star className="w-2.5 h-2.5 fill-current" />
                      <span className="text-[10px] font-black ml-0.5">{reviews[ebook.id]?.length > 0 ? (reviews[ebook.id].reduce((acc, r) => acc + r.rating, 0) / reviews[ebook.id].length).toFixed(1) : '5.0'}</span>
                    </div>
                  </div>
                </div>
                
                <div className="mt-2 pt-2 border-t border-zinc-50 flex items-center justify-between">
                   <span className="text-sm sm:text-lg font-black tracking-tighter">₹{ebook.price}</span>
                   <Button size="icon" className="h-7 w-7 sm:h-9 sm:w-9 bg-zinc-900 rounded-lg sm:rounded-xl">
                      <ShoppingCart className="w-3.5 h-3.5 sm:w-4 h-4 text-white" />
                   </Button>
                </div>
              </div>
            </Card>
          </motion.div>
        ))}
      </div>

      {filteredEbooks.length === 0 && (
        <div className="text-center py-20 space-y-4">
          <div className="w-20 h-20 bg-zinc-100 rounded-full flex items-center justify-center mx-auto">
            <Search className="w-8 h-8 text-zinc-300" />
          </div>
          <h3 className="text-xl font-bold text-zinc-900">No ebooks found</h3>
          <p className="text-zinc-500">Try adjusting your search or filters</p>
        </div>
      )}
    </div>
  );
}
