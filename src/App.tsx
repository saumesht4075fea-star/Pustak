import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { supabase, isSupabaseConfigured } from './lib/supabase';
import { Session, User } from '@supabase/supabase-js';
import SplashScreen from './components/SplashScreen';
import Home from './pages/Home';
import Admin from './pages/Admin';
import Wishlist from './pages/Wishlist';
import Orders from './pages/Orders';
import ProductDetail from './pages/ProductDetail';
import { BookOpen, Heart, ShoppingBag, User as UserIcon, Instagram, LogIn, LogOut, ShieldCheck, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Toaster } from '@/components/ui/sonner';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

function ConfigWarning() {
  if (isSupabaseConfigured) return null;
  return (
    <div className="bg-orange-50 border-b border-orange-200 p-2 text-center flex items-center justify-center gap-2 text-orange-800 text-xs font-medium">
      <AlertTriangle className="w-3 h-3" />
      Supabase not configured. Please add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to Secrets.
    </div>
  );
}

function Navbar({ user, isAdmin }: { user: User | null; isAdmin: boolean }) {
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');

  const handleGoogleLogin = async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin
        }
      });
      if (error) throw error;
    } catch (error) {
      console.error(error);
      toast.error('Login failed');
    }
  };

  const handleEmailSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            display_name: name,
            photo_url: `https://api.dicebear.com/7.x/avataaars/svg?seed=${email}`
          }
        }
      });
      if (error) throw error;
      
      if (data.session) {
        if (data.user) await syncUser(data.user);
        toast.success('Account created and logged in!');
        setIsLoginOpen(false);
      } else {
        toast.success('Signup successful! Please check your email for a confirmation link.');
      }
    } catch (error: any) {
      console.error('Signup Error:', error);
      toast.error(error.message);
    }
  };

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;
      setIsLoginOpen(false);
      toast.success('Welcome back!');
    } catch (error: any) {
      console.error('Login Error:', error);
      if (error.message === 'Email not confirmed') {
        toast.error('Email not confirmed. Please check your inbox.', {
          action: {
            label: 'Resend Email',
            onClick: async () => {
              const { error: resendError } = await supabase.auth.resend({
                type: 'signup',
                email: email,
              });
              if (resendError) toast.error(resendError.message);
              else toast.success('Confirmation email resent!');
            }
          }
        });
      } else if (error.message === 'Failed to fetch') {
        toast.error('Connection failed. Please check if your Supabase URL in Secrets is correct and includes https://');
      } else {
        toast.error(error.message || 'Login failed. Check your Supabase URL in Secrets.');
      }
    }
  };

  const syncUser = async (user: User) => {
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('uid', user.id)
      .single();

    if (!profile) {
      const role = user.email === 'saumesht4075fea@gmail.com' ? 'admin' : 'customer';
      const { error: insertError } = await supabase.from('profiles').insert({
        uid: user.id,
        email: user.email,
        display_name: user.user_metadata.display_name || user.email?.split('@')[0],
        photo_url: user.user_metadata.photo_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.id}`,
        role: role,
        created_at: new Date().toISOString(),
      });
      
      if (insertError) {
        console.error('RLS Error (Profiles):', insertError);
        toast.error('Database permission error. Please run the SQL script in Supabase.');
      }
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast.success('Logged out');
  };

  return (
    <nav className="sticky top-0 z-40 w-full border-b border-zinc-200 bg-white/80 backdrop-blur-md">
      <ConfigWarning />
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2 group">
          <BookOpen className="w-6 h-6 text-orange-600 group-hover:rotate-12 transition-transform" />
          <span className="text-xl font-bold tracking-tighter">PUSTAK</span>
        </Link>

        <div className="flex items-center gap-1 sm:gap-4">
          <Link to="/wishlist">
            <Button variant="ghost" size="icon" className="text-zinc-600">
              <Heart className="w-5 h-5" />
            </Button>
          </Link>
          <Link to="/orders">
            <Button variant="ghost" size="icon" className="text-zinc-600">
              <ShoppingBag className="w-5 h-5" />
            </Button>
          </Link>
          
          {isAdmin && (
            <Link to="/admin">
              <Button variant="ghost" size="icon" className="text-orange-600">
                <ShieldCheck className="w-5 h-5" />
              </Button>
            </Link>
          )}

          <div className="h-6 w-[1px] bg-zinc-200 mx-2" />

          {user ? (
            <div className="flex items-center gap-2">
              <img src={user.user_metadata.photo_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.id}`} alt="" className="w-8 h-8 rounded-full border border-zinc-200" />
              <Button variant="ghost" size="sm" onClick={handleLogout} className="flex gap-2">
                <LogOut className="w-4 h-4" />
                <span className="hidden sm:inline">Logout</span>
              </Button>
            </div>
          ) : (
            <Dialog open={isLoginOpen} onOpenChange={setIsLoginOpen}>
              <DialogTrigger asChild>
                <Button variant="default" size="sm" className="bg-orange-600 hover:bg-orange-700 gap-2">
                  <LogIn className="w-4 h-4" />
                  Sign In
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[400px]">
                <DialogHeader>
                  <DialogTitle className="text-2xl font-bold tracking-tight text-center">Welcome to Pustak</DialogTitle>
                  <DialogDescription className="text-center">
                    Sign in to your account or create a new one to continue.
                  </DialogDescription>
                </DialogHeader>
                <Tabs defaultValue="login" className="w-full">
                  <TabsList className="grid w-full grid-cols-2 mb-4">
                    <TabsTrigger value="login">Login</TabsTrigger>
                    <TabsTrigger value="register">Register</TabsTrigger>
                  </TabsList>
                  <TabsContent value="login">
                    <form onSubmit={handleEmailLogin} className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="email">Email</Label>
                        <Input id="email" type="email" required value={email} onChange={e => setEmail(e.target.value)} />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="password">Password</Label>
                        <Input id="password" type="password" required value={password} onChange={e => setPassword(e.target.value)} />
                      </div>
                      <Button type="submit" className="w-full bg-orange-600 hover:bg-orange-700">Login</Button>
                      <p className="text-[10px] text-center text-zinc-400">
                        Getting "Email not confirmed"? Check your inbox or disable "Confirm Email" in Supabase.
                      </p>
                    </form>
                  </TabsContent>
                  <TabsContent value="register">
                    <form onSubmit={handleEmailSignup} className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="reg-name">Full Name</Label>
                        <Input id="reg-name" required value={name} onChange={e => setName(e.target.value)} />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="reg-email">Email</Label>
                        <Input id="reg-email" type="email" required value={email} onChange={e => setEmail(e.target.value)} />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="reg-password">Password</Label>
                        <Input id="reg-password" type="password" required value={password} onChange={e => setPassword(e.target.value)} />
                      </div>
                      <Button type="submit" className="w-full bg-orange-600 hover:bg-orange-700">Create Account</Button>
                    </form>
                  </TabsContent>
                </Tabs>
                <div className="relative my-4">
                  <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
                  <div className="relative flex justify-center text-xs uppercase"><span className="bg-white px-2 text-zinc-500">Or continue with</span></div>
                </div>
                <Button variant="outline" className="w-full gap-2" onClick={handleGoogleLogin}>
                  <svg className="w-4 h-4" viewBox="0 0 24 24">
                    <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
                    <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                  </svg>
                  Google
                </Button>
              </DialogContent>
            </Dialog>
          )}
          
          <a 
            href="https://instagram.com" 
            target="_blank" 
            rel="noopener noreferrer"
            className="ml-2 p-2 text-zinc-600 hover:text-pink-600 transition-colors"
          >
            <Instagram className="w-5 h-5" />
          </a>
        </div>
      </div>
    </nav>
  );
}

export default function App() {
  const [showSplash, setShowSplash] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check active sessions and subscribe to auth changes
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (error) {
        console.error('Auth session error:', error);
        if (error.message === 'Failed to fetch') {
          toast.error('Connection to Supabase failed. Please check your internet or Supabase URL in Secrets.');
        }
      }
      setUser(session?.user ?? null);
      checkAdmin(session?.user ?? null);
      setLoading(false);
    }).catch(err => {
      console.error('Auth session catch:', err);
      if (err.message === 'Failed to fetch') {
        toast.error('Connection to Supabase failed. Please check your internet or Supabase URL in Secrets.');
      }
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      checkAdmin(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const checkAdmin = async (user: User | null) => {
    if (user) {
      // Immediate check for the owner email
      if (user.email === 'saumesht4075fea@gmail.com') {
        setIsAdmin(true);
        return;
      }
      
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('role')
          .eq('uid', user.id)
          .single();
        
        if (error) throw error;
        setIsAdmin(data?.role === 'admin');
      } catch (err) {
        console.error('Admin check failed:', err);
        setIsAdmin(false);
      }
    } else {
      setIsAdmin(false);
    }
  };

  if (showSplash) {
    return <SplashScreen onComplete={() => setShowSplash(false)} />;
  }

  return (
    <Router>
      <div className="min-h-screen bg-zinc-50 font-sans text-zinc-950">
        <Navbar user={user} isAdmin={isAdmin} />
        <main className="container mx-auto px-4 py-8">
          <AnimatePresence mode="wait">
            <Routes>
              <Route path="/" element={<Home user={user} />} />
              <Route path="/admin" element={isAdmin ? <Admin /> : <Home user={user} />} />
              <Route path="/wishlist" element={<Wishlist user={user} />} />
              <Route path="/orders" element={<Orders user={user} />} />
              <Route path="/ebook/:id" element={<ProductDetail user={user} />} />
            </Routes>
          </AnimatePresence>
        </main>
        <Toaster position="top-center" />
      </div>
    </Router>
  );
}
