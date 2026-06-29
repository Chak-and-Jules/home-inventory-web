export * from './home';
export * from './profile-preference';

export type Category = {
  ID: string;
  Name: string;
  ParentID?: string;
  Parent?: Category;
};

export type SizeUnit = {
  ID: string;
  Name: string;
};

export type ItemDefinition = {
  ID: string;
  Name: string;
  Description: string;
  CategoryID?: string;
  Category?: Category;
  SizeUnitID?: string;
  SizeUnit?: SizeUnit;
  IsExpirable: boolean;
  ImageURL: string;
  LowStockThreshold?: number;
};

export type InventoryItem = {
  ID: string;
  HomeID: string;
  ItemDefinitionID: string;
  Quantity: number;
  ExpirationDate?: string;
  ItemDefinition: ItemDefinition;
};

export type AlmostFinishedItemResponse = {
  item_definition: ItemDefinition;
  total_quantity: number;
  reason: string;
  estimated_days_left: number;
};

export type ShoppingListItem = {
  ID: string;
  HomeID: string;
  ItemDefinitionID?: string;
  ItemDefinition?: ItemDefinition;
  Name: string;
  Quantity: number;
  IsManual: boolean;
  IsBought: boolean;
  CreatedAt: string;
  UpdatedAt: string;
};

export type ShoppingListItemRequest = {
  item_definition_id?: string;
  name: string;
  quantity: number;
  is_bought?: boolean;
};
