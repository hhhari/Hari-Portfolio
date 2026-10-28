import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import * as repo from "./repository";
import { asset, baseSettings, mediaIds } from "./content";
import type { ContentDoc, Role, Settings } from "./types";
interface Store {
  docs: ContentDoc[];
  settings: Settings;
  loading: boolean;
  error: string;
  urls: Record<string, string>;
  refresh: () => Promise<void>;
  resolve: (s: string) => string;
  srcSet: (s: string) => string | undefined;
  alt: (s: string, fallback: string) => string;
  role: Role | null;
  notify: (s: string) => void;
  notice: string;
}
const Context = createContext<Store>(null!);
export function useStore() {
  return useContext(Context);
}
export function Provider({
  children,
  admin = false,
}: {
  children: ReactNode;
  admin?: boolean;
}) {
  const [docs, setDocs] = useState<ContentDoc[]>([]),
    [urls, setUrls] = useState<Record<string, string>>({}),
    [metadata, setMetadata] = useState<repo.ResolvedMedia["meta"]>({}),
    [role, setRole] = useState<Role | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const notify = useCallback((s: string) => setNotice(s), []);
  const refresh = useCallback(async () => {
    try {
      setError("");
      const role = admin ? await repo.getRole() : null;
      setRole(role);
      const docs = await repo.loadDocs(admin && !!role);
      setDocs(docs);
      const ids = mediaIds(docs.map((d) => d.data));
      const resolved = await repo.resolveMedia(ids, admin && !!role);
      const mapping = resolved.urls;
      setMetadata(resolved.meta);
      setUrls((old) => {
        Object.values(old)
          .filter((s) => s.startsWith("blob:"))
          .forEach(URL.revokeObjectURL);
        return mapping;
      });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [admin]);
  useEffect(() => {
    void refresh();
    const changed = () => void refresh();
    const visible = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    window.addEventListener("kinetic-change", changed);
    window.addEventListener("focus", changed);
    document.addEventListener("visibilitychange", visible);
    const bc = new BroadcastChannel("kinetic-cms");
    bc.onmessage = changed;
    const timer = window.setInterval(() => {
      if (!admin && document.visibilityState === "visible") void refresh();
    }, 60000);
    return () => {
      window.removeEventListener("kinetic-change", changed);
      window.removeEventListener("focus", changed);
      document.removeEventListener("visibilitychange", visible);
      bc.close();
      clearInterval(timer);
    };
  }, [refresh, admin]);
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(""), 5500);
    return () => clearTimeout(t);
  }, [notice]);
  const settings =
    (docs.find((d) => d.kind === "settings")?.data as Settings) ?? baseSettings;
  const resolve = (s: string) =>
    s.startsWith("art:")
      ? asset(s.slice(4))
      : s.startsWith("media:")
        ? (urls[s.slice(6)] ?? "")
        : s.startsWith("https://") || s.startsWith("blob:")
          ? s
          : "";
  const srcSet = (s: string) =>
    s.startsWith("media:")
      ? [640, 1200]
          .map((w) =>
            urls[s.slice(6) + ":" + w]
              ? `${urls[s.slice(6) + ":" + w]} ${w}w`
              : "",
          )
          .filter(Boolean)
          .concat(
            urls[s.slice(6)]
              ? [
                  `${urls[s.slice(6)]} ${Math.min(2200, metadata[s.slice(6)]?.width || 2200)}w`,
                ]
              : [],
          )
          .join(", ")
      : undefined;
  const alt = (s: string, fallback: string) =>
    s.startsWith("media:") ? metadata[s.slice(6)]?.alt || fallback : fallback;
  return (
    <Context.Provider
      value={{
        docs,
        settings,
        loading,
        error,
        urls,
        refresh,
        resolve,
        srcSet,
        alt,
        role,
        notify,
        notice,
      }}
    >
      {children}
      {notice && (
        <div className="toast" role="status">
          {notice}
          <button
            aria-label="Dismiss notification"
            onClick={() => setNotice("")}
          >
            ×
          </button>
        </div>
      )}
    </Context.Provider>
  );
}
export function broadcast() {
  window.dispatchEvent(new Event("kinetic-change"));
  const bc = new BroadcastChannel("kinetic-cms");
  bc.postMessage("refresh");
  bc.close();
}
