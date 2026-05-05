import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { User } from '@supabase/supabase-js';
import { motion } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { 
  Package, 
  Loader2,
  DollarSign, 
  TrendingUp, 
  Plus, 
  Trash2, 
  Edit3, 
  ExternalLink,
  BookOpen,
  Share2,
  PieChart as PieChartIcon,
  BarChart as BarChartIcon,
  BadgeCheck,
  Copy,
  Wallet,
  History,
  Info
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Ebook, Order, Profile } from '../types';

interface WithdrawalRequest {
  id: string;
  user_id: string;
  amount: number;
  upi_id: string;
  mobile_number?: string;
  email_id?: string;
  purchase_utr?: string;
  status: 'pending' | 'success' | 'failed';
  created_at: string;
}

export default function SellerDashboard({ user, isAdmin, isSeller }: { user: User | null, isAdmin: boolean, isSeller: boolean }) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [affiliateSales, setAffiliateSales] = useState<Order[]>([]);
  const [directSales, setDirectSales] = useState<Order[]>([]);
  const [ownPurchases, setOwnPurchases] = useState<Order[]>([]);
  const [withdrawals, setWithdrawals] = useState<WithdrawalRequest[]>([]);
  const [isWithdrawOpen, setIsWithdrawOpen] = useState(false);
  const [upiId, setUpiId] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');
  const [emailId, setEmailId] = useState('');
  const [purchaseUtr, setPurchaseUtr] = useState('');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [isSubmittingWithdraw, setIsSubmittingWithdraw] = useState(false);
  const [hasPurchasedAny, setHasPurchasedAny] = useState(false);
  const [clickCount, setClickCount] = useState(0);

  const fetchData = async () => {
    if (!user) return;
    setLoading(true);
    
    // Fetch Profile
    const { data: profileData } = await supabase
      .from('profiles')
      .select('*')
      .eq('uid', user.id)
      .single();
    if (profileData) setProfile(profileData as Profile);

    // Fetch Affiliate Sales (Success & Pending) - Sales REFERRED by this user
    const { data: affiliateData } = await supabase
      .from('orders')
      .select('*, ebook:ebooks(id, title, author, commission_amount, cover_url, seller_id), profiles(*)')
      .eq('referrer_id', user.id)
      .in('status', ['success', 'pending'])
      .order('created_at', { ascending: false });
    if (affiliateData) setAffiliateSales(affiliateData as any);

    // Fetch Direct Sales - Sales of ebooks OWNED by this user
    const { data: directData } = await supabase
      .from('orders')
      .select('*, ebook:ebooks!inner(id, title, author, description, price, commission_amount, cover_url, file_url, category, cosmofeed_url, seller_id, is_verified, is_deleted, created_at), profiles(*)')
      .eq('ebook.seller_id', user.id)
      .in('status', ['success', 'pending'])
      .order('created_at', { ascending: false });
    if (directData) setDirectSales(directData as any);

    // Fetch user's own successful purchases to see codes
    const { data: ownOrders } = await supabase
      .from('orders')
      .select('*, ebook:ebooks(id, title, author, description, price, commission_amount, cover_url, file_url, category, cosmofeed_url, seller_id, is_verified, is_deleted, created_at)').eq('user_id', user.id).eq('status', 'success');
    
    if (ownOrders) {
      setOwnPurchases(ownOrders as any);
      setHasPurchasedAny(ownOrders.length > 0);
    }

    // Fetch Withdrawals
    const { data: withdrawalData } = await supabase
      .from('withdrawals')
      .select('*').eq('user_id', user.id).order('created_at', { ascending: false });
    if (withdrawalData) setWithdrawals(withdrawalData as WithdrawalRequest[]);

    // Fetch Clicks (Tracking)
    const { count } = await supabase
      .from('referral_tracking')
      .select('*', { count: 'exact', head: true })
      .eq('referrer_id', user.id);
    setClickCount(count || 0);

    setLoading(false);
  };

  useEffect(() => {
    if (user) {
      setEmailId(user.email || '');
      setMobileNumber(user.user_metadata?.mobile || '');
      fetchData();

      const profileChannel = supabase
        .channel('profile_seller' + Math.random())
        .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles', filter: `uid=eq.${user.id}` }, fetchData)
        .subscribe();

      const ordersChannel = supabase
        .channel('orders_affiliate' + Math.random())
        .on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter: `referrer_id=eq.${user.id}` }, fetchData)
        .subscribe();
      
      const withdrawalChannel = supabase
        .channel('withdrawals_seller' + Math.random())
        .on('postgres_changes', { event: '*', schema: 'public', table: 'withdrawals', filter: `user_id=eq.${user.id}` }, fetchData)
        .subscribe();

      const ebooksChannel = supabase
        .channel('ebooks_seller' + Math.random())
        .on('postgres_changes', { event: '*', schema: 'public', table: 'ebooks' }, fetchData)
        .subscribe();

      return () => {
        supabase.removeChannel(profileChannel);
        supabase.removeChannel(ordersChannel);
        supabase.removeChannel(withdrawalChannel);
        supabase.removeChannel(ebooksChannel);
      };
    }
  }, [user]);

  const allSalesMap = new Map<string, Order>();
  [...affiliateSales, ...directSales].forEach(sale => {
    allSalesMap.set(sale.id, sale);
  });
  const allUniqueSales = Array.from(allSalesMap.values());

  const confirmedUniqueSales = allUniqueSales.filter(s => s.status === 'success');
  
  const totalAffiliateEarnings = confirmedUniqueSales
    .filter(s => s.referrer_id === user?.id)
    .reduce((acc, sale) => acc + (sale.commission_amount || sale.ebook?.commission_amount || 0), 0);
  
  const totalDirectEarnings = confirmedUniqueSales
    .filter(s => s.ebook?.seller_id === user?.id)
    .reduce((acc, sale) => {
      // If there IS a referrer, seller gets (Amount - Commission - AdminFee)
      // If there IS NO referrer, seller gets (Amount - AdminFee)
      const commission = sale.referrer_id ? (sale.commission_amount || sale.ebook?.commission_amount || 0) : 0;
      const adminFee = 60;
      return acc + (sale.amount - commission - adminFee);
    }, 0);

  const totalWithdrawn = withdrawals
    .filter(w => w.status === 'success' || w.status === 'pending')
    .reduce((acc, w) => acc + w.amount, 0);

  const totalBalance = Math.max(0, (totalAffiliateEarnings + totalDirectEarnings) - totalWithdrawn);
  
  const pendingSales = allUniqueSales.filter(s => s.status === 'pending');
  const pendingAffiliateEarnings = pendingSales
    .filter(s => s.referrer_id === user?.id)
    .reduce((acc, sale) => acc + (sale.commission_amount || sale.ebook?.commission_amount || 0), 0);
    
  const pendingDirectEarnings = pendingSales
    .filter(s => s.ebook?.seller_id === user?.id)
    .reduce((acc, sale) => {
      const commission = sale.referrer_id ? (sale.commission_amount || sale.ebook?.commission_amount || 0) : 0;
      const adminFee = 60;
      return acc + (sale.amount - commission - adminFee);
    }, 0);

  const pendingEarnings = pendingAffiliateEarnings + pendingDirectEarnings;
  const pendingEarningsCount = pendingSales.length;
  
  const chartData = confirmedUniqueSales.reduce((acc: any[], sale) => {
    const date = new Date(sale.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
    const existing = acc.find(d => d.date === date);
    
    let earnings = 0;
    if (sale.referrer_id === user?.id) {
      earnings += (sale.commission_amount || sale.ebook?.commission_amount || 0);
    }
    if (sale.ebook?.seller_id === user?.id) {
      const commission = sale.referrer_id ? (sale.commission_amount || sale.ebook?.commission_amount || 0) : 0;
      const adminFee = 60;
      earnings += (sale.amount - commission - adminFee);
    }

    if (existing) {
      existing.earnings += earnings;
    } else {
      acc.push({ date, earnings });
    }
    return acc;
  }, []).slice(-7);

  const handleRequestWithdrawal = async () => {
    if (!user || !profile) return;
    const amount = Number(withdrawAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error('Invalid amount');
      return;
    }
    if (amount > totalBalance) {
      toast.error('Insufficient balance');
      return;
    }
    if (!upiId.includes('@')) {
      toast.error('Invalid UPI ID');
      return;
    }
    if (mobileNumber.length < 10) {
      toast.error('Invalid Mobile Number');
      return;
    }
    if (!emailId.includes('@')) {
      toast.error('Invalid Email ID');
      return;
    }

    setIsSubmittingWithdraw(true);
    try {
      // 1. Create withdrawal request
      const { error: withdrawError } = await supabase
        .from('withdrawals')
        .insert({
          user_id: user.id,
          amount,
          upi_id: upiId,
          mobile_number: mobileNumber,
          email_id: emailId,
          purchase_utr: purchaseUtr,
          status: 'pending',
          created_at: new Date().toISOString()
        });

      if (withdrawError) throw withdrawError;

      toast.success('Withdrawal request submitted! Company will verify and process within 24-48 hours.');
      setIsWithdrawOpen(false);
      setWithdrawAmount('');
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsSubmittingWithdraw(false);
    }
  };

  const handleRefresh = () => {
    fetchData();
    toast.success('Data Refreshed');
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <Loader2 className="w-10 h-10 text-orange-600 animate-spin" />
        <p className="font-bold text-zinc-400 italic">SYNCING DASHBOARD...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-20">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl font-black tracking-tight text-zinc-900 uppercase italic">Affiliate Dashboard</h1>
          <p className="text-zinc-500 font-medium">Track your commissions and manage withdrawals</p>
        </div>
        <div className="flex gap-2">
          <Dialog open={isWithdrawOpen} onOpenChange={setIsWithdrawOpen}>
            <DialogTrigger asChild>
              <Button 
                className="bg-zinc-900 hover:bg-black text-white rounded-xl font-black italic gap-2 px-6 h-12 shadow-xl shadow-zinc-900/20"
                disabled={totalBalance < 100}
              >
                <Wallet className="w-4 h-4" />
                WITHDRAW NOW
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px] rounded-[2rem]">
              <DialogHeader>
                <DialogTitle className="text-2xl font-black uppercase italic">Withdraw Earnings</DialogTitle>
                <DialogDescription>
                  Enter your UPI details to request a withdrawal. Min: ₹100.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-6 py-6">
                <div className="p-4 bg-zinc-50 rounded-2xl border border-zinc-100 flex items-center justify-between">
                  <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Available Balance</p>
                  <p className="text-2xl font-black text-zinc-900">₹{totalBalance}</p>
                </div>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label className="font-bold text-zinc-600 ml-1 text-xs uppercase tracking-wider">UPI ID (to receive payment)</Label>
                    <Input 
                      placeholder="name@upi" 
                      className="h-12 rounded-xl border-2 focus:border-zinc-900 border-zinc-100 font-medium"
                      value={upiId}
                      onChange={(e) => setUpiId(e.target.value)}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="font-bold text-zinc-600 ml-1 text-xs uppercase tracking-wider">Mobile Number</Label>
                      <Input 
                        placeholder="10-digit mobile" 
                        className="h-12 rounded-xl border-2 focus:border-zinc-900 border-zinc-100 font-medium"
                        value={mobileNumber}
                        onChange={(e) => setMobileNumber(e.target.value.replace(/\D/g, '').slice(0, 10))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="font-bold text-zinc-600 ml-1 text-xs uppercase tracking-wider">Email ID</Label>
                      <Input 
                        placeholder="email@example.com" 
                        className="h-12 rounded-xl border-2 focus:border-zinc-900 border-zinc-100 font-medium"
                        value={emailId}
                        onChange={(e) => setEmailId(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="font-bold text-zinc-600 ml-1 text-xs uppercase tracking-wider">Your Purchase UTR (to verify account)</Label>
                    <Input 
                      placeholder="12-digit UTR from your purchase" 
                      className="h-12 rounded-xl border-2 focus:border-zinc-900 border-zinc-100 font-medium"
                      value={purchaseUtr}
                      onChange={(e) => setPurchaseUtr(e.target.value.replace(/\D/g, '').slice(0, 12))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="font-bold text-zinc-600 ml-1 text-xs uppercase tracking-wider">Amount to Withdraw</Label>
                    <Input 
                      type="number"
                      placeholder="Enter amount" 
                      className="h-12 rounded-xl border-2 focus:border-zinc-900 border-zinc-100 font-black text-lg"
                      value={withdrawAmount}
                      onChange={(e) => setWithdrawAmount(e.target.value)}
                    />
                  </div>
                </div>
                <div className="bg-orange-50 p-4 rounded-xl border border-orange-100">
                  <p className="text-[10px] font-bold text-orange-800 leading-relaxed uppercase italic">
                    Note: Company will process the payment after verifying the transaction. Admin fee of ₹60 is already deducted from the sale price.
                  </p>
                </div>
              </div>
              <DialogFooter>
                <Button 
                  className="w-full h-14 rounded-2xl bg-zinc-900 hover:bg-black font-black text-lg"
                  disabled={isSubmittingWithdraw || !upiId || !withdrawAmount}
                  onClick={handleRequestWithdrawal}
                >
                  {isSubmittingWithdraw ? <Loader2 className="w-5 h-5 animate-spin" /> : 'SUBMIT REQUEST'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <Button 
            variant="outline" 
            onClick={handleRefresh}
            className="rounded-xl border-zinc-200 font-bold gap-2 h-12"
          >
            <TrendingUp className="w-4 h-4" />
          </Button>
        </div>
      </header>

      {/* Referral Eligibility Notice */}
      {!hasPurchasedAny && (
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }} 
          animate={{ opacity: 1, scale: 1 }}
          className="p-8 bg-orange-600 rounded-[2.5rem] text-white overflow-hidden relative"
        >
          <div className="absolute top-0 right-0 p-8 opacity-20 rotate-12">
            <LockIcon className="w-32 h-32" />
          </div>
          <div className="relative z-10 space-y-4">
            <Badge className="bg-white text-orange-600 border-none font-black italic">AFFILIATE ACCESS LOCKED</Badge>
            <h2 className="text-3xl font-black italic uppercase leading-none max-w-md">Unlock Your Referral Commission</h2>
            <p className="text-orange-100 font-medium max-w-sm">To start earning, you must first be a customer. Purchase any ebook once to activate your affiliate engine and get your unique code.</p>
            <Button 
              className="bg-white text-orange-600 hover:bg-zinc-100 font-black px-8 h-12 rounded-xl"
              onClick={() => navigate('/')}
            >
              BROWSE BOOKS & ACTIVATE
            </Button>
          </div>
        </motion.div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="border-none shadow-xl shadow-blue-100/50 rounded-[2.5rem] overflow-hidden bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 text-white p-8 relative">
            <div className="absolute top-0 right-0 p-8 opacity-10">
              <Share2 className="w-32 h-32 rotate-12" />
            </div>
            <div className="relative z-10">
              <p className="text-xs font-black uppercase tracking-[0.2em] opacity-80 flex items-center gap-2 mb-4">
                <BadgeCheck className="w-4 h-4" />
                Available Balance
              </p>
              <h2 className="text-4xl sm:text-6xl font-black mb-2">₹{totalBalance.toLocaleString('en-IN')}</h2>
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2 text-blue-200 font-bold text-xs">
                  <span className="opacity-60 uppercase">Direct Sales:</span>
                  <span>₹{totalDirectEarnings}</span>
                </div>
                <div className="flex items-center gap-2 text-blue-200 font-bold text-xs">
                  <span className="opacity-60 uppercase">Affiliate:</span>
                  <span>₹{totalAffiliateEarnings}</span>
                </div>
              </div>
            </div>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card className="border-none shadow-xl shadow-orange-100/50 rounded-[2.5rem] overflow-hidden bg-white p-8 border border-orange-100 relative">
            <div className="absolute top-0 right-0 p-8 opacity-5">
              <Package className="w-32 h-32" />
            </div>
            <div className="relative z-10">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-orange-600 flex items-center gap-2 mb-4">
                <Loader2 className="w-4 h-4 animate-spin" />
                Pending Commission
              </p>
              <h2 className="text-4xl sm:text-6xl font-black text-orange-600 mb-2">₹{pendingEarnings.toLocaleString('en-IN')}</h2>
              <div className="flex items-center gap-4">
                <p className="text-sm font-bold text-zinc-400">
                  {pendingEarningsCount} referral sales awaiting verification
                </p>
                <div className="h-4 w-[1px] bg-zinc-200" />
                <div className="flex items-center gap-2 text-zinc-900 font-bold">
                  <span className="text-2xl font-black">{clickCount}</span>
                  <span className="text-[10px] text-zinc-400 uppercase tracking-widest leading-tight">Link<br/>Clicks</span>
                </div>
              </div>
            </div>
          </Card>
        </motion.div>

        {hasPurchasedAny && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }} 
            animate={{ opacity: 1, y: 0 }} 
            transition={{ delay: 0.2 }}
            className="md:col-span-2"
          >
            <Card className="border-none shadow-2xl shadow-zinc-200/50 rounded-[2.5rem] overflow-hidden bg-zinc-900 text-white p-8">
              <div className="space-y-8">
                <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                  <div className="space-y-2 text-center md:text-left">
                    <Badge className="bg-zinc-800 text-zinc-400 border-none px-3 py-1 font-black italic">REFERRAL TRACKING</Badge>
                    <h3 className="text-3xl font-black italic uppercase leading-none">Your Assets</h3>
                    <p className="text-zinc-400 font-medium max-w-sm">Manage referral codes for books you've purchased.</p>
                  </div>
                  <Button 
                    variant="outline" 
                    className="border-white/10 text-white hover:bg-white/10 rounded-xl gap-2 font-black italic"
                    onClick={() => navigate('/orders')}
                  >
                    <Package className="w-4 h-4" />
                    VIEW ALL CODES
                  </Button>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {ownPurchases.slice(0, 3).map((order) => (
                    <div key={order.id} className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-4 hover:bg-white/10 transition-colors">
                      <div className="flex justify-between items-start">
                          <div className="w-12 h-16 bg-zinc-800 rounded-md overflow-hidden shrink-0 shadow-lg">
                           {order.ebook?.cover_url && <img src={order.ebook.cover_url} alt="" className="w-full h-full object-cover" />}
                        </div>
                        <Badge className="bg-green-500 text-white border-none text-[10px] font-black italic">
                          ₹{order.ebook?.commission_amount || 0}
                        </Badge>
                      </div>
                      <div className="space-y-1">
                        <h4 className="font-bold text-sm truncate leading-tight">{order.ebook?.title}</h4>
                        <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-black">Code: <span className="text-white">{order.referral_code || 'REF-ACTIVE'}</span></p>
                      </div>
                      <Button 
                        size="sm" 
                        className="w-full h-10 bg-white text-zinc-900 hover:bg-orange-500 hover:text-white rounded-xl font-bold text-xs gap-2"
                        onClick={() => {
                          const code = order.referral_code || `REF-${order.id.slice(0, 8)}`;
                          navigator.clipboard.writeText(code);
                          toast.success('Referral Code Copied!');
                        }}
                      >
                        <Copy className="w-3 h-3" />
                        COPY CODE
                      </Button>
                    </div>
                  ))}
                </div>

                <div className="bg-white/5 p-4 rounded-2xl border border-white/5 text-center">
                  <p className="text-[11px] font-bold text-zinc-500 italic">
                    All your unique referral codes are available in the <span className="text-white">My Library</span> section.
                  </p>
                </div>
              </div>
            </Card>
          </motion.div>
        )}
      </div>

      {/* Analytics & History */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.2 }}>
          <Card className="border-none shadow-xl shadow-zinc-200/50 rounded-[2.5rem] p-8 bg-white h-full relative overflow-hidden">
            <CardHeader className="px-0 pt-0">
              <CardTitle className="text-xl font-black uppercase italic flex items-center gap-2">
                <History className="w-5 h-5 text-blue-600" />
                Withdrawal History
              </CardTitle>
            </CardHeader>
            <div className="mt-4 space-y-4">
              {withdrawals.slice(0, 5).map((w) => (
                <div key={w.id} className="flex items-center justify-between p-4 rounded-2xl border border-zinc-100 bg-zinc-50/50">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm">
                      <Wallet className="w-5 h-5 text-zinc-400" />
                    </div>
                    <div>
                      <p className="font-bold text-zinc-900 tracking-tight">₹{w.amount}</p>
                      <p className="text-[10px] text-zinc-400 font-bold uppercase">{w.upi_id}</p>
                    </div>
                  </div>
                  <Badge variant={w.status === 'success' ? 'default' : w.status === 'pending' ? 'outline' : 'destructive'} 
                         className={`rounded-full px-3 text-[9px] font-black italic uppercase ${
                           w.status === 'success' ? 'bg-green-500 hover:bg-green-600' : 
                           w.status === 'pending' ? 'bg-orange-50 text-orange-600 border-orange-200' : ''
                         }`}>
                    {w.status}
                  </Badge>
                </div>
              ))}
              {withdrawals.length === 0 && (
                <div className="text-center py-20 bg-zinc-50 rounded-3xl border-2 border-dashed border-zinc-100">
                  <div className="flex flex-col items-center gap-2 opacity-30">
                    <History className="w-10 h-10" />
                    <p className="text-sm font-black italic">NO WITHDRAWALS YET</p>
                  </div>
                </div>
              )}
            </div>
          </Card>
        </motion.div>

      </div>
    </div>
  );
}

function LockIcon(props: any) {
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
      <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}
