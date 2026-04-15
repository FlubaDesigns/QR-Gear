import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { getAuth, signInWithCustomToken } from "firebase/auth";

export default function DevAuth() {
  const [status, setStatus] = useState("Authenticating…");
  const [, navigate] = useLocation();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");
    const redirect = params.get("redirect") || "/admin";

    if (!token) {
      setStatus("No token provided.");
      return;
    }

    const auth = getAuth();
    signInWithCustomToken(auth, token)
      .then(() => {
        setStatus("Signed in. Redirecting…");
        navigate(redirect);
      })
      .catch((err) => {
        setStatus(`Auth failed: ${err.message}`);
      });
  }, [navigate]);

  return (
    <div className="flex items-center justify-center h-screen text-sm text-muted-foreground">
      {status}
    </div>
  );
}
