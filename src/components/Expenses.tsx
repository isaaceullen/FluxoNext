import React, { useState, useRef } from 'react';
import { useFinance } from '../hooks/useFinance';
import { Card, Button, Input, Select } from './ui';
import { Plus, Trash2, Calendar, CreditCard as CardIcon, DollarSign, MessageSquare, List, Send, Check, Edit2, ArrowLeft, ArrowRight, ChevronDown, X, Search, Filter, Clock } from 'lucide-react';
import { formatCurrency, cn } from '../utils';
import { format, parseISO, addMonths, subMonths, eachMonthOfInterval } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { parseTransactionText } from '../services/geminiService';
import { ExtractedData, Expense } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { LoginModal } from './LoginModal';

interface FilterState {
  categoryId: string;
  paymentMethod: string;
  minValue: string;
  maxValue: string;
  type: 'all' | 'fixed' | 'variable';
}

const initialFilters: FilterState = {
  categoryId: '',
  paymentMethod: '',
  minValue: '',
  maxValue: '',
  type: 'all',
};

export const Expenses = ({ editingExpenseId, onClearEditing }: { editingExpenseId?: string | null, onClearEditing?: () => void }) => {
  const { 
    user,
    expenses, 
    expenseCategories, 
    cards, 
    addExpense, 
    addInstallmentExpense, 
    updateExpense, 
    deleteExpense, 
    updateFixedExpenseValue,
    lastUsedPaymentMethod,
    setLastUsedPaymentMethod,
    getExpenseValueForMonth
  } = useFinance();
  const [activeTab, setActiveTab] = useState<'manual' | 'fixed' | 'chat'>('manual');
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [isMonthDropdownOpen, setIsMonthDropdownOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [activeFilters, setActiveFilters] = useState<FilterState>(initialFilters);
  const [historyModalData, setHistoryModalData] = useState<{ title: string; history: any[] } | null>(null);

  // Default tab logic based on login
  React.useEffect(() => {
    if (user) setActiveTab('chat');
    else setActiveTab('manual');
  }, [user]);
  
  // View State (for the list below)
  const [viewMonth, setViewMonth] = useState(format(addMonths(new Date(), 1), 'yyyy-MM')); // YYYY-MM

  // Installment Edit Modal State
  const [installmentEditData, setInstallmentEditData] = useState<{
    expense: Expense;
    updates: Partial<Expense>;
  } | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    id: '',
    purchaseDate: new Date().toISOString().slice(0, 10),
    billingMonth: format(addMonths(new Date(), 1), 'yyyy-MM'), // Default next month
    title: '',
    categoryId: '',
    paymentMethod: lastUsedPaymentMethod || 'cash', // 'cash' or cardId
    isInstallment: false,
    totalInstallments: 2,
    totalValue: '',
    installmentValue: '',
    effectiveMonth: format(new Date(), 'yyyy-MM'),
  });

  // Handle editing from external source (like Summary modal)
  React.useEffect(() => {
    if (editingExpenseId) {
      const exp = expenses.find(e => e.id === editingExpenseId);
      if (exp) {
        if (exp.type === 'fixed') {
          setActiveTab('fixed');
          // For fixed, we show the latest value in history
          const latest = exp.valueHistory?.[exp.valueHistory.length - 1];
          setFormData({
            id: exp.id,
            purchaseDate: exp.purchaseDate,
            billingMonth: exp.billingMonth,
            title: exp.title,
            categoryId: exp.categoryId,
            paymentMethod: latest?.paymentMethod || exp.paymentMethod,
            isInstallment: false,
            totalInstallments: 1,
            totalValue: (latest?.value || exp.totalValue).toString(),
            installmentValue: (latest?.value || exp.totalValue).toString(),
          });
        } else {
          setActiveTab('manual');
          setFormData({
            id: exp.id,
            purchaseDate: exp.purchaseDate,
            billingMonth: exp.billingMonth,
            title: exp.title,
            categoryId: exp.categoryId,
            paymentMethod: exp.paymentMethod,
            isInstallment: exp.isInstallment,
            totalInstallments: exp.installments?.total || 1,
            totalValue: exp.totalValue.toString(),
            installmentValue: exp.installmentValue.toString(),
          });
        }
      }
    }
  }, [editingExpenseId, expenses]);

  const handleTotalValueChange = (val: string) => {
    const total = parseFloat(val);
    if (!isNaN(total) && formData.isInstallment && formData.totalInstallments > 0) {
      const inst = total / formData.totalInstallments;
      setFormData(prev => ({ ...prev, totalValue: val, installmentValue: inst.toFixed(2) }));
    } else {
      setFormData(prev => ({ ...prev, totalValue: val }));
    }
  };

  const handleInstallmentValueChange = (val: string) => {
    const inst = parseFloat(val);
    if (!isNaN(inst) && formData.isInstallment && formData.totalInstallments > 0) {
      const total = inst * formData.totalInstallments;
      setFormData(prev => ({ ...prev, installmentValue: val, totalValue: total.toFixed(2) }));
    } else {
      setFormData(prev => ({ ...prev, installmentValue: val }));
    }
  };

  const handleInstallmentsChange = (val: string) => {
    const count = parseInt(val);
    if (!isNaN(count)) {
      const total = parseFloat(formData.totalValue);
      if (!isNaN(total) && count > 0) {
        setFormData(prev => ({ 
          ...prev, 
          totalInstallments: count, 
          installmentValue: (total / count).toFixed(2) 
        }));
      } else {
        setFormData(prev => ({ ...prev, totalInstallments: count }));
      }
    }
  };

  const handlePurchaseDateChange = (date: string) => {
    const nextMonth = format(addMonths(parseISO(date), 1), 'yyyy-MM');
    setFormData(prev => ({ ...prev, purchaseDate: date, billingMonth: nextMonth }));
  };

  const handlePrevMonth = () => setViewMonth(prev => format(subMonths(parseISO(prev + '-01'), 1), 'yyyy-MM'));
  const handleNextMonth = () => setViewMonth(prev => format(addMonths(parseISO(prev + '-01'), 1), 'yyyy-MM'));

  const monthOptions = eachMonthOfInterval({
    start: subMonths(new Date(), 12 * 5), // 5 years past
    end: addMonths(new Date(), 12 * 10) // 10 years future
  }).map(date => format(date, 'yyyy-MM'));

  const handleEditExpense = (exp: any) => {
    setFormData({
      id: exp.id,
      purchaseDate: exp.purchaseDate,
      billingMonth: exp.billingMonth,
      title: exp.title,
      categoryId: exp.categoryId,
      paymentMethod: (exp as any).currentMonthPaymentMethod,
      isInstallment: exp.isInstallment,
      totalInstallments: exp.installments?.total || 1,
      totalValue: exp.totalValue.toString(),
      installmentValue: exp.installmentValue.toString(),
      effectiveMonth: viewMonth,
    });
    setActiveTab(exp.type === 'fixed' ? 'fixed' : 'manual');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title || !formData.totalValue) return;

    const totalVal = parseFloat(formData.totalValue);
    const instVal = formData.isInstallment ? parseFloat(formData.installmentValue) : totalVal;

    if (formData.id) {
      // Update existing
      const exp = expenses.find(e => e.id === formData.id);
      const updates = {
        title: formData.title,
        categoryId: formData.categoryId,
        totalValue: totalVal,
        installmentValue: instVal,
        paymentMethod: formData.paymentMethod,
        installments: formData.isInstallment ? { current: exp?.installments?.current || 1, total: formData.totalInstallments } : undefined
      };

      if (activeTab === 'fixed') {
        await updateFixedExpenseValue(formData.id, formData.effectiveMonth, totalVal, formData.paymentMethod);
        await updateExpense(formData.id, { title: formData.title, categoryId: formData.categoryId });
      } else if (exp?.originalId) {
        // It's an installment, show modal
        setInstallmentEditData({ expense: exp, updates });
      } else {
        await updateExpense(formData.id, updates);
      }
      if (onClearEditing) onClearEditing();
    } else {
      // Add new
      const baseData = {
        title: formData.title,
        categoryId: formData.categoryId || expenseCategories[0]?.id,
        purchaseDate: formData.purchaseDate,
        billingMonth: formData.billingMonth,
        isInstallment: formData.isInstallment,
        totalValue: totalVal,
        installmentValue: instVal,
        paymentMethod: formData.paymentMethod,
        isPaid: false,
      };

      if (activeTab === 'fixed') {
        await addExpense({
          ...baseData,
          type: 'fixed',
          valueHistory: [{ monthYear: formData.effectiveMonth, value: totalVal, paymentMethod: formData.paymentMethod }]
        });
      } else if (formData.isInstallment) {
        await addInstallmentExpense(baseData, formData.billingMonth, formData.totalInstallments);
      } else {
        await addExpense({ ...baseData, type: 'one_time' });
      }
    }

    // Save last used payment method
    setLastUsedPaymentMethod(formData.paymentMethod);

    // Reset form
    setFormData({
      id: '',
      purchaseDate: new Date().toISOString().slice(0, 10),
      billingMonth: format(addMonths(new Date(), 1), 'yyyy-MM'),
      title: '',
      categoryId: '',
      paymentMethod: formData.paymentMethod, // Keep the last used one
      isInstallment: false,
      totalInstallments: 2,
      totalValue: '',
      installmentValue: '',
      effectiveMonth: format(new Date(), 'yyyy-MM'),
    });
  };

  // Filter expenses by BILLING MONTH (similar to Summary)
  const filteredExpenses = expenses.map(e => {
    const { value, paymentMethod } = getExpenseValueForMonth(e, viewMonth);
    return { ...e, currentMonthValue: value, currentMonthPaymentMethod: paymentMethod };
  }).filter(e => {
    if (e.currentMonthValue <= 0) return false;
    
    // Search Query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const category = expenseCategories.find(c => c.id === e.categoryId);
      if (!e.title.toLowerCase().includes(query) && !category?.name.toLowerCase().includes(query)) {
        return false;
      }
    }

    // Active Filters
    if (activeFilters.categoryId && e.categoryId !== activeFilters.categoryId) return false;
    if (activeFilters.paymentMethod && e.currentMonthPaymentMethod !== activeFilters.paymentMethod) return false;
    if (activeFilters.minValue && e.currentMonthValue < parseFloat(activeFilters.minValue)) return false;
    if (activeFilters.maxValue && e.currentMonthValue > parseFloat(activeFilters.maxValue)) return false;
    
    if (activeFilters.type === 'fixed' && e.type !== 'fixed') return false;
    if (activeFilters.type === 'variable' && e.type === 'fixed') return false;

    return true;
  }).sort((a, b) => {
    // Sort by createdAt desc (newest created first)
    const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    if (dateA !== dateB) return dateB - dateA;
    
    // Fallback to purchaseDate if createdAt is missing
    return new Date(b.purchaseDate).getTime() - new Date(a.purchaseDate).getTime();
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h2 className="text-2xl font-bold text-zinc-100">Despesas</h2>
        <div className="flex bg-zinc-900 p-1 rounded-xl border border-zinc-800 overflow-x-auto no-scrollbar">
          <button
            onClick={() => setActiveTab('manual')}
            className={cn(
              "flex-1 sm:flex-none px-3 sm:px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2 whitespace-nowrap",
              activeTab === 'manual' ? "bg-yellow-500/10 text-yellow-500" : "text-zinc-400 hover:text-zinc-200"
            )}
          >
            <List className="w-4 h-4" /> 
            <span>Manual</span>
          </button>
          <button
            onClick={() => setActiveTab('fixed')}
            className={cn(
              "flex-1 sm:flex-none px-3 sm:px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2 whitespace-nowrap",
              activeTab === 'fixed' ? "bg-yellow-500/10 text-yellow-500" : "text-zinc-400 hover:text-zinc-200"
            )}
          >
            <Calendar className="w-4 h-4" /> 
            <span>Fixas</span>
          </button>
          <button
            onClick={() => setActiveTab('chat')}
            className={cn(
              "flex-1 sm:flex-none px-3 sm:px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2 whitespace-nowrap",
              activeTab === 'chat' ? "bg-yellow-500/10 text-yellow-500" : "text-zinc-400 hover:text-zinc-200"
            )}
          >
            <MessageSquare className="w-4 h-4" /> 
            <span>Chat IA</span>
          </button>
        </div>
      </div>

      {activeTab === 'chat' && (
        user ? (
          <ExpenseChat 
            filteredExpenses={filteredExpenses}
            onEdit={handleEditExpense}
            viewMonth={viewMonth}
          />
        ) : (
          <div className="relative h-[300px] bg-zinc-900/50 border border-zinc-800 rounded-2xl overflow-hidden flex items-center justify-center p-8 text-center">
            <div className="max-w-xs w-full space-y-4">
              <div className="w-16 h-16 bg-yellow-500/10 rounded-full flex items-center justify-center text-yellow-500 mx-auto">
                <MessageSquare className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-bold text-zinc-100">Chat IA Bloqueado</h3>
              <p className="text-zinc-400 text-sm">
                Faça login para usar nossa inteligência artificial e lançar gastos por texto ou voz.
              </p>
              <Button onClick={() => setShowLoginModal(true)} className="w-full bg-yellow-500 hover:bg-yellow-400 text-black font-bold py-3">
                Fazer Login
              </Button>
            </div>
          </div>
        )
      )}

      {activeTab !== 'chat' && (
        <Card className="border-yellow-500/50 p-4 sm:p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {activeTab === 'manual' && (
                <>
                  <Input 
                    label="Data da Compra" 
                    type="date"
                    value={formData.purchaseDate} 
                    onChange={e => handlePurchaseDateChange(e.target.value)}
                    required
                  />
                  <Input 
                    label="Mês da Fatura (Início)" 
                    type="month"
                    value={formData.billingMonth} 
                    onChange={e => setFormData({...formData, billingMonth: e.target.value})}
                    required
                  />
                </>
              )}
              <Input 
                label="Descrição" 
                value={formData.title} 
                onChange={e => setFormData({...formData, title: e.target.value})}
                required
              />
              <Select
                label="Categoria"
                value={formData.categoryId}
                onChange={e => setFormData({ ...formData, categoryId: e.target.value })}
              >
                <option value="">Selecione...</option>
                {expenseCategories.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </Select>
              <Select
                label="Método de Pagamento"
                value={formData.paymentMethod}
                onChange={e => setFormData({ ...formData, paymentMethod: e.target.value })}
              >
                <option value="cash">Dinheiro / Débito</option>
                {cards.map(c => (
                  <option key={c.id} value={c.id}>Cartão: {c.name}</option>
                ))}
              </Select>
              
              {activeTab === 'manual' && (
                <>
                  <div className="flex items-center gap-2 pt-6">
                    <input 
                      type="checkbox" 
                      id="isInstallment"
                      checked={formData.isInstallment}
                      onChange={e => setFormData({...formData, isInstallment: e.target.checked})}
                      className="w-5 h-5 rounded border-zinc-700 bg-zinc-900 text-yellow-500 focus:ring-yellow-500"
                    />
                    <label htmlFor="isInstallment" className="text-sm font-medium text-zinc-300">
                      Compra Parcelada?
                    </label>
                  </div>

                  {formData.isInstallment && (
                    <Input 
                      label="Nº Parcelas" 
                      type="number" min="2"
                      value={formData.totalInstallments} 
                      onChange={e => handleInstallmentsChange(e.target.value)}
                      required
                    />
                  )}
                </>
              )}

              <Input 
                label={activeTab === 'fixed' ? "Valor Mensal" : (formData.isInstallment ? "Valor Total" : "Valor")} 
                type="number" step="0.01"
                value={formData.totalValue} 
                onChange={e => handleTotalValueChange(e.target.value)}
                required
              />

              {activeTab === 'fixed' && formData.id && (
                <Input 
                  label="A partir de qual mês? (Mês da Alteração)" 
                  type="month"
                  value={formData.effectiveMonth} 
                  onChange={e => setFormData({...formData, effectiveMonth: e.target.value})}
                  required
                />
              )}

              {activeTab === 'manual' && formData.isInstallment && (
                <Input 
                  label="Valor da Parcela" 
                  type="number" step="0.01"
                  value={formData.installmentValue} 
                  onChange={e => handleInstallmentValueChange(e.target.value)}
                  required
                />
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              {formData.id && (
                <Button type="button" variant="ghost" onClick={() => {
                  if (onClearEditing) onClearEditing();
                  setFormData({
                    id: '',
                    purchaseDate: new Date().toISOString().slice(0, 10),
                    billingMonth: format(addMonths(new Date(), 1), 'yyyy-MM'),
                    title: '',
                    categoryId: '',
                    paymentMethod: 'cash',
                    isInstallment: false,
                    totalInstallments: 2,
                    totalValue: '',
                    installmentValue: '',
                    effectiveMonth: format(new Date(), 'yyyy-MM'),
                  });
                }}>
                  Cancelar Edição
                </Button>
              )}
              <Button type="submit" className="bg-yellow-500 hover:bg-yellow-400 text-black font-bold">
                {formData.id ? 'Atualizar Despesa' : 'Salvar Despesa'}
              </Button>
            </div>
          </form>
        </Card>
      )}

      {/* Unified List Section */}
      <div className="space-y-4">
        {/* Search and Filter Bar */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
            <Input 
              placeholder="Buscar despesa..." 
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-9" 
            />
          </div>
          <Button 
            variant="secondary" 
            size="icon" 
            className="shrink-0 relative"
            onClick={() => setIsFilterModalOpen(true)}
          >
            <Filter className="w-4 h-4" />
            {Object.values(activeFilters).some(v => v !== '' && v !== 'all') && (
              <span className="absolute top-2 right-2 w-2 h-2 bg-yellow-500 rounded-full" />
            )}
          </Button>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <h3 className="text-lg font-semibold text-zinc-300">Visão da Fatura</h3>
          
          <div className="flex items-center bg-zinc-900 rounded-xl p-1 border border-zinc-800">
            <button onClick={handlePrevMonth} className="p-2 hover:bg-zinc-800 rounded-lg text-zinc-400 hover:text-yellow-500 transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </button>
            
            <div className="relative">
              <button 
                onClick={() => setIsMonthDropdownOpen(!isMonthDropdownOpen)}
                className="px-4 py-2 font-medium text-zinc-200 min-w-[160px] flex items-center justify-center gap-2 hover:bg-zinc-800 rounded-lg transition-colors capitalize"
              >
                {format(parseISO(viewMonth + '-01'), 'MMM/yyyy', { locale: ptBR })}
                <ChevronDown className={cn("w-4 h-4 transition-transform", isMonthDropdownOpen && "rotate-180")} />
              </button>

              <AnimatePresence>
                {isMonthDropdownOpen && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    className="absolute top-full left-0 right-0 mt-2 bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl z-50 max-h-60 overflow-y-auto py-2"
                  >
                    {monthOptions.map(m => (
                      <button
                        key={m}
                        onClick={() => {
                          setViewMonth(m);
                          setIsMonthDropdownOpen(false);
                        }}
                        className={cn(
                          "w-full px-4 py-2 text-sm text-left hover:bg-zinc-800 transition-colors capitalize",
                          viewMonth === m ? "text-yellow-500 bg-yellow-500/5" : "text-zinc-400"
                        )}
                      >
                        {format(parseISO(m + '-01'), 'MMM/yyyy', { locale: ptBR })}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <button onClick={handleNextMonth} className="p-2 hover:bg-zinc-800 rounded-lg text-zinc-400 hover:text-yellow-500 transition-colors">
              <ArrowRight className="w-5 h-5" />
            </button>
          </div>
        </div>

        <ExpenseList 
          expenses={filteredExpenses} 
          expenseCategories={expenseCategories} 
          cards={cards} 
          onEdit={handleEditExpense} 
          onDelete={deleteExpense} 
          onShowHistory={(title, history) => setHistoryModalData({ title, history })}
        />
      </div>
      {showLoginModal && <LoginModal onClose={() => setShowLoginModal(false)} />}
      
      <FilterModal 
        isOpen={isFilterModalOpen}
        onClose={() => setIsFilterModalOpen(false)}
        onApply={setActiveFilters}
        initialFilters={activeFilters}
        categories={expenseCategories}
        cards={cards}
      />

      <HistoryModal 
        isOpen={!!historyModalData}
        onClose={() => setHistoryModalData(null)}
        title={historyModalData?.title || ''}
        history={historyModalData?.history || []}
      />

      {/* Installment Edit Modal */}
      <AnimatePresence>
        {installmentEditData && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-zinc-950 border border-zinc-800 rounded-2xl p-6 max-w-md w-full shadow-2xl"
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-zinc-100">Editar Parcelas</h3>
                <button onClick={() => setInstallmentEditData(null)} className="p-2 text-zinc-400 hover:text-zinc-100">
                  <X className="w-6 h-6" />
                </button>
              </div>

              <p className="text-zinc-400 text-sm mb-6">
                Esta é uma despesa parcelada. Como deseja aplicar as alterações?
              </p>

              <div className="space-y-3">
                <button 
                  onClick={() => {
                    updateExpense(installmentEditData.expense.id, installmentEditData.updates, 'only');
                    setInstallmentEditData(null);
                  }}
                  className="w-full p-4 rounded-xl bg-zinc-900 border border-zinc-800 text-left hover:bg-zinc-800 transition-colors group"
                >
                  <p className="font-bold text-zinc-100 group-hover:text-yellow-500">Somente esta parcela</p>
                  <p className="text-xs text-zinc-500">Altera apenas o item selecionado.</p>
                </button>
                <button 
                  onClick={() => {
                    updateExpense(installmentEditData.expense.id, installmentEditData.updates, 'future');
                    setInstallmentEditData(null);
                  }}
                  className="w-full p-4 rounded-xl bg-zinc-900 border border-zinc-800 text-left hover:bg-zinc-800 transition-colors group"
                >
                  <p className="font-bold text-zinc-100 group-hover:text-yellow-500">Esta e as próximas</p>
                  <p className="text-xs text-zinc-500">Altera esta parcela e todas as futuras da série.</p>
                </button>
                <button 
                  onClick={() => {
                    updateExpense(installmentEditData.expense.id, installmentEditData.updates, 'all');
                    setInstallmentEditData(null);
                  }}
                  className="w-full p-4 rounded-xl bg-zinc-900 border border-zinc-800 text-left hover:bg-zinc-800 transition-colors group"
                >
                  <p className="font-bold text-zinc-100 group-hover:text-yellow-500">Todas as parcelas</p>
                  <p className="text-xs text-zinc-500">Altera retroativamente e futuramente todos os itens.</p>
                </button>
              </div>

              <div className="mt-6">
                <Button variant="ghost" className="w-full" onClick={() => setInstallmentEditData(null)}>
                  Cancelar
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

const FilterModal = ({ 
  isOpen, 
  onClose, 
  onApply, 
  initialFilters, 
  categories, 
  cards 
}: { 
  isOpen: boolean; 
  onClose: () => void; 
  onApply: (filters: FilterState) => void; 
  initialFilters: FilterState;
  categories: any[];
  cards: any[];
}) => {
  const [filters, setFilters] = useState(initialFilters);

  // Reset local state when modal opens
  React.useEffect(() => {
    if (isOpen) setFilters(initialFilters);
  }, [isOpen, initialFilters]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md"
      >
        <Card className="relative border-zinc-800 shadow-2xl bg-zinc-950">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-bold text-zinc-100">Filtrar Despesas</h3>
            <button onClick={onClose} className="p-2 text-zinc-500 hover:text-zinc-200 transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>

            <div className="space-y-4">
            <Select
              label="Tipo de Despesa"
              value={filters.type}
              onChange={e => setFilters({ ...filters, type: e.target.value as any })}
            >
              <option value="all">Todas</option>
              <option value="fixed">Apenas Fixas</option>
              <option value="variable">Apenas Variáveis / Avulsas</option>
            </Select>

            <Select
              label="Categoria"
              value={filters.categoryId}
              onChange={e => setFilters({ ...filters, categoryId: e.target.value })}
            >
              <option value="">Todas as Categorias</option>
              {categories.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </Select>

            <Select
              label="Método de Pagamento"
              value={filters.paymentMethod}
              onChange={e => setFilters({ ...filters, paymentMethod: e.target.value })}
            >
              <option value="">Todos</option>
              <option value="cash">Dinheiro / Débito</option>
              {cards.map(c => (
                <option key={c.id} value={c.id}>Cartão: {c.name}</option>
              ))}
            </Select>

            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Valor Mínimo"
                type="number"
                placeholder="0,00"
                value={filters.minValue}
                onChange={e => setFilters({ ...filters, minValue: e.target.value })}
              />
              <Input
                label="Valor Máximo"
                type="number"
                placeholder="0,00"
                value={filters.maxValue}
                onChange={e => setFilters({ ...filters, maxValue: e.target.value })}
              />
            </div>
          </div>

          <div className="flex gap-3 mt-8">
            <Button 
              variant="outline" 
              className="flex-1"
              onClick={() => {
                const empty: FilterState = { categoryId: '', paymentMethod: '', minValue: '', maxValue: '', type: 'all' };
                setFilters(empty);
                onApply(empty);
                onClose();
              }}
            >
              Limpar
            </Button>
            <Button 
              className="flex-1 bg-yellow-500 hover:bg-yellow-400 text-black font-bold"
              onClick={() => {
                onApply(filters);
                onClose();
              }}
            >
              Aplicar Filtros
            </Button>
          </div>
        </Card>
      </motion.div>
    </div>
  );
};

const ExpenseList = ({ 
  expenses, 
  expenseCategories, 
  cards, 
  onEdit, 
  onDelete,
  onShowHistory
}: { 
  expenses: any[], 
  expenseCategories: any[], 
  cards: any[], 
  onEdit: (exp: any) => void, 
  onDelete: (id: string) => void,
  onShowHistory: (title: string, history: any[]) => void
}) => {
  if (expenses.length === 0) {
    return <div className="text-center py-10 text-zinc-500">Nenhuma despesa para esta fatura.</div>;
  }

  return (
    <div className="grid grid-cols-1 gap-3">
      {expenses.map(exp => {
        const category = expenseCategories.find(c => c.id === exp.categoryId);
        const card = cards.find(c => c.id === (exp as any).currentMonthPaymentMethod);
        const displayValue = (exp as any).currentMonthValue;
        
        return (
          <div key={exp.id} className="bg-zinc-900/50 border border-zinc-800 p-3 sm:p-4 rounded-xl flex items-center justify-between group">
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="p-2 bg-red-500/10 rounded-lg text-red-500">
                {card ? <CardIcon className="w-4 h-4 sm:w-5 sm:h-5" /> : <DollarSign className="w-4 h-4 sm:w-5 sm:h-5" />}
              </div>
              <div>
                <h4 className="font-medium text-zinc-200 text-sm sm:text-base">{exp.title}</h4>
                <div className="flex flex-wrap gap-x-2 gap-y-1 text-[10px] sm:text-xs text-zinc-500">
                  <span>{format(parseISO(exp.purchaseDate), 'dd/MM/yyyy')}</span>
                  <span className="text-zinc-600">•</span>
                  <span className="capitalize">Fatura: {format(parseISO(exp.billingMonth + '-01'), 'MMM/yyyy', { locale: ptBR })}</span>
                  <span className="text-zinc-600">•</span>
                  <span style={{ color: category?.color }}>{category?.name}</span>
                  {exp.type === 'fixed' && <span className="text-emerald-500">• Fixa</span>}
                  {exp.installments && (
                    <>
                      <span className="text-zinc-600">•</span>
                      <span className="text-yellow-500">Parcela {exp.installments.current}/{exp.installments.total}</span>
                    </>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 sm:gap-4">
              <span className="font-bold text-zinc-200 text-sm sm:text-base">{formatCurrency(displayValue)}</span>
              <div className="flex gap-1 sm:opacity-0 sm:group-hover:opacity-100 transition-all">
                {exp.type === 'fixed' && (
                  <button 
                    onClick={() => onShowHistory(exp.title, exp.valueHistory || [])}
                    className="p-2 text-zinc-600 hover:text-emerald-500 hover:bg-zinc-800 rounded-lg min-w-[44px] min-h-[44px] flex items-center justify-center"
                    title="Histórico"
                  >
                    <Clock className="w-4 h-4" />
                  </button>
                )}
                <button 
                  onClick={() => onEdit(exp)}
                  className="p-2 text-zinc-600 hover:text-yellow-500 hover:bg-zinc-800 rounded-lg min-w-[44px] min-h-[44px] flex items-center justify-center"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                <button 
                  onClick={() => onDelete(exp.id)}
                  className="p-2 text-zinc-600 hover:text-red-500 hover:bg-zinc-800 rounded-lg min-w-[44px] min-h-[44px] flex items-center justify-center"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

const ExpenseChat = ({ 
  filteredExpenses, 
  onEdit,
  viewMonth
}: { 
  filteredExpenses: any[], 
  onEdit: (exp: any) => void,
  viewMonth: string
}) => {
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [extractedData, setExtractedData] = useState<ExtractedData | null>(null);
  const { cards, expenseCategories, addExpense, addInstallmentExpense, lastUsedPaymentMethod, setLastUsedPaymentMethod, deleteExpense } = useFinance();
  const [messages, setMessages] = useState<{ role: 'user' | 'ai'; content: string }[]>([
    { role: 'ai', content: 'Olá! Sou seu tutor financeiro. Me diga quanto você gastou e com o quê.' }
  ]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const handleSend = async () => {
    if (!input.trim()) return;

    const userText = input;
    setInput('');
    const newMessages = [...messages, { role: 'user' as const, content: userText }];
    setMessages(newMessages);
    setIsLoading(true);
    setExtractedData(null);

    try {
      const history = newMessages; 
      const categories = expenseCategories.map(c => c.name);
      const cardNames = cards.map(c => c.name);
      
      const result = await parseTransactionText(userText, history, categories, cardNames);
      setExtractedData(result);
      
      setMessages(prev => [...prev, { role: 'ai', content: 'Analisei seu gasto. Confira os dados abaixo e confirme.' }]);

    } catch (error) {
      setMessages(prev => [...prev, { role: 'ai', content: 'Erro ao processar. Tente novamente.' }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirm = async () => {
    if (!extractedData) return;

    // Find IDs or use defaults
    const categoryId = expenseCategories.find(c => c.name.toLowerCase() === extractedData.category?.toLowerCase())?.id || expenseCategories[0]?.id;
    
    // Map payment method
    let paymentMethod = lastUsedPaymentMethod || 'cash';
    if (extractedData.paymentMethod) {
      const lowerPM = extractedData.paymentMethod.toLowerCase();
      if (lowerPM === 'dinheiro' || lowerPM === 'cash') {
        paymentMethod = 'cash';
      } else {
        const foundCard = cards.find(c => c.name.toLowerCase().includes(lowerPM));
        if (foundCard) paymentMethod = foundCard.id;
      }
    }

    const baseData = {
      title: extractedData.name || 'Sem título',
      categoryId,
      purchaseDate: extractedData.purchaseDate || new Date().toISOString().slice(0, 10),
      billingMonth: extractedData.billingMonth || format(addMonths(new Date(), 1), 'yyyy-MM'),
      isInstallment: extractedData.isInstallment || (extractedData.installments || 1) > 1,
      totalValue: extractedData.value || 0,
      installmentValue: (extractedData.value || 0) / (extractedData.installments || 1),
      paymentMethod,
      isPaid: false,
    };

    if (baseData.isInstallment) {
      await addInstallmentExpense(baseData, baseData.billingMonth, extractedData.installments || 1);
    } else {
      await addExpense({ ...baseData, type: 'one_time' });
    }

    setLastUsedPaymentMethod(paymentMethod);
    setMessages(prev => [...prev, { role: 'ai', content: 'Lançamento salvo com sucesso!' }]);
    setExtractedData(null);
    // Focus input after confirm
    setTimeout(() => {
      const inputEl = document.querySelector('input[placeholder="Digite seu gasto..."]') as HTMLInputElement;
      if (inputEl) inputEl.focus();
    }, 100);
  };

  // Helper to fill missing data
  const updateData = (key: keyof ExtractedData, value: any) => {
    if (extractedData) {
      setExtractedData({ ...extractedData, [key]: value });
    }
  };

  return (
    <div className="space-y-6 relative">
      {/* Chat Area */}
      <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl flex flex-col relative">
        <div className="p-4 space-y-4 min-h-[200px] max-h-[60vh] overflow-y-auto">
          {messages.map((msg, idx) => (
            <div key={idx} className={cn("flex", msg.role === 'user' ? "justify-end" : "justify-start")}>
              <div className={cn(
                "max-w-[85%] rounded-2xl px-4 py-3 text-sm",
                msg.role === 'user' 
                  ? "bg-zinc-800 text-zinc-100 rounded-tr-none" 
                  : "bg-yellow-500/10 text-yellow-500 rounded-tl-none border border-yellow-500/20"
              )}>
                {msg.content}
              </div>
            </div>
          ))}
          {isLoading && <div className="text-zinc-500 text-sm animate-pulse">Digitando...</div>}

          {/* Confirmation Card Inside Chat */}
          {extractedData && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="w-full"
            >
              <Card className="border-yellow-500/50 p-4 bg-zinc-900/80 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-zinc-100">Confirmar Lançamento</h3>
                  <Button size="sm" variant="ghost" onClick={() => setExtractedData(null)}><X className="w-4 h-4" /></Button>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Input 
                    label="Nome" 
                    value={extractedData.name || ''} 
                    onChange={e => updateData('name', e.target.value)} 
                  />
                  <Input 
                    label="Valor" 
                    type="number" 
                    value={extractedData.value || ''} 
                    onChange={e => updateData('value', parseFloat(e.target.value))} 
                  />
                  
                  <div className="space-y-1">
                    <Select
                      label="Categoria"
                      value={expenseCategories.find(c => c.name === extractedData.category)?.id || ''}
                      onChange={e => {
                        const cat = expenseCategories.find(c => c.id === e.target.value);
                        updateData('category', cat?.name);
                      }}
                    >
                      <option value="">Selecione...</option>
                      {expenseCategories.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </Select>
                    {!extractedData.category && (
                      <div className="flex flex-wrap gap-2 pt-1">
                        {expenseCategories.slice(0, 5).map(c => (
                          <button 
                            key={c.id}
                            onClick={() => updateData('category', c.name)}
                            className="px-2 py-1 text-[10px] rounded bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-300"
                          >
                            {c.name}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="space-y-1">
                    <Select
                      label="Pagamento"
                      value={extractedData.paymentMethod === 'Dinheiro' ? 'cash' : (cards.find(c => c.name === extractedData.paymentMethod)?.id || 'cash')}
                      onChange={e => {
                        const val = e.target.value;
                        if (val === 'cash') updateData('paymentMethod', 'Dinheiro');
                        else {
                          const card = cards.find(c => c.id === val);
                          updateData('paymentMethod', card?.name);
                        }
                      }}
                    >
                      <option value="cash">Dinheiro</option>
                      {cards.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </Select>
                    {(!extractedData.paymentMethod || extractedData.paymentMethod === 'Dinheiro') && (
                      <div className="flex flex-wrap gap-2 pt-1">
                        <button 
                          onClick={() => updateData('paymentMethod', 'Dinheiro')}
                          className="px-2 py-1 text-[10px] rounded bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-300"
                        >
                          Dinheiro
                        </button>
                        {cards.map(c => (
                          <button 
                            key={c.id}
                            onClick={() => updateData('paymentMethod', c.name)}
                            className="px-2 py-1 text-[10px] rounded bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-300"
                          >
                            {c.name}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="space-y-1">
                    <Input 
                      label="Data Compra" 
                      type="date"
                      value={extractedData.purchaseDate || ''} 
                      onChange={e => updateData('purchaseDate', e.target.value)} 
                    />
                    {extractedData.purchaseDate && (
                      <p className="text-[10px] text-zinc-500 pl-1">
                        {format(parseISO(extractedData.purchaseDate), 'dd/MM/yyyy')}
                      </p>
                    )}
                  </div>
                  <div className="space-y-1">
                    <Input 
                      label="Mês Fatura" 
                      type="month"
                      value={extractedData.billingMonth || ''} 
                      onChange={e => updateData('billingMonth', e.target.value)} 
                    />
                    {extractedData.billingMonth && (
                      <p className="text-[10px] text-zinc-500 pl-1 capitalize">
                        {format(parseISO(extractedData.billingMonth + '-01'), 'MMM/yyyy', { locale: ptBR })}
                      </p>
                    )}
                  </div>
                </div>

                {extractedData.isInstallment && (extractedData.installments || 1) > 1 && (
                  <div className="p-3 bg-yellow-500/10 rounded-xl border border-yellow-500/20 text-yellow-500 text-sm text-center font-medium">
                    Será salvo como: {extractedData.installments}x de {formatCurrency((extractedData.value || 0) / (extractedData.installments || 1))}
                  </div>
                )}

                <Button className="w-full bg-yellow-500 hover:bg-yellow-400 text-black font-bold" onClick={handleConfirm}>
                  <Check className="w-4 h-4 mr-2" /> Confirmar Lançamento
                </Button>
              </Card>
            </motion.div>
          )}
          
          <div ref={messagesEndRef} />
        </div>

        <div className="p-4 border-t border-zinc-800 bg-zinc-950 rounded-b-2xl sticky bottom-0 z-10">
          <div className="flex gap-2 items-center">
            <Input 
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder="Digite seu gasto..."
              className="bg-zinc-900 border-zinc-800 focus:ring-yellow-500/20 text-base"
            />
            <Button size="icon" onClick={handleSend} disabled={isLoading || !input.trim()}>
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

const HistoryModal = ({ 
  isOpen, 
  onClose, 
  title, 
  history 
}: { 
  isOpen: boolean; 
  onClose: () => void; 
  title: string; 
  history: any[] 
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[130] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md"
      >
        <Card className="relative border-zinc-800 shadow-2xl bg-zinc-950">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-bold text-zinc-100">Histórico: {title}</h3>
            <button onClick={onClose} className="p-2 text-zinc-500 hover:text-zinc-200 transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
            {history.length === 0 ? (
              <p className="text-center text-zinc-500 py-4">Nenhum histórico registrado.</p>
            ) : (
              history.map((h, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 rounded-xl bg-zinc-900 border border-zinc-800">
                  <div className="flex flex-col">
                    <span className="text-xs text-zinc-500 capitalize">
                      {format(parseISO(h.monthYear + '-01'), 'MM/yyyy', { locale: ptBR })}
                    </span>
                    <span className="text-sm font-medium text-zinc-200">
                      {h.paymentMethod === 'cash' ? 'Dinheiro' : 'Cartão'}
                    </span>
                  </div>
                  <span className="font-bold text-yellow-500">
                    {formatCurrency(h.value)}
                  </span>
                </div>
              ))
            )}
          </div>

          <div className="mt-8">
            <Button className="w-full" onClick={onClose}>Fechar</Button>
          </div>
        </Card>
      </motion.div>
    </div>
  );
};
