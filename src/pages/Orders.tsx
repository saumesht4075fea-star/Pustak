import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { User } from '@supabase/supabase-js';
import { motion } from 'motion/react';
import { ShoppingBag, Download, Star, MessageSquare, CheckCircle2, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { Ebook, Order } from '../types';

export default function Orders({ user }: { user: User | null }) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [reviewingEbookId, setReviewingEbookId] = useState<string | null>(null);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [searchParams] = useSearchParams();

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    const fetchOrders = async () => {
      const { data, error } = await supabase
        .from('orders')
        .select(`
          *,
          ebook:ebooks (*)
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      
      if (data) setOrders(data as Order[]);
      setLoading(false);
    };

    fetchOrders();

    const channel = supabase
      .channel('orders_page')
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
          user_name: user.user_metadata.display_name || user.email?.split('@')[0],
          ebook_id: reviewingEbookId,
          rating,
          comment,
          created_at: new Date().toISOString()
        });
      
      if (error) throw error;

      toast.success('Review submitted! Thank you.');
      setReviewingEbookId(null);
      setComment('');
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
                  <img src={order.ebook?.cover_url} alt="" className="w-32 h-44 object-cover rounded-lg shadow-md" />
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
                  
                  <div className="flex flex-wrap gap-3">
                    <Button className="bg-zinc-900 hover:bg-zinc-800 gap-2" asChild>
                      <a href={order.ebook?.file_url} target="_blank" rel="noopener noreferrer">
                        <Download className="w-4 h-4" />
                        Download Ebook
                      </a>
                    </Button>
                    
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
    </div>
  );
}
