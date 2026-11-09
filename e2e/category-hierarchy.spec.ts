import { test, expect, type Page } from '@playwright/test';
import en from '../src/lib/i18n/locales/en/common.json';
import tr from '../src/lib/i18n/locales/tr/common.json';
import { mockApi } from './mock-api';
import { categoryBackendErrors, categoryHomeId as home, categoryIds, categoryWireFixture } from '../src/test/categoryFixtures';
import type { CategoryRequest } from '../src/types';
async function login(page:Page,copy:typeof en){
 await page.goto('/login');await page.getByLabel(copy.auth.emailAddress).fill('ui-test@example.test');
 await page.getByLabel(copy.auth.password,{exact:true}).fill('fixture-password');
 await page.getByRole('button',{name:copy.auth.signIn,exact:true}).click();
 await expect(page.getByRole('heading',{name:'UI Test Home'})).toBeVisible();
}
async function fixture(page:Page,language:string){
 const state=await mockApi(page,language);
 state.categories=structuredClone(categoryWireFixture.slice(0,3));
 await page.route('**/api/v1/categories',route=>{
  if(route.request().method()!=='GET')return route.fallback();
  expect(route.request().headers()['x-home-id']).toBe(home);
  return route.fulfill({json:state.categories.map(category=>{
   const parent=state.categories.find(c=>c.ID===category.ParentID);
   return {...category,HomeID:home,Parent:parent?{...parent,Parent:null}:null};
  })});
 });
 await page.route('**/api/v1/categories/*',route=>{
  if(route.request().method()!=='PUT')return route.fallback();
  expect(route.request().headers()['x-home-id']).toBe(home);
  const id=route.request().url().split('/').at(-1),body=route.request().postDataJSON() as CategoryRequest;
  const category=state.categories.find(c=>c.ID===id)!;
  Object.assign(category,{Name:body.name,ParentID:body.parent_id??null});
  return route.fulfill({json:{message:language==='tr'?'Kategori başarıyla güncellendi':'Category updated successfully'}});
 });
 return state;
}

test('root-only parent controls preserve inline renaming, leaf moves and promotion',async({page},info)=>{
 const language=info.project.name.split('-')[0],copy=language==='tr'?tr:en;
 const state=await fixture(page,language);await login(page,copy);
 await page.goto('/categories/new');
 const parent=page.getByLabel(copy.categories.parent,{exact:true});
 await expect(parent.locator('option')).toHaveText([copy.categories.none,'- Household','- Kitchen']);
 await expect(parent).toHaveAccessibleDescription(copy.categories.hierarchy.parentHelp);
 await page.getByLabel(copy.categories.name,{exact:true}).fill('Soda');
 await parent.focus();await page.keyboard.press('End');await page.keyboard.press('Tab');
 await expect(parent).toHaveValue(categoryIds.kitchen);
 await page.getByRole('button',{name:copy.categories.create,exact:true}).click();
 await expect(page).toHaveURL('/categories');
 await page.getByRole('button',{name:`${copy.categories.edit} Kitchen`,exact:true}).click();
 await expect(page.getByLabel(copy.categories.parent,{exact:true})).toBeDisabled();
 await expect(page.getByText(copy.categories.hierarchy.hasChildren)).toBeVisible();
 await page.getByRole('textbox',{name:copy.categories.tableName,exact:true}).fill('Kitchen renamed');
 await page.getByRole('button',{name:copy.categories.save,exact:true}).click();
 await expect(page.getByRole('button',{name:`${copy.categories.edit} Kitchen renamed`,exact:true})).toBeVisible();
 for(const parentId of [categoryIds.household,'']){
  await page.getByRole('button',{name:`${copy.categories.edit} Drinks`,exact:true}).click();
  await page.getByLabel(copy.categories.parent,{exact:true}).selectOption(parentId);
  await page.getByRole('button',{name:copy.categories.save,exact:true}).click();
  await expect(page.getByRole('button',{name:`${copy.categories.edit} Drinks`,exact:true})).toBeVisible();
 }
 expect(state.categories.find(c=>c.ID===categoryIds.drinks)?.ParentID).toBeNull();
 expect(state.categories.find(c=>c.Name==='Soda')?.ParentID).toBe(categoryIds.kitchen);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test('stale server rejection keeps the chosen parent and input visible until corrected',async({page},info)=>{
 const language=info.project.name.split('-')[0],copy=language==='tr'?tr:en;
 const errors=categoryBackendErrors[language==='tr'?'tr':'en'];
 const state=await fixture(page,language);await login(page,copy);
 let posts=0;
 await page.route('**/api/v1/categories',async route=>{
  if(route.request().method()!=='POST')return route.fallback();
  expect(route.request().headers()['x-home-id']).toBe(home);posts++;
  if(posts===1){state.categories.find(c=>c.ID===categoryIds.household)!.ParentID=categoryIds.kitchen;return route.fulfill({status:400,json:errors.invalidParent});}
  return route.fallback();
 });
 await page.goto('/categories/new');await page.getByLabel(copy.categories.name,{exact:true}).fill('Keep this name');
 await page.getByLabel(copy.categories.parent,{exact:true}).selectOption(categoryIds.household);
 await page.getByRole('button',{name:copy.categories.create,exact:true}).click();
 await expect(page.getByLabel(copy.categories.parent,{exact:true})).toHaveAttribute('aria-invalid','true');
 await expect(page.getByLabel(copy.categories.parent,{exact:true})).toHaveValue(categoryIds.household);
 await expect(page.getByText(errors.invalidParent.error,{exact:true})).toBeVisible();
 await expect(page.getByLabel(copy.categories.name,{exact:true})).toHaveValue('Keep this name');
 await expect(page.getByRole('button',{name:copy.categories.create,exact:true})).toBeDisabled();
 expect(posts).toBe(1);await expect(page).toHaveURL('/categories/new');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
 await page.screenshot({path:info.outputPath('category-stale-parent.png'),fullPage:true});
 await page.getByLabel(copy.categories.parent,{exact:true}).selectOption(categoryIds.kitchen);
 await page.getByRole('button',{name:copy.categories.create,exact:true}).click();
 await expect(page).toHaveURL('/categories');expect(posts).toBe(2);
});

test('malformed legacy relationships remain visible and an invalid GET response offers retry',async({page},info)=>{
 const language=info.project.name.split('-')[0],copy=language==='tr'?tr:en;
 const state=await fixture(page,language);
 state.categories.push(...structuredClone(categoryWireFixture.slice(3)));
 await login(page,copy);let badResponse=true;
 await page.route('**/api/v1/categories',route=>{
  if(route.request().method()==='GET' && badResponse){badResponse=false;return route.fulfill({status:200,contentType:'application/json',body:''});}
  return route.fallback();
 });
 await page.goto('/categories');
 await expect(page.getByRole('alert').filter({hasText:copy.categories.hierarchy.loadFailed})).toBeVisible();
 await expect(page.getByText(copy.categories.noCategories,{exact:true})).toHaveCount(0);
 await page.getByRole('button',{name:copy.categories.hierarchy.retry,exact:true}).click();
 await expect(page.getByText(copy.categories.hierarchy.malformed,{exact:true})).toBeVisible();
 for(const category of state.categories){
  await expect(page.getByRole('button',{name:`${copy.categories.edit} ${category.Name}`,exact:true})).toHaveCount(1);
 }
 await page.getByRole('button',{name:`${copy.categories.edit} Kitchen`,exact:true}).click();
 await expect(page.getByLabel(copy.categories.parent,{exact:true})).toBeDisabled();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
 await page.screenshot({path:info.outputPath('category-legacy-list.png'),fullPage:true});
});

test('a category 404 keeps the inline draft visible until canceled',async({page},info)=>{
 const language=info.project.name.split('-')[0],copy=language==='tr'?tr:en;
 const errors=categoryBackendErrors[language==='tr'?'tr':'en'];
 const state=await fixture(page,language);await login(page,copy);
 await page.route(`**/api/v1/categories/${categoryIds.drinks}`,route=>{
  if(route.request().method()!=='PUT')return route.fallback();
  state.categories=state.categories.filter(c=>c.ID!==categoryIds.drinks);
  return route.fulfill({status:404,json:errors.categoryNotFound});
 });
 await page.goto('/categories');await page.getByRole('button',{name:`${copy.categories.edit} Drinks`,exact:true}).click();
 await page.getByRole('textbox',{name:copy.categories.tableName,exact:true}).fill('My unsaved rename');
 await page.getByRole('button',{name:copy.categories.save,exact:true}).click();
 await expect(page.getByText(errors.categoryNotFound.error,{exact:true})).toBeVisible();
 await expect(page.getByRole('textbox',{name:copy.categories.tableName,exact:true})).toHaveValue('My unsaved rename');
 await expect(page.getByRole('button',{name:copy.categories.save,exact:true})).toBeDisabled();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
 await page.getByRole('button',{name:copy.categories.cancel,exact:true}).click();
 await expect(page.getByRole('textbox',{name:copy.categories.tableName,exact:true})).toHaveCount(0);
 await expect(page.getByRole('button',{name:`${copy.categories.edit} Drinks`,exact:true})).toHaveCount(0);
});
