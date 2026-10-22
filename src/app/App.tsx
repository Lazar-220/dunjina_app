import { RepositoryProvider } from '../data/RepositoryContext';
import type { Repository } from '../data/repository';
import { CalendarScreen } from '../features/calendar/CalendarScreen';
import { PlanDataProvider } from '../features/plan-data/PlanDataProvider';
import { WeeksScreen } from '../features/weeks/WeeksScreen';
import { PlansScreen } from '../features/plans/PlansScreen';
import { SettingsProvider } from '../features/settings/SettingsProvider';
import { SettingsScreen } from '../features/settings/SettingsScreen';
import { WizardScreen } from '../features/wizard/WizardScreen';
import { isTab, useRoute } from '../shared/router';
import { TabBar } from '../shared/ui/TabBar';
import { ToastProvider } from '../shared/ui/Toast';

function Shell() {
  const route = useRoute();
  switch (route.name) {
    case 'plan-new':
    case 'plan-edit':
      return <WizardScreen route={route} />;
    case 'calendar':
    case 'weeks':
    case 'plans':
    case 'settings':
      return (
        <>
          {route.name === 'calendar' && <CalendarScreen />}
          {route.name === 'weeks' && <WeeksScreen />}
          {route.name === 'plans' && <PlansScreen />}
          {route.name === 'settings' && <SettingsScreen />}
          {isTab(route) && <TabBar current={route.name} />}
        </>
      );
  }
}

export function App({ repository }: { repository: Repository }) {
  return (
    <RepositoryProvider repository={repository}>
      <div className="app">
        <SettingsProvider>
          <ToastProvider>
            <PlanDataProvider>
              <Shell />
            </PlanDataProvider>
          </ToastProvider>
        </SettingsProvider>
      </div>
    </RepositoryProvider>
  );
}
