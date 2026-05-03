import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { User } from '@supabase/supabase-js';
import { motion } from 'motion/react';
import { Heart, Trash2, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { Ebook, WishlistItem } from '../types';

export default function Wishlist({ user }: { user: User | null }) {
  const [items, setItems] = useState<WishlistItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    const fetchWishlist = async () => {
      const { data, error } = await supabase
        .from('wishlist')
        .select(`
          id,
          user_id,
          ebook_id,
          created_at,
          ebook:ebooks(id, title, author, description, price, commission_amount, cover_url, file_url, category, cosmofeed_url, seller_id, is_verified, is_deleted, created_at)
        `)
        .eq('user_id', user.id);

      if (error) {
        toast.error('Failed to fetch wishlist');
        setLoading(false);
        return;
      }

      if (data) {
        const enrichedItems = data.map(item => ({
          ...item,
          ebook: Array.isArray(item.ebook) ? item.ebook[0] : item.ebook
        }));
        setItems(enrichedItems as WishlistItem[]);
      }
      setLoading(false);
    };

    fetchWishlist();

    const channel = supabase
      .channel('wishlist_user')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'wishlist',
        filter: `user_id=eq.${user.id}`
      }, fetchWishlist)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const remove = async (id: string) => {
    try {
      const { error } = await supabase
        .from('wishlist')
        .delete()
        .eq('id', id);
      if (error) throw error;
      toast.success('Removed from wishlist');
    } catch (error) {
      toast.error('Failed to remove');
    }
  };

  if (!user) {
    return (
      <div className="text-center py-20 space-y-6">
        <div className="w-20 h-20 bg-zinc-100 rounded-full flex items-center justify-center mx-auto">
          <Heart className="w-8 h-8 text-zinc-300" />
        </div>
        <h2 className="text-2xl font-bold tracking-tighter">Your Wishlist is Empty</h2>
        <p className="text-zinc-500 max-w-xs mx-auto">Login to save your favorite ebooks and read them later.</p>
        <Button asChild className="bg-orange-600 hover:bg-orange-700">
          <Link to="/">Explore Store</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tighter">My Wishlist</h1>
        <p className="text-zinc-500">Ebooks you've saved for later.</p>
      </div>

      <div className="grid gap-4">
        {items.map((item) => (
          <motion.div
            key={item.id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
          >
            <Card className="border-zinc-200 overflow-hidden hover:shadow-md transition-shadow">
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  {item.ebook?.cover_url && <img src={item.ebook.cover_url} alt="" className="w-16 h-24 object-cover rounded shadow-sm" />}
                  <div>
                    <h3 className="font-bold text-lg tracking-tight">{item.ebook?.title}</h3>
                    <p className="text-sm text-zinc-500">by {item.ebook?.author}</p>
                    <p className="text-lg font-black mt-1">₹{item.ebook?.price}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" asChild className="gap-2">
                    <Link to={`/ebook/${item.ebook_id}`}>
                      View <ArrowRight className="w-4 h-4" />
                    </Link>
                  </Button>
                  <Button variant="ghost" size="icon" className="text-zinc-400 hover:text-red-600" onClick={() => remove(item.id)}>
                    <Trash2 className="w-5 h-5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}

        {items.length === 0 && !loading && (
          <div className="text-center py-20 border-2 border-dashed border-zinc-200 rounded-3xl">
            <p className="text-zinc-500">No items in your wishlist yet.</p>
          </div>
        )}
      </div>
    </div>
  );
}
