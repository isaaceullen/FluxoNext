import React, { useState } from 'react';
import { useFinance } from '../hooks/useFinance';
import { Card, Button, Input } from './ui';
import { Plus, Trash2, Edit2, X, Check, CreditCard as CardIcon } from 'lucide-react';

export const Cards = () => {
  const { cards, addCard, updateCard, deleteCard } = useFinance();
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newCard, setNewCard] = useState({ name: '', closingDay: 1, dueDay: 10, color: '#820AD1' });
  const [editForm, setEditForm] = useState({ name: '', closingDay: 1, dueDay: 10, color: '' });

  const handleAdd = () => {
    if (!newCard.name) return;
    addCard(newCard);
    setNewCard({ name: '', closingDay: 1, dueDay: 10, color: '#820AD1' });
    setIsAdding(false);
  };

  const startEdit = (card: any) => {
    setEditingId(card.id);
    setEditForm({ name: card.name, closingDay: card.closingDay, dueDay: card.dueDay, color: card.color });
  };

  const saveEdit = () => {
    if (editingId && editForm.name) {
      updateCard(editingId, editForm);
      setEditingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-zinc-100">Cartões de Crédito</h2>
        <Button onClick={() => setIsAdding(true)} size="sm">
          <Plus className="w-4 h-4 mr-2" /> Novo Cartão
        </Button>
      </div>

      {isAdding && (
        <Card className="mb-6 border-yellow-500/50">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
            <Input 
              label="Nome" 
              value={newCard.name} 
              onChange={e => setNewCard({...newCard, name: e.target.value})}
              autoFocus
              className="md:col-span-2"
            />
            <Input 
              label="Fechamento (Dia)" 
              type="number" min="1" max="31"
              value={newCard.closingDay} 
              onChange={e => setNewCard({...newCard, closingDay: parseInt(e.target.value)})}
            />
            <Input 
              label="Vencimento (Dia)" 
              type="number" min="1" max="31"
              value={newCard.dueDay} 
              onChange={e => setNewCard({...newCard, dueDay: parseInt(e.target.value)})}
            />
            <div className="space-y-1">
              <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Cor</label>
              <input 
                type="color" 
                value={newCard.color}
                onChange={e => setNewCard({...newCard, color: e.target.value})}
                className="h-10 w-full rounded-xl cursor-pointer bg-zinc-900 border border-zinc-800 p-1"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="ghost" onClick={() => setIsAdding(false)}>Cancelar</Button>
            <Button onClick={handleAdd}>Salvar Cartão</Button>
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {cards.map(card => (
          <Card key={card.id} className="relative overflow-hidden group">
            <div className="absolute top-0 left-0 w-1 h-full" style={{ backgroundColor: card.color }} />
            
            {editingId === card.id ? (
              <div className="space-y-3">
                <Input 
                  label="Nome"
                  value={editForm.name} 
                  onChange={e => setEditForm({...editForm, name: e.target.value})}
                />
                <div className="flex gap-2">
                  <Input 
                    label="Fech."
                    type="number"
                    value={editForm.closingDay} 
                    onChange={e => setEditForm({...editForm, closingDay: parseInt(e.target.value)})}
                  />
                  <Input 
                    label="Venc."
                    type="number"
                    value={editForm.dueDay} 
                    onChange={e => setEditForm({...editForm, dueDay: parseInt(e.target.value)})}
                  />
                </div>
                <div className="flex justify-between items-center pt-2">
                   <input 
                    type="color" 
                    value={editForm.color}
                    onChange={e => setEditForm({...editForm, color: e.target.value})}
                    className="h-8 w-8 rounded cursor-pointer bg-transparent border-none"
                  />
                  <div className="flex gap-2">
                    <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>Cancelar</Button>
                    <Button size="sm" onClick={saveEdit}>Salvar</Button>
                  </div>
                </div>
              </div>
            ) : (
              <>
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h4 className="font-semibold text-zinc-100">{card.name}</h4>
                    <div className="flex gap-3 text-xs text-zinc-500 mt-1">
                      <span>Fecha dia {card.closingDay}</span>
                      <span>Vence dia {card.dueDay}</span>
                    </div>
                  </div>
                  <div className="p-2 bg-zinc-800 rounded-lg">
                    <CardIcon className="w-4 h-4 text-zinc-400" />
                  </div>
                </div>
                
                <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity pt-2 border-t border-zinc-800/50 mt-2">
                  <button onClick={() => startEdit(card)} className="p-2 text-zinc-400 hover:text-yellow-500 hover:bg-zinc-800 rounded-lg">
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button onClick={() => deleteCard(card.id)} className="p-2 text-zinc-400 hover:text-red-500 hover:bg-zinc-800 rounded-lg">
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
