import { setSystemLanguages } from "./i18n";

/** Finish before constructing any window UI. Browser previews keep browser languages. */
export async function initializeSystemLanguage(
  readNativeLanguages: (() => Promise<string[]>) | null,
  timeoutMs = 2000,
): Promise<void> {
  if (!readNativeLanguages) return;
  setSystemLanguages([]);
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const languages = await Promise.race([
      readNativeLanguages(),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error("System language request timed out")), timeoutMs);
      }),
    ]);
    if (Array.isArray(languages) && languages.every(language => typeof language === "string")) {
      setSystemLanguages(languages);
    }
  } catch {
    // A failed native read must not prevent startup or substitute browser/region settings.
  } finally {
    clearTimeout(timer);
  }
}
