import { createContext, useContext, useEffect, useState } from "react";
import { useRouter } from "next/router";
import Head from "next/head";
import "../styles/globals.css";
import "../styles/redesign.css";
import Navbar from "../components/Navbar";
import RouteShell from "../components/RouteShell";
import ErrorBoundary from "../components/ErrorBoundary";
import { AdminAuthProvider } from "../hooks/AdminAuthContext";
import i18n, { SUPPORTED_LOCALES } from "../i18n";
import { isAdminRoute } from "../config/routes";

export const ThemeContext = createContext({ dark: false, toggle: () => {} });
export const useTheme = () => useContext(ThemeContext);

export default function MyApp({ Component, pageProps }) {
  const { pathname } = useRouter();
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("theme");
    if (saved === "dark") {
      setDark(true);
    } else if (saved === "light") {
      setDark(false);
    } else {
      setDark(window.matchMedia("(prefers-color-scheme: dark)").matches);
    }
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    document.documentElement.classList.toggle("light", !dark);
    localStorage.setItem("theme", dark ? "dark" : "light");
  }, [dark]);

  return (
    <AdminAuthProvider>
      <ThemeContext.Provider value={{ dark, toggle: () => setDark((d) => !d) }}>
        <Head>
          <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
        </Head>
        <Navbar />
        <ErrorBoundary>
          {/* #1579 — admin guard + layout are applied centrally by route. */}
          <RouteShell pathname={pathname}>
            <Component {...pageProps} />
          </RouteShell>
        </ErrorBoundary>
      </ThemeContext.Provider>
    </AdminAuthProvider>
  );
}

MyApp.getInitialProps = async ({ Component, ctx }) => {
  const pageProps = await (Component.getInitialProps
    ? Component.getInitialProps(ctx)
    : {});

  // #1385 — robots.txt only asks crawlers not to fetch these URLs; a page
  // that's still linked from somewhere else can get indexed anyway without
  // an explicit noindex signal. ADMIN_ROUTES (config/routes.js) is exactly
  // the set of authenticated admin pages, so it doubles as the noindex list.
  if (ctx.res && isAdminRoute(ctx.pathname)) {
    ctx.res.setHeader("X-Robots-Tag", "noindex");
  }

  const acceptLang = ctx.req?.headers?.["accept-language"] || "";
  const primary = acceptLang
    .split(",")[0]
    .trim()
    .split(";")[0]
    .split("-")[0]
    .toLowerCase();
  if (primary && SUPPORTED_LOCALES.includes(primary)) {
    i18n.changeLanguage(primary);
  }

  return { pageProps };
};
