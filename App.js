import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import AppNavigator from './src/navigation';
import useAuthStore from './src/store/authStore';
import { connectSocket, disconnectSocket } from './src/services/socketService';

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
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <SocketManager />
        <AppNavigator />
        <Toast
          config={{}}
          position="top"
          topOffset={60}
          visibilityTime={3500}
        />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}