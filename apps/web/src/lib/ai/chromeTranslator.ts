/**
 * Chrome built-in AI translation (Translator API, Chrome 138+).
 * Runs entirely on-device in the admin's browser — the free/local AI engine;
 * the server-side provider is the fallback for other browsers.
 * https://developer.chrome.com/docs/ai/translator-api
 */

type Availability = "unavailable" | "downloadable" | "downloading" | "available";

interface ChromeTranslator {
	translate(text: string): Promise<string>;
	destroy(): void;
}

interface TranslatorStatic {
	availability(opts: { sourceLanguage: string; targetLanguage: string }): Promise<Availability>;
	create(opts: {
		sourceLanguage: string;
		targetLanguage: string;
		monitor?: (m: EventTarget) => void;
	}): Promise<ChromeTranslator>;
}

interface LanguageDetectorStatic {
	create(): Promise<{
		detect(text: string): Promise<{ detectedLanguage: string; confidence: number }[]>;
		destroy(): void;
	}>;
}

declare global {
	// eslint-disable-next-line no-var
	var Translator: TranslatorStatic | undefined;
	// eslint-disable-next-line no-var
	var LanguageDetector: LanguageDetectorStatic | undefined;
}

export function chromeTranslatorSupported(): boolean {
	return typeof globalThis.Translator !== "undefined";
}

export async function availability(
	sourceLanguage: string,
	targetLanguage: string
): Promise<Availability> {
	if (!chromeTranslatorSupported()) return "unavailable";
	try {
		return await globalThis.Translator!.availability({
			// the Translator API wants base language codes
			sourceLanguage: sourceLanguage.split("-")[0],
			targetLanguage: targetLanguage.split("-")[0]
		} as { sourceLanguage: string; targetLanguage: string });
	} catch {
		return "unavailable";
	}
}

/**
 * Translate a batch on-device. Model download (if needed) reports progress via
 * onProgress (0..1). Must be called from a user gesture when the model still
 * needs downloading.
 */
export async function translateBatch(
	sourceLanguage: string,
	targetLanguage: string,
	items: { key: string; text: string }[],
	onProgress?: (done: number, total: number) => void,
	onDownloadProgress?: (loaded: number) => void
): Promise<{ key: string; text: string }[]> {
	const translator = await globalThis.Translator!.create({
		sourceLanguage: sourceLanguage.split("-")[0]!,
		targetLanguage: targetLanguage.split("-")[0]!,
		monitor(m) {
			m.addEventListener("downloadprogress", (e) => {
				onDownloadProgress?.((e as ProgressEvent).loaded);
			});
		}
	});
	try {
		const out: { key: string; text: string }[] = [];
		for (const [i, item] of items.entries()) {
			out.push({ key: item.key, text: await translator.translate(item.text) });
			onProgress?.(i + 1, items.length);
		}
		return out;
	} finally {
		translator.destroy();
	}
}

/** Detect the dominant language of sample text (import helper). */
export async function detectLanguage(sample: string): Promise<string | null> {
	if (typeof globalThis.LanguageDetector === "undefined") return null;
	try {
		const detector = await globalThis.LanguageDetector.create();
		const results = await detector.detect(sample.slice(0, 2000));
		detector.destroy();
		const best = results[0];
		return best && best.confidence > 0.5 ? best.detectedLanguage : null;
	} catch {
		return null;
	}
}
