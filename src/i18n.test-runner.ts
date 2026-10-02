import { isLanguagePreference, locales, resolveLocale, translate, translateMessage, translations } from "./i18n";
import { motionModelOptions, modelBindings } from "./motion-system";
import { families } from "./catalog";
import { animationOptions } from "./animation-recipes";
import { activeReferencePresets } from "./reference-catalog";
function assert(value: unknown, message: string): asserts value { if (!value) throw new Error(message); }
for (const [languages, expected] of [
  [["fr-CA", "en"], "fr"], [["de-DE"], "de"], [["ja-JP"], "ja"], [["ko-KR"], "ko"],
  [["es-ES"], "es-ES"], [["es-Latn-ES"], "es-ES"], [["es-MX"], "es-419"], [["es-AR"], "es-419"], [["es-419"], "es-419"],
  [["es"], "es-ES"], [["pt-PT"], "pt-BR"], [["pt_BR"], "pt-BR"], [["EN-gb"], "en"],
  [["ru-RU", "ja-JP", "en-US"], "ja"], [["zh-CN", "ru-RU"], "en"], [[], "en"],
] as const) assert(resolveLocale(languages) === expected, `Language detection: ${languages}`);
assert(isLanguagePreference("auto") && locales.every(isLanguagePreference), "All choices must persist");
for (const bad of [null, undefined, "ru", "es", "pt", "garbage", {}, 123]) assert(!isLanguagePreference(bad), "Invalid preference accepted");
for (const [key, entry] of Object.entries(translations)) for (const locale of locales) {
  assert(entry[locale]?.trim(), `Missing ${locale}: ${key}`);
  const placeholders = (value: string) => (value.match(/\{\w+\}/g) ?? []).sort().join();
  assert(placeholders(entry[locale]) === placeholders(entry.en), `Interpolation mismatch ${locale}: ${key}`);
}
const hasTranslation = (label: string) => {
  const base = label.replace(/ \((?:%|°|s)\)| \d{2}$/g, "").toLowerCase();
  return !/[a-z]/i.test(label) || ["cilinder", "anticlockwise"].includes(base) || !!translations[base];
};
for (const model of motionModelOptions) {
  assert(hasTranslation(model.label), `Missing model: ${model.label}`);
  for (const binding of modelBindings(model.value)) {
    assert(hasTranslation(binding.label), `Missing control: ${binding.label}`);
    for (const option of (binding.config as { options?: (string | {label: string})[] })?.options ?? [])
      assert(hasTranslation(typeof option === "string" ? option : option.label), `Missing option: ${JSON.stringify(option)}`);
  }
}
for (const family of families) assert(hasTranslation(family.name) && hasTranslation(family.description), `Missing gallery: ${family.name}`);
for (const preset of activeReferencePresets) assert(hasTranslation(preset.label), `Missing reference recipe: ${preset.label}`);
for (const animation of animationOptions) assert(hasTranslation(animation.label), `Missing animation: ${animation.label}`);
assert(translate("Orbit 01", "ja") === "軌道 01", "Orbit recipe names should localize");
assert(translate("Orbit 04", "fr") === "Orbite 04", "French Orbit names should localize");
assert(translate("Row 01", "ja") === "列 01", "Recipe numbers should survive");
assert(translate("Card size (%)", "fr") === "Taille des cartes (%)", "Units should survive");
assert(translate("Delete {name}", "de", {name: "$& {foo}"}) === "$& {foo} löschen", "User names should remain literal");
assert(translate("Motion Loops", "ko") === "Motion Loops", "Brand should survive");
assert(translateMessage("settings.reference.visible must be at least 1.", "de") === "settings.reference.visible muss mindestens 1 sein.", "Validation path should survive");
assert(translateMessage("Row 01 needs 2–20 selected cards.", "ja") === "列 01には2～20枚の選択カードが必要です。", "Dynamic errors must localize");
assert(translateMessage("Unexpected host error", "ja") === "Unexpected host error", "Unknown technical host details must survive");
console.log(`i18n: detection, catalog coverage (${Object.keys(translations).length} messages × ${locales.length} locales), units and validation passed`);
