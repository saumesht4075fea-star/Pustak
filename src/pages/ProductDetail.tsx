import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Ebook, Review } from '../types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Star, MessageSquare, Heart, ArrowLeft, ShoppingBag, ShieldCheck, Plus } from 'lucide-react';
import { motion } from 'motion/react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

export default function ProductDetail({ user }: { user: any }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const [ebook, setEbook] = useState<Ebook | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [wishlist, setWishlist] = useState<string[]>([]);
  const [isReviewOpen, setIsReviewOpen] = useState(false);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);

  useEffect(() => {
    if (id) {
      fetchEbook();
      fetchReviews();
      if (user) fetchWishlist();
    }
  }, [id, user]);

  const fetchEbook = async () => {
    const { data, error } = await supabase
      .from('ebooks')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error) {
      toast.error('Ebook not found');
      navigate('/');
    } else {
      setEbook(data);
    }
    setLoading(false);
  };

  const fetchReviews = async () => {
    const { data } = await supabase
      .from('reviews')
      .select('*')
      .eq('ebook_id', id)
      .order('created_at', { ascending: false });
    
    if (data) setReviews(data);
  };

  const fetchWishlist = async () => {
    const { data } = await supabase
      .from('wishlist')
      .select('ebook_id')
      .eq('user_id', user.id);
    
    if (data) setWishlist(data.map(w => w.ebook_id));
  };

  const toggleWishlist = async () => {
    if (!user) {
      toast.error('Please login to add to wishlist');
      return;
    }

    const isInWishlist = wishlist.includes(ebook!.id);
    if (isInWishlist) {
      await supabase.from('wishlist').delete().eq('user_id', user.id).eq('ebook_id', ebook!.id);
      setWishlist(wishlist.filter(id => id !== ebook!.id));
      toast.success('Removed from wishlist');
    } else {
      await supabase.from('wishlist').insert({ user_id: user.id, ebook_id: ebook!.id });
      setWishlist([...wishlist, ebook!.id]);
      toast.success('Added to wishlist');
    }
  };

  const handlePurchase = (ebook: Ebook) => {
    if (!user) {
      toast.error('Please login to purchase');
      return;
    }
    window.open(ebook.cosmofeed_url, '_blank');
  };

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      toast.error('Please login to review');
      return;
    }
    if (!comment.trim()) {
      toast.error('Please enter a comment');
      return;
    }

    setSubmittingReview(true);
    try {
      const { error } = await supabase
        .from('reviews')
        .insert({
          user_id: user.id,
          user_name: user.user_metadata.display_name || user.email?.split('@')[0],
          ebook_id: id,
          rating,
          comment,
          created_at: new Date().toISOString()
        });
      
      if (error) throw error;

      toast.success('Review submitted! Thank you.');
      setIsReviewOpen(false);
      setComment('');
      setRating(5);
      fetchReviews();
    } catch (error) {
      toast.error('Failed to submit review');
    } finally {
      setSubmittingReview(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-4 border-orange-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!ebook) return null;

  const averageRating = reviews.length > 0 
    ? (reviews.reduce((acc, r) => acc + r.rating, 0) / reviews.length).toFixed(1)
    : "5.0";

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <Button 
        variant="ghost" 
        className="mb-8 gap-2 text-zinc-600 hover:text-zinc-900"
        onClick={() => navigate(-1)}
      >
        <ArrowLeft className="w-4 h-4" />
        Back
      </Button>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
        {/* Left: Image */}
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="relative aspect-[3/4] rounded-3xl overflow-hidden shadow-2xl bg-white border border-zinc-100"
        >
          <img 
            src={ebook.cover_url} 
            alt={ebook.title}
            className="w-full h-full object-cover"
            referrerPolicy="no-referrer"
          />
          <div className="absolute top-6 right-6">
            <Button 
              variant="secondary" 
              size="icon" 
              className={`rounded-full shadow-xl w-12 h-12 ${wishlist.includes(ebook.id) ? 'text-red-500' : 'text-zinc-400'}`}
              onClick={toggleWishlist}
            >
              <Heart className={`w-6 h-6 ${wishlist.includes(ebook.id) ? 'fill-current' : ''}`} />
            </Button>
          </div>
        </motion.div>

        {/* Right: Content */}
        <motion.div 
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="space-y-8"
        >
          <div className="space-y-4">
            <Badge className="bg-orange-100 text-orange-700 hover:bg-orange-200 border-none px-4 py-1 text-sm font-medium uppercase tracking-wider">
              {ebook.category}
            </Badge>
            <h1 className="text-4xl md:text-5xl font-black tracking-tight text-zinc-900 leading-tight">
              {ebook.title}
            </h1>
            <p className="text-xl text-zinc-500 font-medium">by <span className="text-zinc-900">{ebook.author}</span></p>
            
            <div className="flex items-center gap-6 py-2">
              <div className="flex items-center gap-2">
                <div className="flex gap-0.5">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className={`w-5 h-5 ${i < Math.round(Number(averageRating)) ? 'text-orange-500 fill-current' : 'text-zinc-200'}`} />
                  ))}
                </div>
                <span className="font-bold text-lg">{averageRating}</span>
              </div>
              <div className="h-6 w-[1px] bg-zinc-200" />
              <div className="flex items-center gap-2 text-zinc-500">
                <MessageSquare className="w-5 h-5" />
                <span className="font-medium">{reviews.length} Reviews</span>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-lg font-bold text-zinc-900">About this ebook</h3>
            <p className="text-zinc-600 leading-relaxed text-lg whitespace-pre-wrap">
              {ebook.description}
            </p>
          </div>

          <div className="p-6 bg-zinc-900 rounded-3xl text-white flex items-center justify-between gap-6 shadow-xl">
            <div>
              <p className="text-zinc-400 text-sm font-medium mb-1">Price</p>
              <p className="text-3xl font-black">₹{ebook.price}</p>
            </div>
            <Button 
              size="lg"
              className="flex-1 bg-orange-600 hover:bg-orange-700 text-white h-14 text-lg font-bold rounded-2xl gap-2 shadow-lg shadow-orange-600/20"
              onClick={() => handlePurchase(ebook)}
            >
              <ShoppingBag className="w-5 h-5" />
              Buy Now
            </Button>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 bg-zinc-50 rounded-2xl border border-zinc-100 flex items-center gap-3">
              <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm">
                <ShieldCheck className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-xs text-zinc-500 font-medium">Secure Payment</p>
                <p className="text-sm font-bold">Cosmofeed</p>
              </div>
            </div>
            <div className="p-4 bg-zinc-50 rounded-2xl border border-zinc-100 flex items-center gap-3">
              <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm">
                <BookOpen className="w-5 h-5 text-orange-600" />
              </div>
              <div>
                <p className="text-xs text-zinc-500 font-medium">Format</p>
                <p className="text-sm font-bold">PDF/EPUB</p>
              </div>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Reviews Section */}
      <div className="mt-20 space-y-8">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-black text-zinc-900">Reader Reviews</h2>
          <Dialog open={isReviewOpen} onOpenChange={setIsReviewOpen}>
            <DialogTrigger asChild>
              <Button className="bg-zinc-900 hover:bg-zinc-800 gap-2">
                <Plus className="w-4 h-4" />
                Write a Review
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Review this ebook</DialogTitle>
                <DialogDescription>
                  Share your thoughts with other readers.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmitReview} className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Rating</Label>
                  <div className="flex gap-2">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setRating(s)}
                        className="focus:outline-none transition-transform hover:scale-110"
                      >
                        <Star className={`w-8 h-8 ${s <= rating ? 'text-orange-500 fill-current' : 'text-zinc-200'}`} />
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="comment">Your Review</Label>
                  <Textarea 
                    id="comment" 
                    placeholder="What did you think about this book?"
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    className="min-h-[100px]"
                  />
                </div>
                <Button 
                  type="submit" 
                  className="w-full bg-orange-600 hover:bg-orange-700"
                  disabled={submittingReview}
                >
                  {submittingReview ? 'Submitting...' : 'Submit Review'}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {reviews.map((r, i) => (
            <motion.div 
              key={i}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className="p-6 bg-white rounded-3xl border border-zinc-100 shadow-sm space-y-4"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-zinc-100 rounded-full flex items-center justify-center font-bold text-zinc-600">
                    {r.user_name[0]}
                  </div>
                  <div>
                    <p className="font-bold text-zinc-900">{r.user_name}</p>
                    <p className="text-xs text-zinc-400">{new Date(r.created_at).toLocaleDateString()}</p>
                  </div>
                </div>
                <div className="flex gap-0.5">
                  {[...Array(5)].map((_, idx) => (
                    <Star key={idx} className={`w-3 h-3 ${idx < r.rating ? 'text-orange-500 fill-current' : 'text-zinc-200'}`} />
                  ))}
                </div>
              </div>
              <p className="text-zinc-600 leading-relaxed italic">"{r.comment}"</p>
            </motion.div>
          ))}
          {reviews.length === 0 && (
            <div className="col-span-full text-center py-12 bg-zinc-50 rounded-3xl border-2 border-dashed border-zinc-200">
              <p className="text-zinc-500 font-medium">No reviews yet. Be the first to share your thoughts!</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function BookOpen(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
      <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
    </svg>
  );
}
