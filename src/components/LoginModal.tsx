import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { Button, Input, Card } from './ui';
import { X, Mail, Lock, Loader2 } from 'lucide-react';
import { motion } from 'motion/react';

interface LoginModalProps {
  onClose: () => void;
}

export const LoginModal = ({ onClose }: LoginModalProps) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<'login' | 'signup'>('login');

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        alert('Verifique seu email para confirmar o cadastro!');
      }
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md"
      >
        <Card className="relative border-zinc-800 shadow-2xl">
          <button 
            onClick={onClose}
            className="absolute top-4 right-4 p-2 text-zinc-500 hover:text-zinc-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-zinc-100">
              {mode === 'login' ? 'Bem-vindo de volta' : 'Crie sua conta'}
            </h2>
            <p className="text-sm text-zinc-500 mt-2">
              {mode === 'login' 
                ? 'Acesse seus dados de qualquer lugar' 
                : 'Comece a controlar suas finanças hoje'}
            </p>
          </div>

          <form onSubmit={handleAuth} className="space-y-4">
            <Input 
              label="Email"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="seu@email.com"
              required
              icon={<Mail className="w-4 h-4" />}
            />
            <Input 
              label="Senha"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              icon={<Lock className="w-4 h-4" />}
            />

            {error && (
              <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-500 text-xs">
                {error}
              </div>
            )}

            <Button 
              type="submit" 
              className="w-full bg-yellow-500 hover:bg-yellow-400 text-black font-bold h-12"
              disabled={loading}
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                mode === 'login' ? 'Entrar' : 'Cadastrar'
              )}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <button 
              onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}
              className="text-sm text-zinc-400 hover:text-yellow-500 transition-colors"
            >
              {mode === 'login' 
                ? 'Não tem uma conta? Cadastre-se' 
                : 'Já tem uma conta? Entre agora'}
            </button>
          </div>
        </Card>
      </motion.div>
    </div>
  );
};
