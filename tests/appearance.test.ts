import { JSDOM } from 'jsdom';
import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import React from 'react';
import { Users } from 'lucide-react';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost', pretendToBeVisual: true });
for (const name of ['window', 'document', 'navigator', 'HTMLElement', 'HTMLInputElement', 'Element', 'Node', 'NodeFilter', 'Event', 'CustomEvent', 'MutationObserver', 'getComputedStyle']) {
  Object.defineProperty(globalThis, name, { configurable: true, writable: true, value: dom.window[name as keyof Window] });
}
let narrow = false;
Object.defineProperty(window, 'matchMedia', { configurable: true, value: (query: string) => ({
  matches: query.includes('max-width') ? narrow : !narrow, media: query,
  addEventListener() {}, removeEventListener() {},
}) });
const { render, screen, cleanup, within } = await import('@testing-library/react');
const { default: userEvent } = await import('@testing-library/user-event');
const { PageHeader } = await import('../src/components/layout/PageHeader');
const { PortalShell } = await import('../src/portal/PortalShell');
const { Switch } = await import('../src/components/ui/Switch');
const { Select } = await import('../src/components/ui/Select');
const { FloatingPanel } = await import('../src/components/ui/FloatingPanel');
const { MenuItem, MenuList } = await import('../src/components/ui/Menu');
const { Tabs } = await import('../src/components/ui/Tabs');
afterEach(() => { cleanup(); narrow = false; });
const noop = () => {};
const base = { company: 'Pacific Dispatch', login: 'dispatcher', primary: 'Shippers', icon: Users, settings: false,
  onHome: noop, onSettings: noop, onLogout: noop, loggingOut: false };

test('page header keeps its title and page actions without a duplicate Monitor button', async () => {
  const user = userEvent.setup({ document }); let created = 0;
  render(React.createElement(PageHeader, { title: 'Orders', description: 'Current delivery orders.',
    actions: React.createElement('button', { onClick: () => { created += 1; } }, 'New order') }));
  assert.ok(screen.getByRole('heading', { level: 1, name: 'Orders' }));
  assert.ok(screen.getByText('Current delivery orders.'));
  assert.equal(screen.queryByRole('button', { name: 'Back to Monitor' }), null);
  await user.click(screen.getByRole('button', { name: 'New order' }));
  assert.equal(created, 1);
});

test('portal shell preserves form drafts while toggling navigation and exposes the current destination', async () => {
  const user = userEvent.setup({ document }); let home = 0, settings = 0, logout = 0;
  const props = { ...base, onHome: () => { home += 1; }, onSettings: () => { settings += 1; }, onLogout: () => { logout += 1; } };
  const view = render(React.createElement(PortalShell, { ...props, children: React.createElement('input', { 'aria-label': 'Customer name' }) }));
  assert.equal(screen.getByRole('button', { name: 'Shippers' }).getAttribute('aria-current'), 'page');
  await user.type(screen.getByLabelText('Customer name'), 'Unsaved customer');
  await user.click(screen.getByRole('button', { name: 'Collapse menu' }));
  assert.ok(screen.getByRole('navigation', { name: 'Portal navigation' }));
  assert.equal(screen.getByRole('complementary', { name: 'Workspace sidebar' }).getAttribute('data-collapsed'), 'true');
  const logo = screen.getByRole('button', { name: 'Expand menu' });
  assert.ok(logo.querySelector('img'));
  assert.equal(logo.querySelector('svg'), null);
  assert.equal(screen.getByRole('button', { name: 'Shippers' }).title, 'Shippers');
  assert.equal((screen.getByLabelText('Customer name') as HTMLInputElement).value, 'Unsaved customer');
  await user.click(screen.getByRole('button', { name: 'Account settings' }));
  logo.focus(); await user.keyboard('{Enter}');
  assert.equal(home, 0, 'The collapsed logo expands without navigating home');
  await user.click(screen.getByRole('button', { name: 'Dispatra — Shippers' }));
  await user.click(screen.getByRole('button', { name: 'Sign out' }));
  assert.deepEqual([home, settings, logout], [1, 1, 1]);
  assert.equal((screen.getByLabelText('Customer name') as HTMLInputElement).value, 'Unsaved customer');
  view.rerender(React.createElement(PortalShell, { ...props, settings: true, loggingOut: true, children: null }));
  assert.equal(screen.getByRole('button', { name: 'Account settings' }).getAttribute('aria-current'), 'page');
  assert.equal((screen.getByRole('button', { name: 'Sign out' }) as HTMLButtonElement).disabled, true);
});

test('mobile workspace sidebar traps focus, dismisses with Escape and closes after navigation', async () => {
  narrow = true;
  const user = userEvent.setup({ document }); let visited = 0;
  render(React.createElement(PortalShell, { ...base, onSettings: () => { visited += 1; }, children: React.createElement('input', { 'aria-label': 'Customer name' }) }));
  assert.equal(screen.queryByRole('navigation'), null);
  const open = screen.getByRole('button', { name: 'Open menu' });
  await user.click(open);
  const dialog = screen.getByRole('dialog', { name: 'Workspace sidebar' });
  const brand = within(dialog).getByRole('button', { name: 'Dispatra — Shippers' });
  assert.equal(document.activeElement, brand);
  await user.keyboard('{Shift>}{Tab}{/Shift}');
  assert.equal(document.activeElement, within(dialog).getByRole('button', { name: 'Sign out' }));
  await user.keyboard('{Tab}'); assert.equal(document.activeElement, brand);
  await user.keyboard('{Escape}');
  assert.equal(screen.queryByRole('dialog'), null); assert.equal(document.activeElement, open);
  await user.click(open); await user.click(screen.getByRole('button', { name: 'Account settings' }));
  assert.equal(visited, 1); assert.equal(screen.queryByRole('dialog'), null);
  await user.click(open); await user.click(screen.getByRole('button', { name: 'Close navigation' }));
  assert.equal(screen.queryByRole('dialog'), null);
});

test('shared switch supports keyboard changes and cannot change while disabled', async () => {
  const user = userEvent.setup({ document });
  function Example() {
    const [checked, setChecked] = React.useState(false);
    return React.createElement(Switch, { checked, onCheckedChange: setChecked, 'aria-label': 'Auto dispatch' });
  }
  const view = render(React.createElement(Example));
  const control = screen.getByRole('switch', { name: 'Auto dispatch' });
  await user.tab(); assert.equal(document.activeElement, control);
  await user.keyboard(' '); assert.equal(control.getAttribute('aria-checked'), 'true');
  await user.keyboard('{Enter}'); assert.equal(control.getAttribute('aria-checked'), 'false');
  let changes = 0;
  view.rerender(React.createElement(Switch, { checked: false, disabled: true, onCheckedChange: () => { changes += 1; }, 'aria-label': 'Auto dispatch' }));
  await user.click(screen.getByRole('switch')); assert.equal(changes, 0);
});

test('animated select retains keyboard selection and hides closed options from navigation', async () => {
  HTMLElement.prototype.scrollIntoView = () => {};
  const user = userEvent.setup({ document });
  function Example() {
    const [value, setValue] = React.useState('one');
    return React.createElement(Select, { value, onValueChange: setValue, 'aria-label': 'Selection', options: [
      { value: 'one', label: 'One' }, { value: 'two', label: 'Two', disabled: true }, { value: 'three', label: 'Three' },
    ] });
  }
  render(React.createElement(Example));
  assert.equal(screen.queryByRole('listbox'), null);
  const trigger = screen.getByRole('combobox');
  await user.tab(); await user.keyboard('{ArrowDown}{ArrowDown}');
  assert.equal(screen.getByRole('option', { name: 'Three' }).id, trigger.getAttribute('aria-activedescendant'));
  await user.keyboard('{Enter}'); assert.match(trigger.textContent!, /Three/);
  assert.equal(screen.queryByRole('listbox'), null); assert.equal(document.activeElement, trigger);
  await user.click(trigger); await user.keyboard('{Escape}');
  assert.equal(screen.queryByRole('option'), null);
  await user.click(trigger); await user.click(document.body);
  assert.equal(screen.queryByRole('listbox'), null);
});

test('shared menus portal outside clipping parents, navigate commands, and restore focus', async () => {
  const user = userEvent.setup({ document });
  function Example() {
    const [open, setOpen] = React.useState(false);
    return React.createElement('div', { 'data-testid': 'clipping-parent', style: { overflow: 'hidden' } },
      React.createElement(FloatingPanel, { open, onOpenChange: setOpen, label: 'Actions',
        trigger: React.createElement('button', null, 'Open actions'),
        children: React.createElement(MenuList, { children: [
          React.createElement(MenuItem, { key: 'first' }, 'First action'),
          React.createElement(MenuItem, { key: 'disabled', disabled: true }, 'Disabled action'),
          React.createElement(MenuItem, { key: 'last' }, 'Last action'),
        ] }),
      }), React.createElement('button', null, 'Outside'));
  }
  render(React.createElement(Example));
  const trigger = screen.getByRole('button', { name: 'Open actions' });
  await user.click(trigger);
  const menu = screen.getByRole('dialog', { name: 'Actions' });
  assert.equal(menu.closest('[data-testid="clipping-parent"]'), null);
  assert.equal(trigger.getAttribute('aria-controls'), menu.id);
  assert.equal(document.activeElement, screen.getByRole('button', { name: 'First action' }));
  await user.keyboard('{ArrowDown}'); assert.equal(document.activeElement, screen.getByRole('button', { name: 'Last action' }));
  await user.keyboard('{Home}'); assert.equal(document.activeElement, screen.getByRole('button', { name: 'First action' }));
  await user.keyboard('{Escape}'); assert.equal(screen.queryByRole('dialog'), null); assert.equal(document.activeElement, trigger);
  await user.click(trigger); await user.click(screen.getByRole('button', { name: 'Outside' }));
  assert.equal(screen.queryByRole('dialog'), null); assert.equal(document.activeElement, screen.getByRole('button', { name: 'Outside' }));
});

test('select typeahead finds enabled options and empty dropdowns explain their state', async () => {
  const user = userEvent.setup({ document });
  let value = '';
  const props = { value: '', onValueChange: (next: string) => { value = next; }, 'aria-label': 'Province',
    options: [{ value: 'bc', label: 'British Columbia' }, { value: 'ab', label: 'Alberta', disabled: true }, { value: 'on', label: 'Ontario' }] };
  const view = render(React.createElement(Select, props));
  await user.tab(); await user.keyboard('ont{Enter}'); assert.equal(value, 'on');
  view.rerender(React.createElement(Select, { ...props, options: [] }));
  await user.click(screen.getByRole('combobox')); assert.ok(screen.getByText('No options available'));
  await user.keyboard('{ArrowDown}{Enter}'); assert.equal(value, 'on');
});

test('shared tabs skip disabled sections, expose linked panels, and retain drafts', async () => {
  const user = userEvent.setup({ document });
  render(React.createElement(Tabs, { label: 'Sections', items: [
    { id: 'general', label: 'General', content: React.createElement('input', { 'aria-label': 'Draft name' }) },
    { id: 'disabled', label: 'Unavailable', disabled: true, content: null },
    { id: 'taxes', label: 'Taxes', content: 'Tax content' },
  ] }));
  await user.type(screen.getByRole('textbox'), 'Unsaved');
  const general = screen.getByRole('tab', { name: 'General' }); general.focus();
  await user.keyboard('{ArrowRight}');
  const taxes = screen.getByRole('tab', { name: 'Taxes' });
  assert.equal(document.activeElement, taxes); assert.equal(taxes.getAttribute('aria-selected'), 'true');
  assert.equal(screen.getByRole('tabpanel').id, taxes.getAttribute('aria-controls'));
  await user.keyboard('{Home}'); assert.equal(document.activeElement, general);
  assert.equal((screen.getByRole('textbox') as HTMLInputElement).value, 'Unsaved');
});

test('Help topic dropdown combines with search, clears correctly and supports keyboard selection', async () => {
  const { HelpSupportPage } = await import('../src/pages/HelpSupportPage');
  const user = userEvent.setup({ document });
  render(React.createElement(HelpSupportPage));
  const topic = screen.getByRole('combobox', { name: 'Help topic' });
  assert.equal(screen.queryByRole('button', { name: 'All Topics' }), null);
  assert.ok(screen.getByRole('heading', { name: 'Standard Operational Guides (6)' }));
  await user.click(topic);
  assert.equal(screen.getAllByRole('option').length, 6);
  await user.click(screen.getByRole('option', { name: 'Exceptions & Delays' }));
  assert.ok(screen.getByRole('heading', { name: 'Standard Operational Guides (2)' }));
  const search = screen.getByRole('searchbox', { name: 'Search help articles' });
  await user.type(search, 'unattended');
  assert.ok(screen.getByRole('heading', { name: 'Standard Operational Guides (1)' }));
  const question = screen.getByRole('button', { name: /What is the Proof of Delivery/ });
  assert.equal(question.getAttribute('aria-expanded'), 'false');
  await user.click(question); assert.equal(question.getAttribute('aria-expanded'), 'true');
  assert.ok(document.getElementById(question.getAttribute('aria-controls')!));
  await user.clear(search); await user.type(search, 'privacy');
  assert.ok(screen.getByText('No matching articles found'));
  await user.click(screen.getByRole('button', { name: 'Clear search' }));
  assert.ok(screen.getByRole('heading', { name: 'Standard Operational Guides (2)' }));
  topic.focus(); await user.keyboard('{ArrowDown}{End}{Enter}');
  assert.match(topic.textContent!, /Drivers & Telemetry/);
  assert.ok(screen.getByRole('heading', { name: 'Standard Operational Guides (1)' }));
  assert.ok(screen.getByRole('button', { name: /What happens when a driver ends their shift/ }));
  await user.click(topic); await user.click(screen.getByRole('option', { name: 'All Topics' }));
  assert.ok(screen.getByRole('heading', { name: 'Standard Operational Guides (6)' }));
});

test('driver assignment uses the shared keyboard menu, restores focus and reports the selected driver', async () => {
  const { DriverAssignmentMenu } = await import('../src/components/entities/DriverAssignmentMenu');
  const user = userEvent.setup({ document }); const selected: string[] = [];
  function Example() {
    const [open, setOpen] = React.useState(false);
    return React.createElement(DriverAssignmentMenu, { open, onOpenChange: setOpen, onSelect: id => selected.push(id), drivers: [
      { id: 'first', name: 'First Driver', avatar: '/dispatra.png', statusLabel: 'Available' },
      { id: 'second', name: 'Second Driver', avatar: '/dispatra.png', statusLabel: 'Available' },
    ] });
  }
  render(React.createElement(Example));
  const trigger = screen.getByRole('button', { name: 'Assign Driver' });
  trigger.focus(); await user.keyboard('{ArrowDown}');
  const menu = screen.getByRole('menu', { name: 'Assign Driver' });
  assert.equal(trigger.parentElement!.contains(menu), false, 'The menu escapes table clipping through the shared portal');
  await user.keyboard('{End}{Enter}');
  assert.deepEqual(selected, ['second']);
  assert.equal(screen.queryByRole('menu', { name: 'Assign Driver' }), null);
  assert.equal(document.activeElement, trigger);
  await user.keyboard('{ArrowDown}{Escape}');
  assert.equal(screen.queryByRole('menu', { name: 'Assign Driver' }), null);
  assert.equal(document.activeElement, trigger);
  assert.deepEqual(selected, ['second']);
});
