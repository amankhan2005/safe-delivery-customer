/**
 * navigation/index.jsx — PRODUCTION-SAFE
 *
 * FIXES:
 * 1. NavigationContainer wrapped in try/catch error boundary via ErrorBoundary.
 * 2. Tab route lookup guarded — state.routes.find() can return undefined if
 *    a route hasn't mounted yet (causes crash on rapid navigation).
 * 3. All navigation.navigate() calls inside tab bar wrapped in try/catch.
 */
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import useAuthStore from '../store/authStore';
import { COLORS, SIZES, SHADOWS, FONT_WEIGHT } from '../theme';

import OnboardingScreen  from '../screens/auth/OnboardingScreen';
import LoginScreen       from '../screens/auth/LoginScreen';
import SignupScreen      from '../screens/auth/SignupScreen';
import VerifyPhoneOTP    from '../screens/auth/VerifyPhoneOTPScreen';
import VerifyEmailOTP    from '../screens/auth/VerifyEmailOTPScreen';
import ForgotPassword    from '../screens/auth/ForgotPasswordScreen';
import ResetPassword     from '../screens/auth/ResetPasswordScreen';
import TermsScreen       from '../screens/TermsScreen';
import HomeScreen        from '../screens/main/HomeScreen';
import OrdersScreen      from '../screens/main/OrdersScreen';
import BookScreen        from '../screens/main/BookScreen';
import TrackScreen       from '../screens/main/TrackScreen';
import ProfileScreen     from '../screens/main/ProfileScreen';
import OrderDetailScreen from '../screens/main/OrderDetailScreen';
import MapPickerScreen   from '../screens/main/MapPickerScreen';

const Stack = createStackNavigator();
const Tab   = createBottomTabNavigator();

// ─── Error Boundary — prevents navigation errors from killing the whole app ──
class NavErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(error) {
    // Log but never rethrow — keep app alive
    try { console.warn('[NavErrorBoundary]', error?.message); } catch (_) {}
  }
  render() {
    if (this.state.hasError) {
      return (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F4F6FB', padding: 32 }}>
          <Text style={{ fontSize: 18, fontWeight: '800', color: '#111827', marginBottom: 8 }}>Something went wrong</Text>
          <Text style={{ fontSize: 14, color: '#6B7280', textAlign: 'center', marginBottom: 24 }}>
            Please restart the app. Your data is safe.
          </Text>
          <TouchableOpacity
            style={{ backgroundColor: COLORS.primary, paddingHorizontal: 28, paddingVertical: 14, borderRadius: 12 }}
            onPress={() => this.setState({ hasError: false })}
          >
            <Text style={{ color: '#fff', fontWeight: '800', fontSize: 15 }}>Try Again</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return this.props.children;
  }
}

function CustomTabBar({ state, descriptors, navigation }) {
  const tabs = [
    { name: 'Home',    icon: 'home',      iconOut: 'home-outline' },
    { name: 'Orders',  icon: 'list',      iconOut: 'list-outline' },
    { name: 'Book',    icon: 'add',       iconOut: 'add', isCenter: true },
    { name: 'Track',   icon: 'navigate',  iconOut: 'navigate-outline' },
    { name: 'Profile', icon: 'person',    iconOut: 'person-outline' },
  ];

  return (
    <View style={tab.bar}>
      {tabs.map((t, i) => {
        // Safe route lookup — find() can return undefined
        const route   = state.routes.find(r => r.name === t.name);
        if (!route) return null;
        const focused  = state.index === state.routes.indexOf(route);
        const onPress  = () => {
          try { navigation.navigate(t.name); } catch (_) {}
        };

        if (t.isCenter) {
          return (
            <TouchableOpacity key="Book" onPress={onPress} style={tab.centerWrap} activeOpacity={0.85}>
              <View style={tab.centerBtn}>
                <Ionicons name="add" size={30} color={COLORS.white} />
              </View>
              <Text style={tab.centerLabel}>Book</Text>
            </TouchableOpacity>
          );
        }

        return (
          <TouchableOpacity key={t.name} onPress={onPress} style={tab.item} activeOpacity={0.75}>
            <Ionicons name={focused ? t.icon : t.iconOut} size={22} color={focused ? COLORS.primary : COLORS.gray400} />
            <Text style={[tab.label, focused && tab.labelActive]}>{t.name}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const tab = StyleSheet.create({
  bar:         { flexDirection: 'row', backgroundColor: COLORS.white, borderTopWidth: 1, borderTopColor: COLORS.border, paddingBottom: Platform.OS === 'ios' ? 24 : 10, paddingTop: 10, paddingHorizontal: SIZES.lg, alignItems: 'flex-end', ...SHADOWS.md },
  item:        { flex: 1, alignItems: 'center', gap: 3 },
  label:       { fontSize: 10, fontWeight: FONT_WEIGHT.semibold, color: COLORS.gray400 },
  labelActive: { color: COLORS.primary },
  centerWrap:  { flex: 1, alignItems: 'center', marginTop: -28 },
  centerBtn:   { width: 56, height: 56, borderRadius: 28, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: COLORS.white, ...SHADOWS.blue },
  centerLabel: { fontSize: 10, fontWeight: FONT_WEIGHT.semibold, color: COLORS.gray400, marginTop: 3 },
});

function TabNavigator() {
  return (
    <Tab.Navigator tabBar={(props) => <CustomTabBar {...props} />} screenOptions={{ headerShown: false }}>
      <Tab.Screen name="Home"    component={HomeScreen} />
      <Tab.Screen name="Orders"  component={OrdersScreen} />
      <Tab.Screen name="Book"    component={BookScreen} />
      <Tab.Screen name="Track"   component={TrackScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

function AuthStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Onboarding"  component={OnboardingScreen} />
      <Stack.Screen name="Login"       component={LoginScreen} />
      <Stack.Screen name="Signup"      component={SignupScreen} />
      <Stack.Screen name="VerifyPhone" component={VerifyPhoneOTP} />
      <Stack.Screen name="VerifyEmail" component={VerifyEmailOTP} />
      <Stack.Screen name="ForgotPass"  component={ForgotPassword} />
      <Stack.Screen name="ResetPass"   component={ResetPassword} />
      <Stack.Screen name="Terms"       component={TermsScreen} />
    </Stack.Navigator>
  );
}

function MainStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Tabs"        component={TabNavigator} />
      <Stack.Screen name="OrderDetail" component={OrderDetailScreen} />
      <Stack.Screen name="Terms"       component={TermsScreen} />
      <Stack.Screen name="MapPicker"   component={MapPickerScreen} />
    </Stack.Navigator>
  );
}

export default function AppNavigator({ onReady }) {
  const { token, loading, init } = useAuthStore();
  React.useEffect(() => { init(); }, []);

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.white }}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <NavErrorBoundary>
      <NavigationContainer onReady={onReady}>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          {!token
            ? <Stack.Screen name="Auth" component={AuthStack} />
            : <Stack.Screen name="Main" component={MainStack} />
          }
        </Stack.Navigator>
      </NavigationContainer>
    </NavErrorBoundary>
  );
}