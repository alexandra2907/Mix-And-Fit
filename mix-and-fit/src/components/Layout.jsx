import { useEffect, useState } from "react";
import { Link, NavLink, Outlet } from "react-router-dom";
import { signOut, sendEmailVerification } from "firebase/auth";
import { auth } from "../firebase";
import { useAuth } from "../AuthContext";

function Layout() {
  const { user } = useAuth();
  const [verified, setVerified] = useState(user.emailVerified);
  const [info, setInfo] = useState("");

  // While the address is not verified, ask Firebase again every few seconds
  // and whenever the person comes back to this tab.
  useEffect(() => {
    if (verified) return;

    async function check() {
      if (document.visibilityState !== "visible") return;
      try {
        await user.reload();
        if (user.emailVerified) setVerified(true);
      } catch (err) {
        // network problem: try again at the next check
      }
    }

    const timer = setInterval(check, 5000);
    window.addEventListener("focus", check);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", check);
    };
  }, [verified, user]);

  async function resend() {
    try {
      await sendEmailVerification(user);
      setInfo("Verification email sent again.");
    } catch (err) {
      setInfo("Please wait a few minutes before asking again.");
    }
  }

  return (
    <div>
      <header className="topbar">
        <Link to="/" className="logo">Mix &amp; Fit</Link>
        <nav className="nav">
          <NavLink to="/" end>Home</NavLink>
          <NavLink to="/closet">My closet</NavLink>
          <NavLink to="/outfits">Outfits</NavLink>
        </nav>
        <div className="topbar-right">
            <Link to="/profile" className="profile-link">
              {user.displayName || user.email}
            </Link>
          <button className="btn-ghost btn-small" onClick={() => signOut(auth)}>
            Log out
          </button>
        </div>
      </header>

      {!verified && (
        <div className="banner">
          <span>
            Please verify your email address using the link we sent you. This
            message disappears by itself once you have.
          </span>
          <button className="btn-ghost btn-small" onClick={resend}>Resend email</button>
          {info && <span className="muted">{info}</span>}
        </div>
      )}

      <main className="container">
        <Outlet />
      </main>
    </div>
  );
}

export default Layout;