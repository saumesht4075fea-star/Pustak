import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { supabase, isSupabaseConfigured } from './lib/supabase';
import { User } from '@supabase/supabase-js';
import SplashScreen from './components/SplashScreen';
import Home from './pages/Home';
import Admin from './pages/Admin';
import Wishlist from './pages/Wishlist';
import Orders from './pages/Orders';
import ProductDetail from './pages/ProductDetail';
import SellerDashboard from './pages/SellerDashboard';
import ProfilePage from './pages/Profile';
import About from './pages/About';
import Help from './pages/Help';
import GlobalChat from './components/GlobalChat';
import AIHelper from './components/AIHelper';
import { BugHunter } from './components/BugHunter';
import { Bot, Send, Sparkles, X, User as UserIcon, Loader2, BookOpen, Heart, ShoppingBag, Instagram, LogIn, LogOut, ShieldCheck, AlertTriangle, LayoutDashboard, UserCircle, Youtube, HelpCircle, Info, Smartphone, Bell, BellRing } from 'lucide-react';
import { Button, buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Toaster } from '@/components/ui/sonner';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

async function syncUser(user: User, displayName?: string) {
  try {
    const adminEmails = ['saumesht4075fea@gmail.com', 'mohittttt868@gmail.com', 'jeetusharma1583@gmail.com'];
    const role = adminEmails.includes(user.email || '') ? 'admin' : 'customer';
    
    const { error } = await supabase.from('profiles').upsert({
      uid: user.id,
      email: user.email,
      display_name: displayName || user.user_metadata?.display_name || user.email?.split('@')[0],
      role: role,
      created_at: new Date().toISOString()
    }, { 
      onConflict: 'uid',
      ignoreDuplicates: true 
    });

    if (error) console.error('Error syncing profile:', error);
  } catch (err) {
    console.error('Unexpected error in syncUser:', err);
  }
}

function ConfigWarning() {
  if (isSupabaseConfigured) return null;
  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-6 text-white text-center">
      <div className="max-w-md space-y-6">
        <div className="w-20 h-20 bg-orange-600 rounded-[2rem] flex items-center justify-center mx-auto animate-bounce">
          <ShieldCheck className="w-10 h-10" />
        </div>
        <h1 className="text-3xl font-black italic uppercase tracking-tighter">Configuration Required</h1>
        <p className="text-zinc-400 font-medium">
          PUSTAK is ready to deploy, but your Supabase connection is missing.
        </p>
        <div className="bg-zinc-900 p-6 rounded-3xl border border-zinc-800 text-left space-y-4">
          <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Render/Production Setup:</p>
          <ul className="text-sm space-y-2 text-zinc-300">
            <li className="flex gap-2">
              <span className="text-orange-500 font-black">1.</span>
              Go to Render Dashboard Environment
            </li>
            <li className="flex gap-2">
              <span className="text-orange-500 font-black">2.</span>
              Add VITE_SUPABASE_URL
            </li>
            <li className="flex gap-2">
              <span className="text-orange-500 font-black">3.</span>
              Add VITE_SUPABASE_ANON_KEY
            </li>
          </ul>
        </div>
        <p className="text-[10px] text-zinc-500 font-black uppercase tracking-[0.2em]">
          PUSTAK COMMAND • INTELLECTUAL DOMINANCE
        </p>
      </div>
    </div>
  );
}

function Navbar({ user, isAdmin, isSeller, hasOrders }: { user: User | null; isAdmin: boolean; isSeller: boolean; hasOrders: boolean }) {
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [notifications, setNotifications] = useState<any[]>([]);

  useEffect(() => {
    if (user) {
      setNotifications([
        { id: 1, title: 'Welcome to Pustak Online', message: 'Explore our premium ebook collection!', date: 'Just now', read: false },
        { id: 2, title: 'Special Offer', message: 'Get 10% cash back on your next referral!', date: '2h ago', read: false }
      ]);
    }
  }, [user]);

  const unreadCount = notifications.filter(n => !n.read).length;

  const handleGoogleLogin = async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin,
          queryParams: {
            prompt: 'select_account'
          }
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
          }
        }
      });
      if (error) throw error;
      if (data.user) {
        await syncUser(data.user, name);
        toast.success('Registration successful! Please check your email for confirmation.');
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
      toast.error(error.message || 'Login failed');
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast.success('Logged out');
  };

  return (
    <nav className="sticky top-0 z-40 w-full border-b border-zinc-200 bg-white/80 backdrop-blur-md">
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

          <Popover>
            <PopoverTrigger className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "text-zinc-600 relative")}>
              {unreadCount > 0 ? <BellRing className="w-5 h-5 text-orange-600 animate-pulse" /> : <Bell className="w-5 h-5" />}
              {unreadCount > 0 && (
                <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border border-white" />
              )}
            </PopoverTrigger>
            <PopoverContent className="w-80 p-0 rounded-2xl border border-zinc-100 shadow-2xl" align="end">
              <div className="p-4 border-b border-zinc-100 bg-zinc-50/50">
                 <h3 className="text-sm font-black italic uppercase tracking-widest">Notifications</h3>
              </div>
              <div className="max-h-[300px] overflow-y-auto">
                {user ? (
                  notifications.length > 0 ? (
                    notifications.map(n => (
                      <div key={n.id} className="p-4 border-b border-zinc-50 last:border-0 hover:bg-zinc-50 transition-colors cursor-pointer">
                        <p className="text-[10px] font-black text-orange-600 uppercase mb-1">{n.title}</p>
                        <p className="text-xs font-medium text-zinc-600 line-clamp-2 leading-relaxed">{n.message}</p>
                        <p className="text-[8px] font-bold text-zinc-400 mt-2">{n.date}</p>
                      </div>
                    ))
                  ) : (
                    <div className="p-8 text-center">
                       <Bell className="w-8 h-8 text-zinc-200 mx-auto mb-2" />
                       <p className="text-xs font-bold text-zinc-400 uppercase italic">No notifications yet</p>
                    </div>
                  )
                ) : (
                  <div className="p-8 text-center">
                     <p className="text-xs font-bold text-zinc-400 uppercase italic">Please sign in to see updates</p>
                  </div>
                )}
              </div>
              <div className="p-2 bg-zinc-50 text-center">
                 <Button variant="ghost" size="sm" className="text-[10px] font-black uppercase text-zinc-400">Clear All Alerts</Button>
              </div>
            </PopoverContent>
          </Popover>
          
          {isSeller && !isAdmin && user && (
            <Link to="/dashboard">
              <Button variant="ghost" size="icon" className="text-blue-600">
                <LayoutDashboard className="w-5 h-5" />
              </Button>
            </Link>
          )}

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
              <Link to="/profile" className="flex items-center group p-0.5 sm:p-1 sm:pr-3 bg-zinc-50 hover:bg-orange-50 rounded-full border border-zinc-200 hover:border-orange-200 transition-all shrink-0">
                <img src={user.user_metadata?.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.id}`} alt="" className="w-8 h-8 rounded-full border border-white shadow-sm" />
                <div className="hidden sm:flex flex-col items-start leading-tight sm:ml-2">
                  <p className="text-[10px] font-black text-zinc-900 group-hover:text-orange-600 transition-colors uppercase italic truncate max-w-[80px]">
                    {user.user_metadata?.display_name || user.email?.split('@')[0]}
                  </p>
                  <p className="text-[8px] font-bold text-zinc-400 group-hover:text-orange-400">EDIT PROFILE</p>
                </div>
              </Link>
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
            href="https://youtube.com/@Pustak_online" 
            target="_blank" 
            rel="noopener noreferrer"
            className="hidden sm:flex ml-2 p-2 text-zinc-600 hover:text-red-600 transition-colors"
          >
            <Youtube className="w-5 h-5" />
          </a>
          
          <a 
            href="https://www.instagram.com/pustak.online_" 
            target="_blank" 
            rel="noopener noreferrer"
            className="hidden sm:flex p-2 text-zinc-600 hover:text-pink-600 transition-colors"
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
  const [isSeller, setIsSeller] = useState(false);
  const [hasOrders, setHasOrders] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initializeAuth = async () => {
      if (!isSupabaseConfigured) {
        setLoading(false);
        return;
      }
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) {
          // If we have a refresh token error, forcefully clear local storage and sign out
          if (error.message.includes('Refresh Token Not Found') || error.message.includes('invalid_refresh_token')) {
            console.warn('Invalid session detected, clearing storage...');
            // Attempt to clear common supabase storage keys just in case
            Object.keys(localStorage).forEach(key => {
              if (key.includes('supabase.auth.token') || key.startsWith('sb-')) {
                localStorage.removeItem(key);
              }
            });
            // Force a sign out to clear any internal SDK state
            await supabase.auth.signOut().catch(() => {});
            setUser(null);
          }
          console.error('Session error:', error);
        }

        const currentUser = session?.user ?? null;
        setUser(currentUser);
        if (currentUser) {
          checkRole(currentUser);
          checkOrders(currentUser);
        }
      } catch (err) {
        console.error('Auth initialization error:', err);
      } finally {
        setLoading(false);
      }
    };

    initializeAuth();

    if (!isSupabaseConfigured) return;

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      const currentUser = session?.user ?? null;
      
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        setUser(currentUser);
        if (currentUser) {
          checkRole(currentUser);
          syncUser(currentUser);
          checkOrders(currentUser);
        }
      } else if (event === 'SIGNED_OUT') {
        setUser(null);
        setIsAdmin(false);
        setIsSeller(false);
        setHasOrders(false);
      }
      
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const checkOrders = async (user: User) => {
    if (!isSupabaseConfigured) return;
    const { data } = await supabase
      .from('orders')
      .select('id')
      .eq('user_id', user.id)
      .eq('status', 'success')
      .limit(1);
    
    setHasOrders(!!data && data.length > 0);
  };

  const checkRole = async (user: User) => {
    if (!isSupabaseConfigured) return;
    const adminEmails = ['saumesht4075fea@gmail.com', 'mohittttt868@gmail.com', 'jeetusharma1583@gmail.com'];
    if (adminEmails.includes(user.email || '')) {
      setIsAdmin(true);
      setIsSeller(true);
      return;
    }

    const { data } = await supabase
      .from('profiles')
      .select('role')
      .eq('uid', user.id)
      .single();

    if (data) {
      setIsAdmin(data.role === 'admin');
      setIsSeller(data.role === 'seller' || data.role === 'admin');
    }
  };

  if (showSplash) {
    return <SplashScreen onComplete={() => setShowSplash(false)} />;
  }

  if (!isSupabaseConfigured) {
    return <ConfigWarning />;
  }

  return (
    <Router>
      <BugHunter>
        <div className="min-h-screen bg-zinc-50 font-sans text-zinc-950 flex flex-col">
          <Navbar user={user} isAdmin={isAdmin} isSeller={isSeller} hasOrders={hasOrders} />
          <main className="container mx-auto px-4 py-8 flex-1">
            <AnimatePresence mode="wait">
              <Routes>
                <Route path="/" element={<Home user={user} />} />
                <Route path="/admin" element={isAdmin ? <Admin /> : <Home user={user} />} />
                <Route path="/dashboard" element={(user && !isAdmin) ? <SellerDashboard user={user} isAdmin={isAdmin} isSeller={isSeller} /> : <Home user={user} />} />
                <Route path="/wishlist" element={<Wishlist user={user} />} />
                <Route path="/orders" element={<Orders user={user} />} />
                <Route path="/about" element={<About />} />
                <Route path="/help" element={<Help />} />
                <Route path="/ebook/:id" element={<ProductDetail user={user} isAdmin={isAdmin} isSeller={isSeller} />} />
                <Route path="/profile" element={<ProfilePage user={user} />} />
              </Routes>
            </AnimatePresence>
          </main>
          <footer className="mt-auto border-t border-zinc-200 bg-white py-12">
            <div className="container mx-auto px-4">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
                <div className="space-y-4">
                  <Link to="/" className="flex items-center gap-2">
                    <BookOpen className="w-6 h-6 text-orange-600" />
                    <span className="text-xl font-black italic tracking-tighter">PUSTAK</span>
                  </Link>
                  <p className="text-sm font-medium text-zinc-500 leading-relaxed italic">
                    Premium digital assets for the modern intellectual. Dominate your field with curated knowledge.
                  </p>
                </div>
                <div className="space-y-4">
                  <h4 className="text-xs font-black uppercase tracking-widest text-zinc-900 italic">Company</h4>
                  <ul className="space-y-2">
                    <li><Link to="/about" className="text-sm font-bold text-zinc-500 hover:text-orange-600 transition-colors flex items-center gap-2 italic uppercase tracking-tight"><Info className="w-3.5 h-3.5" /> About Us</Link></li>
                    <li><Link to="/help" className="text-sm font-bold text-zinc-500 hover:text-orange-600 transition-colors flex items-center gap-2 italic uppercase tracking-tight"><HelpCircle className="w-3.5 h-3.5" /> Help Center</Link></li>
                  </ul>
                </div>
                <div className="space-y-4">
                  <h4 className="text-xs font-black uppercase tracking-widest text-zinc-900 italic">Support</h4>
                  <ul className="space-y-2">
                    <li><a href="mailto:support@pustak.online" className="text-sm font-bold text-zinc-500 hover:text-orange-600 transition-colors italic uppercase tracking-tight">Email Support</a></li>
                    <li><a href="#" className="text-sm font-bold text-zinc-500 hover:text-orange-600 transition-colors italic uppercase tracking-tight">Terms of Service</a></li>
                  </ul>
                </div>
                <div className="space-y-4">
                  <h4 className="text-xs font-black uppercase tracking-widest text-zinc-900 italic">Social</h4>
                  <div className="flex gap-4">
                    <a href="https://youtube.com/@Pustak_online" target="_blank" rel="noopener noreferrer" className="w-8 h-8 rounded-lg bg-zinc-100 flex items-center justify-center text-zinc-400 hover:bg-red-50 hover:text-red-600 transition-all"><Youtube className="w-4 h-4" /></a>
                    <a href="https://www.instagram.com/pustak.online_" target="_blank" rel="noopener noreferrer" className="w-8 h-8 rounded-lg bg-zinc-100 flex items-center justify-center text-zinc-400 hover:bg-pink-50 hover:text-pink-600 transition-all"><Instagram className="w-4 h-4" /></a>
                  </div>
                </div>
              </div>
              <div className="mt-12 pt-8 border-t border-zinc-100 text-center">
                <p className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] italic">© 2024 PUSTAK COMMAND • DOMINATE THE INTELLECT</p>
              </div>
            </div>
          </footer>
          <GlobalChat user={user} isAdmin={isAdmin} />
          <AIHelper user={user} isAdmin={isAdmin} />
          <Toaster position="top-center" />
        </div>
      </BugHunter>
    </Router>
  );
}
