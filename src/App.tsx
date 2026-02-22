import React, { useState, useRef } from 'react';
import { LayoutDashboard, PlusCircle, Home, Menu, CreditCard, Tag, DollarSign, Wallet, Download, Upload, Trash2, AlertTriangle, X, ChevronUp } from 'lucide-react';
import { Summary } from './components/Summary';
import { Expenses } from './components/Expenses';
import { Income } from './components/Income';
import { Dashboard } from './components/Dashboard';
import { Cards } from './components/Cards';
import { Categories } from './components/Categories';
import { cn } from './utils';
import { motion } from 'motion/react';

type View = 'home' | 'income' | 'expenses' | 'dashboard' | 'cards' | 'categories';

function App() {
  const [currentView, setCurrentView] = useState<View>('home');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isClearModalOpen, setIsClearModalOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const STORAGE_KEY = 'fluxonext_data_v2';

  const navItems = [
    { id: 'home', label: 'Home', icon: Home },
    { id: 'income', label: 'Receitas', icon: DollarSign },
    { id: 'expenses', label: 'Despesas', icon: Wallet },
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'cards', label: 'Cartões', icon: CreditCard },
    { id: 'categories', label: 'Categorias', icon: Tag },
  ] as const;

  const handleEditExpense = (id: string) => {
    setEditingExpenseId(id);
    setCurrentView('expenses');
  };

  const handleExport = () => {
    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) return alert('Nenhum dado para exportar.');
    
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'fluxonext_backup.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setIsUserMenuOpen(false);
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        JSON.parse(content); // Validate JSON
        localStorage.setItem(STORAGE_KEY, content);
        window.location.reload();
      } catch (err) {
        alert('Arquivo JSON inválido.');
      }
    };
    reader.readAsText(file);
  };

  const handleClearAll = () => {
    localStorage.clear();
    window.location.reload();
  };

  return (
    <div className="min-h-screen bg-black text-zinc-100 font-sans selection:bg-yellow-500/30">
      {/* Sidebar (Desktop) */}
      <aside className="hidden md:flex flex-col w-64 fixed inset-y-0 left-0 border-r border-zinc-800 bg-zinc-950">
        <div className="p-6 border-b border-zinc-800">
          <h1 className="text-2xl font-bold text-yellow-500 tracking-tight">FluxoNext</h1>
          <p className="text-xs text-zinc-500 mt-1">Controle Financeiro Inteligente</p>
        </div>
        
        <nav className="flex-1 p-4 space-y-2">
          {navItems.map(item => (
            <button
              key={item.id}
              onClick={() => {
                setCurrentView(item.id);
                if (item.id !== 'expenses') setEditingExpenseId(null);
              }}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all",
                currentView === item.id 
                  ? "bg-yellow-500 text-black shadow-lg shadow-yellow-500/20" 
                  : "text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900"
              )}
            >
              <item.icon className="w-5 h-5" />
              {item.label}
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-zinc-800 relative">
          {isUserMenuOpen && (
            <motion.div 
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              className="absolute bottom-full left-4 right-4 mb-2 bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl overflow-hidden z-50"
            >
              <button 
                onClick={handleExport}
                className="w-full flex items-center gap-3 px-4 py-3 text-sm text-zinc-300 hover:bg-zinc-800 transition-colors border-b border-zinc-800"
              >
                <Download className="w-4 h-4 text-yellow-500" />
                Exportar Dados (JSON)
              </button>
              <button 
                onClick={() => fileInputRef.current?.click()}
                className="w-full flex items-center gap-3 px-4 py-3 text-sm text-zinc-300 hover:bg-zinc-800 transition-colors border-b border-zinc-800"
              >
                <Upload className="w-4 h-4 text-yellow-500" />
                Importar Dados (JSON)
              </button>
              <button 
                onClick={() => {
                  setIsClearModalOpen(true);
                  setIsUserMenuOpen(false);
                }}
                className="w-full flex items-center gap-3 px-4 py-3 text-sm text-red-400 hover:bg-red-500/10 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                Limpar Todos os Dados
              </button>
            </motion.div>
          )}

          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleImport} 
            accept=".json" 
            className="hidden" 
          />

          <button 
            onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
            className={cn(
              "w-full flex items-center justify-between p-3 rounded-xl transition-all",
              isUserMenuOpen ? "bg-zinc-900 ring-1 ring-zinc-700" : "hover:bg-zinc-900"
            )}
          >
            <div className="flex items-center gap-3 text-left">
              <div className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center text-zinc-400 font-bold border border-zinc-700">
                US
              </div>
              <div>
                <p className="text-sm font-medium text-zinc-200">Usuário</p>
                <p className="text-xs text-zinc-500">Free Plan</p>
              </div>
            </div>
            <ChevronUp className={cn("w-4 h-4 text-zinc-500 transition-transform", isUserMenuOpen && "rotate-180")} />
          </button>
        </div>
      </aside>

      {/* Mobile Header */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-16 bg-zinc-950 border-b border-zinc-800 z-40 flex items-center justify-between px-4">
        <h1 className="text-xl font-bold text-yellow-500">FluxoNext</h1>
        <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="p-2 text-zinc-400">
          <Menu className="w-6 h-6" />
        </button>
      </div>

      {/* Mobile Menu */}
      {isMobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-30 bg-black/90 pt-20 px-4">
          <nav className="space-y-2">
            {navItems.map(item => (
              <button
                key={item.id}
                onClick={() => {
                  setCurrentView(item.id);
                  setIsMobileMenuOpen(false);
                  if (item.id !== 'expenses') setEditingExpenseId(null);
                }}
                className={cn(
                  "w-full flex items-center gap-3 px-4 py-4 rounded-xl text-lg font-medium transition-all",
                  currentView === item.id 
                    ? "bg-yellow-500 text-black" 
                    : "text-zinc-400 hover:text-zinc-100 bg-zinc-900"
                )}
              >
                <item.icon className="w-6 h-6" />
                {item.label}
              </button>
            ))}
          </nav>
        </div>
      )}

      {/* Main Content */}
      <main className="md:pl-64 pt-16 md:pt-0 min-h-screen pb-24 md:pb-8">
        <div className="max-w-7xl mx-auto p-4 md:p-8 lg:p-12">
          {currentView === 'home' && <Summary onEditExpense={handleEditExpense} />}
          {currentView === 'income' && <Income />}
          {currentView === 'expenses' && (
            <Expenses 
              editingExpenseId={editingExpenseId} 
              onClearEditing={() => setEditingExpenseId(null)} 
            />
          )}
          {currentView === 'dashboard' && <Dashboard />}
          {currentView === 'cards' && <Cards />}
          {currentView === 'categories' && <Categories />}
        </div>
      </main>

      {/* Global FAB */}
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => {
          setCurrentView('expenses');
          setEditingExpenseId(null);
        }}
        className="fixed bottom-6 right-6 h-14 w-14 bg-yellow-500 rounded-full shadow-lg flex items-center justify-center text-black z-50 hover:bg-yellow-400 transition-colors shadow-yellow-500/20"
      >
        <PlusCircle className="w-8 h-8" />
      </motion.button>

      {/* Clear Data Confirmation Modal */}
      {isClearModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-zinc-950 border border-zinc-800 rounded-2xl p-6 max-w-md w-full shadow-2xl"
          >
            <div className="flex items-center gap-3 text-red-500 mb-4">
              <AlertTriangle className="w-6 h-6" />
              <h3 className="text-xl font-bold">Atenção: Ação Irreversível!</h3>
            </div>
            
            <p className="text-zinc-400 mb-8 leading-relaxed">
              Isso apagará todos os seus gastos, receitas, cartões e categorias. Deseja continuar?
            </p>

            <div className="flex gap-3">
              <button 
                onClick={() => setIsClearModalOpen(false)}
                className="flex-1 px-4 py-3 rounded-xl bg-zinc-900 text-zinc-300 font-medium hover:bg-zinc-800 transition-colors"
              >
                Cancelar
              </button>
              <button 
                onClick={handleClearAll}
                className="flex-1 px-4 py-3 rounded-xl bg-red-600 text-white font-bold hover:bg-red-500 transition-colors shadow-lg shadow-red-600/20"
              >
                Sim, apagar tudo
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}

export default App;
