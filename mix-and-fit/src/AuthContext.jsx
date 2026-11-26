/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useRef, useState } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth } from "./firebase";

const AuthContext = createContext(null);

const CHECK_EVERY_MS = 15000;

// Firebase error codes that mean "this login is no longer valid"
const SESSION_ENDED_CODES = [
  "auth/user-token-expired",
  "auth/invalid-user-token",
  "auth/user-not-found",
  "auth/user-disabled",
];

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");
  const [prefillEmail, setPrefillEmail] = useState("");
  const [, setTick] = useState(0);
  const knownEmail = useRef(null);

  // Makes every page draw itself again (after a profile change)
  function refresh() {
    setTick((t) => t + 1);
  }

  function clearNotice() {
    setNotice("");
    setPrefillEmail("");
  }

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      knownEmail.current = currentUser ? currentUser.email : null;
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  // While someone is logged in, check regularly that the account
  // was not changed somewhere else (password reset, email change).
  useEffect(() => {
    if (!user) return;

    async function endSession(message, email) {
      setNotice(message);
      setPrefillEmail(email || "");
      await signOut(auth);
    }

    async function check() {
      if (document.visibilityState !== "visible") return;
      try {
        await user.reload();
        if (knownEmail.current && user.email && user.email !== knownEmail.current) {
          await endSession(
            "Your email address was changed. Please log in with " + user.email + ".",
            user.email
          );
          return;
        }
        await user.getIdToken(true);
      } catch (err) {
        if (SESSION_ENDED_CODES.includes(err.code)) {
          await endSession(
            "Your password or email was changed. Please log in again with your new details.",
            ""
          );
        }
        // other errors (for example no internet) are ignored: we try again next time
      }
    }

    const timer = setInterval(check, CHECK_EVERY_MS);
    window.addEventListener("focus", check);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", check);
    };
  }, [user]);

  return (
    <AuthContext.Provider
      value={{ user, loading, refresh, notice, prefillEmail, clearNotice }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}