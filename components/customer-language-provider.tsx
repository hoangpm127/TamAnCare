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

function storedLanguage(fallback: CustomerLanguage): CustomerLanguage {
  try {
    const stored = window.localStorage.getItem(CUSTOMER_LANGUAGE_STORAGE_KEY);
    if (stored === "ko" || stored === "vi") return stored;
  } catch {
    // The server-provided cookie value remains the fallback when storage is blocked.
  }
  return fallback;
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
  const rootRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    const stored = storedLanguage(initialLanguage);
    if (stored === initialLanguage) return;
    const timer = window.setTimeout(() => setLanguageState(stored), 0);
    return () => window.clearTimeout(timer);
  }, [initialLanguage]);

  const apply = useCallback(() => {
    // Portals (booking, authentication and payment dialogs) are mounted directly
    // under <body>, outside the provider wrapper. Translating the customer page
    // body keeps those deep CTA states in the selected language as well.
    if (document.body) applyLanguage(document.body, language);
    const titleNode = document.querySelector("title")?.firstChild;
    if (titleNode instanceof Text) translateTextNode(titleNode, language);
    document.documentElement.lang = language;
  }, [language]);

  useLayoutEffect(() => {
    apply();
  }, [apply]);

  useEffect(() => {
    if (!rootRef.current || !document.body) return;
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
  }, [language, apply]);

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
