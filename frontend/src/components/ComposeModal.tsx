import React, { useState, useRef } from 'react';
import { Sender } from '../types';
import { X, Upload, Mail, Clock, ShieldAlert, Sparkles, CheckCircle2, AlertCircle } from 'lucide-react';

interface ComposeModalProps {
  isOpen: boolean;
  onClose: () => void;
  senders: Sender[];
  onSchedule: (payload: {
    senderId: string;
    subject: string;
    body: string;
    recipients: string[];
    startTime?: string;
    delaySeconds: number;
    hourlyLimit: number;
  }) => Promise<void>;
}

export const ComposeModal: React.FC<ComposeModalProps> = ({
  isOpen,
  onClose,
  senders,
  onSchedule,
}) => {
  const [selectedSenderId, setSelectedSenderId] = useState(senders[0]?.id || '');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [leadText, setLeadText] = useState('');
  const [parsedEmails, setParsedEmails] = useState<string[]>([]);
  const [startTime, setStartTime] = useState('');
  const [delaySeconds, setDelaySeconds] = useState(2);
  const [hourlyLimit, setHourlyLimit] = useState(5);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Update selected sender when senders list updates
  React.useEffect(() => {
    if (!selectedSenderId && senders.length > 0) {
      setSelectedSenderId(senders[0].id);
      setHourlyLimit(senders[0].hourlyLimit || 5);
    }
  }, [senders, selectedSenderId]);

  if (!isOpen) return null;

  // Extract email addresses from file content or typed text
  const extractEmails = (text: string) => {
    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
    const matches = text.match(emailRegex) || [];
    const unique = Array.from(new Set(matches.map((e) => e.trim().toLowerCase())));
    setParsedEmails(unique);
  };

  const handleLeadTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value;
    setLeadText(text);
    extractEmails(text);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setLeadText(content);
      extractEmails(content);
    };
    reader.readAsText(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!selectedSenderId) {
      setErrorMsg('Please select a sender');
      return;
    }
    if (!subject.trim()) {
      setErrorMsg('Subject cannot be empty');
      return;
    }
    if (!body.trim()) {
      setErrorMsg('Body cannot be empty');
      return;
    }
    if (parsedEmails.length === 0) {
      setErrorMsg('Please provide at least one valid recipient email');
      return;
    }

    try {
      setIsSubmitting(true);
      await onSchedule({
        senderId: selectedSenderId,
        subject,
        body,
        recipients: parsedEmails,
        startTime: startTime || undefined,
        delaySeconds,
        hourlyLimit,
      });
      onClose();
    } catch (err: any) {
      setErrorMsg(err.response?.data?.error || err.message || 'Failed to schedule emails');
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedSender = senders.find((s) => s.id === selectedSenderId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6 text-slate-100">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Mail className="h-5 w-5 text-indigo-400" />
              Compose New Scheduled Campaign
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Upload leads, set throttling delay, and enqueue into BullMQ persistent queue.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {errorMsg && (
          <div className="mt-4 p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-xs text-rose-400 flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          {/* Sender Selector */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">From (Sender Account)</label>
            <select
              value={selectedSenderId}
              onChange={(e) => {
                setSelectedSenderId(e.target.value);
                const s = senders.find((item) => item.id === e.target.value);
                if (s) setHourlyLimit(s.hourlyLimit);
              }}
              className="w-full px-3.5 py-2.5 bg-slate-950/80 border border-slate-800 rounded-xl text-sm text-slate-200 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            >
              {senders.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.emailAddress}) &middot; Limit: {s.hourlyLimit}/hr (Used: {s.sentThisHour})
                </option>
              ))}
            </select>
          </div>

          {/* Subject */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">Subject</label>
            <input
              type="text"
              placeholder="e.g. Transforming cold email outreach with ReachInbox AI"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-950/80 border border-slate-800 rounded-xl text-sm text-slate-200 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              required
            />
          </div>

          {/* Body */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">Body (Text / HTML)</label>
            <textarea
              rows={4}
              placeholder="Hey {{name}}, We noticed your team is scaling outreach. ReachInbox automates high-intent lead delivery..."
              value={body}
              onChange={(e) => setBody(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-950/80 border border-slate-800 rounded-xl text-sm text-slate-200 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 font-mono text-xs"
              required
            />
          </div>

          {/* Leads Upload & Paste */}
          <div className="bg-slate-950/60 border border-slate-800/80 p-4 rounded-xl space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold text-slate-200">Recipient Leads (CSV / TXT or Paste)</span>
                <span className="text-[11px] text-slate-500 block">
                  Duplicates and invalid formats are automatically stripped.
                </span>
              </div>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 font-medium transition-colors"
              >
                <Upload className="h-3.5 w-3.5 text-indigo-400" />
                <span>Upload CSV / TXT</span>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.txt,.tsv"
                onChange={handleFileUpload}
                className="hidden"
              />
            </div>

            <textarea
              rows={3}
              placeholder="Paste comma or newline separated email addresses:&#10;lead1@example.com&#10;lead2@domain.com, lead3@reachinbox.ai"
              value={leadText}
              onChange={handleLeadTextChange}
              className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-200 font-mono focus:outline-none focus:border-indigo-500"
            />

            {/* Email Count Preview Badge */}
            <div className="flex items-center justify-between pt-1">
              <div className="flex items-center gap-2">
                <span
                  className={`text-xs font-semibold px-2.5 py-1 rounded-md flex items-center gap-1.5 ${
                    parsedEmails.length > 0
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                      : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span>{parsedEmails.length} valid lead{parsedEmails.length === 1 ? '' : 's'} detected</span>
                </span>
              </div>
              {parsedEmails.length > 0 && (
                <span className="text-[11px] text-slate-500">
                  Estimated duration: ~{parsedEmails.length * delaySeconds}s
                </span>
              )}
            </div>

            {/* Sample parsed chips preview */}
            {parsedEmails.length > 0 && (
              <div className="flex flex-wrap gap-1.5 max-h-20 overflow-y-auto pt-1">
                {parsedEmails.slice(0, 10).map((email, idx) => (
                  <span
                    key={idx}
                    className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-800/80 text-indigo-300 border border-slate-700/60"
                  >
                    {email}
                  </span>
                ))}
                {parsedEmails.length > 10 && (
                  <span className="text-[11px] text-slate-500 self-center">
                    +{parsedEmails.length - 10} more
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Scheduling Configuration Controls */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
            {/* Start Time */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                Start Time (Optional)
              </label>
              <input
                type="datetime-local"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950/80 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
              />
              <span className="text-[10px] text-slate-500">Defaults to immediately</span>
            </div>

            {/* Delay between sends */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                Delay Between Emails (sec)
              </label>
              <input
                type="number"
                min="0"
                max="300"
                value={delaySeconds}
                onChange={(e) => setDelaySeconds(parseInt(e.target.value, 10) || 0)}
                className="w-full px-3 py-2 bg-slate-950/80 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
              />
              <span className="text-[10px] text-slate-500">Provider throttling delay</span>
            </div>

            {/* Hourly Rate Limit */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                Hourly Limit (emails/hr)
              </label>
              <input
                type="number"
                min="1"
                max="1000"
                value={hourlyLimit}
                onChange={(e) => setHourlyLimit(parseInt(e.target.value, 10) || 1)}
                className="w-full px-3 py-2 bg-slate-950/80 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
              />
              <span className="text-[10px] text-amber-400/80">Triggers Slack notification</span>
            </div>
          </div>

          {/* Submit Buttons */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-700 bg-slate-800/80 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || parsedEmails.length === 0}
              className="flex items-center gap-2 px-6 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold shadow-lg shadow-indigo-600/30 transition-all"
            >
              {isSubmitting ? (
                <>
                  <div className="h-3.5 w-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Enqueuing Jobs...</span>
                </>
              ) : (
                <>
                  <Clock className="h-4 w-4" />
                  <span>Schedule {parsedEmails.length} Email{parsedEmails.length === 1 ? '' : 's'}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
