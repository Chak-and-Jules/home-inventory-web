export type Language = {
  id: string;
  name: string;
  created_at?: string;
  updated_at?: string;
};

export type ProfilePreference = {
  UserID: string;
  language_id: string | null;
  web_theme?: 'Light' | 'Dark' | null;
  mobile_theme?: string | null;
  restock_window?: number | null;
  Language?: Language;
};
