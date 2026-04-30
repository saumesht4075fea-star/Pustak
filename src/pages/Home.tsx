import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { User } from '@supabase/supabase-js';
import { motion } from 'motion/react';
import { Heart, ShoppingCart, Star, Search, Filter, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Ebook, Review, Profile } from '../types';
import { Link, useNavigate } from 'react-router-dom';

export default function Home({ user }: { user: User | null }) {
  const [ebooks, setEbooks] = useState<Ebook[]>([]);
  const [search, setSearch] = useState('');
  const [referralInput, setReferralInput] = useState('');
  const [category, setCategory] = useState('All');
  const [wishlist, setWishlist] = useState<string[]>([]);
  const [reviews, setReviews] = useState<Record<string, Review[]>>({});
  const [profile, setProfile] = useState<Profile | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (user) {
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
    const fetchEbooks = async () => {
      const { data } = await supabase
        .from('ebooks')
        .select('*')
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

    const ebooksChannel = supabase
      .channel('ebooks_home')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ebooks' }, fetchEbooks)
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

  useEffect(() => {
    if (user) {
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

  const [activeReferrer, setActiveReferrer] = useState<Profile | null>(null);

  const handleReferralSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!referralInput.trim()) return;

    const input = referralInput.trim();
    // More relaxed UUID regex to handle all variants
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    try {
      // 1. Check if it's a full URL (legacy support or accidental paste)
      if (input.includes('/ebook/')) {
        const urlString = input.startsWith('http') ? input : `https://${input}`;
        const url = new URL(urlString);
        const pathParts = url.pathname.split('/');
        const ebookIdIndex = pathParts.indexOf('ebook');
        const ebookId = ebookIdIndex !== -1 ? pathParts[ebookIdIndex + 1] : null;
        const refId = url.searchParams.get('ref');
        
        if (ebookId) {
          if (refId) localStorage.setItem(`ref_${ebookId}`, refId);
          navigate(`/ebook/${ebookId}`);
          return;
        }
      }

      // 2. Check if it's a REF- style code
      if (input.startsWith('REF-')) {
        const { data: orderData } = await supabase
          .from('orders')
          .select('user_id, ebook_id')
          .eq('referral_code', input)
          .limit(1);

        if (orderData && orderData.length > 0) {
          localStorage.setItem('global_session_referrer', orderData[0].user_id);
          
          // Track the referral application
          supabase.from('referral_tracking').insert({
            referrer_id: orderData[0].user_id,
            created_at: new Date().toISOString()
          }).then();

          toast.success('Referral Code Activated!');
          // If it's specific to an ebook, navigate there
          navigate(`/ebook/${orderData[0].ebook_id}?ref=${input}`);
          return;
        }
      }

      // 3. Check if it matches a profile display name (slugified)
      const { data: profiles } = await supabase
        .from('profiles')
        .select('*');
      
      const match = profiles?.find(p => 
        p.display_name?.replace(/\s+/g, '').toLowerCase() === input.toLowerCase()
      );

      if (match) {
        localStorage.setItem('global_session_referrer', match.uid);
        setActiveReferrer(match as Profile);
        
        // Track the referral application
        supabase.from('referral_tracking').insert({
          referrer_id: match.uid,
          created_at: new Date().toISOString()
        }).then();

        toast.success(`Referral Activated! You are now supporting ${match.display_name}.`);
        setReferralInput('');
        return;
      }

      // 4. Check if it's a valid UUID
      if (uuidRegex.test(input)) {
        // First check if it's an eBook ID directly
        const existingEbook = ebooks.find(eb => eb.id === input);
        if (existingEbook) {
          navigate(`/ebook/${existingEbook.id}`);
          return;
        }

        // If not an ebook, check if it's a Profile UID
        const { data: prof, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('uid', input)
          .single();

        if (prof && !error) {
          localStorage.setItem('global_session_referrer', prof.uid);
          setActiveReferrer(prof as Profile);
          
          // Track the referral application
          supabase.from('referral_tracking').insert({
            referrer_id: prof.uid,
            created_at: new Date().toISOString()
          }).then();

          toast.success(`Referral Activated! You are now supporting ${prof.display_name}.`);
          setReferralInput('');
          return;
        }
      }
      
      toast.error('Invalid referral code, username or ID');
    } catch (err: any) {
      toast.error(err.message || 'Error occurred');
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

  const categories = ['All', ...Array.from(new Set(ebooks.map(e => e.category)))];

  return (
    <div className="space-y-8">
      {/* Hero Section */}
      <section className="relative h-[400px] rounded-3xl overflow-hidden bg-zinc-900 flex items-center px-8 sm:px-16">
        <div className="absolute inset-0 opacity-40">
          <img 
            src="https://images.unsplash.com/photo-1524995997946-a1c2e315a42f?auto=format&fit=crop&w=1920&q=80" 
            alt="Library" 
            className="w-full h-full object-cover"
            referrerPolicy="no-referrer"
          />
        </div>
        <div className="relative z-10 max-w-2xl space-y-6">
          <Badge className="bg-orange-600 hover:bg-orange-600 text-white border-none px-4 py-1">New Arrivals</Badge>
          <h1 className="text-5xl sm:text-7xl font-bold text-white tracking-tighter leading-none">
            Discover Your Next <span className="text-orange-500">Great Read.</span>
          </h1>
          <p className="text-zinc-300 text-lg max-w-lg">
            Access thousands of premium ebooks from Indian and international authors. 
            Instant delivery, lifetime access.
          </p>

          <div className="hidden md:block bg-white/5 border border-white/10 p-4 rounded-2xl backdrop-blur-sm">
            <p className="text-[10px] text-zinc-400 font-black uppercase tracking-[0.2em] mb-2">🔥 Trending now</p>
            <div className="flex gap-3 overflow-x-auto pb-1 text-xs font-bold text-white whitespace-nowrap">
              <span>#SelfImprovement</span>
              <span>#Business</span>
              <span>#Fiction</span>
            </div>
          </div>
        </div>
      </section>

      {/* Referral Code Bar */}
      <section className="bg-orange-50 border border-orange-100 rounded-[2rem] p-6 shadow-sm">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="space-y-1 text-center md:text-left">
            <h3 className="text-xl font-black italic uppercase text-orange-900 tracking-tight flex items-center gap-2">
              <Star className="w-5 h-5 fill-orange-500 text-orange-500" />
              Have a Referral Code?
            </h3>
            <p className="text-sm text-orange-700 font-medium opacity-80">Enter the unique code shared by your friend to support them!</p>
          </div>
          
          <form onSubmit={handleReferralSearch} className="w-full md:w-[400px] relative">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-orange-300" />
                <Input 
                  placeholder="Enter Code (e.g. REF-ABCDE)" 
                  className="h-14 pl-10 bg-white border-orange-200 text-zinc-900 font-bold placeholder:text-zinc-400 rounded-2xl focus:ring-orange-200"
                  value={referralInput}
                  onChange={(e) => setReferralInput(e.target.value.toUpperCase())}
                />
              </div>
              <Button type="submit" className="h-14 px-8 bg-zinc-900 hover:bg-black text-white rounded-2xl font-black uppercase italic tracking-wider">
                Apply
              </Button>
            </div>
          </form>
        </div>
      </section>

      {/* Active Referral Notice */}
      {activeReferrer && (
        <motion.div 
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          className="bg-blue-600/10 border-l-4 border-blue-600 p-4 rounded-r-2xl flex items-center justify-between"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold text-lg">
              {activeReferrer.display_name?.[0].toUpperCase()}
            </div>
            <div>
              <p className="text-sm font-bold text-blue-900 tracking-tight">Referral Code Applied: {activeReferrer.display_name}</p>
              <p className="text-[10px] text-blue-600 font-bold uppercase tracking-widest">You are currently supporting this member</p>
            </div>
          </div>
          <Button 
            variant="ghost" 
            size="sm" 
            className="text-blue-600 hover:bg-blue-600/10 font-black text-[10px]"
            onClick={() => {
              setActiveReferrer(null);
              setSearch('');
              localStorage.removeItem('global_session_referrer');
              toast.info('Referral cleared');
            }}
          >
            CLEAR REFERRAL
          </Button>
        </motion.div>
      )}

      {/* Filters */}
      <div id="search-section" className="flex flex-col sm:flex-row gap-4 items-center justify-between bg-white p-4 rounded-2xl border border-zinc-200 shadow-sm">
        <div className="relative w-full sm:w-96">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
          <Input 
            placeholder="Search by title or author..." 
            className="pl-10 bg-zinc-50 border-zinc-200"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex gap-2 overflow-x-auto w-full sm:w-auto pb-2 sm:pb-0">
          {categories.map(c => (
            <Button 
              key={c}
              variant={category === c ? "default" : "outline"}
              size="sm"
              onClick={() => setCategory(c)}
              className={category === c ? "bg-zinc-900" : "text-zinc-600"}
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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {filteredEbooks.map((ebook) => (
          <motion.div
            key={ebook.id}
            layout
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="group"
          >
            <Card className="overflow-hidden border-zinc-200 hover:shadow-xl transition-all duration-300 rounded-2xl bg-white flex flex-col h-full cursor-pointer" onClick={() => navigate(`/ebook/${ebook.id}`)}>
              <div className="relative aspect-[3/4] overflow-hidden block">
                <img 
                  src={ebook.cover_url || undefined} 
                  alt={ebook.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute top-3 right-3 z-10">
                  <Button 
                    variant="secondary" 
                    size="icon" 
                    className={`rounded-full shadow-lg ${wishlist.includes(ebook.id) ? 'text-red-500' : 'text-zinc-400'}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      toggleWishlist(ebook.id);
                    }}
                  >
                    <Heart className={`w-5 h-5 ${wishlist.includes(ebook.id) ? 'fill-current' : ''}`} />
                  </Button>
                </div>
                <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent sm:translate-y-full sm:group-hover:translate-y-0 transition-transform duration-300 flex gap-2 z-10">
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button 
                        variant="secondary" 
                        size="icon" 
                        className="bg-white/20 backdrop-blur-md text-white border-white/20 hover:bg-white/40 absolute bottom-4 right-4"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <MessageSquare className="w-4 h-4" />
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-md" onClick={(e) => e.stopPropagation()}>
                      <DialogHeader>
                        <DialogTitle>Reviews for {ebook.title}</DialogTitle>
                        <DialogDescription>
                          See what other readers are saying about this ebook.
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2">
                        {reviews[ebook.id]?.map((r, i) => (
                          <div key={i} className="space-y-1 border-b border-zinc-100 pb-3 last:border-0">
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-sm">{r.user_name}</span>
                              <div className="flex items-center gap-0.5 text-orange-500">
                                {[...Array(5)].map((_, idx) => (
                                  <Star key={idx} className={`w-3 h-3 ${idx < r.rating ? 'fill-current' : 'text-zinc-200'}`} />
                                ))}
                              </div>
                            </div>
                            <p className="text-sm text-zinc-600 leading-relaxed">{r.comment}</p>
                            <p className="text-[10px] text-zinc-400">{new Date(r.created_at).toLocaleDateString()}</p>
                          </div>
                        ))}
                        {(!reviews[ebook.id] || reviews[ebook.id].length === 0) && (
                          <p className="text-center py-10 text-zinc-500 text-sm">No reviews yet. Be the first to review!</p>
                        )}
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              </div>
              <div className="flex-1 flex flex-col">
                <CardHeader className="p-4 pb-0">
                  <CardTitle className="text-lg font-bold line-clamp-1 tracking-tight hover:text-orange-600 transition-colors">{ebook.title}</CardTitle>
                  <p className="text-sm text-zinc-500 font-medium">by {ebook.author}</p>
                </CardHeader>
                <CardContent className="p-4 flex-1">
                  <p className="text-xs text-zinc-600 line-clamp-2 leading-relaxed">
                    {ebook.description}
                  </p>
                </CardContent>
                <CardFooter className="p-4 pt-0">
                  <div className="flex items-center justify-between w-full">
                    <div className="flex items-center gap-1 text-orange-500">
                      <Star className="w-4 h-4 fill-current" />
                      <span className="text-sm font-bold text-zinc-900">
                        {reviews[ebook.id]?.length > 0 
                          ? (reviews[ebook.id].reduce((acc, r) => acc + r.rating, 0) / reviews[ebook.id].length).toFixed(1)
                          : 'New'}
                      </span>
                      <span className="text-[10px] text-zinc-400 font-medium ml-1">
                        ({reviews[ebook.id]?.length || 0})
                      </span>
                    </div>
                    <span className="text-xl font-black text-zinc-900">₹{ebook.price}</span>
                  </div>
                </CardFooter>
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
