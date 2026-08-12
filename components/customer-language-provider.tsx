"use client";

import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  CUSTOMER_LANGUAGE_COOKIE_KEY,
  CUSTOMER_LANGUAGE_STORAGE_KEY,
  LEGACY_CUSTOMER_LANGUAGE_COOKIE_KEY,
  isCustomerLanguage,
  translateCustomerText,
  type CustomerLanguage,
} from "@/lib/customer-i18n";

type LanguageContextValue = {
  language: CustomerLanguage;
  setLanguage: (language: CustomerLanguage) => void;
};

const LanguageContext = createContext<LanguageContextValue>({ language: "vi", setLanguage: () => undefined });
const textStates = new WeakMap<Text, { source: string; translated: string }>();
const attributeStates = new WeakMap<Element, Map<string, { source: string; translated: string }>>();
const TRANSLATABLE_ATTRIBUTES = ["alt", "aria-label", "placeholder", "title"] as const;
const LANGUAGE_COOKIE_SYNC_KEY = "tam-an-language-cookie-synced";

function storedLanguage(fallback: CustomerLanguage): CustomerLanguage {
  try {
    const stored = window.localStorage.getItem(CUSTOMER_LANGUAGE_STORAGE_KEY);
    if (isCustomerLanguage(stored)) return stored;
  } catch {
    // The server-provided cookie value remains the fallback when storage is blocked.
  }
  return fallback;
}

function writeLanguageCookie(language: CustomerLanguage) {
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${CUSTOMER_LANGUAGE_COOKIE_KEY}=${language}; Max-Age=31536000; Path=/; SameSite=Lax${secure}`;
  document.cookie = `${LEGACY_CUSTOMER_LANGUAGE_COOKIE_KEY}=; Max-Age=0; Path=/; SameSite=Lax${secure}`;
}

function shouldSkip(node: Node) {
  const parent = node instanceof Element ? node : node.parentElement;
  return Boolean(parent?.closest("script, style, code, pre, textarea, [contenteditable='true'], [data-no-translate]"));
}

function shouldSkipAttribute(element: Element) {
  // Form values must never be translated, but their instructional placeholder,
  // title and accessible label still need to follow the selected language.
  return Boolean(element.closest("script, style, code, pre, [contenteditable='true'], [data-no-translate]"));
}

function translateTextNode(node: Text, language: CustomerLanguage) {
  if (shouldSkip(node)) return;
  const current = node.nodeValue ?? "";
  const previous = textStates.get(node);
  if (language === "vi") {
    if (previous && current === previous.translated) node.nodeValue = previous.source;
    textStates.delete(node);
    return;
  }
  const source = previous && current === previous.translated ? previous.source : current;
  const translated = translateCustomerText(source, language);
  textStates.set(node, { source, translated });
  if (current !== translated) node.nodeValue = translated;
}

function translateAttributes(element: Element, language: CustomerLanguage) {
  if (shouldSkipAttribute(element)) return;
  const states = attributeStates.get(element) ?? new Map<string, { source: string; translated: string }>();
  for (const attribute of TRANSLATABLE_ATTRIBUTES) {
    const current = element.getAttribute(attribute);
    if (current === null) continue;
    const previous = states.get(attribute);
    if (language === "vi") {
      if (previous && current === previous.translated) element.setAttribute(attribute, previous.source);
      states.delete(attribute);
      continue;
    }
    const source = previous && current === previous.translated ? previous.source : current;
    const translated = translateCustomerText(source, language);
    states.set(attribute, { source, translated });
    if (current !== translated) element.setAttribute(attribute, translated);
  }
  if (states.size) attributeStates.set(element, states);
  else attributeStates.delete(element);
}

function applyLanguage(root: HTMLElement, language: CustomerLanguage) {
  translateAttributes(root, language);
  root.querySelectorAll("*").forEach((element) => translateAttributes(element, language));
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let current = walker.nextNode();
  while (current) {
    translateTextNode(current as Text, language);
    current = walker.nextNode();
  }
}

export function CustomerLanguageProvider({
  children,
  initialLanguage,
}: {
  children: React.ReactNode;
  initialLanguage: CustomerLanguage;
}) {
  const [language, setLanguageState] = useState<CustomerLanguage>(initialLanguage);
  const [translationReady, setTranslationReady] = useState(initialLanguage === "vi");
  const rootRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<number | null>(null);
  const bootstrapFrameRef = useRef<number | null>(null);
  const bootstrapTimerRef = useRef<number | null>(null);

  useLayoutEffect(() => {
    const stored = storedLanguage(initialLanguage);
    if (stored === initialLanguage) return;

    let shouldReload = true;
    try {
      const marker = `${LANGUAGE_COOKIE_SYNC_KEY}:${stored}`;
      shouldReload = window.sessionStorage.getItem(marker) !== "1";
      window.sessionStorage.setItem(marker, "1");
    } catch {
      // Avoid a reload loop in browsers that block both sessionStorage and cookies.
      shouldReload = false;
    }

    if (!shouldReload) return;
    writeLanguageCookie(stored);
    document.documentElement.style.visibility = "hidden";
    window.location.reload();
  }, [initialLanguage]);

  useEffect(() => {
    const stored = storedLanguage(initialLanguage);
    if (stored === initialLanguage) return;
    const timer = window.setTimeout(() => setLanguageState(stored), 0);
    return () => window.clearTimeout(timer);
  }, [initialLanguage]);

  useEffect(() => {
    try {
      window.localStorage.setItem(CUSTOMER_LANGUAGE_STORAGE_KEY, language);
    } catch {
      // The cookie below remains the persistence fallback.
    }
    writeLanguageCookie(language);
    void fetch("/api/customer-language", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ language }),
      keepalive: true,
    }).catch(() => undefined);
  }, [language]);

  const apply = useCallback(() => {
    // Portals (booking, authentication and payment dialogs) are mounted directly
    // under <body>, outside the provider wrapper. Translating the customer page
    // body keeps those deep CTA states in the selected language as well.
    if (document.body) applyLanguage(document.body, language);
    const titleNode = document.querySelector("title")?.firstChild;
    if (titleNode instanceof Text) translateTextNode(titleNode, language);
    document.documentElement.lang = language === "zh" ? "zh-CN" : language;
    if (rootRef.current) rootRef.current.style.visibility = "visible";
  }, [language]);

  useEffect(() => {
    let cancelled = false;

    const start = () => {
      bootstrapFrameRef.current = window.requestAnimationFrame(() => {
        bootstrapFrameRef.current = window.requestAnimationFrame(() => {
          bootstrapFrameRef.current = null;
          if (cancelled) return;
          apply();
          setTranslationReady(true);
        });
      });
    };

    const schedule = () => {
      bootstrapTimerRef.current = window.setTimeout(start, 500);
    };

    if (document.readyState === "complete") schedule();
    else window.addEventListener("load", schedule, { once: true });

    return () => {
      cancelled = true;
      window.removeEventListener("load", schedule);
      if (bootstrapTimerRef.current !== null) window.clearTimeout(bootstrapTimerRef.current);
      if (bootstrapFrameRef.current !== null) window.cancelAnimationFrame(bootstrapFrameRef.current);
    };
  }, [apply]);

  useEffect(() => {
    if (!translationReady || !rootRef.current || !document.body) return;
    const root = document.body;
    const observer = new MutationObserver(() => {
      if (frameRef.current !== null) window.cancelAnimationFrame(frameRef.current);
      frameRef.current = window.requestAnimationFrame(() => {
        frameRef.current = null;
        applyLanguage(root, language);
      });
    });
    observer.observe(root, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
      attributeFilter: [...TRANSLATABLE_ATTRIBUTES],
    });
    const headObserver = new MutationObserver(() => apply());
    headObserver.observe(document.head, { subtree: true, childList: true, characterData: true });
    return () => {
      observer.disconnect();
      headObserver.disconnect();
      if (frameRef.current !== null) window.cancelAnimationFrame(frameRef.current);
    };
  }, [language, apply, translationReady]);

  const setLanguage = useCallback((nextLanguage: CustomerLanguage) => {
    try {
      window.localStorage.setItem(CUSTOMER_LANGUAGE_STORAGE_KEY, nextLanguage);
    } catch {
      // The cookie below remains the persistence fallback.
    }
    writeLanguageCookie(nextLanguage);
    setTranslationReady(nextLanguage === "vi");
    setLanguageState(nextLanguage);
  }, []);

  const context = useMemo(() => ({ language, setLanguage }), [language, setLanguage]);

  return (
    <LanguageContext.Provider value={context}>
      <div
        ref={rootRef}
        lang={language}
        data-customer-language-root
        className="min-h-dvh"
        style={language !== "vi" && !translationReady ? { visibility: "hidden" } : undefined}
      >
        {children}
      </div>
    </LanguageContext.Provider>
  );
}

export function useCustomerLanguage() {
  return useContext(LanguageContext);
}
