import { expect, type Page } from '@playwright/test';
import type { Category, InventoryItem, ItemDefinition, MaintenanceTask } from '../src/types';

// In-memory fixtures: no real credentials, storage-state files, or live backend writes.
export async function mockApi(page: Page, language: string) {
  const homeId = 'ui-test-home';
  const user = {
    id: '00000000-0000-4000-8000-000000000001',
    email: 'ui-test@example.test',
    aud: 'authenticated',
    app_metadata: {},
    user_metadata: {},
    created_at: new Date().toISOString(),
  };
  const token = [
    'header',
    Buffer.from(
      JSON.stringify({ sub: user.id, exp: Math.floor(Date.now() / 1000) + 3600 }),
    ).toString('base64url'),
    'test-signature',
  ].join('.');
  const state = {
    categories: [
      { ID: 'c3', Name: 'Zucchini', ParentID: 'c1' },
      { ID: 'c4', Name: 'Tools' },
      { ID: 'c1', Name: 'Food' },
      { ID: 'c2', Name: 'Apples', ParentID: 'c1' },
    ] as Category[],
    definitions: [] as ItemDefinition[],
    inventory: [] as InventoryItem[],
    tasks: [] as MaintenanceTask[],
    failUpdate: false,
    theme: 'Dark',
  };
  const unit = { ID: 'unit', Name: language === 'tr' ? 'adet' : 'pieces' };
  const definition: ItemDefinition = {
    ID: 'seed-definition',
    Name: 'Sample Milk',
    Description: '',
    CategoryID: 'c2',
    SizeUnitID: unit.ID,
    SizeUnit: unit,
    IsExpirable: true,
    ImageURL: '/ui-test-image.svg',
  };
  state.definitions.push(definition);
  state.inventory.push({
    ID: 'seed-inventory',
    HomeID: homeId,
    ItemDefinitionID: definition.ID,
    ItemDefinition: definition,
    Quantity: 2,
    ExpirationDate: '2030-01-05T00:00:00Z',
  });
  await page
    .context()
    .addCookies([{ name: 'NEXT_LOCALE', value: language, url: 'http://localhost:3000' }]);
  await page.route('**/auth/v1/**', async (route) => {
    await route.fulfill({
      json: route.request().url().includes('/token')
        ? {
            access_token: token,
            refresh_token: 'test-refresh',
            token_type: 'bearer',
            expires_in: 3600,
            user,
          }
        : { user },
    });
  });
  await page.route('**/storage/v1/**', (route) => route.fulfill({ json: [] }));
  await page.route('**/ui-test-image.svg', (route) =>
    route.fulfill({
      contentType: 'image/svg+xml',
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400"><rect width="400" height="400" fill="#6366f1"/><circle cx="200" cy="200" r="100" fill="white"/></svg>',
    }),
  );
  await page.route('**/api/v1/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname.split('/api/v1')[1];
    const method = request.method();
    const data = method === 'POST' || method === 'PUT' ? request.postDataJSON() : null;
    const reply = (json: unknown, status = 200) => route.fulfill({ json, status });
    if (/^\/(categories|item-definitions|inventory)/.test(path)) {
      expect(request.headers()['x-home-id']).toBe(homeId);
      expect(url.searchParams.has('homeId')).toBe(false);
    }
    if (path === '/profiles/sync') return reply({});
    if (path === '/profiles')
      return reply({
        web_theme: state.theme,
        Language: { name: language === 'tr' ? 'Türkçe' : 'English' },
      });
    if (path === '/homes')
      return reply([
        {
          HomeID: homeId,
          Role: 'owner',
          IsDefault: true,
          Home: { ID: homeId, Name: 'UI Test Home' },
        },
      ]);
    if (path === '/size-units') return reply([unit]);
    if (path === '/inventory/almost-finished')
      return reply(
        state.definitions
          .slice(0, 2)
          .map((item, index) => ({
            item_definition: item,
            total_quantity: 2,
            reason: index ? 'threshold_met' : 'low_stock',
            estimated_days_left: 2,
          })),
      );
    if (path === '/inventory/insights/restock') return reply([]);
    if (path === '/inventory/expiring') return reply(state.inventory);
    if (path === '/shopping-list') return reply([]);
    const [, resource, id] = path.split('/');
    if (resource === 'maintenance-tasks') {
      if (method === 'PUT')
        Object.assign(
          state.tasks.find((task) => task.ID === id)!,
          {
            Description: data.description,
            ScheduledDate: data.scheduled_date,
            Frequency: data.frequency,
          },
        );
      return reply(state.tasks);
    }
    if (resource === 'categories') {
      if (method === 'POST') {
        state.categories.push({
          ID: `category-${Date.now()}`,
          Name: data.name,
          ParentID: data.parent_id,
        });
        return reply(state.categories.at(-1));
      }
      if (method === 'PUT')
        Object.assign(
          state.categories.find((item) => item.ID === id)!,
          { Name: data.name, ParentID: data.parent_id },
        );
      if (method === 'DELETE') state.categories = state.categories.filter((item) => item.ID !== id);
      return reply(state.categories);
    }
    if (resource === 'item-definitions') {
      if (method === 'POST' || method === 'PUT') {
        const updated = {
          ID: id || `definition-${Date.now()}`,
          Name: data.name,
          Description: data.description || '',
          CategoryID: data.category_id,
          SizeUnitID: data.size_unit_id,
          IsExpirable: data.is_expirable,
          ImageURL: data.image_url || '',
          low_stock_threshold: data.low_stock_threshold,
          SizeUnit: unit,
        };
        if (method === 'POST') state.definitions.push(updated);
        else
          Object.assign(
            state.definitions.find((item) => item.ID === id)!,
            updated,
          );
      }
      if (method === 'DELETE')
        state.definitions = state.definitions.filter((item) => item.ID !== id);
      return reply(
        state.definitions.map((item) => ({
          ...item,
          Category: state.categories.find((category) => category.ID === item.CategoryID),
        })),
      );
    }
    if (resource === 'inventory') {
      if (method === 'PUT' && state.failUpdate) return reply({ error: 'Test failure' }, 500);
      if (method === 'POST')
        state.inventory.push({
          ID: `inventory-${Date.now()}`,
          HomeID: homeId,
          ItemDefinitionID: data.item_definition_id,
          ItemDefinition: state.definitions.find((item) => item.ID === data.item_definition_id)!,
          Quantity: data.quantity,
          ExpirationDate: data.expiry_date,
        });
      if (method === 'PUT')
        Object.assign(
          state.inventory.find((item) => item.ID === id)!,
          { Quantity: data.quantity, ExpirationDate: data.expiry_date },
        );
      if (method === 'DELETE') state.inventory = state.inventory.filter((item) => item.ID !== id);
      return reply(
        state.inventory.map((item) => ({
          ...item,
          ItemDefinition: {
            ...state.definitions.find((definition) => definition.ID === item.ItemDefinitionID)!,
            Category: state.categories.find(
              (category) =>
                category.ID ===
                state.definitions.find((definition) => definition.ID === item.ItemDefinitionID)
                  ?.CategoryID,
            ),
          },
        })),
      );
    }
    return reply({});
  });
  return state;
}
