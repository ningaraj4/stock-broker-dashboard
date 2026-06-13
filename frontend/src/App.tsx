import { useEffect, useState } from "react";
import DashboardPage from "./pages/DashboardPage";
import LoginPage from "./pages/LoginPage";
import { clearSession, loadSession, saveSession } from "./services/storage";
import type { AuthSession } from "./types";

function App() {
  const [session, setSession] = useState<AuthSession | null>(() => loadSession());
  const [theme, setTheme] = useState<"light" | "dark">(
    () => (localStorage.getItem("app-theme") as "light" | "dark") || "dark"
  );

  useEffect(() => {
    localStorage.setItem("app-theme", theme);
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === "dark" ? "light" : "dark"));
  };

  const handleLogin = (nextSession: AuthSession) => {
    saveSession(nextSession);
    setSession(nextSession);
  };

  const handleLogout = () => {
    clearSession();
    setSession(null);
  };

  return (
    <div className="app-shell">
      <button className="theme-toggle" onClick={toggleTheme} aria-label="Toggle theme">
        {theme === "dark" ? "☀️ Light Mode" : "🌙 Dark Mode"}
      </button>
      {session ? (
        <DashboardPage session={session} onLogout={handleLogout} />
      ) : (
        <LoginPage onLogin={handleLogin} />
      )}
    </div>
  );
}

export default App;

