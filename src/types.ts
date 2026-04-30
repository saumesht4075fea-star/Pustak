export interface Ebook {
  id: string;
  title: string;
  author: string;
  description: string;
  price: number;
  commission_amount: number;
  cover_url: string;
  file_url: string;
  category: string;
  cosmofeed_url: string;
  seller_id: string;
  created_at: string;
  is_verified?: boolean;
  is_deleted?: boolean;
}

export interface Profile {
  uid: string;
  email: string;
  display_name?: string;
  avatar_url?: string;
  role: 'admin' | 'customer' | 'seller';
  earnings?: number;
  affiliate_earnings?: number;
  created_at: string;
  updated_at?: string;
}

export interface Order {
  id: string;
  user_id: string;
  ebook_id: string;
  referrer_id?: string | null;
  referral_code?: string;
  transaction_id?: string | null;
  amount: number;
  commission_amount?: number;
  status: string;
  created_at: string;
  ebook?: Ebook;
  profiles?: Profile;
}

export interface Review {
  id: string;
  ebook_id: string;
  user_id: string;
  user_name: string;
  rating: number;
  comment: string;
  created_at: string;
}

export interface WishlistItem {
  id: string;
  user_id: string;
  ebook_id: string;
  created_at: string;
  ebook?: Ebook;
}

export interface ChatMessage {
  id: string;
  user_id: string;
  display_name: string;
  avatar_url: string;
  text: string;
  created_at: string;
}
