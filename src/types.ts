export interface Ebook {
  id: string;
  title: string;
  author: string;
  description: string;
  price: number;
  cover_url: string;
  file_url: string;
  category: string;
  cosmofeed_url?: string;
  created_at: string;
}

export interface Profile {
  uid: string;
  email: string;
  display_name: string;
  photo_url: string;
  role: 'admin' | 'customer';
  created_at: string;
}

export interface Order {
  id: string;
  user_id: string;
  ebook_id: string;
  amount: number;
  status: string;
  created_at: string;
  ebook?: Ebook;
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
