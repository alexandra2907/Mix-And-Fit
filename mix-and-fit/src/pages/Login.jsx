import { useState } from "react";
import {
  signInWithEmailAndPassword,
  signInWithPopup,
  getAdditionalUserInfo,
} from "firebase/auth";
import { Link, useNavigate } from "react-router-dom";
import { auth, googleProvider } from "../firebase";
import { sendWelcomeEmail } from "../email";
import { useAuth } from "../AuthContext";

function Login() {
  const { notice, prefillEmail, clearNotice } = useAuth();
  const [email, setEmail] = useState(prefillEmail || "");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    try {
      await signInWithEmailAndPassword(auth, email, password);
      clearNotice();
      navigate("/");
    } catch {
      setError("Wrong email or password.");
    }
  }

  async function handleGoogle() {
    setError("");
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const info = getAdditionalUserInfo(result);
      if (info && info.isNewUser) {
        try {
          await sendWelcomeEmail(result.user.displayName || "there", result.user.email);
        } catch  {
          // ignore: the welcome email is a bonus
        }
      }
      clearNotice();
      navigate("/");
    } catch (err) {
      setError("Google login failed (" + err.code + ").");
    }
  }

  return (
    <div className="auth-page">
      <div className="card auth-card">
        <h1>Welcome back</h1>
        <p className="muted center">Log in to your closet.</p>
        {notice && <p className="notice">{notice}</p>}
        <form onSubmit={handleSubmit}>
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <button type="submit" className="btn-full">Log in</button>
        </form>
        <button type="button" className="btn-ghost btn-full spaced" onClick={handleGoogle}>
          Continue with Google
        </button>
        {error && <p className="error">{error}</p>}
        <p className="muted center spaced">
          <Link to="/forgot-password">Forgot your password?</Link>
        </p>
        <p className="muted center spaced">
          No account yet? <Link to="/register">Register</Link>
        </p>
      </div>
    </div>
  );
}

export default Login;