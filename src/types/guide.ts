export type GuideStatus = 'available' | 'in_progress' | 'completed' | 'skipped';
export type Guide = {
  id: string; revision: number; platform: 'web' | 'mobile'; platform_revision: number; steps: string[];
  available: boolean; unavailable_reason: string; can_write: boolean; status: GuideStatus; version: number;
  checkpoint: { revision: number; status: string; step: string; restored: boolean; deferred_until: string | null;
    home_id: string | null; definition_id: string | null; inventory_id: string | null };
};
export type GuideCatalog = { guides: Guide[]; invitation_id: string | null };
export type GuideInput = {
  action: 'start' | 'checkpoint' | 'defer' | 'skip' | 'restore' | 'complete' | 'choose_definition' | 'create_definition' | 'choose_inventory' | 'create_inventory';
  step?: string; definition_id?: string; inventory_id?: string;
  definition?: { name: string; size_unit_id: string; category_id?: string; is_expirable: boolean };
  inventory?: { item_definition_id: string; quantity: number; quantity_unit_id?: string; expiry_date?: string };
};

// Wire contract from backend PR #146, with PR #147's additive setup references.
export type ApiGuide = {
 id: string; revision: number; platform: 'web' | 'mobile'; version: number;
 variant: { content_version: number; min_client_version: number; entry_point: string; steps: string[] };
 state: { status: 'not_started' | 'in_progress' | 'completed' | 'skipped'; step_id: string;
  home_id: string | null; deferred_until: string | null; definition_id?: string | null; inventory_id?: string | null };
 available: boolean; unavailable_reasons: string[]; should_offer: boolean; can_write: boolean;
};
