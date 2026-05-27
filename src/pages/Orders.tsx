import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { User } from '@supabase/supabase-js';
import { motion, AnimatePresence } from 'motion/react';
import { pdfjs, Document, Page } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

// Set up worker
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

import { ShoppingBag, Download, Star, MessageSquare, CheckCircle2, XCircle, BookOpen, Maximize2, X, Loader2, ExternalLink, Share2, Copy, BadgeCheck, TrendingUp, Play } from 'lucide-react';
import PustakViewer from '../components/PustakViewer';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription, DialogClose } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useSearchParams, Link } from 'react-router-dom';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { Ebook, Order, UserCourseProgress, Course } from '../types';

export default function Orders({ user }: { user: User | null }) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [profile, setProfile] = useState<any>(null);
  const [courseProgress, setCourseProgress] = useState<Record<string, { completed: number, total: number }>>({});
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'ebooks');
  const [loading, setLoading] = useState(true);

  // Sync tab with URL
  useEffect(() => {
    const tabFromUrl = searchParams.get('tab');
    if (tabFromUrl && tabFromUrl !== activeTab) {
      setActiveTab(tabFromUrl);
    }
  }, [searchParams]);

  const onTabChange = (val: string) => {
    setActiveTab(val);
    setSearchParams({ tab: val });
  };
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
      setLoading(true);
      try {
        const { data: coursesData } = await supabase.from('courses').select('*');
        const { data: ebooksData } = await supabase.from('ebooks').select('*');
        setCourses(coursesData || []);
        
        const { data: ordersData, error: ordersError } = await supabase
          .from('orders')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });

        if (ordersError) throw ordersError;

        // Manual matching for courses AND ebooks
        const processedOrders = (ordersData as any[]).map(order => {
          const ebook = ebooksData?.find(e => e.id === order.ebook_id);
          const directCourse = coursesData?.find(c => c.id === order.ebook_id);
          
          // CRITICAL: Check if this is an ebook that has a linked course
          const linkedCourse = ebook ? coursesData?.find(c => c.ebook_id === ebook.id) : null;
          
          return { 
            ...order, 
            ebook: ebook || null,
            course: directCourse || linkedCourse || null 
          };
        });

        setOrders(processedOrders as Order[]);
        
        // Fetch progress for all accessible courses
        const accessibleCourseIds = processedOrders
          .filter(o => o.course && (o.status === 'success' || o.status === 'completed'))
          .map(o => o.course!.id);

        if (accessibleCourseIds.length > 0) {
          const { data: progressData } = await supabase
            .from('course_video_progress')
            .select('course_id, video_id')
            .eq('user_id', user.id)
            .eq('is_completed', true)
            .in('course_id', accessibleCourseIds);
          
          const { data: videosCount } = await supabase
            .from('course_videos')
            .select('course_id, id')
            .in('course_id', accessibleCourseIds);
          
          const progressMap: Record<string, { completed: number, total: number }> = {};
          accessibleCourseIds.forEach(id => {
            const completed = progressData?.filter(p => p.course_id === id).length || 0;
            const total = videosCount?.filter(v => v.course_id === id).length || 0;
            progressMap[id] = { completed, total };
          });
          setCourseProgress(progressMap);
        }
        
        const { data: pData } = await supabase
          .from('profiles')
          .select('*')
          .eq('uid', user.id)
          .single();
        if (pData) setProfile(pData);
      } catch (err: any) {
        console.error('Error fetching library:', err);
        toast.error('Failed to fetch library');
      } finally {
        setLoading(false);
      }
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

  const ebookOrders = orders.filter(o => o.ebook);
  const purchasedCourses = Array.from(new Set(
    orders
      .filter(o => o.course && (o.status === 'success' || o.status === 'completed'))
      .map(o => o.course!)
  ));

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
        <h1 className="text-3xl font-black tracking-tight italic">MY LIBRARY & COURSES</h1>
        <p className="text-zinc-500 font-medium font-inter">Access your purchased assets and track your learning progress.</p>
      </div>

      <Tabs value={activeTab} onValueChange={onTabChange} className="w-full">
        <TabsList className="bg-zinc-100/50 p-1 rounded-2xl mb-8 w-full sm:w-fit">
          <TabsTrigger value="ebooks" className="rounded-xl px-8 font-black uppercase text-[10px] tracking-widest data-[state=active]:bg-white data-[state=active]:shadow-sm py-3">
            E-BOOKS ({ebookOrders.length})
          </TabsTrigger>
          <TabsTrigger value="courses" className="rounded-xl px-8 font-black uppercase text-[10px] tracking-widest data-[state=active]:bg-white data-[state=active]:shadow-sm py-3">
            COURSES ({purchasedCourses.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="ebooks" className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="grid gap-6">
            {ebookOrders.map((order) => (
              <motion.div
                key={order.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <Card className="border-zinc-100 overflow-hidden rounded-[2.5rem] hover:shadow-2xl transition-all duration-500 bg-white group">
                  <CardContent className="p-6 flex flex-col sm:flex-row gap-6">
                    <div className="flex-shrink-0 relative">
                      {order.ebook?.cover_url && (
                        <img 
                          src={order.ebook.cover_url} 
                          alt="" 
                          className="w-32 h-44 object-cover rounded-[1.5rem] shadow-2xl group-hover:scale-105 transition-transform duration-500" 
                        />
                      )}
                    </div>
                    <div className="flex-grow space-y-4">
                      <div className="flex justify-between items-start">
                        <div className="space-y-1">
                          <Badge className="bg-orange-50 text-orange-600 border-none rounded-full px-3 py-0.5 text-[8px] font-black uppercase tracking-widest">
                            READING MATERIAL
                          </Badge>
                          <h3 className="text-xl font-black tracking-tight text-zinc-900 uppercase italic">
                            {order.ebook?.title}
                          </h3>
                          <p className="text-zinc-400 font-bold italic text-sm">
                            by {order.ebook?.author}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-[10px] text-zinc-300 font-mono font-bold tracking-tighter">ORDER ID #{order.id.slice(-8).toUpperCase()}</p>
                          <p className="text-[10px] text-zinc-400 font-black uppercase tracking-widest mt-1">{new Date(order.created_at).toLocaleDateString()}</p>
                        </div>
                      </div>
                      
                      {order.status === 'success' || order.status === 'completed' ? (
                        <div className="space-y-4">
                          <div className="flex flex-wrap gap-3">
                            <Button 
                              className="bg-orange-600 hover:bg-orange-700 gap-2 font-black rounded-xl px-6 h-12 shadow-lg shadow-orange-600/20"
                              onClick={() => setReadingEbook(order.ebook || null)}
                            >
                              <BookOpen className="w-4 h-4" />
                              READ NOW
                            </Button>

                            {order.course && (
                              <Button 
                                variant="outline"
                                className="border-blue-100 text-blue-600 hover:bg-blue-50 gap-2 font-black rounded-xl px-6 h-12"
                                asChild
                              >
                                <Link to={`/course/${order.course.id}`}>
                                  <Play className="w-4 h-4 fill-current" />
                                  WATCH LINKED COURSE
                                </Link>
                              </Button>
                            )}

                            <Dialog open={reviewingEbookId === order.ebook_id} onOpenChange={(open) => !open && setReviewingEbookId(null)}>
                              <DialogTrigger asChild>
                                <Button variant="ghost" className="gap-2 text-zinc-300 hover:text-zinc-600 font-black text-[10px] tracking-widest" onClick={() => setReviewingEbookId(order.ebook_id)}>
                                  <MessageSquare className="w-4 h-4" />
                                  SUBMIT REVIEW
                                </Button>
                              </DialogTrigger>
                              <DialogContent className="rounded-[2.5rem] bg-white border-zinc-100">
                                <DialogHeader>
                                  <DialogTitle className="font-black italic text-2xl tracking-tighter">REVIEW {order.ebook?.title}</DialogTitle>
                                  <DialogDescription className="font-bold text-zinc-400">
                                    Share your honest feedback with the community.
                                  </DialogDescription>
                                </DialogHeader>
                                <form onSubmit={handleReview} className="space-y-6 py-4">
                                  <div className="space-y-2">
                                    <Label className="font-black uppercase text-[10px] tracking-widest text-zinc-400">Your Experience</Label>
                                    <div className="flex gap-2">
                                      {[1, 2, 3, 4, 5].map((s) => (
                                        <button
                                          key={s}
                                          type="button"
                                          onClick={() => setRating(s)}
                                          className={`p-1 transition-all ${s <= rating ? 'text-orange-500 scale-110' : 'text-zinc-100'}`}
                                        >
                                          <Star className={`w-10 h-10 ${s <= rating ? 'fill-current' : ''}`} />
                                        </button>
                                      ))}
                                    </div>
                                  </div>
                                  <div className="space-y-2">
                                    <Label htmlFor="comment" className="font-black uppercase text-[10px] tracking-widest text-zinc-400">Detailed Feedback</Label>
                                    <Textarea 
                                      id="comment" 
                                      placeholder="What did you think of this book?" 
                                      className="rounded-2xl border-zinc-100 bg-zinc-50 min-h-[140px] focus:ring-orange-600 focus:border-orange-600"
                                      value={comment}
                                      onChange={(e) => setComment(e.target.value)}
                                      required
                                    />
                                  </div>
                                  <Button type="submit" className="w-full bg-zinc-900 hover:bg-black rounded-2xl h-14 font-black italic tracking-tight text-lg">POST REVIEW</Button>
                                </form>
                              </DialogContent>
                            </Dialog>
                          </div>

                          <div className="p-4 bg-zinc-50 rounded-2xl border border-zinc-100 space-y-3">
                             <div className="flex items-center justify-between">
                               <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Affiliate Program</span>
                               <span className="text-[10px] font-black text-green-600 bg-green-50 px-2 py-0.5 rounded-full">₹{order.ebook?.commission_amount || 0} COMMISSION</span>
                             </div>
                             <div className="flex gap-2">
                               <Input 
                                 readOnly 
                                 value={order.referral_code || `REF-${order.id.slice(0, 8)}`.toUpperCase()}
                                 className="h-10 text-[10px] bg-white border-zinc-100 text-zinc-900 font-mono font-black uppercase rounded-xl tracking-widest"
                               />
                               <Button 
                                 size="icon"
                                 variant="outline" 
                                 className="h-10 w-10 border-zinc-100 text-zinc-400 hover:text-orange-600 shrink-0 rounded-xl"
                                 onClick={() => {
                                   navigator.clipboard.writeText(order.referral_code || `REF-${order.id.slice(0, 8)}`.toUpperCase());
                                   toast.success('Affiliate code copied!');
                                 }}
                               >
                                 <Copy className="w-4 h-4" />
                               </Button>
                             </div>
                          </div>
                        </div>
                      ) : order.status === 'pending' ? (
                        <div className="flex items-center gap-2 px-4 py-4 bg-yellow-50 text-yellow-700 rounded-2xl border border-yellow-100 italic text-sm font-black uppercase tracking-tight">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Verifying Transaction ID: {order.transaction_id}
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 px-4 py-4 bg-red-50 text-red-700 rounded-2xl border border-red-100 font-black uppercase tracking-tight text-xs">
                          <XCircle className="w-4 h-4" />
                          Verification Failed (Rejected)
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
            {ebookOrders.length === 0 && !loading && (
              <div className="text-center py-24 bg-zinc-50 rounded-[3rem] border-4 border-dashed border-zinc-100 space-y-4">
                <ShoppingBag className="w-12 h-12 text-zinc-200 mx-auto" />
                <p className="text-zinc-400 font-black uppercase tracking-widest italic text-sm">Library is empty</p>
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="courses" className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="grid gap-6">
            {purchasedCourses.map((course) => (
              <motion.div
                key={course.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <Card className="border-zinc-100 overflow-hidden rounded-[2.5rem] hover:shadow-2xl transition-all duration-500 bg-white group">
                  <CardContent className="p-6 flex flex-col sm:flex-row gap-6">
                    <div className="flex-shrink-0">
                      {course.cover_url && (
                        <img 
                          src={course.cover_url} 
                          alt="" 
                          className="w-32 h-44 object-cover rounded-[1.5rem] shadow-2xl group-hover:scale-105 transition-transform duration-500" 
                        />
                      )}
                    </div>
                    <div className="flex-grow space-y-4">
                      <div className="flex justify-between items-start">
                        <div className="space-y-1">
                          <Badge className="bg-blue-50 text-blue-600 border-none rounded-full px-3 py-0.5 text-[8px] font-black uppercase tracking-widest">
                            MASTERCLASS ACCESS
                          </Badge>
                          <h3 className="text-xl font-black tracking-tight text-zinc-900 uppercase italic">
                            {course.title}
                          </h3>
                          <p className="text-zinc-400 font-bold italic text-sm">
                            by {course.instructor}
                          </p>
                        </div>
                      </div>

                      {courseProgress[course.id] && courseProgress[course.id].total > 0 && (
                        <div className="space-y-3 bg-zinc-50 p-4 rounded-2xl border border-zinc-100">
                          <div className="flex justify-between items-end">
                            <span className="text-[10px] font-black uppercase text-zinc-400 tracking-widest">Learning Progress</span>
                            <span className="text-2xl font-black italic text-blue-600 tracking-tighter">
                              {Math.round((courseProgress[course.id].completed / courseProgress[course.id].total) * 100)}%
                            </span>
                          </div>
                          <Progress 
                            value={(courseProgress[course.id].completed / courseProgress[course.id].total) * 100} 
                            className="h-2 bg-blue-100/30 rounded-full indicator-blue-600" 
                          />
                          <p className="text-[10px] font-black text-zinc-400 uppercase tracking-tight italic">
                            {courseProgress[course.id].completed} of {courseProgress[course.id].total} modules completed
                          </p>
                        </div>
                      )}

                      <div className="flex items-center gap-3">
                        <Button 
                          className="bg-zinc-900 hover:bg-black gap-2 font-black rounded-xl px-8 h-12"
                          asChild
                        >
                          <Link to={`/course/${course.id}`}>
                            <Play className="w-4 h-4 fill-current" />
                            RESUME LEARNING
                          </Link>
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
            {purchasedCourses.length === 0 && !loading && (
              <div className="text-center py-24 bg-zinc-50 rounded-[3rem] border-4 border-dashed border-zinc-100 space-y-4">
                <Play className="w-12 h-12 text-zinc-200 mx-auto" />
                <p className="text-zinc-400 font-black uppercase tracking-widest italic text-sm">No courses unlocked</p>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>

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
