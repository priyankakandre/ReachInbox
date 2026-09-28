import React, { useState, useEffect, useCallback } from 'react';
import { api } from './api/client';
import { User, Sender, Email, SlackStatus, EmailStats } from './types';
import { Header } from './components/Header';
import { StatCards } from './components/StatCards';
import { EmailTable } from './components/EmailTable';
import { ComposeModal } from './components/ComposeModal';
import { SlackModal } from './components/SlackModal';
import { LoginView } from './components/LoginView';

export function App() {
  const [user, setUser] = useState<User | null>(null);
  const [senders, setSenders] = useState<Sender[]>([]);
  const [emails, setEmails] = useState<Email[]>([]);
  const [stats, setStats] = useState<EmailStats | null>(null);
  const [slackStatus, setSlackStatus] = useState<SlackStatus | null>(null);
  const [currentTab, setCurrentTab] = useState<'SCHEDULED' | 'SENT' | 'ALL'>('SCHEDULED');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoadingEmails, setIsLoadingEmails] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);

  // Modals
  const [isComposeOpen, setIsComposeOpen] = useState(false);
  const [isSlackOpen, setIsSlackOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Check URL params for OAuth token callback
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');
    if (token) {
      localStorage.setItem('reachinbox_token', token);
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  // Fetch initial profile
  useEffect(() => {
    const initAuth = async () => {
      const token = localStorage.getItem('reachinbox_token');
      if (!token) {
        setIsInitializing(false);
        return;
      }
      try {
        const u = await api.auth.getMe();
        setUser(u);
      } catch (err) {
        localStorage.removeItem('reachinbox_token');
      } finally {
        setIsInitializing(false);
      }
    };
    initAuth();
  }, []);

  // Fetch senders and slack status
  const loadMetadata = useCallback(async () => {
    if (!user) return;
    try {
      const [sList, sStatus] = await Promise.all([
        api.senders.list(),
        api.slack.status(),
      ]);
      setSenders(sList);
      setSlackStatus(sStatus);
    } catch (err) {
      console.error('Failed to load metadata', err);
    }
  }, [user]);

  // Fetch emails and stats
  const loadEmails = useCallback(async (isBackground: boolean = false) => {
    if (!user) return;
    if (!isBackground) setIsLoadingEmails(true);

    try {
      const [sData, eData] = await Promise.all([
        api.emails.stats(),
        searchQuery.trim()
          ? api.emails.search(searchQuery, currentTab)
          : api.emails.list(currentTab, 1, 50).then((res) => res.emails),
      ]);

      setStats(sData);
      setEmails(eData);
    } catch (err) {
      console.error('Failed to load emails', err);
    } finally {
      if (!isBackground) setIsLoadingEmails(false);
    }
  }, [user, currentTab, searchQuery]);

  // Initial load
  useEffect(() => {
    if (user) {
      loadMetadata();
      loadEmails();
    }
  }, [user, currentTab, searchQuery, loadMetadata, loadEmails]);

  // Periodic polling to update scheduled jobs and sent email status in real time
  useEffect(() => {
    if (!user) return;
    const interval = setInterval(() => {
      loadEmails(true);
      loadMetadata();
    }, 4000);
    return () => clearInterval(interval);
  }, [user, loadEmails, loadMetadata]);

  // Auth Handlers
  const handleGoogleLogin = async () => {
    try {
      const url = await api.auth.getGoogleUrl();
      window.location.href = url;
    } catch (err: any) {
      showToast(err.response?.data?.error || 'Google OAuth not configured in backend');
    }
  };

  const handleDemoLogin = async () => {
    const res = await api.auth.demoLogin();
    setUser(res.user);
    showToast(`Logged in as evaluator: ${res.user.email}`);
  };

  const handleLogout = async () => {
    await api.auth.logout();
    setUser(null);
  };

  // Email Scheduling Handler
  const handleScheduleEmails = async (payload: any) => {
    const res = await api.emails.schedule(payload);
    showToast(res.message || 'Emails scheduled successfully in BullMQ queue!');
    loadEmails();
    loadMetadata();
  };

  // Load Test Simulation Handler
  const handleLoadTest = async () => {
    try {
      showToast('Enqueuing 1000 benchmark jobs into BullMQ...');
      const res = await api.emails.loadTest(1000);
      showToast(res.message || '1000 jobs enqueued! Inspect /queues to watch BullMQ processing.');
      loadEmails();
      loadMetadata();
    } catch (err: any) {
      showToast('Load test failed: ' + err.message);
    }
  };

  // Slack Handlers
  const handleSetSlackWebhook = async (webhookUrl: string, channelName?: string) => {
    await api.slack.setWebhook(webhookUrl, channelName);
    const sStatus = await api.slack.status();
    setSlackStatus(sStatus);
    showToast('Slack webhook connected and verified!');
  };

  const handleTestSlack = async () => {
    await api.slack.test();
    showToast('Live test notification sent to Slack!');
  };

  const handleDisconnectSlack = async () => {
    await api.slack.disconnect();
    setSlackStatus({ connected: false, connection: null });
    showToast('Slack disconnected.');
  };

  const handleSlackOAuth = async () => {
    showToast('Slack OAuth authorization flow');
  };

  if (isInitializing) {
    return (
      <div className="min-h-screen bg-[#0B0F19] flex items-center justify-center">
        <div className="h-8 w-8 border-3 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <LoginView onGoogleLogin={handleGoogleLogin} onDemoLogin={handleDemoLogin} />;
  }

  return (
    <div className="min-h-screen bg-[#0B0F19] text-slate-100 flex flex-col">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 border border-indigo-500/40 shadow-2xl rounded-xl px-4 py-3 text-xs text-indigo-300 font-semibold flex items-center gap-2 animate-in slide-in-from-bottom duration-300">
          <span className="h-2 w-2 rounded-full bg-indigo-400 animate-pulse" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Header */}
      <Header
        user={user}
        slackStatus={slackStatus}
        onOpenCompose={() => setIsComposeOpen(true)}
        onOpenSlack={() => setIsSlackOpen(true)}
        onLogout={handleLogout}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
      />

      {/* Main Body */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-6 py-6 space-y-6">
        {/* Metric Cards and Quick Actions */}
        <StatCards
          stats={stats}
          primarySender={senders[0] || null}
          onOpenCompose={() => setIsComposeOpen(true)}
          onLoadTest={handleLoadTest}
          onRefresh={() => {
            loadEmails();
            loadMetadata();
          }}
          isLoading={isLoadingEmails}
        />

        {/* Email Table (Scheduled / Sent) */}
        <EmailTable
          emails={emails}
          currentTab={currentTab}
          onTabChange={setCurrentTab}
          isLoading={isLoadingEmails}
          searchQuery={searchQuery}
        />
      </main>

      {/* Compose Modal */}
      <ComposeModal
        isOpen={isComposeOpen}
        onClose={() => setIsComposeOpen(false)}
        senders={senders}
        onSchedule={handleScheduleEmails}
      />

      {/* Slack Integration Modal */}
      <SlackModal
        isOpen={isSlackOpen}
        onClose={() => setIsSlackOpen(false)}
        slackStatus={slackStatus}
        onSetWebhook={handleSetSlackWebhook}
        onTestNotification={handleTestSlack}
        onDisconnect={handleDisconnectSlack}
        onOAuthConnect={handleSlackOAuth}
      />
    </div>
  );
}

export default App;
