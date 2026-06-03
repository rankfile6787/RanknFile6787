"use client";

import { useEffect, useMemo, useState } from "react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

function isIosDevice() {
  if (typeof navigator === "undefined") return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function isStandalone() {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(display-mode: standalone)").matches || Boolean((navigator as any).standalone);
}

export default function InstallAppCard() {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [message, setMessage] = useState("");
  const showIosHelp = useMemo(() => isIosDevice() && !installed, [installed]);

  useEffect(() => {
    setInstalled(isStandalone());

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => null);
    }

    function handleBeforeInstallPrompt(event: Event) {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    }

    function handleInstalled() {
      setInstalled(true);
      setMessage("Installed.");
    }

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleInstalled);
    };
  }, []);

  async function installApp() {
    if (!installPrompt) {
      setMessage("Use your browser menu to add Rank & File 6787 to your home screen.");
      return;
    }

    await installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    setInstallPrompt(null);
    setMessage(choice.outcome === "accepted" ? "Installed." : "Install dismissed.");
  }

  if (installed) return null;

  return (
    <section className="install-card">
      <img src="/icons/icon-192.png" alt="" aria-hidden="true" />
      <div>
        <h2>Install Rank & File 6787</h2>
        <p className="muted">
          Add the site to your phone for an app icon, faster access, and future notification options for forum,
          incentive, and flyer updates.
        </p>
        {showIosHelp ? (
          <p className="install-help">On iPhone, open this page in Safari, tap Share, then Add to Home Screen.</p>
        ) : null}
        {message ? <p className="install-help">{message}</p> : null}
      </div>
      <button className="btn primary" type="button" onClick={installApp}>
        Install App
      </button>
    </section>
  );
}
