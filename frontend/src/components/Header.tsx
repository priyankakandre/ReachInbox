import React from 'react';
import { User, SlackStatus } from '../types';
import { Mail, LayoutDashboard, Bell, LogOut, ExternalLink, Search, CheckCircle2, ShieldCheck } from 'lucide-react';

interface HeaderProps {
  user: User | null;
  slackStatus: SlackStatus | null;
  onOpenCompose: () => void;
  onOpenSlack: () => void;
  onLogout: () => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
}

export const Header: React.FC<HeaderProps> = ({
  user,
  slackStatus,
  onOpenCompose,
  onOpenSlack,
  onLogout,
  searchQuery,
  onSearchChange,
}) => {
  return (
    <header className="sticky top-0 z-30 border-b border-slate-800 bg-[#0B0F19]/90 backdrop-blur-md px-6 py-3.5">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
        {/* Brand & Logo */}
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center shadow-lg shadow-indigo-500/20 text-white">
            <Mail className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-lg tracking-tight bg-gradient-to-r from-white via-slate-100 to-indigo-300 bg-clip-text text-transparent">
                ReachInbox
              </span>
              <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                Job Scheduler
              </span>
            </div>
            <p className="text-xs text-slate-400">Production-Grade Queue & Throttle Engine</p>
          </div>
        </div>

        {/* Search Bar (Backed by Elasticsearch) */}
        <div className="flex-1 max-w-md mx-4">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search leads, subjects via Elasticsearch..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-900/80 border border-slate-800 rounded-lg text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
            />
            {searchQuery && (
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-indigo-400 font-mono bg-indigo-500/10 px-1.5 py-0.5 rounded">
                ES Search
              </span>
            )}
          </div>
        </div>

        {/* Action Buttons & User */}
        <div className="flex items-center gap-3">
          {/* Slack Connection Button */}
          <button
            onClick={onOpenSlack}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${
              slackStatus?.connected
                ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20'
                : 'border-slate-700 bg-slate-900/60 text-slate-300 hover:bg-slate-800'
            }`}
          >
            <Bell className="h-3.5 w-3.5" />
            <span>{slackStatus?.connected ? 'Slack Connected' : 'Connect Slack'}</span>
            <span
              className={`h-2 w-2 rounded-full ${
                slackStatus?.connected ? 'bg-emerald-400 shadow-sm shadow-emerald-400/50' : 'bg-amber-400'
              }`}
            />
          </button>

          {/* BullMQ Dashboard Link */}
          <a
            href="http://localhost:5000/queues"
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-900/60 hover:bg-slate-800 text-slate-300 text-xs font-medium transition-all"
          >
            <LayoutDashboard className="h-3.5 w-3.5 text-indigo-400" />
            <span>BullMQ Board</span>
            <ExternalLink className="h-3 w-3 text-slate-500" />
          </a>

          {/* User Profile */}
          {user && (
            <div className="flex items-center gap-3 pl-2 border-l border-slate-800">
              <img
                src={user.avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80'}
                alt={user.name}
                className="h-8 w-8 rounded-full object-cover border border-indigo-500/30 ring-1 ring-slate-800"
              />
              <div className="hidden sm:block text-left">
                <div className="text-xs font-semibold text-slate-200 leading-tight">{user.name}</div>
                <div className="text-[11px] text-slate-400 truncate max-w-[140px]">{user.email}</div>
              </div>
              <button
                onClick={onLogout}
                title="Logout"
                className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800/80 rounded-lg transition-colors"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
