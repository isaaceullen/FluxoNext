import React, { useState } from 'react';
import { useFinance } from '../hooks/useFinance';
import { Card, Button, Input } from './ui';
import { Plus, Trash2, Edit2, X, Check } from 'lucide-react';
import { Category } from '../types';
import { cn } from '../utils';
import { motion } from 'motion/react';

export const Categories = () => {
  const { incomeCategories, expenseCategories, addCategory, updateCategory, deleteCategory } = useFinance();
  const [activeTab, setActiveTab] = useState<'expense' | 'income'>('expense');
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newCategory, setNewCategory] = useState({ name: '', color: '#F59E0B' });
  const [editForm, setEditForm] = useState({ name: '', color: '' });

  const currentCategories = activeTab === 'expense' ? expenseCategories : incomeCategories;

  const handleAdd = async () => {
    if (!newCategory.name) return;
    await addCategory({ ...newCategory, type: activeTab });
    setNewCategory({ name: '', color: '#F59E0B' });
    setIsAdding(false);
  };

  const startEdit = (category: Category) => {
    setEditingId(category.id);
    setEditForm({ name: category.name, color: category.color });
  };

  const saveEdit = async () => {
    if (editingId && editForm.name) {
      await updateCategory(editingId, editForm);
      setEditingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h2 className="text-2xl font-bold text-zinc-100">Categorias</h2>
        <div className="flex bg-zinc-900 p-1 rounded-xl border border-zinc-800">
          <button
            onClick={() => setActiveTab('expense')}
            className={cn(
              "flex-1 sm:flex-none px-4 py-2 rounded-lg text-sm font-medium transition-all",
              activeTab === 'expense' ? 'bg-red-500/10 text-red-500' : 'text-zinc-400 hover:text-zinc-200'
            )}
          >
            Despesas
          </button>
          <button
            onClick={() => setActiveTab('income')}
            className={cn(
              "flex-1 sm:flex-none px-4 py-2 rounded-lg text-sm font-medium transition-all",
              activeTab === 'income' ? 'bg-emerald-500/10 text-emerald-500' : 'text-zinc-400 hover:text-zinc-200'
            )}
          >
            Receitas
          </button>
        </div>
      </div>

      <div className="flex justify-end">
        <Button onClick={() => setIsAdding(true)} size="sm" className="w-full sm:w-auto">
          <Plus className="w-4 h-4 mr-2" /> Nova Categoria
        </Button>
      </div>

      {isAdding && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-zinc-950 border border-zinc-800 rounded-2xl p-6 w-full max-w-lg shadow-2xl"
          >
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-zinc-100">Nova Categoria</h3>
              <button onClick={() => setIsAdding(false)} className="p-2 text-zinc-400 hover:text-zinc-100">
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-4">
              <Input 
                label="Nome" 
                value={newCategory.name} 
                onChange={e => setNewCategory({...newCategory, name: e.target.value})}
                autoFocus
                required
              />
              <div className="space-y-1">
                <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Cor</label>
                <div className="flex items-center gap-3">
                  <input 
                    type="color" 
                    value={newCategory.color}
                    onChange={e => setNewCategory({...newCategory, color: e.target.value})}
                    className="h-12 w-full rounded-xl cursor-pointer bg-zinc-900 border border-zinc-800 p-1"
                  />
                  <div className="w-12 h-12 rounded-xl shrink-0" style={{ backgroundColor: newCategory.color }} />
                </div>
              </div>
              
              <div className="flex flex-col sm:flex-row justify-end gap-3 pt-4">
                <Button variant="ghost" onClick={() => setIsAdding(false)} className="w-full sm:w-auto">Cancelar</Button>
                <Button onClick={handleAdd} className="w-full sm:w-auto bg-yellow-500 hover:bg-yellow-400 text-black font-bold">
                  Salvar Categoria
                </Button>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {currentCategories.map(category => (
          <Card key={category.id} className="flex items-center justify-between group p-3 sm:p-4">
            {editingId === category.id ? (
              <div className="flex flex-col sm:flex-row gap-2 w-full items-start sm:items-center">
                <div className="flex gap-2 w-full">
                  <Input 
                    value={editForm.name} 
                    onChange={e => setEditForm({...editForm, name: e.target.value})}
                    className="h-10 flex-1"
                  />
                  <input 
                    type="color" 
                    value={editForm.color}
                    onChange={e => setEditForm({...editForm, color: e.target.value})}
                    className="h-10 w-10 rounded-xl cursor-pointer bg-zinc-900 border border-zinc-800 p-1"
                  />
                </div>
                <div className="flex gap-2 w-full sm:w-auto justify-end">
                  <button onClick={saveEdit} className="p-2 text-emerald-500 hover:bg-emerald-500/10 rounded-xl min-w-[44px] min-h-[44px] flex items-center justify-center border border-zinc-800 sm:border-none"><Check className="w-5 h-5" /></button>
                  <button onClick={() => setEditingId(null)} className="p-2 text-red-500 hover:bg-red-500/10 rounded-xl min-w-[44px] min-h-[44px] flex items-center justify-center border border-zinc-800 sm:border-none"><X className="w-5 h-5" /></button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-3">
                  <div className="w-4 h-4 rounded-full" style={{ backgroundColor: category.color }} />
                  <span className="font-medium text-zinc-200">{category.name}</span>
                </div>
                <div className="flex gap-1 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                  <button onClick={() => startEdit(category)} className="p-2 text-zinc-400 hover:text-yellow-500 hover:bg-zinc-800 rounded-lg min-w-[44px] min-h-[44px] flex items-center justify-center">
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button onClick={() => deleteCategory(category.id)} className="p-2 text-zinc-400 hover:text-red-500 hover:bg-zinc-800 rounded-lg min-w-[44px] min-h-[44px] flex items-center justify-center">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
};
