declare global {
  interface Window {
    grecaptcha?: {
      ready: (cb: () => void) => void;
      execute: (siteKey: string, opts: { action: string }) => Promise<string>;
    };
  }
}

const SITE_KEY = import.meta.env["VITE_RECAPTCHA_SITE_KEY"] ?? "";

let scriptLoadPromise: Promise<void> | null = null;

function loadRecaptchaScript(): Promise<void> {
  if (window.grecaptcha?.execute) return Promise.resolve();
  if (scriptLoadPromise) return scriptLoadPromise;
  scriptLoadPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = `https://www.google.com/recaptcha/api.js?render=${SITE_KEY}`;
    script.async = true;
    script.defer = true;
    script.onload = () => window.grecaptcha!.ready(() => resolve());
    script.onerror = () => reject(new Error("Failed to load reCAPTCHA"));
    document.head.appendChild(script);
  });
  return scriptLoadPromise;
}

// reCAPTCHA v3 — no checkbox, no UI at all: it runs invisibly and scores
// the request. Fetch a fresh token right before the actual submit (tokens
// are short-lived and meant to be single-use per action), not ahead of
// time into state.
export async function getRecaptchaToken(action: string): Promise<string | null> {
  if (!SITE_KEY) return null;
  try {
    await loadRecaptchaScript();
    return await window.grecaptcha!.execute(SITE_KEY, { action });
  } catch (err) {
    console.warn("reCAPTCHA failed to load:", err);
    return null;
  }
}
