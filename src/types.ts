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
  course_id?: string;
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
  course?: Course;
  profiles?: Profile; // Keeping for backward compatibility if needed
  buyer?: Profile;
  referrer_profile?: Profile;
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

export interface Course {
  id: string;
  ebook_id?: string; // Associated ebook
  title: string;
  instructor: string;
  description: string;
  price: number;
  commission_amount: number;
  cover_url: string;
  category: string;
  seller_id: string;
  created_at: string;
  is_verified?: boolean;
  is_deleted?: boolean;
}

export interface UserCourseProgress {
  id: string;
  user_id: string;
  course_id: string;
  video_id: string;
  is_completed: boolean;
  last_watched_at: string;
}

export interface CourseVideo {
  id: string;
  course_id: string;
  title: string;
  description?: string;
  mux_playback_id: string;
  mux_asset_id: string;
  is_preview: boolean;
  order_index: number;
  duration?: string;
  created_at: string;
}
