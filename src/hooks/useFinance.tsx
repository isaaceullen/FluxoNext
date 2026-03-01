import { useState, useEffect, useCallback, createContext, useContext, ReactNode } from 'react';
import { Income, Expense, Category, CreditCard, CardPaymentStatus } from '../types';
import { v4 as uuidv4 } from 'uuid';
import { supabase } from '../lib/supabase';
import { User } from '@supabase/supabase-js';
import { motion, AnimatePresence } from 'motion/react';

const useFinanceLogic = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

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

  // 1. Auth Listener
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  // 2. Load Data with Mapping (Snake to Camel)
  const loadDataFromCloud = useCallback(async () => {
    if (!user) return;
    try {
      const [dbCards, dbCategories, dbIncomes, dbExpenses, dbCardPayments] = await Promise.all([
        supabase.from('cards').select('*').eq('user_id', user.id),
        supabase.from('categories').select('*').eq('user_id', user.id),
        supabase.from('incomes').select('*').eq('user_id', user.id),
        supabase.from('expenses').select('*').eq('user_id', user.id),
        supabase.from('card_payments').select('*').eq('user_id', user.id)
      ]);

      if (dbCards.data) setCards(dbCards.data.map(c => ({
        ...c,
        closingDay: c.closing_day,
        dueDay: c.due_day
      })));

      if (dbCategories.data) {
        setIncomeCategories(dbCategories.data.filter(c => c.type === 'income'));
        setExpenseCategories(dbCategories.data.filter(c => c.type === 'expense'));
      }

      if (dbIncomes.data) setIncomes(dbIncomes.data.map(i => ({
        ...i,
        categoryId: i.category_id,
        paymentMethod: i.payment_method,
        startMonth: i.start_month,
        durationMonths: i.duration_months,
        valueHistory: i.value_history
      })));

      if (dbExpenses.data) setExpenses(dbExpenses.data.map(e => ({
        ...e,
        categoryId: e.category_id,
        paymentMethod: e.payment_method,
        totalValue: Number(e.total_value),
        installmentValue: Number(e.installment_value),
        purchaseDate: e.purchase_date,
        billingMonth: e.billing_month,
        isInstallment: e.is_installment,
        isPaid: e.is_paid,
        valueHistory: e.value_history,
        installments: e.installments_current ? { current: e.installments_current, total: e.installments_total } : undefined
      })));

      if (dbCardPayments.data) setCardPayments(dbCardPayments.data.map(p => ({
        ...p,
        cardId: p.card_id,
        monthYear: p.month_year,
        isPaid: p.is_paid
      })));

    } catch (err) {
      console.error('Erro ao carregar dados:', err);
    }
  }, [user]);

  useEffect(() => { if (user) loadDataFromCloud(); }, [user, loadDataFromCloud]);

  // 3. Functions with Mapping (Camel to Snake)
  const addExpense = async (expense: Omit<Expense, 'id'>) => {
    if (!user) return;
    setIsSaving(true);
    const id = uuidv4();
    const { error } = await supabase.from('expenses').insert({
      id,
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
    if (!error) { await loadDataFromCloud(); showSuccess(); }
    setIsSaving(false);
  };

  const addCategory = async (category: Omit<Category, 'id'>) => {
    if (!user) return;
    setIsSaving(true);
    const id = uuidv4();
    const { error } = await supabase.from('categories').insert({
      id,
      user_id: user.id,
      name: category.name,
      color: category.color,
      type: category.type
    });
    if (!error) { await loadDataFromCloud(); showSuccess(); }
    setIsSaving(false);
  };

  const addCard = async (card: Omit<CreditCard, 'id'>) => {
    if (!user) return;
    setIsSaving(true);
    const id = uuidv4();
    const { error } = await supabase.from('cards').insert({
      id,
      user_id: user.id,
      name: card.name,
      color: card.color,
      due_day: card.dueDay,
      closing_day: card.closingDay
    });
    if (!error) { await loadDataFromCloud(); showSuccess(); }
    setIsSaving(false);
  };

  const deleteExpense = async (id: string) => {
    if (!user) return;
    setIsSaving(true);
    const { error } = await supabase.from('expenses').delete().eq('id', id);
    if (!error) { setExpenses(prev => prev.filter(e => e.id !== id)); showSuccess(); }
    setIsSaving(false);
  };

  // Helper getters (remain same)
  const getExpenseValueForMonth = (expense: Expense, monthYear: string) => {
    if (expense.type === 'fixed') {
      const history = expense.valueHistory || [];
      const applicable = history.filter(h => h.monthYear <= monthYear).sort((a, b) => b.monthYear.localeCompare(a.monthYear))[0];
      return applicable ? { value: applicable.value, paymentMethod: applicable.paymentMethod || expense.paymentMethod } : { value: 0, paymentMethod: expense.paymentMethod };
    }
    return expense.billingMonth === monthYear ? { value: expense.installmentValue, paymentMethod: expense.paymentMethod } : { value: 0, paymentMethod: expense.paymentMethod };
  };

  return {
    user, loading, isSaving, saveSuccess, expenses, incomes, expenseCategories, incomeCategories, cards, cardPayments,
    addExpense, addCategory, addCard, deleteExpense, getExpenseValueForMonth, setLastUsedPaymentMethod, lastUsedPaymentMethod
  };
};

const FinanceContext = createContext<ReturnType<typeof useFinanceLogic> | undefined>(undefined);

export const FinanceProvider = ({ children }: { children: ReactNode }) => {
  const financeData = useFinanceLogic();
  return (
    <FinanceContext.Provider value={financeData}>
      {children}
      <AnimatePresence>
        {financeData.isSaving && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-md">
            <div className="bg-zinc-900 border border-zinc-800 p-8 rounded-3xl shadow-2xl text-center space-y-6">
              <div className="w-16 h-16 border-4 border-yellow-500/20 border-t-yellow-500 rounded-full animate-spin mx-auto" />
              <p className="text-zinc-100 text-lg font-bold">⚠️ Sincronizando com a nuvem...</p>
            </div>
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