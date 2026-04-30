import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { motion } from 'motion/react';
import { Plus, Pencil, Trash2, Package, Users, IndianRupee, BookOpen, Upload, X, Loader2, Image as ImageIcon, ExternalLink, BadgeCheck, Share2 } from 'lucide-react';
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

export default function Admin() {
  const [ebooks, setEbooks] = useState<Ebook[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [sellers, setSellers] = useState<Profile[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [editingEbook, setEditingEbook] = useState<Ebook | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  
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

  const handleFileUpload = async (file: File, type: 'cover' | 'ebook', isEdit: boolean = false) => {
    setIsUploading(true);
    const toastId = toast.loading(`Uploading ${type === 'cover' ? 'cover' : 'ebook'}...`);
    
    try {
      // 1. Try to upload to Supabase Storage if possible
      // Note: This assumes a bucket named 'ebooks' exists. 
      // If it fails, we fall back to base64 to ensure it works even without bucket setup.
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random()}.${fileExt}`;
      const filePath = `${type}s/${fileName}`;

      const { data, error: storageError } = await supabase.storage
        .from('ebooks')
        .upload(filePath, file);

      if (!storageError && data) {
        const { data: { publicUrl } } = supabase.storage.from('ebooks').getPublicUrl(filePath);
        if (isEdit) {
          setEditFormData(prev => ({ ...prev, [type === 'cover' ? 'cover_url' : 'file_url']: publicUrl }));
        } else {
          setNewEbook(prev => ({ ...prev, [type === 'cover' ? 'cover_url' : 'file_url']: publicUrl }));
        }
        toast.success(`${type === 'cover' ? 'Image' : 'PDF'} uploaded to storage!`, { id: toastId });
      } else {
        // 2. Fallback to base64 if storage is not set up
        console.warn('Storage upload failed, falling back to database storage:', storageError);
        const reader = new FileReader();
        reader.onload = async (e) => {
          const base64 = e.target?.result as string;
          if (isEdit) {
            setEditFormData(prev => ({ ...prev, [type === 'cover' ? 'cover_url' : 'file_url']: base64 }));
          } else {
            setNewEbook(prev => ({ ...prev, [type === 'cover' ? 'cover_url' : 'file_url']: base64 }));
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

  const [withdrawals, setWithdrawals] = useState<any[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      // Ebooks Subscription
      const { data: ebooksData } = await supabase
        .from('ebooks')
        .select('*')
        .order('created_at', { ascending: false });
      if (ebooksData) setEbooks(ebooksData as Ebook[]);

      // Orders Subscription
      const { data: ordersData } = await supabase
        .from('orders')
        .select('*, ebook:ebooks(*)')
        .order('created_at', { ascending: false });
      if (ordersData) setOrders(ordersData as Order[]);

      // Sellers Subscription
      const { data: sellersData } = await supabase
        .from('profiles')
        .select('*')
        .in('role', ['seller', 'admin'])
        .order('created_at', { ascending: false });
      if (sellersData) setSellers(sellersData as Profile[]);

      // Withdrawals
      const { data: withdrawData } = await supabase
        .from('withdrawals')
        .select('*, profiles(display_name, email)')
        .order('created_at', { ascending: false });
      if (withdrawData) setWithdrawals(withdrawData);
    };

    fetchData();

    // Set up real-time subscriptions
    const ebooksChannel = supabase.channel('admin_ebooks').on('postgres_changes', { event: '*', schema: 'public', table: 'ebooks' }, fetchData).subscribe();
    const ordersChannel = supabase.channel('admin_orders').on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, fetchData).subscribe();
    const profilesChannel = supabase.channel('admin_profiles').on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, fetchData).subscribe();
    const withdrawalsChannel = supabase.channel('admin_withdrawals').on('postgres_changes', { event: '*', schema: 'public', table: 'withdrawals' }, fetchData).subscribe();

    return () => {
      supabase.removeChannel(ebooksChannel);
      supabase.removeChannel(ordersChannel);
      supabase.removeChannel(profilesChannel);
      supabase.removeChannel(withdrawalsChannel);
    };
  }, []);

  const handleApproveWithdrawal = async (withdraw: any) => {
    try {
      const { error } = await supabase
        .from('withdrawals')
        .update({ status: 'success' })
        .eq('id', withdraw.id);
      
      if (error) throw error;
      toast.success('Withdrawal marked as success!');
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleAddEbook = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Ensure profile exists to avoid FK error
      const { data: profile } = await supabase
        .from('profiles')
        .select('uid')
        .eq('uid', user.id)
        .single();
      
      if (!profile) {
        // Create basic profile if missing
        const adminEmails = ['saumesht4075fea@gmail.com', 'mohittttt868@gmail.com'];
        const role = adminEmails.includes(user.email || '') ? 'admin' : 'customer';
        await supabase.from('profiles').upsert({
          uid: user.id,
          email: user.email,
          display_name: user.user_metadata?.display_name || user.email?.split('@')[0],
          role: role,
          created_at: new Date().toISOString()
        });
      }

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
          cosmofeed_url: newEbook.cosmofeed_url,
          seller_id: targetSellerId,
          created_at: new Date().toISOString()
        });
      
      if (error) throw error;
      
      toast.success('Ebook added successfully');
      setIsAdding(false);
      setNewEbook({
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
    } catch (error: any) {
      toast.error(`Database Error: ${error.message || 'Failed to add ebook'}`);
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
      
      const { error } = await supabase
        .from('ebooks')
        .update(updateData)
        .eq('id', editingEbook.id);
      
      if (error) throw error;
      
      toast.success('Ebook updated successfully');
      setIsEditing(false);
      setEditingEbook(null);
    } catch (error: any) {
      toast.error(`Error: ${error.message || 'Failed to update ebook'}`);
    }
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const onDrop = (e: React.DragEvent, type: 'cover' | 'ebook', isEdit: boolean = false) => {
    e.preventDefault();
    e.stopPropagation();
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      handleFileUpload(files[0], type, isEdit);
    }
  };

  const handleApproveOrder = async (order: Order) => {
    try {
      // 1. Update order status
      const { error: orderError } = await supabase
        .from('orders')
        .update({ status: 'success' })
        .eq('id', order.id);
      
      if (orderError) throw orderError;

      // 2. Award referral commission if applicable
      if (order.referrer_id) {
        const { data: refProfile, error: refError } = await supabase
          .from('profiles')
          .select('uid, affiliate_earnings')
          .eq('uid', order.referrer_id)
          .single();
        
        if (refProfile) {
          const commission = order.commission_amount || order.ebook?.commission_amount || 0;
          if (commission > 0) {
            const { error: earnError } = await supabase
              .from('profiles')
              .update({
                affiliate_earnings: (refProfile.affiliate_earnings || 0) + commission
              })
              .eq('uid', order.referrer_id);
            
            if (earnError) {
              console.error('Failed to award commission:', earnError);
              toast.error('Order approved, but failed to award referral commission');
            } else {
              toast.success(`Commission of ₹${commission} awarded to referrer!`);
            }
          }
        } else if (refError) {
          console.warn('Referrer profile not found during approval:', refError);
        }
      }

      // 3. Award earnings to the Ebook Seller (Owner)
      const sellerId = order.ebook?.seller_id;
      if (sellerId) {
        const { data: sellerProfile } = await supabase
          .from('profiles')
          .select('uid, earnings')
          .eq('uid', sellerId)
          .single();
        
        if (sellerProfile) {
          // Amount for seller = Total Price - Commission - Admin Fee (₹60)
          const commission = order.commission_amount || order.ebook?.commission_amount || 0;
          const adminFee = 60;
          const sellerNet = order.amount - commission - adminFee;
          
          if (sellerNet > 0) {
            await supabase
              .from('profiles')
              .update({
                earnings: (sellerProfile.earnings || 0) + sellerNet
              })
              .eq('uid', sellerId);
            
            toast.success(`₹${sellerNet} awarded to ebook owner!`);
          }
        }
      }

      toast.success('Order approved successfully');
    } catch (error: any) {
      toast.error(`Approval Error: ${error.message || 'Failed to approve order'}`);
    }
  };

  const handleRejectOrder = async (orderId: string) => {
    try {
      const { error } = await supabase
        .from('orders')
        .update({ status: 'failed' })
        .eq('id', orderId);
      
      if (error) throw error;
      
      toast.success('Order rejected');
    } catch (error: any) {
      toast.error(`Reject Error: ${error.message || 'Failed to reject order'}`);
    }
  };

  const handleDeleteEbook = async () => {
    if (!deletingId) return;
    
    try {
      const { error } = await supabase
        .from('ebooks')
        .delete()
        .eq('id', deletingId);
      
      if (error) throw error;
      
      toast.success('Ebook deleted successfully');
      setIsDeleting(false);
      setDeletingId(null);
    } catch (error: any) {
      toast.error(`Delete Error: ${error.message || 'Failed to delete ebook'}`);
    }
  };

  const confirmDelete = (id: string) => {
    setDeletingId(id);
    setIsDeleting(true);
  };

  const stats = [
    { title: 'Total Revenue', value: `₹${orders.reduce((acc, o) => acc + o.amount, 0)}`, icon: IndianRupee, color: 'text-green-600' },
    { title: 'Total Orders', value: orders.length, icon: Package, color: 'text-blue-600' },
    { title: 'Total Ebooks', value: ebooks.length, icon: BookOpen, color: 'text-orange-600' },
    { title: 'Active Users', value: new Set(orders.map(o => o.user_id)).size, icon: Users, color: 'text-purple-600' },
  ];

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tighter">Admin Dashboard</h1>
          <p className="text-zinc-500 text-sm">Manage your store, ebooks, and track sales using Supabase.</p>
        </div>
        <div className="flex gap-2">
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline" className="gap-2">
                <Upload className="w-4 h-4" />
                How to Upload?
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Guide: Uploading Ebooks</DialogTitle>
                <DialogDescription>
                  Follow these steps to add a new ebook to your store.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 text-sm text-zinc-600">
                <p>1. <strong>Select Files</strong>: You can now directly select PDF/EPUB files and cover images from your computer.</p>
                <p>2. <strong>Instant Preview</strong>: The cover image will preview instantly after you drop it or select it.</p>
                <p>3. <strong>Automatic Saving</strong>: When you click Create/Update, the files are securely saved to the database.</p>
                <p>4. <strong>UPI Checkout</strong>: Customers will pay via the QR code or UPI link you provided in the checkout settings.</p>
              </div>
            </DialogContent>
          </Dialog>
          <Dialog open={isAdding} onOpenChange={setIsAdding}>
            <DialogTrigger asChild>
              <Button className="bg-orange-600 hover:bg-orange-700 gap-2">
                <Plus className="w-4 h-4" />
                Add New Ebook
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Add New Ebook</DialogTitle>
                <DialogDescription>
                  Enter the details of the new ebook you want to add.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleAddEbook} className="space-y-4 py-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="title">Title</Label>
                    <Input id="title" required value={newEbook.title} onChange={e => setNewEbook({...newEbook, title: e.target.value})} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="author">Author</Label>
                    <Input id="author" required value={newEbook.author} onChange={e => setNewEbook({...newEbook, author: e.target.value})} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea id="description" required value={newEbook.description} onChange={e => setNewEbook({...newEbook, description: e.target.value})} />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="price">Price (INR)</Label>
                    <Input id="price" type="number" required value={newEbook.price} onChange={e => setNewEbook({...newEbook, price: Number(e.target.value)})} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="commission">Referral Commission (INR)</Label>
                    <Input id="commission" type="number" required value={newEbook.commission_amount} onChange={e => setNewEbook({...newEbook, commission_amount: Number(e.target.value)})} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="seller_id">Assign to Seller (Optional)</Label>
                  <Select 
                    value={newEbook.seller_id} 
                    onValueChange={val => setNewEbook({...newEbook, seller_id: val})}
                  >
                    <SelectTrigger id="seller_id" className="h-10 rounded-md border-zinc-200">
                      <SelectValue placeholder="Platform Admin (Default)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Platform Admin</SelectItem>
                      {sellers.map(s => (
                        <SelectItem key={s.uid} value={s.uid}>{s.display_name} ({s.email})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="category">Category</Label>
                  <select 
                    id="category"
                    className="flex h-10 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm ring-offset-white file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-zinc-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    value={newEbook.category} 
                    onChange={e => setNewEbook({...newEbook, category: e.target.value})}
                  >
                      <option value="Fiction">Fiction</option>
                      <option value="Non-Fiction">Non-Fiction</option>
                      <option value="Self-Help">Self-Help</option>
                      <option value="Business">Business</option>
                      <option value="Technology">Technology</option>
                      <option value="Finance">Finance</option>
                    </select>
                  </div>
                <div className="space-y-2">
                  <Label>Cover Image</Label>
                  <div className="flex gap-4 items-center">
                    <div className="relative w-24 h-32 bg-zinc-100 rounded-lg border-2 border-dashed border-zinc-200 flex items-center justify-center overflow-hidden shrink-0">
                      {newEbook.cover_url ? (
                        <img src={newEbook.cover_url || undefined} alt="Preview" className="w-full h-full object-cover" />
                      ) : (
                        <ImageIcon className="w-8 h-8 text-zinc-300" />
                      )}
                    </div>
                    <div className="flex-1">
                      <label 
                        onDragOver={onDragOver}
                        onDrop={(e) => onDrop(e, 'cover')}
                        className="flex flex-col items-center justify-center w-full h-32 border-2 border-zinc-200 border-dashed rounded-lg cursor-pointer bg-zinc-50 hover:bg-zinc-100 transition-colors"
                      >
                        <div className="flex flex-col items-center justify-center pt-5 pb-6">
                          <Upload className="w-6 h-6 text-zinc-400 mb-2" />
                          <p className="text-xs text-zinc-500 font-medium">Click or drag to upload cover</p>
                        </div>
                        <input 
                          type="file" 
                          className="hidden" 
                          accept="image/*"
                          onChange={(e) => e.target.files && handleFileUpload(e.target.files[0], 'cover')}
                        />
                      </label>
                    </div>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="file_url">Ebook File (PDF)</Label>
                  <div className="relative">
                    <label 
                      onDragOver={onDragOver}
                      onDrop={(e) => onDrop(e, 'ebook')}
                      className="flex items-center justify-center w-full h-20 border-2 border-zinc-200 border-dashed rounded-lg cursor-pointer bg-zinc-50 hover:bg-zinc-100 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <BookOpen className="w-5 h-5 text-zinc-400" />
                        <span className="text-sm text-zinc-500 font-medium">
                          {newEbook.file_url ? 'PDF Uploaded ✓' : 'Select or drag PDF file'}
                        </span>
                      </div>
                      <input 
                        type="file" 
                        className="hidden" 
                        accept="application/pdf"
                        onChange={(e) => e.target.files && handleFileUpload(e.target.files[0], 'ebook')}
                      />
                    </label>
                  </div>
                </div>
                <Button type="submit" disabled={isUploading} className="w-full bg-orange-600 hover:bg-orange-700">
                  {isUploading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  Create Ebook
                </Button>
              </form>
            </DialogContent>
          </Dialog>
          <Dialog open={isEditing} onOpenChange={setIsEditing}>
            <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Edit Ebook</DialogTitle>
                <DialogDescription>
                  Modify the details of the ebook.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleEditEbook} className="space-y-4 py-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="edit-title">Title</Label>
                    <Input id="edit-title" required value={editFormData.title} onChange={e => setEditFormData({...editFormData, title: e.target.value})} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-author">Author</Label>
                    <Input id="edit-author" required value={editFormData.author} onChange={e => setEditFormData({...editFormData, author: e.target.value})} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-description">Description</Label>
                  <Textarea id="edit-description" required value={editFormData.description} onChange={e => setEditFormData({...editFormData, description: e.target.value})} />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="edit-price">Price (INR)</Label>
                    <Input id="edit-price" type="number" required value={editFormData.price} onChange={e => setEditFormData({...editFormData, price: Number(e.target.value)})} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-commission">Referral Commission (INR)</Label>
                    <Input id="edit-commission" type="number" required value={editFormData.commission_amount} onChange={e => setEditFormData({...editFormData, commission_amount: Number(e.target.value)})} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit_seller_id">Assign to Seller</Label>
                  <Select 
                    value={editFormData.seller_id} 
                    onValueChange={val => setEditFormData({...editFormData, seller_id: val})}
                  >
                    <SelectTrigger id="edit_seller_id" className="h-10 rounded-md border-zinc-200">
                      <SelectValue placeholder="Platform Admin" />
                    </SelectTrigger>
                    <SelectContent>
                      {sellers.map(s => (
                        <SelectItem key={s.uid} value={s.uid}>{s.display_name} ({s.email})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-category">Category</Label>
                  <select 
                    id="edit-category"
                    className="flex h-10 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm ring-offset-white file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-zinc-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    value={editFormData.category} 
                    onChange={e => setEditFormData({...editFormData, category: e.target.value})}
                  >
                    <option value="Fiction">Fiction</option>
                    <option value="Non-Fiction">Non-Fiction</option>
                    <option value="Self-Help">Self-Help</option>
                    <option value="Business">Business</option>
                    <option value="Technology">Technology</option>
                    <option value="Finance">Finance</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>Cover Image</Label>
                  <div className="flex gap-4 items-center">
                    <div className="relative w-24 h-32 bg-zinc-100 rounded-lg border-2 border-dashed border-zinc-200 flex items-center justify-center overflow-hidden shrink-0">
                      {editFormData.cover_url ? (
                        <img src={editFormData.cover_url || undefined} alt="Preview" className="w-full h-full object-cover" />
                      ) : (
                        <ImageIcon className="w-8 h-8 text-zinc-300" />
                      )}
                    </div>
                    <div className="flex-1">
                      <label 
                        onDragOver={onDragOver}
                        onDrop={(e) => onDrop(e, 'cover', true)}
                        className="flex flex-col items-center justify-center w-full h-32 border-2 border-zinc-200 border-dashed rounded-lg cursor-pointer bg-zinc-50 hover:bg-zinc-100 transition-colors"
                      >
                        <div className="flex flex-col items-center justify-center pt-5 pb-6">
                           <Upload className="w-6 h-6 text-zinc-400 mb-2" />
                           <p className="text-xs text-zinc-500 font-medium">Click or drag to update cover</p>
                        </div>
                        <input 
                           type="file" 
                           className="hidden" 
                           accept="image/*"
                           onChange={(e) => e.target.files && handleFileUpload(e.target.files[0], 'cover', true)}
                        />
                      </label>
                    </div>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-file_url">Ebook File (PDF)</Label>
                  <div className="relative">
                    <label 
                      onDragOver={onDragOver}
                      onDrop={(e) => onDrop(e, 'ebook', true)}
                      className="flex items-center justify-center w-full h-20 border-2 border-zinc-200 border-dashed rounded-lg cursor-pointer bg-zinc-50 hover:bg-zinc-100 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <BookOpen className="w-5 h-5 text-zinc-400" />
                        <span className="text-sm text-zinc-500 font-medium">
                          {editFormData.file_url ? 'PDF Selected ✓' : 'Select or drag PDF file'}
                        </span>
                      </div>
                      <input 
                        type="file" 
                        className="hidden" 
                        accept="application/pdf"
                        onChange={(e) => e.target.files && handleFileUpload(e.target.files[0], 'ebook', true)}
                      />
                    </label>
                  </div>
                </div>
                <Button type="submit" disabled={isUploading} className="w-full bg-orange-600 hover:bg-orange-700">
                  {isUploading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  Update Ebook
                </Button>
              </form>
            </DialogContent>
          </Dialog>

          <Dialog open={isDeleting} onOpenChange={setIsDeleting}>
            <DialogContent className="sm:max-w-[400px]">
              <DialogHeader>
                <DialogTitle className="text-xl font-bold text-red-600">Delete Ebook?</DialogTitle>
                <DialogDescription className="py-4">
                  Are you sure you want to delete this ebook? This action cannot be undone and will remove the book from the storefront.
                </DialogDescription>
              </DialogHeader>
              <div className="flex gap-3 justify-end">
                <Button variant="ghost" onClick={() => setIsDeleting(false)}>Cancel</Button>
                <Button variant="destructive" className="bg-red-600 hover:bg-red-700 font-bold px-6" onClick={handleDeleteEbook}>
                  Yes, Delete
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, i) => (
          <Card key={i} className="border-zinc-200 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-zinc-500">{stat.title}</CardTitle>
              <stat.icon className={`w-4 h-4 ${stat.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold tracking-tight">{stat.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Pending Orders Approvals */}
        <Card className="border-zinc-200 shadow-sm col-span-full ring-2 ring-orange-100 bg-orange-50/10">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-xl font-black text-orange-600">Verification Queue</CardTitle>
              <CardDescription>Pending UPI payments that need your approval.</CardDescription>
            </div>
            <div className="bg-orange-600 text-white px-3 py-1 rounded-full text-xs font-black">
              {orders.filter(o => o.status === 'pending').length} PENDING
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {orders.filter(o => o.status === 'pending').map(order => (
                <div key={order.id} className="flex flex-col p-4 bg-white rounded-2xl border border-orange-200 shadow-sm transition-all">
                  <div className="flex justify-between items-start mb-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono text-zinc-400">Order #{order.id.slice(-6)}</span>
                        <span className="text-sm font-black text-zinc-900">₹{order.amount}</span>
                      </div>
                      <p className="text-[10px] text-zinc-500 font-bold line-clamp-1">{order.ebook?.title}</p>
                      <p className="text-xs font-bold text-orange-600 uppercase tracking-wider">
                        UTR: {order.transaction_id || 'N/A'}
                      </p>
                      <div className="flex flex-wrap gap-1 mt-1">
                        <span className="text-[9px] font-black bg-zinc-100 text-zinc-500 px-1.5 py-0.5 rounded uppercase font-mono">CODE: {order.referral_code || 'LEGACY'}</span>
                        {order.referrer_id && (
                          <div className="flex items-center gap-1">
                            <Share2 className="w-3 h-3 text-blue-600" />
                            <span className="text-[10px] font-black text-blue-600 uppercase tracking-tighter bg-blue-50 px-1.5 rounded">Referral Attached</span>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] text-zinc-400 font-medium">
                        {new Date(order.created_at).toLocaleDateString()}
                      </p>
                      <p className="text-[10px] text-zinc-400 font-medium">
                        {new Date(order.created_at).toLocaleTimeString()}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex gap-2 mt-auto">
                    <Button 
                      className="flex-1 bg-green-600 hover:bg-green-700 text-xs font-black h-9 rounded-xl"
                      onClick={() => handleApproveOrder(order)}
                    >
                      APPROVE
                    </Button>
                    <Button 
                      variant="outline"
                      className="flex-1 border-red-100 text-red-600 hover:bg-red-50 text-xs font-black h-9 rounded-xl"
                      onClick={() => handleRejectOrder(order.id)}
                    >
                      REJECT
                    </Button>
                  </div>
                </div>
              ))}
              {orders.filter(o => o.status === 'pending').length === 0 && (
                <div className="col-span-full text-center py-12 bg-zinc-50 rounded-2xl border-2 border-dashed border-zinc-200">
                  <div className="flex flex-col items-center gap-2">
                    <BadgeCheck className="w-8 h-8 text-zinc-300" />
                    <p className="text-zinc-500 font-bold text-sm tracking-tight">Queue is empty. Everything verified!</p>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Recent Orders */}
        <Card className="border-zinc-200 shadow-sm">
          <CardHeader>
            <CardTitle>Approved Sales</CardTitle>
            <CardDescription>Track successfully verified transactions.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {orders.filter(o => o.status !== 'pending').map(order => (
                <div key={order.id} className="flex items-center justify-between p-3 rounded-lg border border-zinc-100">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono text-zinc-400">#{order.id.slice(-6)}</span>
                      <span className="text-sm font-bold">₹{order.amount}</span>
                    </div>
                    {order.transaction_id && (
                      <p className="text-[9px] font-mono text-zinc-400 bg-zinc-50 px-1 inline-block">UTR: {order.transaction_id}</p>
                    )}
                    <p className="text-[10px] text-zinc-500">
                      {new Date(order.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest ${
                      order.status === 'success' ? 'bg-green-100 text-green-700' : 'bg-zinc-100 text-zinc-500 line-through'
                    }`}>
                      {order.status}
                    </div>
                  </div>
                </div>
              ))}
              {orders.length === 0 && (
                <div className="text-center py-10 text-zinc-500 text-sm">No sales processed yet.</div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Sellers Management */}
        <Card className="border-zinc-200 shadow-sm">
          <CardHeader>
            <CardTitle>Manage Sellers</CardTitle>
            <CardDescription>View and manage independent sellers.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {sellers.map((seller) => (
                <div key={seller.uid} className="flex items-center justify-between p-3 rounded-lg border border-zinc-100">
                  <div className="flex items-center gap-3">
                    <img 
                      src={seller.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${seller.uid}`} 
                      alt="" 
                      className="w-10 h-10 rounded-full border border-zinc-100" 
                    />
                    <div>
                      <h4 className="font-bold text-sm">{seller.display_name}</h4>
                      <p className="text-[10px] text-zinc-500">{seller.email}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-black text-zinc-900">₹{(seller.earnings || 0) + (seller.affiliate_earnings || 0)}</p>
                    <p className="text-[10px] text-zinc-400">Total (₹{seller.affiliate_earnings || 0} Ref)</p>
                  </div>
                </div>
              ))}
              {sellers.length === 0 && (
                <div className="text-center py-10 text-zinc-500 text-sm">No independent sellers yet.</div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Ebooks List */}
        <Card className="border-zinc-200 shadow-sm col-span-full">
          <CardHeader>
            <CardTitle>Manage Ebooks Catalog</CardTitle>
            <CardDescription>View and manage all ebooks listed on the platform.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {ebooks.map(ebook => (
                <div key={ebook.id} className="flex items-center justify-between p-3 rounded-lg border border-zinc-100 hover:bg-zinc-50 transition-colors">
                  <div className="flex items-center gap-3">
                    <img src={ebook.cover_url || undefined} alt="" className="w-10 h-14 object-cover rounded shadow-sm" />
                    <div>
                      <h4 className="font-bold text-sm line-clamp-1">{ebook.title}</h4>
                      <p className="text-[10px] text-zinc-500">₹{ebook.price} • {ebook.category}</p>
                      {ebook.seller_id && <BadgeCheck className="w-3 h-3 text-blue-600 inline ml-1" />}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-8 w-8 text-zinc-400 hover:text-zinc-900"
                      onClick={() => startEdit(ebook)}
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-8 w-8 text-zinc-400 hover:text-red-600"
                      onClick={() => confirmDelete(ebook.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Withdrawal Management */}
      <Card className="border-zinc-200 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-xl font-black text-blue-600">Withdrawal Requests</CardTitle>
            <CardDescription>Payout requests from affiliates.</CardDescription>
          </div>
          <Badge className="bg-blue-600">
            {withdrawals.filter(w => w.status === 'pending').length} PENDING
          </Badge>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {withdrawals.filter(w => w.status === 'pending').map((w) => (
              <div key={w.id} className="p-4 bg-white rounded-2xl border border-zinc-200 shadow-sm space-y-4">
                <div className="flex justify-between items-start">
                  <div className="space-y-1">
                    <p className="text-lg font-black text-zinc-900">₹{w.amount}</p>
                    <p className="text-[10px] font-bold text-blue-600 uppercase tracking-widest">{w.upi_id}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] text-zinc-500 font-bold">{w.profiles?.display_name}</p>
                    <p className="text-[9px] text-zinc-400">{w.profiles?.email}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button 
                    className="flex-1 bg-zinc-900 hover:bg-black font-black text-xs h-9 rounded-xl"
                    onClick={() => handleApproveWithdrawal(w)}
                  >
                    MARK AS PAID
                  </Button>
                </div>
              </div>
            ))}
            {withdrawals.filter(w => w.status === 'pending').length === 0 && (
              <div className="col-span-full text-center py-12 bg-zinc-50 rounded-2xl border-2 border-dashed border-zinc-200">
                <p className="text-zinc-500 font-bold text-sm italic">No pending withdrawal requests.</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
