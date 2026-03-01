import React, { useState, useEffect, useCallback, createContext, useContext, ReactNode } from 'react';
import { Income, Expense, Category, CreditCard, CardPaymentStatus } from '../types';
import { v4 as uuidv4 } from 'uuid';
import { addMonths, format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { supabase } from '../lib/supabase';
import { User } from '@supabase/supabase-js';
import { motion, AnimatePresence } from 'motion/react';

const STORAGE_KEY = 'fluxonext_data_v2';

interface FinanceData {
  incomes: Income[];
  expenses: Expense[];
  incomeCategories: Category[];
  expenseCategories: Category[];
  cards: CreditCard[];
  cardPayments: CardPaymentStatus[];
  lastUsedPaymentMethod: string;
  lastUpdated?: string; // ISO string
}

const useFinanceLogic = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const [incomes, setIncomes] = useState<Income[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [incomeCategories, setIncomeCategories] = useState<Category[]>([]);
  const [expenseCategories, setExpenseCategories] = useState<Category[]>([]);
  const [cards, setCards] = useState<CreditCard[]>([]);
  const [cardPayments, setCardPayments] = useState<CardPaymentStatus[]>([]);
  const [lastUsedPaymentMethod, setLastUsedPaymentMethodState] = useState('cash');

  // Load from localStorage on init
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      setIncomes(parsed.incomes || []);
      setExpenses(parsed.expenses || []);
      setIncomeCategories(parsed.incomeCategories || []);
      setExpenseCategories(parsed.expenseCategories || []);
      setCards(parsed.cards || []);
      setCardPayments(parsed.cardPayments || []);
      setLastUsedPaymentMethodState(parsed.lastUsedPaymentMethod || 'cash');
    }
  }, []);

  // Persist to localStorage whenever state changes
  useEffect(() => {
    const dataToStore = {
      incomes,
      expenses,
      incomeCategories,
      expenseCategories,
      cards,
      cardPayments,
      lastUsedPaymentMethod,
      lastUpdated: new Date().toISOString()
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(dataToStore));
  }, [incomes, expenses, incomeCategories, expenseCategories, cards, cardPayments, lastUsedPaymentMethod]);

  const showSuccess = () => {
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  const MIGRATION_FLAG = 'migration_complete_v2';

  // Auth listener
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

  const migrateDataFromJSON = async (userId: string, oldData: FinanceData) => {
    setIsSaving(true);
    try {
      console.log('Migrando dados do formato JSON para tabelas relacionais...');
      
      // Migrate Cards (Ensuring ID preservation)
      if (oldData.cards && oldData.cards.length > 0) {
        await supabase.from('cards').upsert(oldData.cards.map(c => ({ 
          id: c.id, // Preserve ID
          name: c.name,
          closingDay: c.closingDay,
          dueDay: c.dueDay,
          color: c.color,
          user_id: userId 
        })));
      }
      
      // Migrate Categories (Ensuring ID preservation)
      const allCategories = [...(oldData.incomeCategories || []), ...(oldData.expenseCategories || [])];
      if (allCategories.length > 0) {
        await supabase.from('categories').upsert(allCategories.map(c => ({ 
          id: c.id, // Preserve ID
          name: c.name,
          color: c.color,
          type: c.type,
          user_id: userId 
        })));
      }
      
      // Migrate Incomes (Ensuring ID preservation)
      if (oldData.incomes && oldData.incomes.length > 0) {
        await supabase.from('incomes').upsert(oldData.incomes.map(i => ({ 
          ...i, // Spreading preserves all fields including ID
          user_id: userId 
        })));
      }
      
      // Migrate Expenses (Ensuring ID preservation)
      if (oldData.expenses && oldData.expenses.length > 0) {
        await supabase.from('expenses').upsert(oldData.expenses.map(e => ({ 
          ...e, // Spreading preserves all fields including ID
          user_id: userId 
        })));
      }
      
      // Migrate Card Payments (Ensuring ID preservation)
      if (oldData.cardPayments && oldData.cardPayments.length > 0) {
        await supabase.from('card_payments').upsert(oldData.cardPayments.map(p => ({ 
          ...p, // Spreading preserves all fields including ID
          user_id: userId 
        })));
      }

      // After successful migration, delete old data
      await supabase.from('user_finance').delete().eq('user_id', userId);
      
      localStorage.setItem(MIGRATION_FLAG, 'true');
      console.log('Migração concluída com sucesso!');
      showSuccess();
      return true;
    } catch (err) {
      console.error('Erro na migração:', err);
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  const loadDataFromCloud = useCallback(async () => {
    if (!user) return;
    setSyncing(true);
    try {
      // 1. Check for migration (only if not already completed)
      const isMigrated = localStorage.getItem(MIGRATION_FLAG) === 'true';
      
      if (!isMigrated) {
        const { data: oldData } = await supabase
          .from('user_finance')
          .select('data')
          .eq('user_id', user.id)
          .single();
        
        if (oldData?.data) {
          const success = await migrateDataFromJSON(user.id, oldData.data as FinanceData);
          if (success) {
            // Migration done
          }
        } else {
          // No old data found, mark as migrated anyway to stop checking
          localStorage.setItem(MIGRATION_FLAG, 'true');
        }
      }

      // 2. Load from individual tables
      const [
        { data: dbCards },
        { data: dbCategories },
        { data: dbIncomes },
        { data: dbExpenses },
        { data: dbCardPayments }
      ] = await Promise.all([
        supabase.from('cards').select('*').eq('user_id', user.id),
        supabase.from('categories').select('*').eq('user_id', user.id),
        supabase.from('incomes').select('*').eq('user_id', user.id),
        supabase.from('expenses').select('*').eq('user_id', user.id),
        supabase.from('card_payments').select('*').eq('user_id', user.id)
      ]);

      if (dbCards) setCards(dbCards);
      if (dbCategories) {
        setIncomeCategories(dbCategories.filter(c => c.type === 'income'));
        setExpenseCategories(dbCategories.filter(c => c.type === 'expense'));
      }
      if (dbIncomes) setIncomes(dbIncomes);
      if (dbExpenses) setExpenses(dbExpenses);
      if (dbCardPayments) setCardPayments(dbCardPayments);

    } catch (err) {
      console.error('Erro ao carregar dados:', err);
    } finally {
      setSyncing(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      loadDataFromCloud();
    }
  }, [user, loadDataFromCloud]);

  // --- Expenses ---

  const addExpense = async (expense: Omit<Expense, 'id'>) => {
    const newExpense = { ...expense, id: uuidv4(), createdAt: new Date().toISOString() };
    setExpenses(prev => [...prev, newExpense]);
    
    if (user) {
      setIsSaving(true);
      const { error } = await supabase.from('expenses').insert({ ...newExpense, user_id: user.id });
      setIsSaving(false);
      if (!error) showSuccess();
    }
  };

  const addInstallmentExpense = async (
    baseExpense: Omit<Expense, 'id' | 'installments' | 'billingMonth' | 'type'>,
    startBillingMonth: string, // YYYY-MM
    totalInstallments: number
  ) => {
    const newExpenses: Expense[] = [];
    const originalId = uuidv4();
    const startDate = parseISO(`${startBillingMonth}-01`);
    const createdAt = new Date().toISOString();

    for (let i = 0; i < totalInstallments; i++) {
      const billingDate = addMonths(startDate, i);
      const billingMonth = format(billingDate, 'yyyy-MM');
      
      newExpenses.push({
        ...baseExpense,
        id: uuidv4(),
        type: 'installment',
        billingMonth,
        originalId,
        createdAt,
        installments: {
          current: i + 1,
          total: totalInstallments
        }
      });
    }

    setExpenses(prev => [...prev, ...newExpenses]);

    if (user) {
      setIsSaving(true);
      const { error } = await supabase.from('expenses').insert(newExpenses.map(e => ({ ...e, user_id: user.id })));
      setIsSaving(false);
      if (!error) showSuccess();
    }
  };

  const updateExpense = async (id: string, updates: Partial<Expense>, mode: 'only' | 'future' | 'all' = 'only') => {
    const expense = expenses.find(e => e.id === id);
    if (!expense) return;

    let updatedExpenses: Expense[] = [];
    let affectedIds: string[] = [];

    if (!expense.originalId || mode === 'only') {
      const updated = { ...expense, ...updates };
      updatedExpenses = [updated];
      affectedIds = [id];
      setExpenses(prev => prev.map(e => e.id === id ? updated : e));
    } else {
      const currentInstallment = expense.installments?.current || 1;
      setExpenses(prev => prev.map(e => {
        if (e.originalId === expense.originalId) {
          const isFuture = e.installments && e.installments.current >= currentInstallment;
          const isAll = mode === 'all';

          if (isAll || isFuture) {
            let newInstallmentValue = e.installmentValue;
            if (updates.totalValue !== undefined || (updates.installments && updates.installments.total !== undefined)) {
              const totalVal = updates.totalValue ?? e.totalValue;
              const totalInst = updates.installments?.total ?? e.installments?.total ?? 1;
              newInstallmentValue = totalVal / totalInst;
            }

            const updated = {
              ...e,
              ...updates,
              installmentValue: newInstallmentValue,
              installments: updates.installments ? { ...e.installments, total: updates.installments.total } : e.installments
            };
            updatedExpenses.push(updated);
            affectedIds.push(e.id);
            return updated;
          }
        }
        return e;
      }));
    }

    if (user && affectedIds.length > 0) {
      setIsSaving(true);
      // We use upsert for multiple updates
      const { error } = await supabase.from('expenses').upsert(updatedExpenses.map(e => ({ ...e, user_id: user.id })));
      setIsSaving(false);
      if (!error) showSuccess();
    }
  };

  const deleteExpense = async (id: string) => {
    setExpenses(prev => prev.filter(e => e.id !== id));
    if (user) {
      setIsSaving(true);
      const { error } = await supabase.from('expenses').delete().eq('id', id);
      setIsSaving(false);
      if (!error) showSuccess();
    }
  };

  const toggleExpensePaid = async (id: string) => {
    const expense = expenses.find(e => e.id === id);
    if (!expense) return;

    const newPaidStatus = !expense.isPaid;
    setExpenses(prev => prev.map(e => e.id === id ? { ...e, isPaid: newPaidStatus } : e));

    if (user) {
      setIsSaving(true);
      const { error } = await supabase.from('expenses').update({ isPaid: newPaidStatus }).eq('id', id);
      setIsSaving(false);
      if (!error) showSuccess();
    }
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

    setExpenses(prev => prev.map(exp => exp.id === id ? { ...exp, valueHistory: uniqueHistory } : exp));

    if (user) {
      setIsSaving(true);
      const { error } = await supabase.from('expenses').update({ valueHistory: uniqueHistory }).eq('id', id);
      setIsSaving(false);
      if (!error) showSuccess();
    }
  };

  const toggleCardPaid = async (cardId: string, monthYear: string) => {
    const exists = cardPayments.find(p => p.cardId === cardId && p.monthYear === monthYear);
    let newStatus: CardPaymentStatus;

    if (exists) {
      newStatus = { ...exists, isPaid: !exists.isPaid };
      setCardPayments(prev => prev.map(p => (p.cardId === cardId && p.monthYear === monthYear) ? newStatus : p));
    } else {
      newStatus = { cardId, monthYear, isPaid: true };
      setCardPayments(prev => [...prev, newStatus]);
    }

    if (user) {
      setIsSaving(true);
      const { error } = await supabase.from('card_payments').upsert({ ...newStatus, user_id: user.id });
      setIsSaving(false);
      if (!error) showSuccess();
    }
  };

  // --- Incomes ---

  const addIncome = async (income: Omit<Income, 'id'>) => {
    const newIncome = { ...income, id: uuidv4() };
    setIncomes(prev => [...prev, newIncome]);

    if (user) {
      setIsSaving(true);
      const { error } = await supabase.from('incomes').insert({ ...newIncome, user_id: user.id });
      setIsSaving(false);
      if (!error) showSuccess();
    }
  };

  const updateIncome = async (id: string, updates: Partial<Income>) => {
    setIncomes(prev => prev.map(i => i.id === id ? { ...i, ...updates } : i));

    if (user) {
      setIsSaving(true);
      const { error } = await supabase.from('incomes').update(updates).eq('id', id);
      setIsSaving(false);
      if (!error) showSuccess();
    }
  };

  const deleteIncome = async (id: string) => {
    setIncomes(prev => prev.filter(i => i.id !== id));

    if (user) {
      setIsSaving(true);
      const { error } = await supabase.from('incomes').delete().eq('id', id);
      setIsSaving(false);
      if (!error) showSuccess();
    }
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

    setIncomes(prev => prev.map(inc => inc.id === id ? { ...inc, valueHistory: uniqueHistory } : inc));

    if (user) {
      setIsSaving(true);
      const { error } = await supabase.from('incomes').update({ valueHistory: uniqueHistory }).eq('id', id);
      setIsSaving(false);
      if (!error) showSuccess();
    }
  };

  // --- Cards & Categories ---

  const addCard = async (card: Omit<CreditCard, 'id'>) => {
    const newCard = { ...card, id: uuidv4() };
    setCards(prev => [...prev, newCard]);

    if (user) {
      setIsSaving(true);
      const { error } = await supabase.from('cards').insert({ ...newCard, user_id: user.id });
      setIsSaving(false);
      if (!error) showSuccess();
    }
  };

  const updateCard = async (id: string, updates: Partial<CreditCard>) => {
    setCards(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c));

    if (user) {
      setIsSaving(true);
      const { error } = await supabase.from('cards').update(updates).eq('id', id);
      setIsSaving(false);
      if (!error) showSuccess();
    }
  };

  const deleteCard = async (id: string) => {
    setCards(prev => prev.filter(c => c.id !== id));

    if (user) {
      setIsSaving(true);
      const { error } = await supabase.from('cards').delete().eq('id', id);
      setIsSaving(false);
      if (!error) showSuccess();
    }
  };

  const addCategory = async (category: Omit<Category, 'id'>) => {
    const newCategory = { ...category, id: uuidv4() };
    const list = category.type === 'income' ? 'incomeCategories' : 'expenseCategories';
    
    if (category.type === 'income') setIncomeCategories(prev => [...prev, newCategory]);
    else setExpenseCategories(prev => [...prev, newCategory]);

    if (user) {
      setIsSaving(true);
      const { error } = await supabase.from('categories').insert({ ...newCategory, user_id: user.id });
      setIsSaving(false);
      if (!error) showSuccess();
    }
  };

  const updateCategory = async (id: string, updates: Partial<Category>) => {
    const isIncome = incomeCategories.some(c => c.id === id);
    if (isIncome) setIncomeCategories(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c));
    else setExpenseCategories(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c));

    if (user) {
      setIsSaving(true);
      const { error } = await supabase.from('categories').update(updates).eq('id', id);
      setIsSaving(false);
      if (!error) showSuccess();
    }
  };

  const deleteCategory = async (id: string) => {
    const isIncome = incomeCategories.some(c => c.id === id);
    if (isIncome) setIncomeCategories(prev => prev.filter(c => c.id !== id));
    else setExpenseCategories(prev => prev.filter(c => c.id !== id));

    if (user) {
      setIsSaving(true);
      const { error } = await supabase.from('categories').delete().eq('id', id);
      setIsSaving(false);
      if (!error) showSuccess();
    }
  };

  const setLastUsedPaymentMethod = (method: string) => {
    setLastUsedPaymentMethodState(method);
  };

  // --- Helpers ---

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
      // Fixed
      if (!income.valueHistory || income.valueHistory.length === 0) return 0;
      // Find latest history entry <= monthYear
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
      // one_time or installment
      if (expense.billingMonth === monthYear) {
        return { value: expense.installmentValue, paymentMethod: expense.paymentMethod };
      }
      return { value: 0, paymentMethod: expense.paymentMethod };
    }
  };

  return {
    user,
    loading,
    syncing,
    loadDataFromCloud,
    incomes,
    expenses,
    incomeCategories,
    expenseCategories,
    cards,
    cardPayments,
    addExpense,
    addInstallmentExpense,
    updateExpense,
    deleteExpense,
    toggleExpensePaid,
    updateFixedExpenseValue,
    toggleCardPaid,
    addIncome,
    updateIncome,
    deleteIncome,
    updateFixedIncomeValue,
    addCard,
    updateCard,
    deleteCard,
    addCategory,
    updateCategory,
    deleteCategory,
    getIncomeValueForMonth,
    getExpenseValueForMonth,
    lastUsedPaymentMethod,
    setLastUsedPaymentMethod,
    isSaving,
    saveSuccess
  };
};

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
