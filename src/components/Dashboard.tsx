import React, { useMemo } from 'react';
import { useFinance } from '../hooks/useFinance';
import { Card } from './ui';
import { formatCurrency, cn } from '../utils';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend } from 'recharts';
import { format, addMonths, subMonths, parseISO, eachMonthOfInterval } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ArrowLeft, ArrowRight, ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export const Dashboard = () => {
  const { expenses, incomes, expenseCategories, cards, getIncomeValueForMonth, getExpenseValueForMonth } = useFinance();
  const [selectedMonth, setSelectedMonth] = React.useState(format(addMonths(new Date(), 1), 'yyyy-MM'));
  const [isMonthDropdownOpen, setIsMonthDropdownOpen] = React.useState(false);

  const monthOptions = useMemo(() => {
    return eachMonthOfInterval({
      start: subMonths(new Date(), 12 * 2),
      end: addMonths(new Date(), 12 * 5)
    }).map(date => format(date, 'yyyy-MM'));
  }, []);

  const handlePrevMonth = () => setSelectedMonth(prev => format(subMonths(parseISO(prev + '-01'), 1), 'yyyy-MM'));
  const handleNextMonth = () => setSelectedMonth(prev => format(addMonths(parseISO(prev + '-01'), 1), 'yyyy-MM'));

  const categoryData = useMemo(() => {
    const data: Record<string, number> = {};
    expenses.forEach(e => {
      const { value } = getExpenseValueForMonth(e, selectedMonth);
      if (value > 0) {
        const catName = expenseCategories.find(c => c.id === e.categoryId)?.name || 'Outros';
        data[catName] = (data[catName] || 0) + value;
      }
    });
    return Object.entries(data).map(([name, value]) => ({ name, value }));
  }, [expenses, expenseCategories, selectedMonth, getExpenseValueForMonth]);

  const cardUsageData = useMemo(() => {
    const data: Record<string, number> = {};
    expenses.forEach(e => {
      const { value, paymentMethod } = getExpenseValueForMonth(e, selectedMonth);
      if (value > 0) {
        let name = 'Dinheiro';
        if (paymentMethod !== 'cash') {
          const card = cards.find(c => c.id === paymentMethod);
          name = card ? card.name : 'Dinheiro';
        }
        data[name] = (data[name] || 0) + value;
      }
    });
      
    return Object.entries(data)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [expenses, cards, selectedMonth, getExpenseValueForMonth]);

  // Cash Flow (Last 3 months + Next 3 months)
  const monthlyData = useMemo(() => {
    const data: any[] = [];
    const today = new Date();
    
    for (let i = -2; i <= 3; i++) {
        const date = addMonths(today, i);
        const monthStr = format(date, 'yyyy-MM');
        const label = format(date, 'MMM/yy', { locale: ptBR });
        
        // Calculate Income
        const income = incomes.reduce((acc, inc) => acc + getIncomeValueForMonth(inc, monthStr), 0);
        
        // Calculate Expense
        const expense = expenses.reduce((acc, e) => {
          const { value } = getExpenseValueForMonth(e, monthStr);
          return acc + value;
        }, 0);

        data.push({
            name: label,
            income,
            expense
        });
    }
    return data;
  }, [expenses, incomes, getIncomeValueForMonth, getExpenseValueForMonth]);

  const COLORS = ['#F59E0B', '#3B82F6', '#10B981', '#8B5CF6', '#EF4444', '#6B7280'];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h2 className="text-2xl font-bold text-zinc-100">Dashboard</h2>
        
        <div className="flex items-center bg-zinc-900 rounded-xl p-1 border border-zinc-800">
          <button onClick={handlePrevMonth} className="p-2 hover:bg-zinc-800 rounded-lg text-zinc-400 hover:text-yellow-500 transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          
          <div className="relative">
            <button 
              onClick={() => setIsMonthDropdownOpen(!isMonthDropdownOpen)}
              className="px-4 py-2 font-medium text-zinc-200 min-w-[160px] flex items-center justify-center gap-2 hover:bg-zinc-800 rounded-lg transition-colors capitalize"
            >
              {format(parseISO(selectedMonth + '-01'), 'MMMM yyyy', { locale: ptBR })}
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="h-[400px] flex flex-col">
          <h3 className="text-lg font-medium text-zinc-300 mb-4">Gastos por Categoria</h3>
          <div className="flex-1">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={categoryData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  fill="#8884d8"
                  paddingAngle={5}
                  dataKey="value"
                >
                  {categoryData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a', borderRadius: '8px' }}
                  itemStyle={{ color: '#e4e4e7' }}
                  formatter={(value: number) => formatCurrency(value)}
                />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="h-[400px] flex flex-col">
          <h3 className="text-lg font-medium text-zinc-300 mb-4">Cartões e Dinheiro</h3>
          <div className="flex-1">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={cardUsageData} layout="vertical">
                <XAxis type="number" stroke="#71717a" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `R$${value}`} />
                <YAxis dataKey="name" type="category" stroke="#71717a" fontSize={12} tickLine={false} axisLine={false} width={100} />
                <Tooltip 
                  cursor={{ fill: '#27272a' }}
                  contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a', borderRadius: '8px' }}
                  itemStyle={{ color: '#e4e4e7' }}
                  formatter={(value: number) => formatCurrency(value)}
                />
                <Bar dataKey="value" name="Total Gasto" fill="#8B5CF6" radius={[0, 4, 4, 0]} barSize={32}>
                  {cardUsageData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.name === 'Dinheiro' ? '#6B7280' : COLORS[index % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="h-[400px] flex flex-col lg:col-span-2">
          <h3 className="text-lg font-medium text-zinc-300 mb-4">Fluxo de Caixa (6 Meses)</h3>
          <div className="flex-1">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyData}>
                <XAxis dataKey="name" stroke="#71717a" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#71717a" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `R$${value/1000}k`} />
                <Tooltip 
                  cursor={{ fill: '#27272a' }}
                  contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a', borderRadius: '8px' }}
                  itemStyle={{ color: '#e4e4e7' }}
                  formatter={(value: number) => formatCurrency(value)}
                />
                <Legend />
                <Bar dataKey="income" name="Receitas" fill="#10B981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="expense" name="Despesas" fill="#EF4444" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>
    </div>
  );
};
