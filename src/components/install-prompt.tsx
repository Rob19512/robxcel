"use client";

import { useEffect, useState } from "react";
import { Download, Share, X } from "lucide-react";
import { Button } from "@/components/ui/button";

const DISMISS_KEY = "pwa-install-dismissed";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function isStandalone() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as { standalone?: boolean }).standalone === true
  );
}

function isIos() {
  return /iphone|ipad|ipod/i.test(window.navigator.userAgent);
}

export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIosHint, setShowIosHint] = useState(false);
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    if (localStorage.getItem(DISMISS_KEY) === "1") return;
    if (isStandalone()) return;
    setDismissed(false);

    if (isIos()) {
      setShowIosHint(true);
      return;
    }

    function onBeforeInstallPrompt(e: Event) {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    }
    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
  }, []);

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, "1");
    setDismissed(true);
  }

  async function handleInstall() {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") dismiss();
    setDeferredPrompt(null);
  }

  if (dismissed) return null;
  if (!deferredPrompt && !showIosHint) return null;

  return (
    <div className="fixed inset-x-4 bottom-4 z-50 mx-auto flex max-w-md items-center gap-3 rounded-xl border bg-card px-4 py-3 text-sm shadow-lg sm:inset-x-auto sm:right-4">
      <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Download className="size-4.5" />
      </div>
      <div className="flex-1">
        {showIosHint ? (
          <p>
            Installe Robxcel sur ton écran d&apos;accueil : appuie sur{" "}
            <Share className="inline size-3.5 align-text-bottom" /> puis{" "}
            <strong>Sur l&apos;écran d&apos;accueil</strong>.
          </p>
        ) : (
          <p>Installe Robxcel sur cet appareil pour y accéder en un tap.</p>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-1">
        {!showIosHint && (
          <Button size="sm" onClick={handleInstall}>
            Installer
          </Button>
        )}
        <Button variant="ghost" size="icon-sm" onClick={dismiss} aria-label="Fermer">
          <X className="size-4" />
        </Button>
      </div>
    </div>
  );
}
