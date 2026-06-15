import { useEffect, useState } from "react";
import { Route, Routes, useLocation } from "react-router-dom";
import { Home } from "./Home";
import { Room } from "./Room";
import { updatePageMetadata } from "./pageMetadata";

export type Theme = "light" | "dark";

function getInitialTheme(): Theme {
  const saved = localStorage.getItem("code-room-theme");
  if (saved === "light" || saved === "dark") return saved;
  return matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function App() {
  const location = useLocation();
  const [theme, setTheme] = useState<Theme>(getInitialTheme);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("code-room-theme", theme);
  }, [theme]);

  useEffect(() => updatePageMetadata(location.pathname), [location.pathname]);

  const toggleTheme = () => setTheme((value) => (value === "light" ? "dark" : "light"));

  return (
    <Routes>
      <Route path="/" element={<Home theme={theme} toggleTheme={toggleTheme} />} />
      <Route path="/room/:id" element={<Room theme={theme} toggleTheme={toggleTheme} />} />
      <Route path="*" element={<Home theme={theme} toggleTheme={toggleTheme} />} />
    </Routes>
  );
}
