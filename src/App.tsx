import React, { useState, useRef } from 'react';
import { LayoutDashboard, PlusCircle, Home, Menu, CreditCard, Tag, DollarSign, Wallet, Download, Upload, Trash2, AlertTriangle, X, ChevronUp } from 'lucide-react';
import { Summary } from './components/Summary';
import { Expenses } from './components/Expenses';
import { Income } from './components/Income';
import { Dashboard } from './components/Dashboard';
import { Cards } from './components/Cards';
import { Categories } from './components/Categories';
import { useFinance } from './hooks/useFinance';
import { UserMenu } from './components/UserMenu';
import { LoginModal } from './components/LoginModal';
import { cn } from './utils';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle2 } from 'lucide-react';

type View = 'home' | 'income' | 'expenses' | 'dashboard' | 'cards' | 'categories';

function App() {
  const { user, loading, loadData, isSaving } = useFinance();
  const [currentView, setCurrentView] = useState<View>('home');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showToast, setShowToast] = useState(false);

  // Hash Routing Logic
  React.useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash;
      const routeMap: Record<string, View> = {
        '#/': 'home',
        '#/home': 'home',
        '#/receitas': 'income',
        '#/despesas': 'expenses',
        '#/dashboard': 'dashboard',
        '#/cartoes': 'cards',
        '#/categorias': 'categories',
      };

      const view = routeMap[hash] || 'home';
      setCurrentView(view);
    };

    // Handle initial load
    handleHashChange();

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const navItems = [
    { id: 'home', label: 'Home', icon: Home, hash: '#/home' },
    { id: 'income', label: 'Receitas', icon: DollarSign, hash: '#/receitas' },
    { id: 'expenses', label: 'Despesas', icon: Wallet, hash: '#/despesas' },
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, hash: '#/dashboard' },
    { id: 'cards', label: 'Cartões', icon: CreditCard, hash: '#/cartoes' },
    { id: 'categories', label: 'Categorias', icon: Tag, hash: '#/categorias' },
  ] as const;

  const handleEditExpense = (id: string) => {
    setEditingExpenseId(id);
    window.location.hash = '#/despesas';
  };

  const handleManualSync = async () => {
    await loadData();
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3000);
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
                window.location.hash = item.hash;
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

        <div className="p-4 border-t border-zinc-800">
          <UserMenu 
            user={user}
            syncing={loading}
            onSync={handleManualSync}
            onLogin={() => setShowLoginModal(true)}
          />
        </div>
      </aside>

      {/* Mobile Header */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-16 bg-zinc-950 border-b border-zinc-800 z-50 flex items-center justify-between px-4">
        <h1 className="text-xl font-bold text-yellow-500">FluxoNext</h1>
        <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="p-2 text-zinc-400 min-w-[44px] min-h-[44px] flex items-center justify-center">
          {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Mobile Menu */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div 
            initial={{ opacity: 0, x: -100 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -100 }}
            className="md:hidden fixed inset-0 z-40 bg-black pt-20 px-4 flex flex-col"
          >
            <nav className="flex-1 space-y-2 overflow-y-auto no-scrollbar pb-4">
              {navItems.map(item => (
                <button
                  key={item.id}
                  onClick={() => {
                    window.location.hash = item.hash;
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

            <div className="pb-8 pt-4 border-t border-zinc-800">
              <UserMenu 
                user={user}
                syncing={loading}
                onSync={handleManualSync}
                onLogin={() => setShowLoginModal(true)}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

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
          window.location.hash = '#/despesas';
          setEditingExpenseId(null);
          setIsMobileMenuOpen(false);
        }}
        className="fixed bottom-6 right-6 h-14 w-14 bg-yellow-500 rounded-full shadow-lg flex items-center justify-center text-black z-30 hover:bg-yellow-400 transition-colors shadow-yellow-500/20"
      >
        <PlusCircle className="w-8 h-8" />
      </motion.button>

      {showLoginModal && <LoginModal onClose={() => setShowLoginModal(false)} />}

      {/* Toast Notification */}
      <AnimatePresence>
        {showToast && (
          <motion.div 
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[100] bg-emerald-500 text-white px-6 py-3 rounded-full shadow-xl flex items-center gap-3 font-medium"
          >
            <CheckCircle2 className="w-5 h-5" />
            Dados sincronizados com sucesso!
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default App;
