import type { ApiGuide, Guide } from '@/types/guide';
// Explicit server-shaped fixtures keep UI tests on the merged API contract.
export function apiGuide(g: Guide): ApiGuide {
 const web = g.platform === 'web';
 const names: Record<string,string> = web ? {welcome:'home',definition:'definition',stock:'stock',dashboard:'quantity'} : {'home-basics':'home','choose-item':'definition','add-stock':'inventory','dashboard-tips':'quantity'};
 return {id:g.id, revision:g.revision, platform:g.platform, version:g.version,
  variant:{content_version:1,min_client_version:1,entry_point:'session',steps:web?['home','definition','stock','quantity']:['home','definition','inventory','quantity']},
  state:{status:g.status === 'available'?'not_started':g.status,step_id:names[g.checkpoint.step] || '',home_id:g.checkpoint.home_id,
   deferred_until:g.checkpoint.deferred_until,definition_id:g.checkpoint.definition_id,inventory_id:g.checkpoint.inventory_id},
  available:g.available,unavailable_reasons:g.available?[]:['home_required'],can_write:g.can_write,
  should_offer:g.available && !['completed','skipped'].includes(g.status) && (!g.checkpoint.deferred_until || Date.parse(g.checkpoint.deferred_until) <= Date.now())};
}
