import React, { useEffect, useCallback, useState } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import * as SplashScreen from 'expo-splash-screen';
import AppNavigator from './src/navigation';
import useAuthStore from './src/store/authStore';
import { connectSocket, disconnectSocket } from './src/services/socketService';
import { pingBackend } from './src/api';

// Keep splash visible until app is ready
SplashScreen.preventAutoHideAsync().catch(() => {});

// ── Backend ping on startup — wakes Render free plan ────────────────────────
pingBackend();

// ── Error Boundary — prevents full crash on unexpected errors ────────────────
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(error, info) {
    console.error('[ErrorBoundary]', error, info);
  }
  render() {
    if (this.state.hasError) {
      return (
        <View style={EB.container}>
          <Text style={EB.emoji}>⚠️</Text>
          <Text style={EB.title}>Something went wrong</Text>
          <Text style={EB.sub}>Please restart the app</Text>
        </View>
      );
    }
    return this.props.children;
  }
}
const EB = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff', padding: 32 },
  emoji:     { fontSize: 48, marginBottom: 16 },
  title:     { fontSize: 20, fontWeight: '700', color: '#111827', marginBottom: 8 },
  sub:       { fontSize: 14, color: '#6B7280', textAlign: 'center' },
});

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
    <ErrorBoundary>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <SocketManager />
          <AppNavigator onReady={onReady} />
          <Toast position="top" topOffset={60} visibilityTime={3500} />
          <StatusBar style="auto" />
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
}