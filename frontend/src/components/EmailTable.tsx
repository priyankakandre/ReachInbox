import React from 'react';
import { Email, EmailStatus } from '../types';
import { Mail, Clock, Send, AlertTriangle, ExternalLink, Calendar, Search } from 'lucide-react';

interface EmailTableProps {
  emails: Email[];
  currentTab: 'SCHEDULED' | 'SENT' | 'ALL';
  onTabChange: (tab: 'SCHEDULED' | 'SENT' | 'ALL') => void;
  isLoading: boolean;
  searchQuery: string;
}

export const EmailTable: React.FC<EmailTableProps> = ({
  emails,
  currentTab,
  onTabChange,
  isLoading,
  searchQuery,
}) => {
  const getStatusBadge = (status: EmailStatus) => {
    switch (status) {
      case 'SENT':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            Sent
          </span>
        );
      case 'SCHEDULED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
            Scheduled
          </span>
        );
      case 'SENDING':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
            <span className="h-1.5 w-1.5 rounded-full bg-indigo-400 animate-ping" />
            Sending...
          </span>
        );
      case 'FAILED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
            <span className="h-1.5 w-1.5 rounded-full bg-rose-400" />
            Failed
          </span>
        );
      default:
        return null;
    }
  };

  const formatDate = (isoString?: string | null) => {
    if (!isoString) return '—';
    const date = new Date(isoString);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    });
  };

  return (
    <div className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
      {/* Tabs Header */}
      <div className="flex items-center justify-between px-6 pt-4 border-b border-slate-800 bg-slate-950/40">
        <div className="flex items-center gap-6">
          <button
            onClick={() => onTabChange('SCHEDULED')}
            className={`pb-3.5 text-xs font-bold transition-all relative flex items-center gap-2 ${
              currentTab === 'SCHEDULED'
                ? 'text-indigo-400 border-b-2 border-indigo-500'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Clock className="h-4 w-4" />
            <span>Scheduled Emails</span>
          </button>

          <button
            onClick={() => onTabChange('SENT')}
            className={`pb-3.5 text-xs font-bold transition-all relative flex items-center gap-2 ${
              currentTab === 'SENT'
                ? 'text-indigo-400 border-b-2 border-indigo-500'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Send className="h-4 w-4" />
            <span>Sent Emails</span>
          </button>

          <button
            onClick={() => onTabChange('ALL')}
            className={`pb-3.5 text-xs font-bold transition-all relative flex items-center gap-2 ${
              currentTab === 'ALL'
                ? 'text-indigo-400 border-b-2 border-indigo-500'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Mail className="h-4 w-4" />
            <span>All Emails</span>
          </button>
        </div>

        {searchQuery && (
          <div className="text-xs text-slate-400 pb-3 flex items-center gap-1.5 font-medium">
            <Search className="h-3.5 w-3.5 text-indigo-400" />
            <span>Filtering by "{searchQuery}"</span>
          </div>
        )}
      </div>

      {/* Table Content */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-950/60 text-slate-400 font-semibold uppercase tracking-wider text-[10px] border-b border-slate-800">
            <tr>
              <th className="py-3 px-6">Recipient Lead</th>
              <th className="py-3 px-6">Subject Line</th>
              <th className="py-3 px-6">Sender Account</th>
              <th className="py-3 px-6">
                {currentTab === 'SENT' ? 'Sent Time' : 'Scheduled Run Time'}
              </th>
              <th className="py-3 px-6">Status</th>
              <th className="py-3 px-6 text-right">Ethereal Preview</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {isLoading ? (
              // Loading Skeleton
              Array.from({ length: 4 }).map((_, i) => (
                <tr key={i} className="animate-pulse">
                  <td className="py-4 px-6">
                    <div className="h-3.5 bg-slate-800 rounded w-36" />
                  </td>
                  <td className="py-4 px-6">
                    <div className="h-3.5 bg-slate-800 rounded w-48" />
                  </td>
                  <td className="py-4 px-6">
                    <div className="h-3.5 bg-slate-800 rounded w-28" />
                  </td>
                  <td className="py-4 px-6">
                    <div className="h-3.5 bg-slate-800 rounded w-28" />
                  </td>
                  <td className="py-4 px-6">
                    <div className="h-5 bg-slate-800 rounded-full w-20" />
                  </td>
                  <td className="py-4 px-6 text-right">
                    <div className="h-3.5 bg-slate-800 rounded w-16 ml-auto" />
                  </td>
                </tr>
              ))
            ) : emails.length === 0 ? (
              // Empty State
              <tr>
                <td colSpan={6} className="py-16 text-center">
                  <div className="max-w-xs mx-auto flex flex-col items-center">
                    <div className="h-12 w-12 rounded-2xl bg-slate-800/80 border border-slate-700/60 flex items-center justify-center text-slate-500 mb-3">
                      {currentTab === 'SCHEDULED' ? (
                        <Clock className="h-6 w-6 text-amber-400/60" />
                      ) : (
                        <Send className="h-6 w-6 text-emerald-400/60" />
                      )}
                    </div>
                    <div className="text-sm font-semibold text-slate-300">
                      {searchQuery
                        ? 'No matching emails found'
                        : currentTab === 'SCHEDULED'
                        ? 'No scheduled emails in queue'
                        : 'No sent emails yet'}
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                      {searchQuery
                        ? 'Try modifying your search keywords.'
                        : 'Click "Compose New Email" to schedule your first batch of automated emails.'}
                    </p>
                  </div>
                </td>
              </tr>
            ) : (
              // Email Rows
              emails.map((email) => (
                <tr
                  key={email.id}
                  className="hover:bg-slate-800/30 transition-colors group"
                >
                  <td className="py-3.5 px-6 font-medium text-slate-200">
                    <div className="flex items-center gap-2">
                      <div className="h-6 w-6 rounded-md bg-indigo-500/10 text-indigo-400 flex items-center justify-center font-bold text-[10px]">
                        {email.recipient.charAt(0).toUpperCase()}
                      </div>
                      <span className="font-mono text-xs">{email.recipient}</span>
                    </div>
                  </td>
                  <td className="py-3.5 px-6 text-slate-300">
                    <div className="font-medium truncate max-w-xs">{email.subject}</div>
                    <div className="text-[11px] text-slate-500 truncate max-w-xs">{email.body}</div>
                  </td>
                  <td className="py-3.5 px-6 text-slate-400">
                    <span className="text-[11px] font-mono bg-slate-950/60 px-2 py-0.5 rounded border border-slate-800">
                      {email.sender?.emailAddress || 'Default Sender'}
                    </span>
                  </td>
                  <td className="py-3.5 px-6 text-slate-400 whitespace-nowrap">
                    <div className="flex items-center gap-1.5 text-xs">
                      <Calendar className="h-3 w-3 text-slate-500" />
                      <span>
                        {currentTab === 'SENT'
                          ? formatDate(email.sentAt)
                          : formatDate(email.scheduledAt)}
                      </span>
                    </div>
                  </td>
                  <td className="py-3.5 px-6 whitespace-nowrap">
                    {getStatusBadge(email.status)}
                    {email.error && (
                      <div className="text-[10px] text-rose-400 mt-1 max-w-xs truncate" title={email.error}>
                        {email.error}
                      </div>
                    )}
                  </td>
                  <td className="py-3.5 px-6 text-right whitespace-nowrap">
                    {email.previewUrl ? (
                      <a
                        href={email.previewUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 border border-indigo-500/20 text-[11px] font-semibold transition-colors"
                        title="Open rendered email on Ethereal Email"
                      >
                        <span>View Email</span>
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    ) : (
                      <span className="text-slate-600 text-[11px] italic">Queued</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
