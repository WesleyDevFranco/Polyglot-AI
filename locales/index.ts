import en from "./en";
import pt from "./pt";
import es from "./es";
import fr from "./fr";
import de from "./de";
import it from "./it";

export const translations = {
  en,
  pt,
  es,
  fr,
  de,
  it
} as const;

export type LocaleKey = keyof typeof translations;
export type AppTranslations = Record<string, string>;
export default translations;
