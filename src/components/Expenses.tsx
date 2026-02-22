import React, { useState, useRef } from 'react';
import { useFinance } from '../hooks/useFinance';
import { Card, Button, Input, Select } from './ui';
import { Plus, Trash2, Calendar, CreditCard as CardIcon, DollarSign, MessageSquare, List, Send, Check, Edit2 } from 'lucide-react';
import { formatCurrency, cn } from '../utils';
import { format, parseISO, addMonths } from 'date-fns';
import { parseTransactionText } from '../services/geminiService';
import { ExtractedData } from '../types';
import { motion } from 'motion/react';
import { LoginModal } from './LoginModal';

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
    setLastUsedPaymentMethod
  } = useFinance();
  const [activeTab, setActiveTab] = useState<'manual' | 'fixed' | 'chat'>('chat');
  const [showLoginModal, setShowLoginModal] = useState(false);
  
  // View State (for the list below)
  const [viewMonth, setViewMonth] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM

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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title || !formData.totalValue) return;

    const totalVal = parseFloat(formData.totalValue);
    const instVal = formData.isInstallment ? parseFloat(formData.installmentValue) : totalVal;

    if (formData.id) {
      // Update existing
      if (activeTab === 'fixed') {
        updateFixedExpenseValue(formData.id, format(new Date(), 'yyyy-MM'), totalVal, formData.paymentMethod);
        updateExpense(formData.id, { title: formData.title, categoryId: formData.categoryId });
      } else {
        updateExpense(formData.id, {
          title: formData.title,
          categoryId: formData.categoryId,
          totalValue: totalVal,
          installmentValue: instVal,
          paymentMethod: formData.paymentMethod,
          installments: formData.isInstallment ? { current: 1, total: formData.totalInstallments } : undefined
        });
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

  // Filter expenses by PURCHASE DATE for the list
  const filteredExpenses = expenses
    .filter(e => e.purchaseDate.startsWith(viewMonth))
    .reduce((acc: any[], curr) => {
      if (curr.originalId) {
        if (!acc.find(i => i.originalId === curr.originalId)) {
          acc.push(curr);
        }
      } else {
        acc.push(curr);
      }
      return acc;
    }, [])
    .sort((a, b) => new Date(b.purchaseDate).getTime() - new Date(a.purchaseDate).getTime());

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-zinc-100">Despesas</h2>
        <div className="flex bg-zinc-900 p-1 rounded-xl border border-zinc-800">
          <button
            onClick={() => setActiveTab('manual')}
            className={cn(
              "px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2",
              activeTab === 'manual' ? "bg-yellow-500/10 text-yellow-500" : "text-zinc-400 hover:text-zinc-200"
            )}
          >
            <List className="w-4 h-4" /> Manual
          </button>
          <button
            onClick={() => setActiveTab('fixed')}
            className={cn(
              "px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2",
              activeTab === 'fixed' ? "bg-yellow-500/10 text-yellow-500" : "text-zinc-400 hover:text-zinc-200"
            )}
          >
            <Calendar className="w-4 h-4" /> Fixas
          </button>
          <button
            onClick={() => setActiveTab('chat')}
            className={cn(
              "px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2",
              activeTab === 'chat' ? "bg-yellow-500/10 text-yellow-500" : "text-zinc-400 hover:text-zinc-200"
            )}
          >
            <MessageSquare className="w-4 h-4" /> Chat IA
          </button>
        </div>
      </div>

      {activeTab === 'chat' ? (
        user ? (
          <ExpenseChat />
        ) : (
          <div className="relative h-[600px] bg-zinc-900/50 border border-zinc-800 rounded-2xl overflow-hidden flex items-center justify-center p-8 text-center">
            <div className="max-w-xs space-y-4">
              <div className="w-16 h-16 bg-yellow-500/10 rounded-full flex items-center justify-center text-yellow-500 mx-auto">
                <MessageSquare className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-bold text-zinc-100">Chat IA Bloqueado</h3>
              <p className="text-zinc-400 text-sm">
                Faça login para usar nossa inteligência artificial e lançar gastos por texto ou voz.
              </p>
              <Button onClick={() => setShowLoginModal(true)} className="w-full bg-yellow-500 hover:bg-yellow-400 text-black font-bold">
                Fazer Login
              </Button>
            </div>
          </div>
        )
      ) : (
        <>
          <Card className="border-yellow-500/50">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {activeTab === 'manual' && (
                  <>
                    <Input 
                      label="Data da Compra" 
                      type="date"
                      value={formData.purchaseDate} 
                      onChange={e => setFormData({...formData, purchaseDate: e.target.value})}
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
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-zinc-300">Histórico de Compras</h3>
              <Input 
                type="month" 
                value={viewMonth}
                onChange={e => setViewMonth(e.target.value)}
                className="w-40"
              />
            </div>

            <div className="space-y-2">
              {filteredExpenses.length === 0 ? (
                <div className="text-center py-10 text-zinc-500">Nenhuma compra neste mês.</div>
              ) : (
                filteredExpenses.map(exp => {
                  const category = expenseCategories.find(c => c.id === exp.categoryId);
                  const card = cards.find(c => c.id === exp.paymentMethod);
                  
                  return (
                    <div key={exp.id} className="bg-zinc-900/50 border border-zinc-800 p-4 rounded-xl flex items-center justify-between group">
                      <div className="flex items-center gap-4">
                        <div className="p-2 bg-red-500/10 rounded-lg text-red-500">
                          {card ? <CardIcon className="w-5 h-5" /> : <DollarSign className="w-5 h-5" />}
                        </div>
                        <div>
                          <h4 className="font-medium text-zinc-200">{exp.title}</h4>
                          <div className="flex gap-2 text-xs text-zinc-500">
                            <span>{format(parseISO(exp.purchaseDate), 'dd/MM/yyyy')}</span>
                            <span className="text-zinc-600">•</span>
                            <span style={{ color: category?.color }}>{category?.name}</span>
                            {exp.type === 'fixed' && <span className="text-emerald-500">• Fixa</span>}
                            {exp.installments && (
                              <>
                                <span className="text-zinc-600">•</span>
                                <span className="text-yellow-500">{exp.installments.total}x de {formatCurrency(exp.installmentValue)}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="font-bold text-zinc-200">{formatCurrency(exp.totalValue)}</span>
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
                          <button 
                            onClick={() => {
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
                              setActiveTab(exp.type === 'fixed' ? 'fixed' : 'manual');
                              window.scrollTo({ top: 0, behavior: 'smooth' });
                            }}
                            className="p-2 text-zinc-600 hover:text-yellow-500 hover:bg-zinc-800 rounded-lg"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => deleteExpense(exp.id)}
                            className="p-2 text-zinc-600 hover:text-red-500 hover:bg-zinc-800 rounded-lg"
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
    </div>
  );
};

const ExpenseChat = () => {
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [extractedData, setExtractedData] = useState<ExtractedData | null>(null);
  const { cards, expenseCategories, addExpense, addInstallmentExpense, lastUsedPaymentMethod, setLastUsedPaymentMethod } = useFinance();
  const [messages, setMessages] = useState<{ role: 'user' | 'ai'; content: string | React.ReactNode }[]>([
    { role: 'ai', content: 'Digite seu gasto. Ex: "Uber de 25 reais no Nubank"' }
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
        <div className="flex gap-2">
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
