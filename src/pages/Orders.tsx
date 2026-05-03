import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { User } from '@supabase/supabase-js';
import { motion } from 'motion/react';
import { pdfjs, Document, Page } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

// Set up worker
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

import { ShoppingBag, Download, Star, MessageSquare, CheckCircle2, XCircle, BookOpen, Maximize2, X, Loader2, ExternalLink, Share2, Copy, BadgeCheck, TrendingUp, ChevronLeft, ChevronRight, ZoomIn, ZoomOut } from 'lucide-react';
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
  const [numPages, setNumPages] = useState<number | null>(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [scale, setScale] = useState(1.0);
  const [isReaderLoading, setIsReaderLoading] = useState(true);

  function onDocumentLoadSuccess({ numPages }: { numPages: number }) {
    setNumPages(numPages);
    setIsReaderLoading(false);
  }

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

      <Dialog open={!!readingEbook} onOpenChange={(open) => !open && setReadingEbook(null)}>
        <DialogContent className="sm:max-w-4xl max-w-[95vw] w-full h-[85vh] p-0 overflow-hidden border-none bg-zinc-900 rounded-3xl shadow-2xl">
          <DialogHeader className="sr-only">
            <DialogTitle>Reading: {readingEbook?.title}</DialogTitle>
            <DialogDescription>PDF Viewer for {readingEbook?.title}</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col h-full">
            <div className="flex items-center justify-between p-4 bg-zinc-900 border-b border-zinc-800 shrink-0">
              <div className="flex items-center gap-4">
                <div className="w-10 h-14 rounded-md overflow-hidden bg-zinc-800 shadow-md">
                  {readingEbook?.cover_url && <img src={readingEbook.cover_url} alt="" className="w-full h-full object-cover" />}
                </div>
                <div>
                  <DialogTitle className="text-white font-black text-lg line-clamp-1">{readingEbook?.title}</DialogTitle>
                  <p className="text-zinc-400 text-xs font-medium">by {readingEbook?.author}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {profile?.role === 'admin' && (
                  <Button variant="ghost" size="icon" className="text-zinc-400 hover:text-white hover:bg-zinc-800" asChild>
                    <a href={readingEbook?.file_url} download target="_blank" rel="noopener noreferrer">
                      <Download className="w-5 h-5" />
                    </a>
                  </Button>
                )}
                <DialogClose asChild>
                  <Button variant="ghost" size="icon" className="text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-full">
                    <X className="w-6 h-6" />
                  </Button>
                </DialogClose>
              </div>
            </div>
            
            <div className="flex-grow bg-zinc-100 relative overflow-hidden flex flex-col">
              {readingBlobUrl ? (
                <div className="flex flex-col h-full">
                  {/* Reader Controls */}
                  <div className="bg-white border-b border-zinc-200 p-2 flex items-center justify-between px-4 shrink-0">
                    <div className="flex items-center gap-2">
                       <Button 
                         variant="ghost" 
                         size="sm" 
                         disabled={pageNumber <= 1}
                         onClick={() => setPageNumber(prev => Math.max(prev - 1, 1))}
                         className="h-8 w-8 p-0"
                       >
                         <ChevronLeft className="w-4 h-4" />
                       </Button>
                       <span className="text-xs font-bold text-zinc-600">
                         Page {pageNumber} of {numPages || '...'}
                       </span>
                       <Button 
                         variant="ghost" 
                         size="sm" 
                         disabled={numPages ? pageNumber >= numPages : false}
                         onClick={() => setPageNumber(prev => numPages ? Math.min(prev + 1, numPages) : prev)}
                         className="h-8 w-8 p-0"
                       >
                         <ChevronRight className="w-4 h-4" />
                       </Button>
                    </div>

                    <div className="flex items-center gap-2">
                       <Button variant="ghost" size="sm" onClick={() => setScale(s => Math.max(s - 0.1, 0.5))} className="h-8 w-8 p-0">
                         <ZoomOut className="w-4 h-4" />
                       </Button>
                       <span className="text-[10px] font-bold text-zinc-400 w-8 text-center">{Math.round(scale * 100)}%</span>
                       <Button variant="ghost" size="sm" onClick={() => setScale(s => Math.min(s + 0.1, 2.0))} className="h-8 w-8 p-0">
                         <ZoomIn className="w-4 h-4" />
                       </Button>
                    </div>

                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="text-[10px] h-7 font-black border-red-200 text-red-600 hover:bg-red-50"
                      onClick={() => {
                        setPageNumber(1);
                        const currentRef = readingBlobUrl;
                        setReadingBlobUrl(null);
                        setTimeout(() => setReadingBlobUrl(currentRef), 100);
                      }}
                    >
                      RESET
                    </Button>
                  </div>

                  {/* Book Viewport */}
                  <div className="flex-grow overflow-auto bg-zinc-200 p-4 flex justify-center items-start">
                    <motion.div 
                      key={pageNumber}
                      initial={{ opacity: 0, rotateY: -30, x: 20 }}
                      animate={{ opacity: 1, rotateY: 0, x: 0 }}
                      transition={{ type: "spring", damping: 20, stiffness: 100 }}
                      className="shadow-2xl bg-white origin-left"
                      style={{ perspective: "1000px" }}
                    >
                      <Document
                        file={readingBlobUrl}
                        onLoadSuccess={onDocumentLoadSuccess}
                        loading={
                          <div className="h-[60vh] w-[400px] flex items-center justify-center bg-white">
                            <Loader2 className="w-8 h-8 animate-spin text-orange-600" />
                          </div>
                        }
                        error={
                          <div className="h-[60vh] w-[400px] flex flex-col items-center justify-center bg-white p-8 text-center">
                            <XCircle className="w-12 h-12 text-red-500 mb-4" />
                            <p className="font-bold text-zinc-900">Failed to load PDF</p>
                            <p className="text-sm text-zinc-500">Please try downloading the file instead.</p>
                          </div>
                        }
                      >
                        <Page 
                          pageNumber={pageNumber} 
                          scale={scale} 
                          renderAnnotationLayer={false}
                          renderTextLayer={false}
                          className="max-w-full"
                          loading={<div className="h-[60vh] w-[400px] bg-white animate-pulse" />}
                        />
                      </Document>
                    </motion.div>
                  </div>

                  {/* Desktop Navigation Helper */}
                  <div className="absolute inset-y-0 left-0 w-20 flex items-center justify-center group pointer-events-none">
                     <Button 
                       variant="ghost" 
                       className="pointer-events-auto h-20 w-12 bg-black/5 opacity-0 group-hover:opacity-100 rounded-r-3xl rounded-l-none"
                       onClick={() => setPageNumber(prev => Math.max(prev - 1, 1))}
                       disabled={pageNumber <= 1}
                     >
                       <ChevronLeft className="w-8 h-8 text-zinc-400" />
                     </Button>
                  </div>
                  <div className="absolute inset-y-0 right-0 w-20 flex items-center justify-center group pointer-events-none">
                     <Button 
                       variant="ghost" 
                       className="pointer-events-auto h-20 w-12 bg-black/5 opacity-0 group-hover:opacity-100 rounded-l-3xl rounded-r-none"
                       onClick={() => setPageNumber(prev => numPages ? Math.min(prev + 1, numPages) : prev)}
                       disabled={numPages ? pageNumber >= numPages : false}
                     >
                       <ChevronRight className="w-8 h-8 text-zinc-400" />
                     </Button>
                  </div>
                </div>
              ) : (
                <div className="text-white text-center p-8">
                  <BookOpen className="w-12 h-12 text-zinc-600 mx-auto mb-4" />
                  <p className="text-lg font-bold">PDF Not Available</p>
                  <p className="text-zinc-500 text-sm">The file for this ebook could not be loaded.</p>
                </div>
              )}
              <div className="absolute inset-0 pointer-events-none border-[12px] border-zinc-900/5 rounded-none mix-blend-overlay" />
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
