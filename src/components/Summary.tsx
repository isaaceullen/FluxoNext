import React, { useState } from 'react';
import { useFinance } from '../hooks/useFinance';
import { Card, Button } from './ui';
import { ArrowLeft, ArrowRight, TrendingUp, TrendingDown, Wallet, CreditCard as CardIcon, CheckCircle, Circle, ChevronDown, Edit2, X } from 'lucide-react';
import { format, addMonths, subMonths, parseISO, startOfMonth, eachMonthOfInterval } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { formatCurrency, cn } from '../utils';
import { motion, AnimatePresence } from 'motion/react';

export const Summary = ({ onEditExpense }: { onEditExpense?: (id: string) => void }) => {
  const { incomes, expenses, cards, cardPayments, toggleExpensePaid, toggleCardPaid, getIncomeValueForMonth, getExpenseValueForMonth } = useFinance();
  const [selectedMonth, setSelectedMonth] = useState(format(addMonths(new Date(), 1), 'yyyy-MM'));
  const [isMonthDropdownOpen, setIsMonthDropdownOpen] = useState(false);
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);

  const handlePrevMonth = () => setSelectedMonth(prev => format(subMonths(parseISO(prev + '-01'), 1), 'yyyy-MM'));
  const handleNextMonth = () => setSelectedMonth(prev => format(addMonths(parseISO(prev + '-01'), 1), 'yyyy-MM'));

  // --- Calculations ---

  const totalIncome = incomes.reduce((acc, inc) => acc + getIncomeValueForMonth(inc, selectedMonth), 0);

  // Get all expenses for this month (one_time, installment, and fixed)
  const monthlyExpenses = expenses.map(e => {
    const { value, paymentMethod } = getExpenseValueForMonth(e, selectedMonth);
    return { ...e, currentMonthValue: value, currentMonthPaymentMethod: paymentMethod };
  }).filter(e => e.currentMonthValue > 0);

  const totalExpenses = monthlyExpenses.reduce((acc, exp) => acc + exp.currentMonthValue, 0);
  const balance = totalIncome - totalExpenses;

  const cardTotals = cards.map(card => {
    const cardExpenses = monthlyExpenses.filter(e => e.currentMonthPaymentMethod === card.id);
    const total = cardExpenses.reduce((acc, e) => acc + e.currentMonthValue, 0);
    const isPaid = cardPayments.find(p => p.cardId === card.id && p.monthYear === selectedMonth)?.isPaid || false;
    return { ...card, total, isPaid };
  }).filter(c => c.total > 0);

  const cashExpenses = monthlyExpenses.filter(e => e.currentMonthPaymentMethod === 'cash');

  // Month Dropdown Options (Last 5 years + Next 10 years)
  const monthOptions = eachMonthOfInterval({
    start: subMonths(new Date(), 12 * 5),
    end: addMonths(new Date(), 12 * 10)
  }).map(date => format(date, 'yyyy-MM'));

  const selectedCard = cards.find(c => c.id === selectedCardId);
  const selectedCardExpenses = monthlyExpenses.filter(e => e.currentMonthPaymentMethod === selectedCardId);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-zinc-400 text-sm font-medium uppercase tracking-wider">Resumo Financeiro</h2>
          <p className="text-zinc-100 text-lg font-semibold">
            Hoje, {format(new Date(), "dd/MM/yyyy")}
          </p>
        </div>
        
        <div className="relative flex items-center bg-zinc-900 rounded-xl p-1 border border-zinc-800">
          <button onClick={handlePrevMonth} className="p-2 hover:bg-zinc-800 rounded-lg text-zinc-400 hover:text-yellow-500 transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          
          <div className="relative">
            <button 
              onClick={() => setIsMonthDropdownOpen(!isMonthDropdownOpen)}
              className="px-4 py-2 font-medium text-zinc-200 min-w-[160px] flex items-center justify-center gap-2 hover:bg-zinc-800 rounded-lg transition-colors capitalize"
            >
              {format(parseISO(selectedMonth + '-01'), 'MMM/yyyy', { locale: ptBR })}
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
                        setSelectedMonth(m);
                        setIsMonthDropdownOpen(false);
                      }}
                      className={cn(
                        "w-full px-4 py-2 text-sm text-left hover:bg-zinc-800 transition-colors capitalize",
                        selectedMonth === m ? "text-yellow-500 bg-yellow-500/5" : "text-zinc-400"
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

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-zinc-900/50 border-zinc-800">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-emerald-500/10 rounded-lg text-emerald-500">
              <TrendingUp className="w-5 h-5" />
            </div>
            <span className="text-zinc-400 font-medium">Receitas</span>
          </div>
          <p className="text-2xl font-bold text-zinc-100">{formatCurrency(totalIncome)}</p>
        </Card>

        <Card className="bg-zinc-900/50 border-zinc-800">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-red-500/10 rounded-lg text-red-500">
              <TrendingDown className="w-5 h-5" />
            </div>
            <span className="text-zinc-400 font-medium">Despesas</span>
          </div>
          <p className="text-2xl font-bold text-zinc-100">{formatCurrency(totalExpenses)}</p>
        </Card>

        <Card className="bg-zinc-900/50 border-zinc-800">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-yellow-500/10 rounded-lg text-yellow-500">
              <Wallet className="w-5 h-5" />
            </div>
            <span className="text-zinc-400 font-medium">Saldo</span>
          </div>
          <p className={cn("text-2xl font-bold", balance >= 0 ? "text-emerald-500" : "text-red-500")}>
            {formatCurrency(balance)}
          </p>
        </Card>
      </div>

      {/* Credit Cards List */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-zinc-200 flex items-center gap-2">
          <CardIcon className="w-5 h-5 text-yellow-500" /> Cartões de Crédito
        </h3>
        {cardTotals.length === 0 ? (
          <p className="text-zinc-500 text-sm">Nenhum gasto com cartão neste mês.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {cardTotals.map(card => (
              <Card 
                key={card.id} 
                className="border-l-4 cursor-pointer hover:bg-zinc-900/80 transition-colors" 
                style={{ borderLeftColor: card.color }}
                onClick={() => setSelectedCardId(card.id)}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold text-zinc-100">{card.name}</h4>
                      {card.isPaid && <CheckCircle className="w-4 h-4 text-emerald-500" />}
                    </div>
                    <p className="text-xs text-zinc-500">Vence dia {card.dueDay}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-zinc-100">{formatCurrency(card.total)}</p>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleCardPaid(card.id, selectedMonth);
                      }}
                      className={cn(
                        "text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded mt-1",
                        card.isPaid ? "bg-emerald-500/20 text-emerald-500" : "bg-zinc-800 text-zinc-500 hover:text-zinc-300"
                      )}
                    >
                      {card.isPaid ? 'Fatura Paga' : 'Marcar como Paga'}
                    </button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Cash Expenses */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-zinc-200 flex items-center gap-2">
          <Wallet className="w-5 h-5 text-emerald-500" /> Pagamentos em Dinheiro / Débito
        </h3>
        {cashExpenses.length === 0 ? (
          <p className="text-zinc-500 text-sm">Nenhum gasto em dinheiro neste mês.</p>
        ) : (
          <Card>
            <div className="space-y-3">
              {cashExpenses.map(exp => (
                <div key={exp.id} className="flex items-center justify-between group">
                  <div className="flex items-center gap-3">
                     <button 
                      onClick={() => toggleExpensePaid(exp.id)}
                      className={cn("transition-colors", exp.isPaid ? "text-emerald-500" : "text-zinc-600 hover:text-zinc-400")}
                    >
                      {exp.isPaid ? <CheckCircle className="w-5 h-5" /> : <Circle className="w-5 h-5" />}
                    </button>
                    <div>
                      <p className={cn("font-medium text-zinc-200", exp.isPaid && "line-through opacity-50")}>
                        {exp.title}
                      </p>
                      {exp.installments && (
                        <p className="text-xs text-yellow-500">
                          Parcela {exp.installments.current} de {exp.installments.total}
                        </p>
                      )}
                    </div>
                  </div>
                  <span className={cn("font-bold text-zinc-300", exp.isPaid && "opacity-50")}>
                    {formatCurrency(exp.currentMonthValue)}
                  </span>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>

      {/* Card Details Modal */}
      <AnimatePresence>
        {selectedCardId && selectedCard && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedCardId(null)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative w-full max-w-lg bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-zinc-800 flex items-center justify-between" style={{ borderTop: `4px solid ${selectedCard.color}` }}>
                <div>
                  <h3 className="text-xl font-bold text-zinc-100">{selectedCard.name}</h3>
                  <p className="text-zinc-500 text-sm capitalize">Fatura de {format(parseISO(selectedMonth + '-01'), 'MMM/yyyy', { locale: ptBR })}</p>
                </div>
                <button onClick={() => setSelectedCardId(null)} className="p-2 text-zinc-500 hover:text-zinc-200 transition-colors">
                  <X className="w-6 h-6" />
                </button>
              </div>
              
              <div className="p-6 max-h-[60vh] overflow-y-auto space-y-4">
                {selectedCardExpenses.map(exp => (
                  <div key={exp.id} className="flex items-center justify-between group">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-zinc-900 rounded-lg text-zinc-400">
                        <CardIcon className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="font-medium text-zinc-200">{exp.title}</p>
                        <div className="flex gap-2 text-xs text-zinc-500">
                          <span>{format(parseISO(exp.purchaseDate), 'dd/MM/yyyy')}</span>
                          {exp.installments && (
                            <span className="text-yellow-500">Parcela {exp.installments.current}/{exp.installments.total}</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="font-bold text-zinc-100">{formatCurrency(exp.currentMonthValue)}</span>
                      <button 
                        onClick={() => {
                          if (onEditExpense) onEditExpense(exp.id);
                          setSelectedCardId(null);
                        }}
                        className="p-2 text-zinc-600 hover:text-yellow-500 transition-colors opacity-0 group-hover:opacity-100"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="p-6 bg-zinc-900/50 border-t border-zinc-800 flex items-center justify-between">
                <span className="text-zinc-400 font-medium">Total da Fatura</span>
                <span className="text-2xl font-bold text-yellow-500">{formatCurrency(selectedCardExpenses.reduce((acc, e) => acc + e.currentMonthValue, 0))}</span>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
