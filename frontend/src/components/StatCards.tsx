import React from 'react';
import { EmailStats, Sender } from '../types';
import { Clock, Send, AlertTriangle, Zap, Plus, RefreshCw, Cpu, Layers } from 'lucide-react';

interface StatCardsProps {
  stats: EmailStats | null;
  primarySender: Sender | null;
  onOpenCompose: () => void;
  onLoadTest: () => void;
  onRefresh: () => void;
  isLoading: boolean;
}

export const StatCards: React.FC<StatCardsProps> = ({
  stats,
  primarySender,
  onOpenCompose,
  onLoadTest,
  onRefresh,
  isLoading,
}) => {
  return (
    <div className="space-y-4">
      {/* Action Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 border border-slate-800 p-5 rounded-2xl shadow-xl">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            Email Campaign Dashboard
            <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              Persistent BullMQ Engine
            </span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Zero-cron, BullMQ + Redis delayed queue with Ethereal SMTP and atomic hourly rate limiting.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={onRefresh}
            disabled={isLoading}
            className="p-2.5 rounded-xl border border-slate-700 bg-slate-800/80 hover:bg-slate-700 text-slate-300 transition-all hover:rotate-180 duration-500"
            title="Refresh Data"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={onLoadTest}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-indigo-500/30 bg-indigo-950/30 hover:bg-indigo-900/40 text-indigo-300 text-xs font-semibold shadow-sm transition-all"
            title="Simulate 1000 email jobs into BullMQ queue"
          >
            <Layers className="h-4 w-4 text-indigo-400" />
            <span>Simulate 1000 Leads</span>
          </button>

          <button
            onClick={onOpenCompose}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white text-xs font-bold shadow-lg shadow-indigo-600/30 transition-all transform active:scale-95"
          >
            <Plus className="h-4 w-4" />
            <span>Compose New Email</span>
          </button>
        </div>
      </div>

      {/* Metric Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Scheduled Card */}
        <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-4 flex items-center justify-between hover:border-slate-700 transition-all">
          <div>
            <div className="text-xs font-medium text-slate-400">Scheduled Emails</div>
            <div className="text-2xl font-extrabold text-amber-400 mt-1">
              {stats?.scheduled ?? 0}
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">Queued in BullMQ Redis</div>
          </div>
          <div className="h-11 w-11 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
            <Clock className="h-5 w-5" />
          </div>
        </div>

        {/* Sent Card */}
        <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-4 flex items-center justify-between hover:border-slate-700 transition-all">
          <div>
            <div className="text-xs font-medium text-slate-400">Delivered Emails</div>
            <div className="text-2xl font-extrabold text-emerald-400 mt-1">
              {stats?.sent ?? 0}
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">Verified Ethereal SMTP</div>
          </div>
          <div className="h-11 w-11 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            <Send className="h-5 w-5" />
          </div>
        </div>

        {/* Failed Card */}
        <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-4 flex items-center justify-between hover:border-slate-700 transition-all">
          <div>
            <div className="text-xs font-medium text-slate-400">Failed / Errors</div>
            <div className="text-2xl font-extrabold text-rose-400 mt-1">
              {stats?.failed ?? 0}
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">Retry with backoff</div>
          </div>
          <div className="h-11 w-11 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400">
            <AlertTriangle className="h-5 w-5" />
          </div>
        </div>

        {/* Hourly Rate Limit Quota Card */}
        <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-4 flex items-center justify-between hover:border-slate-700 transition-all">
          <div>
            <div className="text-xs font-medium text-slate-400">Hourly Quota Used</div>
            <div className="text-2xl font-extrabold text-indigo-300 mt-1">
              {primarySender ? `${primarySender.sentThisHour} / ${primarySender.hourlyLimit}` : '0 / 5'}
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">
              {primarySender && primarySender.remainingThisHour === 0 ? (
                <span className="text-amber-400 font-semibold">Limit Reached &middot; Rescheduling</span>
              ) : (
                <span>{primarySender?.remainingThisHour ?? 5} slots remaining</span>
              )}
            </div>
          </div>
          <div className="h-11 w-11 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
            <Zap className="h-5 w-5" />
          </div>
        </div>
      </div>
    </div>
  );
};
