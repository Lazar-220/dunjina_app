import { RepositoryProvider } from '../data/RepositoryContext';
import type { Repository } from '../data/repository';
import { SettingsProvider } from '../features/settings/SettingsProvider';
import { SettingsScreen } from '../features/settings/SettingsScreen';
import { useRoute, type Route } from '../shared/router';
import { TabBar } from '../shared/ui/TabBar';
import { ToastProvider } from '../shared/ui/Toast';
import { PendingScreen } from './PendingScreen';

function Screen({ route }: { route: Route }) {
  switch (route) {
    case '/':
      return <PendingScreen title="Calendar" />;
    case '/weeks':
      return <PendingScreen title="Weeks" />;
    case '/plans':
      return <PendingScreen title="Plans" />;
    case '/settings':
      return <SettingsScreen />;
  }
}

function Shell() {
  const route = useRoute();
  return (
    <>
      <Screen route={route} />
      <TabBar current={route} />
    </>
  );
}

export function App({ repository }: { repository: Repository }) {
  return (
    <RepositoryProvider repository={repository}>
      <div className="app">
        <SettingsProvider>
          <ToastProvider>
            <Shell />
          </ToastProvider>
        </SettingsProvider>
      </div>
    </RepositoryProvider>
  );
}
