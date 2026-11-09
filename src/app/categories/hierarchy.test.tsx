import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import MockAdapter from 'axios-mock-adapter';
import { createInstance } from 'i18next';
import { I18nextProvider } from 'react-i18next';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '@/lib/api';
import type { Category } from '@/types';
import { categoryBackendErrors, categoryWireFixture } from '@/test/categoryFixtures';
import Categories from './page';
import NewCategory from './new/page';
import en from '@/lib/i18n/locales/en/common.json';
import tr from '@/lib/i18n/locales/tr/common.json';

const scope=vi.hoisted(()=>({home:'home',push:vi.fn()}));
vi.mock('@/components/HomeProvider',()=>({useHome:()=>({currentHomeId:scope.home})}));
vi.mock('@/components/AuthProvider',()=>({useAuth:()=>({session:{user:{uid:'category-user'}}})}));
vi.mock('@/lib/firebase',()=>({getFirebaseIdentity:async()=>({uid:'category-user',token:'category-token'})}));
vi.mock('next/navigation',()=>({useRouter:()=>({push:scope.push})}));
vi.mock('react-i18next',async()=>await vi.importActual('react-i18next'));
let client: QueryClient;let mock: MockAdapter;let data:Category[];let firstLoad:[number,unknown]|null;
const original=():Category[]=>[{ID:'k',Name:'Kitchen',HomeID:'home',ParentID:null},{ID:'d',Name:'Drinks',HomeID:'home',ParentID:'k'},{ID:'h',Name:'Household',HomeID:'home',ParentID:null}];
async function mount(page:React.ReactElement,lang='en') {
 const i18n=createInstance();await i18n.init({lng:lang,fallbackLng:'en',resources:{en:{translation:en},tr:{translation:tr}},interpolation:{escapeValue:false}});
 return render(page,{wrapper:({children})=><QueryClientProvider client={client}><I18nextProvider i18n={i18n}>{children}</I18nextProvider></QueryClientProvider>});
}
beforeEach(()=>{
 scope.home='home';scope.push.mockReset();data=original();firstLoad=null;
 client=new QueryClient({defaultOptions:{queries:{retry:false,gcTime:0},mutations:{retry:false,gcTime:0}}});
 mock=new MockAdapter(api);
 mock.onGet('/categories').reply(config=>{
  expect(config.headers?.['X-Home-Id']).toBeTruthy();expect(config.headers?.Authorization).toBe('Bearer category-token');
  if(firstLoad){const response=firstLoad;firstLoad=null;return response;}
  // The backend embeds one immediate snapshot, whose own Parent is null.
  return [200,config.headers?.['X-Home-Id']==='home'?data.map(c=>{
   const parent=data.find(p=>p.ID===c.ParentID);return { ...c, Parent: parent ? { ...parent, Parent: null } : null };
  }):[{ID:'other-root',Name:'Other root',HomeID:'other',ParentID:null,Parent:null}]];
 });
 mock.onPost('/categories').reply(config=>{const body=JSON.parse(config.data);data.push({ID:'saved',HomeID:'home',Name:body.name,ParentID:body.parent_id});return [201,data.at(-1)];});
 mock.onPut(/\/categories\//).reply(config=>{const id=config.url!.split('/').at(-1)!;const body=JSON.parse(config.data);data=data.map(c=>c.ID===id?{...c,Name:body.name,ParentID:body.parent_id}:c);return [200,{message:'saved'}];});
});
afterEach(()=>{cleanup();client.clear();mock.restore();});

describe.each(['en','tr'] as const)('category forms in %s',language=>{
 const copy=language==='tr'?tr:en;
 const errors=categoryBackendErrors[language];
 it('offers only root parents and saves a child with an explicit home',async()=>{
  const user=userEvent.setup();await mount(<NewCategory/>,language);
  const parent=await screen.findByLabelText(copy.categories.parent);
  await waitFor(()=>expect(within(parent).getAllByRole('option')).toHaveLength(3));
  expect(within(parent).queryByRole('option',{name:'Drinks'})).not.toBeInTheDocument();
  expect(within(parent).getAllByRole('option').map(o=>o.textContent)).toEqual([copy.categories.none,'- Household','- Kitchen']);
  await user.type(screen.getByLabelText(copy.categories.name),'Soda');await user.selectOptions(parent,'k');
  await user.click(screen.getByRole('button',{name:copy.categories.create}));
  await waitFor(()=>expect(scope.push).toHaveBeenCalledWith('/categories'));
  expect(JSON.parse(mock.history.post[0].data)).toEqual({name:'Soda',parent_id:'k'});expect(mock.history.post[0].headers?.['X-Home-Id']).toBe('home');
 });
 it('keeps a root with children at the top level while allowing an inline rename',async()=>{
  const user=userEvent.setup();await mount(<Categories/>,language);
  await user.click(await screen.findByRole('button',{name:`${copy.categories.edit} Kitchen`}));
  const parent=screen.getByLabelText(copy.categories.parent);expect(parent).toBeDisabled();
  expect(parent).toHaveAccessibleDescription(copy.categories.hierarchy.hasChildren);
  await user.clear(screen.getByRole('textbox',{name:copy.categories.tableName}));await user.type(screen.getByRole('textbox',{name:copy.categories.tableName}),'Renamed Kitchen');
  await user.click(screen.getByRole('button',{name:copy.categories.save}));
  await screen.findByRole('button',{name:`${copy.categories.edit} Renamed Kitchen`});
  expect(JSON.parse(mock.history.put[0].data)).toEqual({name:'Renamed Kitchen',parent_id:null});
  expect(data.find(c=>c.ID==='d')?.ParentID).toBe('k');expect(scope.push).not.toHaveBeenCalled();
 });
 it('allows leaf moves between roots and explicit promotion to root',async()=>{
  const user=userEvent.setup();await mount(<Categories/>,language);
  for(const parentId of ['h','']){
   await user.click(await screen.findByRole('button',{name:`${copy.categories.edit} Drinks`}));
   await user.selectOptions(screen.getByLabelText(copy.categories.parent),parentId);
   await user.click(screen.getByRole('button',{name:copy.categories.save}));
   await screen.findByRole('button',{name:`${copy.categories.edit} Drinks`});
  }
  expect(mock.history.put.map(r=>JSON.parse(r.data).parent_id)).toEqual(['h',null]);
  expect(data.map(c=>c.ID)).toEqual(['k','d','h']);
 });
 it('includes the current parent when renaming a child with PUT replacement semantics',async()=>{
  const user=userEvent.setup();await mount(<Categories/>,language);
  await user.click(await screen.findByRole('button',{name:`${copy.categories.edit} Drinks`}));
  await user.clear(screen.getByRole('textbox',{name:copy.categories.tableName}));
  await user.type(screen.getByRole('textbox',{name:copy.categories.tableName}),'Beverages');
  await user.click(screen.getByRole('button',{name:copy.categories.save}));
  await screen.findByRole('button',{name:`${copy.categories.edit} Beverages`});
  expect(JSON.parse(mock.history.put[0].data)).toEqual({name:'Beverages',parent_id:'k'});
  expect(data.find(c=>c.ID==='d')?.ParentID).toBe('k');
 });
 it('retains entered values after server rejection, refreshes stale parent choices, and saves only after correction',async()=>{
  const user=userEvent.setup();let calls=0;
  mock.onPost('/categories').reply(config=>{
   if(++calls===1){data=data.map(c=>c.ID==='h'?{...c,ParentID:'k'}:c);return [400,errors.invalidParent];}
   return [201,{ID:'saved',Name:JSON.parse(config.data).name}];
  });
  await mount(<NewCategory/>,language);await waitFor(()=>expect(screen.getByRole('button',{name:copy.categories.create})).toBeDisabled());
  await screen.findByRole('option',{name:'- Household'});
  await user.type(screen.getByLabelText(copy.categories.name),'Keep this name');await user.selectOptions(screen.getByLabelText(copy.categories.parent),'h');
  await user.click(screen.getByRole('button',{name:copy.categories.create}));
  expect(await screen.findByText(errors.invalidParent.error)).toBeInTheDocument();
  await waitFor(()=>expect(screen.getByLabelText(copy.categories.parent)).toHaveAttribute('aria-invalid','true'));
  expect(screen.getByLabelText(copy.categories.name)).toHaveValue('Keep this name');expect(screen.getByLabelText(copy.categories.parent)).toHaveValue('h');
  expect(screen.getByRole('button',{name:copy.categories.create})).toBeDisabled();expect(scope.push).not.toHaveBeenCalled();
  await user.selectOptions(screen.getByLabelText(copy.categories.parent),'k');
  await user.click(screen.getByRole('button',{name:copy.categories.create}));
  await waitFor(()=>expect(scope.push).toHaveBeenCalledOnce());expect(mock.history.post).toHaveLength(2);
 });
 it('retains the inline editor and sibling-name conflict message after a rejected update',async()=>{
  const user=userEvent.setup();let calls=0;
  mock.onPut(/\/categories\//).reply(config=>{
   if(++calls===1)return [409,errors.nameConflict];
   const body=JSON.parse(config.data);data=data.map(c=>c.ID==='d'?{...c,Name:body.name,ParentID:body.parent_id}:c);
   return [200,{message:'saved'}];
  });
  await mount(<Categories/>,language);await user.click(await screen.findByRole('button',{name:`${copy.categories.edit} Drinks`}));
  await user.clear(screen.getByRole('textbox',{name:copy.categories.tableName}));await user.type(screen.getByRole('textbox',{name:copy.categories.tableName}),'Existing name');
  await user.click(screen.getByRole('button',{name:copy.categories.save}));
  expect(await screen.findByRole('alert')).toHaveTextContent(errors.nameConflict.error);
  expect(screen.getByRole('textbox',{name:copy.categories.tableName})).toHaveValue('Existing name');expect(screen.getByLabelText(copy.categories.parent)).toHaveValue('k');
  expect(mock.history.put).toHaveLength(1);expect(scope.push).not.toHaveBeenCalled();
  await user.clear(screen.getByRole('textbox',{name:copy.categories.tableName}));
  await user.type(screen.getByRole('textbox',{name:copy.categories.tableName}),'Unique name');
  await user.click(screen.getByRole('button',{name:copy.categories.save}));
  await screen.findByRole('button',{name:`${copy.categories.edit} Unique name`});expect(mock.history.put).toHaveLength(2);
 });
 it('preserves an inline branch edit rejected after a concurrent child creation, then permits a root rename',async()=>{
  const user=userEvent.setup();let calls=0;
  mock.onPut(/\/categories\//).reply(config=>{
   if(++calls===1){data.push({ID:'new-child',Name:'New child',ParentID:'h'});return [400,errors.hasChildren];}
   const body=JSON.parse(config.data);data=data.map(c=>c.ID==='h'?{...c,Name:body.name,ParentID:body.parent_id}:c);
   return [200,{message:'saved'}];
  });
  await mount(<Categories/>,language);await user.click(await screen.findByRole('button',{name:`${copy.categories.edit} Household`}));
  await user.clear(screen.getByRole('textbox',{name:copy.categories.tableName}));await user.type(screen.getByRole('textbox',{name:copy.categories.tableName}),'Household renamed');
  await user.selectOptions(screen.getByLabelText(copy.categories.parent),'k');await user.click(screen.getByRole('button',{name:copy.categories.save}));
  expect(await screen.findByText(errors.hasChildren.error)).toBeInTheDocument();
  await waitFor(()=>expect(screen.getByLabelText(copy.categories.parent)).toHaveAttribute('aria-invalid','true'));
  expect(screen.getByRole('textbox',{name:copy.categories.tableName})).toHaveValue('Household renamed');expect(screen.getByLabelText(copy.categories.parent)).toHaveValue('k');
  expect(screen.getByRole('button',{name:copy.categories.save})).toBeDisabled();
  await user.selectOptions(screen.getByLabelText(copy.categories.parent),'');await user.click(screen.getByRole('button',{name:copy.categories.save}));
  await screen.findByRole('button',{name:`${copy.categories.edit} Household renamed`});
  expect(JSON.parse(mock.history.put[1].data)).toEqual({name:'Household renamed',parent_id:null});expect(data.find(c=>c.ID==='new-child')?.ParentID).toBe('h');
 });
 it('keeps new-category input after a parent 404 and permits choosing a surviving root',async()=>{
  const user=userEvent.setup();let calls=0;
  mock.onPost('/categories').reply(()=>{
   if(++calls===1){data=data.filter(c=>c.ID!=='h');return [404,errors.parentNotFound];}
   return [201,{ID:'saved',Name:'Keep this name',ParentID:'k'}];
  });
  await mount(<NewCategory/>,language);await screen.findByRole('option',{name:'- Household'});
  await user.type(screen.getByLabelText(copy.categories.name),'Keep this name');await user.selectOptions(screen.getByLabelText(copy.categories.parent),'h');
  await user.click(screen.getByRole('button',{name:copy.categories.create}));expect(await screen.findByText(errors.parentNotFound.error)).toBeInTheDocument();
  await waitFor(()=>expect(screen.getByLabelText(copy.categories.parent)).toHaveAttribute('aria-invalid','true'));
  expect(screen.getByLabelText(copy.categories.name)).toHaveValue('Keep this name');expect(screen.getByLabelText(copy.categories.parent)).toHaveValue('h');expect(scope.push).not.toHaveBeenCalled();
  await user.selectOptions(screen.getByLabelText(copy.categories.parent),'k');await user.click(screen.getByRole('button',{name:copy.categories.create}));
  await waitFor(()=>expect(scope.push).toHaveBeenCalledOnce());expect(mock.history.post).toHaveLength(2);
 });
 it('keeps an editor visible after a category 404 and supports canceling the obsolete edit',async()=>{
  const user=userEvent.setup();mock.onPut(/\/categories\//).reply(()=>{data=data.filter(c=>c.ID!=='d');return [404,errors.categoryNotFound];});
  await mount(<Categories/>,language);await user.click(await screen.findByRole('button',{name:`${copy.categories.edit} Drinks`}));
  await user.type(screen.getByRole('textbox',{name:copy.categories.tableName}),' renamed');await user.click(screen.getByRole('button',{name:copy.categories.save}));
  expect(await screen.findByText(errors.categoryNotFound.error)).toBeInTheDocument();
  await waitFor(()=>expect(screen.getByRole('button',{name:copy.categories.save})).toBeDisabled());
  expect(screen.getByRole('textbox',{name:copy.categories.tableName})).toHaveValue('Drinks renamed');
  expect(scope.push).not.toHaveBeenCalled();
  await user.click(screen.getByRole('button',{name:copy.categories.cancel}));
  await screen.findByRole('button',{name:`${copy.categories.edit} Kitchen`});expect(mock.history.put).toHaveLength(1);
  expect(screen.queryByRole('textbox',{name:copy.categories.tableName})).not.toBeInTheDocument();
  expect(screen.queryByRole('button',{name:`${copy.categories.edit} Drinks`})).not.toBeInTheDocument();
 });
 it('lists deeper, orphaned and cyclic legacy categories once without changing them',async()=>{
  data.push({ID:'s',Name:'Soda',ParentID:'d'},{ID:'o',Name:'Orphan',ParentID:'missing'},
   {ID:'a',Name:'Cycle A',ParentID:'b'},{ID:'b',Name:'Cycle B',ParentID:'a'});
  const before=JSON.stringify(data);await mount(<Categories/>,language);
  expect(await screen.findByText(copy.categories.hierarchy.malformed)).toBeInTheDocument();
  for(const category of data)expect(screen.getAllByRole('button',{name:`${copy.categories.edit} ${category.Name}`})).toHaveLength(1);
  fireEvent.click(screen.getByRole('columnheader',{name:copy.categories.tableName}));
  expect(screen.getAllByRole('button',{name:new RegExp(`^${copy.categories.edit} `)})).toHaveLength(data.length);
  expect(JSON.stringify(data)).toBe(before);expect(mock.history.put).toHaveLength(0);
 });
});

it('renders the published bounded legacy GET fixture with every original category visible',async()=>{
 firstLoad=[200,categoryWireFixture];scope.home=categoryWireFixture[0].HomeID!;
 await mount(<Categories/>);
 expect(await screen.findByText(en.categories.hierarchy.malformed)).toBeInTheDocument();
 for(const category of categoryWireFixture)expect(screen.getAllByRole('button',{name:`${en.categories.edit} ${category.Name}`})).toHaveLength(1);
 expect(mock.history.put).toHaveLength(0);expect(mock.history.post).toHaveLength(0);
});

it('checks the latest cached parent data at submission, even before the UI observes it',async()=>{
 const user=userEvent.setup();const view=await mount(<NewCategory/>);await screen.findByRole('option',{name:'- Household'});
 await user.type(screen.getByLabelText(en.categories.name),'Soda');await user.selectOptions(screen.getByLabelText(en.categories.parent),'h');
 data=data.map(c=>c.ID==='h'?{...c,ParentID:'k'}:c);
 await act(async()=>{client.setQueryData(['categories','home'],data);fireEvent.submit(view.container.querySelector('form')!);});
 await waitFor(()=>expect(screen.getByLabelText(en.categories.parent)).toHaveAttribute('aria-invalid','true'));
 expect(mock.history.post).toHaveLength(0);expect(scope.push).not.toHaveBeenCalled();
});

it.each(['',null,{},[{ID:'bad'}]])('offers retry instead of treating an invalid response as an empty home: %j',async value=>{
 firstLoad=[200,value];
 const user=userEvent.setup();await mount(<Categories/>);
 expect(await screen.findByRole('alert')).toHaveTextContent(en.categories.hierarchy.loadFailed);
 expect(screen.queryByText(en.categories.noCategories)).not.toBeInTheDocument();
 await user.click(screen.getByRole('button',{name:en.categories.hierarchy.retry}));
 expect(await screen.findByRole('button',{name:`${en.categories.edit} Kitchen`})).toBeInTheDocument();
});

it('retains the new-category name through a failed load and retry',async()=>{
 firstLoad=[500,{error:'unavailable'}];
 const user=userEvent.setup();await mount(<NewCategory/>);await screen.findByRole('alert');
 await user.type(screen.getByLabelText(en.categories.name),'Keep my input');
 expect(screen.getByRole('button',{name:en.categories.create})).toBeDisabled();
 await user.click(screen.getByRole('button',{name:en.categories.hierarchy.retry}));
 await screen.findByRole('option',{name:'- Household'});
 expect(screen.getByLabelText(en.categories.name)).toHaveValue('Keep my input');
 expect(screen.getByRole('button',{name:en.categories.create})).toBeEnabled();
});

it('resets parent choices on home change and ignores navigation from an earlier pending save',async()=>{
 let finish!:(value:[number,unknown])=>void;
 mock.onPost('/categories').reply(()=>new Promise(resolve=>{finish=resolve;}));
 const user=userEvent.setup();const view=await mount(<NewCategory/>);await screen.findByRole('option',{name:'- Kitchen'});
 await user.type(screen.getByLabelText(en.categories.name),'Old home item');await user.selectOptions(screen.getByLabelText(en.categories.parent),'k');
 await user.click(screen.getByRole('button',{name:en.categories.create}));await waitFor(()=>expect(finish).toBeDefined());
 scope.home='other';view.rerender(<NewCategory/>);await screen.findByRole('option',{name:'- Other root'});
 expect(screen.getByLabelText(en.categories.name)).toHaveValue('');expect(screen.getByLabelText(en.categories.parent)).toHaveValue('');
 await user.type(screen.getByLabelText(en.categories.name),'New home input');
 await act(async()=>{finish([201,{ID:'old-save',Name:'Old home item'}]);});
 await waitFor(()=>expect(client.isMutating()).toBe(0));
 expect(scope.push).not.toHaveBeenCalled();expect(screen.getByLabelText(en.categories.name)).toHaveValue('New home input');
 expect(mock.history.post[0].headers?.['X-Home-Id']).toBe('home');
});

it('creates a root with null parent rather than an empty UUID',async()=>{
 const user=userEvent.setup();await mount(<NewCategory/>);await screen.findByRole('option',{name:'- Kitchen'});
 await user.type(screen.getByLabelText(en.categories.name),'New root');
 await user.click(screen.getByRole('button',{name:en.categories.create}));
 await waitFor(()=>expect(scope.push).toHaveBeenCalledWith('/categories'));
 expect(JSON.parse(mock.history.post[0].data)).toEqual({name:'New root',parent_id:null});
});

it('keeps the full home parent set during search and resets an inline editor on home change',async()=>{
 const user=userEvent.setup();const view=await mount(<Categories/>);
 await screen.findByRole('button',{name:`${en.categories.edit} Household`});
 await user.type(screen.getByPlaceholderText(en.categories.searchPlaceholder),'Household');
 await waitFor(()=>expect(screen.queryByRole('button',{name:`${en.categories.edit} Kitchen`})).not.toBeInTheDocument());
 await user.click(screen.getByRole('button',{name:`${en.categories.edit} Household`}));
 expect(within(screen.getByLabelText(en.categories.parent)).getByRole('option',{name:'- Kitchen'})).toBeInTheDocument();
 await user.type(screen.getByRole('textbox',{name:en.categories.tableName}),' draft');
 scope.home='other';view.rerender(<Categories/>);
 await screen.findByRole('button',{name:`${en.categories.edit} Other root`});
 expect(screen.queryByRole('textbox',{name:en.categories.tableName})).not.toBeInTheDocument();
 expect(mock.history.put).toHaveLength(0);
});

it('rejects an inline branch move when a child was added to the latest cache',async()=>{
 const user=userEvent.setup();await mount(<Categories/>);
 await user.click(await screen.findByRole('button',{name:`${en.categories.edit} Household`}));
 await user.selectOptions(screen.getByLabelText(en.categories.parent),'k');
 data.push({ID:'new-child',Name:'New child',ParentID:'h'});
 await act(async()=>{
  client.setQueryData(['categories','home'],data);
  fireEvent.click(screen.getByRole('button',{name:en.categories.save}));
 });
 await waitFor(()=>expect(screen.getByLabelText(en.categories.parent)).toHaveAttribute('aria-invalid','true'));
 expect(mock.history.put).toHaveLength(0);
 expect(screen.getByRole('textbox',{name:en.categories.tableName})).toHaveValue('Household');
});
