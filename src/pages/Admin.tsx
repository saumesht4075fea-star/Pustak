import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { motion } from 'motion/react';
import { 
  Plus, Pencil, Trash2, Package, Users, IndianRupee, BookOpen, Upload, X, 
  Loader2, Image as ImageIcon, ExternalLink, BadgeCheck, Share2, 
  Search, Filter, Download, ChartBar, CreditCard, LayoutDashboard,
  CheckCircle2, AlertCircle, History, TrendingUp
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Ebook, Order, Profile } from '../types';

type AdminTab = 'overview' | 'revenue' | 'orders' | 'utr' | 'reports' | 'payouts' | 'products' | 'sellers' | 'banners';

export default function Admin() {
  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  const [ebooks, setEbooks] = useState<Ebook[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [sellers, setSellers] = useState<Profile[]>([]);
  const [withdrawals, setWithdrawals] = useState<any[]>([]);
  const [banners, setBanners] = useState<any[]>([]);
  const [isUploadingBanner, setIsUploadingBanner] = useState(false);
  const [sellerSearch, setSellerSearch] = useState('');
  const [viewingUser, setViewingUser] = useState<Profile | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [editingEbook, setEditingEbook] = useState<Ebook | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  
  const [utrSearch, setUtrSearch] = useState('');
  const [utrClipboard, setUtrClipboard] = useState('');
  const [nameSearch, setNameSearch] = useState('');
  const [upiSearch, setUpiSearch] = useState('');
  const [withdrawSearch, setWithdrawSearch] = useState('');

  const [newEbook, setNewEbook] = useState<Partial<Ebook>>({
    title: '',
    author: '',
    description: '',
    price: 0,
    commission_amount: 0,
    cover_url: '',
    file_url: '',
    category: 'Fiction',
    cosmofeed_url: '',
    seller_id: ''
  });

  const [editFormData, setEditFormData] = useState<Partial<Ebook>>({});

  const parseClipboard = (text: string) => {
    setUtrClipboard(text);
    
    // Extract UTR (usually 10-12 digits)
    const utrMatch = text.match(/\d{10,12}/);
    if (utrMatch) setUtrSearch(utrMatch[0]);

    // Simple name extraction
    const nameMatch = text.match(/(?:from|by|to)\s+([A-Za-z\s]{3,30})/i);
    if (nameMatch) setNameSearch(nameMatch[1].trim());

    // Upi ID
    const upiMatch = text.match(/[a-zA-Z0-9.\-_]{2,25}@[a-zA-Z]{2,20}/);
    if (upiMatch) setUpiSearch(upiMatch[0]);
  };

  const filteredPendingOrders = orders.filter(o => {
    if (o.status !== 'pending') return false;
    
    const matchesUtr = utrSearch === '' || o.transaction_id?.includes(utrSearch);
    const matchesName = nameSearch === '' || o.buyer?.display_name?.toLowerCase().includes(nameSearch.toLowerCase());
    const matchesUpi = upiSearch === '' || false; // We don't store buyer UPI in Order yet?
    
    return matchesUtr && matchesName && matchesUpi;
  });

  const handleFileUpload = async (file: File, type: 'cover' | 'ebook', isEdit: boolean = false) => {
    setIsUploading(true);
    const toastId = toast.loading(`Uploading ${type === 'cover' ? 'cover' : 'ebook'}...`);
    
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random()}.${fileExt}`;
      const filePath = `${type}s/${fileName}`;

      const { data, error: storageError } = await supabase.storage
        .from('ebooks')
        .upload(filePath, file);

      if (!storageError && data) {
        const { data: { publicUrl } } = supabase.storage.from('ebooks').getPublicUrl(filePath);
        if (type === 'cover') {
          if (isEdit) {
            setEditFormData(prev => ({ ...prev, cover_url: publicUrl }));
          } else {
            setNewEbook(prev => ({ ...prev, cover_url: publicUrl }));
          }
        } else if (type === 'ebook') {
          if (isEdit) {
            setEditFormData(prev => ({ ...prev, file_url: publicUrl }));
          } else {
            setNewEbook(prev => ({ ...prev, file_url: publicUrl }));
          }
        }
        toast.success(`${type === 'cover' ? 'Image' : 'PDF'} uploaded to storage!`, { id: toastId });
      } else {
        const reader = new FileReader();
        reader.onload = async (e) => {
          const base64 = e.target?.result as string;
          if (type === 'cover') {
            if (isEdit) {
              setEditFormData(prev => ({ ...prev, cover_url: base64 }));
            } else {
              setNewEbook(prev => ({ ...prev, cover_url: base64 }));
            }
          } else if (type === 'ebook') {
            if (isEdit) {
              setEditFormData(prev => ({ ...prev, file_url: base64 }));
            } else {
              setNewEbook(prev => ({ ...prev, file_url: base64 }));
            }
          }
          toast.success(`${type === 'cover' ? 'Image' : 'PDF'} saved to database!`, { id: toastId });
        };
        reader.readAsDataURL(file);
      }
    } catch (error) {
      toast.error('Failed to process file', { id: toastId });
    } finally {
      setIsUploading(false);
    }
  };

  const fetchData = async () => {
    const { data: ebooksData } = await supabase
      .from('ebooks')
      .select('id, title, author, description, price, commission_amount, cover_url, file_url, category, cosmofeed_url, seller_id, is_verified, is_deleted, created_at')
      .order('created_at', { ascending: false });
    if (ebooksData) setEbooks(ebooksData as Ebook[]);

    const { data: ordersData, error: ordersError } = await supabase
      .from('orders')
      .select(`
        *,
        ebook:ebooks(*)
      `)
      .order('created_at', { ascending: false });
    
    if (ordersError) {
      console.error('Admin Orders Fetch Error:', ordersError);
    }
    
    const { data: allProfiles } = await supabase.from('profiles').select('*');
    
    if (ordersData && allProfiles) {
      const enrichedOrders = ordersData.map(order => ({
        ...order,
        buyer: allProfiles.find(p => p.uid === order.user_id),
        referrer_profile: allProfiles.find(p => p.uid === order.referrer_id)
      }));
      setOrders(enrichedOrders as any[]);
    } else if (ordersData) {
      setOrders(ordersData as any[]);
    }

    const { data: sellersData } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });
    if (sellersData) setSellers(sellersData as Profile[]);

    const { data: withdrawData } = await supabase
      .from('withdrawals')
      .select('*, profiles(display_name, email)')
      .order('created_at', { ascending: false });
    if (withdrawData) setWithdrawals(withdrawData);

    const { data: bannerData } = await supabase
      .from('home_banners')
      .select('*')
      .order('created_at', { ascending: false });
    if (bannerData) setBanners(bannerData);
  };

  useEffect(() => {
    fetchData();
    
    // Explicit subscriptions for key tables to ensure real-time updates
    const ebooksSub = supabase.channel('admin_ebooks').on('postgres_changes', { event: '*', schema: 'public', table: 'ebooks' }, fetchData).subscribe();
    const ordersSub = supabase.channel('admin_orders').on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, fetchData).subscribe();
    const withdrawalsSub = supabase.channel('admin_withdrawals').on('postgres_changes', { event: '*', schema: 'public', table: 'withdrawals' }, fetchData).subscribe();
    const profilesSub = supabase.channel('admin_profiles').on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, fetchData).subscribe();
    const bannersSub = supabase.channel('admin_banners').on('postgres_changes', { event: '*', schema: 'public', table: 'home_banners' }, fetchData).subscribe();

    return () => { 
      supabase.removeChannel(ebooksSub);
      supabase.removeChannel(ordersSub);
      supabase.removeChannel(withdrawalsSub);
      supabase.removeChannel(profilesSub);
      supabase.removeChannel(bannersSub);
    };
  }, []);

  const handleAddEbook = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const targetSellerId = newEbook.seller_id || user.id;

      const { error } = await supabase
        .from('ebooks')
        .insert({
          title: newEbook.title,
          author: newEbook.author,
          description: newEbook.description,
          price: newEbook.price,
          commission_amount: newEbook.commission_amount,
          cover_url: newEbook.cover_url,
          file_url: newEbook.file_url,
          category: newEbook.category,
          cosmofeed_url: newEbook.cosmofeed_url || '',
          seller_id: targetSellerId,
          created_at: new Date().toISOString()
        });
      
      if (error) throw error;
      
      toast.success('Ebook added successfully');
      setIsAdding(false);
      setNewEbook({
        title: '', author: '', description: '', price: 0, commission_amount: 0,
        cover_url: '', file_url: '', category: 'Fiction', cosmofeed_url: '', seller_id: ''
      });
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const startEdit = (ebook: Ebook) => {
    setEditingEbook(ebook);
    setEditFormData(ebook);
    setIsEditing(true);
  };

  const handleEditEbook = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEbook) return;
    try {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { id, created_at, ...updateData } = editFormData as Ebook;
      const { error } = await supabase.from('ebooks').update(updateData).eq('id', editingEbook.id);
      if (error) throw error;
      toast.success('Ebook updated successfully');
      setIsEditing(false);
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleApproveWithdrawal = async (withdraw: any) => {
    const toastId = toast.loading('Processing payout...');
    try {
      const { error } = await supabase
        .from('withdrawals')
        .update({ status: 'success' })
        .eq('id', withdraw.id);
      
      if (error) throw error;
      toast.success('Withdrawal marked as success!', { id: toastId });
    } catch (err: any) {
      toast.error(err.message, { id: toastId });
    }
  };

  const handleApproveOrder = async (order: Order) => {
    const toastId = toast.loading('Approving order...');
    try {
      const { error: orderError } = await supabase.from('orders').update({ status: 'success' }).eq('id', order.id);
      if (orderError) throw orderError;

      if (order.referrer_id) {
        const { data: refProfile } = await supabase.from('profiles').select('*').eq('uid', order.referrer_id).single();
        if (refProfile) {
          const commission = order.commission_amount || order.ebook?.commission_amount || 0;
          await supabase.from('profiles').update({ affiliate_earnings: (refProfile.affiliate_earnings || 0) + commission }).eq('uid', order.referrer_id);
        }
      }

      const sellerId = order.ebook?.seller_id;
      if (sellerId) {
        const { data: sellerProfile } = await supabase.from('profiles').select('*').eq('uid', sellerId).single();
        if (sellerProfile) {
          const commission = order.commission_amount || order.ebook?.commission_amount || 0;
          const adminFee = 60;
          const sellerNet = order.amount - commission - adminFee;
          if (sellerNet > 0) {
            await supabase.from('profiles').update({ earnings: (sellerProfile.earnings || 0) + sellerNet }).eq('uid', sellerId);
          }
        }
      }

      toast.success('Order approved successfully!', { id: toastId });
      fetchData();
    } catch (error: any) {
      toast.error(error.message, { id: toastId });
    }
  };

  const handleRejectOrder = async (orderId: string) => {
    try {
      const { error } = await supabase.from('orders').update({ status: 'failed' }).eq('id', orderId);
      if (error) throw error;
      toast.success('Order rejected');
      fetchData();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleAddBanner = async (file: File, title: string, subtitle: string) => {
    setIsUploadingBanner(true);
    const toastId = toast.loading('Uploading banner image...');
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random()}.${fileExt}`;
      const filePath = `banners/${fileName}`;

      const { data, error: storageError } = await supabase.storage
        .from('ebooks')
        .upload(filePath, file);

      if (storageError) throw storageError;

      const { data: { publicUrl } } = supabase.storage.from('ebooks').getPublicUrl(filePath);

      // Attempt to insert with all fields
      const { error: dbError } = await supabase.from('home_banners').insert({
        image_url: publicUrl,
        title: title || 'READ. LEARN. DOMINATE.',
        subtitle: subtitle || 'Access thousands of premium ebooks from top authors.',
        created_at: new Date().toISOString()
      });

      // If it fails because of missing columns, retry with just image_url
      if (dbError) {
        if (dbError.message.includes('column') || dbError.code === '42703') {
          const { error: retryError } = await supabase.from('home_banners').insert({
            image_url: publicUrl,
            created_at: new Date().toISOString()
          });
          if (retryError) throw retryError;
          toast.success('Banner added! Note: Title/Subtitle were skipped because columns are missing in your database.', { id: toastId, duration: 5000 });
        } else {
          throw dbError;
        }
      } else {
        toast.success('Banner added successfully!', { id: toastId });
      }
      
      fetchData();
    } catch (err: any) {
      toast.error(err.message, { id: toastId });
    } finally {
      setIsUploadingBanner(false);
    }
  };

  const handleDeleteBanner = async (id: string) => {
    try {
      const { error } = await supabase.from('home_banners').delete().eq('id', id);
      if (error) throw error;
      toast.success('Banner removed');
      fetchData();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleSoftDeleteEbook = async () => {
    if (!deletingId) return;
    try {
      const { error } = await supabase.from('ebooks').update({ is_deleted: true }).eq('id', deletingId);
      if (error) throw error;
      toast.success('Product archived. Sales data preserved.');
      setDeletingId(null);
      fetchData();
    } catch (error: any) {
       toast.error(error.message);
    }
  };

  const handleVerifyEbook = async (id: string, status: boolean) => {
    try {
      const { error } = await supabase.from('ebooks').update({ is_verified: status }).eq('id', id);
      if (error) throw error;
      toast.success(status ? 'Product Verified' : 'Verification Revoked');
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const onDragOver = (e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); };
  const onDrop = (e: React.DragEvent, type: 'cover' | 'ebook', isEdit: boolean = false) => {
    e.preventDefault(); e.stopPropagation();
    const files = e.dataTransfer.files;
    if (files && files.length > 0) handleFileUpload(files[0], type, isEdit);
  };

  const totalRevenue = orders.filter(o => o.status === 'success').reduce((acc, o) => acc + o.amount, 0);
  const referralRevenue = orders.filter(o => o.status === 'success' && o.referrer_id).reduce((acc, o) => acc + o.amount, 0);
  const directRevenue = orders.filter(o => o.status === 'success' && !o.referrer_id).reduce((acc, o) => acc + o.amount, 0);
  const pendingAmount = orders.filter(o => o.status === 'pending').reduce((acc, o) => acc + o.amount, 0);

  const NavItem = ({ id, label, icon: Icon }: { id: AdminTab, label: string, icon: any }) => (
    <button
      onClick={() => setActiveTab(id)}
      className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-black transition-all ${
        activeTab === id 
          ? 'bg-zinc-900 text-white shadow-lg shadow-zinc-900/20' 
          : 'text-zinc-500 hover:bg-zinc-100'
      }`}
    >
      <Icon className="w-4 h-4" />
      <span className="hidden sm:inline">{label}</span>
    </button>
  );

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-4xl font-black tracking-tight text-zinc-900">Admin Command</h1>
          <p className="text-zinc-500 font-bold uppercase text-[10px] tracking-widest mt-1">Control Center • Verified Operations</p>
        </div>
        <div className="flex flex-wrap gap-2 bg-zinc-50 p-1.5 rounded-2xl border border-zinc-100">
          <NavItem id="overview" label="Dashboard" icon={LayoutDashboard} />
          <NavItem id="revenue" label="Revenue History" icon={IndianRupee} />
          <NavItem id="orders" label="All Orders" icon={History} />
          <NavItem id="utr" label="UTR Matcher" icon={CheckCircle2} />
          <NavItem id="reports" label="Products & Sales" icon={ChartBar} />
          <NavItem id="payouts" label="Withdrawals" icon={CreditCard} />
          <NavItem id="products" label="Products" icon={Package} />
          <NavItem id="sellers" label="Sellers" icon={Users} />
          <NavItem id="banners" label="Hero Banners" icon={ImageIcon} />
        </div>
      </div>

      {activeTab === 'overview' && (
        <div className="space-y-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <Card className="border-zinc-200 shadow-sm bg-zinc-900 text-white cursor-pointer hover:bg-black transition-colors" onClick={() => setActiveTab('revenue')}>
              <CardHeader className="pb-2">
                <CardDescription className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Total Revenue</CardDescription>
                <CardTitle className="text-3xl font-black text-white">₹{totalRevenue}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-1 text-[10px] font-bold text-zinc-400 uppercase italic">
                  Click to view monthly history →
                </div>
              </CardContent>
            </Card>
            <Card className="border-zinc-200 shadow-sm bg-gradient-to-br from-white to-zinc-50">
              <CardHeader className="pb-2">
                <CardDescription className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Affiliate Sales</CardDescription>
                <CardTitle className="text-3xl font-black text-green-600">₹{referralRevenue}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-1 text-[10px] font-bold text-green-600">
                  Revenue via Referrals
                </div>
              </CardContent>
            </Card>
            <Card className="border-zinc-200 shadow-sm">
              <CardHeader className="pb-2">
                <CardDescription className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Direct Sales</CardDescription>
                <CardTitle className="text-3xl font-black text-zinc-900">₹{directRevenue}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-[10px] font-bold text-zinc-400">Revenue without Referrals</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <Card className="border-zinc-200 shadow-sm">
              <CardHeader className="pb-2">
                <CardDescription className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Total Users</CardDescription>
                <CardTitle className="text-3xl font-black text-zinc-900">{sellers.filter(s => s.role !== 'admin').length}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-[10px] font-bold text-zinc-400">Registered Affiliates</p>
              </CardContent>
            </Card>
            <Card className="border-zinc-200 shadow-sm">
              <CardHeader className="pb-2">
                <CardDescription className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Verification Pool</CardDescription>
                <CardTitle className="text-3xl font-black text-orange-600">₹{pendingAmount}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-[10px] font-bold text-zinc-400">{orders.filter(o => o.status === 'pending').length} Unmatched UTRs</p>
              </CardContent>
            </Card>
            <Card className="border-zinc-200 shadow-sm">
              <CardHeader className="pb-2">
                <CardDescription className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Payout Pool</CardDescription>
                <CardTitle className="text-3xl font-black text-blue-600">₹{withdrawals.filter(w => w.status === 'pending').reduce((acc, w) => acc + w.amount, 0)}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-[10px] font-bold text-zinc-400">{withdrawals.filter(w => w.status === 'pending').length} Active Requests</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
             <Card className="border-zinc-200 shadow-xl ring-2 ring-orange-100">
                <CardHeader>
                  <CardTitle className="text-xl font-black text-orange-600 flex items-center gap-2">
                    <AlertCircle className="w-5 h-5" />
                    Action Required
                  </CardTitle>
                  <CardDescription>Transactions waiting for UTR verification</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {orders.filter(o => o.status === 'pending').slice(0, 5).map(order => (
                      <div key={order.id} className="p-4 bg-orange-50/30 rounded-2xl border border-orange-100 flex items-center justify-between">
                        <div>
                          <p className="text-xs font-black text-zinc-900">UTR: {order.transaction_id}</p>
                          <p className="text-[10px] font-bold text-orange-600 uppercase">
                            ₹{order.amount} • {order.buyer?.display_name || 'No Name'} ({order.buyer?.email || 'No Email'})
                          </p>
                        </div>
                        <Button 
                          size="sm" 
                          className="bg-orange-600 hover:bg-orange-700 text-[10px] font-black h-8 rounded-lg"
                          onClick={() => setActiveTab('utr')}
                        >
                          VERIFY
                        </Button>
                      </div>
                    ))}
                    {orders.filter(o => o.status === 'pending').length === 0 && (
                      <div className="text-center py-8">
                        <CheckCircle2 className="w-8 h-8 text-green-500 mx-auto mb-2" />
                        <p className="text-sm font-bold text-zinc-400 uppercase italic">All Clean • No Pending Work</p>
                      </div>
                    )}
                  </div>
                </CardContent>
             </Card>
          </div>
        </div>
      )}

      {activeTab === 'revenue' && (() => {
        const successfulOrders = orders.filter(o => o.status === 'success');
        const groupedByMonth = successfulOrders.reduce((acc, order) => {
          const date = new Date(order.created_at);
          const monthKey = date.toLocaleString('default', { month: 'long', year: 'numeric' });
          if (!acc[monthKey]) acc[monthKey] = { total: 0, days: {} };
          acc[monthKey].total += order.amount;
          
          const dayKey = date.toLocaleDateString();
          if (!acc[monthKey].days[dayKey]) acc[monthKey].days[dayKey] = { total: 0, count: 0 };
          acc[monthKey].days[dayKey].total += order.amount;
          acc[monthKey].days[dayKey].count += 1;
          
          return acc;
        }, {} as Record<string, { total: number, days: Record<string, { total: number, count: number }> }>);

        const sortedMonths = Object.keys(groupedByMonth).sort((a, b) => new Date(b).getTime() - new Date(a).getTime());

        return (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {sortedMonths.length > 0 ? (
              sortedMonths.map((month) => (
                <Card key={month} className="border-none shadow-xl shadow-zinc-200/50 rounded-[2.5rem] bg-white overflow-hidden">
                  <div className="bg-zinc-900 p-8 text-white flex flex-col md:flex-row items-center justify-between gap-6">
                    <div className="space-y-1 text-center md:text-left">
                      <Badge className="bg-orange-600 text-white border-none font-black italic uppercase tracking-widest mb-2">Platform Revenue</Badge>
                      <h2 className="text-3xl font-black tracking-tighter uppercase italic leading-none">{month}</h2>
                    </div>
                    <div className="text-center md:text-right">
                       <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-1">Monthly Total</p>
                       <p className="text-4xl font-black italic text-orange-500">₹{groupedByMonth[month].total.toLocaleString('en-IN')}</p>
                    </div>
                  </div>
                  <CardContent className="p-8">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {Object.keys(groupedByMonth[month].days)
                        .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())
                        .map((day) => (
                        <div key={day} className="p-6 rounded-3xl bg-zinc-50 border border-zinc-100 group hover:border-orange-200 hover:bg-orange-50/30 transition-all">
                          <div className="flex justify-between items-start mb-4">
                            <div>
                               <p className="text-[10px] font-black text-zinc-400 group-hover:text-orange-400 uppercase tracking-[0.2em]">{new Date(day).toLocaleDateString(undefined, { weekday: 'short' })}</p>
                               <p className="text-lg font-black text-zinc-900 group-hover:text-orange-600 tracking-tighter italic">{day}</p>
                            </div>
                            <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-zinc-300 group-hover:text-orange-200 border border-zinc-100 group-hover:border-orange-100 shadow-sm">
                               <TrendingUp className="w-5 h-5" />
                            </div>
                          </div>
                          <div className="pt-4 border-t border-zinc-200/50 flex justify-between items-end">
                             <div>
                                <p className="text-[9px] font-black text-zinc-400 uppercase">Daily Total</p>
                                <p className="text-2xl font-black text-zinc-900">₹{groupedByMonth[month].days[day].total}</p>
                             </div>
                             <div className="text-right">
                                <p className="text-[9px] font-black text-zinc-400 uppercase">Sales</p>
                                <span className="bg-zinc-900 text-white text-[10px] font-black px-2 py-0.5 rounded-full">{groupedByMonth[month].days[day].count}</span>
                             </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))
            ) : (
              <div className="text-center py-40 bg-white rounded-[3rem] border border-zinc-100 shadow-xl">
                 <div className="flex flex-col items-center gap-4 opacity-20">
                    <History className="w-16 h-16" />
                    <h2 className="text-xl font-black uppercase italic">No Successful Sales Yet</h2>
                 </div>
              </div>
            )}
          </div>
        );
      })()}

      {activeTab === 'orders' && (
        <div className="space-y-8 animate-in fade-in duration-500">
           <Card className="border-zinc-200 shadow-xl">
              <CardHeader className="bg-zinc-900 text-white rounded-t-3xl">
                <CardTitle className="text-2xl font-black flex items-center gap-2">
                  <Package className="w-6 h-6 text-orange-500" />
                  Global Order Stream
                </CardTitle>
                <CardDescription className="text-zinc-400 uppercase text-[10px] font-black tracking-widest mt-1">
                  Full Visibility • Real-time Transactions
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                       <thead className="bg-zinc-50 border-b border-zinc-100 text-[10px] font-black uppercase text-zinc-400 tracking-widest">
                          <tr>
                             <th className="px-6 py-4">Status</th>
                             <th className="px-6 py-4">Buyer (Username)</th>
                             <th className="px-6 py-4">UTR Number</th>
                             <th className="px-6 py-4">Product</th>
                             <th className="px-6 py-4">Referrer</th>
                             <th className="px-6 py-4">Amount</th>
                             <th className="px-6 py-4 text-right">Date</th>
                          </tr>
                       </thead>
                       <tbody className="divide-y divide-zinc-100">
                          {orders.map(order => {
                            const referrer = sellers.find(s => s.uid === order.referrer_id);
                            return (
                               <tr key={order.id} className="hover:bg-zinc-50/50 transition-colors">
                                  <td className="px-6 py-4">
                                     <Badge className={`font-black text-[9px] uppercase ${
                                       order.status === 'success' ? 'bg-green-100 text-green-700' : 
                                       order.status === 'pending' ? 'bg-orange-100 text-orange-700' : 
                                       'bg-red-100 text-red-700'
                                     }`}>
                                       {order.status}
                                     </Badge>
                                  </td>
                                  <td className="px-6 py-4">
                                     <p className="text-sm font-black text-zinc-900 italic uppercase underline decoration-zinc-200 underline-offset-4">
                                       {order.buyer?.display_name || 'NO NAME'}
                                     </p>
                                     <p className="text-[10px] text-zinc-600 font-bold">{order.buyer?.email || 'NO EMAIL'}</p>
                                     <p className="text-[7px] text-zinc-300 font-bold font-mono uppercase tracking-tighter">UID: {order.user_id}</p>
                                  </td>
                                  <td className="px-6 py-4">
                                     <span className="font-mono text-zinc-600 bg-zinc-100 px-2 py-1 rounded-lg border border-zinc-200 text-xs">
                                       {order.transaction_id || 'NO UTR'}
                                     </span>
                                  </td>
                                  <td className="px-6 py-4">
                                     <p className="text-xs font-bold text-zinc-900 line-clamp-1">{order.ebook?.title}</p>
                                  </td>
                                  <td className="px-6 py-4">
                                     {order.referrer_id ? (
                                       <div className="flex flex-col">
                                          <p className="text-xs font-black text-blue-600 uppercase italic">
                                             {order.referrer_profile?.display_name || (order.referrer_profile?.email?.split('@')[0]) || 'Affiliate'}
                                          </p>
                                          <p className="text-[8px] font-bold text-zinc-400 mt-0.5">ID: {order.referrer_id?.slice(0, 8)}</p>
                                          <p className="text-[7px] text-blue-300 font-bold uppercase tracking-tighter">Verified Purchase Source</p>
                                       </div>
                                     ) : (
                                       <span className="text-[10px] font-black text-zinc-300 uppercase tracking-widest italic">Direct Buy</span>
                                     )}
                                  </td>
                                  <td className="px-6 py-4 text-xs font-black text-zinc-900">
                                     ₹{order.amount}
                                  </td>
                                  <td className="px-6 py-4 text-right">
                                     <p className="text-[10px] font-bold text-zinc-600">{new Date(order.created_at).toLocaleDateString()}</p>
                                     <p className="text-[9px] text-zinc-400">{new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                                  </td>
                               </tr>
                            );
                          })}
                          {orders.length === 0 && (
                            <tr>
                               <td colSpan={7} className="px-6 py-20 text-center">
                                  <Package className="w-12 h-12 text-zinc-100 mx-auto mb-4" />
                                  <p className="text-zinc-400 font-black uppercase text-sm italic tracking-widest">No Transactions Found</p>
                               </td>
                            </tr>
                          )}
                       </tbody>
                    </table>
                </div>
              </CardContent>
           </Card>
        </div>
      )}
      {activeTab === 'utr' && (
        <div className="space-y-8 animate-in fade-in duration-500">
           <Card className="border-zinc-200 shadow-2xl">
              <CardHeader className="bg-zinc-900 text-white rounded-t-3xl">
                <CardTitle className="text-2xl font-black flex items-center gap-2">
                  <CreditCard className="w-6 h-6 text-orange-500" />
                  Live UTR Matching Panel
                </CardTitle>
              </CardHeader>
              <CardContent className="p-8">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                   <div className="lg:col-span-1 space-y-6">
                      <div className="bg-zinc-50 p-6 rounded-3xl border-2 border-zinc-100">
                         <Label className="text-xs font-black uppercase text-zinc-400 tracking-tighter mb-2 block">Quick Clipboard Search</Label>
                         <Textarea 
                           placeholder="Paste block text from payment notification..."
                           className="h-32 bg-white rounded-2xl border-2 focus:border-orange-500 transition-all font-medium text-sm"
                           value={utrClipboard}
                           onChange={(e) => parseClipboard(e.target.value)}
                         />
                      </div>
                      <div className="space-y-4">
                         <div className="space-y-1">
                            <Label className="text-[10px] font-black uppercase text-zinc-400 ml-1">Manual UTR Match</Label>
                            <Input 
                               placeholder="UTR Number..." 
                               className="h-12 rounded-xl border-zinc-200 focus:border-zinc-900 font-bold"
                               value={utrSearch}
                               onChange={(e) => setUtrSearch(e.target.value)}
                            />
                         </div>
                         <div className="space-y-1">
                            <Label className="text-[10px] font-black uppercase text-zinc-400 ml-1">Buyer Name Match</Label>
                            <Input 
                               placeholder="Buyer Name..." 
                               className="h-12 rounded-xl border-zinc-200 focus:border-zinc-900 font-bold"
                               value={nameSearch}
                               onChange={(e) => setNameSearch(e.target.value)}
                            />
                         </div>
                      </div>
                   </div>

                   <div className="lg:col-span-2 space-y-4">
                      <div className="flex items-center justify-between mb-2">
                         <p className="text-xs font-black text-zinc-400 uppercase tracking-widest">
                           {filteredPendingOrders.length} Results Matched
                         </p>
                         <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => {
                              setUtrSearch('');
                              setNameSearch('');
                              setUpiSearch('');
                              setUtrClipboard('');
                            }} 
                            className="text-[10px] font-black uppercase underline"
                         >
                            Clear All Filters
                         </Button>
                      </div>

                      <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2">
                         {filteredPendingOrders.map(order => (
                             <div 
                               key={order.id} 
                               className={`p-6 rounded-3xl border-2 transition-all ${
                                 utrSearch && order.transaction_id?.includes(utrSearch)
                                   ? 'border-orange-500 bg-orange-50' 
                                   : 'border-zinc-100 bg-white'
                               }`}
                             >
                                <div className="flex flex-col sm:flex-row justify-between gap-6">
                                   <div className="space-y-2 text-left">
                                      <div className="flex items-center gap-2">
                                         <Badge className="bg-zinc-900 font-black text-[9px]">ORDER #{order.id.slice(-6)}</Badge>
                                         <Badge className={`font-black text-[9px] ${order.referrer_id ? 'bg-blue-600' : 'bg-purple-600'}`}>
                                            {order.referrer_id ? 'REFERRAL' : 'DIRECT'}
                                         </Badge>
                                      </div>
                                      <h3 className="text-2xl font-black text-zinc-900">₹{order.amount}</h3>
                                      <div className="space-y-0.5">
                                         <p className="text-sm font-black text-zinc-900 uppercase italic tracking-tight">
                                           {order.buyer?.display_name || 'BUYER NAME MISSING'}
                                         </p>
                                         <p className="text-[10px] font-bold text-zinc-500">Email: {order.buyer?.email || 'No Email Registered'}</p>
                                         <p className="text-[9px] font-medium text-zinc-400 italic">User ID: {order.user_id}</p>
                                         <p className="text-[10px] font-medium text-zinc-500 italic">{order.ebook?.title}</p>
                                         <div className="flex items-center gap-2 mt-2">
                                            <p className="text-xs font-black text-orange-600 bg-orange-100/50 w-fit px-2 rounded">UTR: {order.transaction_id}</p>
                                            {order.referrer_id && (
                                              <Badge className="bg-blue-50 text-blue-600 border-blue-100 h-5 text-[8px] font-black">
                                                 REF: {order.referrer_profile?.display_name || 'Affiliate'}
                                              </Badge>
                                            )}
                                         </div>
                                      </div>
                                   </div>
                                   <div className="flex flex-col justify-end items-end gap-3">
                                      <Button className="w-full bg-green-600 hover:bg-green-700 text-xs font-black rounded-xl h-10" onClick={() => handleApproveOrder(order)}>APPROVE</Button>
                                      <Button variant="outline" className="w-full border-red-100 text-red-600 text-[10px] font-black rounded-xl h-10" onClick={() => handleRejectOrder(order.id)}>REJECT</Button>
                                   </div>
                                </div>
                             </div>
                           ))}
                      </div>

                      {/* UTR Matching History */}
                      <div className="mt-12 space-y-6">
                         <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                            <div className="flex items-center gap-2">
                               <History className="w-5 h-5 text-zinc-400" />
                               <h4 className="text-lg font-black uppercase text-zinc-900 tracking-tight">UTR Success History</h4>
                            </div>
                         </div>
                         
                         <div className="bg-zinc-50 rounded-[2rem] overflow-hidden border border-zinc-100 shadow-xl shadow-zinc-200/40">
                           <div className="overflow-x-auto">
                             <table className="w-full text-left">
                               <thead className="bg-white/80 backdrop-blur-md border-b border-zinc-100 text-[10px] font-black uppercase text-zinc-400 tracking-widest">
                                 <tr>
                                   <th className="px-6 py-4">Buyer</th>
                                   <th className="px-6 py-4">UTR #</th>
                                   <th className="px-6 py-4">Day</th>
                                   <th className="px-6 py-4">Date & Time</th>
                                   <th className="px-6 py-4 truncate">Product</th>
                                   <th className="px-6 py-4 text-right">Amount</th>
                                 </tr>
                               </thead>
                               <tbody className="divide-y divide-zinc-100 bg-white/40">
                                 {orders.filter(o => o.status === 'success').map(o => {
                                   const date = new Date(o.created_at);
                                   const day = date.toLocaleDateString(undefined, { weekday: 'long' });
                                   const dateStr = date.toLocaleDateString();
                                   const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

                                   return (
                                     <tr key={o.id} className="text-xs font-bold text-zinc-600 hover:bg-white transition-colors">
                                       <td className="px-6 py-4">
                                          <p className="font-black text-zinc-900 italic uppercase">{o.buyer?.display_name || 'N/A'}</p>
                                          <p className="text-[9px] font-bold text-zinc-400">{o.buyer?.email || 'N/A'}</p>
                                       </td>
                                       <td className="px-6 py-4">
                                          <span className="font-mono text-green-600 bg-green-50 px-2 py-1 rounded-lg border border-green-100">{o.transaction_id}</span>
                                       </td>
                                       <td className="px-6 py-4 uppercase text-[10px] font-black text-zinc-400 italic">{day}</td>
                                       <td className="px-6 py-4">
                                          <p className="text-zinc-900">{dateStr}</p>
                                          <p className="text-[10px] text-zinc-400">{timeStr}</p>
                                       </td>
                                       <td className="px-6 py-4 truncate max-w-[150px]">{o.ebook?.title}</td>
                                       <td className="px-6 py-4 text-right text-zinc-900 font-black">₹{o.amount}</td>
                                     </tr>
                                   );
                                 })}
                               </tbody>
                             </table>
                           </div>
                         </div>
                      </div>
                   </div>
                </div>
              </CardContent>
           </Card>
        </div>
      )}

      {activeTab === 'reports' && (
        <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-500">
           <Card className="border-zinc-200 shadow-sm">
              <CardHeader>
                 <CardTitle className="text-xl font-black">Digital Product Sales & Performance</CardTitle>
                 <CardDescription>Detailed revenue breakdown: Direct vs Affiliate Sales.</CardDescription>
              </CardHeader>
              <CardContent className="px-0">
                 <div className="overflow-x-auto">
                    <table className="w-full text-left">
                       <thead className="bg-zinc-50 border-b border-zinc-100">
                          <tr>
                             <th className="px-6 py-4 text-[10px] font-black uppercase text-zinc-400">Product</th>
                             <th className="px-6 py-4 text-[10px] font-black uppercase text-zinc-400 text-right">Direct Rev</th>
                             <th className="px-6 py-4 text-[10px] font-black uppercase text-zinc-400 text-right">Affiliate Rev</th>
                             <th className="px-6 py-4 text-[10px] font-black uppercase text-zinc-400 text-right">Total Rev</th>
                             <th className="px-6 py-4 text-[10px] font-black uppercase text-zinc-400 text-right">Total Sales</th>
                          </tr>
                       </thead>
                       <tbody className="divide-y divide-zinc-100">
                          {ebooks.map(ebook => {
                            const stats = orders.filter(o => o.ebook_id === ebook.id && o.status === 'success');
                            const directRev = stats.filter(o => !o.referrer_id).reduce((acc, o) => acc + o.amount, 0);
                            const affiliateRev = stats.filter(o => o.referrer_id).reduce((acc, o) => acc + o.amount, 0);
                            const totalRev = stats.reduce((acc, o) => acc + o.amount, 0);
                            
                            return (
                              <tr key={ebook.id} className="hover:bg-zinc-50/50 transition-colors">
                                 <td className="px-6 py-4">
                                    <div className="flex items-center gap-3">
                                       <div className="w-10 h-14 rounded-lg bg-zinc-100 overflow-hidden shadow-sm border border-zinc-200">
                                          {ebook.cover_url && <img src={ebook.cover_url} className="w-full h-full object-cover" />}
                                       </div>
                                       <div>
                                          <p className="text-sm font-black text-zinc-900 line-clamp-1">{ebook.title}</p>
                                          <p className="text-[10px] text-zinc-400 font-bold uppercase">{ebook.author}</p>
                                          {ebook.is_deleted ? 
                                            <Badge variant="secondary" className="text-red-500 bg-red-50 text-[10px] h-4">DELETED</Badge> : 
                                            <Badge variant="secondary" className="text-green-500 bg-green-50 text-[10px] h-4">ACTIVE</Badge>
                                          }
                                       </div>
                                    </div>
                                 </td>
                                 <td className="px-6 py-4 text-right">
                                    <p className="text-xs font-black text-zinc-900">₹{directRev}</p>
                                    <p className="text-[9px] text-zinc-400 font-bold">{(stats.filter(o => !o.referrer_id).length)} sales</p>
                                 </td>
                                 <td className="px-6 py-4 text-right">
                                    <p className="text-xs font-black text-blue-600">₹{affiliateRev}</p>
                                    <p className="text-[9px] text-zinc-400 font-bold">{(stats.filter(o => !!o.referrer_id).length)} sales</p>
                                 </td>
                                 <td className="px-6 py-4 text-right">
                                    <p className="text-sm font-black text-zinc-900">₹{totalRev}</p>
                                 </td>
                                 <td className="px-6 py-4 text-right">
                                    <Badge variant="outline" className="font-black text-zinc-900">{stats.length}</Badge>
                                 </td>
                              </tr>
                            );
                          })}
                       </tbody>
                       <tfoot className="bg-zinc-900 text-white font-black">
                          <tr>
                             <td className="px-6 py-4 text-xs uppercase italic">TOTAL REVENUE (ALL PRODUCTS)</td>
                             <td className="px-6 py-4 text-right text-xs">₹{directRevenue}</td>
                             <td className="px-6 py-4 text-right text-xs">₹{referralRevenue}</td>
                             <td className="px-6 py-4 text-right text-sm">₹{totalRevenue}</td>
                             <td className="px-6 py-4 text-right">
                                <Badge className="bg-white text-zinc-900">{orders.filter(o => o.status === 'success').length}</Badge>
                             </td>
                          </tr>
                       </tfoot>
                    </table>
                 </div>
              </CardContent>
           </Card>
        </div>
      )}

      {activeTab === 'payouts' && (
        <div className="space-y-8 animate-in slide-in-from-right-4 duration-500">
           <Card className="border-zinc-200 shadow-xl ring-4 ring-blue-50">
              <CardHeader className="bg-blue-600 text-white rounded-t-3xl border-b-4 border-blue-700">
                <CardTitle className="text-2xl font-black">Verified Payout Queue</CardTitle>
                <CardDescription className="text-blue-100">Process withdrawals for successful affiliates.</CardDescription>
              </CardHeader>
              <CardContent className="p-6 space-y-4">
                  {withdrawals.filter(w => w.status === 'pending').map((w) => (
                    <div key={w.id} className="p-6 bg-white rounded-3xl border-2 border-zinc-100 shadow-sm space-y-4">
                        <div className="flex justify-between items-start">
                          <div>
                             <p className="text-4xl font-black text-zinc-900">₹{w.amount}</p>
                             <div className="bg-blue-50 p-2 rounded-xl border border-blue-100 mt-2">
                                <p className="text-sm font-black text-blue-700">{w.upi_id}</p>
                             </div>
                             {w.mobile_number && <p className="text-xs font-black text-zinc-400 mt-2">Mob: {w.mobile_number}</p>}
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-black text-zinc-900">{w.profiles?.display_name}</p>
                            <p className="text-[10px] text-zinc-400 font-bold uppercase">{w.email_id || w.profiles?.email}</p>
                            {w.purchase_utr && (
                              <div className="mt-2 bg-orange-50 px-2 py-1 rounded border border-orange-100">
                                <p className="text-[9px] font-black text-orange-600 uppercase">Verification UTR</p>
                                <p className="text-[10px] font-bold text-orange-700">{w.purchase_utr}</p>
                              </div>
                            )}
                          </div>
                        </div>
                        <Button className="w-full bg-blue-600 hover:bg-blue-700 h-12 rounded-2xl font-black shadow-lg shadow-blue-600/20" onClick={() => handleApproveWithdrawal(w)}>DISBURSE PAYMENT</Button>
                    </div>
                  ))}
                  {withdrawals.filter(w => w.status === 'pending').length === 0 && (
                    <div className="py-20 text-center text-zinc-400 font-bold italic">All payouts completed.</div>
                  )}

                  {/* Withdrawal history */}
                  <div className="mt-12 space-y-6">
                     <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex items-center gap-2">
                           <History className="w-5 h-5 text-blue-600" />
                           <h4 className="text-lg font-black uppercase text-zinc-900 tracking-tight">Full Payout History</h4>
                        </div>
                        <div className="relative group max-w-sm w-full">
                           <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 group-focus-within:text-blue-600 transition-colors" />
                           <Input 
                              placeholder="Search history by name, UPI or amount..." 
                              className="pl-10 h-11 rounded-xl border-zinc-200 focus:ring-blue-500 focus:border-blue-500 font-bold text-sm"
                              value={withdrawSearch}
                              onChange={(e) => setWithdrawSearch(e.target.value)}
                           />
                        </div>
                     </div>

                     <div className="bg-zinc-50 rounded-[2rem] overflow-hidden border border-zinc-100 shadow-xl shadow-zinc-200/40">
                        <div className="overflow-x-auto">
                           <table className="w-full text-left">
                              <thead className="bg-white/80 backdrop-blur-md border-b border-zinc-100 text-[10px] font-black uppercase text-zinc-400 tracking-widest">
                                 <tr>
                                    <th className="px-6 py-4">Recipient</th>
                                    <th className="px-6 py-4">UPI ID</th>
                                    <th className="px-6 py-4 text-center">Day</th>
                                    <th className="px-6 py-4 text-center">Date & Time</th>
                                    <th className="px-6 py-4 text-right">Amount Paid</th>
                                 </tr>
                              </thead>
                              <tbody className="divide-y divide-zinc-100 bg-white/40">
                                 {withdrawals
                                  .filter(w => w.status === 'success')
                                  .filter(w => {
                                    const s = withdrawSearch.toLowerCase();
                                    return (
                                      w.profiles?.display_name?.toLowerCase().includes(s) ||
                                      w.upi_id?.toLowerCase().includes(s) ||
                                      w.amount.toString().includes(s)
                                    );
                                  })
                                  .map(w => {
                                    const date = new Date(w.created_at);
                                    const day = date.toLocaleDateString(undefined, { weekday: 'long' });
                                    const dateStr = date.toLocaleDateString();
                                    const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

                                    return (
                                      <tr key={w.id} className="text-xs font-bold text-zinc-600 hover:bg-white transition-colors group">
                                         <td className="px-6 py-4">
                                            <p className="font-black text-zinc-900 text-sm group-hover:text-blue-600 transition-colors uppercase italic">{w.profiles?.display_name || 'N/A'}</p>
                                         </td>
                                         <td className="px-6 py-4">
                                            <p className="font-mono text-[10px] bg-zinc-100 px-2 py-1 rounded-lg inline-block">{w.upi_id}</p>
                                         </td>
                                         <td className="px-6 py-4 text-center uppercase text-[10px] font-black text-zinc-400 italic">
                                            {day}
                                         </td>
                                         <td className="px-6 py-4 text-center">
                                            <p className="text-zinc-900">{dateStr}</p>
                                            <p className="text-[10px] text-zinc-400 mt-0.5">{timeStr}</p>
                                         </td>
                                         <td className="px-6 py-4 text-right">
                                            <span className="text-sm font-black text-blue-600 italic">₹{w.amount}</span>
                                         </td>
                                      </tr>
                                    );
                                  })}
                                 {withdrawals.filter(w => w.status === 'success').length === 0 && (
                                   <tr>
                                     <td colSpan={5} className="px-6 py-20 text-center text-zinc-300 italic font-black uppercase tracking-widest text-sm">No payout history recorded yet.</td>
                                   </tr>
                                 )}
                              </tbody>
                           </table>
                        </div>
                     </div>
                  </div>
              </CardContent>
           </Card>
        </div>
      )}

      {activeTab === 'products' && (
        <div className="space-y-6">
           <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {ebooks.map(ebook => (
                <Card key={ebook.id} className={`border-zinc-200 overflow-hidden group ${ebook.is_deleted ? 'opacity-70 bg-zinc-50' : ''}`}>
                   <div className="relative aspect-[3/4]">
                      {ebook.cover_url && <img src={ebook.cover_url} className={`w-full h-full object-cover ${ebook.is_deleted ? 'grayscale' : ''}`} />}
                      <div className="absolute top-2 right-2 flex gap-1">
                        {!ebook.is_deleted ? (
                          <>
                            <Button size="icon" variant="secondary" className="w-8 h-8 rounded-full shadow-lg" onClick={() => startEdit(ebook)}><Pencil className="w-3.5 h-3.5" /></Button>
                            <Button size="icon" variant="destructive" className="w-8 h-8 rounded-full shadow-lg" onClick={() => { setDeletingId(ebook.id); setIsDeleting(true); }}><Trash2 className="w-3.5 h-3.5" /></Button>
                          </>
                        ) : (
                          <Badge className="bg-zinc-900 border-none shadow-lg">ARCHIVED</Badge>
                        )}
                      </div>
                   </div>
                   <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-2">
                        <Badge variant="outline" className="text-[8px]">{ebook.category}</Badge>
                        {ebook.is_deleted && <span className="text-[8px] font-black text-red-500 uppercase tracking-widest">Store Hidden</span>}
                      </div>
                      <h4 className="font-black text-sm text-zinc-900 line-clamp-1">{ebook.title}</h4>
                      <p className="text-[10px] text-zinc-500 mb-4">Price: ₹{ebook.price}</p>
                      <div className="flex gap-2">
                        <Button 
                          className={`flex-1 text-[9px] font-black h-8 rounded-lg ${ebook.is_deleted ? 'bg-zinc-200 text-zinc-400 cursor-not-allowed' : (ebook.is_verified ? 'bg-zinc-100 text-zinc-500' : 'bg-green-600 text-white')}`}
                          onClick={() => !ebook.is_deleted && handleVerifyEbook(ebook.id, !ebook.is_verified)}
                          disabled={ebook.is_deleted}
                        >
                          {ebook.is_deleted ? 'ARCHIVED PRODUCT' : (ebook.is_verified ? 'REVOKE VERIFICATION' : 'VERIFY PRODUCT')}
                        </Button>
                      </div>
                   </CardContent>
                </Card>
              ))}
           </div>
           <Button className="fixed bottom-8 left-8 w-16 h-16 rounded-full bg-zinc-900 shadow-2xl hover:scale-110 active:scale-95 transition-all text-white p-0 z-50" onClick={() => setIsAdding(true)}>
             <Plus className="w-8 h-8" />
           </Button>
        </div>
      )}


      {activeTab === 'banners' && (
        <div className="space-y-8 animate-in slide-in-from-right-4 duration-500">
           <Card className="border-zinc-200 shadow-xl rounded-[2.5rem] overflow-hidden">
             <CardHeader className="bg-zinc-900 text-white p-8">
               <CardTitle className="text-2xl font-black italic flex items-center gap-3">
                 <ImageIcon className="w-8 h-8 text-orange-500" />
                 HERO BANNER MANAGER
               </CardTitle>
               <CardDescription className="text-zinc-400 font-bold uppercase tracking-widest text-[10px]">Upload professional banners for the homepage slider</CardDescription>
             </CardHeader>
             <CardContent className="p-8">
               <form 
                 className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8 bg-zinc-50 p-6 rounded-[2rem] border border-zinc-100"
                 onSubmit={(e) => {
                   e.preventDefault();
                   const form = e.target as HTMLFormElement;
                   const file = (form.elements.namedItem('banner-file') as HTMLInputElement).files?.[0];
                   const title = (form.elements.namedItem('banner-title') as HTMLInputElement).value;
                   const subtitle = (form.elements.namedItem('banner-subtitle') as HTMLInputElement).value;
                   
                   if (file) {
                     handleAddBanner(file, title, subtitle);
                     form.reset();
                   } else {
                     toast.error('Please select an image');
                   }
                 }}
               >
                 <div className="md:col-span-1 space-y-1">
                    <Label className="text-[10px] font-black uppercase text-zinc-400">Banner Image</Label>
                    <div className="relative h-12">
                      <Input id="banner-file" type="file" accept="image/*" className="h-full rounded-xl opacity-0 absolute inset-0 z-10 cursor-pointer" required />
                      <div className="h-full w-full border-2 border-dashed border-zinc-200 rounded-xl flex items-center justify-center text-[10px] font-bold text-zinc-400 hover:bg-white transition-colors">
                        SELECT IMAGE
                      </div>
                    </div>
                 </div>
                 <div className="md:col-span-1 space-y-1">
                    <Label className="text-[10px] font-black uppercase text-zinc-400">Title (Bold Text)</Label>
                    <Input id="banner-title" placeholder="DOMINATE THE MARKET" className="h-12 rounded-xl" />
                 </div>
                 <div className="md:col-span-1 space-y-1">
                    <Label className="text-[10px] font-black uppercase text-zinc-400">Subtitle (Small Text)</Label>
                    <Input id="banner-subtitle" placeholder="Get 20% off on all new releases" className="h-12 rounded-xl" />
                 </div>
                 <div className="flex items-end">
                   <Button 
                    type="submit" 
                    disabled={isUploadingBanner}
                    className="w-full h-12 bg-orange-600 hover:bg-orange-700 text-white font-black rounded-xl"
                   >
                     {isUploadingBanner ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : 'ADD BANNER'}
                   </Button>
                 </div>
               </form>

               <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                 {banners.map(banner => (
                   <div key={banner.id} className="group relative aspect-video bg-zinc-100 rounded-2xl overflow-hidden border border-zinc-200 shadow-sm transition-all hover:shadow-xl">
                      <img src={banner.image_url} className="w-full h-full object-cover" />
                      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-4 md:absolute md:inset-0 md:bg-black/60 md:opacity-0 md:group-hover:opacity-100 transition-all flex flex-col items-center justify-end md:justify-center text-center">
                        <div className="mb-2 md:mb-1">
                          <h4 className="text-white font-black text-sm uppercase tracking-tighter leading-tight">{banner.title || 'No Title'}</h4>
                          <p className="text-zinc-300 text-[10px] font-bold">{banner.subtitle || 'No Subtitle'}</p>
                        </div>
                        <Button 
                          variant="destructive" 
                          size="sm" 
                          className="font-black rounded-lg h-8 text-[10px] w-full md:w-auto"
                          onClick={() => handleDeleteBanner(banner.id)}
                        >
                          <Trash2 className="w-3 h-3 mr-2" />
                          REMOVE BANNER
                        </Button>
                      </div>
                   </div>
                 ))}
                 {banners.length === 0 && (
                   <div className="col-span-full py-20 text-center bg-zinc-50 rounded-[2rem] border border-zinc-100">
                     <p className="text-zinc-400 font-bold italic tracking-widest uppercase text-xs">No active banners. Using default fallback.</p>
                   </div>
                 )}
               </div>
             </CardContent>
           </Card>
        </div>
      )}

      {activeTab === 'sellers' && (
        <div className="space-y-6">
           <div className="flex gap-2">
             <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                <Input 
                  placeholder="Search user by name, email or ID..." 
                  className="h-12 pl-12 rounded-2xl border-2 border-zinc-100 focus:border-zinc-900 font-bold"
                  value={sellerSearch}
                  onChange={(e) => setSellerSearch(e.target.value)}
                />
             </div>
             <Button 
               variant="outline" 
               className="h-12 rounded-2xl border-2 border-zinc-100 font-black px-6 gap-2"
               onClick={() => {
                 fetchData();
                 toast.success('Seller data refreshed');
               }}
             >
               <History className="w-4 h-4" />
               <span className="hidden sm:inline">REFRESH</span>
             </Button>
           </div>

           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {sellers
              .filter(s => s.role !== 'admin') // Remove admins from seller panel
              .filter(s => 
                s.display_name?.toLowerCase().includes(sellerSearch.toLowerCase()) || 
                s.email?.toLowerCase().includes(sellerSearch.toLowerCase()) ||
                s.uid?.includes(sellerSearch)
              )
              .map(seller => {
                const sellerAffiliateSales = orders.filter(o => o.referrer_id === seller.uid && o.status === 'success');
                const sellerWithdrawals = withdrawals.filter(w => w.user_id === seller.uid && (w.status === 'success' || w.status === 'pending'));
                
                const calculatedAffiliate = sellerAffiliateSales.reduce((acc, o) => acc + (o.commission_amount || o.ebook?.commission_amount || 0), 0);
                const totalWithdrawn = sellerWithdrawals.reduce((acc, w) => acc + w.amount, 0);
                const currentBalance = Math.max(0, calculatedAffiliate - totalWithdrawn);

                return (
                  <Card key={seller.uid} className="border-zinc-200 shadow-sm hover:shadow-md transition-shadow">
                    <CardHeader className="flex flex-row items-center gap-4 pb-2">
                        <img src={seller.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${seller.uid}`} className="w-12 h-12 rounded-xl" />
                        <div className="flex-1">
                          <CardTitle className="text-sm font-black">{seller.display_name}</CardTitle>
                          <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-tighter">{seller.email}</p>
                          <p className="text-[8px] text-zinc-300 font-mono mt-1">ID: ...{seller.uid.slice(-12)}</p>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="bg-zinc-900 rounded-2xl p-4 text-white text-center shadow-inner">
                          <p className="text-[8px] font-black text-zinc-400 uppercase tracking-widest mb-1">Affiliate Balance</p>
                          <p className="text-3xl font-black italic">₹{currentBalance.toFixed(2)}</p>
                        </div>

                        <div className="flex gap-2">
                          <div className="flex-1 p-3 bg-zinc-50 rounded-xl border border-zinc-100 text-center">
                              <p className="text-[9px] font-black text-zinc-400 uppercase">Withdrawn</p>
                              <p className="text-sm font-black text-zinc-900">₹{totalWithdrawn}</p>
                          </div>
                          <div className="flex-1 p-3 bg-zinc-50 rounded-xl border border-zinc-100 text-center">
                              <p className="text-[9px] font-black text-zinc-400 uppercase">Referrals</p>
                              <p className="text-sm font-black text-zinc-900">{sellerAffiliateSales.length}</p>
                          </div>
                        </div>
                        
                        <Button 
                          className="w-full bg-zinc-100 hover:bg-zinc-200 text-zinc-900 text-[10px] font-black h-10 rounded-xl gap-2"
                          onClick={() => setViewingUser(seller)}
                        >
                          <Search className="w-3 h-3" />
                          VIEW USER DOSSIER
                        </Button>
                    </CardContent>
                  </Card>
                );
              })}
          </div>
        </div>
      )}

      {/* Detailed User Dossier View */}
      <Dialog open={!!viewingUser} onOpenChange={() => setViewingUser(null)}>
        <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto rounded-3xl p-0 border-none shadow-2xl">
          <DialogHeader className="sr-only">
            <DialogTitle>User Dossier - {viewingUser?.display_name}</DialogTitle>
            <DialogDescription>Detailed purchase and referral history for this user.</DialogDescription>
          </DialogHeader>
          {viewingUser && (() => {
            const userOrders = orders.filter(o => o.user_id === viewingUser.uid && o.status === 'success');
            const userReferrals = orders.filter(o => o.referrer_id === viewingUser.uid && o.status === 'success');
            const userWiths = withdrawals.filter(w => w.user_id === viewingUser.uid);
            
            const earned = userReferrals.reduce((acc, o) => acc + (o.commission_amount || o.ebook?.commission_amount || 0), 0);
            const paid = userWiths.filter(w => w.status === 'success').reduce((acc, w) => acc + w.amount, 0);
            const bal = Math.max(0, earned - userWiths.reduce((acc, w) => acc + w.amount, 0));

            return (
              <div className="space-y-0">
                <div className="bg-zinc-900 p-8 text-white">
                  <div className="flex items-center gap-6">
                    <img 
                      src={viewingUser.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${viewingUser.uid}`} 
                      className="w-20 h-20 rounded-2xl border-2 border-zinc-800"
                    />
                    <div>
                      <h2 className="text-3xl font-black">{viewingUser.display_name}</h2>
                      <p className="text-zinc-400 font-bold">{viewingUser.email}</p>
                      <Badge className="bg-zinc-800 mt-2 font-mono text-[9px] uppercase">ID: {viewingUser.uid}</Badge>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-3 gap-4 mt-8">
                    <div className="bg-zinc-800/50 p-4 rounded-2xl border border-zinc-700">
                      <p className="text-[8px] font-black text-zinc-500 uppercase tracking-widest mb-1">Total Earnings</p>
                      <p className="text-xl font-black">₹{earned}</p>
                    </div>
                    <div className="bg-zinc-800/50 p-4 rounded-2xl border border-zinc-700">
                      <p className="text-[8px] font-black text-zinc-500 uppercase tracking-widest mb-1">Total Withdrawn</p>
                      <p className="text-xl font-black">₹{paid}</p>
                    </div>
                    <div className="bg-zinc-900 border-2 border-green-500/30 p-4 rounded-2xl">
                      <p className="text-[8px] font-black text-green-500 uppercase tracking-widest mb-1">Current Balance</p>
                      <p className="text-xl font-black text-green-400">₹{bal.toFixed(2)}</p>
                    </div>
                  </div>
                </div>

                <div className="p-8 space-y-8 bg-white">
                  {/* Purchase History */}
                  <section>
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-sm font-black uppercase tracking-widest text-zinc-900 flex items-center gap-2">
                        <Package className="w-4 h-4" /> Personal Purchase Inventory ({userOrders.length})
                      </h3>
                    </div>
                    <div className="space-y-2">
                      {userOrders.length > 0 ? userOrders.map(order => (
                        <div key={order.id} className="p-4 bg-zinc-50 rounded-2xl border border-zinc-100 flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            {order.ebook?.cover_url && <img src={order.ebook.cover_url} className="w-8 h-10 rounded shadow-sm" />}
                            <div>
                              <p className="text-xs font-black text-zinc-900">{order.ebook?.title}</p>
                              <p className="text-[9px] font-bold text-zinc-400 uppercase">{new Date(order.created_at).toLocaleDateString()} • {order.transaction_id || 'Direct'}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-xs font-black text-zinc-900">₹{order.amount}</p>
                            <Badge className="bg-zinc-200 text-zinc-600 text-[8px] h-4">VERIFIED</Badge>
                          </div>
                        </div>
                      )) : (
                        <div className="py-8 text-center bg-zinc-50 rounded-2xl border-2 border-dashed border-zinc-100 text-zinc-400 text-xs font-bold italic">
                          No product purchases recorded.
                        </div>
                      )}
                    </div>
                  </section>

                  {/* Referral History */}
                  <section>
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-sm font-black uppercase tracking-widest text-zinc-900 flex items-center gap-2">
                        <Users className="w-4 h-4" /> Affiliate Network Leads ({userReferrals.length})
                      </h3>
                    </div>
                    <div className="overflow-x-auto rounded-2xl border border-zinc-100">
                      <table className="w-full text-left">
                        <thead className="bg-zinc-50">
                          <tr>
                            <th className="px-4 py-3 text-[10px] font-black uppercase text-zinc-400">Buyer Name</th>
                            <th className="px-4 py-3 text-[10px] font-black uppercase text-zinc-400">Transaction ID</th>
                            <th className="px-4 py-3 text-[10px] font-black uppercase text-zinc-400">Product</th>
                            <th className="px-4 py-3 text-[10px] font-black uppercase text-zinc-400 text-right">Reward</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-100">
                          {userReferrals.length > 0 ? userReferrals.map(ref => (
                            <tr key={ref.id} className="hover:bg-zinc-50 transition-colors">
                              <td className="px-4 py-3">
                                <div>
                                  <p className="text-xs font-black text-zinc-900">{ref.buyer?.display_name || 'Quick Buyer'}</p>
                                  <p className="text-[8px] font-mono text-zinc-400">UID: {ref.user_id?.slice(-8)}</p>
                                </div>
                              </td>
                              <td className="px-4 py-3">
                                <p className="text-[9px] font-black text-zinc-500 font-mono">{ref.transaction_id || 'SYSTEM'}</p>
                              </td>
                              <td className="px-4 py-3">
                                <p className="text-[9px] font-bold text-zinc-600 line-clamp-1">{ref.ebook?.title}</p>
                              </td>
                              <td className="px-4 py-3 text-right">
                                <p className="text-xs font-black text-green-600">+₹{ref.commission_amount || ref.ebook?.commission_amount || 0}</p>
                              </td>
                            </tr>
                          )) : (
                            <tr>
                              <td colSpan={4} className="px-4 py-12 text-center text-zinc-400 text-xs font-bold italic">
                                No affiliate sales generated yet.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </section>
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      <Dialog open={isAdding} onOpenChange={setIsAdding}>
        <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto rounded-3xl">
          <DialogHeader><DialogTitle className="text-2xl font-black">Create Product</DialogTitle></DialogHeader>
          <form onSubmit={handleAddEbook} className="space-y-4 pt-4">
             <div className="space-y-1">
                <Label className="text-[10px] font-black uppercase text-zinc-400">Title</Label>
                <Input value={newEbook.title} onChange={e => setNewEbook({...newEbook, title: e.target.value})} required className="h-12 rounded-xl" />
             </div>
             <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label className="text-[10px] font-black uppercase text-zinc-400">Price</Label>
                  <Input type="number" value={newEbook.price} onChange={e => setNewEbook({...newEbook, price: Number(e.target.value)})} required className="h-12 rounded-xl" />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] font-black uppercase text-zinc-400">Commission</Label>
                  <Input type="number" value={newEbook.commission_amount} onChange={e => setNewEbook({...newEbook, commission_amount: Number(e.target.value)})} required className="h-12 rounded-xl" />
                </div>
             </div>
             <div className="space-y-1">
                <Label className="text-[10px] font-black uppercase text-zinc-400">Author</Label>
                <Input value={newEbook.author} onChange={e => setNewEbook({...newEbook, author: e.target.value})} required className="h-12 rounded-xl" />
             </div>
             <div className="space-y-1">
                <Label className="text-[10px] font-black uppercase text-zinc-400">Description</Label>
                <Textarea value={newEbook.description} onChange={e => setNewEbook({...newEbook, description: e.target.value})} required className="rounded-xl h-24" />
             </div>
             <div className="space-y-4">
                <div className="p-4 border-2 border-dashed border-zinc-200 rounded-2xl text-center">
                   <Label className="text-[10px] font-black mb-2 block uppercase text-zinc-400">Cover & Asset Selection</Label>
                   <div className="flex gap-2 justify-center">
                      <Button type="button" variant="outline" className="h-10 rounded-xl relative overflow-hidden">
                        Cover Image
                        <input type="file" className="absolute inset-0 opacity-0 cursor-pointer" accept="image/*" onChange={(e) => e.target.files && handleFileUpload(e.target.files[0], 'cover')} />
                      </Button>
                      <Button type="button" variant="outline" className="h-10 rounded-xl relative overflow-hidden">
                        PDF File
                        <input type="file" className="absolute inset-0 opacity-0 cursor-pointer" accept="application/pdf" onChange={(e) => e.target.files && handleFileUpload(e.target.files[0], 'ebook')} />
                      </Button>
                   </div>
                   {(newEbook.cover_url || newEbook.file_url) && <p className="text-[10px] font-bold text-green-600 mt-2">Files Selected ✓</p>}
                </div>


             </div>
             <Button type="submit" className="w-full bg-zinc-900 text-white hover:bg-black font-black h-12 rounded-2xl" disabled={isUploading}>
                {isUploading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : 'PUBLISH NOW'}
             </Button>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isEditing} onOpenChange={setIsEditing}>
        <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto rounded-3xl">
          <DialogHeader><DialogTitle className="text-xl font-black">Edit Asset Configuration</DialogTitle></DialogHeader>
          <form onSubmit={handleEditEbook} className="space-y-4 pt-4">
             <div className="space-y-1">
                <Label className="text-[10px] font-black uppercase text-zinc-400">Asset Title</Label>
                <Input value={editFormData.title} onChange={e => setEditFormData({...editFormData, title: e.target.value})} className="h-12 rounded-xl" />
             </div>
             <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label className="text-[10px] font-black uppercase text-zinc-400">Price (INR)</Label>
                  <Input type="number" value={editFormData.price} onChange={e => setEditFormData({...editFormData, price: Number(e.target.value)})} className="h-12 rounded-xl" />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] font-black uppercase text-zinc-400">Reward (INR)</Label>
                  <Input type="number" value={editFormData.commission_amount} onChange={e => setEditFormData({...editFormData, commission_amount: Number(e.target.value)})} className="h-12 rounded-xl" />
                </div>
             </div>
             

             <Button type="submit" className="w-full bg-orange-600 text-white hover:bg-orange-700 font-black h-12 rounded-2xl">SYCHRONIZE CHANGES</Button>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isDeleting} onOpenChange={setIsDeleting}>
        <DialogContent className="sm:max-w-[400px] rounded-3xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-black">Soft Product Deletion</DialogTitle>
            <DialogDescription className="font-bold text-zinc-600 py-3">This moves the asset to an optimized archive. New sales cease, analytics persist.</DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-3"><Button variant="ghost" className="font-black" onClick={() => setIsDeleting(false)}>ABORT</Button><Button variant="destructive" className="bg-red-600 font-black rounded-xl px-6" onClick={handleSoftDeleteEbook}>CONFIRM REMOVAL</Button></div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
