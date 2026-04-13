export const LANGS = ["az", "tr", "en", "ru", "es"] as const;
export type Lang = (typeof LANGS)[number];

export const DEFAULT_LANG: Lang = "az";
