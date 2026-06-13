import { useState, type FormEvent } from "react";
import { login } from "../services/api";
import type { AuthSession } from "../types";

type LoginPageProps = {
  onLogin: (session: AuthSession) => void;
};

function LoginPage({ onLogin }: LoginPageProps) {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const supportedStocks = ["GOOG", "TSLA", "AMZN", "META", "NVDA"];

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const session = await login(email);
      onLogin(session);
    } catch (requestError) {
      const message =
        requestError instanceof Error
          ? requestError.message
          : "Unable to login.";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="page page-login hero-card">
      <div className="hero-grid hero-grid-wide">
        <section className="hero-column">
          <span className="eyebrow">Real-time brokerage board</span>
          <h1 className="hero-title">Stock Broker Client Web Dashboard</h1>
          <p className="hero-copy">
            A clean client dashboard for watching stock subscriptions in motion.
            Sign in with an email, create a watchlist, and stream live price
            updates every second without refreshing the page.
          </p>

          <div className="ticker-cloud">
            {supportedStocks.map((stockCode) => (
              <span key={stockCode} className="ticker-badge">
                {stockCode}
              </span>
            ))}
          </div>

          <div className="feature-grid">
            <article className="feature-card">
              <p className="feature-label">Login model</p>
              <h3>Single-step access</h3>
              <p className="muted-text">
                The platform uses email-only login. If the email is new, the
                backend creates the user automatically and returns a JWT.
              </p>
            </article>

            <article className="feature-card">
              <p className="feature-label">Live data loop</p>
              <h3>1-second stock simulator</h3>
              <p className="muted-text">
                Prices are generated in memory and pushed through WebSockets, so
                every subscribed dashboard updates asynchronously.
              </p>
            </article>

            <article className="feature-card">
              <p className="feature-label">Multi-user behavior</p>
              <h3>Filtered by subscription</h3>
              <p className="muted-text">
                Two users can stay open at the same time and receive different
                stock streams based on their watchlists.
              </p>
            </article>
          </div>
        </section>

        <section className="login-panel panel panel-emphasis">
          <div className="login-panel-header">
            <p className="section-kicker">Access dashboard</p>
            <h2>Continue with email</h2>
            <p className="muted-text">
              This build uses a streamlined approach: no separate sign-up,
              password, or email verification flow. First login creates the
              account, later logins reuse it.
            </p>
          </div>

          <form className="stack" onSubmit={handleSubmit}>
            <div>
              <label className="field-label" htmlFor="email">
                Email address
              </label>
              <input
                id="email"
                className="text-input"
                type="email"
                autoComplete="email"
                placeholder="user@example.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
              <p className="input-help">
                Try any valid address such as <strong>trader@example.com</strong>.
              </p>
            </div>

            {error ? <div className="alert alert-error">{error}</div> : null}

            <div className="button-row">
              <button className="button button-primary button-block" type="submit" disabled={loading}>
                {loading ? "Opening dashboard..." : "Open dashboard"}
              </button>
            </div>
          </form>

          <div className="login-note">
            <span className="login-note-title">Why no verification?</span>
            <p className="muted-text">
              To provide frictionless onboarding, we create the user if they
              do not exist and log them in by email. That is why this app keeps
              auth intentionally simple.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}

export default LoginPage;
