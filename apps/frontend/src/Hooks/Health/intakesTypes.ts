export type IntakeKind = 'CAFFEINE' | 'ALCOHOL';

export interface IntakeValues {
  volumeMl: number | null;
  caffeineMg: number | null;
  alcoholG: number | null;
}

export interface IntakeEntry extends IntakeValues {
  id: string;
  at: string;
  day: string;
  timeZone: string | null;
  kind: IntakeKind;
  name: string;
  presetId: string | null;
  itemId: string | null;
  quantity: number;
  drinks: number | null;
  notes: string | null;
}

export interface IntakeDay {
  day: string;
  caffeineMg: number;
  coffees: number;
  alcoholG: number;
  drinks: number;
}

export interface IntakePreset extends IntakeValues {
  id: string;
  kind: IntakeKind;
  name: string;
  abv: number | null;
}

export interface IntakeItem extends IntakeValues {
  id: string;
  kind: IntakeKind;
  name: string;
}

export interface IntakeSettings {
  caffeineLimitMg: number;
  alcoholLimitWeek: number;
  hiddenPresets: string[];
}

export interface IntakesData {
  entries: IntakeEntry[];
  days: IntakeDay[];
  averages: {
    caffeineMg: number | null;
    coffees: number | null;
    drinksPerWeek: number | null;
    caffeineDays: number | null;
    alcoholFreeDays: number | null;
  };
  presets: IntakePreset[];
  items: IntakeItem[];
  settings: IntakeSettings;
}

export interface IntakePayload extends Partial<IntakeValues> {
  at: string;
  timeZone: string;
  presetId?: string;
  itemId?: string;
  kind?: IntakeKind;
  name?: string;
  quantity?: number;
  notes?: string | null;
}

export interface IntakeItemPayload extends IntakeValues {
  kind: IntakeKind;
  name: string;
}

export type IntakeSettingsPayload = Partial<IntakeSettings>;
