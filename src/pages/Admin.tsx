import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { motion } from 'motion/react';
import { Plus, Pencil, Trash2, Package, Users, IndianRupee, BookOpen, Upload, X, Loader2, Image as ImageIcon, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Ebook, Order } from '../types';

export default function Admin() {
  const [ebooks, setEbooks] = useState<Ebook[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [imgbbKey, setImgbbKey] = useState(localStorage.getItem('imgbb_key') || '');
  const [newEbook, setNewEbook] = useState<Partial<Ebook>>({
    title: '',
    author: '',
    description: '',
    price: 0,
    cover_url: '',
    file_url: '',
    category: 'Fiction',
    cosmofeed_url: ''
  });

  useEffect(() => {
    const fetchEbooks = async () => {
      const { data, error } = await supabase
        .from('ebooks')
        .select('*')
        .order('created_at', { ascending: false });
      if (data) setEbooks(data);
    };

    const fetchOrders = async () => {
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .order('created_at', { ascending: false });
      if (data) setOrders(data);
    };

    fetchEbooks();
    fetchOrders();

    const ebooksChannel = supabase
      .channel('admin_ebooks')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ebooks' }, fetchEbooks)
      .subscribe();

    const ordersChannel = supabase
      .channel('admin_orders')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, fetchOrders)
      .subscribe();

    return () => {
      supabase.removeChannel(ebooksChannel);
      supabase.removeChannel(ordersChannel);
    };
  }, []);

  const handleAddEbook = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isUploading) {
      toast.error('Please wait for image upload to complete');
      return;
    }
    try {
      const { error } = await supabase
        .from('ebooks')
        .insert({
          ...newEbook,
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
        cover_url: '',
        file_url: '',
        category: 'Fiction',
        cosmofeed_url: ''
      });
    } catch (error: any) {
      console.error('Ebook Insert Error:', error);
      toast.error(`Database Error: ${error.message || 'Failed to add ebook'}`);
    }
  };

  const handleDeleteEbook = async (id: string) => {
    if (confirm('Are you sure you want to delete this ebook?')) {
      try {
        const { error } = await supabase
          .from('ebooks')
          .delete()
          .eq('id', id);
        if (error) throw error;
        toast.success('Ebook deleted');
      } catch (error) {
        toast.error('Failed to delete ebook');
      }
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random()}.${fileExt}`;
      const filePath = `covers/${fileName}`;

      const { error: uploadError, data } = await supabase.storage
        .from('ebooks')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('ebooks')
        .getPublicUrl(filePath);

      setNewEbook(prev => ({ ...prev, cover_url: publicUrl }));
      toast.success('Cover image uploaded to Supabase!');
    } catch (error: any) {
      console.error(error);
      toast.error(`Upload failed: ${error.message}`);
    } finally {
      setIsUploading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random()}.${fileExt}`;
      const filePath = `files/${fileName}`;

      const { error: uploadError, data } = await supabase.storage
        .from('ebooks')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('ebooks')
        .getPublicUrl(filePath);

      setNewEbook(prev => ({ ...prev, file_url: publicUrl }));
      toast.success('Ebook file uploaded to Supabase!');
    } catch (error: any) {
      console.error(error);
      toast.error(`File upload failed: ${error.message}`);
    } finally {
      setIsUploading(false);
    }
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
                <p>1. <strong>Upload File</strong>: Upload your PDF/EPUB to a cloud storage (Google Drive, Dropbox, or Firebase Storage) and get the direct download link.</p>
                <p>2. <strong>Cover Image</strong>: Use an image URL for the book cover (e.g., from Unsplash or your own hosting).</p>
                <p>3. <strong>Cosmofeed Link</strong>: Create a payment page on Cosmofeed for your ebook and paste the link in the "Cosmofeed URL" field.</p>
                <p>4. <strong>Add Ebook</strong>: Fill in the details in the "Add New Ebook" form and click Create.</p>
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
                    <Label htmlFor="category">Category</Label>
                    <Select 
                      value={newEbook.category} 
                      onValueChange={v => setNewEbook({...newEbook, category: v})}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent className="z-[100]">
                        <SelectItem value="Fiction">Fiction</SelectItem>
                        <SelectItem value="Non-Fiction">Non-Fiction</SelectItem>
                        <SelectItem value="Self-Help">Self-Help</SelectItem>
                        <SelectItem value="Business">Business</SelectItem>
                        <SelectItem value="Technology">Technology</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Cover Image</Label>
                  <div className="flex gap-4 items-start">
                    <div className="relative w-24 h-32 bg-zinc-100 rounded-lg border-2 border-dashed border-zinc-200 flex items-center justify-center overflow-hidden">
                      {newEbook.cover_url ? (
                        <img src={newEbook.cover_url} alt="Preview" className="w-full h-full object-cover" />
                      ) : (
                        <ImageIcon className="w-8 h-8 text-zinc-300" />
                      )}
                      {isUploading && (
                        <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
                          <Loader2 className="w-6 h-6 text-white animate-spin" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 space-y-3">
                      <div className="flex gap-2">
                        <Input 
                          type="file" 
                          accept="image/*" 
                          className="hidden" 
                          id="cover-upload"
                          onChange={handleImageUpload}
                          disabled={isUploading}
                        />
                        <Button 
                          type="button" 
                          variant="outline" 
                          className="w-full gap-2"
                          onClick={() => document.getElementById('cover-upload')?.click()}
                          disabled={isUploading}
                        >
                          {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                          Upload Image
                        </Button>
                      </div>
                      <div className="relative">
                        <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
                        <div className="relative flex justify-center text-[10px] uppercase"><span className="bg-white px-2 text-zinc-400">Or use URL</span></div>
                      </div>
                      <Input 
                        placeholder="Paste image URL here..." 
                        value={newEbook.cover_url} 
                        onChange={e => setNewEbook({...newEbook, cover_url: e.target.value})} 
                        disabled={isUploading}
                      />
                    </div>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="file_url">Ebook File (PDF/EPUB)</Label>
                  <div className="flex gap-2">
                    <Input 
                      type="file" 
                      accept=".pdf,.epub" 
                      className="hidden" 
                      id="file-upload"
                      onChange={handleFileUpload}
                      disabled={isUploading}
                    />
                    <Button 
                      type="button" 
                      variant="outline" 
                      className="flex-1 gap-2"
                      onClick={() => document.getElementById('file-upload')?.click()}
                      disabled={isUploading}
                    >
                      {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                      Upload Ebook File
                    </Button>
                    <Input 
                      placeholder="Or paste file URL..." 
                      className="flex-[2]"
                      value={newEbook.file_url} 
                      onChange={e => setNewEbook({...newEbook, file_url: e.target.value})} 
                      disabled={isUploading}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cosmofeed_url">Cosmofeed Payment URL</Label>
                  <Input id="cosmofeed_url" placeholder="https://cosmofeed.com/vp/..." value={newEbook.cosmofeed_url} onChange={e => setNewEbook({...newEbook, cosmofeed_url: e.target.value})} />
                </div>
                <Button type="submit" className="w-full bg-orange-600 hover:bg-orange-700">Create Ebook</Button>
              </form>
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
        {/* Ebooks List */}
        <Card className="border-zinc-200 shadow-sm">
          <CardHeader>
            <CardTitle>Manage Ebooks</CardTitle>
            <CardDescription>View and edit your ebook catalog.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {ebooks.map(ebook => (
                <div key={ebook.id} className="flex items-center justify-between p-3 rounded-lg border border-zinc-100 hover:bg-zinc-50 transition-colors">
                  <div className="flex items-center gap-3">
                    <img src={ebook.cover_url} alt="" className="w-10 h-14 object-cover rounded shadow-sm" />
                    <div>
                      <h4 className="font-bold text-sm line-clamp-1">{ebook.title}</h4>
                      <p className="text-xs text-zinc-500">₹{ebook.price} • {ebook.category}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-zinc-400 hover:text-zinc-900">
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-8 w-8 text-zinc-400 hover:text-red-600"
                      onClick={() => handleDeleteEbook(ebook.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Recent Orders */}
        <Card className="border-zinc-200 shadow-sm">
          <CardHeader>
            <CardTitle>Recent Orders</CardTitle>
            <CardDescription>Track your latest sales and customers.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {orders.map(order => (
                <div key={order.id} className="flex items-center justify-between p-3 rounded-lg border border-zinc-100">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono text-zinc-400">#{order.id.slice(-6)}</span>
                      <span className="text-sm font-bold">₹{order.amount}</span>
                    </div>
                    <p className="text-xs text-zinc-500">
                      {new Date(order.created_at).toLocaleDateString()} at {new Date(order.created_at).toLocaleTimeString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                      order.status === 'completed' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                    }`}>
                      {order.status}
                    </div>
                  </div>
                </div>
              ))}
              {orders.length === 0 && (
                <div className="text-center py-10 text-zinc-500 text-sm">No orders yet.</div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
