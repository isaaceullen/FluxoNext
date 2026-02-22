import React, { useMemo } from 'react';
import { useFinance } from '../hooks/useFinance';
import { Card } from './ui';
import { formatCurrency } from '../utils';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend } from 'recharts';
import { format, addMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export const Dashboard = () => {
  const { expenses, incomes, expenseCategories, cards, getIncomeValueForMonth } = useFinance();

  // Focus on Next Month for the breakdown
  const nextMonth = format(addMonths(new Date(), 1), 'yyyy-MM');
  
  const categoryData = useMemo(() => {
    const data: Record<string, number> = {};
    expenses
      .filter(e => e.billingMonth === nextMonth)
      .forEach(e => {
        const catName = expenseCategories.find(c => c.id === e.categoryId)?.name || 'Outros';
        data[catName] = (data[catName] || 0) + e.installmentValue;
      });
    return Object.entries(data).map(([name, value]) => ({ name, value }));
  }, [expenses, expenseCategories, nextMonth]);

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
        const expense = expenses
            .filter(e => e.billingMonth === monthStr)
            .reduce((acc, e) => acc + e.installmentValue, 0);

        data.push({
            name: label,
            income,
            expense
        });
    }
    return data;
  }, [expenses, incomes, getIncomeValueForMonth]);

  // Top Cards (Next Month)
  const cardUsageData = useMemo(() => {
    const data: Record<string, number> = {};
    expenses
      .filter(e => e.billingMonth === nextMonth && e.paymentMethod !== 'cash')
      .forEach(e => {
        const card = cards.find(c => c.id === e.paymentMethod);
        if (card) {
            data[card.name] = (data[card.name] || 0) + e.installmentValue;
        }
      });
      
    return Object.entries(data)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);
  }, [expenses, cards, nextMonth]);

  const COLORS = ['#F59E0B', '#3B82F6', '#10B981', '#8B5CF6', '#EF4444', '#6B7280'];

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-zinc-100">Dashboard</h2>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="h-[400px] flex flex-col">
          <h3 className="text-lg font-medium text-zinc-300 mb-4">Gastos por Categoria (Mês Seguinte)</h3>
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

        <Card className="h-[400px] flex flex-col lg:col-span-2">
          <h3 className="text-lg font-medium text-zinc-300 mb-4">Cartões Mais Usados (Mês Seguinte)</h3>
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
                <Bar dataKey="value" name="Total Gasto" fill="#8B5CF6" radius={[0, 4, 4, 0]} barSize={32} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>
    </div>
  );
};
