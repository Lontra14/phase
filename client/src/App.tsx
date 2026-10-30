import { lazy, StrictMode, Suspense, useCallback, useEffect, useState, type ReactNode } from "react";
import { BrowserRouter, Navigate, Routes, Route, useLocation, useSearchParams } from "react-router";

import { AppToast } from "./components/chrome/AppToast";
import { NativeEngineProgressOverlay } from "./components/chrome/NativeEngineProgressOverlay";
import { RouteTelemetry } from "./components/chrome/RouteTelemetry";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { HostControlTile } from "./components/chrome/HostControlTile";
import { ProgressionResultWatcher } from "./progression/ProgressionResultWatcher";
import { isProgressionMatchPending } from "./progression/run";
import { EngineLostModal } from "./components/modal/EngineLostModal";
import { NonFatalPanicToast } from "./components/modal/NonFatalPanicToast";
import { StuckDecisionToast } from "./components/modal/StuckDecisionToast";
import { SplashScreen } from "./components/splash/SplashScreen";
import { useFeedInitialization } from "./hooks/useFeedInitialization";
import { useDesktopDeepLinks } from "./hooks/useDesktopDeepLinks";
import { useHostingSession } from "./hooks/useHostingSession";
import { canonicalizeSavedDeckNames, migrateSavedDecks } from "./services/deckMigrations";
import { useDeckLibraryAutoSync } from "./services/visualPacks/deckLibraryAutoSync";
import { ensurePreload, subscribePreload } from "./startup/preloadAssets";
import { useCardDataStore } from "./stores/cardDataStore";
import { useCloudSyncStore } from "./stores/cloudSyncStore";
import { useEffectiveOffline } from "./stores/connectivityStore";

const GamePage = lazy(() =>
  import("./pages/GamePage").then((m) => ({ default: m.GamePage })),
);
const MatchLabPage = lazy(() => import("./pages/MatchLabPage").then((m) => ({ default: m.MatchLabPage })));
const ReplayPage = lazy(() => import("./pages/ReplayPage").then((m) => ({ default: m.ReplayPage })));
const HomePage = lazy(() => import("./pages/HomePage").then((m) => ({ default: m.HomePage })));
const ProgressionPage = lazy(() => import("./pages/ProgressionPage").then((m) => ({ default: m.ProgressionPage })));

function DevStrict({ children }: { children: ReactNode }) {
  if (!import.meta.env.DEV) return children;
  return <StrictMode>{children}</StrictMode>;
}

/** Old /lab links (and roguelike deep links) keep their #you=…&opp=… hash. */
function LabRedirect() {
  const location = useLocation();
  return <Navigate to={{ pathname: "/test", hash: location.hash }} replace />;
}

/**
 * The match screen sends players to /setup or /multiplayer when something goes
 * wrong (deck rejected, setup error). Route them back to the mode they came from.
 */
function BackFromGame() {
  const location = useLocation();
  if (isProgressionMatchPending()) {
    return <Navigate to="/progression" replace state={location.state} />;
  }
  return (
    <DevStrict>
      <MatchLabPage />
    </DevStrict>
  );
}

function GameRouteElement() {
  const [searchParams] = useSearchParams();
  const mode = searchParams.get("mode");
  const isP2PGame = mode === "p2p-host" || mode === "p2p-join";

  if (isP2PGame) return <GamePage />;
  return (
    <DevStrict>
      <GamePage />
    </DevStrict>
  );
}

export function App() {
  return (
    <BrowserRouter useTransitions={false}>
      <AppContent />
    </BrowserRouter>
  );
}

function AppContent() {
  const effectiveOffline = useEffectiveOffline();
  const feedInitializationReady = useFeedInitialization(effectiveOffline);
  useHostingSession();
  useDesktopDeepLinks();

  // One-shot localStorage migrations. Must run before cloud-sync init so the
  // first sync sees the canonical (repaired) deck shapes and doesn't push a
  // tab full of "changed" decks that are byte-identical after repair.
  useEffect(() => {
    migrateSavedDecks();
  }, []);

  const cardDataStatus = useCardDataStore((s) => s.status);
  useEffect(() => {
    if (cardDataStatus !== "ready") return;
    void canonicalizeSavedDeckNames().catch(() => {/* best-effort; saved names still resolve */});
  }, [cardDataStatus]);

  // Connectivity policy is the sole lifecycle authority. Offline mode keeps
  // local dirty observation alive through pause(); only online generations own
  // a cleanup function.
  useEffect(() => {
    if (effectiveOffline) {
      useCloudSyncStore.getState().pause();
      return;
    }
    return useCloudSyncStore.getState().init();
  }, [effectiveOffline]);

  useDeckLibraryAutoSync(effectiveOffline, feedInitializationReady);

  const [showSplash, setShowSplash] = useState(true);
  const [progress, setProgress] = useState(0);
  const [loadLabel, setLoadLabel] = useState("Loading...");

  // Run startup preload for shell-safe assets only.
  useEffect(() => {
    if (!showSplash) return;

    const unsub = subscribePreload((p) => {
      setProgress(p.percent);
      if (p.phase === "audio") setLoadLabel("Loading audio...");
      else setLoadLabel("Ready");
    });
    ensurePreload();
    return unsub;
  }, [showSplash]);

  const handleSplashComplete = useCallback(() => {
    setShowSplash(false);
  }, []);

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <RouteTelemetry />
      {showSplash && (
        <SplashScreen progress={progress} onComplete={handleSplashComplete} label={loadLabel} />
      )}
      <ErrorBoundary>
      <Suspense fallback={<div className="flex min-h-screen items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-500 border-t-white" /></div>}>
        <Routes>
          {/* Rogue Forge build: mode select, Test match (MatchLab), Progression
              and the match itself. Every other phase.rs page is removed; routes
              the game still navigates to (setup, multiplayer) go back to the
              mode the player came from, which shows the reason. */}
          <Route path="/" element={<DevStrict><HomePage /></DevStrict>} />
          <Route path="/test" element={<DevStrict><MatchLabPage /></DevStrict>} />
          <Route path="/progression" element={<DevStrict><ProgressionPage /></DevStrict>} />
          <Route path="/lab" element={<LabRedirect />} />
          <Route path="/setup" element={<BackFromGame />} />
          <Route path="/multiplayer" element={<BackFromGame />} />
          <Route path="/game/:id" element={<GameRouteElement />} />
          <Route path="/replay" element={<ReplayPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
      </ErrorBoundary>
      <HostControlTile />
      <ProgressionResultWatcher />
      <AppToast />
      <NativeEngineProgressOverlay />
      <EngineLostModal />
      <NonFatalPanicToast />
      <StuckDecisionToast />
    </div>
  );
}
