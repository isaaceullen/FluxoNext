import React, { useState } from 'react';
import { useFinance } from '../hooks/useFinance';
import { Card, Button, Input, Select } from './ui';
import { Plus, Trash2, Edit2, DollarSign, X, Check } from 'lucide-react';
import { formatCurrency, cn } from '../utils';
import { motion } from 'motion/react';
import { format } from 'date-fns';

export const Income = () => {
  const { incomes, incomeCategories, cards, addIncome, updateIncome, deleteIncome, updateFixedIncomeValue, getIncomeValueForMonth } = useFinance();
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ title: '', amount: '', category: '', paymentMethod: 'cash' });
  
  // Form State
  const [incomeType, setIncomeType] = useState<'fixed' | 'temporary'>('fixed');
  const [formData, setFormData] = useState({
    title: '',
    amount: '',
    category: '',
    paymentMethod: 'cash',
    startMonth: new Date().toISOString().slice(0, 7), // YYYY-MM
    durationMonths: '1',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(formData.amount);
    if (!amount || !formData.title) return;

    const baseData = {
      title: formData.title,
      categoryId: formData.category || incomeCategories[0]?.id,
      type: incomeType,
      paymentMethod: formData.paymentMethod,
    };

    if (incomeType === 'fixed') {
      const currentMonth = new Date().toISOString().slice(0, 7);
      addIncome({
        ...baseData,
        valueHistory: [{ monthYear: currentMonth, value: amount, paymentMethod: formData.paymentMethod }]
      });
    } else {
      addIncome({
        ...baseData,
        amount,
        startMonth: formData.startMonth,
        durationMonths: parseInt(formData.durationMonths) || 1
      });
    }

    setIsAdding(false);
    setFormData({
      title: '',
      amount: '',
      category: '',
      paymentMethod: 'cash',
      startMonth: new Date().toISOString().slice(0, 7),
      durationMonths: '1',
    });
  };

  const startEdit = (inc: any) => {
    setEditingId(inc.id);
    const currentVal = inc.type === 'fixed' 
      ? getIncomeValueForMonth(inc, new Date().toISOString().slice(0, 7))
      : inc.amount;

    const latest = inc.valueHistory?.[inc.valueHistory.length - 1];

    setEditForm({ 
      title: inc.title, 
      amount: currentVal.toString(), 
      category: inc.categoryId,
      paymentMethod: latest?.paymentMethod || inc.paymentMethod || 'cash'
    });
  };

  const saveEdit = () => {
    if (editingId && editForm.title && editForm.amount) {
      const income = incomes.find(i => i.id === editingId);
      if (!income) return;

      const newAmount = parseFloat(editForm.amount);

      if (income.type === 'fixed') {
        updateIncome(editingId, {
          title: editForm.title,
          categoryId: editForm.category
        });
        const currentMonth = new Date().toISOString().slice(0, 7);
        updateFixedIncomeValue(editingId, currentMonth, newAmount, editForm.paymentMethod);
      } else {
        updateIncome(editingId, {
          title: editForm.title,
          amount: newAmount,
          categoryId: editForm.category,
          paymentMethod: editForm.paymentMethod
        });
      }
      setEditingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-zinc-100">Receitas</h2>
        <Button onClick={() => setIsAdding(true)} size="sm" className="sm:flex">
          <Plus className="w-4 h-4 mr-2" /> <span className="hidden sm:inline">Nova Receita</span><span className="sm:hidden">Nova</span>
        </Button>
      </div>

      {isAdding && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-sm">
          <motion.div 
            initial={{ opacity: 0, y: 100 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-zinc-950 border-t sm:border border-zinc-800 rounded-t-3xl sm:rounded-2xl p-6 w-full max-w-2xl shadow-2xl overflow-y-auto max-h-[90vh]"
          >
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-zinc-100">Nova Receita</h3>
              <button onClick={() => setIsAdding(false)} className="p-2 text-zinc-400 hover:text-zinc-100">
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="flex bg-zinc-900 p-1 rounded-xl border border-zinc-800 mb-4">
                <button
                  type="button"
                  onClick={() => setIncomeType('fixed')}
                  className={cn(
                    "flex-1 py-2 rounded-lg text-sm font-medium transition-all",
                    incomeType === 'fixed' 
                      ? 'bg-emerald-500/10 text-emerald-500' 
                      : 'text-zinc-400 hover:text-zinc-200'
                  )}
                >
                  Fixa
                </button>
                <button
                  type="button"
                  onClick={() => setIncomeType('temporary')}
                  className={cn(
                    "flex-1 py-2 rounded-lg text-sm font-medium transition-all",
                    incomeType === 'temporary' 
                      ? 'bg-emerald-500/10 text-emerald-500' 
                      : 'text-zinc-400 hover:text-zinc-200'
                  )}
                >
                  Temporária
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input 
                  label="Descrição" 
                  value={formData.title} 
                  onChange={e => setFormData({...formData, title: e.target.value})}
                  required
                />
                <Input 
                  label="Valor" 
                  type="number" step="0.01"
                  value={formData.amount} 
                  onChange={e => setFormData({...formData, amount: e.target.value})}
                  required
                />
                <Select
                  label="Categoria"
                  value={formData.category}
                  onChange={e => setFormData({ ...formData, category: e.target.value })}
                >
                  <option value="">Selecione...</option>
                  {incomeCategories.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </Select>
                <Select
                  label="Receber em"
                  value={formData.paymentMethod}
                  onChange={e => setFormData({ ...formData, paymentMethod: e.target.value })}
                >
                  <option value="cash">Dinheiro / Débito</option>
                  {cards.map(c => (
                    <option key={c.id} value={c.id}>Cartão: {c.name}</option>
                  ))}
                </Select>
                
                {incomeType === 'temporary' && (
                  <>
                    <Input 
                      label="Mês de Início" 
                      type="month"
                      value={formData.startMonth} 
                      onChange={e => setFormData({...formData, startMonth: e.target.value})}
                      required
                    />
                     <Input 
                      label="Duração (Meses)" 
                      type="number" min="1"
                      value={formData.durationMonths} 
                      onChange={e => setFormData({...formData, durationMonths: e.target.value})}
                      required
                    />
                  </>
                )}
              </div>

              <div className="flex flex-col sm:flex-row justify-end gap-3 pt-4">
                <Button type="button" variant="ghost" onClick={() => setIsAdding(false)} className="w-full sm:w-auto">Cancelar</Button>
                <Button type="submit" className="w-full sm:w-auto bg-emerald-500 hover:bg-emerald-400 text-black font-bold">
                  Salvar Receita
                </Button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      <div className="space-y-2">
        {incomes.length === 0 ? (
          <div className="text-center py-10 text-zinc-500">Nenhuma receita cadastrada.</div>
        ) : (
          incomes.map(inc => {
            const currentVal = getIncomeValueForMonth(inc, new Date().toISOString().slice(0, 7));
            const category = incomeCategories.find(c => c.id === inc.categoryId);

            return (
              <div key={inc.id} className="bg-zinc-900/50 border border-zinc-800 p-3 sm:p-4 rounded-xl flex items-center justify-between group">
                {editingId === inc.id ? (
                  <div className="flex flex-col sm:flex-row gap-3 w-full items-start sm:items-center">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full">
                      <Input 
                        value={editForm.title} 
                        onChange={e => setEditForm({...editForm, title: e.target.value})}
                        className="w-full"
                      />
                      <Input 
                        type="number"
                        value={editForm.amount} 
                        onChange={e => setEditForm({...editForm, amount: e.target.value})}
                        className="w-full"
                      />
                      <Select
                        value={editForm.category}
                        onChange={e => setEditForm({ ...editForm, category: e.target.value })}
                        className="w-full"
                      >
                        {incomeCategories.map(c => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </Select>
                      <Select
                        value={editForm.paymentMethod}
                        onChange={e => setEditForm({ ...editForm, paymentMethod: e.target.value })}
                        className="w-full"
                      >
                        <option value="cash">Dinheiro / Débito</option>
                        {cards.map(c => (
                          <option key={c.id} value={c.id}>Cartão: {c.name}</option>
                        ))}
                      </Select>
                    </div>
                    <div className="flex gap-2 w-full sm:w-auto justify-end">
                      <button onClick={saveEdit} className="p-3 text-emerald-500 hover:bg-emerald-500/10 rounded-xl min-w-[44px] min-h-[44px] flex items-center justify-center border border-zinc-800 sm:border-none"><Check className="w-5 h-5" /></button>
                      <button onClick={() => setEditingId(null)} className="p-3 text-red-500 hover:bg-red-500/10 rounded-xl min-w-[44px] min-h-[44px] flex items-center justify-center border border-zinc-800 sm:border-none"><X className="w-5 h-5" /></button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-3 sm:gap-4">
                      <div className="p-2 bg-emerald-500/10 rounded-lg text-emerald-500">
                        <DollarSign className="w-4 h-4 sm:w-5 sm:h-5" />
                      </div>
                      <div>
                        <h4 className="font-medium text-zinc-200 text-sm sm:text-base">{inc.title}</h4>
                        <div className="flex flex-wrap gap-x-2 gap-y-1 text-[10px] sm:text-xs text-zinc-500">
                          <span className="text-zinc-400">{category?.name}</span>
                          <span className="text-zinc-600">•</span>
                          {inc.type === 'fixed' 
                            ? <span className="text-emerald-400">Fixa</span>
                            : <span>{inc.durationMonths} meses</span>
                          }
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 sm:gap-4">
                      <span className="font-bold text-emerald-500 text-sm sm:text-base">{formatCurrency(currentVal)}</span>
                      <div className="flex gap-1 sm:opacity-0 sm:group-hover:opacity-100 transition-all">
                        <button 
                          onClick={() => startEdit(inc)}
                          className="p-2 text-zinc-600 hover:text-yellow-500 hover:bg-zinc-800 rounded-lg min-w-[44px] min-h-[44px] flex items-center justify-center"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => deleteIncome(inc.id)}
                          className="p-2 text-zinc-600 hover:text-red-500 hover:bg-zinc-800 rounded-lg min-w-[44px] min-h-[44px] flex items-center justify-center"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
