import { useState, useEffect, useCallback, createContext, useContext, ReactNode } from 'react';
import { Income, Expense, Category, CreditCard, CardPaymentStatus } from '../types';
import { v4 as uuidv4 } from 'uuid';
import { supabase } from '../lib/supabase';
import { User } from '@supabase/supabase-js';
import { motion, AnimatePresence } from 'motion/react';
import { addMonths, format, parseISO } from 'date-fns';

interface FinanceContextType {
  user: User | null;
  loading: boolean;
  isSaving: boolean;
  saveSuccess: boolean;
  expenses: Expense[];
  incomes: Income[];
  expenseCategories: Category[];
  incomeCategories: Category[];
  cards: CreditCard[];
  cardPayments: CardPaymentStatus[];
  lastUsedPaymentMethod: string;
  setLastUsedPaymentMethod: (method: string) => void;
  loadData: () => Promise<void>;
  addExpense: (expense: Omit<Expense, 'id'>) => Promise<void>;
  addInstallmentExpense: (baseExpense: Omit<Expense, 'id' | 'installments' | 'billingMonth' | 'type'>, startBillingMonth: string, totalInstallments: number) => Promise<void>;
  updateExpense: (id: string, updates: Partial<Expense>) => Promise<void>;
  deleteExpense: (id: string) => Promise<void>;
  toggleExpensePaid: (id: string) => Promise<void>;
  updateFixedExpenseValue: (id: string, monthYear: string, newValue: number, newPaymentMethod?: string) => Promise<void>;
  addIncome: (income: Omit<Income, 'id'>) => Promise<void>;
  updateIncome: (id: string, updates: Partial<Income>) => Promise<void>;
  deleteIncome: (id: string) => Promise<void>;
  updateFixedIncomeValue: (id: string, monthYear: string, newValue: number, paymentMethod?: string) => Promise<void>;
  addCard: (card: Omit<CreditCard, 'id'>) => Promise<void>;
  updateCard: (id: string, updates: Partial<CreditCard>) => Promise<void>;
  deleteCard: (id: string) => Promise<void>;
  toggleCardPaid: (cardId: string, monthYear: string) => Promise<void>;
  addCategory: (category: Omit<Category, 'id'>) => Promise<void>;
  updateCategory: (id: string, updates: Partial<Category>) => Promise<void>;
  deleteCategory: (id: string) => Promise<void>;
  getIncomeValueForMonth: (income: Income, monthYear: string) => number;
  getExpenseValueForMonth: (expense: Expense, monthYear: string) => { value: number; paymentMethod: string };
}

const FinanceContext = createContext<FinanceContextType | undefined>(undefined);

export const FinanceProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);

  const [incomes, setIncomes] = useState<Income[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [incomeCategories, setIncomeCategories] = useState<Category[]>([]);
  const [expenseCategories, setExpenseCategories] = useState<Category[]>([]);
  const [cards, setCards] = useState<CreditCard[]>([]);
  const [cardPayments, setCardPayments] = useState<CardPaymentStatus[]>([]);
  const [lastUsedPaymentMethod, setLastUsedPaymentMethod] = useState('cash');

  const showSuccess = () => {
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  const showError = (msg: string) => {
    setSyncError(msg);
    setTimeout(() => setSyncError(null), 5000);
  };

  // Auth Listener & Realtime Subscription
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    // Realtime Subscription
    const channel = supabase
      .channel('db_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'expenses' }, () => loadData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'incomes' }, () => loadData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cards' }, () => loadData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'categories' }, () => loadData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'card_payments' }, () => loadData())
      .subscribe();

    return () => {
      subscription.unsubscribe();
      supabase.removeChannel(channel);
    };
  }, []);

  // --- BUSCA DE DADOS (Snake to Camel) ---
  const loadData = useCallback(async () => {
    if (!user) return;
    // setLoading(true); // Removido para evitar flicker no realtime
    try {
      const [dbCards, dbCats, dbIncs, dbExps, dbPays] = await Promise.all([
        supabase.from('cards').select('*').eq('user_id', user.id),
        supabase.from('categories').select('*').eq('user_id', user.id),
        supabase.from('incomes').select('*').eq('user_id', user.id),
        supabase.from('expenses').select('*').eq('user_id', user.id),
        supabase.from('card_payments').select('*').eq('user_id', user.id)
      ]);

      if (dbCards.error) throw dbCards.error;
      if (dbCats.error) throw dbCats.error;
      if (dbIncs.error) throw dbIncs.error;
      if (dbExps.error) throw dbExps.error;
      if (dbPays.error) throw dbPays.error;

      if (dbCards.data) setCards(dbCards.data.map(c => ({
        id: c.id,
        name: c.name,
        closingDay: c.closing_day,
        dueDay: c.due_day,
        color: c.color
      })));

      if (dbCats.data) {
        setIncomeCategories(dbCats.data.filter(c => c.type === 'income').map(c => ({
          id: c.id,
          name: c.name,
          color: c.color,
          type: c.type
        })));
        setExpenseCategories(dbCats.data.filter(c => c.type === 'expense').map(c => ({
          id: c.id,
          name: c.name,
          color: c.color,
          type: c.type
        })));
      }

      if (dbIncs.data) setIncomes(dbIncs.data.map(i => ({
        id: i.id,
        title: i.title,
        categoryId: i.category_id,
        paymentMethod: i.payment_method,
        type: i.type,
        amount: i.amount,
        startMonth: i.start_month,
        durationMonths: i.duration_months,
        valueHistory: i.value_history
      })));

      if (dbExps.data) setExpenses(dbExps.data.map(e => ({
        id: e.id,
        title: e.title,
        categoryId: e.category_id,
        type: e.type,
        purchaseDate: e.purchase_date,
        billingMonth: e.billing_month,
        isInstallment: e.is_installment,
        totalValue: Number(e.total_value),
        installmentValue: Number(e.installment_value),
        paymentMethod: e.payment_method,
        isPaid: e.is_paid,
        originalId: e.original_id,
        valueHistory: e.value_history,
        createdAt: e.created_at,
        installments: e.installments_current ? { current: e.installments_current, total: e.installments_total } : undefined
      })));

      if (dbPays.data) setCardPayments(dbPays.data.map(p => ({
        cardId: p.card_id,
        monthYear: p.month_year,
        isPaid: p.is_paid
      })));
      
      setSyncError(null);
    } catch (err: any) {
      console.error('Erro ao carregar dados:', err);
      showError('Erro ao sincronizar dados. Verifique sua conexão.');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { if (user) loadData(); }, [user, loadData]);

  // --- GRAVAÇÃO DE DADOS (Camel to Snake) ---
  const addExpense = async (expense: Omit<Expense, 'id'>) => {
    if (!user) return;
    setIsSaving(true);
    try {
      const { error } = await supabase.from('expenses').insert({
        id: uuidv4(),
        user_id: user.id,
        title: expense.title,
        total_value: expense.totalValue,
        installment_value: expense.installmentValue,
        purchase_date: expense.purchaseDate,
        billing_month: expense.billingMonth,
        is_paid: expense.isPaid,
        is_installment: expense.isInstallment,
        category_id: expense.categoryId,
        payment_method: expense.paymentMethod,
        type: expense.type,
        value_history: expense.valueHistory || [],
        installments_current: expense.installments?.current,
        installments_total: expense.installments?.total
      });
      
      if (error) {
        console.error('Erro ao adicionar despesa:', error);
        showError('Falha ao salvar despesa: ' + error.message);
        throw error;
      }
      
      await loadData(); 
      showSuccess();
    } catch (err) {
      // Já tratado acima
    } finally {
      setIsSaving(false);
    }
  };

  const addInstallmentExpense = async (
    baseExpense: Omit<Expense, 'id' | 'installments' | 'billingMonth' | 'type'>,
    startBillingMonth: string,
    totalInstallments: number
  ) => {
    if (!user) return;
    setIsSaving(true);
    try {
      const newExpenses = [];
      const originalId = uuidv4();
      const startDate = parseISO(`${startBillingMonth}-01`);

      for (let i = 0; i < totalInstallments; i++) {
        const billingDate = addMonths(startDate, i);
        const billingMonth = format(billingDate, 'yyyy-MM');
        
        newExpenses.push({
          id: uuidv4(),
          user_id: user.id,
          title: baseExpense.title,
          category_id: baseExpense.categoryId,
          payment_method: baseExpense.paymentMethod,
          type: 'installment',
          total_value: baseExpense.totalValue,
          installment_value: baseExpense.installmentValue,
          purchase_date: baseExpense.purchaseDate,
          billing_month: billingMonth,
          is_paid: false,
          is_installment: true,
          original_id: originalId,
          installments_current: i + 1,
          installments_total: totalInstallments,
          value_history: []
        });
      }

      const { error } = await supabase.from('expenses').insert(newExpenses);
      
      if (error) {
        console.error('Erro ao adicionar parcelas:', error);
        showError('Falha ao salvar parcelas: ' + error.message);
        throw error;
      }

      await loadData(); 
      showSuccess();
    } catch (err) {
      // Já tratado
    } finally {
      setIsSaving(false);
    }
  };

  const updateExpense = async (id: string, updates: Partial<Expense>) => {
    if (!user) return;
    setIsSaving(true);
    try {
      const mapped: any = {};
      if (updates.title !== undefined) mapped.title = updates.title;
      if (updates.categoryId !== undefined) mapped.category_id = updates.categoryId;
      if (updates.type !== undefined) mapped.type = updates.type;
      if (updates.purchaseDate !== undefined) mapped.purchase_date = updates.purchaseDate;
      if (updates.billingMonth !== undefined) mapped.billing_month = updates.billingMonth;
      if (updates.isInstallment !== undefined) mapped.is_installment = updates.isInstallment;
      if (updates.totalValue !== undefined) mapped.total_value = updates.totalValue;
      if (updates.installmentValue !== undefined) mapped.installment_value = updates.installmentValue;
      if (updates.paymentMethod !== undefined) mapped.payment_method = updates.paymentMethod;
      if (updates.isPaid !== undefined) mapped.is_paid = updates.isPaid;
      if (updates.valueHistory !== undefined) mapped.value_history = updates.valueHistory;
      if (updates.installments !== undefined) {
        mapped.installments_current = updates.installments.current;
        mapped.installments_total = updates.installments.total;
      }

      const { error } = await supabase.from('expenses').update(mapped).eq('id', id);
      if (!error) { await loadData(); showSuccess(); }
    } finally {
      setIsSaving(false);
    }
  };

  const deleteExpense = async (id: string) => {
    if (!user) return;
    setIsSaving(true);
    try {
      const { error } = await supabase.from('expenses').delete().eq('id', id);
      if (!error) { await loadData(); showSuccess(); }
    } finally {
      setIsSaving(false);
    }
  };

  const toggleExpensePaid = async (id: string) => {
    const expense = expenses.find(e => e.id === id);
    if (!expense) return;
    await updateExpense(id, { isPaid: !expense.isPaid });
  };

  const updateFixedExpenseValue = async (id: string, monthYear: string, newValue: number, newPaymentMethod?: string) => {
    const expense = expenses.find(e => e.id === id);
    if (!expense || expense.type !== 'fixed') return;
    const newHistory = [...(expense.valueHistory || []), { monthYear, value: newValue, paymentMethod: newPaymentMethod || expense.paymentMethod }]
      .sort((a, b) => a.monthYear.localeCompare(b.monthYear));
    const unique = newHistory.reduce((acc: any[], curr) => {
      const idx = acc.findIndex(h => h.monthYear === curr.monthYear);
      if (idx >= 0) acc[idx] = curr; else acc.push(curr);
      return acc;
    }, []);
    await updateExpense(id, { valueHistory: unique });
  };

  const addIncome = async (income: Omit<Income, 'id'>) => {
    if (!user) return;
    setIsSaving(true);
    try {
      const { error } = await supabase.from('incomes').insert({
        id: uuidv4(),
        user_id: user.id,
        title: income.title,
        category_id: income.categoryId,
        payment_method: income.paymentMethod,
        type: income.type,
        amount: income.amount,
        start_month: income.startMonth,
        duration_months: income.durationMonths,
        value_history: income.valueHistory || []
      });
      if (!error) { await loadData(); showSuccess(); }
    } finally {
      setIsSaving(false);
    }
  };

  const updateIncome = async (id: string, updates: Partial<Income>) => {
    if (!user) return;
    setIsSaving(true);
    try {
      const mapped: any = {};
      if (updates.title !== undefined) mapped.title = updates.title;
      if (updates.categoryId !== undefined) mapped.category_id = updates.categoryId;
      if (updates.paymentMethod !== undefined) mapped.payment_method = updates.paymentMethod;
      if (updates.type !== undefined) mapped.type = updates.type;
      if (updates.amount !== undefined) mapped.amount = updates.amount;
      if (updates.startMonth !== undefined) mapped.start_month = updates.startMonth;
      if (updates.durationMonths !== undefined) mapped.duration_months = updates.durationMonths;
      if (updates.valueHistory !== undefined) mapped.value_history = updates.valueHistory;

      const { error } = await supabase.from('incomes').update(mapped).eq('id', id);
      if (!error) { await loadData(); showSuccess(); }
    } finally {
      setIsSaving(false);
    }
  };

  const deleteIncome = async (id: string) => {
    if (!user) return;
    setIsSaving(true);
    try {
      const { error } = await supabase.from('incomes').delete().eq('id', id);
      if (!error) { await loadData(); showSuccess(); }
    } finally {
      setIsSaving(false);
    }
  };

  const updateFixedIncomeValue = async (id: string, monthYear: string, newValue: number, paymentMethod?: string) => {
    const income = incomes.find(i => i.id === id);
    if (!income || income.type !== 'fixed') return;
    const newHistory = [...(income.valueHistory || []), { monthYear, value: newValue, paymentMethod }]
      .sort((a, b) => a.monthYear.localeCompare(b.monthYear));
    const unique = newHistory.reduce((acc: any[], curr) => {
      const idx = acc.findIndex(h => h.monthYear === curr.monthYear);
      if (idx >= 0) acc[idx] = curr; else acc.push(curr);
      return acc;
    }, []);
    await updateIncome(id, { valueHistory: unique });
  };

  const addCard = async (card: Omit<CreditCard, 'id'>) => {
    if (!user) return;
    setIsSaving(true);
    try {
      const { error } = await supabase.from('cards').insert({
        id: uuidv4(),
        user_id: user.id,
        name: card.name,
        color: card.color,
        due_day: card.dueDay,
        closing_day: card.closingDay
      });
      if (!error) { await loadData(); showSuccess(); }
    } finally {
      setIsSaving(false);
    }
  };

  const updateCard = async (id: string, updates: Partial<CreditCard>) => {
    if (!user) return;
    setIsSaving(true);
    try {
      const mapped: any = {};
      if (updates.name !== undefined) mapped.name = updates.name;
      if (updates.color !== undefined) mapped.color = updates.color;
      if (updates.dueDay !== undefined) mapped.due_day = updates.dueDay;
      if (updates.closingDay !== undefined) mapped.closing_day = updates.closingDay;

      const { error } = await supabase.from('cards').update(mapped).eq('id', id);
      if (!error) { await loadData(); showSuccess(); }
    } finally {
      setIsSaving(false);
    }
  };

  const deleteCard = async (id: string) => {
    if (!user) return;
    setIsSaving(true);
    try {
      const { error } = await supabase.from('cards').delete().eq('id', id);
      if (!error) { await loadData(); showSuccess(); }
    } finally {
      setIsSaving(false);
    }
  };

  const toggleCardPaid = async (cardId: string, monthYear: string) => {
    if (!user) return;
    setIsSaving(true);
    try {
      const exists = cardPayments.find(p => p.cardId === cardId && p.monthYear === monthYear);
      if (exists) {
        const { error } = await supabase.from('card_payments').update({ is_paid: !exists.isPaid }).eq('card_id', cardId).eq('month_year', monthYear);
        if (!error) await loadData();
      } else {
        const { error } = await supabase.from('card_payments').insert({ user_id: user.id, card_id: cardId, month_year: monthYear, is_paid: true });
        if (!error) await loadData();
      }
      showSuccess();
    } finally {
      setIsSaving(false);
    }
  };

  const addCategory = async (category: Omit<Category, 'id'>) => {
    if (!user) return;
    setIsSaving(true);
    try {
      const { error } = await supabase.from('categories').insert({
        id: uuidv4(),
        user_id: user.id,
        name: category.name,
        color: category.color,
        type: category.type
      });
      if (!error) { await loadData(); showSuccess(); }
    } finally {
      setIsSaving(false);
    }
  };

  const updateCategory = async (id: string, updates: Partial<Category>) => {
    if (!user) return;
    setIsSaving(true);
    try {
      const mapped: any = {};
      if (updates.name !== undefined) mapped.name = updates.name;
      if (updates.color !== undefined) mapped.color = updates.color;
      if (updates.type !== undefined) mapped.type = updates.type;

      const { error } = await supabase.from('categories').update(mapped).eq('id', id);
      if (!error) { await loadData(); showSuccess(); }
    } finally {
      setIsSaving(false);
    }
  };

  const deleteCategory = async (id: string) => {
    if (!user) return;
    setIsSaving(true);
    try {
      const { error } = await supabase.from('categories').delete().eq('id', id);
      if (!error) { await loadData(); showSuccess(); }
    } finally {
      setIsSaving(false);
    }
  };

  const getIncomeValueForMonth = (income: Income, monthYear: string): number => {
    if (income.type === 'temporary') {
      if (!income.startMonth || !income.durationMonths) return 0;
      const start = income.startMonth;
      const end = format(addMonths(parseISO(`${start}-01`), income.durationMonths - 1), 'yyyy-MM');
      return (monthYear >= start && monthYear <= end) ? (income.amount || 0) : 0;
    }
    const history = income.valueHistory || [];
    if (history.length === 0) return 0;
    const applicable = history.filter(h => h.monthYear <= monthYear).sort((a, b) => b.monthYear.localeCompare(a.monthYear))[0];
    return applicable ? applicable.value : history[0].value;
  };

  const getExpenseValueForMonth = (expense: Expense, monthYear: string): { value: number; paymentMethod: string } => {
    if (expense.type === 'fixed') {
      const history = expense.valueHistory || [];
      if (history.length === 0) return { value: 0, paymentMethod: expense.paymentMethod };
      const applicable = history.filter(h => h.monthYear <= monthYear).sort((a, b) => b.monthYear.localeCompare(a.monthYear))[0];
      return applicable ? { value: applicable.value, paymentMethod: applicable.paymentMethod || expense.paymentMethod } : { value: history[0].value, paymentMethod: history[0].paymentMethod || expense.paymentMethod };
    }
    return expense.billingMonth === monthYear ? { value: expense.installmentValue, paymentMethod: expense.paymentMethod } : { value: 0, paymentMethod: expense.paymentMethod };
  };

  const value = {
    user, loading, isSaving, saveSuccess, expenses, incomes, expenseCategories, incomeCategories, cards, cardPayments,
    lastUsedPaymentMethod, setLastUsedPaymentMethod, loadData,
    addExpense, addInstallmentExpense, updateExpense, deleteExpense, toggleExpensePaid, updateFixedExpenseValue,
    addIncome, updateIncome, deleteIncome, updateFixedIncomeValue,
    addCard, updateCard, deleteCard, toggleCardPaid,
    addCategory, updateCategory, deleteCategory,
    getIncomeValueForMonth, getExpenseValueForMonth
  };

  return (
    <FinanceContext.Provider value={value}>
      {children}
      <AnimatePresence>
        {isSaving && (
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }} 
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-md"
          >
            <div className="bg-zinc-900 border border-zinc-800 p-8 rounded-3xl text-center space-y-4 shadow-2xl">
              <div className="w-12 h-12 border-4 border-yellow-500/20 border-t-yellow-500 rounded-full animate-spin mx-auto" />
              <p className="text-zinc-100 font-bold">⚠️ Sincronizando com a nuvem...</p>
            </div>
          </motion.div>
        )}
        {syncError && (
          <motion.div 
            initial={{ opacity: 0, y: 50 }} 
            animate={{ opacity: 1, y: 0 }} 
            exit={{ opacity: 0, y: 50 }} 
            className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[100] bg-red-500 text-white px-6 py-3 rounded-full shadow-xl flex items-center gap-3 font-medium"
          >
            ❌ {syncError}
          </motion.div>
        )}
      </AnimatePresence>
    </FinanceContext.Provider>
  );
};

export const useFinance = () => {
  const context = useContext(FinanceContext);
  if (!context) throw new Error('useFinance must be used within a FinanceProvider');
  return context;
};
