import React from 'react';
import { cn } from '../utils';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg' | 'icon';
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', ...props }, ref) => {
    const variants = {
      primary: 'bg-yellow-500 text-black hover:bg-yellow-400 font-semibold',
      secondary: 'bg-zinc-800 text-zinc-100 hover:bg-zinc-700',
      outline: 'border border-zinc-700 text-zinc-300 hover:bg-zinc-800',
      ghost: 'hover:bg-zinc-800/50 text-zinc-400 hover:text-zinc-100',
      danger: 'bg-red-500/10 text-red-500 hover:bg-red-500/20 border border-red-500/20',
    };

    const sizes = {
      sm: 'h-8 px-3 text-xs',
      md: 'h-10 px-4 py-2',
      lg: 'h-12 px-6 text-lg',
      icon: 'h-10 w-10 p-2 flex items-center justify-center',
    };

    return (
      <button
        ref={ref}
        className={cn(
          'inline-flex items-center justify-center rounded-xl transition-colors disabled:opacity-50 disabled:pointer-events-none',
          variants[variant],
          sizes[size],
          className
        )}
        {...props}
      />
    );
  }
);

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, ...props }, ref) => {
    return (
      <div className="space-y-1">
        {label && <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider">{label}</label>}
        <input
          ref={ref}
          className={cn(
            'flex h-10 w-full rounded-xl border border-zinc-800 bg-zinc-900/50 px-3 py-2 text-base sm:text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-yellow-500/50 focus:border-yellow-500/50 transition-all',
            className
          )}
          {...props}
        />
      </div>
    );
  }
);

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, label, children, ...props }, ref) => {
    return (
      <div className="space-y-1">
        {label && <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider">{label}</label>}
        <select
          ref={ref}
          className={cn(
            'flex h-10 w-full rounded-xl border border-zinc-800 bg-zinc-900/50 px-3 py-2 text-base sm:text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-yellow-500/50 focus:border-yellow-500/50 transition-all appearance-none',
            className
          )}
          {...props}
        >
          {children}
        </select>
      </div>
    );
  }
);

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  className?: string;
  children: React.ReactNode;
}

export const Card: React.FC<CardProps> = ({ className, children, ...props }) => (
  <div className={cn('rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6', className)} {...props}>
    {children}
  </div>
);
