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
};

export type Home = {
  ID: string;
  Name: string;
};

export type Profile = {
  ID: string;
  Email: string;
  FullName: string;
};

export type UserHome = {
  UserID: string;
  HomeID: string;
  Role: string;
  IsDefault: boolean;
  Home: Home;
  User?: Profile;
};

export type InventoryItem = {
  ID: string;
  HomeID: string;
  ItemDefinitionID: string;
  Quantity: number;
  ExpirationDate?: string;
  ItemDefinition: ItemDefinition;
};
