import { QueryClientProvider } from "@tanstack/react-query";
import { useEffect } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "./components/shell/AppShell";
import { queryClient } from "./lib/queryClient";
import { CharactersPage } from "./pages/CharactersPage";
import { DashboardPage } from "./pages/DashboardPage";
import { GraphPage } from "./pages/GraphPage";
import { TimelinePage } from "./pages/TimelinePage";
import { useUiStore } from "./store/uiStore";

const TITLES: Record<string, string> = {
  "/": "Universe Dashboard",
  "/characters": "Characters",
  "/graph": "Universe Graph",
  "/timeline": "Timeline",
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
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </QueryClientProvider>
  );
}

export default App;
