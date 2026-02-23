export type PaymentMethod = 'cash' | 'credit_card';

export interface Category {
  id: string;
  name: string;
  color: string;
  type: 'income' | 'expense';
}

export interface CreditCard {
  id: string;
  name: string;
  closingDay: number;
  dueDay: number;
  color: string;
}

export interface ValueHistoryItem {
  monthYear: string; // YYYY-MM
  value: number;
  paymentMethod?: string; // 'cash' or cardId
}

export interface Income {
  id: string;
  title: string;
  categoryId: string;
  type: 'fixed' | 'temporary';
  paymentMethod?: string; // 'cash' or cardId
  // For Fixed
  valueHistory?: ValueHistoryItem[]; 
  // For Temporary
  amount?: number;
  startMonth?: string; // YYYY-MM
  durationMonths?: number;
}

export interface Expense {
  id: string;
  title: string;
  categoryId: string;
  type: 'fixed' | 'one_time' | 'installment';
  purchaseDate: string; // YYYY-MM-DD
  billingMonth: string; // YYYY-MM
  isInstallment: boolean;
  totalValue: number;
  installmentValue: number;
  installments?: {
    current: number;
    total: number;
  };
  paymentMethod: string; // 'cash' or cardId
  isPaid: boolean;
  originalId?: string; // To link installments
  // For Fixed
  valueHistory?: ValueHistoryItem[];
  createdAt?: string; // ISO string
}

export interface CardPaymentStatus {
  cardId: string;
  monthYear: string;
  isPaid: boolean;
}

export interface ExtractedData {
  name?: string;
  value?: number;
  category?: string;
  paymentMethod?: string;
  isInstallment?: boolean;
  installments?: number;
  // Keep these for internal mapping if needed, but the AI will return the above
  purchaseDate?: string;
  billingMonth?: string;
  confidence?: number;
  missingFields?: string[];
}
