import { useState, useEffect, useCallback } from 'react';
import { Income, Expense, Category, CreditCard, CardPaymentStatus } from '../types';
import { v4 as uuidv4 } from 'uuid';
import { addMonths, format, parseISO, isSameMonth } from 'date-fns';
import { supabase } from '../lib/supabase';
import { User } from '@supabase/supabase-js';

const STORAGE_KEY = 'fluxonext_data_v2';

const DEFAULT_INCOME_CATEGORIES: Category[] = [
  { id: 'inc-1', name: 'Salário', color: '#10B981', type: 'income' },
  { id: 'inc-2', name: 'Freelance', color: '#3B82F6', type: 'income' },
  { id: 'inc-3', name: 'Investimentos', color: '#8B5CF6', type: 'income' },
];

const DEFAULT_EXPENSE_CATEGORIES: Category[] = [
  { id: 'exp-1', name: 'Alimentação', color: '#F59E0B', type: 'expense' },
  { id: 'exp-2', name: 'Transporte', color: '#3B82F6', type: 'expense' },
  { id: 'exp-3', name: 'Moradia', color: '#10B981', type: 'expense' },
  { id: 'exp-4', name: 'Lazer', color: '#8B5CF6', type: 'expense' },
  { id: 'exp-5', name: 'Saúde', color: '#EF4444', type: 'expense' },
  { id: 'exp-6', name: 'Outros', color: '#6B7280', type: 'expense' },
];

const DEFAULT_CARDS: CreditCard[] = [
  { id: 'card-1', name: 'Nubank', closingDay: 1, dueDay: 8, color: '#820AD1' },
  { id: 'card-2', name: 'Inter', closingDay: 10, dueDay: 17, color: '#FF7A00' },
];

interface FinanceData {
  incomes: Income[];
  expenses: Expense[];
  incomeCategories: Category[];
  expenseCategories: Category[];
  cards: CreditCard[];
  cardPayments: CardPaymentStatus[];
  lastUsedPaymentMethod: string;
}

export const useFinance = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<FinanceData>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return {
        incomes: parsed.incomes || [],
        expenses: parsed.expenses || [],
        incomeCategories: parsed.incomeCategories || DEFAULT_INCOME_CATEGORIES,
        expenseCategories: parsed.expenseCategories || DEFAULT_EXPENSE_CATEGORIES,
        cards: parsed.cards || DEFAULT_CARDS,
        cardPayments: parsed.cardPayments || [],
        lastUsedPaymentMethod: parsed.lastUsedPaymentMethod || 'cash',
      };
    }
    return {
      incomes: [],
      expenses: [],
      incomeCategories: DEFAULT_INCOME_CATEGORIES,
      expenseCategories: DEFAULT_EXPENSE_CATEGORIES,
      cards: DEFAULT_CARDS,
      cardPayments: [],
      lastUsedPaymentMethod: 'cash',
    };
  });

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

  // Fetch from Supabase when user logs in
  useEffect(() => {
    const fetchSupabaseData = async () => {
      if (!user) return;
      
      const { data: dbData, error } = await supabase
        .from('user_finance')
        .select('data')
        .eq('user_id', user.id)
        .single();

      if (dbData && !error) {
        setData(dbData.data);
      } else if (error && error.code === 'PGRST116') {
        // No data found, sync local to cloud
        const localData = localStorage.getItem(STORAGE_KEY);
        if (localData) {
          const parsed = JSON.parse(localData);
          await supabase.from('user_finance').insert({ user_id: user.id, data: parsed });
        }
      }
    };

    fetchSupabaseData();
  }, [user]);

  // Persist to localStorage and Supabase
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    
    const saveToSupabase = async () => {
      if (!user) return;
      await supabase
        .from('user_finance')
        .upsert({ user_id: user.id, data }, { onConflict: 'user_id' });
    };

    const timeout = setTimeout(saveToSupabase, 1000); // Debounce saves
    return () => clearTimeout(timeout);
  }, [data, user]);

  // --- Expenses ---

  const addExpense = (expense: Omit<Expense, 'id'>) => {
    setData(prev => ({
      ...prev,
      expenses: [...prev.expenses, { ...expense, id: uuidv4() }]
    }));
  };

  const addInstallmentExpense = (
    baseExpense: Omit<Expense, 'id' | 'installments' | 'billingMonth' | 'type'>,
    startBillingMonth: string, // YYYY-MM
    totalInstallments: number
  ) => {
    const newExpenses: Expense[] = [];
    const originalId = uuidv4();
    const startDate = parseISO(`${startBillingMonth}-01`);

    for (let i = 0; i < totalInstallments; i++) {
      const billingDate = addMonths(startDate, i);
      const billingMonth = format(billingDate, 'yyyy-MM');
      
      newExpenses.push({
        ...baseExpense,
        id: uuidv4(),
        type: 'installment',
        billingMonth,
        originalId,
        installments: {
          current: i + 1,
          total: totalInstallments
        }
      });
    }

    setData(prev => ({
      ...prev,
      expenses: [...prev.expenses, ...newExpenses]
    }));
  };

  const updateExpense = (id: string, updates: Partial<Expense>) => {
    setData(prev => {
      const expense = prev.expenses.find(e => e.id === id);
      if (!expense) return prev;

      // If it's an installment and totalValue or installmentsCount changed, we need to recalculate
      // Actually, the prompt says: "Editar uma compra parcelada deve recalcular todas as parcelas futuras automaticamente."
      if (expense.originalId && (updates.totalValue !== undefined || updates.installments?.total !== undefined)) {
        const totalValue = updates.totalValue ?? expense.totalValue;
        const totalInstallments = updates.installments?.total ?? expense.installments?.total ?? 1;
        const installmentValue = totalValue / totalInstallments;

        return {
          ...prev,
          expenses: prev.expenses.map(e => {
            if (e.originalId === expense.originalId && e.installments && e.installments.current >= (expense.installments?.current || 1)) {
              // Update future installments
              return {
                ...e,
                ...updates,
                totalValue,
                installmentValue,
                installments: {
                  ...e.installments,
                  total: totalInstallments
                }
              };
            }
            return e.id === id ? { ...e, ...updates } : e;
          })
        };
      }

      return {
        ...prev,
        expenses: prev.expenses.map(e => e.id === id ? { ...e, ...updates } : e)
      };
    });
  };

  const deleteExpense = (id: string) => {
    setData(prev => ({
      ...prev,
      expenses: prev.expenses.filter(e => e.id !== id)
    }));
  };

  const toggleExpensePaid = (id: string) => {
    setData(prev => ({
      ...prev,
      expenses: prev.expenses.map(e => 
        e.id === id ? { ...e, isPaid: !e.isPaid } : e
      )
    }));
  };

  const updateFixedExpenseValue = (id: string, monthYear: string, newValue: number, newPaymentMethod?: string) => {
    setData(prev => ({
      ...prev,
      expenses: prev.expenses.map(exp => {
        if (exp.id !== id || exp.type !== 'fixed') return exp;
        
        const newHistory = [
          ...(exp.valueHistory || []),
          { monthYear, value: newValue, paymentMethod: newPaymentMethod || exp.paymentMethod }
        ].sort((a, b) => a.monthYear.localeCompare(b.monthYear));

        const uniqueHistory = newHistory.reduce((acc: any[], curr) => {
          const idx = acc.findIndex(h => h.monthYear === curr.monthYear);
          if (idx >= 0) acc[idx] = curr;
          else acc.push(curr);
          return acc;
        }, []);

        return { ...exp, valueHistory: uniqueHistory };
      })
    }));
  };

  const toggleCardPaid = (cardId: string, monthYear: string) => {
    setData(prev => {
      const exists = prev.cardPayments.find(p => p.cardId === cardId && p.monthYear === monthYear);
      if (exists) {
        return {
          ...prev,
          cardPayments: prev.cardPayments.map(p => 
            (p.cardId === cardId && p.monthYear === monthYear) ? { ...p, isPaid: !p.isPaid } : p
          )
        };
      }
      return {
        ...prev,
        cardPayments: [...prev.cardPayments, { cardId, monthYear, isPaid: true }]
      };
    });
  };

  // --- Incomes ---

  const addIncome = (income: Omit<Income, 'id'>) => {
    setData(prev => ({
      ...prev,
      incomes: [...prev.incomes, { ...income, id: uuidv4() }]
    }));
  };

  const updateIncome = (id: string, updates: Partial<Income>) => {
    setData(prev => ({
      ...prev,
      incomes: prev.incomes.map(i => i.id === id ? { ...i, ...updates } : i)
    }));
  };

  const deleteIncome = (id: string) => {
    setData(prev => ({
      ...prev,
      incomes: prev.incomes.filter(i => i.id !== id)
    }));
  };

  const updateFixedIncomeValue = (id: string, monthYear: string, newValue: number, paymentMethod?: string) => {
    setData(prev => ({
      ...prev,
      incomes: prev.incomes.map(inc => {
        if (inc.id !== id || inc.type !== 'fixed') return inc;
        
        const newHistory = [
          ...(inc.valueHistory || []),
          { monthYear, value: newValue, paymentMethod }
        ].sort((a, b) => a.monthYear.localeCompare(b.monthYear));

        // Remove duplicates for same month, keeping latest
        const uniqueHistory = newHistory.reduce((acc: any[], curr) => {
          const idx = acc.findIndex(h => h.monthYear === curr.monthYear);
          if (idx >= 0) acc[idx] = curr;
          else acc.push(curr);
          return acc;
        }, []);

        return { ...inc, valueHistory: uniqueHistory };
      })
    }));
  };

  // --- Cards & Categories ---

  const addCard = (card: Omit<CreditCard, 'id'>) => {
    setData(prev => ({
      ...prev,
      cards: [...prev.cards, { ...card, id: uuidv4() }]
    }));
  };

  const updateCard = (id: string, updates: Partial<CreditCard>) => {
    setData(prev => ({
      ...prev,
      cards: prev.cards.map(c => c.id === id ? { ...c, ...updates } : c)
    }));
  };

  const deleteCard = (id: string) => {
    setData(prev => ({
      ...prev,
      cards: prev.cards.filter(c => c.id !== id)
    }));
  };

  const addCategory = (category: Omit<Category, 'id'>) => {
    setData(prev => {
      const list = category.type === 'income' ? 'incomeCategories' : 'expenseCategories';
      return {
        ...prev,
        [list]: [...prev[list], { ...category, id: uuidv4() }]
      };
    });
  };

  const updateCategory = (id: string, updates: Partial<Category>) => {
    setData(prev => {
      const isIncome = prev.incomeCategories.some(c => c.id === id);
      const list = isIncome ? 'incomeCategories' : 'expenseCategories';
      return {
        ...prev,
        [list]: prev[list].map(c => c.id === id ? { ...c, ...updates } : c)
      };
    });
  };

  const deleteCategory = (id: string) => {
    setData(prev => {
      const isIncome = prev.incomeCategories.some(c => c.id === id);
      const list = isIncome ? 'incomeCategories' : 'expenseCategories';
      return {
        ...prev,
        [list]: prev[list].filter(c => c.id !== id)
      };
    });
  };

  const setLastUsedPaymentMethod = (method: string) => {
    setData(prev => ({ ...prev, lastUsedPaymentMethod: method }));
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
    incomes: data.incomes,
    expenses: data.expenses,
    incomeCategories: data.incomeCategories,
    expenseCategories: data.expenseCategories,
    cards: data.cards,
    cardPayments: data.cardPayments,
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
    lastUsedPaymentMethod: data.lastUsedPaymentMethod,
    setLastUsedPaymentMethod,
  };
};
