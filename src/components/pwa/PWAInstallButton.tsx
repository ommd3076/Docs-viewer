import React, { useEffect, useState } from 'react';
import { Download, WifiOff } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone ===
        true;
    setIsInstalled(isStandalone);

    const userAgent = window.navigator.userAgent.toLowerCase();
    setIsIOS(/iphone|ipad|ipod/.test(userAgent));

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener(
        'beforeinstallprompt',
        handleBeforeInstallPrompt,
      );
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const install = async () => {
    if (!deferredPrompt) return false;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setIsInstalled(true);
      setDeferredPrompt(null);
      return true;
    }
    return false;
  };

  return {
    isInstallable: !!deferredPrompt,
    isInstalled,
    isIOS,
    install,
  };
}

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showGuideModal, setShowGuideModal] = useState(false);

  if (isInstalled) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => {
          if (isInstallable) {
            install();
          } else {
            setShowGuideModal(true);
          }
        }}
        className="flex items-center gap-1.5 rounded-xl border border-[#14171A]/10 bg-white/80 px-3 py-1.5 text-xs font-semibold text-[#14171A] transition hover:bg-white dark:border-white/10 dark:bg-[#21262D] dark:text-white dark:hover:bg-[#30363D] whitespace-nowrap shrink-0 cursor-pointer"
        aria-label="Install Offline PWA App"
      >
        <Download className="size-3.5 text-[#2563EB] dark:text-[#60A5FA]" />
        <span>Install PWA</span>
      </button>

      {showGuideModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
          aria-labelledby="pwa-install-title"
        >
          <div className="w-full max-w-md rounded-[28px] bg-[#F3F5F7] p-6 shadow-xl dark:bg-[#161B22] border border-black/10 dark:border-white/10">
            <h3
              id="pwa-install-title"
              className="text-lg font-bold text-[#14171A] dark:text-white"
            >
              Install VaultDocs Local Workspace (PWA)
            </h3>
            <p className="mt-2 text-sm text-[#475569] dark:text-[#94A3B8]">
              VaultDocs is pre-cached via a local Service Worker so you can open
              PDF, DOCX, PPTX, XLSX, and CSV files completely offline.
            </p>
            <div className="mt-4 rounded-2xl bg-white p-4 text-xs leading-relaxed text-[#14171A] dark:bg-[#0D1117] dark:text-[#E2E8F0]">
              {isIOS ? (
                <p>
                  1. Tap the <strong>Share</strong> button in Safari.<br />
                  2. Select <strong>Add to Home Screen</strong> to launch VaultDocs as a standalone offline app.
                </p>
              ) : (
                <p>
                  Click the <strong>Install VaultDocs</strong> icon in your browser address bar (or application menu) to install this workspace as a standalone desktop/mobile app.
                </p>
              )}
            </div>
            <div className="mt-5 flex justify-end">
              <button
                type="button"
                onClick={() => setShowGuideModal(false)}
                className="rounded-xl bg-[#1C1E21] px-4 py-2 text-xs font-semibold text-white hover:bg-[#2D3136] dark:bg-[#60A5FA] dark:text-[#0D1117] cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export const OfflineIndicator: React.FC = () => {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true,
  );

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (isOnline) return null;

  return (
    <div className="fixed bottom-4 left-4 z-50 flex items-center gap-2 rounded-2xl bg-[#1C1E21] px-4 py-2.5 text-xs font-semibold text-[#FDE047] shadow-lg border border-[#FDE047]/30">
      <WifiOff className="size-4" />
      <span>Offline Sovereign Mode Active — All local engines operational</span>
    </div>
  );
};
