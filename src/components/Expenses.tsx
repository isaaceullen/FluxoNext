import React, { useState, useRef } from 'react';
import { useFinance } from '../hooks/useFinance';
import { Card, Button, Input, Select } from './ui';
import { Plus, Trash2, Calendar, CreditCard as CardIcon, DollarSign, MessageSquare, List, Send, Check, Edit2, ArrowLeft, ArrowRight, ChevronDown, X, Search, Filter } from 'lucide-react';
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
}

const initialFilters: FilterState = {
  categoryId: '',
  paymentMethod: '',
  minValue: '',
  maxValue: '',
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

  const handleSubmit = (e: React.FormEvent) => {
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
        updateFixedExpenseValue(formData.id, format(new Date(), 'yyyy-MM'), totalVal, formData.paymentMethod);
        updateExpense(formData.id, { title: formData.title, categoryId: formData.categoryId });
      } else if (exp?.originalId) {
        // It's an installment, show modal
        setInstallmentEditData({ expense: exp, updates });
      } else {
        updateExpense(formData.id, updates);
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
        addExpense({
          ...baseData,
          type: 'fixed',
          valueHistory: [{ monthYear: format(new Date(), 'yyyy-MM'), value: totalVal, paymentMethod: formData.paymentMethod }]
        });
      } else if (formData.isInstallment) {
        addInstallmentExpense(baseData, formData.billingMonth, formData.totalInstallments);
      } else {
        addExpense({ ...baseData, type: 'one_time' });
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
            <span className="hidden sm:inline">Manual</span>
            <span className="sm:hidden">Manual</span>
          </button>
          <button
            onClick={() => setActiveTab('fixed')}
            className={cn(
              "flex-1 sm:flex-none px-3 sm:px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2 whitespace-nowrap",
              activeTab === 'fixed' ? "bg-yellow-500/10 text-yellow-500" : "text-zinc-400 hover:text-zinc-200"
            )}
          >
            <Calendar className="w-4 h-4" /> 
            <span className="hidden sm:inline">Fixas</span>
            <span className="sm:hidden">Fixas</span>
          </button>
          <button
            onClick={() => setActiveTab('chat')}
            className={cn(
              "flex-1 sm:flex-none px-3 sm:px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2 whitespace-nowrap",
              activeTab === 'chat' ? "bg-yellow-500/10 text-yellow-500" : "text-zinc-400 hover:text-zinc-200"
            )}
          >
            <MessageSquare className="w-4 h-4" /> 
            <span className="hidden sm:inline">Chat IA</span>
            <span className="sm:hidden">IA</span>
          </button>
        </div>
      </div>

      {activeTab === 'chat' ? (
        user ? (
          <ExpenseChat />
        ) : (
          <div className="relative h-[400px] sm:h-[600px] bg-zinc-900/50 border border-zinc-800 rounded-2xl overflow-hidden flex items-center justify-center p-6 sm:p-8 text-center">
            <div className="max-w-xs w-full space-y-4">
              <div className="w-12 h-12 sm:w-16 sm:h-16 bg-yellow-500/10 rounded-full flex items-center justify-center text-yellow-500 mx-auto">
                <MessageSquare className="w-6 h-6 sm:w-8 sm:h-8" />
              </div>
              <h3 className="text-lg sm:text-xl font-bold text-zinc-100">Chat IA Bloqueado</h3>
              <p className="text-zinc-400 text-xs sm:text-sm">
                Faça login para usar nossa inteligência artificial e lançar gastos por texto ou voz.
              </p>
              <Button onClick={() => setShowLoginModal(true)} className="w-full bg-yellow-500 hover:bg-yellow-400 text-black font-bold py-3">
                Fazer Login
              </Button>
            </div>
          </div>
        )
      ) : (
        <>
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
                {Object.values(activeFilters).some(v => v !== '') && (
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
                    {format(parseISO(viewMonth + '-01'), 'MMMM yyyy', { locale: ptBR })}
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
                            {format(parseISO(m + '-01'), 'MMMM yyyy', { locale: ptBR })}
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

            <div className="grid grid-cols-1 gap-3">
              {filteredExpenses.length === 0 ? (
                <div className="text-center py-10 text-zinc-500">Nenhuma despesa para esta fatura.</div>
              ) : (
                filteredExpenses.map(exp => {
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
                            <span>{format(parseISO(exp.purchaseDate), 'dd/MM/yy')}</span>
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
                          <button 
                            onClick={() => {
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
                              });
                              setActiveTab(exp.type === 'fixed' ? 'fixed' : 'manual');
                              window.scrollTo({ top: 0, behavior: 'smooth' });
                            }}
                            className="p-2 text-zinc-600 hover:text-yellow-500 hover:bg-zinc-800 rounded-lg min-w-[44px] min-h-[44px] flex items-center justify-center"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => deleteExpense(exp.id)}
                            className="p-2 text-zinc-600 hover:text-red-500 hover:bg-zinc-800 rounded-lg min-w-[44px] min-h-[44px] flex items-center justify-center"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </>
      )}
      {showLoginModal && <LoginModal onClose={() => setShowLoginModal(false)} />}
      
      <FilterModal 
        isOpen={isFilterModalOpen}
        onClose={() => setIsFilterModalOpen(false)}
        onApply={setActiveFilters}
        initialFilters={activeFilters}
        categories={expenseCategories}
        cards={cards}
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
                const empty = { categoryId: '', paymentMethod: '', minValue: '', maxValue: '' };
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

const ExpenseChat = () => {
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [extractedData, setExtractedData] = useState<ExtractedData | null>(null);
  const { cards, expenseCategories, addExpense, addInstallmentExpense, lastUsedPaymentMethod, setLastUsedPaymentMethod } = useFinance();
  const [messages, setMessages] = useState<{ role: 'user' | 'ai'; content: string | React.ReactNode }[]>([
    { role: 'ai', content: 'Digite seu gasto para eu registrar.' }
  ]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const handleSend = async () => {
    if (!input.trim()) return;

    const userText = input;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userText }]);
    setIsLoading(true);
    setExtractedData(null);

    try {
      const result = await parseTransactionText(userText);
      // Map new AI fields to ExtractedData if needed, but we already updated the interface
      setExtractedData(result);
      
      if (result.missingFields && result.missingFields.length > 0 && result.missingFields[0] !== 'error') {
         setMessages(prev => [...prev, { 
           role: 'ai', 
           content: `Preciso de mais detalhes: ${result.missingFields.join(', ')}` 
         }]);
      } else {
         setMessages(prev => [...prev, { role: 'ai', content: 'Confira os dados abaixo:' }]);
      }

    } catch (error) {
      setMessages(prev => [...prev, { role: 'ai', content: 'Erro ao processar. Tente novamente.' }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirm = () => {
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
      addInstallmentExpense(baseData, baseData.billingMonth, extractedData.installments || 1);
    } else {
      addExpense({ ...baseData, type: 'one_time' });
    }

    setLastUsedPaymentMethod(paymentMethod);
    setMessages(prev => [...prev, { role: 'ai', content: 'Lançamento salvo!' }]);
    setExtractedData(null);
  };

  // Helper to fill missing data
  const fillData = (key: keyof ExtractedData, value: any) => {
    if (extractedData) {
      setExtractedData({ ...extractedData, [key]: value });
    }
  };

  return (
    <div className="flex flex-col h-[600px] bg-zinc-900/50 border border-zinc-800 rounded-2xl overflow-hidden">
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
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

        {extractedData && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-zinc-950 border border-zinc-800 rounded-xl p-4 space-y-3 max-w-md"
          >
            <div className="flex justify-between items-start">
              <div>
                <h3 className="font-medium text-zinc-100">{extractedData.name || '...'}</h3>
                <p className="text-xs text-zinc-400">{extractedData.purchaseDate || format(new Date(), 'dd/MM/yyyy')}</p>
              </div>
              <span className="text-lg font-bold text-yellow-500">{formatCurrency(extractedData.value || 0)}</span>
            </div>
            
            {/* Missing Category Selection */}
            {!extractedData.category && (
              <div className="space-y-2">
                <p className="text-xs text-zinc-500">Selecione a Categoria:</p>
                <div className="flex flex-wrap gap-2">
                  {expenseCategories.map(c => (
                    <button 
                      key={c.id}
                      onClick={() => fillData('category', c.name)}
                      className="px-2 py-1 text-xs rounded bg-zinc-800 hover:bg-zinc-700 border border-zinc-700"
                    >
                      {c.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-2 text-xs pt-2">
               {extractedData.category && (
                <span className="px-2 py-1 rounded-md bg-zinc-800 text-zinc-300 border border-zinc-700">
                  {extractedData.category}
                </span>
               )}
               {extractedData.paymentMethod && (
                <span className="px-2 py-1 rounded-md bg-purple-500/10 text-purple-400 border border-purple-500/20 flex items-center gap-1">
                  <CardIcon className="w-3 h-3" />
                  {extractedData.paymentMethod}
                </span>
               )}
               {extractedData.installments && extractedData.installments > 1 && (
                 <span className="px-2 py-1 rounded-md bg-yellow-500/10 text-yellow-500 border border-yellow-500/20">
                   {extractedData.installments}x
                 </span>
               )}
            </div>

            <div className="pt-2 flex gap-2">
              <Button size="sm" className="w-full" onClick={handleConfirm}>
                <Check className="w-4 h-4 mr-2" /> Confirmar
              </Button>
              <Button size="sm" variant="outline" className="w-full" onClick={() => setExtractedData(null)}>
                Cancelar
              </Button>
            </div>
          </motion.div>
        )}
        
        {isLoading && <div className="text-zinc-500 text-sm animate-pulse">Processando...</div>}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-4 border-t border-zinc-800 bg-zinc-950">
        <div className="flex gap-2 items-center">
          <Input 
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Digite seu gasto..."
            className="bg-zinc-900 border-zinc-800 focus:ring-yellow-500/20"
          />

          <Button size="icon" onClick={handleSend} disabled={isLoading || !input.trim()}>
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};
