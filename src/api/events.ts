import { env } from '@/config/env';
import { demoEvents } from '@/features/events/demo-events';
import type { EventSummary } from '@/features/events/model';

import { apiClient } from './client';

export async function fetchEvents(): Promise<EventSummary[]> {
  if (env.demoMode) return demoEvents;
  const response = await apiClient.get<EventSummary[]>('/events');
  return response.data;
}
