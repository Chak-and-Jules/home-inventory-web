export type Home = {
  ID: string
  Name: string
}

export type Profile = {
  ID: string
  Email: string
  FirstName: string
  LastName: string
}

export type UserHome = {
  UserID: string
  HomeID: string
  Role: string
  IsDefault: boolean
  Home: Home
  User?: Profile
}
