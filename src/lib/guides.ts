import type { ApiGuide, Guide, GuideCatalog, GuideInput } from '@/types/guide';

export const GUIDE_CLIENT_VERSION = 2;
const steps: Record<'web' | 'mobile', Record<string, string>> = {
 web: { home: 'welcome', definition: 'definition', stock: 'stock', quantity: 'dashboard' },
 mobile: { home: 'home-basics', definition: 'choose-item', inventory: 'add-stock', quantity: 'dashboard-tips' },
};
export function fromApiGuide(view: ApiGuide): Guide {
 const names = view.id === 'introduction' ? steps[view.platform] : {};
 const status = view.state.status === 'not_started' ? 'available' : view.state.status;
 return { id:view.id, revision:view.revision, platform:view.platform, platform_revision:view.variant.content_version,
  steps:view.variant.steps.map(step => names[step] || step), available:view.available,
  unavailable_reason:view.unavailable_reasons[0] || '', can_write:view.can_write, status, version:view.version,
  checkpoint:{ revision:view.variant.content_version, status, step:names[view.state.step_id] || view.state.step_id || names[view.variant.steps[0]] || view.variant.steps[0],
   restored:false, deferred_until:view.state.deferred_until, home_id:view.state.home_id,
   definition_id:view.state.definition_id || null, inventory_id:view.state.inventory_id || null } };
}
export function fromApiCatalog(views: ApiGuide[], context: string, registered: string[]): GuideCatalog {
 const supported = views.filter(view => registered.includes(view.id));
 const invitation = context === 'settings' ? undefined : supported.find(view => view.should_offer &&
  (view.variant.entry_point === context || (view.variant.entry_point === 'session' && ['dashboard','inventory','item-definitions'].includes(context))));
 return { guides:supported.map(fromApiGuide), invitation_id:invitation?.id || null };
}
export function guideCommand(guide: Guide, input: GuideInput, home: string | null, requestId: string): { setup:boolean; body:Record<string,unknown> } {
 const setup = ['choose_definition','create_definition','choose_inventory','create_inventory'].includes(input.action);
 const body: Record<string,unknown> = { ...input, request_id:requestId, platform:guide.platform, client_version:GUIDE_CLIENT_VERSION,
  revision:guide.revision, expected_version:guide.version };
 if (input.step) {
  body.step_id = Object.entries(steps[guide.platform]).find(([,name]) => name === input.step)?.[0] || input.step;
  delete body.step;
 }
 if (['start','checkpoint','complete'].includes(input.action) && home) body.home_id = home;
 if (input.action === 'defer') { body.action = 'maybe_later'; body.defer_until = new Date(Date.now() + 86400000).toISOString(); }
 return { setup, body };
}
