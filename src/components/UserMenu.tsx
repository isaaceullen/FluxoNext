import React, { useState, useRef } from 'react';
import { Download, Upload, Trash2, ChevronUp, LogOut, LogIn, User as UserIcon, Cloud, RefreshCw, Loader2 } from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '../utils';
import { supabase } from '../lib/supabase';
import { User } from '@supabase/supabase-js';

interface UserMenuProps {
  user: User | null;
  syncing?: boolean;
  onSync?: () => void;
  onExport: () => void;
  onImport: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onClear: () => void;
  onLogin: () => void;
  fileInputRef: React.RefObject<HTMLInputElement>;
}

export const UserMenu = ({ user, syncing, onSync, onExport, onImport, onClear, onLogin, fileInputRef }: UserMenuProps) => {
  const [isOpen, setIsOpen] = useState(false);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.reload();
  };

  return (
    <div className="relative w-full">
      {isOpen && (
        <motion.div 
          initial={{ opacity: 0, y: 10, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          className="absolute bottom-full left-0 right-0 mb-2 bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl overflow-hidden z-50"
        >
          {user ? (
            <>
              <div className="px-4 py-2 text-[10px] uppercase tracking-wider text-zinc-500 font-bold bg-zinc-950/50">
                Conta Cloud
              </div>
              <button 
                onClick={() => {
                  onSync?.();
                  setIsOpen(false);
                }}
                disabled={syncing}
                className="w-full flex items-center gap-3 px-4 py-3 text-sm text-zinc-300 hover:bg-zinc-800 transition-colors border-b border-zinc-800 disabled:opacity-50"
              >
                <RefreshCw className={cn("w-4 h-4 text-emerald-500", syncing && "animate-spin")} />
                {syncing ? 'Sincronizando...' : 'Sincronizar com a Nuvem'}
              </button>
              <button 
                onClick={handleLogout}
                className="w-full flex items-center gap-3 px-4 py-3 text-sm text-zinc-300 hover:bg-zinc-800 transition-colors border-b border-zinc-800"
              >
                <LogOut className="w-4 h-4 text-red-500" />
                Sair da Conta
              </button>
            </>
          ) : (
            <button 
              onClick={() => {
                onLogin();
                setIsOpen(false);
              }}
              className="w-full flex items-center gap-3 px-4 py-3 text-sm text-zinc-300 hover:bg-zinc-800 transition-colors border-b border-zinc-800"
            >
              <LogIn className="w-4 h-4 text-yellow-500" />
              Fazer Login / Cadastro
            </button>
          )}
          
          <div className="px-4 py-2 text-[10px] uppercase tracking-wider text-zinc-500 font-bold bg-zinc-950/50">
            Manutenção Local
          </div>
          <button 
            onClick={onExport}
            className="w-full flex items-center gap-3 px-4 py-3 text-sm text-zinc-300 hover:bg-zinc-800 transition-colors border-b border-zinc-800"
          >
            <Download className="w-4 h-4 text-yellow-500" />
            Exportar Dados (JSON)
          </button>
          <button 
            onClick={() => {
              fileInputRef.current?.click();
              setIsOpen(false);
            }}
            className="w-full flex items-center gap-3 px-4 py-3 text-sm text-zinc-300 hover:bg-zinc-800 transition-colors border-b border-zinc-800"
          >
            <Upload className="w-4 h-4 text-yellow-500" />
            Importar Dados (JSON)
          </button>
          <button 
            onClick={() => {
              onClear();
              setIsOpen(false);
            }}
            className="w-full flex items-center gap-3 px-4 py-3 text-sm text-red-400 hover:bg-red-500/10 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
            Limpar Cache Local
          </button>
        </motion.div>
      )}

      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={onImport} 
        accept=".json" 
        className="hidden" 
      />

      <button 
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "w-full flex items-center justify-between p-3 rounded-xl transition-all",
          isOpen ? "bg-zinc-900 ring-1 ring-zinc-700" : "hover:bg-zinc-900"
        )}
      >
        <div className="flex items-center gap-3 text-left">
          <div className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center text-zinc-400 font-bold border border-zinc-700 overflow-hidden">
            {user?.email ? (
              <span className="text-xs uppercase">{user.email.substring(0, 2)}</span>
            ) : (
              <UserIcon className="w-5 h-5" />
            )}
          </div>
          <div className="overflow-hidden">
            <p className="text-sm font-medium text-zinc-200 truncate">
              {user?.email || 'Usuário Local'}
            </p>
            <p className="text-xs text-zinc-500">
              {user ? 'Sincronizado' : 'Modo Offline'}
            </p>
          </div>
        </div>
        <ChevronUp className={cn("w-4 h-4 text-zinc-500 transition-transform", isOpen && "rotate-180")} />
      </button>
    </div>
  );
};
