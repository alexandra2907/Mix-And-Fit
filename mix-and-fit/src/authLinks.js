import { sendPasswordResetEmail, verifyBeforeUpdateEmail } from "firebase/auth";
import { auth } from "./firebase";

function backToLogin() {
  return { url: window.location.origin + "/login" };
}

// If the address of the app is not an authorized domain (for example when
// testing from a phone on the local network), send the plain e-mail instead.
export async function sendResetLink(email) {
  try {
    await sendPasswordResetEmail(auth, email, backToLogin());
  } catch (err) {
    if (err.code === "auth/unauthorized-continue-uri") {
      await sendPasswordResetEmail(auth, email);
    } else {
      throw err;
    }
  }
}

export async function sendEmailChangeLink(user, newEmail) {
  try {
    await verifyBeforeUpdateEmail(user, newEmail, backToLogin());
  } catch (err) {
    if (err.code === "auth/unauthorized-continue-uri") {
      await verifyBeforeUpdateEmail(user, newEmail);
    } else {
      throw err;
    }
  }
}