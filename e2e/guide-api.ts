import { expect, type Page } from '@playwright/test';
import { apiGuide } from '../src/test/guideFixture';
import type { Guide } from '../src/types/guide';
import { mockApi } from './mock-api';
export const introduction = 'introduction';
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
      expect(url.searchParams.get('client_version')).toBe('2');
      expect(url.searchParams.has('capabilities')).toBe(false);
      if (!request.headers()['x-home-id']) return route.fulfill({ json: [apiGuide({ ...guide, available:false, unavailable_reason:'home_required', can_write:false })] });
      expect(request.headers()['x-home-id']).toBe(home);
      return route.fulfill({ json: [{ ...apiGuide(guide), should_offer:!deferred && !['completed','skipped'].includes(guide.status) }] });
    }
    expect(request.headers()['x-home-id']).toBe(home);
    const body = request.postDataJSON(); controls.posts.push(body);
    expect(body.platform).toBe(platform); expect(body.client_version).toBe(2); expect(body).not.toHaveProperty('platform_revision');
    const setup = ['choose_definition','create_definition','choose_inventory','create_inventory'].includes(body.action);
    expect(url.pathname.endsWith(setup ? '/setup' : '/actions')).toBe(true);
    if (setup) expect(body).not.toHaveProperty('home_id');
    expect(body.request_id).toMatch(/^[0-9a-f-]{36}$/);
    if (body.expected_version !== guide.version) return route.fulfill({ status: 409, json: { error: 'stale guide' } });
    if (body.action === 'create_inventory' && controls.failStockOnce) { controls.failStockOnce = false; return route.fulfill({ status: 500, json: { error: 'fixture stock save failed' } }); }
    const checkpoint = { ...guide.checkpoint, home_id: home };
    let status = guide.status;
    if (body.action === 'start') { status = 'in_progress'; deferred = false; }
    if (body.action === 'checkpoint') {
      const canonical = platform === 'web' ? ['home','definition','stock','quantity'] : ['home','definition','inventory','quantity'];
      checkpoint.step = steps[canonical.indexOf(body.step_id)];
    }
    if (body.action === 'maybe_later') { deferred = true; checkpoint.deferred_until = body.defer_until; }
    if (body.action === 'restore') { status = 'available'; deferred = false; checkpoint.step = steps[0]; checkpoint.definition_id = null; checkpoint.inventory_id = null; checkpoint.restored = true; }
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
    return route.fulfill({ json:apiGuide(guide) });
  });
  return { state, controls };
}
