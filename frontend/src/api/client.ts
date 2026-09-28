import axios from 'axios';
import { User, Sender, Email, SlackStatus, EmailStats } from '../types';

const API_BASE = 'http://localhost:5000';

export const apiClient = axios.create({
  baseURL: API_BASE,
  withCredentials: true,
});

apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('reachinbox_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const api = {
  auth: {
    demoLogin: async () => {
      const res = await apiClient.post<{ success: boolean; token: string; user: User }>('/auth/demo-login');
      if (res.data.token) {
        localStorage.setItem('reachinbox_token', res.data.token);
      }
      return res.data;
    },
    getGoogleUrl: async () => {
      const res = await apiClient.get<{ success: boolean; url: string }>('/auth/google');
      return res.data.url;
    },
    getMe: async () => {
      const res = await apiClient.get<{ success: boolean; user: User }>('/auth/me');
      return res.data.user;
    },
    logout: async () => {
      localStorage.removeItem('reachinbox_token');
      await apiClient.post('/auth/logout');
    },
  },
  senders: {
    list: async () => {
      const res = await apiClient.get<{ success: boolean; senders: Sender[] }>('/senders');
      return res.data.senders;
    },
    create: async (data: Partial<Sender> & { smtpPassword?: string }) => {
      const res = await apiClient.post<{ success: boolean; sender: Sender }>('/senders', data);
      return res.data.sender;
    },
  },
  emails: {
    schedule: async (payload: {
      senderId: string;
      subject: string;
      body: string;
      recipients?: string[];
      leadsRaw?: string;
      startTime?: string;
      delaySeconds?: number;
      hourlyLimit?: number;
    }) => {
      const res = await apiClient.post('/emails/schedule', payload);
      return res.data;
    },
    list: async (status?: string, page: number = 1, limit: number = 25) => {
      const params: any = { page, limit };
      if (status && status !== 'ALL') {
        params.status = status;
      }
      const res = await apiClient.get<{
        success: boolean;
        data: { total: number; page: number; totalPages: number; emails: Email[] };
      }>('/emails', { params });
      return res.data.data;
    },
    stats: async () => {
      const res = await apiClient.get<{ success: boolean; data: EmailStats }>('/emails/stats');
      return res.data.data;
    },
    search: async (query: string, status?: string) => {
      const res = await apiClient.get<{ success: boolean; data: Email[] }>('/emails/search', {
        params: { q: query, status: status !== 'ALL' ? status : undefined },
      });
      return res.data.data;
    },
    loadTest: async (count: number = 1000) => {
      const res = await apiClient.post('/emails/load-test', { count });
      return res.data;
    },
    resetRateLimit: async (senderId: string) => {
      const res = await apiClient.post('/emails/reset-rate-limit', { senderId });
      return res.data;
    },
  },
  slack: {
    status: async () => {
      const res = await apiClient.get<SlackStatus>('/slack/status');
      return res.data;
    },
    setWebhook: async (webhookUrl: string, channelName?: string) => {
      const res = await apiClient.post('/slack/webhook', { webhookUrl, channelName });
      return res.data;
    },
    test: async () => {
      const res = await apiClient.post('/slack/test');
      return res.data;
    },
    disconnect: async () => {
      const res = await apiClient.post('/slack/disconnect');
      return res.data;
    },
  },
};
