import { QueryClientProvider } from "@tanstack/react-query";
import { useEffect } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "./components/shell/AppShell";
import { queryClient } from "./lib/queryClient";
import { CanonPage } from "./pages/CanonPage";
import { CharactersPage } from "./pages/CharactersPage";
import { DashboardPage } from "./pages/DashboardPage";
import { GraphPage } from "./pages/GraphPage";
import { LocationsPage } from "./pages/LocationsPage";
import { MilitaryPage } from "./pages/MilitaryPage";
import { NotesImportPage } from "./pages/NotesImportPage";
import { OrganizationsPage } from "./pages/OrganizationsPage";
import { PoliticsPage } from "./pages/PoliticsPage";
import { ProjectPickerPage } from "./pages/ProjectPickerPage";
import { ReligionsPage } from "./pages/ReligionsPage";
import { SpeciesPage } from "./pages/SpeciesPage";
import { TechnologyPage } from "./pages/TechnologyPage";
import { TimelinePage } from "./pages/TimelinePage";
import { useProjectStore } from "./store/projectStore";
import { useUiStore } from "./store/uiStore";

const TITLES: Record<string, string> = {
  "/": "Universe Dashboard",
  "/characters": "Characters",
  "/graph": "Universe Graph",
  "/timeline": "Timeline",
  "/canon": "Canon",
  "/locations": "World Explorer",
  "/technology": "Technology Bible",
  "/species": "Species Codex",
  "/military": "Military",
  "/politics": "Politics",
  "/religions": "Religions",
  "/organizations": "Organizations",
  "/notes-import": "Import Notes",
};

function useSyncThemeClass() {
  const theme = useUiStore((s) => s.theme);
  useEffect(() => {
    document.documentElement.classList.toggle("light", theme === "light");
  }, [theme]);
}

function App() {
  useSyncThemeClass();

  const currentProjectId = useProjectStore((s) => s.currentProjectId);
  const isInitializing = useProjectStore((s) => s.isInitializing);
  const initialize = useProjectStore((s) => s.initialize);

  useEffect(() => {
    initialize();
    // Runs once on mount: lists known projects and, if one was open last
    // session, re-opens it against the (freshly-started, blank) backend
    // connection before rendering any data-dependent routes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      {isInitializing ? (
        <div className="flex h-screen w-screen items-center justify-center bg-[var(--color-bg-0)] text-sm text-[var(--color-text-secondary)]">
          Loading your projects…
        </div>
      ) : currentProjectId === null ? (
        <ProjectPickerPage />
      ) : (
        <Routes>
          <Route
            path="/"
            element={
              <AppShell title={TITLES["/"]}>
                <DashboardPage />
              </AppShell>
            }
          />
          <Route
            path="/characters"
            element={
              <AppShell title={TITLES["/characters"]}>
                <CharactersPage />
              </AppShell>
            }
          />
          <Route
            path="/graph"
            element={
              <AppShell title={TITLES["/graph"]}>
                <GraphPage />
              </AppShell>
            }
          />
          <Route
            path="/timeline"
            element={
              <AppShell title={TITLES["/timeline"]}>
                <TimelinePage />
              </AppShell>
            }
          />
          <Route
            path="/canon"
            element={
              <AppShell title={TITLES["/canon"]}>
                <CanonPage />
              </AppShell>
            }
          />
          <Route
            path="/locations"
            element={
              <AppShell title={TITLES["/locations"]}>
                <LocationsPage />
              </AppShell>
            }
          />
          <Route
            path="/technology"
            element={
              <AppShell title={TITLES["/technology"]}>
                <TechnologyPage />
              </AppShell>
            }
          />
          <Route
            path="/species"
            element={
              <AppShell title={TITLES["/species"]}>
                <SpeciesPage />
              </AppShell>
            }
          />
          <Route
            path="/military"
            element={
              <AppShell title={TITLES["/military"]}>
                <MilitaryPage />
              </AppShell>
            }
          />
          <Route
            path="/politics"
            element={
              <AppShell title={TITLES["/politics"]}>
                <PoliticsPage />
              </AppShell>
            }
          />
          <Route
            path="/religions"
            element={
              <AppShell title={TITLES["/religions"]}>
                <ReligionsPage />
              </AppShell>
            }
          />
          <Route
            path="/organizations"
            element={
              <AppShell title={TITLES["/organizations"]}>
                <OrganizationsPage />
              </AppShell>
            }
          />
          <Route
            path="/notes-import"
            element={
              <AppShell title={TITLES["/notes-import"]}>
                <NotesImportPage />
              </AppShell>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      )}
    </QueryClientProvider>
  );
}

export default App;
