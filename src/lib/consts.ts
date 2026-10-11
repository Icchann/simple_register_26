import { name, version } from "package";

export const INFO = {
  id: name,
  version,
  name: {
    ja: "シス研シンプルレジ ver. 2026",
    en: "Sysken Simple Register ver. 2026",
  },
  word: {
  },
  config: {
    localStorageVersion: 1,
  },
  extraPortion: {
    code: 90,
    price: 70,
    name: "増量",
  },
} as const;

export const EXTRA_PORTION_CONFIG = INFO.extraPortion;

export function getLocalStorageKey(key: string, trailingColon = false): string {
  return `${INFO.id}.v${INFO.config.localStorageVersion}.${key}${trailingColon ? ":" : ""}`;
}
