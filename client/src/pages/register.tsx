import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Eye, EyeOff, QrCode, Loader2 } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { signInWithGoogle } from "@/lib/firebase";
import BreadcrumbTrail from "@/components/BreadcrumbTrail";

export default function RegisterPage() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");

  const registerMutation = useMutation({
    mutationFn: async (data: { email: string; password: string; firstName: string; lastName: string }) => {
      const res = await apiRequest("POST", "/api/auth/register", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      setLocation("/");
    },
    onError: (err: any) => {
      setError(err.message || "Failed to create account");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }

    registerMutation.mutate({ email, password, firstName, lastName });
  };

  const handleGoogleSignUp = async () => {
    setError("");
    try {
      await signInWithGoogle();
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      setLocation("/");
    } catch (err: any) {
      if (err.code !== "auth/popup-closed-by-user") {
        setError(err.message || "Google sign up failed");
      }
    }
  };

  return (
    <div className="qr-auth-container">
      <BreadcrumbTrail />
      <div className="qr-auth-card">
        <div className="qr-auth-header">
          <div className="qr-auth-logo">
            <QrCode size={32} />
            <span>QR<span className="qr-auth-logo-accent">Gear</span></span>
          </div>
          <h1 className="qr-auth-title">Create Account</h1>
          <p className="qr-auth-subtitle">Start creating custom QR products</p>
        </div>

        <form className="qr-auth-form" onSubmit={handleSubmit} autoComplete="on">
          {error && <div className="qr-auth-error">{error}</div>}

          <div className="qr-auth-row">
            <div className="qr-auth-field">
              <label className="qr-auth-label" htmlFor="firstName">First Name</label>
              <input
                id="firstName"
                name="firstName"
                type="text"
                autoComplete="given-name"
                className="qr-auth-input"
                placeholder="John"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                disabled={registerMutation.isPending}
                data-testid="input-first-name"
              />
            </div>
            <div className="qr-auth-field">
              <label className="qr-auth-label" htmlFor="lastName">Last Name</label>
              <input
                id="lastName"
                name="lastName"
                type="text"
                autoComplete="family-name"
                className="qr-auth-input"
                placeholder="Doe"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                disabled={registerMutation.isPending}
                data-testid="input-last-name"
              />
            </div>
          </div>

          <div className="qr-auth-field">
            <label className="qr-auth-label" htmlFor="email">Email</label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              className="qr-auth-input"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={registerMutation.isPending}
              data-testid="input-email"
            />
          </div>

          <div className="qr-auth-field">
            <label className="qr-auth-label" htmlFor="password">Password</label>
            <div className="qr-auth-field-relative">
              <input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                className="qr-auth-input"
                placeholder="At least 8 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={registerMutation.isPending}
                data-testid="input-password"
              />
              <button
                type="button"
                className="qr-auth-password-toggle"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                data-testid="button-toggle-password"
              >
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
          </div>

          <div className="qr-auth-field">
            <label className="qr-auth-label" htmlFor="confirmPassword">Confirm Password</label>
            <input
              id="confirmPassword"
              name="confirmPassword"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              className="qr-auth-input"
              placeholder="Confirm your password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              disabled={registerMutation.isPending}
              data-testid="input-confirm-password"
            />
          </div>

          <button
            type="submit"
            className="qr-auth-button qr-auth-button-primary"
            disabled={registerMutation.isPending}
            data-testid="button-register"
          >
            {registerMutation.isPending ? (
              <>
                <Loader2 className="qr-auth-spinner" />
                Creating account...
              </>
            ) : (
              "Create Account"
            )}
          </button>
        </form>

        <div className="qr-auth-divider">
          <div className="qr-auth-divider-line" />
          <span className="qr-auth-divider-text">or</span>
          <div className="qr-auth-divider-line" />
        </div>

        <button 
          onClick={handleGoogleSignUp}
          className="qr-auth-button qr-auth-button-secondary" 
          disabled={registerMutation.isPending}
          data-testid="button-google-register"
        >
          Continue with Google
        </button>

        <div className="qr-auth-footer">
          Already have an account?{" "}
          <Link href="/login" className="qr-auth-link" data-testid="link-login">
            Sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
