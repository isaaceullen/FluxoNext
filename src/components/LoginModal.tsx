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

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
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
              Bem-vindo de volta
            </h2>
            <p className="text-sm text-zinc-500 mt-2">
              Acesse seus dados de qualquer lugar
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
                'Entrar'
              )}
            </Button>
          </form>
        </Card>
      </motion.div>
    </div>
  );
};
