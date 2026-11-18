import { useState } from "react";
import {
  EmailAuthProvider,
  reauthenticateWithCredential,
  updatePassword,
  updateProfile,
} from "firebase/auth";
import { auth } from "../firebase";
import { useAuth } from "../AuthContext";
import { usePreferences, ACCENTS } from "../PreferencesContext";
import { sendResetLink, sendEmailChangeLink } from "../authLinks";

function friendlyError(code) {
  if (code === "auth/wrong-password" || code === "auth/invalid-credential") {
    return "The current password is not correct.";
  }
  if (code === "auth/too-many-requests") return "Too many attempts. Please wait a few minutes.";
  if (code === "auth/weak-password") return "The new password must have at least 6 characters.";
  if (code === "auth/invalid-email") return "This email address is not valid.";
  if (code === "auth/email-already-in-use") return "This email already has an account.";
  if (code === "auth/requires-recent-login") return "Please log out, log in again and retry.";
  return "Something went wrong (" + code + ").";
}

function Profile() {
  const { user, refresh } = useAuth();
  const { prefs, savePreferences, defaults } = usePreferences();

  const usesPassword = user.providerData.some((p) => p.providerId === "password");
  const usesGoogle = user.providerData.some((p) => p.providerId === "google.com");

  const [username, setUsername] = useState(user.displayName || "");
  const [nameMsg, setNameMsg] = useState("");
  const [nameErr, setNameErr] = useState("");

  const [newEmail, setNewEmail] = useState("");
  const [emailPassword, setEmailPassword] = useState("");
  const [emailMsg, setEmailMsg] = useState("");
  const [emailErr, setEmailErr] = useState("");

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pwMsg, setPwMsg] = useState("");
  const [pwErr, setPwErr] = useState("");

  async function saveName(event) {
    event.preventDefault();
    setNameMsg("");
    setNameErr("");
    const trimmed = username.trim();
    if (trimmed.length < 2) {
      setNameErr("The username must have at least 2 characters.");
      return;
    }
    try {
      await updateProfile(user, { displayName: trimmed });
      refresh();
      setNameMsg("Username saved.");
    } catch (err) {
      setNameErr("Could not save the username (" + err.code + ").");
    }
  }

  async function changeEmail(event) {
    event.preventDefault();
    setEmailMsg("");
    setEmailErr("");
    const target = newEmail.trim();
    try {
      const credential = EmailAuthProvider.credential(user.email, emailPassword);
      await reauthenticateWithCredential(user, credential);
      await verifyBeforeUpdateEmail(user, target);
      setEmailMsg(
        "We sent a confirmation link to " + target +
          ". Your email changes after you click it, and you may have to log in again."
      );
      setNewEmail("");
      setEmailPassword("");
    } catch (err) {
      setEmailErr(friendlyError(err.code));
    }
  }

  async function changePassword(event) {
    event.preventDefault();
    setPwMsg("");
    setPwErr("");
    if (newPassword.length < 6) {
      setPwErr("The new password must have at least 6 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwErr("The two new passwords are not the same.");
      return;
    }
    try {
      const credential = EmailAuthProvider.credential(user.email, currentPassword);
      await reauthenticateWithCredential(user, credential);
      await updatePassword(user, newPassword);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setPwMsg("Password changed.");
    } catch (err) {
      setPwErr(friendlyError(err.code));
    }
  }

  async function sendReset() {
    setPwMsg("");
    setPwErr("");
    try {
      await sendPasswordResetEmail(auth, user.email);
      setPwMsg("A reset link was sent to " + user.email + ".");
    } catch (err) {
      setPwErr(friendlyError(err.code));
    }
  }

  function setPref(key, value) {
    savePreferences({ ...prefs, [key]: value });
  }

  return (
    <div className="profile-grid">
      <h1>My profile</h1>

      <div className="card">
        <h2>Account</h2>

        <form onSubmit={saveName}>
          <label className="field-label">Username</label>
          <div className="row">
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
            <button type="submit">Save username</button>
          </div>
        </form>
        {nameMsg && <p className="notice">{nameMsg}</p>}
        {nameErr && <p className="error">{nameErr}</p>}

        <p className="spaced">
          <span className="field-label">Email</span>
          {user.email}{" "}
          <span className="badge">{user.emailVerified ? "Verified" : "Not verified"}</span>
        </p>
        <p className="muted">
          Sign-in method:{" "}
          {[usesPassword && "email and password", usesGoogle && "Google"]
            .filter(Boolean)
            .join(" and ")}
        </p>
      </div>

      <div className="card">
        <h2>Change email</h2>
        {usesPassword ? (
          <form onSubmit={changeEmail}>
            <label className="field-label">New email</label>
            <input
              type="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              autoComplete="email"
              required
            />
            <label className="field-label">Current password</label>
            <input
              type="password"
              value={emailPassword}
              onChange={(e) => setEmailPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
            <button type="submit">Send confirmation link</button>
          </form>
        ) : (
          <p className="muted">
            You sign in with Google, so your email is managed by your Google account.
          </p>
        )}
        {emailMsg && <p className="notice">{emailMsg}</p>}
        {emailErr && <p className="error">{emailErr}</p>}
      </div>

      <div className="card">
        <h2>Password</h2>
        {usesPassword ? (
          <form onSubmit={changePassword}>
            <p className="muted">Your password is stored securely and can't be shown.</p>
            <label className="field-label">Current password</label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
            <label className="field-label">New password</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              autoComplete="new-password"
              required
            />
            <label className="field-label">Repeat the new password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
              required
            />
            <div className="row">
              <button type="submit">Change password</button>
              <button type="button" className="btn-ghost" onClick={sendReset}>
                I forgot it: email me a reset link
              </button>
            </div>
          </form>
        ) : (
          <p className="muted">
            You sign in with Google, so there is no password to change here.
          </p>
        )}
        {pwMsg && <p className="notice">{pwMsg}</p>}
        {pwErr && <p className="error">{pwErr}</p>}
      </div>

      <div className="card">
        <h2>Appearance</h2>

        <label className="field-label">Theme</label>
        <select value={prefs.theme} onChange={(e) => setPref("theme", e.target.value)}>
          <option value="light">Light</option>
          <option value="dark">Dark</option>
          <option value="system">Match my device</option>
        </select>

        <label className="field-label">Accent color</label>
        <div className="swatches">
          {ACCENTS.map((a) => (
            <button
              key={a.id}
              type="button"
              title={a.label}
              aria-label={a.label}
              className={prefs.accent === a.id ? "swatch selected" : "swatch"}
              style={{ background: a.color }}
              onClick={() => setPref("accent", a.id)}
            />
          ))}
        </div>

        <label className="field-label">Text size</label>
        <select value={prefs.fontSize} onChange={(e) => setPref("fontSize", e.target.value)}>
          <option value="small">Small</option>
          <option value="normal">Normal</option>
          <option value="large">Large</option>
        </select>

        <p className="muted">Saved on your account and applied on every device you use.</p>
        <button type="button" className="btn-ghost" onClick={() => savePreferences(defaults)}>
          Reset to defaults
        </button>
      </div>
    </div>
  );
}

export default Profile;