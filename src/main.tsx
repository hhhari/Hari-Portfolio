import React, { lazy, Suspense, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import "./fonts.css";
import { Provider } from "./store";
import { authInit } from "./repository";
import Public from "./public";
import "./styles.css";
const Admin = lazy(() => import("./admin"));
function App() {
  const [route, setRoute] = useState(location.hash.slice(1) || "/"),
    [ready, setReady] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    authInit()
      .catch((e) => setError(e.message))
      .finally(() => {
        setRoute(location.hash.slice(1) || "/");
        setReady(true);
      });
    const fn = () => {
      setRoute(location.hash.slice(1) || "/");
      window.scrollTo(0, 0);
    };
    window.addEventListener("hashchange", fn);
    return () => window.removeEventListener("hashchange", fn);
  }, []);
  if (!ready)
    return (
      <div className="boot">
        Preparing the next frame<span>•</span>
      </div>
    );
  const admin = route.startsWith("/admin");
  return (
    <Provider key={admin ? "admin" : "public"} admin={admin}>
      {error && (
        <div role="alert" className="alert">
          Sign-in could not finish: {error}
        </div>
      )}
      <Suspense fallback={<div className="boot">Opening the studio…</div>}>
        {admin ? <Admin route={route} /> : <Public route={route} />}
      </Suspense>
    </Provider>
  );
}
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: string }
> {
  state = { error: "" };
  static getDerivedStateFromError(e: Error) {
    return { error: e.message };
  }
  render() {
    return this.state.error ? (
      <main className="empty">
        <h1>This frame needs another take.</h1>
        <p>{this.state.error}</p>
        <button onClick={() => location.reload()}>Reload website</button>
      </main>
    ) : (
      this.props.children
    );
  }
}
createRoot(document.getElementById("root")!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>,
);
