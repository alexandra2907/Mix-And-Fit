/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useState } from "react";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "./firebase";
import { useAuth } from "./AuthContext";

export const ACCENTS = [
  { id: "pink", label: "Pink", color: "#e8618c" },
  { id: "purple", label: "Purple", color: "#8b5cf6" },
  { id: "teal", label: "Teal", color: "#14a38b" },
  { id: "blue", label: "Blue", color: "#3b82f6" },
];

const DEFAULTS = { theme: "light", accent: "pink", fontSize: "normal" };
const CACHE_KEY = "mixfit-preferences";

function readCache() {
  try {
    const saved = JSON.parse(localStorage.getItem(CACHE_KEY));
    return { ...DEFAULTS, ...(saved || {}) };
  } catch  {
    return DEFAULTS;
  }
}

function writeCache(value) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(value));
  } catch  {
    // storage not available: preferences still work for this visit
  }
}

const PreferencesContext = createContext(null);

export function PreferencesProvider({ children }) {
  const { user } = useAuth();
  const uid = user ? user.uid : null;
  const [prefs, setPrefs] = useState(readCache);
  const [systemDark, setSystemDark] = useState(
    window.matchMedia("(prefers-color-scheme: dark)").matches
  );

  // Follow the device setting when the theme is "system"
  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = (e) => setSystemDark(e.matches);
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  // Apply the choices to the whole page
  useEffect(() => {
    const theme =
      prefs.theme === "system" ? (systemDark ? "dark" : "light") : prefs.theme;
    const root = document.documentElement;
    root.setAttribute("data-theme", theme);
    root.setAttribute("data-accent", prefs.accent);
    root.setAttribute("data-font", prefs.fontSize);
  }, [prefs, systemDark]);

  // Load the preferences saved on this account
  useEffect(() => {
    if (!uid) return;
    let cancelled = false;
    getDoc(doc(db, "users", uid))
      .then((snap) => {
        if (cancelled || !snap.exists()) return;
        const saved = snap.data().preferences;
        if (saved) {
          const merged = { ...DEFAULTS, ...saved };
          setPrefs(merged);
          writeCache(merged);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [uid]);

  async function savePreferences(next) {
    setPrefs(next);
    writeCache(next);
    if (uid) {
      try {
        await setDoc(doc(db, "users", uid), { preferences: next }, { merge: true });
      } catch (err) {
        console.error("Could not save preferences:", err);
      }
    }
  }

  return (
    <PreferencesContext.Provider value={{ prefs, savePreferences, defaults: DEFAULTS }}>
      {children}
    </PreferencesContext.Provider>
  );
}

export function usePreferences() {
  return useContext(PreferencesContext);
}