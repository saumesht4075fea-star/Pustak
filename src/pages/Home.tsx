import React, { useState, useEffect } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { User } from '@supabase/supabase-js';
import { motion } from 'motion/react';
import { Heart, ShoppingCart, Star, Search, Filter, MessageSquare, Download, ChevronLeft, ChevronRight, Smartphone, Youtube, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Ebook, Review, Profile } from '../types';
import { Link, useNavigate } from 'react-router-dom';
import { AnimatePresence } from 'motion/react';

const Typewriter = ({ text, delay = 50 }: { text: string, delay?: number }) => {
  const [currentText, setCurrentText] = useState('');
  const [index, setIndex] = useState(0);

  useEffect(() => {
    setCurrentText('');
    setIndex(0);
  }, [text]);

  useEffect(() => {
    if (index < text.length) {
      const timeout = setTimeout(() => {
        setCurrentText(prev => prev + text[index]);
        setIndex(prev => prev + 1);
      }, delay);
      return () => clearTimeout(timeout);
    }
  }, [index, text, delay]);

  return <span>{currentText}</span>;
};

export default function Home({ user, banners }: { user: User | null, banners: any[] | null }) {
  const [ebooks, setEbooks] = useState<Ebook[]>([]);
  const [courses, setCourses] = useState<any[]>([]);
  const [currentBannerIndex, setCurrentBannerIndex] = useState(0);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  const [productType, setProductType] = useState<'all' | 'ebook' | 'course'>('all');
  const [wishlist, setWishlist] = useState<string[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [reviews, setReviews] = useState<Record<string, Review[]>>({});
  const [profile, setProfile] = useState<Profile | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (search.trim().length > 1) {
      const filtered = products
        .filter(p => 
          p.title.toLowerCase().includes(search.toLowerCase()) || 
          (p.author || p.instructor || '').toLowerCase().includes(search.toLowerCase())
        )
        .slice(0, 5)
        .map(p => p.title);
      setSuggestions(Array.from(new Set(filtered)));
      setShowSuggestions(true);
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
    }
  }, [search, products]);

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

    const fetchProducts = async () => {
      try {
        const [{ data: ebData }, { data: cData }] = await Promise.all([
          supabase
            .from('ebooks')
            .select('*')
            .eq('is_deleted', false)
            .order('created_at', { ascending: false }),
          supabase
            .from('courses')
            .select('*')
            .order('created_at', { ascending: false })
        ]);

        const combined = [
          ...(ebData || []).map(e => ({ ...e, type: 'ebook' })),
          ...(cData || [])
            .filter(c => !c.ebook_id) // Only show stand-alone courses
            .map(c => ({ ...c, type: 'course', author: c.instructor }))
        ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

        setProducts(combined);
        setEbooks(ebData || []);
        setCourses((cData || []).filter(c => !c.ebook_id)); // Filter featured ones too
      } catch (err) {
        console.error('Error fetching products:', err);
      }
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

    fetchProducts();
    fetchReviews();

    const ebooksChannel = supabase
      .channel('ebooks_home')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ebooks' }, fetchProducts)
      .subscribe();

    const reviewsChannel = supabase
      .channel('reviews_home')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reviews' }, fetchReviews)
      .subscribe();

    return () => {
      supabase.removeChannel(ebooksChannel);
      supabase.removeChannel(reviewsChannel);
    };
  }, []);

  const [myCourses, setMyCourses] = useState<any[]>([]);
  const [courseProgress, setCourseProgress] = useState<Record<string, number>>({});

  useEffect(() => {
    if (user && isSupabaseConfigured) {
      const fetchMyCourses = async () => {
        try {
          const { data: coursesData } = await supabase.from('courses').select('*');
          const { data: ordersData } = await supabase
            .from('orders')
            .select('*')
            .eq('user_id', user.id)
            .in('status', ['success', 'completed']);

          if (ordersData && coursesData) {
            const myCoursesList = coursesData.filter(c => {
               const direct = ordersData.some(o => o.ebook_id === c.id);
               const viaEbook = c.ebook_id && ordersData.some(o => o.ebook_id === c.ebook_id);
               return direct || viaEbook;
            });
            setMyCourses(myCoursesList);

            if (myCoursesList.length > 0) {
              const accessibleIds = myCoursesList.map(c => c.id);
              const [{ data: progData }, { data: vidCount }] = await Promise.all([
                 supabase.from('course_video_progress').select('course_id, video_id').eq('user_id', user.id).eq('is_completed', true).in('course_id', accessibleIds),
                 supabase.from('course_videos').select('course_id, id').in('course_id', accessibleIds)
              ]);

              const progMap: Record<string, number> = {};
              accessibleIds.forEach(id => {
                const completed = progData?.filter(p => p.course_id === id).length || 0;
                const total = vidCount?.filter(v => v.course_id === id).length || 0;
                progMap[id] = total > 0 ? Math.round((completed / total) * 100) : 0;
              });
              setCourseProgress(progMap);
            }
          }
        } catch (err) {
          console.error('Error fetching my courses:', err);
        }
      };
      fetchMyCourses();
    }
  }, [user]);

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

  const filteredProducts = products.filter(p => {
    const matchesCategory = (category === 'All' || p.category === category);
    const matchesType = (productType === 'all' || p.type === productType);
    const searchTerm = search.toLowerCase();
    
    const matchesSearch = 
      p.title.toLowerCase().includes(searchTerm) || 
      (p.author || p.instructor || '').toLowerCase().includes(searchTerm) ||
      p.seller_id === search; 
      
    return matchesCategory && matchesType && matchesSearch;
  });

  useEffect(() => {
    if (!banners || banners.length <= 1) return;
    
    // Auto-slide only on mobile as requested
    const isMobile = window.innerWidth < 768;
    if (!isMobile) return;

    const interval = setInterval(() => {
      setCurrentBannerIndex((prev) => (prev + 1) % banners.length);
    }, 5000);

    return () => clearInterval(interval);
  }, [banners]);

  const categories = ['All', ...Array.from(new Set(products.map(p => p.category)))];

  const nextBanner = () => {
    if (!banners) return;
    setCurrentBannerIndex((prev) => (prev + 1) % banners.length);
  };

  const prevBanner = () => {
    if (!banners) return;
    setCurrentBannerIndex((prev) => (prev - 1 + banners.length) % banners.length);
  };

  return (
    <div className="space-y-8">
      {/* Hero Section */}
      {banners && banners.length > 0 && (
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
                  backgroundImage: `url(${banners[currentBannerIndex].image_url})`,
                  backgroundPosition: 'center',
                  backgroundSize: 'cover'
                }}
              />
              <img 
                src={banners[currentBannerIndex].image_url} 
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
                      {banners[currentBannerIndex].title && (
                        <Typewriter text={banners[currentBannerIndex].title} />
                      )}
                    </h1>
                  </motion.div>
                  <motion.p 
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.3 }}
                    className="text-zinc-300 text-sm sm:text-lg max-w-lg font-medium"
                  >
                    {banners[currentBannerIndex].subtitle || "Access thousands of premium ebooks from top authors. Knowledge is the best investment you'll ever make."}
                  </motion.p>
                  <motion.div
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.4 }}
                    className="flex gap-4"
                  >
                    <Button 
                      onClick={() => document.getElementById('search-section')?.scrollIntoView({ behavior: 'smooth' })}
                      className="bg-white text-zinc-900 hover:bg-zinc-200 h-10 sm:h-12 px-6 sm:px-8 rounded-xl font-black text-xs sm:text-sm shadow-xl active:scale-95 transition-transform"
                    >
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
      )}

      {/* Product Type Filter */}
      <div className="flex items-center gap-2 mb-4 p-1 bg-zinc-100 w-fit rounded-2xl">
        <Button 
          variant={productType === 'all' ? "default" : "ghost"}
          size="sm"
          onClick={() => setProductType('all')}
          className={`rounded-xl px-6 h-10 font-black text-xs uppercase tracking-widest ${productType === 'all' ? 'bg-zinc-900 text-white shadow-lg' : 'text-zinc-500 hover:text-zinc-900'}`}
        >
          Explore All
        </Button>
        <Button 
          variant={productType === 'course' ? "default" : "ghost"}
          size="sm"
          onClick={() => setProductType('course')}
          className={`rounded-xl px-6 h-10 font-black text-xs uppercase tracking-widest ${productType === 'course' ? 'bg-zinc-900 text-white shadow-lg' : 'text-zinc-500 hover:text-zinc-900'}`}
        >
          Masterclasses
        </Button>
        <Button 
          variant={productType === 'ebook' ? "default" : "ghost"}
          size="sm"
          onClick={() => setProductType('ebook')}
          className={`rounded-xl px-6 h-10 font-black text-xs uppercase tracking-widest ${productType === 'ebook' ? 'bg-zinc-900 text-white shadow-lg' : 'text-zinc-500 hover:text-zinc-900'}`}
        >
          Digital Books
        </Button>
      </div>

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

      {/* Resume Learning Section */}
      {user && myCourses.length > 0 && (
        <section className="space-y-6">
           <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                 <div className="w-10 h-10 bg-orange-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-orange-600/20">
                    <Play className="w-6 h-6 fill-current" />
                 </div>
                 <h2 className="text-xl font-black text-zinc-900 tracking-tight uppercase italic">Resume Your Learning</h2>
              </div>
              <Link to="/orders?tab=courses" className="text-[10px] font-black uppercase tracking-widest text-zinc-400 hover:text-orange-600 transition-colors">
                 View All Courses
              </Link>
           </div>
           <div className="flex gap-4 overflow-x-auto pb-4 no-scrollbar -mx-4 px-4 sm:mx-0 sm:px-0">
             {myCourses.map(course => (
               <Link 
                 key={course.id} 
                 to={`/course/${course.id}`}
                 className="flex-shrink-0 w-72 sm:w-80 group"
               >
                 <div className="bg-white rounded-[2rem] p-4 border border-zinc-100 hover:shadow-xl transition-all duration-300 flex items-center gap-4">
                    <img src={course.cover_url} className="w-16 h-16 rounded-2xl object-cover shadow-md" />
                    <div className="flex-1 min-w-0">
                       <h4 className="text-sm font-black uppercase italic tracking-tight truncate group-hover:text-orange-600 transition-colors">{course.title}</h4>
                       <div className="flex items-center justify-between mt-2">
                          <div className="flex-1 bg-zinc-100 h-1.5 rounded-full mr-3 overflow-hidden">
                             <div 
                               className="bg-orange-600 h-full rounded-full transition-all duration-1000" 
                               style={{ width: `${courseProgress[course.id] || 0}%` }} 
                             />
                          </div>
                          <span className="text-[10px] font-black italic text-zinc-400">{courseProgress[course.id] || 0}%</span>
                       </div>
                    </div>
                 </div>
               </Link>
             ))}
           </div>
        </section>
      )}

      {/* Become a Seller Banner or Complete Profile Banner */}
      {user && profile && !profile.avatar_url && (
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="p-8 bg-gradient-to-br from-orange-500 to-red-600 rounded-3xl text-white flex flex-col md:flex-row items-center justify-between gap-6 shadow-xl shadow-orange-600/20"
        >
          <div className="space-y-2 text-center md:text-left">
            <h2 className="text-2xl font-black tracking-tight flex items-center justify-center md:justify-start gap-3">
              <Smartphone className="w-8 h-8" />
              Complete Your Profile! 📸
            </h2>
            <p className="text-orange-50/80 font-medium max-w-lg">Add a profile photo to your account. Users with photos are 5x more likely to be trusted by authors and buyers.</p>
          </div>
          <Link to="/profile">
            <Button 
              className="bg-white text-orange-600 hover:bg-zinc-100 h-14 px-8 rounded-2xl font-bold text-lg shadow-lg whitespace-nowrap"
            >
              Upload Photo Now
            </Button>
          </Link>
        </motion.div>
      )}

      {/* Featured Courses Section */}
      {courses.length > 0 && (
        <section className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-zinc-900 rounded-xl flex items-center justify-center text-white">
                <Youtube className="w-6 h-6" />
              </div>
              <h2 className="text-xl font-black text-zinc-900 tracking-tight uppercase italic">Featured Mastery Courses</h2>
            </div>
          </div>
          
          <div className="overflow-x-auto pb-6 scrollbar-hide no-scrollbar -mx-4 px-4 sm:mx-0 sm:px-0">
             <div className="flex gap-6 min-w-max">
                {courses.map(course => (
                  <Link 
                    key={course.id} 
                    to={`/course/${course.id}`}
                    className="w-[280px] sm:w-[350px] group block"
                  >
                    <div className="relative aspect-[16/10] rounded-[2rem] overflow-hidden shadow-xl mb-4">
                       <img src={course.cover_url} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
                       <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <div className="w-12 h-12 rounded-full bg-orange-600 flex items-center justify-center translate-y-4 group-hover:translate-y-0 transition-transform">
                             <Play className="w-6 h-6 text-white fill-white ml-1" />
                          </div>
                       </div>
                       <div className="absolute top-4 left-4">
                          <Badge className="bg-orange-600 text-white border-none rounded-lg text-[10px] font-black uppercase tracking-widest px-2 py-1">₹{course.price}</Badge>
                       </div>
                    </div>
                    <div className="space-y-1">
                      <Badge className="bg-zinc-100 text-zinc-500 border-none rounded-md text-[8px] font-black uppercase tracking-widest">{course.category}</Badge>
                      <h3 className="text-lg font-black text-zinc-900 line-clamp-1 group-hover:text-orange-600 transition-colors uppercase italic">{course.title}</h3>
                      <div className="flex items-center gap-2">
                         <div className="flex -space-x-2">
                            {[1,2,3].map(i => <div key={i} className="w-5 h-5 rounded-full border-2 border-white bg-zinc-100" />)}
                         </div>
                         <p className="text-[10px] font-bold text-zinc-400">Join 1k+ students</p>
                      </div>
                    </div>
                  </Link>
                ))}
             </div>
          </div>
        </section>
      )}

      {/* Product Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-6">
        {filteredProducts.map((product) => (
          <motion.div
            key={`${product.type}-${product.id}`}
            layout
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="group"
          >
            <Card 
              className="overflow-hidden border-zinc-200 hover:shadow-xl transition-all duration-300 rounded-[1.5rem] bg-white flex flex-col h-full cursor-pointer relative" 
              onClick={() => navigate(product.type === 'ebook' ? `/ebook/${product.id}` : `/course/${product.id}`)}
            >
              <div className="relative aspect-[3/4] overflow-hidden block">
                {product.cover_url && (
                  <img 
                    src={product.cover_url} 
                    alt={product.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    referrerPolicy="no-referrer"
                  />
                )}
                <div className="absolute top-2 right-2 sm:top-3 sm:right-3 z-10">
                  {product.type === 'ebook' && (
                    <Button 
                      variant="secondary" 
                      size="icon" 
                      className={`rounded-full h-8 w-8 sm:h-10 sm:w-10 shadow-lg ${wishlist.includes(product.id) ? 'text-red-500' : 'text-zinc-400'}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        toggleWishlist(product.id);
                      }}
                    >
                      <Heart className={`w-3.5 h-3.5 sm:w-5 h-5 ${wishlist.includes(product.id) ? 'fill-current' : ''}`} />
                    </Button>
                  )}
                </div>
                
                <div className="absolute bottom-2 left-2 z-10 flex flex-col gap-1">
                   <Badge className={`${product.type === 'course' ? 'bg-zinc-900' : 'bg-orange-600'} border-none text-[8px] sm:text-[10px] text-white font-black uppercase tracking-tighter`}>
                      {product.type === 'course' ? 'Masterclass' : 'Ebook'}
                   </Badge>
                   <Badge className="bg-black/60 backdrop-blur-md border-none text-[8px] sm:text-[9px] text-white">
                      {product.category}
                   </Badge>
                </div>
              </div>
              
              <div className="flex-1 flex flex-col p-2 sm:p-4">
                <div className="flex-1 space-y-1">
                  <h3 className="text-xs sm:text-sm font-black italic uppercase leading-tight line-clamp-1 group-hover:text-orange-600 transition-colors tracking-tight">
                    {product.title}
                  </h3>
                  <div className="flex items-center gap-1">
                    <span className="text-[8px] sm:text-[10px] font-bold text-zinc-400 uppercase tracking-widest truncate max-w-[80px]">
                      {product.author || product.instructor}
                    </span>
                    <div className="flex items-center text-orange-500 ml-auto">
                      <Star className="w-2.5 h-2.5 fill-current" />
                      <span className="text-[10px] font-black ml-0.5">{reviews[product.id]?.length > 0 ? (reviews[product.id].reduce((acc, r) => acc + r.rating, 0) / reviews[product.id].length).toFixed(1) : '5.0'}</span>
                    </div>
                  </div>
                </div>
                
                <div className="mt-2 pt-2 border-t border-zinc-50 flex items-center justify-between">
                   <span className="text-sm sm:text-lg font-black tracking-tighter">₹{product.price}</span>
                   <Button size="icon" className="h-7 w-7 sm:h-9 sm:w-9 bg-zinc-900 rounded-lg sm:rounded-xl">
                      {product.type === 'course' ? <Play className="w-3.5 h-3.5 sm:w-4 h-4 text-white fill-current" /> : <ShoppingCart className="w-3.5 h-3.5 sm:w-4 h-4 text-white" />}
                   </Button>
                </div>
              </div>
            </Card>
          </motion.div>
        ))}
      </div>

      {filteredProducts.length === 0 && (
        <div className="text-center py-20 space-y-4">
          <div className="w-20 h-20 bg-zinc-100 rounded-full flex items-center justify-center mx-auto">
            <Search className="w-8 h-8 text-zinc-300" />
          </div>
          <h3 className="text-xl font-bold text-zinc-900">No products found</h3>
          <p className="text-zinc-500">Try adjusting your search or filters</p>
        </div>
      )}
    </div>
  );
}
