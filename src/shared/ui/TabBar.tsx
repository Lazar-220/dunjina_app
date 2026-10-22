import { hrefOf, type TabRoute } from '../router';
import { Icon, type IconName } from './Icon';

const TABS: { route: TabRoute; label: string; icon: IconName }[] = [
  { route: { name: 'calendar' }, label: 'Calendar', icon: 'calendar' },
  { route: { name: 'weeks' }, label: 'Weeks', icon: 'weeks' },
  { route: { name: 'plans' }, label: 'Plans', icon: 'plans' },
  { route: { name: 'settings' }, label: 'Settings', icon: 'settings' },
];

export function TabBar({ current }: { current: TabRoute['name'] }) {
  return (
    <nav className="tabbar" aria-label="Main">
      {TABS.map(({ route, label, icon }) => (
        <a
          key={route.name}
          className={route.name === current ? 'tab on' : 'tab'}
          href={hrefOf(route)}
          aria-current={route.name === current ? 'page' : undefined}
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
