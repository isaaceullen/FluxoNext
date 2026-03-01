import { useState, useEffect, useCallback, createContext, useContext, ReactNode } from 'react';
import { Income, Expense, Category, CreditCard, CardPaymentStatus } from '../types';
import { v4 as uuidv4 } from 'uuid';
import { supabase } from '../lib/supabase';
import { User } from '@supabase/supabase-js';
import { addMonths, format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
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

  // Auxiliar para mostrar sucesso
  const showSuccess = () => {
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  // 1. Monitorar Autenticação
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

  // 2. Buscar Dados (Tradução Snake -> Camel)
  const fetchData = useCallback(async () => {
    if (!user) return;
    try {
      const [dbExp, dbInc, dbCat, dbCrd, dbPay] = await Promise.all([
        supabase.from('expenses').select('*').eq('user_id', user.id),
        supabase.from('incomes').select('*').eq('user_id', user.id),
        supabase.from('categories').select('*').eq('user_id', user.id),
        supabase.from('cards').select('*').eq('user_id', user.id),
        supabase.from('card_payments').select('*').eq('user_id', user.id)
      ]);

      if (dbExp.data) setExpenses(dbExp.data.map(e => ({
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

      if (dbInc.data) setIncomes(dbInc.data.map(i => ({
        ...i,
        categoryId: i.category_id,
        paymentMethod: i.payment_method,
        valueHistory: i.value_history,
        startMonth: i.start_month,
        durationMonths: i.duration_months
      })));

      if (dbCat.data) {
        setIncomeCategories(dbCat.data.filter(c => c.type === 'income'));
        setExpenseCategories(dbCat.data.filter(c => c.type === 'expense'));
      }

      if (dbCrd.data) setCards(dbCrd.data.map(c => ({
        ...c,
        closingDay: c.closing_day,
        dueDay: c.due_day
      })));

      if (dbPay.data) setCardPayments(dbPay.data.map(p => ({
        ...p,
        cardId: p.card_id,
        monthYear: p.month_year,
        isPaid: p.is_paid
      })));

    } catch (err) {
      console.error("Erro ao carregar dados:", err);
    }
  }, [user]);

  useEffect(() => { if (user) fetchData(); }, [user, fetchData]);

  // 3. Funções de Escrita (Tradução Camel -> Snake)
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
      value_history: expense.valueHistory || []
    });
    if (!error) { fetchData(); showSuccess(); }
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
    if (!error) { fetchData(); showSuccess(); }
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
    if (!error) { fetchData(); showSuccess(); }
    setIsSaving(false);
  };

  const addIncome = async (income: Omit<Income, 'id'>) => {
    if (!user) return;
    setIsSaving(true);
    const id = uuidv4();
    const { error } = await supabase.from('incomes').insert({
      id,
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
    if (!error) { fetchData(); showSuccess(); }
    setIsSaving(false);
  };

  const addInstallmentExpense = async (
    baseExpense: Omit<Expense, 'id' | 'installments' | 'billingMonth' | 'type'>,
    startBillingMonth: string,
    totalInstallments: number
  ) => {
    if (!user) return;
    setIsSaving(true);
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
    if (!error) { fetchData(); showSuccess(); }
    setIsSaving(false);
  };

  const updateExpense = async (id: string, updates: Partial<Expense>) => {
    if (!user) return;
    setIsSaving(true);
    const mappedUpdates: any = {};
    if (updates.title !== undefined) mappedUpdates.title = updates.title;
    if (updates.totalValue !== undefined) mappedUpdates.total_value = updates.totalValue;
    if (updates.installmentValue !== undefined) mappedUpdates.installment_value = updates.installmentValue;
    if (updates.purchaseDate !== undefined) mappedUpdates.purchase_date = updates.purchaseDate;
    if (updates.billingMonth !== undefined) mappedUpdates.billing_month = updates.billingMonth;
    if (updates.isPaid !== undefined) mappedUpdates.is_paid = updates.isPaid;
    if (updates.isInstallment !== undefined) mappedUpdates.is_installment = updates.isInstallment;
    if (updates.categoryId !== undefined) mappedUpdates.category_id = updates.categoryId;
    if (updates.paymentMethod !== undefined) mappedUpdates.payment_method = updates.paymentMethod;
    if (updates.type !== undefined) mappedUpdates.type = updates.type;
    if (updates.valueHistory !== undefined) mappedUpdates.value_history = updates.valueHistory;
    if (updates.installments !== undefined) {
      mappedUpdates.installments_current = updates.installments.current;
      mappedUpdates.installments_total = updates.installments.total;
    }

    const { error } = await supabase.from('expenses').update(mappedUpdates).eq('id', id);
    if (!error) { fetchData(); showSuccess(); }
    setIsSaving(false);
  };

  const deleteExpense = async (id: string) => {
    if (!user) return;
    setIsSaving(true);
    const { error } = await supabase.from('expenses').delete().eq('id', id);
    if (!error) { fetchData(); showSuccess(); }
    setIsSaving(false);
  };

  const toggleExpensePaid = async (id: string) => {
    const expense = expenses.find(e => e.id === id);
    if (!expense) return;
    await updateExpense(id, { isPaid: !expense.isPaid });
  };

  const updateFixedExpenseValue = async (id: string, monthYear: string, newValue: number, newPaymentMethod?: string) => {
    const expense = expenses.find(e => e.id === id);
    if (!expense || expense.type !== 'fixed') return;

    const newHistory = [
      ...(expense.valueHistory || []),
      { monthYear, value: newValue, paymentMethod: newPaymentMethod || expense.paymentMethod }
    ].sort((a, b) => a.monthYear.localeCompare(b.monthYear));

    const uniqueHistory = newHistory.reduce((acc: any[], curr) => {
      const idx = acc.findIndex(h => h.monthYear === curr.monthYear);
      if (idx >= 0) acc[idx] = curr;
      else acc.push(curr);
      return acc;
    }, []);

    await updateExpense(id, { valueHistory: uniqueHistory });
  };

  const updateIncome = async (id: string, updates: Partial<Income>) => {
    if (!user) return;
    setIsSaving(true);
    const mappedUpdates: any = {};
    if (updates.title !== undefined) mappedUpdates.title = updates.title;
    if (updates.categoryId !== undefined) mappedUpdates.category_id = updates.categoryId;
    if (updates.paymentMethod !== undefined) mappedUpdates.payment_method = updates.paymentMethod;
    if (updates.type !== undefined) mappedUpdates.type = updates.type;
    if (updates.amount !== undefined) mappedUpdates.amount = updates.amount;
    if (updates.startMonth !== undefined) mappedUpdates.start_month = updates.startMonth;
    if (updates.durationMonths !== undefined) mappedUpdates.duration_months = updates.durationMonths;
    if (updates.valueHistory !== undefined) mappedUpdates.value_history = updates.valueHistory;

    const { error } = await supabase.from('incomes').update(mappedUpdates).eq('id', id);
    if (!error) { fetchData(); showSuccess(); }
    setIsSaving(false);
  };

  const deleteIncome = async (id: string) => {
    if (!user) return;
    setIsSaving(true);
    const { error } = await supabase.from('incomes').delete().eq('id', id);
    if (!error) { fetchData(); showSuccess(); }
    setIsSaving(false);
  };

  const updateFixedIncomeValue = async (id: string, monthYear: string, newValue: number, paymentMethod?: string) => {
    const income = incomes.find(i => i.id === id);
    if (!income || income.type !== 'fixed') return;

    const newHistory = [
      ...(income.valueHistory || []),
      { monthYear, value: newValue, paymentMethod }
    ].sort((a, b) => a.monthYear.localeCompare(b.monthYear));

    const uniqueHistory = newHistory.reduce((acc: any[], curr) => {
      const idx = acc.findIndex(h => h.monthYear === curr.monthYear);
      if (idx >= 0) acc[idx] = curr;
      else acc.push(curr);
      return acc;
    }, []);

    await updateIncome(id, { valueHistory: uniqueHistory });
  };

  const updateCard = async (id: string, updates: Partial<CreditCard>) => {
    if (!user) return;
    setIsSaving(true);
    const mappedUpdates: any = {};
    if (updates.name !== undefined) mappedUpdates.name = updates.name;
    if (updates.color !== undefined) mappedUpdates.color = updates.color;
    if (updates.dueDay !== undefined) mappedUpdates.due_day = updates.dueDay;
    if (updates.closingDay !== undefined) mappedUpdates.closing_day = updates.closingDay;

    const { error } = await supabase.from('cards').update(mappedUpdates).eq('id', id);
    if (!error) { fetchData(); showSuccess(); }
    setIsSaving(false);
  };

  const deleteCard = async (id: string) => {
    if (!user) return;
    setIsSaving(true);
    const { error } = await supabase.from('cards').delete().eq('id', id);
    if (!error) { fetchData(); showSuccess(); }
    setIsSaving(false);
  };

  const toggleCardPaid = async (cardId: string, monthYear: string) => {
    if (!user) return;
    setIsSaving(true);
    const exists = cardPayments.find(p => p.cardId === cardId && p.monthYear === monthYear);
    
    if (exists) {
      const { error } = await supabase.from('card_payments')
        .update({ is_paid: !exists.isPaid })
        .eq('card_id', cardId)
        .eq('month_year', monthYear);
      if (!error) fetchData();
    } else {
      const { error } = await supabase.from('card_payments').insert({
        user_id: user.id,
        card_id: cardId,
        month_year: monthYear,
        is_paid: true
      });
      if (!error) fetchData();
    }
    setIsSaving(false);
    showSuccess();
  };

  const updateCategory = async (id: string, updates: Partial<Category>) => {
    if (!user) return;
    setIsSaving(true);
    const { error } = await supabase.from('categories').update(updates).eq('id', id);
    if (!error) { fetchData(); showSuccess(); }
    setIsSaving(false);
  };

  const deleteCategory = async (id: string) => {
    if (!user) return;
    setIsSaving(true);
    const { error } = await supabase.from('categories').delete().eq('id', id);
    if (!error) { fetchData(); showSuccess(); }
    setIsSaving(false);
  };

  const getIncomeValueForMonth = (income: Income, monthYear: string): number => {
    if (income.type === 'temporary') {
      if (!income.startMonth || !income.durationMonths) return 0;
      const start = income.startMonth;
      const end = format(addMonths(parseISO(`${start}-01`), income.durationMonths - 1), 'yyyy-MM');
      if (monthYear >= start && monthYear <= end) {
        return income.amount || 0;
      }
      return 0;
    } else {
      if (!income.valueHistory || income.valueHistory.length === 0) return 0;
      const applicable = income.valueHistory
        .filter(h => h.monthYear <= monthYear)
        .sort((a, b) => b.monthYear.localeCompare(a.monthYear))[0];
      return applicable ? applicable.value : income.valueHistory[0].value;
    }
  };

  const getExpenseValueForMonth = (expense: Expense, monthYear: string): { value: number; paymentMethod: string } => {
    if (expense.type === 'fixed') {
      if (!expense.valueHistory || expense.valueHistory.length === 0) return { value: 0, paymentMethod: expense.paymentMethod };
      const applicable = expense.valueHistory
        .filter(h => h.monthYear <= monthYear)
        .sort((a, b) => b.monthYear.localeCompare(a.monthYear))[0];
      return applicable 
        ? { value: applicable.value, paymentMethod: applicable.paymentMethod || expense.paymentMethod }
        : { value: expense.valueHistory[0].value, paymentMethod: expense.valueHistory[0].paymentMethod || expense.paymentMethod };
    } else {
      if (expense.billingMonth === monthYear) {
        return { value: expense.installmentValue, paymentMethod: expense.paymentMethod };
      }
      return { value: 0, paymentMethod: expense.paymentMethod };
    }
  };

  return {
    user, loading, isSaving, saveSuccess, expenses, incomes, expenseCategories, incomeCategories, cards, cardPayments,
    addExpense, addInstallmentExpense, updateExpense, deleteExpense, toggleExpensePaid, updateFixedExpenseValue,
    addIncome, updateIncome, deleteIncome, updateFixedIncomeValue,
    addCard, updateCard, deleteCard, toggleCardPaid,
    addCategory, updateCategory, deleteCategory,
    getIncomeValueForMonth, getExpenseValueForMonth,
    setLastUsedPaymentMethod, lastUsedPaymentMethod
  };
};

// Context e Provider permanecem como no teu arquivo atual
const FinanceContext = createContext<ReturnType<typeof useFinanceLogic> | undefined>(undefined);
export const FinanceProvider = ({ children }: { children: ReactNode }) => {
  const financeData = useFinanceLogic();
  
  return (
    <FinanceContext.Provider value={financeData}>
      {children}
      
      {/* Saving Overlay */}
      <AnimatePresence>
        {financeData.isSaving && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-md"
          >
            <div className="bg-zinc-900 border border-zinc-800 p-8 rounded-3xl shadow-2xl max-w-md text-center space-y-6">
              <div className="relative">
                <div className="w-16 h-16 border-4 border-yellow-500/20 border-t-yellow-500 rounded-full animate-spin mx-auto" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse" />
                </div>
              </div>
              <div className="space-y-2">
                <p className="text-zinc-100 text-lg font-bold">
                  ⚠️ Sincronizando com a nuvem...
                </p>
                <p className="text-zinc-400 text-sm leading-relaxed">
                  Por favor, não feche ou atualize a página para evitar perda de dados.
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Success Toast */}
      <AnimatePresence>
        {financeData.saveSuccess && (
          <motion.div 
            initial={{ opacity: 0, y: -50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -50 }}
            className="fixed top-8 left-1/2 -translate-x-1/2 z-[9999]"
          >
            <div className="bg-emerald-500 text-black px-8 py-4 rounded-2xl shadow-2xl font-bold flex items-center gap-3 border-2 border-emerald-400/50">
              <div className="w-6 h-6 bg-black/10 rounded-full flex items-center justify-center">
                <span className="text-sm">✓</span>
              </div>
              <span className="text-lg">Sincronização concluída!</span>
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