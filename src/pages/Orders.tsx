import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { User } from '@supabase/supabase-js';
import { motion, AnimatePresence } from 'motion/react';
import { pdfjs, Document, Page } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

// Set up worker
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

import { ShoppingBag, Download, Star, MessageSquare, CheckCircle2, XCircle, BookOpen, Maximize2, X, Loader2, ExternalLink, Share2, Copy, BadgeCheck, TrendingUp } from 'lucide-react';
import PustakViewer from '../components/PustakViewer';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription, DialogClose } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { Ebook, Order } from '../types';

export default function Orders({ user }: { user: User | null }) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [reviewingEbookId, setReviewingEbookId] = useState<string | null>(null);
  const [readingEbook, setReadingEbook] = useState<Ebook | null>(null);
  const [readingBlobUrl, setReadingBlobUrl] = useState<string | null>(null);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');

  // Convert base64 to Blob URL for better stability in Chrome
  useEffect(() => {
    if (readingEbook?.file_url) {
      if (readingEbook.file_url.startsWith('data:application/pdf;base64,')) {
        try {
          const base64Content = readingEbook.file_url.split(',')[1];
          const byteCharacters = atob(base64Content);
          const byteNumbers = new Array(byteCharacters.length);
          for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
          }
          const byteArray = new Uint8Array(byteNumbers);
          const blob = new Blob([byteArray], { type: 'application/pdf' });
          const url = URL.createObjectURL(blob);
          setReadingBlobUrl(url);
          return () => URL.revokeObjectURL(url);
        } catch (e) {
          console.error('Error creating blob:', e);
          setReadingBlobUrl(readingEbook.file_url);
        }
      } else {
        setReadingBlobUrl(readingEbook.file_url);
      }
    } else {
      setReadingBlobUrl(null);
    }
  }, [readingEbook]);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    const fetchOrders = async () => {
      const { data: ordersData, error: ordersError } = await supabase
        .from('orders')
        .select(`
          *,
          ebook:ebooks(id, title, author, description, price, commission_amount, cover_url, file_url, category, cosmofeed_url, seller_id, is_verified, is_deleted, created_at)
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (ordersError) {
        toast.error('Failed to fetch orders');
        setLoading(false);
        return;
      }

      setOrders(ordersData as Order[]);
      
      const { data: pData } = await supabase
        .from('profiles')
        .select('*')
        .eq('uid', user.id)
        .single();
      if (pData) setProfile(pData);
      
      setLoading(false);
    };

    fetchOrders();

    const channel = supabase
      .channel('orders_user')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'orders',
        filter: `user_id=eq.${user.id}`
      }, fetchOrders)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const handleReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !reviewingEbookId) return;

    try {
      const { error } = await supabase
        .from('reviews')
        .insert({
          user_id: user.id,
          user_name: user.user_metadata?.display_name || user.email?.split('@')[0],
          ebook_id: reviewingEbookId,
          rating,
          comment,
          created_at: new Date().toISOString()
        });
      
      if (error) throw error;

      toast.success('Review submitted! Thank you.');
      setReviewingEbookId(null);
      setComment('');
      setRating(5);
    } catch (error) {
      toast.error('Failed to submit review');
    }
  };

  if (!user) {
    return (
      <div className="text-center py-20 space-y-6">
        <div className="w-20 h-20 bg-zinc-100 rounded-full flex items-center justify-center mx-auto">
          <ShoppingBag className="w-8 h-8 text-zinc-300" />
        </div>
        <h2 className="text-2xl font-bold tracking-tighter">No Orders Yet</h2>
        <p className="text-zinc-500 max-w-xs mx-auto">Your purchased ebooks will appear here. Start reading today!</p>
        <Button asChild className="bg-orange-600 hover:bg-orange-700">
          <a href="/">Browse Ebooks</a>
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tighter">My Library</h1>
        <p className="text-zinc-500">Access your purchased ebooks and share your thoughts.</p>
      </div>

      <div className="grid gap-6">
        {orders.map((order) => (
          <motion.div
            key={order.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <Card className="border-zinc-200 overflow-hidden">
              <CardContent className="p-6 flex flex-col sm:flex-row gap-6">
                <div className="flex-shrink-0">
                  {order.ebook?.cover_url && <img src={order.ebook.cover_url} alt="" className="w-32 h-44 object-cover rounded-lg shadow-md" />}
                </div>
                <div className="flex-grow space-y-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="text-xl font-bold tracking-tight">{order.ebook?.title}</h3>
                      <p className="text-zinc-500">by {order.ebook?.author}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-zinc-400 font-mono">Order #{order.id.slice(-6)}</p>
                      <p className="text-xs text-zinc-500">{new Date(order.created_at).toLocaleDateString()}</p>
                    </div>
                  </div>
                  
                    {order.status === 'success' || order.status === 'completed' ? (
                      <div className="w-full mt-2 p-4 bg-zinc-50 rounded-2xl border border-zinc-100 flex flex-col gap-3 shadow-inner">
                        <div className="flex items-center justify-between">
                          <Label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Unique Referral Code</Label>
                          <Badge className="bg-green-100 text-green-700 border-none font-bold text-[9px] px-2 py-0.5">
                            ₹{order.ebook?.commission_amount || 0} COMMISSION
                          </Badge>
                        </div>
                        
                        <div className="flex gap-2">
                          <Input 
                            readOnly 
                            value={order.referral_code || `REF-${order.id.slice(0, 8)}`}
                            className="h-12 text-sm bg-white border-zinc-200 text-zinc-900 font-mono font-black uppercase rounded-xl"
                          />
                          <Button 
                            size="icon"
                            variant="outline" 
                            className="h-12 w-12 border-zinc-200 text-zinc-600 hover:bg-zinc-100 shrink-0 rounded-xl"
                            onClick={() => {
                              navigator.clipboard.writeText(order.referral_code || `REF-${order.id.slice(0, 8)}`);
                              toast.success('Referral code copied!');
                            }}
                          >
                            <Copy className="w-5 h-5" />
                          </Button>
                        </div>
                        <p className="text-[10px] text-zinc-400 font-bold uppercase italic tracking-tighter">
                          * Friends enter this code on the home page to support you.
                        </p>
                      </div>
                    ) : null}

                    <div className="flex flex-wrap gap-3">
                      {order.status === 'success' || order.status === 'completed' ? (
                        <>
                        <Button 
                          className="bg-orange-600 hover:bg-orange-700 gap-2 font-bold"
                          onClick={() => setReadingEbook(order.ebook || null)}
                        >
                          <BookOpen className="w-4 h-4" />
                          Read Now
                        </Button>

                        {profile?.role === 'admin' && (
                          <Button variant="outline" className="gap-2 border-zinc-200 text-zinc-600 hover:bg-zinc-50" asChild>
                            <a href={order.ebook?.file_url} target="_blank" rel="noopener noreferrer">
                              <Download className="w-4 h-4" />
                              Download
                            </a>
                          </Button>
                        )}
                      </>
                    ) : order.status === 'pending' ? (
                      <div className="flex items-center gap-2 px-4 py-2 bg-yellow-50 text-yellow-700 rounded-xl border border-yellow-100 italic text-sm font-medium">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Verification Pending... (UTR: {order.transaction_id})
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-700 rounded-xl border border-red-100 italic text-sm font-medium">
                        <XCircle className="w-4 h-4" />
                        Payment Failed or Rejected
                      </div>
                    )}
                    
                    <Dialog open={reviewingEbookId === order.ebook_id} onOpenChange={(open) => !open && setReviewingEbookId(null)}>
                      <DialogTrigger asChild>
                        <Button variant="outline" className="gap-2" onClick={() => setReviewingEbookId(order.ebook_id)}>
                          <MessageSquare className="w-4 h-4" />
                          Write Review
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Review {order.ebook?.title}</DialogTitle>
                          <DialogDescription>
                            Share your feedback and rate this ebook.
                          </DialogDescription>
                        </DialogHeader>
                        <form onSubmit={handleReview} className="space-y-4 py-4">
                          <div className="space-y-2">
                            <Label>Rating</Label>
                            <div className="flex gap-2">
                              {[1, 2, 3, 4, 5].map((s) => (
                                <button
                                  key={s}
                                  type="button"
                                  onClick={() => setRating(s)}
                                  className={`p-1 transition-colors ${s <= rating ? 'text-orange-500' : 'text-zinc-200'}`}
                                >
                                  <Star className={`w-8 h-8 ${s <= rating ? 'fill-current' : ''}`} />
                                </button>
                              ))}
                            </div>
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="comment">Your Thoughts</Label>
                            <Textarea 
                              id="comment" 
                              placeholder="What did you think of this book?" 
                              value={comment}
                              onChange={(e) => setComment(e.target.value)}
                              required
                            />
                          </div>
                          <Button type="submit" className="w-full bg-orange-600 hover:bg-orange-700">Submit Review</Button>
                        </form>
                      </DialogContent>
                    </Dialog>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}

        {orders.length === 0 && !loading && (
          <div className="text-center py-20 border-2 border-dashed border-zinc-200 rounded-3xl">
            <p className="text-zinc-500">You haven't purchased any ebooks yet.</p>
          </div>
        )}
      </div>

      {readingEbook && readingBlobUrl && (
        <PustakViewer 
          file={readingBlobUrl} 
          title={readingEbook.title} 
          author={readingEbook.author}
          coverUrl={readingEbook.cover_url}
          isAdmin={profile?.role === 'admin'}
          onClose={() => setReadingEbook(null)}
        />
      )}
    </div>
  );
}
