import { expect, type Page } from '@playwright/test';
import type { Guide } from '../src/types/guide';
import { mockApi } from './mock-api';
export const introduction = 'inventory-introduction';
export async function mockGuideApi(page: Page, language: string, options: { empty?: boolean; viewer?: boolean; platform?: 'web' | 'mobile' } = {}) {
  const state = await mockApi(page, language);
  if (options.empty) { state.definitions = []; state.inventory = []; }
  const home = '00000000-0000-4000-8000-000000000001';
  if (options.viewer) await page.route('**/api/v1/homes', route => route.fulfill({ json: [{ HomeID: home, Role: 'viewer', IsDefault: true, Home: { ID: home, Name: 'UI Test Home' } }] }));
  const platform = options.platform || 'web';
  const steps = platform === 'web' ? ['welcome', 'definition', 'stock', 'dashboard'] : ['home-basics', 'choose-item', 'add-stock', 'dashboard-tips'];
  let guide: Guide = { id: introduction, revision: 1, platform, platform_revision: 1, steps, available: true, unavailable_reason: '', can_write: !options.viewer, status: 'available', version: 0,
    checkpoint: { revision: 1, status: 'available', step: steps[0], restored: false, deferred_until: null, home_id: null, definition_id: null, inventory_id: null } };
  let deferred = false; let mobileOutcome = 'available';
  const controls = { failStockOnce: false, posts: [] as Record<string, unknown>[], get guide() { return guide; }, get mobileOutcome() { return mobileOutcome; } };
  await page.route('**/api/v1/guides**', async route => {
    const request = route.request();
    const url = new URL(request.url());
    expect(request.headers().authorization).toMatch(/^Bearer /);
    if (request.method() === 'GET') {
      expect(url.searchParams.get('platform')).toBe(platform);
      expect(url.searchParams.get('capabilities')).toBe(`${introduction}:1`);
      if (!request.headers()['x-home-id']) return route.fulfill({ json: { guides: [{ ...guide, available: false, unavailable_reason: 'no_home', can_write: false }], invitation_id: null } });
      expect(request.headers()['x-home-id']).toBe(home);
      return route.fulfill({ json: { guides: [guide], invitation_id: !deferred && !['completed', 'skipped'].includes(guide.status) && url.searchParams.get('context') !== 'settings' ? introduction : null } });
    }
    expect(request.headers()['x-home-id']).toBe(home);
    const body = request.postDataJSON(); controls.posts.push(body);
    expect(body.platform).toBe(platform); expect(body.platform_revision).toBe(1);
    expect(body.request_id).toMatch(/^[0-9a-f-]{36}$/);
    if (body.expected_version !== guide.version) return route.fulfill({ status: 409, json: { error: 'stale guide' } });
    if (body.action === 'create_inventory' && controls.failStockOnce) { controls.failStockOnce = false; return route.fulfill({ status: 500, json: { error: 'fixture stock save failed' } }); }
    const checkpoint = { ...guide.checkpoint, home_id: home };
    let status = guide.status;
    if (body.action === 'start') { status = 'in_progress'; deferred = false; }
    if (body.action === 'checkpoint') checkpoint.step = body.step;
    if (body.action === 'defer') { deferred = true; checkpoint.deferred_until = new Date(Date.now() + 86_400_000).toISOString(); }
    if (body.action === 'restore') { status = 'in_progress'; deferred = false; checkpoint.step = steps[0]; checkpoint.definition_id = null; checkpoint.inventory_id = null; checkpoint.restored = true; }
    if (body.action === 'skip' || body.action === 'complete') { status = body.action === 'skip' ? 'skipped' : 'completed'; mobileOutcome = status; checkpoint.restored = false; }
    if (body.action === 'create_definition') {
      expect(options.viewer).not.toBe(true);
      const input = body.definition;
      const definition = { ID: '00000000-0000-4000-8000-000000000010', Name: input.name, Description: '', SizeUnitID: input.size_unit_id, SizeUnit: state.units.find(unit => unit.ID === input.size_unit_id), IsExpirable: false, ImageURL: '' };
      state.definitions.push(definition); checkpoint.definition_id = definition.ID; checkpoint.step = steps[2];
    }
    if (body.action === 'choose_definition') { checkpoint.definition_id = body.definition_id; checkpoint.step = steps[2]; }
    if (body.action === 'choose_inventory') { const stock = state.inventory.find(item => item.ID === body.inventory_id)!; checkpoint.definition_id = stock.ItemDefinitionID; checkpoint.inventory_id = stock.ID; checkpoint.step = steps[3]; }
    if (body.action === 'create_inventory') {
      expect(options.viewer).not.toBe(true);
      const input = body.inventory;
      expect(input.quantity_unit_id).toBeTruthy(); expect(input.item_definition_id).toBe(checkpoint.definition_id);
      const stock = { ID: '00000000-0000-4000-8000-000000000020', HomeID: home, ItemDefinitionID: input.item_definition_id, ItemDefinition: state.definitions.find(item => item.ID === input.item_definition_id)!, Quantity: input.quantity * (state.units.find(unit => unit.ID === input.quantity_unit_id)?.FactorToBase || 1), expiry_date: input.expiry_date };
      state.inventory.push(stock); checkpoint.inventory_id = stock.ID; checkpoint.step = steps[3];
    }
    guide = { ...guide, version: guide.version + 1, status, checkpoint };
    return route.fulfill({ json: guide });
  });
  return { state, controls };
}
