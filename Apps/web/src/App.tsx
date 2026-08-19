import { useState } from 'react';
import { AuthProvider, useAuth } from './auth/AuthContext';
import AuthScreen from './screens/AuthScreen';
import GoalsScreen from './screens/GoalsScreen';
import ProfileScreen from './screens/ProfileScreen';

type View = 'goals' | 'profile';

function AppShell() {
  const { user } = useAuth();
  const [view, setView] = useState<View>('goals');

  if (!user) {
    return <AuthScreen />;
  }
  if (view === 'profile') {
    return <ProfileScreen onBack={() => setView('goals')} />;
  }
  return <GoalsScreen onOpenProfile={() => setView('profile')} />;
}

export default function App() {
  return (
    <AuthProvider>
      <AppShell />
    </AuthProvider>
  );
}
