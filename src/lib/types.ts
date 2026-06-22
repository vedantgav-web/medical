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
      customer_returns: {
        Row: CustomerReturn;
        Insert: CustomerReturnInsert;
      };
      wholeseller_returns: {
        Row: WholesellerReturn;
        Insert: WholesellerReturnInsert;
      };
    };
  };
}

export interface User {
  id: string;
  username: string;
  password: string;
  store_name: string;
  address: string;
  email: string;
  status: 'active' | 'inactive';
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
  tablets_per_strip: number;
  sell_by_tablet: boolean;
  tablet_price: number;
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

export interface CustomerReturn {
  id: string;
  user_id: string;
  product_id: string;
  product_name: string;
  batch_number: string;
  quantity: number;
  return_type: 'refund' | 'exchange';
  refund_amount: number;
  exchange_product_id: string | null;
  exchange_product_name: string;
  exchange_quantity: number;
  customer_name: string;
  customer_phone: string;
  reason: string;
  created_at: string;
}

export type CustomerReturnInsert = Omit<CustomerReturn, 'id' | 'created_at'>;

export interface WholesellerReturn {
  id: string;
  user_id: string;
  product_id: string;
  product_name: string;
  batch_number: string;
  quantity: number;
  wholeseller_name: string;
  reason: string;
  refund_amount: number;
  status: 'pending' | 'completed';
  created_at: string;
}

export type WholesellerReturnInsert = Omit<WholesellerReturn, 'id' | 'created_at'>;

export interface CartItem {
  product: Product;
  quantity: number;
  sellMode: 'strip' | 'tablet';
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
  refreshUser: () => Promise<void>;
}
