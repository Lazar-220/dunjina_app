import { hrefOf, type Route } from '../router';
import { Icon, type IconName } from './Icon';

const TABS: { route: Route; label: string; icon: IconName }[] = [
  { route: '/', label: 'Calendar', icon: 'calendar' },
  { route: '/weeks', label: 'Weeks', icon: 'weeks' },
  { route: '/plans', label: 'Plans', icon: 'plans' },
  { route: '/settings', label: 'Settings', icon: 'settings' },
];

export function TabBar({ current }: { current: Route }) {
  return (
    <nav className="tabbar" aria-label="Main">
      {TABS.map(({ route, label, icon }) => (
        <a
          key={route}
          className={route === current ? 'tab on' : 'tab'}
          href={hrefOf(route)}
          aria-current={route === current ? 'page' : undefined}
        >
          <span className="pill">
            <Icon name={icon} />
          </span>
          {label}
        </a>
      ))}
    </nav>
  );
}
