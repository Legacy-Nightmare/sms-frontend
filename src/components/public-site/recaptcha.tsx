import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";

declare global {
  interface Window {
    grecaptcha?: {
      render: (
        container: HTMLElement,
        params: {
          sitekey: string;
          callback: (token: string) => void;
          "expired-callback"?: () => void;
        },
      ) => number;
      reset: (widgetId?: number) => void;
    };
    __onRecaptchaApiLoad?: () => void;
  }
}

const SITE_KEY = import.meta.env["VITE_RECAPTCHA_SITE_KEY"] ?? "";

let scriptLoadPromise: Promise<void> | null = null;

// script.onload only means the *file* downloaded — reCAPTCHA's internal
// client finishes initializing asynchronously after that, so calling
// grecaptcha.render() right on script.onload is a race that fails silently.
// Google's own documented fix: load with render=explicit&onload=<callback>
// and only call render() once that global callback actually fires.
function loadRecaptchaScript(): Promise<void> {
  if (window.grecaptcha?.render) return Promise.resolve();
  if (scriptLoadPromise) return scriptLoadPromise;
  scriptLoadPromise = new Promise((resolve, reject) => {
    window.__onRecaptchaApiLoad = () => resolve();
    const script = document.createElement("script");
    script.src = "https://www.google.com/recaptcha/api.js?onload=__onRecaptchaApiLoad&render=explicit";
    script.async = true;
    script.defer = true;
    script.onerror = () => reject(new Error("Failed to load reCAPTCHA"));
    document.head.appendChild(script);
  });
  return scriptLoadPromise;
}

export interface RecaptchaHandle {
  reset: () => void;
}

// Google reCAPTCHA v2 "I'm not a robot" checkbox — a plain uncontrolled
// widget (grecaptcha.render), not a React-driven one, since the library
// manages its own iframe. onChange fires the token (or null once it
// expires); the parent form sends that token with its submit request.
export const Recaptcha = forwardRef<RecaptchaHandle, { onChange: (token: string | null) => void }>(
  function Recaptcha({ onChange }, ref) {
    const containerRef = useRef<HTMLDivElement>(null);
    const widgetId = useRef<number | null>(null);

    useImperativeHandle(ref, () => ({
      reset: () => {
        if (widgetId.current !== null) window.grecaptcha?.reset(widgetId.current);
        onChange(null);
      },
    }));

    useEffect(() => {
      let cancelled = false;
      loadRecaptchaScript()
        .then(() => {
          if (cancelled || !containerRef.current || widgetId.current !== null) return;
          widgetId.current = window.grecaptcha!.render(containerRef.current, {
            sitekey: SITE_KEY,
            callback: (token) => onChange(token),
            "expired-callback": () => onChange(null),
          });
        })
        .catch((err) => {
          // Script blocked (ad blocker, offline) — the submit button stays
          // disabled since no token ever arrives, which is the safe failure.
          console.warn("reCAPTCHA failed to load:", err);
        });
      return () => {
        cancelled = true;
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    if (!SITE_KEY) {
      return <p className="muted-cell" style={{ fontSize: 12 }}>reCAPTCHA is not configured for this site.</p>;
    }

    return <div ref={containerRef} />;
  },
);
