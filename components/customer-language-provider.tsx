"use client";

import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  CUSTOMER_LANGUAGE_COOKIE_KEY,
  CUSTOMER_LANGUAGE_STORAGE_KEY,
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
const TRANSLATABLE_ATTRIBUTES = ["aria-label", "placeholder", "title"] as const;

function storedLanguage(): CustomerLanguage {
  try {
    const stored = window.localStorage.getItem(CUSTOMER_LANGUAGE_STORAGE_KEY);
    if (stored === "ko" || stored === "vi") return stored;
  } catch {
    // Cookie fallback below keeps the feature available when localStorage is blocked.
  }
  const cookie = document.cookie.split("; ").find((item) => item.startsWith(`${CUSTOMER_LANGUAGE_COOKIE_KEY}=`));
  return cookie?.split("=")[1] === "ko" ? "ko" : "vi";
}

function shouldSkip(node: Node) {
  const parent = node instanceof Element ? node : node.parentElement;
  return Boolean(parent?.closest("script, style, code, pre, textarea, [contenteditable='true'], [data-no-translate]"));
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
  if (shouldSkip(element)) return;
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

export function CustomerLanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<CustomerLanguage>("vi");
  const rootRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => setLanguageState(storedLanguage()), 0);
    return () => window.clearTimeout(timer);
  }, []);

  const apply = useCallback(() => {
    if (rootRef.current) applyLanguage(rootRef.current, language);
    document.documentElement.lang = language;
  }, [language]);

  useLayoutEffect(() => {
    apply();
  }, [apply]);

  useEffect(() => {
    if (!rootRef.current) return;
    const root = rootRef.current;
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
    return () => {
      observer.disconnect();
      if (frameRef.current !== null) window.cancelAnimationFrame(frameRef.current);
    };
  }, [language]);

  const setLanguage = useCallback((nextLanguage: CustomerLanguage) => {
    try {
      window.localStorage.setItem(CUSTOMER_LANGUAGE_STORAGE_KEY, nextLanguage);
    } catch {
      // The cookie below remains the persistence fallback.
    }
    const secure = window.location.protocol === "https:" ? "; Secure" : "";
    document.cookie = `${CUSTOMER_LANGUAGE_COOKIE_KEY}=${nextLanguage}; Max-Age=31536000; Path=/; SameSite=Lax${secure}`;
    setLanguageState(nextLanguage);
  }, []);

  const context = useMemo(() => ({ language, setLanguage }), [language, setLanguage]);

  return (
    <LanguageContext.Provider value={context}>
      <div ref={rootRef} lang={language} data-customer-language-root className="min-h-dvh">
        {children}
      </div>
    </LanguageContext.Provider>
  );
}

export function useCustomerLanguage() {
  return useContext(LanguageContext);
}
