import { RepositoryProvider } from '../data/RepositoryContext';
import type { Repository } from '../data/repository';
import { CalendarScreen } from '../features/calendar/CalendarScreen';
import { PlanDataProvider } from '../features/plan-data/PlanDataProvider';
import { SettingsProvider } from '../features/settings/SettingsProvider';
import { SettingsScreen } from '../features/settings/SettingsScreen';
import { useRoute, type Route } from '../shared/router';
import { TabBar } from '../shared/ui/TabBar';
import { ToastProvider } from '../shared/ui/Toast';
import { PendingScreen } from './PendingScreen';

function Screen({ route }: { route: Route }) {
  switch (route) {
    case '/':
      return <CalendarScreen />;
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
          <PlanDataProvider>
            <ToastProvider>
              <Shell />
            </ToastProvider>
          </PlanDataProvider>
        </SettingsProvider>
      </div>
    </RepositoryProvider>
  );
}
