import { hrefOf, isTab, parseRoute, type Route } from './router';

describe('parseRoute', () => {
  it('maps the tab paths', () => {
    expect(parseRoute('')).toEqual({ name: 'calendar' });
    expect(parseRoute('#/')).toEqual({ name: 'calendar' });
    expect(parseRoute('#/weeks')).toEqual({ name: 'weeks' });
    expect(parseRoute('#/plans')).toEqual({ name: 'plans' });
    expect(parseRoute('#/settings')).toEqual({ name: 'settings' });
  });

  it('reads the wizard routes and their parameters', () => {
    expect(parseRoute('#/plans/new')).toEqual({ name: 'plan-new' });
    expect(parseRoute('#/plans/new?from=abc')).toEqual({ name: 'plan-new', fromPlanId: 'abc' });
    expect(parseRoute('#/plans/edit/plan%201')).toEqual({ name: 'plan-edit', planId: 'plan 1' });
  });

  it('falls back to the calendar for unknown paths and incomplete edit routes', () => {
    expect(parseRoute('#/nowhere')).toEqual({ name: 'calendar' });
    expect(parseRoute('#/plans/edit')).toEqual({ name: 'plans' });
  });
});

describe('hrefOf', () => {
  it('round-trips every route', () => {
    const routes: Route[] = [
      { name: 'calendar' },
      { name: 'weeks' },
      { name: 'plans' },
      { name: 'settings' },
      { name: 'plan-new' },
      { name: 'plan-new', fromPlanId: 'a b' },
      { name: 'plan-edit', planId: 'x/y' },
    ];
    for (const route of routes) expect(parseRoute(hrefOf(route))).toEqual(route);
  });
});

describe('isTab', () => {
  it('is true for the four tabs only', () => {
    expect(isTab({ name: 'weeks' })).toBe(true);
    expect(isTab({ name: 'plan-new' })).toBe(false);
  });
});
