import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Eye, EyeOff, QrCode, Loader2 } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import BreadcrumbTrail from "@/components/BreadcrumbTrail";

export default function LoginPage() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");

  const loginMutation = useMutation({
    mutationFn: async (data: { email: string; password: string }) => {
      const res = await apiRequest("POST", "/api/auth/login", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      setLocation("/");
    },
    onError: (err: any) => {
      setError(err.message || "Invalid email or password");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    loginMutation.mutate({ email, password });
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
          <h1 className="qr-auth-title">Welcome Back</h1>
          <p className="qr-auth-subtitle">Sign in to your account</p>
        </div>

        <form className="qr-auth-form" onSubmit={handleSubmit}>
          {error && <div className="qr-auth-error">{error}</div>}

          <div className="qr-auth-field">
            <label className="qr-auth-label" htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              className="qr-auth-input"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={loginMutation.isPending}
              data-testid="input-email"
            />
          </div>

          <div className="qr-auth-field">
            <label className="qr-auth-label" htmlFor="password">Password</label>
            <div className="qr-auth-field-relative">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                className="qr-auth-input"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loginMutation.isPending}
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

          <button
            type="submit"
            className="qr-auth-button qr-auth-button-primary"
            disabled={loginMutation.isPending}
            data-testid="button-login"
          >
            {loginMutation.isPending ? (
              <>
                <Loader2 className="qr-auth-spinner" />
                Signing in...
              </>
            ) : (
              "Sign In"
            )}
          </button>
        </form>

        <div className="qr-auth-divider">
          <div className="qr-auth-divider-line" />
          <span className="qr-auth-divider-text">or</span>
          <div className="qr-auth-divider-line" />
        </div>

        <a href="/api/login" className="qr-auth-button qr-auth-button-secondary" data-testid="button-replit-login">
          Continue with Replit
        </a>

        <div className="qr-auth-footer">
          Don't have an account?{" "}
          <Link href="/register" className="qr-auth-link" data-testid="link-register">
            Create one
          </Link>
        </div>
      </div>
    </div>
  );
}
