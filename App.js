import React, { useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import * as SplashScreen from 'expo-splash-screen';
import AppNavigator from './src/navigation';
import useAuthStore from './src/store/authStore';
import { connectSocket, disconnectSocket } from './src/services/socketService';
import { pingBackend } from './src/api';

// NOTE: expo-navigation-bar setBackgroundColorAsync is NOT supported when
// edge-to-edge is enabled (Android 15+ / targetSdk 36). We guard the call
// with a try/catch and only attempt it on older Android where it is safe.
// The enableEdgeToEdge: false flag in app.json is the primary fix.
import * as NavigationBar from 'expo-navigation-bar';

SplashScreen.preventAutoHideAsync().catch(() => {});
pingBackend(); // Wake up Render free plan

// Safe navigation bar setup — wrapped so it NEVER crashes the app
if (Platform.OS === 'android') {
  Promise.resolve()
    .then(() => NavigationBar.setBackgroundColorAsync('#ffffff'))
    .catch(() => {/* edge-to-edge enabled – skip silently */})
    .then(() => NavigationBar.setButtonStyleAsync('dark'))
    .catch(() => {});
}

// ── Global Error Boundary ─────────────────────────────────────────────────────
class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { hasError: false, error: null }; }

  static getDerivedStateFromError(error) { return { hasError: true, error }; }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary] Caught:', error?.message, info?.componentStack?.slice(0, 200));
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <View style={EB.c}>
        <Text style={EB.icon}>⚠️</Text>
        <Text style={EB.title}>Something went wrong</Text>
        <Text style={EB.sub}>Please restart the app</Text>
        <TouchableOpacity style={EB.btn} onPress={() => this.setState({ hasError: false, error: null })}>
          <Text style={EB.btnTxt}>Try Again</Text>
        </TouchableOpacity>
      </View>
    );
  }
}

const EB = StyleSheet.create({
  c:      { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff', padding: 32 },
  icon:   { fontSize: 52, marginBottom: 16 },
  title:  { fontSize: 20, fontWeight: '700', color: '#111827', marginBottom: 8 },
  sub:    { fontSize: 14, color: '#6B7280', textAlign: 'center', lineHeight: 20, marginBottom: 24 },
  btn:    { backgroundColor: '#1B4FD8', paddingHorizontal: 32, paddingVertical: 12, borderRadius: 12 },
  btnTxt: { color: '#fff', fontWeight: '700', fontSize: 15 },
});

// ── Socket manager ────────────────────────────────────────────────────────────
function SocketManager() {
  const token = useAuthStore((s) => s.token);
  React.useEffect(() => {
    if (token) { connectSocket().catch(() => {}); }
    else       { disconnectSocket(); }
  }, [token]);
  return null;
}

// ── Main App ──────────────────────────────────────────────────────────────────
export default function App() {
  const onReady = useCallback(async () => {
    try { await SplashScreen.hideAsync(); } catch {}
  }, []);

  return (
    <ErrorBoundary>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <SocketManager />
          <AppNavigator onReady={onReady} />
          <Toast
            position="top"
            topOffset={Platform.OS === 'android' ? 48 : 60}
            visibilityTime={3500}
          />
          <StatusBar style="auto" translucent={false} />
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
}