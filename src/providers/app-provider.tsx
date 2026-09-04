import NetInfo from '@react-native-community/netinfo';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { PropsWithChildren } from 'react';
import { useEffect } from 'react';
import { AppState } from 'react-native';

import {
  initializeCheckInQueue,
  synchronizeCheckIns,
} from '@/features/check-in/controller';
import { useQueueStore } from '@/features/check-in/queue-store';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 2 },
  },
});

function QueueLifecycle() {
  const setOnline = useQueueStore(state => state.setOnline);

  useEffect(() => {
    void initializeCheckInQueue().then(synchronizeCheckIns);

    const unsubscribeNetwork = NetInfo.addEventListener((state) => {
      const online = Boolean(
        state.isConnected && state.isInternetReachable !== false,
      );
      setOnline(online);
      if (online) void synchronizeCheckIns();
    });

    const appStateSubscription = AppState.addEventListener(
      'change',
      (state) => {
        if (state === 'active') void synchronizeCheckIns();
      },
    );
    const foregroundRetry = setInterval(() => {
      if (AppState.currentState === 'active') void synchronizeCheckIns();
    }, 15_000);

    return () => {
      unsubscribeNetwork();
      appStateSubscription.remove();
      clearInterval(foregroundRetry);
    };
  }, [setOnline]);

  return null;
}

export function AppProvider({ children }: PropsWithChildren) {
  return (
    <QueryClientProvider client={queryClient}>
      <QueueLifecycle />
      {children}
    </QueryClientProvider>
  );
}
