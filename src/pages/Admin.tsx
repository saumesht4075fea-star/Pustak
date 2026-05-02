import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { motion } from 'motion/react';
import { 
  Plus, Pencil, Trash2, Package, Users, IndianRupee, BookOpen, Upload, X, 
  Loader2, Image as ImageIcon, ExternalLink, BadgeCheck, Share2, 
  Search, Filter, Download, ChartBar, CreditCard, LayoutDashboard,
  CheckCircle2, AlertCircle, History
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

type AdminTab = 'overview' | 'utr' | 'reports' | 'payouts' | 'products' | 'sellers' | 'banners';

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
    seller_id: '',
    images: []
  });

  const [editFormData, setEditFormData] = useState<Partial<Ebook>>({
    images: []
  });

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
    const matchesName = nameSearch === '' || o.profiles?.display_name?.toLowerCase().includes(nameSearch.toLowerCase());
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
      .select('*')
      .order('created_at', { ascending: false });
    if (ebooksData) setEbooks(ebooksData as Ebook[]);

    const { data: ordersData } = await supabase
      .from('orders')
      .select('*, ebook:ebooks(*), profiles(*)')
      .order('created_at', { ascending: false });
    if (ordersData) setOrders(ordersData as any[]);

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
    const sub = supabase.channel('admin_all').on('postgres_changes', { event: '*', schema: 'public' }, fetchData).subscribe();
    return () => { supabase.removeChannel(sub); };
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
          images: newEbook.images || [],
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
        cover_url: '', images: [], file_url: '', category: 'Fiction', cosmofeed_url: '', seller_id: ''
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

  const handleAddBanner = async (file: File) => {
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

      const { error: dbError } = await supabase.from('home_banners').insert({
        image_url: publicUrl,
        created_at: new Date().toISOString()
      });

      if (dbError) throw dbError;
      
      toast.success('Banner added successfully!', { id: toastId });
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
      toast.success('Ebook removed from store (Sales report preserved)');
      setIsDeleting(false);
    } catch (error: any) {
       toast.error(error.message);
    }
  };

  const handleImageUpload = async (file: File, isEdit: boolean = false) => {
    setIsUploading(true);
    const toastId = toast.loading('Uploading additional image...');
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random()}.${fileExt}`;
      const filePath = `product_images/${fileName}`;

      const { data, error: storageError } = await supabase.storage
        .from('ebooks')
        .upload(filePath, file);

      if (!storageError && data) {
        const { data: { publicUrl } } = supabase.storage.from('ebooks').getPublicUrl(filePath);
        if (isEdit) {
          setEditFormData(prev => ({ ...prev, images: [...(prev.images || []), publicUrl] }));
        } else {
          setNewEbook(prev => ({ ...prev, images: [...(prev.images || []), publicUrl] }));
        }
        toast.success('Image added to gallery!', { id: toastId });
      } else {
        const reader = new FileReader();
        reader.onload = async (e) => {
          const base64 = e.target?.result as string;
          if (isEdit) {
            setEditFormData(prev => ({ ...prev, images: [...(prev.images || []), base64] }));
          } else {
            setNewEbook(prev => ({ ...prev, images: [...(prev.images || []), base64] }));
          }
          toast.success('Image saved to database!', { id: toastId });
        };
        reader.readAsDataURL(file);
      }
    } catch (error) {
      toast.error('Failed to upload image', { id: toastId });
    } finally {
      setIsUploading(false);
    }
  };

  const removeImage = (index: number, isEdit: boolean = false) => {
    if (isEdit) {
      setEditFormData(prev => ({ ...prev, images: (prev.images || []).filter((_, i) => i !== index) }));
    } else {
      setNewEbook(prev => ({ ...prev, images: (prev.images || []).filter((_, i) => i !== index) }));
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
            <Card className="border-zinc-200 shadow-sm bg-gradient-to-br from-white to-zinc-50">
              <CardHeader className="pb-2">
                <CardDescription className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Total Revenue</CardDescription>
                <CardTitle className="text-3xl font-black text-zinc-900">₹{totalRevenue}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-1 text-[10px] font-bold text-zinc-600">
                  Total Gross Sales
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
                          <p className="text-[10px] font-bold text-orange-600 uppercase">₹{order.amount} • {order.profiles?.display_name}</p>
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
                                         <p className="text-sm font-bold text-zinc-700">{order.profiles?.display_name}</p>
                                         <p className="text-[10px] font-medium text-zinc-500 italic">{order.ebook?.title}</p>
                                         <p className="text-xs font-black text-orange-600 mt-2 bg-orange-100/50 w-fit px-2 rounded">UTR: {order.transaction_id}</p>
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
                                       <td className="px-6 py-4 font-black text-zinc-900 italic uppercase">{o.profiles?.display_name || 'Guest'}</td>
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
              {ebooks.filter(e => !e.is_deleted).map(ebook => (
                <Card key={ebook.id} className="border-zinc-200 overflow-hidden group">
                   <div className="relative aspect-[3/4]">
                      {ebook.cover_url && <img src={ebook.cover_url} className="w-full h-full object-cover" />}
                      <div className="absolute top-2 right-2 flex gap-1">
                        <Button size="icon" variant="secondary" className="w-8 h-8 rounded-full" onClick={() => startEdit(ebook)}><Pencil className="w-3.5 h-3.5" /></Button>
                        <Button size="icon" variant="destructive" className="w-8 h-8 rounded-full" onClick={() => { setDeletingId(ebook.id); setIsDeleting(true); }}><Trash2 className="w-3.5 h-3.5" /></Button>
                      </div>
                   </div>
                   <CardContent className="p-4">
                      <Badge variant="outline" className="text-[8px] mb-2">{ebook.category}</Badge>
                      <h4 className="font-black text-sm text-zinc-900 line-clamp-1">{ebook.title}</h4>
                      <p className="text-[10px] text-zinc-500 mb-4">Price: ₹{ebook.price}</p>
                      <div className="flex gap-2">
                        <Button 
                          className={`flex-1 text-[9px] font-black h-8 rounded-lg ${ebook.is_verified ? 'bg-zinc-100 text-zinc-500' : 'bg-green-600 text-white'}`}
                          onClick={() => handleVerifyEbook(ebook.id, !ebook.is_verified)}
                        >
                          {ebook.is_verified ? 'REVOKE VERIFICATION' : 'VERIFY PRODUCT'}
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
               <div className="bg-zinc-50 p-8 rounded-[2rem] border-2 border-dashed border-zinc-200 text-center space-y-4 mb-8">
                  <div className="w-16 h-16 bg-white rounded-2xl shadow-sm flex items-center justify-center mx-auto">
                    <Upload className="w-8 h-8 text-zinc-400" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-lg font-black text-zinc-900">Upload New Banner</h3>
                    <p className="text-xs font-bold text-zinc-500">Recommended size: 1920x800px or similar ratio</p>
                  </div>
                  <Button 
                    variant="default" 
                    className="bg-orange-600 hover:bg-orange-700 text-white font-black rounded-xl h-12 px-8 relative overflow-hidden"
                    disabled={isUploadingBanner}
                  >
                    {isUploadingBanner ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : 'SELECT BANNER IMAGE'}
                    <input 
                      type="file" 
                      className="absolute inset-0 opacity-0 cursor-pointer" 
                      accept="image/*" 
                      onChange={(e) => e.target.files && handleAddBanner(e.target.files[0])}
                    />
                  </Button>
               </div>

               <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                 {banners.map(banner => (
                   <div key={banner.id} className="group relative aspect-video bg-zinc-100 rounded-2xl overflow-hidden border border-zinc-200 shadow-sm transition-all hover:shadow-xl">
                      <img src={banner.image_url} className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <Button 
                          variant="destructive" 
                          size="sm" 
                          className="font-black rounded-lg"
                          onClick={() => handleDeleteBanner(banner.id)}
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
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
                const currentBalance = calculatedAffiliate - totalWithdrawn;

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
            const bal = earned - userWiths.reduce((acc, w) => acc + w.amount, 0);

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
                                  <p className="text-xs font-black text-zinc-900">{ref.profiles?.display_name || 'Quick Buyer'}</p>
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

                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase text-zinc-400">Gallery Images (Slider)</Label>
                  <div className="grid grid-cols-4 gap-2">
                    {(newEbook.images || []).map((img, idx) => (
                      <div key={idx} className="relative aspect-square rounded-lg overflow-hidden border border-zinc-100 group">
                        <img src={img} className="w-full h-full object-cover" />
                        <button 
                          type="button" 
                          onClick={() => removeImage(idx)}
                          className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                    <label className="aspect-square rounded-lg border-2 border-dashed border-zinc-200 flex items-center justify-center cursor-pointer hover:bg-zinc-50 transition-colors">
                      <Plus className="w-4 h-4 text-zinc-400" />
                      <input type="file" className="hidden" accept="image/*" onChange={(e) => e.target.files && handleImageUpload(e.target.files[0])} />
                    </label>
                  </div>
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
             
             <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase text-zinc-400">Gallery Images (Slider)</Label>
                <div className="grid grid-cols-4 gap-2">
                  {(editFormData.images || []).map((img, idx) => (
                    <div key={idx} className="relative aspect-square rounded-lg overflow-hidden border border-zinc-100 group">
                      <img src={img} className="w-full h-full object-cover" />
                      <button 
                        type="button" 
                        onClick={() => removeImage(idx, true)}
                        className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                  <label className="aspect-square rounded-lg border-2 border-dashed border-zinc-200 flex items-center justify-center cursor-pointer hover:bg-zinc-50 transition-colors">
                    <Plus className="w-4 h-4 text-zinc-400" />
                    <input type="file" className="hidden" accept="image/*" onChange={(e) => e.target.files && handleImageUpload(e.target.files[0], true)} />
                  </label>
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
