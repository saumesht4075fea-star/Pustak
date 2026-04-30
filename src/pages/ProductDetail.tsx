import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { User } from '@supabase/supabase-js';
import { Ebook, Review, Profile } from '../types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Star, MessageSquare, Heart, ArrowLeft, ShoppingBag, ShieldCheck, Plus, Share2, Copy, Check, ArrowRight, Loader2, TrendingUp, BadgeCheck } from 'lucide-react';
import { motion } from 'motion/react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

export default function ProductDetail({ user, isAdmin, isSeller }: { user: User | null; isAdmin: boolean; isSeller: boolean }) {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [ebook, setEbook] = useState<Ebook | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [wishlist, setWishlist] = useState<string[]>([]);
  const [isReviewOpen, setIsReviewOpen] = useState(false);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);
  const [copied, setCopied] = useState(false);
  const [hasPurchased, setHasPurchased] = useState(false);
  const [hasAnyOrders, setHasAnyOrders] = useState(false);
  const [checkingPurchase, setCheckingPurchase] = useState(true);

  const [referralCodeInput, setReferralCodeInput] = useState('');
  const [isVerifyingCode, setIsVerifyingCode] = useState(false);
  const [referralCodeError, setReferralCodeError] = useState('');
  const [appliedReferrerId, setAppliedReferrerId] = useState<string | null>(null);

  const verifyCode = async (code: string) => {
    if (!code) return;
    setIsVerifyingCode(true);
    setReferralCodeError('');
    setAppliedReferrerId(null); // Clear previous match if any
    
    // UUID regex to check for direct UIDs
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    try {
      // 1. Direct UID matching
      if (uuidRegex.test(code)) {
        if (code === user?.id) {
          setReferralCodeError('Cannot refer yourself');
          setIsVerifyingCode(false);
          return;
        }

        const { data: prof, error } = await supabase
          .from('profiles')
          .select('uid')
          .eq('uid', code)
          .single();
        
        if (prof && !error) {
          setAppliedReferrerId(prof.uid);
          
          // Track click
          supabase.from('referral_tracking').insert({
            referrer_id: prof.uid,
            created_at: new Date().toISOString()
          }).then();

          toast.success('Referral linked!');
          setIsVerifyingCode(false);
          return;
        }
      }

      // 2. Try looking up by Order Referral Code
      const { data: orderData } = await supabase
        .from('orders')
        .select('user_id')
        .eq('referral_code', code)
        .limit(1);

      if (orderData && orderData.length > 0) {
        if (orderData[0].user_id === user?.id) {
          setReferralCodeError('Cannot refer yourself');
        } else {
          setAppliedReferrerId(orderData[0].user_id);
          
          // Track click
          supabase.from('referral_tracking').insert({
            referrer_id: orderData[0].user_id,
            created_at: new Date().toISOString()
          }).then();

          toast.success('Referral code verified!');
        }
      } else {
        // 3. Fallback to legacy username matching
        const { data: profiles } = await supabase
          .from('profiles')
          .select('uid, display_name');
        
        const match = profiles?.find(p => 
          p.display_name?.replace(/\s+/g, '').toLowerCase() === code.toLowerCase()
        );

        if (match) {
          if (match.uid === user?.id) {
            setReferralCodeError('Cannot refer yourself');
          } else {
            setAppliedReferrerId(match.uid);
            
            // Track click
            supabase.from('referral_tracking').insert({
              referrer_id: match.uid,
              created_at: new Date().toISOString()
            }).then();

            toast.success('Referral username verified!');
          }
        } else {
          setReferralCodeError('Invalid code or username');
        }
      }
    } catch (err) {
      setReferralCodeError('Error checking code');
    } finally {
      setIsVerifyingCode(false);
    }
  };

  useEffect(() => {
    if (id) {
      fetchEbook();
      fetchReviews();
      
      const reviewsChannel = supabase
        .channel('reviews_detail')
        .on('postgres_changes', { 
          event: '*', 
          schema: 'public', 
          table: 'reviews',
          filter: `ebook_id=eq.${id}`
        }, fetchReviews)
        .subscribe();

      // Store referrer if present
      const refFromUrl = searchParams.get('ref');
      const refFromSession = localStorage.getItem('global_session_referrer');
      const ref = refFromUrl || refFromSession;
      
      if (ref && ref !== user?.id) {
        setReferralCodeInput(ref);
        // Auto-verify if possible
        verifyCode(ref);
      }

      let wishlistChannel: any;
      let ordersChannel: any;

      if (user) {
        fetchWishlist();
        checkPurchase();
        checkTotalOrders();

        wishlistChannel = supabase
          .channel('wishlist_detail')
          .on('postgres_changes', { 
            event: '*', 
            schema: 'public', 
            table: 'wishlist',
            filter: `user_id=eq.${user.id}`
          }, fetchWishlist)
          .subscribe();

        ordersChannel = supabase
          .channel('orders_detail')
          .on('postgres_changes', {
            event: '*',
            schema: 'public',
            table: 'orders',
            filter: `user_id=eq.${user.id}`
          }, () => {
             checkPurchase();
             checkTotalOrders();
          })
          .subscribe();
      } else {
        setCheckingPurchase(false);
      }
      
      return () => {
        supabase.removeChannel(reviewsChannel);
        if (wishlistChannel) supabase.removeChannel(wishlistChannel);
        if (ordersChannel) supabase.removeChannel(ordersChannel);
      };
    }
  }, [id, user, searchParams]);

  const fetchEbook = async () => {
    if (!id) return;
    const { data } = await supabase
      .from('ebooks')
      .select('*')
      .eq('id', id)
      .single();
    
    if (data && !data.is_deleted) {
      setEbook(data as Ebook);
    } else {
      toast.error('Ebook not found or removed');
      navigate('/');
    }
    setLoading(false);
  };

  const fetchReviews = async () => {
    if (!id) return;
    const { data } = await supabase
      .from('reviews')
      .select('*')
      .eq('ebook_id', id)
      .order('created_at', { ascending: false });
    if (data) setReviews(data as Review[]);
  };

  const fetchWishlist = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('wishlist')
      .select('ebook_id')
      .eq('user_id', user.id);
    if (data) setWishlist(data.map(i => i.ebook_id));
  };

  const checkPurchase = async () => {
    if (!user || !id) return;
    const { data } = await supabase
      .from('orders')
      .select('id')
      .eq('user_id', user.id)
      .eq('ebook_id', id)
      .eq('status', 'success')
      .limit(1);
    
    setHasPurchased(!!data && data.length > 0);
    setCheckingPurchase(false);
  };

  const checkTotalOrders = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('orders')
      .select('id')
      .eq('user_id', user.id)
      .eq('status', 'success')
      .limit(1);
    
    setHasAnyOrders(!!data && data.length > 0);
  };

  const toggleWishlist = async () => {
    if (!user) {
      toast.error('Please login to add to wishlist');
      return;
    }

    if (wishlist.includes(id!)) {
      const { error } = await supabase
        .from('wishlist')
        .delete()
        .eq('user_id', user.id)
        .eq('ebook_id', id);
      if (!error) toast.success('Removed from wishlist');
    } else {
      const { error } = await supabase
        .from('wishlist')
        .insert({ 
          user_id: user.id, 
          ebook_id: id,
          created_at: new Date().toISOString()
        });
      if (!error) toast.success('Added to wishlist');
    }
  };

  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [transactionId, setTransactionId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handlePurchase = async (ebook: Ebook) => {
    if (!user) {
      toast.error('Please login to purchase');
      return;
    }
    
    // Prevent self-purchase
    if (user.id === ebook.seller_id) {
      toast.error('You cannot purchase your own product');
      return;
    }

    // Prevent duplicate purchase if already successful
    if (hasPurchased) {
      toast.error('You have already purchased this ebook');
      return;
    }

    // Check for pending order to avoid double submission
    const { data: pendingData } = await supabase
      .from('orders')
      .select('id')
      .eq('user_id', user.id)
      .eq('ebook_id', ebook.id)
      .eq('status', 'pending')
      .limit(1);

    if (pendingData && pendingData.length > 0) {
      toast.error('You have a pending order for this ebook. Please wait for verification.');
      return;
    }

    setIsPaymentOpen(true);
    setIsVerifying(false);
  };

  const openApp = (app: 'generic' | 'paytm' | 'phonepe' | 'gpay') => {
    if (!ebook) return;
    const YOUR_UPI_ID = "7417645286@slc"; 
    const MERCHANT_NAME = "PUSTAK STORE";
    const params = `pa=${YOUR_UPI_ID}&pn=${encodeURIComponent(MERCHANT_NAME)}&am=${ebook.price}&cu=INR&tn=${encodeURIComponent('Purchase: ' + ebook.title)}`;
    
    let link = `upi://pay?${params}`;
    if (app === 'paytm') link = `paytmmp://pay?${params}`;
    if (app === 'phonepe') link = `phonepe://pay?${params}`;
    if (app === 'gpay') link = `googlegpay://pay?${params}`;
    
    window.location.href = link;
    toast.success('Opening your payment app...');
    setTimeout(() => setIsVerifying(true), 2000);
  };

  const executePurchase = async () => {
    if (!ebook || !user || !transactionId) {
      toast.error('Please enter Transaction ID');
      return;
    }
    
    setIsSubmitting(true);
    
    // 1. Ensure current user has a profile first (prevents user_id FK violation)
    try {
      const adminEmails = ['saumesht4075fea@gmail.com', 'mohittttt868@gmail.com'];
      const role = adminEmails.includes(user.email || '') ? 'admin' : 'customer';
      
      await supabase.from('profiles').upsert({
        uid: user.id,
        email: user.email,
        display_name: user.user_metadata?.display_name || user.email?.split('@')[0],
        role: role,
        updated_at: new Date().toISOString()
      }, { onConflict: 'uid' });
    } catch (e) {
      console.error('Profile sync failed:', e);
    }

    let finalReferrerId = appliedReferrerId;

    // RULE: If this is the user's FIRST EVER purchase, they cannot be referred.
    // "the person who is purchasing for the first time will not applied to code referral"
    if (!hasAnyOrders) {
      console.log('First time buyer - overriding referral to null');
      finalReferrerId = null;
    }

    // 2. Extra double check to avoid FK violation: handle non-UUID referrers gracefully
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    
    if (finalReferrerId) {
      if (!uuidRegex.test(finalReferrerId)) {
        console.warn('Invalid referrer ID format detected, resetting to null:', finalReferrerId);
        finalReferrerId = null;
      } else {
        // Final sanity check: does this profile actually exist right now?
        try {
          const { data, error } = await supabase
            .from('profiles')
            .select('uid')
            .eq('uid', finalReferrerId)
            .maybeSingle(); // maybeSingle() is safer as it doesn't throw on 0 rows
          
          if (error || !data) {
            console.warn('Referrer profile not found in database, resetting to null:', finalReferrerId);
            finalReferrerId = null;
          }
        } catch (e) {
          finalReferrerId = null;
        }
      }
    }

    // Generate a unique referral code for this purchase
    const newReferralCode = `REF-${user.id.slice(0, 5)}-${ebook.id.slice(0, 5)}-${Math.random().toString(36).substring(2, 7)}`.toUpperCase();
    
    try {
      // Record the order - marked as pending
      const { error: orderError } = await supabase
        .from('orders')
        .insert({
          user_id: user.id,
          ebook_id: ebook.id,
          amount: ebook.price,
          commission_amount: ebook.commission_amount,
          status: 'pending', 
          transaction_id: transactionId,
          referrer_id: finalReferrerId || null,
          referral_code: newReferralCode,
          created_at: new Date().toISOString()
        });

      if (orderError) throw orderError;

      toast.success('Order submitted! Access will be granted once payment is verified.');
      setIsPaymentOpen(false);
      setIsVerifying(false);
      setTransactionId('');

    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsSubmitting(false);
    }
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
          user_name: user.user_metadata?.display_name || user.email?.split('@')[0],
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
            src={ebook.cover_url || undefined} 
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
            {hasPurchased ? (
              <Button 
                size="lg"
                className="flex-1 bg-green-600 hover:bg-green-700 text-white h-14 text-lg font-bold rounded-2xl gap-2 cursor-default"
                onClick={() => navigate('/orders')}
              >
                <Check className="w-5 h-5" />
                Already Owned
              </Button>
            ) : user?.id === ebook.seller_id ? (
              <Button 
                size="lg"
                disabled
                className="flex-1 bg-zinc-700 text-white h-14 text-lg font-bold rounded-2xl"
              >
                Your Product
              </Button>
            ) : (
              <Button 
                size="lg"
                className="flex-1 bg-orange-600 hover:bg-orange-700 text-white h-14 text-lg font-bold rounded-2xl gap-2 shadow-lg shadow-orange-600/20"
                onClick={() => handlePurchase(ebook)}
              >
                <ShoppingBag className="w-5 h-5" />
                Buy Now
              </Button>
            )}
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
                <BookOpenIcon className="w-5 h-5 text-orange-600" />
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
              key={r.id}
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
      {/* Payment Selection Dialog */}
      <Dialog open={isPaymentOpen} onOpenChange={setIsPaymentOpen}>
        <DialogContent className="sm:max-w-[450px] rounded-3xl">
          <DialogHeader>
            <DialogTitle className="text-3xl font-black text-center">{isVerifying ? 'Verification' : 'Checkout'}</DialogTitle>
            <DialogDescription className="text-center font-medium">
              {isVerifying ? 'Enter your 12-digit UPI Transaction ID or UTR' : `Pay ₹${ebook.price} using any UPI App`}
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid gap-6 py-4">
            {!isVerifying ? (
              <div className="space-y-6">
                {appliedReferrerId && hasAnyOrders && (
                  <div className="flex items-center gap-2 p-3 bg-green-50 rounded-xl border border-green-100">
                    <BadgeCheck className="w-4 h-4 text-green-600" />
                    <p className="text-[10px] text-green-700 font-bold uppercase tracking-tight">Referral Applied Successfully</p>
                  </div>
                )}
                
                {appliedReferrerId && !hasAnyOrders && (
                  <div className="flex items-center gap-2 p-3 bg-orange-50 rounded-xl border border-orange-100">
                    <TrendingUp className="w-4 h-4 text-orange-600" />
                    <p className="text-[10px] text-orange-700 font-bold uppercase tracking-tight">Referral not applicable for first purchase</p>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <button 
                    onClick={() => openApp('phonepe')}
                    className="flex flex-col items-center justify-center p-4 bg-zinc-50 border-2 border-zinc-100 hover:border-purple-500 rounded-2xl transition-all group"
                  >
                    <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center shadow-sm mb-2 group-hover:scale-110 transition-transform">
                      <img src="https://img.icons8.com/color/48/phone-pe.png" alt="PhonePe" className="w-6 h-6" />
                    </div>
                    <span className="text-xs font-black text-zinc-900">PhonePe</span>
                  </button>
                  <button 
                    onClick={() => openApp('paytm')}
                    className="flex flex-col items-center justify-center p-4 bg-zinc-50 border-2 border-zinc-100 hover:border-blue-500 rounded-2xl transition-all group"
                  >
                    <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center shadow-sm mb-2 group-hover:scale-110 transition-transform">
                      <img src="https://img.icons8.com/color/48/paytm.png" alt="Paytm" className="w-6 h-6" />
                    </div>
                    <span className="text-xs font-black text-zinc-900">Paytm</span>
                  </button>
                  <button 
                    onClick={() => openApp('gpay')}
                    className="flex flex-col items-center justify-center p-4 bg-zinc-50 border-2 border-zinc-100 hover:border-red-500 rounded-2xl transition-all group"
                  >
                    <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center shadow-sm mb-2 group-hover:scale-110 transition-transform">
                      <img src="https://img.icons8.com/color/48/google-pay.png" alt="GPay" className="w-6 h-6" />
                    </div>
                    <span className="text-xs font-black text-zinc-900">GPay</span>
                  </button>
                  <button 
                    onClick={() => openApp('generic')}
                    className="flex flex-col items-center justify-center p-4 bg-zinc-50 border-2 border-zinc-100 hover:border-zinc-900 rounded-2xl transition-all group"
                  >
                    <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center shadow-sm mb-2 group-hover:scale-110 transition-transform">
                      <SmartphoneIcon className="w-6 h-6 text-zinc-900" />
                    </div>
                    <span className="text-xs font-black text-zinc-900">Others</span>
                  </button>
                </div>

                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t border-zinc-100"></span>
                  </div>
                  <div className="relative flex justify-center text-[10px] uppercase">
                    <span className="bg-white px-4 text-zinc-400 font-bold tracking-widest">OR SCAN QR</span>
                  </div>
                </div>

                <div className="flex flex-col items-center space-y-4">
                  <div className="relative w-48 h-48 bg-white rounded-3xl border-4 border-zinc-50 shadow-inner flex items-center justify-center overflow-hidden p-3">
                    <img 
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(`upi://pay?pa=7417645286@slc&pn=PUSTAK STORE&am=${ebook.price}&cu=INR`)}`}
                      alt="Payment QR" 
                      className="w-full h-full object-contain" 
                    /> 
                  </div>
                  <Button 
                    variant="outline"
                    className="w-full h-12 rounded-xl border-2 border-zinc-100 font-bold hover:bg-zinc-50"
                    onClick={() => setIsVerifying(true)}
                  >
                    I've scanned and paid
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="space-y-3">
                  <Label className="text-zinc-500 font-bold ml-1">TRANSACTION ID (UTR)</Label>
                  <Input 
                    placeholder="Enter 12-digit ID..." 
                    className="h-14 rounded-2xl border-2 focus:border-zinc-900 border-zinc-100 text-lg font-black tracking-widest"
                    value={transactionId}
                    onChange={(e) => setTransactionId(e.target.value.replace(/\D/g, '').slice(0, 12))}
                  />
                  <p className="text-[10px] text-zinc-400 font-medium px-2 italic">
                    * Find this in your payment app transaction history after payment.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <Button 
                    variant="ghost" 
                    className="h-14 rounded-2xl font-bold"
                    onClick={() => setIsVerifying(false)}
                  >
                    Go Back
                  </Button>
                  <Button 
                    className="h-14 rounded-2xl bg-zinc-900 hover:bg-black font-black text-lg shadow-xl shadow-zinc-900/20"
                    disabled={transactionId.length < 10 || isSubmitting || isVerifyingCode}
                    onClick={executePurchase}
                  >
                    {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : isVerifyingCode ? 'Checking Referral...' : 'Verify & Finish'}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SmartphoneIcon(props: any) {
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
      <rect width="14" height="20" x="5" y="2" rx="2" ry="2" />
      <path d="M12 18h.01" />
    </svg>
  );
}

function QrCodeIcon(props: any) {
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
      <rect width="5" height="5" x="3" y="3" rx="1" />
      <rect width="5" height="5" x="16" y="3" rx="1" />
      <rect width="5" height="5" x="3" y="16" rx="1" />
      <path d="M21 16V21H16" />
      <path d="M21 21H21.01" />
      <path d="M12 7V3" />
      <path d="M7 12H3" />
      <path d="M12 12H12.01" />
      <path d="M16 7H21" />
      <path d="M7 16V21" />
      <path d="M12 16V21" />
      <path d="M16 12H21" />
      <path d="M21 12V12.01" />
      <path d="M12 21H12.01" />
    </svg>
  );
}

function BookOpenIcon(props: any) {
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
