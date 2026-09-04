const apiUrl = process.env.EXPO_PUBLIC_API_URL?.trim();

export const env = {
  apiUrl: apiUrl || 'http://localhost:3000',
  demoMode: process.env.EXPO_PUBLIC_DEMO_MODE !== 'false',
} as const;
