import { describe, expect, it } from 'vitest';
import { categoryParentIssue, categoryParents, hasInvalidCategoryHierarchy, readCategories } from './categoryHierarchy';
import { getCategoryOptions, getCategoryOrder } from './categoryOptions';
import type { Category } from '@/types';
import { categoryHomeId, categoryIds, categoryWireFixture } from '@/test/categoryFixtures';

const tree: Category[] = [
 {ID:'k',Name:'Kitchen',HomeID:'home',ParentID:null},
 {ID:'d',Name:'Drinks',HomeID:'home',ParentID:'k'},
 {ID:'h',Name:'Household',HomeID:'home'},
];
describe('two-level category integrity',()=>{
 it('offers only roots, excluding self, and prevents a branch becoming a child',()=>{
  expect(categoryParents(tree,'en').map(c=>c.ID)).toEqual(['h','k']);
  expect(categoryParents(tree,'en','h').map(c=>c.ID)).toEqual(['k']);
  expect(categoryParents(tree,'en','k')).toEqual([]);
  expect(categoryParentIssue(tree,'d')).toBe('invalidParent');
  expect(categoryParentIssue(tree,'h','h')).toBe('invalidParent');
  expect(categoryParentIssue(tree,'h','k')).toBe('hasChildren');
  expect(categoryParentIssue(tree,'d','k')).toBe('hasChildren');
  expect(categoryParentIssue(tree,'missing','d')).toBe('invalidParent');
 });
 it('allows valid leaf moves, root promotion and root renaming while preserving input',()=>{
  const before=JSON.stringify(tree);
  expect(categoryParentIssue(tree,'h','d')).toBeNull();
  expect(categoryParentIssue(tree,'k','h')).toBeNull();
  expect(categoryParentIssue(tree,'','d')).toBeNull();
  expect(categoryParentIssue(tree,'','k')).toBeNull();
  expect(categoryParentIssue(tree,'h','deleted')).toBe('dataChanged');
  expect(JSON.stringify(tree)).toBe(before);
 });
 it.each(['',null,{},[{ID:'a'}],[{ID:'a',Name:'A',ParentID:''}],
  [{ID:'a',Name:'A'},{ID:'a',Name:'B'}],[{ID:'a',Name:'A',HomeID:'foreign'}]])('rejects invalid wire data without inventing an empty list: %j',value=>{
  expect(()=>readCategories(value,'home')).toThrow('loadFailed');
 });
 it('preserves malformed IDs once, does not reclassify orphans as valid parents, and builds shallow parent labels',()=>{
  const raw=[...tree,{ID:'s',Name:'Soda',ParentID:'d'},{ID:'o',Name:'Orphan',ParentID:'missing'},
   {ID:'a',Name:'Cycle A',ParentID:'b'},{ID:'b',Name:'Cycle B',ParentID:'a'}];
  const read=readCategories(raw,'home');
  expect(hasInvalidCategoryHierarchy(read)).toBe(true);
  expect(()=>JSON.stringify(read)).not.toThrow();
  const ids=getCategoryOrder(read,'en').map(c=>c.category.ID);
  expect(ids).toHaveLength(raw.length);expect(new Set(ids)).toEqual(new Set(raw.map(c=>c.ID)));
  expect(categoryParents(read,'en').map(c=>c.ID)).toEqual(['h','k']);
  expect(read.find(c=>c.ID==='s')?.Parent?.Name).toBe('Drinks');
  expect(read.find(c=>c.ID==='a')?.Parent?.Parent).toBeUndefined();
  expect(raw[1].ParentID).toBe('k');
 });
 it('retains ordinary category assignment options for both levels',()=>{
  expect(getCategoryOptions(tree,'en').map(o=>o.label)).toEqual(['- Household','- Kitchen','  Drinks']);
  expect(hasInvalidCategoryHierarchy(tree)).toBe(false);
 });
 it('accepts the backend flat wire shape with null and bounded Parent snapshots without rewriting legacy IDs',()=>{
  const raw=JSON.parse(JSON.stringify(categoryWireFixture));
  const before=JSON.stringify(raw);
  const read=readCategories(raw,categoryHomeId);
  expect(read.map(c=>[c.ID,c.ParentID])).toEqual(raw.map((c:Category)=>[c.ID,c.ParentID]));
  expect(read.find(c=>c.ID===categoryIds.drinks)?.Parent?.ID).toBe(categoryIds.kitchen);
  expect(read.find(c=>c.ID===categoryIds.soda)?.Parent?.Parent).toBeUndefined();
  expect(read.find(c=>c.ID===categoryIds.orphan)?.Parent).toBeUndefined();
  expect(getCategoryOrder(read,'en').map(c=>c.category.ID)).toHaveLength(raw.length);
  expect(()=>JSON.stringify(read)).not.toThrow();expect(JSON.stringify(raw)).toBe(before);
 });
 it('orders a deep legacy chain without recursive stack overflow',()=>{
  const deep=Array.from({length:12000},(_,i)=>({ID:String(i),Name:`Category ${i}`,ParentID:i?String(i-1):null}));
  const ordered=getCategoryOrder(deep,'en');
  expect(ordered).toHaveLength(deep.length);expect(ordered.at(-1)?.category.ID).toBe('11999');
 });
 it('sorts root parents using the selected language',()=>{
  const roots=[{ID:'incir',Name:'İncir'},{ID:'ispanak',Name:'Ispanak'}];
  expect(categoryParents(roots,'tr').map(c=>c.ID)).toEqual(['ispanak','incir']);
 });
});
