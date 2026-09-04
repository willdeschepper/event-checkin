import { create } from 'axios';
import { env } from '@/config/env';

import { getAccessToken } from './session';

export const apiClient = create({
  baseURL: env.apiUrl,
  timeout: 10_000,
  headers: { 'Content-Type': 'application/json' },
});

apiClient.interceptors.request.use(async (config) => {
  const token = await getAccessToken();
  if (token) config.headers.set('Authorization', `Bearer ${token}`);
  return config;
});
