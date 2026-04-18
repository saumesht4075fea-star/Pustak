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
import { Ebook, Review } from '../types';
import { Link } from 'react-router-dom';

export default function Home({ user }: { user: User | null }) {
  const [ebooks, setEbooks] = useState<Ebook[]>([]);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  const [wishlist, setWishlist] = useState<string[]>([]);
  const [reviews, setReviews] = useState<Record<string, Review[]>>({});

  useEffect(() => {
    const fetchEbooks = async () => {
      const { data, error } = await supabase
        .from('ebooks')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (data) setEbooks(data);
      if (error) {
        console.error(error);
        if (error.message === 'Failed to fetch') {
          toast.error('Could not connect to database. Please check your Supabase URL in Secrets.');
        } else {
          toast.error('Failed to load ebooks');
        }
      }
    };

    fetchEbooks();

    // Real-time subscription
    const channel = supabase
      .channel('ebooks_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ebooks' }, fetchEbooks)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    const fetchReviews = async () => {
      const { data, error } = await supabase
        .from('reviews')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (data) {
        const revs: Record<string, Review[]> = {};
        data.forEach(r => {
          if (!revs[r.ebook_id]) revs[r.ebook_id] = [];
          revs[r.ebook_id].push(r);
        });
        setReviews(revs);
      }
      if (error) console.error(error);
    };

    fetchReviews();

    const channel = supabase
      .channel('reviews_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reviews' }, fetchReviews)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    if (user) {
      const fetchWishlist = async () => {
        const { data, error } = await supabase
          .from('wishlist')
          .select('ebook_id')
          .eq('user_id', user.id);
        
        if (data) setWishlist(data.map(item => item.ebook_id));
        if (error) console.error(error);
      };

      fetchWishlist();

      const channel = supabase
        .channel('wishlist_changes')
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

    const { data: existing } = await supabase
      .from('wishlist')
      .select('id')
      .eq('user_id', user.id)
      .eq('ebook_id', ebookId)
      .single();

    if (!existing) {
      const { error } = await supabase
        .from('wishlist')
        .insert({
          user_id: user.id,
          ebook_id: ebookId,
          created_at: new Date().toISOString()
        });
      if (!error) toast.success('Added to wishlist');
    } else {
      const { error } = await supabase
        .from('wishlist')
        .delete()
        .eq('id', existing.id);
      if (!error) toast.success('Removed from wishlist');
    }
  };

  const handlePurchase = async (ebook: Ebook) => {
    if (!user) {
      toast.error('Please login to purchase');
      return;
    }

    if (ebook.cosmofeed_url) {
      // Redirect to Cosmofeed payment link
      window.open(ebook.cosmofeed_url, '_blank');
      toast.info('Redirecting to Cosmofeed for payment...');
    } else {
      toast.error('Payment link not available for this ebook.');
    }
  };

  const filteredEbooks = ebooks.filter(e => 
    (category === 'All' || e.category === category) &&
    (e.title.toLowerCase().includes(search.toLowerCase()) || e.author.toLowerCase().includes(search.toLowerCase()))
  );

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
        </div>
      </section>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between bg-white p-4 rounded-2xl border border-zinc-200 shadow-sm">
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
            <Card className="overflow-hidden border-zinc-200 hover:shadow-xl transition-all duration-300 rounded-2xl bg-white flex flex-col h-full">
              <Link to={`/ebook/${ebook.id}`} className="relative aspect-[3/4] overflow-hidden block">
                <img 
                  src={ebook.cover_url} 
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
                      e.preventDefault();
                      toggleWishlist(ebook.id);
                    }}
                  >
                    <Heart className={`w-5 h-5 ${wishlist.includes(ebook.id) ? 'fill-current' : ''}`} />
                  </Button>
                </div>
                <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent sm:translate-y-full sm:group-hover:translate-y-0 transition-transform duration-300 flex gap-2 z-10">
                  <Button 
                    className="flex-1 bg-orange-600 hover:bg-orange-700 text-white"
                    onClick={(e) => {
                      e.preventDefault();
                      handlePurchase(ebook);
                    }}
                  >
                    Buy Now • ₹{ebook.price}
                  </Button>
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button 
                        variant="secondary" 
                        size="icon" 
                        className="bg-white/20 backdrop-blur-md text-white border-white/20 hover:bg-white/40"
                        onClick={(e) => e.preventDefault()}
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
              </Link>
              <div className="flex-1 flex flex-col">
                <CardHeader className="p-4 pb-0">
                  <Badge variant="secondary" className="w-fit mb-2 text-[10px] uppercase tracking-wider">{ebook.category}</Badge>
                  <Link to={`/ebook/${ebook.id}`}>
                    <CardTitle className="text-lg font-bold line-clamp-1 tracking-tight hover:text-orange-600 transition-colors">{ebook.title}</CardTitle>
                  </Link>
                  <p className="text-sm text-zinc-500 font-medium">by {ebook.author}</p>
                </CardHeader>
                <CardContent className="p-4 flex-1">
                  <p className="text-xs text-zinc-600 line-clamp-2 leading-relaxed">
                    {ebook.description}
                  </p>
                </CardContent>
                <CardFooter className="p-4 pt-0 flex flex-col gap-3">
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
                  
                  <Button 
                    className="w-full bg-orange-600 hover:bg-orange-700 text-white sm:hidden shadow-lg shadow-orange-600/20"
                    onClick={() => handlePurchase(ebook)}
                  >
                    Buy Now
                  </Button>
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
