import React, { useState } from 'react';
import { useFinance } from '../hooks/useFinance';
import { Card, Button, Input } from './ui';
import { Plus, Trash2, Edit2, X, Check } from 'lucide-react';
import { Category } from '../types';

export const Categories = () => {
  const { incomeCategories, expenseCategories, addCategory, updateCategory, deleteCategory } = useFinance();
  const [activeTab, setActiveTab] = useState<'expense' | 'income'>('expense');
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newCategory, setNewCategory] = useState({ name: '', color: '#F59E0B' });
  const [editForm, setEditForm] = useState({ name: '', color: '' });

  const currentCategories = activeTab === 'expense' ? expenseCategories : incomeCategories;

  const handleAdd = () => {
    if (!newCategory.name) return;
    addCategory({ ...newCategory, type: activeTab });
    setNewCategory({ name: '', color: '#F59E0B' });
    setIsAdding(false);
  };

  const startEdit = (category: Category) => {
    setEditingId(category.id);
    setEditForm({ name: category.name, color: category.color });
  };

  const saveEdit = () => {
    if (editingId && editForm.name) {
      updateCategory(editingId, editForm);
      setEditingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-zinc-100">Categorias</h2>
        <div className="flex bg-zinc-900 p-1 rounded-xl border border-zinc-800">
          <button
            onClick={() => setActiveTab('expense')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'expense' ? 'bg-red-500/10 text-red-500' : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Despesas
          </button>
          <button
            onClick={() => setActiveTab('income')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'income' ? 'bg-emerald-500/10 text-emerald-500' : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Receitas
          </button>
        </div>
      </div>

      <div className="flex justify-end">
        <Button onClick={() => setIsAdding(true)} size="sm">
          <Plus className="w-4 h-4 mr-2" /> Nova Categoria
        </Button>
      </div>

      {isAdding && (
        <Card className="mb-6 border-yellow-500/50">
          <div className="flex gap-4 items-end">
            <Input 
              label="Nome" 
              value={newCategory.name} 
              onChange={e => setNewCategory({...newCategory, name: e.target.value})}
              autoFocus
            />
            <div className="space-y-1">
              <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Cor</label>
              <input 
                type="color" 
                value={newCategory.color}
                onChange={e => setNewCategory({...newCategory, color: e.target.value})}
                className="h-10 w-20 rounded-xl cursor-pointer bg-zinc-900 border border-zinc-800 p-1"
              />
            </div>
            <Button onClick={handleAdd}>Salvar</Button>
            <Button variant="ghost" onClick={() => setIsAdding(false)}>Cancelar</Button>
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {currentCategories.map(category => (
          <Card key={category.id} className="flex items-center justify-between group">
            {editingId === category.id ? (
              <div className="flex gap-2 w-full items-center">
                <Input 
                  value={editForm.name} 
                  onChange={e => setEditForm({...editForm, name: e.target.value})}
                  className="h-8"
                />
                <input 
                  type="color" 
                  value={editForm.color}
                  onChange={e => setEditForm({...editForm, color: e.target.value})}
                  className="h-8 w-8 rounded cursor-pointer bg-transparent border-none"
                />
                <button onClick={saveEdit} className="p-1 text-emerald-500 hover:bg-emerald-500/10 rounded"><Check className="w-4 h-4" /></button>
                <button onClick={() => setEditingId(null)} className="p-1 text-red-500 hover:bg-red-500/10 rounded"><X className="w-4 h-4" /></button>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-3">
                  <div className="w-4 h-4 rounded-full" style={{ backgroundColor: category.color }} />
                  <span className="font-medium text-zinc-200">{category.name}</span>
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => startEdit(category)} className="p-2 text-zinc-400 hover:text-yellow-500 hover:bg-zinc-800 rounded-lg">
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button onClick={() => deleteCategory(category.id)} className="p-2 text-zinc-400 hover:text-red-500 hover:bg-zinc-800 rounded-lg">
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
