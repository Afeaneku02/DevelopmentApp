import { AuthProvider, useAuth } from './auth/AuthContext';
import AuthScreen from './screens/AuthScreen';
import GoalsScreen from './screens/GoalsScreen';

function AppShell() {
  const { user } = useAuth();
  return user ? <GoalsScreen /> : <AuthScreen />;
}

export default function App() {
  return (
    <AuthProvider>
      <AppShell />
    </AuthProvider>
  );
}
