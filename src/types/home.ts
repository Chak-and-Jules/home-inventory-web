export type Home = {
  ID: string
  Name: string
  CreatedAt?: string
  UpdatedAt?: string
}

export type Profile = {
  id: string
  email: string
  IsAdmin?: boolean
  CreatedAt?: string
  UpdatedAt?: string
  FirstName?: string
  LastName?: string
}

export type UserHome = {
  UserID: string
  HomeID: string
  Role: string
  IsDefault: boolean
  Home: Home
  User?: Profile
  CreatedAt?: string
  UpdatedAt?: string
}
