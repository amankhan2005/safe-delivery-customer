import React, { useEffect, useCallback } from 'react';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import * as SplashScreen from 'expo-splash-screen';
import AppNavigator from './src/navigation';
import useAuthStore from './src/store/authStore';
import { connectSocket, disconnectSocket } from './src/services/socketService';

// Keep splash visible until app is ready
SplashScreen.preventAutoHideAsync().catch(() => {});

function SocketManager() {
  const token = useAuthStore((s) => s.token);
  useEffect(() => {
    if (token) {
      connectSocket().catch(() => {});
    } else {
      disconnectSocket();
    }
  }, [token]);
  return null;
}

export default function App() {
  const onReady = useCallback(async () => {
    try {
      await SplashScreen.hideAsync();
    } catch {}
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <SocketManager />
        <AppNavigator onReady={onReady} />
        <Toast
          position="top"
          topOffset={60}
          visibilityTime={3500}
        />
        <StatusBar style="auto" />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}