import { describe, expect, it } from 'vitest';
import type { ApiGuide } from '@/types/guide';
import { fromApiCatalog, fromApiGuide, guideCommand } from './guides';

const view = (platform: 'web'|'mobile' = 'web'): ApiGuide => ({id:'introduction',revision:1,platform,version:7,
 variant:{content_version:2,min_client_version:1,entry_point:'session',steps:platform === 'web'?['home','definition','stock','quantity']:['home','definition','inventory','quantity']},
 state:{status:'in_progress',step_id:platform === 'web'?'stock':'inventory',home_id:'home',deferred_until:null,definition_id:'saved-definition',inventory_id:null},
 available:true,unavailable_reasons:[],can_write:true,should_offer:true});

describe('merged guide protocol',()=>{
 it('keeps backend checkpoints specific to each platform and carries saved resources',()=>{
  expect(fromApiGuide(view())).toMatchObject({id:'introduction',status:'in_progress',checkpoint:{step:'stock',definition_id:'saved-definition'}});
  const mobile = fromApiGuide(view('mobile'));
  expect(mobile.checkpoint.step).toBe('add-stock');
  expect(guideCommand(mobile,{action:'checkpoint',step:'dashboard-tips'},'home','request').body).toMatchObject({client_version:2,step_id:'quantity',home_id:'home'});
 });
 it('offers one registered contextual guide and preserves restored not_started state',()=>{
  const restored = view(); restored.state={...restored.state,status:'not_started',step_id:'',home_id:null};
  expect(fromApiGuide(restored)).toMatchObject({status:'available',checkpoint:{step:'welcome'}});
  const unsupported={...view(),id:'future-guide'};
  expect(fromApiCatalog([unsupported,restored],'dashboard',['introduction']).invitation_id).toBe('introduction');
  expect(fromApiCatalog([restored],'settings',['introduction']).invitation_id).toBeNull();
  restored.state.status='completed';restored.should_offer=false;
  expect(fromApiCatalog([restored],'dashboard',['introduction']).invitation_id).toBeNull();
 });
 it('keeps lifecycle payloads separate from atomic setup and uses the merged field names',()=>{
  const guide=fromApiGuide(view());
  const saved=guideCommand(guide,{action:'create_inventory',inventory:{item_definition_id:'saved-definition',quantity:2.5,quantity_unit_id:'kg'}},'home','request');
  expect(saved.setup).toBe(true);expect(saved.body).not.toHaveProperty('home_id');expect(saved.body).not.toHaveProperty('platform_revision');
  const deferred=guideCommand(guide,{action:'defer'},'home','request');
  expect(deferred).toMatchObject({setup:false,body:{action:'maybe_later',client_version:2}});
  expect(deferred.body).not.toHaveProperty('home_id');expect(Date.parse(deferred.body.defer_until as string)).toBeGreaterThan(Date.now());
 });
});
