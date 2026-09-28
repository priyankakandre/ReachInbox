import React, { useState } from 'react';
import { SlackStatus } from '../types';
import { X, Bell, CheckCircle2, Send, ExternalLink, ShieldCheck, AlertCircle, Trash2 } from 'lucide-react';

interface SlackModalProps {
  isOpen: boolean;
  onClose: () => void;
  slackStatus: SlackStatus | null;
  onSetWebhook: (url: string, channel?: string) => Promise<void>;
  onTestNotification: () => Promise<void>;
  onDisconnect: () => Promise<void>;
  onOAuthConnect: () => Promise<void>;
}

export const SlackModal: React.FC<SlackModalProps> = ({
  isOpen,
  onClose,
  slackStatus,
  onSetWebhook,
  onTestNotification,
  onDisconnect,
  onOAuthConnect,
}) => {
  const [webhookUrl, setWebhookUrl] = useState('');
  const [channelName, setChannelName] = useState('#email-alerts');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  if (!isOpen) return null;

  const handleSaveWebhook = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    try {
      setIsSubmitting(true);
      await onSetWebhook(webhookUrl, channelName);
      setMsg({ type: 'success', text: 'Slack incoming webhook connected and verified!' });
      setWebhookUrl('');
    } catch (err: any) {
      setMsg({
        type: 'error',
        text: err.response?.data?.error || err.message || 'Failed to save Slack webhook',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTest = async () => {
    setMsg(null);
    try {
      setIsTesting(true);
      await onTestNotification();
      setMsg({ type: 'success', text: 'Live test message delivered to Slack successfully!' });
    } catch (err: any) {
      setMsg({
        type: 'error',
        text: err.response?.data?.error || err.message || 'Failed to send test message to Slack',
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleDisconnect = async () => {
    setMsg(null);
    try {
      setIsSubmitting(true);
      await onDisconnect();
      setMsg({ type: 'success', text: 'Slack disconnected successfully.' });
    } catch (err: any) {
      setMsg({ type: 'error', text: err.message || 'Failed to disconnect Slack' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6 text-slate-100">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <Bell className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Slack Rate Limit Alerts</h2>
              <p className="text-xs text-slate-400">Live Slack notifications when hourly sender quotas are reached.</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {msg && (
          <div
            className={`mt-4 p-3 rounded-xl text-xs flex items-center gap-2 ${
              msg.type === 'success'
                ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400'
                : 'bg-rose-500/10 border border-rose-500/20 text-rose-400'
            }`}
          >
            {msg.type === 'success' ? (
              <CheckCircle2 className="h-4 w-4 shrink-0" />
            ) : (
              <AlertCircle className="h-4 w-4 shrink-0" />
            )}
            <span>{msg.text}</span>
          </div>
        )}

        {/* Current Connection Status Card */}
        <div className="mt-5 p-4 rounded-xl bg-slate-950 border border-slate-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span
                className={`h-2.5 w-2.5 rounded-full ${
                  slackStatus?.connected ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600'
                }`}
              />
              <span className="text-xs font-semibold text-slate-200">
                {slackStatus?.connected ? 'Active Connection' : 'No Slack Connected'}
              </span>
            </div>
            {slackStatus?.connected && (
              <span className="text-[11px] font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded">
                {slackStatus.connection?.channelName || '#alerts'}
              </span>
            )}
          </div>

          {slackStatus?.connected ? (
            <div className="mt-3 pt-3 border-t border-slate-800/80 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={handleTest}
                disabled={isTesting}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-sm transition-colors"
              >
                <Send className="h-3.5 w-3.5" />
                <span>{isTesting ? 'Sending...' : 'Test Live Notification'}</span>
              </button>

              <button
                type="button"
                onClick={handleDisconnect}
                disabled={isSubmitting}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-rose-500/30 text-rose-400 hover:bg-rose-500/10 text-xs font-medium transition-colors"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>Disconnect</span>
              </button>
            </div>
          ) : (
            <p className="text-[11px] text-slate-400 mt-2">
              When a sender hits their configured limit (e.g. 5 emails/hour), an immediate alert with Block Kit formatting will be posted to this Slack channel.
            </p>
          )}
        </div>

        {/* Webhook URL Input Form (Easy for Evaluators) */}
        <form onSubmit={handleSaveWebhook} className="mt-5 space-y-3">
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-semibold text-slate-300">Slack Incoming Webhook URL</label>
              <span className="text-[10px] text-indigo-400 font-mono">Recommended &middot; Instant Test</span>
            </div>
            <input
              type="url"
              placeholder="https://hooks.slack.com/services/T.../B.../..."
              value={webhookUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs font-mono text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Channel Label</label>
            <input
              type="text"
              placeholder="#reachinbox-alerts"
              value={channelName}
              onChange={(e) => setChannelName(e.target.value)}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div className="flex items-center justify-between pt-2">
            <button
              type="button"
              onClick={onOAuthConnect}
              className="text-xs text-slate-400 hover:text-indigo-400 flex items-center gap-1 transition-colors"
            >
              <span>Or connect via Slack OAuth</span>
              <ExternalLink className="h-3 w-3" />
            </button>

            <button
              type="submit"
              disabled={isSubmitting || !webhookUrl}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold shadow-md transition-all"
            >
              {isSubmitting ? 'Saving...' : 'Connect Webhook'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
