import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { User } from '@supabase/supabase-js';
import { motion } from 'motion/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { User as UserIcon, Mail, BadgeCheck, Shield, Calendar, Save, Loader2, LogOut, Download } from 'lucide-react';
import { toast } from 'sonner';
import { Profile as UserProfile } from '../types';

export default function Profile({ user }: { user: User | null }) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [displayName, setDisplayName] = useState('');

  useEffect(() => {
    if (user) {
      fetchProfile();
    }
  }, [user]);

  const fetchProfile = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('uid', user.id)
      .single();
    
    if (data) {
      setProfile(data as UserProfile);
      setDisplayName(data.display_name || '');
    }
    setLoading(false);
  };

  const handleSave = async () => {
    if (!user || !displayName.trim()) {
      toast.error('Name cannot be empty');
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ display_name: displayName.trim() })
        .eq('uid', user.id);

      if (error) throw error;

      // Update auth metadata too
      await supabase.auth.updateUser({
        data: { display_name: displayName.trim() }
      });

      toast.success('Profile updated successfully!');
      fetchProfile();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast.error(error.message);
    } else {
      toast.success('Logged out successfully');
      window.location.href = '/';
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4">
        <Loader2 className="w-8 h-8 text-orange-600 animate-spin" />
        <p className="font-bold text-zinc-400 italic uppercase">Loading Profile...</p>
      </div>
    );
  }

  if (!user || !profile) return null;

  return (
    <div className="max-w-2xl mx-auto space-y-6 sm:space-y-8 px-4 sm:px-0">
      <header className="text-center sm:text-left pt-4 sm:pt-0">
        <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-zinc-900 uppercase italic">My Account</h1>
        <p className="text-zinc-500 font-medium text-sm sm:text-base">Manage your personal details and preferences</p>
      </header>

      <div className="grid grid-cols-1 gap-6 sm:gap-8">
        {profile.role === 'admin' && (
          <motion.div 
            initial={{ opacity: 0, x: -20 }} 
            animate={{ opacity: 1, x: 0 }}
          >
            <Card className="border-2 border-orange-600 bg-orange-50/50 rounded-[2rem] overflow-hidden">
              <CardContent className="p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-orange-600 rounded-2xl flex items-center justify-center">
                    <Download className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="font-black italic uppercase text-zinc-900 leading-tight">Admin: Export Source Code</h3>
                    <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest">Download full project ZIP archive</p>
                  </div>
                </div>
                <Button 
                  onClick={() => window.open('/api/admin/export', '_blank')}
                  className="bg-orange-600 hover:bg-orange-700 text-white font-black italic uppercase tracking-widest text-xs h-12 px-8 rounded-xl shadow-lg shadow-orange-600/20"
                >
                  DOWNLOAD ZIP
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        )}

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="border-none shadow-2xl shadow-zinc-200/50 rounded-[2rem] sm:rounded-[2.5rem] overflow-hidden bg-white">
            <div className="h-24 sm:h-32 bg-gradient-to-r from-orange-500 to-orange-600" />
            <CardContent className="relative pt-0 px-6 sm:px-8 pb-8">
              <div className="flex flex-col sm:flex-row items-center sm:items-end gap-4 sm:gap-6 -mt-12 sm:-mt-12 mb-6 sm:mb-8 text-center sm:text-left">
                <img 
                  src={profile.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${profile.uid}`} 
                  alt={profile.display_name} 
                  className="w-24 h-24 sm:w-32 sm:h-32 rounded-[1.5rem] sm:rounded-[2rem] border-4 border-white shadow-xl bg-white"
                />
                <div className="pb-2 space-y-1">
                  <div className="flex items-center justify-center sm:justify-start gap-2">
                    <h2 className="text-2xl sm:text-3xl font-black text-zinc-900">{profile.display_name}</h2>
                    {profile.role === 'admin' && <Shield className="w-5 h-5 text-orange-600" />}
                    {(profile.role === 'seller' || profile.role === 'admin') && <BadgeCheck className="w-5 h-5 text-blue-600" />}
                  </div>
                  <p className="text-zinc-500 font-medium flex items-center justify-center sm:justify-start gap-2 text-sm">
                    <Mail className="w-4 h-4" />
                    {profile.email}
                  </p>
                </div>
              </div>

              <div className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="displayName" className="font-bold text-zinc-600 ml-1 text-xs sm:text-sm">Display Name</Label>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <Input 
                      id="displayName"
                      className="h-12 rounded-xl border-2 focus:border-orange-500 border-zinc-100 font-bold w-full"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                    />
                    <Button 
                      className="h-12 px-6 rounded-xl bg-zinc-900 hover:bg-black font-black gap-2 w-full sm:w-auto"
                      onClick={handleSave}
                      disabled={saving || displayName === profile.display_name}
                    >
                      {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                      SAVE
                    </Button>
                  </div>
                  <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest ml-1 text-center sm:text-left">
                    This name will be visible to other members and authors
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="p-4 bg-zinc-50 rounded-2xl border border-zinc-100 space-y-1">
                    <div className="flex items-center gap-2 text-zinc-400">
                      <Calendar className="w-4 h-4" />
                      <span className="text-[10px] font-black uppercase tracking-widest leading-none">Joined</span>
                    </div>
                    <p className="font-bold text-zinc-900">{new Date(profile.created_at).toLocaleDateString()}</p>
                  </div>
                  <div className="p-4 bg-zinc-50 rounded-2xl border border-zinc-100 space-y-1">
                    <div className="flex items-center gap-2 text-zinc-400">
                      <Shield className="w-4 h-4" />
                      <span className="text-[10px] font-black uppercase tracking-widest text-xs">Account Type</span>
                    </div>
                    <p className="font-black text-orange-600 uppercase italic">
                      {profile.role.toUpperCase()}
                    </p>
                  </div>
                </div>
              </div>

              <div className="pt-8 border-t border-zinc-100">
                <Button 
                  variant="destructive"
                  onClick={handleLogout}
                  className="w-full h-14 bg-red-50 hover:bg-red-100 text-red-600 border-none rounded-2xl sm:rounded-3xl font-black italic uppercase tracking-widest text-xs flex items-center justify-center gap-3 transition-all"
                >
                  <LogOut className="w-4 h-4" />
                  Terminate Session
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }} 
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card className="border-none shadow-xl shadow-zinc-200/50 rounded-[1.5rem] sm:rounded-[2rem] bg-zinc-900 text-white p-5 sm:p-6">
            <div className="flex flex-col sm:flex-row items-center gap-4 text-center sm:text-left">
              <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center shrink-0">
                <UserIcon className="w-6 h-6 text-orange-500" />
              </div>
              <div className="flex-1">
                <h3 className="font-black italic uppercase text-sm sm:text-base">Affiliate Link Status</h3>
                <p className="text-zinc-400 text-[10px] sm:text-xs font-medium break-all">Unique ID: {profile.uid}</p>
              </div>
              <Badge className="bg-orange-600 text-white border-none font-black italic w-full sm:w-auto justify-center py-1">ACTIVE</Badge>
            </div>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
