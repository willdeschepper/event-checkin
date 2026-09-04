import type { ConfigContext, ExpoConfig } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'Event Check-in',
  slug: 'event-checkin',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  scheme: 'eventcheckin',
  userInterfaceStyle: 'automatic',
  ios: {
    supportsTablet: true,
    bundleIdentifier: 'com.willdeschepper.eventcheckin',
    infoPlist: {
      NSCameraUsageDescription: 'A câmera é usada para ler o QR Code do participante.',
    },
  },
  android: {
    package: 'com.willdeschepper.eventcheckin',
    adaptiveIcon: {
      backgroundColor: '#0B1220',
      foregroundImage: './assets/android-icon-foreground.png',
      monochromeImage: './assets/android-icon-monochrome.png',
    },
    permissions: ['CAMERA'],
    predictiveBackGestureEnabled: false,
  },
  web: {
    bundler: 'metro',
    output: 'static',
    favicon: './assets/favicon.png',
  },
  plugins: [
    'expo-router',
    [
      'expo-splash-screen',
      {
        image: './assets/splash-icon.png',
        imageWidth: 160,
        resizeMode: 'contain',
        backgroundColor: '#0B1220',
      },
    ],
    [
      'expo-camera',
      {
        cameraPermission: 'Permita o acesso à câmera para ler o QR Code do participante.',
        recordAudioAndroid: false,
      },
    ],
    'expo-secure-store',
  ],
  experiments: {
    typedRoutes: true,
    reactCompiler: true,
  },
});
