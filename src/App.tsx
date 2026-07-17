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
import { PoliticsPage } from "./pages/PoliticsPage";
import { SpeciesPage } from "./pages/SpeciesPage";
import { TechnologyPage } from "./pages/TechnologyPage";
import { TimelinePage } from "./pages/TimelinePage";
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
};

function useSyncThemeClass() {
  const theme = useUiStore((s) => s.theme);
  useEffect(() => {
    document.documentElement.classList.toggle("light", theme === "light");
  }, [theme]);
}

function App() {
  useSyncThemeClass();

  return (
    <QueryClientProvider client={queryClient}>
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
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </QueryClientProvider>
  );
}

export default App;
