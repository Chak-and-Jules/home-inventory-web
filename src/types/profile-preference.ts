export type Language = {
  ID: string;
  Name: string;
  CreatedAt?: string;
  UpdatedAt?: string;
};

export type ProfilePreference = {
  UserID: string;
  language_id: string | null;
  web_theme?: 'Light' | 'Dark' | null;
  Language?: Language;
};
