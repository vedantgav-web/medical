export interface Database {
  public: {
    Tables: {
      users: {
        Row: User;
        Insert: UserInsert;
      };
      products: {
        Row: Product;
        Insert: ProductInsert;
        Update: ProductUpdate;
      };
      bills: {
        Row: Bill;
        Insert: BillInsert;
        Update: Partial<BillInsert>;
      };
      bill_items: {
        Row: BillItem;
        Insert: BillItemInsert;
        Update: Partial<BillItemInsert>;
      };
    };
  };
}

export interface User {
  id: string;
  username: string;
  password: string;
  created_at: string;
  updated_at: string;
}

export type UserInsert = Omit<User, 'id' | 'created_at' | 'updated_at'>;

export interface Product {
  id: string;
  user_id: string;
  name: string;
  specifications: string;
  batch_number: string;
  quantity: number;
  min_threshold: number;
  single_price: number;
  total_price: number;
  expiry_date: string | null;
  drawer_number: string;
  status: 'Good' | 'Expired';
  created_at: string;
  updated_at: string;
}

export type ProductInsert = Omit<Product, 'id' | 'total_price' | 'created_at' | 'updated_at' | 'status'> & {
  id?: string;
  status?: 'Good' | 'Expired';
};

export type ProductUpdate = Partial<ProductInsert>;

export interface Bill {
  id: number;
  user_id: string;
  customer_name: string;
  customer_phone: string;
  payment_method: 'Cash' | 'UPI' | 'Card';
  total_amount: number;
  created_at: string;
}

export type BillInsert = Omit<Bill, 'id' | 'created_at' | 'user_id'>;

export interface BillItem {
  id: number;
  bill_id: number;
  product_id: string;
  user_id: string;
  quantity_sold: number;
  price_per_unit: number;
}

export type BillItemInsert = Omit<BillItem, 'id' | 'user_id'>;

export interface CartItem {
  product: Product;
  quantity: number;
}

export interface BillWithItems extends Bill {
  bill_items: (BillItem & { product: Product })[];
}

export type TimePeriod = 'day' | 'week' | 'month';

export interface DailySales {
  date: string;
  total_sales: number;
  bill_count: number;
}

export interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
}
