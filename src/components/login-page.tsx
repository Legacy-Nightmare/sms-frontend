import { useState, type FormEvent } from "react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { PasswordInput } from "@/components/password-input";
import { ApiError } from "@/lib/api";
import { ArrowRight, Lock, Mail, UserRound } from "lucide-react";

export function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(email, password);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't sign in. Try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="login-wrap">
      <div className="login-left">
        <div className="login-blob login-blob-1" />
        <div className="login-blob login-blob-2" />
        <div className="login-left-content">
          <div className="login-logo-badge">
            <img src="/logo.jpeg" alt="APHS logo" />
          </div>
          <strong>APHS</strong>
          <span>Agradoot Preparatory and High School</span>
          <div className="login-divider" />
          <p className="login-tagline">
            <span>Learn</span>
            <span className="login-tagline-dot" />
            <span>Grow</span>
            <span className="login-tagline-dot" />
            <span>Build a Better Tomorrow</span>
          </p>
        </div>
      </div>
      <div className="login-right">
        <div className="login-dots" />
        <div className="login-circle" />
        <div className="login-card">
          <div className="login-card-icon">
            <UserRound />
          </div>
          <h1>Sign in</h1>
          <p className="login-sub">Enter your credentials to access the dashboard</p>
          <form onSubmit={handleSubmit} className="login-form">
            <label>
              Email
              <div className="input-icon-field">
                <Mail />
                <input
                  type="email"
                  required
                  autoFocus
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@school.edu.bd"
                />
              </div>
            </label>
            <label>
              Password
              <div className="input-icon-field">
                <Lock />
                <PasswordInput
                  required
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="••••••••"
                />
              </div>
            </label>
            {error && <p className="login-error">{error}</p>}
            <Button type="submit" disabled={submitting} className="login-submit">
              {submitting ? "Signing in…" : (
                <>
                  Sign in
                  <ArrowRight />
                </>
              )}
            </Button>
          </form>
          <div className="login-footer">
            <span />
            <p>Staff and admin access only</p>
            <span />
          </div>
        </div>
      </div>
    </div>
  );
}
