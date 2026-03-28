import React, { createContext, useContext, useMemo, useState } from "react";

const RouterLocationContext = createContext(null);

function normalizeToString(value) {
  if (typeof value === "string") return value;
  if (value && typeof value === "object") {
    return `${value.pathname || "/"}${value.search || ""}${value.hash || ""}`;
  }
  return "/";
}

function parseLocation(to, state = null) {
  const raw = normalizeToString(to);
  const base =
    typeof window !== "undefined" && window.location?.origin
      ? window.location.origin
      : "http://localhost";
  const url = new URL(raw, base);

  return {
    pathname: url.pathname || "/",
    search: url.search || "",
    hash: url.hash || "",
    state,
    key: "mock",
  };
}

function readWindowLocation() {
  if (typeof window === "undefined" || !window.location) {
    return {
      pathname: "/",
      search: "",
      hash: "",
      state: null,
      key: "mock",
    };
  }

  return {
    pathname: window.location.pathname || "/",
    search: window.location.search || "",
    hash: window.location.hash || "",
    state: window.history?.state ?? null,
    key: "mock",
  };
}

function buildHref(to) {
  return normalizeToString(to);
}

function isActivePath(currentLocation, to) {
  const target = parseLocation(to);
  return (
    currentLocation.pathname === target.pathname &&
    currentLocation.search === target.search
  );
}

function RouterProviderBase({ children, initialLocation }) {
  const [location, setLocation] = useState(initialLocation || readWindowLocation());

  const api = useMemo(
    () => ({
      location,
      navigate(to, options = {}) {
        const nextLocation = parseLocation(to, options.state ?? null);
        const href = `${nextLocation.pathname}${nextLocation.search}${nextLocation.hash}`;

        if (typeof window !== "undefined" && window.history) {
          if (options.replace) {
            window.history.replaceState(nextLocation.state, "", href);
          } else {
            window.history.pushState(nextLocation.state, "", href);
          }
        }

        setLocation(nextLocation);
      },
    }),
    [location]
  );

  return (
    <RouterLocationContext.Provider value={api}>
      {children}
    </RouterLocationContext.Provider>
  );
}

function useRouterApi() {
  return useContext(RouterLocationContext) || {
    location: readWindowLocation(),
    navigate() {},
  };
}

export function MemoryRouter({
  children,
  initialEntries = ["/"],
  initialIndex = 0,
}) {
  const entry =
    initialEntries[Math.min(initialIndex, Math.max(initialEntries.length - 1, 0))] ||
    "/";

  return (
    <RouterProviderBase initialLocation={parseLocation(entry)}>
      {children}
    </RouterProviderBase>
  );
}

export function BrowserRouter({ children }) {
  return <RouterProviderBase initialLocation={readWindowLocation()}>{children}</RouterProviderBase>;
}

export function HashRouter({ children }) {
  return <RouterProviderBase initialLocation={readWindowLocation()}>{children}</RouterProviderBase>;
}

export function Router({ children, location }) {
  return (
    <RouterProviderBase initialLocation={location ? parseLocation(location) : readWindowLocation()}>
      {children}
    </RouterProviderBase>
  );
}

export function RouterProvider({ children }) {
  return <RouterProviderBase initialLocation={readWindowLocation()}>{children}</RouterProviderBase>;
}

export function HydratedRouter({ children }) {
  return <RouterProviderBase initialLocation={readWindowLocation()}>{children}</RouterProviderBase>;
}

export function Routes({ children }) {
  return <>{children}</>;
}

export function Route({ element, children }) {
  return element ?? children ?? null;
}

export function Outlet() {
  return null;
}

export function Navigate({ to, replace = false, state = null }) {
  const { navigate } = useRouterApi();
  React.useEffect(() => {
    navigate(to, { replace, state });
  }, [navigate, replace, state, to]);
  return null;
}

export function Link({ to, children, onClick, ...props }) {
  return (
    <a
      href={buildHref(to)}
      onClick={(event) => {
        onClick?.(event);
      }}
      {...props}
    >
      {children}
    </a>
  );
}

export function NavLink({ to, children, className, ...props }) {
  const { location } = useRouterApi();
  const state = {
    isActive: isActivePath(location, to),
    isPending: false,
    isTransitioning: false,
  };

  const resolvedClassName =
    typeof className === "function" ? className(state) : className;
  const resolvedChildren =
    typeof children === "function" ? children(state) : children;

  return (
    <a href={buildHref(to)} className={resolvedClassName} {...props}>
      {resolvedChildren}
    </a>
  );
}

export function useNavigate() {
  const { navigate } = useRouterApi();
  return navigate;
}

export function useLocation() {
  return useRouterApi().location;
}

export function useParams() {
  return {};
}

export function useSearchParams() {
  const { location, navigate } = useRouterApi();
  const params = useMemo(
    () => new URLSearchParams(location.search || ""),
    [location.search]
  );

  function setSearchParams(nextInit, options = {}) {
    const nextParams = new URLSearchParams(nextInit);
    navigate(
      `${location.pathname}?${nextParams.toString()}${location.hash || ""}`,
      options
    );
  }

  return [params, setSearchParams];
}

export function useMatch() {
  return null;
}

export function useResolvedPath(to) {
  return parseLocation(to);
}

export function useHref(to) {
  return buildHref(to);
}

export function useInRouterContext() {
  return true;
}

export function createSearchParams(init) {
  return new URLSearchParams(init);
}

export function createPath({ pathname = "/", search = "", hash = "" } = {}) {
  return `${pathname}${search}${hash}`;
}

export function generatePath(path, params = {}) {
  return String(path).replace(/:([A-Za-z0-9_]+)/g, (_, key) => {
    return params[key] ?? `:${key}`;
  });
}

export function redirect(to, init) {
  return { to, init: init || null };
}

export function matchPath() {
  return null;
}

export function createMemoryRouter() {
  return {
    navigate() {},
    subscribe() {
      return () => {};
    },
    state: {},
  };
}

export function createRoutesFromElements(children) {
  return children;
}

export const UNSAFE_NavigationContext = React.createContext(null);
export const UNSAFE_LocationContext = React.createContext(null);
export const UNSAFE_RouteContext = React.createContext({
  outlet: null,
  matches: [],
  isDataRoute: false,
});