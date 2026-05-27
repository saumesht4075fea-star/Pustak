import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { User } from '@supabase/supabase-js';
import { 
  Play, Lock, CheckCircle, ChevronRight, MessageSquare, 
  Share2, Award, Clock, Users, Star, ArrowLeft, Loader2,
  CheckSquare, Trophy
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import CoursePlayer from '../components/CoursePlayer';
import { Course, CourseVideo, UserCourseProgress } from '../types';

export default function CourseDetail({ user }: { user: User | null }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const [course, setCourse] = useState<Course | null>(null);
  const [videos, setVideos] = useState<CourseVideo[]>([]);
  const [completedVideos, setCompletedVideos] = useState<string[]>([]);
  const [currentVideo, setCurrentVideo] = useState<CourseVideo | null>(null);
  const [hasAccess, setHasAccess] = useState(false);
  const [loading, setLoading] = useState(true);
  const [referralCodeInput, setReferralCodeInput] = useState('');
  const [isVerifyingCode, setIsVerifyingCode] = useState(false);
  const [referralCodeError, setReferralCodeError] = useState('');
  const [appliedReferrerId, setAppliedReferrerId] = useState<string | null>(null);

  useEffect(() => {
    if (!id || !isSupabaseConfigured) return;

    const fetchCourseData = async () => {
      try {
        const { data: courseData, error: courseError } = await supabase
          .from('courses')
          .select('*')
          .eq('id', id)
          .single();

        if (courseError) throw courseError;
        setCourse(courseData as Course);

        const { data: videoData, error: videoError } = await supabase
          .from('course_videos')
          .select('*')
          .eq('course_id', id)
          .order('order_index', { ascending: true });

        if (videoError) throw videoError;
        setVideos(videoData as CourseVideo[]);

        // Check Access
        if (user) {
          // Check if user bought the course directly OR the linked ebook
          let accessQuery = `user_id=eq.${user.id},status=in.(success,completed)`;
          const orFilter = courseData.ebook_id 
            ? `ebook_id.eq.${id},ebook_id.eq.${courseData.ebook_id}`
            : `ebook_id.eq.${id}`;

          const { data: orderData } = await supabase
            .from('orders')
            .select('id')
            .eq('user_id', user.id)
            .or(orFilter)
            .in('status', ['success', 'completed'])
            .maybeSingle();

          if (orderData || ['saumesht4075fea@gmail.com', 'mohittttt868@gmail.com', 'jeetusharma1583@gmail.com'].includes(user.email || '')) {
            setHasAccess(true);
            
            // Fetch progress
            const { data: progressData } = await supabase
              .from('course_video_progress')
              .select('video_id')
              .eq('user_id', user.id)
              .eq('course_id', id)
              .eq('is_completed', true);
            
            if (progressData) {
              setCompletedVideos(progressData.map(p => p.video_id));
            }
          }
        }

        // Set initial video
        const initial = videoData.find((v: CourseVideo) => v.is_preview) || videoData[0];
        setCurrentVideo(initial);

      } catch (err: any) {
        toast.error(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchCourseData();
  }, [id, user]);

  const verifyCode = async (code: string) => {
    if (!code.trim()) return;
    setIsVerifyingCode(true);
    setReferralCodeError('');
    
    try {
      const { data, error } = await supabase
        .from('orders')
        .select('user_id, status, ebook_id')
        .eq('referral_code', code.trim().toUpperCase())
        .in('status', ['success', 'completed'])
        .maybeSingle();

      if (data) {
        if (data.user_id === user?.id) {
          setReferralCodeError('Cannot use your own code');
          setIsVerifyingCode(false);
          return;
        }
        
        setAppliedReferrerId(data.user_id);
        toast.success('Referral code verified!');
        setIsVerifyingCode(false);
        return;
      }
      setReferralCodeError('Invalid code or referrer has not purchased this course yet');
    } catch (err) {
      setReferralCodeError('Error verifying code');
    } finally {
      setIsVerifyingCode(false);
    }
  };

  const handleEnroll = async () => {
    if (!user) {
      toast.error('Please login to enroll');
      return;
    }

    const upiId = '7417645286@slc';
    const amount = course.price;
    const name = course.title;
    
    const qrUrl = `upi://pay?pa=${upiId}&pn=PUSTAK.ONLINE&am=${amount}&tn=Course:${name}&cu=INR`;
    
    const newReferralCode = `REF-${user.id.slice(0, 5)}-${course.id.slice(0, 5)}-${Math.random().toString(36).substring(2, 7)}`.toUpperCase();

    try {
      const { data: orderData, error } = await supabase.from('orders').insert([{
        user_id: user.id,
        ebook_id: id, 
        amount: amount,
        commission_amount: course.commission_amount,
        status: 'pending',
        referrer_id: appliedReferrerId,
        referral_code: newReferralCode
      }]).select().single();
      
      if (error) throw error;
      
      window.open(qrUrl, '_blank');
      toast.success('Enrollment initiated! Order ID: ' + orderData.id);
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 border-4 border-orange-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-zinc-500 font-black uppercase tracking-widest text-xs">Decrypting Modules...</p>
        </div>
      </div>
    );
  }

  if (!course) return null;

  const handleNext = () => {
    const currentIndex = videos.findIndex(v => v.id === currentVideo?.id);
    if (currentIndex < videos.length - 1) {
      const next = videos[currentIndex + 1];
      if (!next.is_preview && !hasAccess) {
        toast.error('Enroll to unlock full course');
        return;
      }
      setCurrentVideo(next);
    }
  };

  const handlePrev = () => {
    const currentIndex = videos.findIndex(v => v.id === currentVideo?.id);
    if (currentIndex > 0) {
      setCurrentVideo(videos[currentIndex - 1]);
    }
  };

  const toggleLessonProgress = async (videoId: string) => {
    if (!user || !id) return;
    
    const isCompleted = completedVideos.includes(videoId);
    const newCompleted = isCompleted 
      ? completedVideos.filter(v => v !== videoId)
      : [...completedVideos, videoId];
    
    setCompletedVideos(newCompleted);

    try {
      const { error } = await supabase
        .from('course_video_progress')
        .upsert({
          user_id: user.id,
          course_id: id,
          video_id: videoId,
          is_completed: !isCompleted,
          last_watched_at: new Date().toISOString()
        }, {
          onConflict: 'user_id,video_id'
        });
      
      if (error) throw error;
      
      if (!isCompleted) {
        toast.success('Lesson marked as complete!');
      }
    } catch (err: any) {
      console.error('Progress update error:', err);
      // Revert local state on error
      setCompletedVideos(completedVideos);
    }
  };

  const progressPercentage = videos.length > 0 
    ? Math.round((completedVideos.length / videos.length) * 100) 
    : 0;

  return (
    <div className="min-h-screen bg-white">
      {/* Top Header */}
      <div className="bg-zinc-900 py-4 px-6 sticky top-0 z-50 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button 
            variant="ghost" 
            size="icon" 
            className="text-zinc-400 hover:text-white"
            onClick={() => navigate(-1)}
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-white font-black text-sm sm:text-base tracking-tight truncate max-w-[200px] sm:max-w-md">
              {course.title}
            </h1>
            <p className="text-zinc-500 text-[10px] uppercase font-black tracking-widest italic">{course.instructor}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
           {!hasAccess && (
             <Button 
                onClick={handleEnroll}
                className="bg-orange-600 hover:bg-orange-700 text-white rounded-xl font-black text-xs px-6"
             >
                ENROLL ₹{course.price}
             </Button>
           )}
        </div>
      </div>

      <div className="max-w-[1600px] mx-auto p-4 lg:p-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left: Player & Info */}
        <div className="lg:col-span-8 space-y-6">
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
            {currentVideo ? (
              <CoursePlayer 
                playbackId={currentVideo.mux_playback_id}
                title={currentVideo.title}
                onNext={handleNext}
                onPrev={handlePrev}
                onEnded={() => {
                  if (!completedVideos.includes(currentVideo.id)) {
                    toggleLessonProgress(currentVideo.id);
                  }
                  handleNext();
                }}
                showNextPrev={videos.length > 1}
              />
            ) : (
              <div className="aspect-video bg-zinc-100 rounded-2xl flex items-center justify-center border-2 border-dashed border-zinc-200">
                <p className="text-zinc-400 font-black uppercase text-sm">No Video Content Loaded</p>
              </div>
            )}
          </div>

          <div className="space-y-4 p-2">
            <div className="flex flex-wrap items-center gap-4">
              <Badge className="bg-orange-600/10 text-orange-600 hover:bg-orange-600/10 border-none rounded-full px-4 py-1 text-[10px] font-black tracking-widest uppercase">
                {course.category}
              </Badge>
              <div className="flex items-center gap-1 text-zinc-400">
                 <Star className="w-4 h-4 fill-orange-500 text-orange-500" />
                 <span className="text-xs font-black">4.9 (1.2k Readers)</span>
              </div>
              {hasAccess && (
                <div className="flex items-center gap-2 text-green-600 bg-green-50 px-3 py-1 rounded-full border border-green-100">
                  <Trophy className="w-3.5 h-3.5" />
                  <span className="text-[10px] font-black uppercase tracking-tight">{progressPercentage}% COMPLETED</span>
                </div>
              )}
            </div>

            <div className="flex items-start justify-between gap-4">
              <h2 className="text-3xl font-black text-zinc-900 tracking-tight leading-none">
                {currentVideo?.title || course.title}
              </h2>
              {hasAccess && currentVideo && (
                <Button
                  onClick={() => toggleLessonProgress(currentVideo.id)}
                  variant={completedVideos.includes(currentVideo.id) ? "secondary" : "outline"}
                  className={`shrink-0 rounded-xl font-black text-[10px] uppercase tracking-widest gap-2 h-10 ${
                    completedVideos.includes(currentVideo.id) 
                    ? 'bg-green-50 text-green-600 border-green-200 hover:bg-green-100'
                    : 'border-zinc-200 text-zinc-600'
                  }`}
                >
                  <CheckSquare className="w-4 h-4" />
                  {completedVideos.includes(currentVideo.id) ? 'COMPLETED' : 'MARK COMPLETE'}
                </Button>
              )}
            </div>
            
            <p className="text-zinc-500 text-sm leading-relaxed font-medium">
              {currentVideo?.description || course.description}
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-8 pt-8 border-t border-zinc-100">
               <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-600">
                    <Clock className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-zinc-400 uppercase">Duration</p>
                    <p className="text-sm font-black text-zinc-900">12h 45m</p>
                  </div>
               </div>
               <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-green-50 flex items-center justify-center text-green-600">
                    <Users className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-zinc-400 uppercase">Enrolled</p>
                    <p className="text-sm font-black text-zinc-900">4,582+</p>
                  </div>
               </div>
               <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-purple-50 flex items-center justify-center text-purple-600">
                    <Award className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-zinc-400 uppercase">Review</p>
                    <p className="text-sm font-black text-zinc-900">99% Positive</p>
                  </div>
               </div>
               <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-orange-50 flex items-center justify-center text-orange-600">
                    <Share2 className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-zinc-400 uppercase">Access</p>
                    <p className="text-sm font-black text-zinc-900">Lifetime</p>
                  </div>
               </div>
            </div>
          </div>
        </div>

        {/* Right: Syllabus */}
        <div className="lg:col-span-4">
          <Card className="border-none shadow-2xl rounded-[2.5rem] bg-zinc-50 overflow-hidden sticky top-24">
            <CardContent className="p-0">
              <div className="bg-zinc-900 p-6 text-white text-center">
                 <h3 className="text-xl font-black italic tracking-tighter">COURSE CONTENT</h3>
                 <p className="text-[10px] text-zinc-500 font-black uppercase tracking-[0.2em] mt-1">{videos.length} MODULES UNLOCKED</p>
                 {hasAccess && (
                   <div className="mt-4 space-y-2">
                     <div className="flex justify-between text-[8px] font-black text-zinc-500 uppercase tracking-[0.2em]">
                       <span>Overall Progress</span>
                       <span>{progressPercentage}%</span>
                     </div>
                     <Progress value={progressPercentage} className="h-1.5 bg-white/10 rounded-full indicator-orange-600" />
                   </div>
                 )}
              </div>

              <div className="p-4 space-y-2">
                {videos.map((video, idx) => {
                  const isLocked = !video.is_preview && !hasAccess;
                  const isActive = currentVideo?.id === video.id;
                  const isCompleted = completedVideos.includes(video.id);

                  return (
                    <button
                      key={video.id}
                      disabled={isLocked}
                      onClick={() => setCurrentVideo(video)}
                      className={`w-full text-left p-4 rounded-2xl flex items-center justify-between transition-all group relative overflow-hidden ${
                        isActive 
                        ? 'bg-zinc-900 text-white shadow-xl shadow-zinc-900/20' 
                        : isLocked 
                        ? 'bg-white text-zinc-300 cursor-not-allowed opacity-60' 
                        : isCompleted
                        ? 'bg-green-50/50 text-zinc-900 hover:bg-green-50 border border-green-100/50 shadow-sm'
                        : 'bg-white text-zinc-900 hover:bg-zinc-100 shadow-sm'
                      }`}
                    >
                      <div className="flex items-center gap-4 relative z-10">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-black italic ${isActive ? 'bg-orange-600 text-white' : isCompleted ? 'bg-green-100 text-green-600' : 'bg-zinc-100 text-zinc-400'}`}>
                          {isCompleted ? <CheckSquare className="w-4 h-4" /> : idx + 1}
                        </div>
                        <div>
                          <h4 className="text-xs font-black uppercase tracking-tight">{video.title}</h4>
                          <p className={`text-[10px] font-black italic ${isActive ? 'text-zinc-500' : 'text-zinc-400'}`}>
                            {video.duration || '10:00'} • {video.is_preview ? 'PREVIEW FREE' : 'PREMIUM CONTENT'}
                          </p>
                        </div>
                      </div>
                      <div className="relative z-10">
                        {isLocked ? (
                          <Lock className="w-4 h-4 text-zinc-300" />
                        ) : isCompleted ? (
                          <CheckCircle className="w-4 h-4 text-green-500" />
                        ) : (
                          <Play className={`w-4 h-4 ${isActive ? 'fill-orange-600 text-orange-600' : 'text-zinc-200'}`} />
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>

              {!hasAccess && (
                <div className="p-6 bg-white border-t border-zinc-100 mt-2 space-y-4">
                  {/* Referral Code Field */}
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Apply Referral Code</Label>
                    <div className="flex gap-2">
                      <Input 
                        placeholder="ENTER CODE (Optional)" 
                        className="h-12 text-sm bg-zinc-50 border-zinc-200 text-zinc-900 font-mono font-black uppercase rounded-xl"
                        value={referralCodeInput}
                        onChange={(e) => setReferralCodeInput(e.target.value.toUpperCase())}
                        disabled={!!appliedReferrerId}
                      />
                      <Button 
                        variant={appliedReferrerId ? "secondary" : "outline"}
                        className="h-12 w-12 border-zinc-200 text-zinc-600 rounded-xl"
                        onClick={() => verifyCode(referralCodeInput)}
                        disabled={isVerifyingCode || !referralCodeInput || !!appliedReferrerId}
                      >
                        {isVerifyingCode ? <Loader2 className="w-4 h-4 animate-spin" /> : (appliedReferrerId ? <CheckCircle className="w-5 h-5 text-green-600" /> : <ChevronRight className="w-5 h-5" />)}
                      </Button>
                    </div>
                    {referralCodeError && <p className="text-[10px] text-red-500 font-bold uppercase">{referralCodeError}</p>}
                    {appliedReferrerId && <p className="text-[10px] text-green-600 font-bold uppercase">✓ Affiliate discount Applied</p>}
                  </div>

                  <div className="flex items-center justify-between mb-4">
                     <div>
                       <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Full Access Price</p>
                       <p className="text-3xl font-black text-zinc-900 tracking-tighter italic">₹{course.price}</p>
                     </div>
                     <Badge className="bg-green-100 text-green-600 hover:bg-green-100 border-none font-black text-[10px]">SAVE 70% TODAY</Badge>
                  </div>
                  <Button 
                    onClick={handleEnroll}
                    className="w-full h-14 rounded-2xl bg-orange-600 hover:bg-orange-700 text-white font-black text-lg gap-3"
                  >
                    <CheckCircle className="w-6 h-6" />
                    UNLOCK EVERYTHING
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
