import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

const RouterContext = createContext(null);
const ParamsContext = createContext({});

function normalizeSearch(value = "") {
  const text = String(value || "").trim();
  if (!text) return "";
  return text.startsWith("?") ? text : `?${text}`;
}

function normalizeHash(value = "") {
  const text = String(value || "").trim();
  if (!text) return "";
  return text.startsWith("#") ? text : `#${text}`;
}

function buildKey() {
  return Math.random().toString(36).slice(2, 10);
}

function normalizeEntry(entry = "/") {
  if (typeof entry === "string") {
    const url = new URL(entry, "https://smoke-router.test");
    return {
      pathname: url.pathname || "/",
      search: url.search || "",
      hash: url.hash || "",
      state: null,
      key: buildKey(),
    };
  }

  if (entry && typeof entry === "object") {
    return {
      pathname: String(entry.pathname || "/"),
      search: normalizeSearch(entry.search || ""),
      hash: normalizeHash(entry.hash || ""),
      state: entry.state ?? null,
      key: entry.key || buildKey(),
    };
  }

  return {
    pathname: "/",
    search: "",
    hash: "",
    state: null,
    key: buildKey(),
  };
}

function resolveToLocation(currentLocation, to, stateOverride) {
  if (typeof to === "number") return null;

  if (typeof to === "string") {
    if (to.startsWith("?")) {
      return {
        ...currentLocation,
        search: normalizeSearch(to),
        key: buildKey(),
        state: stateOverride ?? currentLocation.state ?? null,
      };
    }

    if (to.startsWith("#")) {
      return {
        ...currentLocation,
        hash: normalizeHash(to),
        key: buildKey(),
        state: stateOverride ?? currentLocation.state ?? null,
      };
    }

    const base = `https://smoke-router.test${currentLocation.pathname}${currentLocation.search}${currentLocation.hash}`;
    const url = new URL(to, base);

    return {
      pathname: url.pathname || "/",
      search: url.search || "",
      hash: url.hash || "",
      state: stateOverride ?? null,
      key: buildKey(),
    };
  }

  if (to && typeof to === "object") {
    const nextPathname =
      to.pathname != null ? String(to.pathname || "/") : currentLocation.pathname;
    const nextSearch =
      to.search != null
        ? normalizeSearch(to.search)
        : to.pathname != null
          ? ""
          : currentLocation.search;
    const nextHash =
      to.hash != null
        ? normalizeHash(to.hash)
        : to.pathname != null
          ? ""
          : currentLocation.hash;

    return {
      pathname: nextPathname || "/",
      search: nextSearch,
      hash: nextHash,
      state:
        stateOverride !== undefined
          ? stateOverride
          : to.state !== undefined
            ? to.state
            : currentLocation.state ?? null,
      key: buildKey(),
    };
  }

  return {
    ...currentLocation,
    key: buildKey(),
    state: stateOverride ?? currentLocation.state ?? null,
  };
}

function locationToHref(location) {
  return `${location.pathname || "/"}${location.search || ""}${location.hash || ""}`;
}

function buildPathRegex(path = "/") {
  if (!path || path === "/") {
    return {
      regex: /^\/$/,
      paramNames: [],
    };
  }

  const parts = String(path)
    .split("/")
    .filter(Boolean);

  const paramNames = [];
  const regexParts = parts.map((part) => {
    if (part === "*") {
      paramNames.push("*");
      return "(.*)";
    }
    if (part.startsWith(":")) {
      paramNames.push(part.slice(1));
      return "([^/]+)";
    }
    return part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  });

  return {
    regex: new RegExp(`^/${regexParts.join("/")}/?$`),
    paramNames,
  };
}

function matchRoutePath(pathname = "/", path = "/") {
  if (path == null) return { params: {} };
  const { regex, paramNames } = buildPathRegex(path);
  const match = regex.exec(pathname);

  if (!match) return null;

  const params = {};
  for (let i = 0; i < paramNames.length; i += 1) {
    params[paramNames[i]] = decodeURIComponent(match[i + 1] || "");
  }

  return { params };
}

function resolveChildrenForRoutes(children, pathname) {
  const childArray = React.Children.toArray(children);

  for (const child of childArray) {
    if (!React.isValidElement(child)) continue;

    const { path, index, element, children: nestedChildren } = child.props || {};

    if (index) {
      if (pathname === "/" || pathname === "") {
        return { node: element ?? nestedChildren ?? null, params: {} };
      }
      continue;
    }

    const matched = matchRoutePath(pathname, path);
    if (!matched) continue;

    return {
      node: element ?? nestedChildren ?? null,
      params: matched.params,
    };
  }

  return { node: null, params: {} };
}

function useRouterContext() {
  const value = useContext(RouterContext);
  if (!value) {
    throw new Error("react-router-dom.smoke-mock: router context is unavailable");
  }
  return value;
}

function createMockRouter(initialEntries = ["/"], initialIndex) {
  const normalizedEntries = (Array.isArray(initialEntries) && initialEntries.length
    ? initialEntries
    : ["/"]
  ).map((entry) => normalizeEntry(entry));

  let currentIndex =
    typeof initialIndex === "number"
      ? Math.min(Math.max(initialIndex, 0), normalizedEntries.length - 1)
      : normalizedEntries.length - 1;

  let entries = normalizedEntries.slice();
  const listeners = new Set();

  function notify() {
    listeners.forEach((listener) => listener());
  }

  function getLocation() {
    return entries[currentIndex] || normalizeEntry("/");
  }

  function navigate(to, options = {}) {
    if (typeof to === "number") {
      const nextIndex = Math.min(
        Math.max(currentIndex + to, 0),
        entries.length - 1
      );
      if (nextIndex !== currentIndex) {
        currentIndex = nextIndex;
        notify();
      }
      return Promise.resolve();
    }

    const nextLocation = resolveToLocation(getLocation(), to, options.state);
    if (!nextLocation) return Promise.resolve();

    if (options.replace) {
      entries[currentIndex] = nextLocation;
    } else {
      entries = entries.slice(0, currentIndex + 1).concat(nextLocation);
      currentIndex = entries.length - 1;
    }

    notify();
    return Promise.resolve();
  }

  return {
    get state() {
      return {
        location: getLocation(),
        historyAction: "POP",
        navigation: { state: "idle" },
        matches: [],
        initialized: true,
      };
    },
    routes: [],
    navigate,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    dispose() {
      listeners.clear();
    },
    revalidate() {},
    initialize() {
      return this;
    },
  };
}

export function MemoryRouter({
  initialEntries = ["/"],
  initialIndex,
  children,
}) {
  const normalizedEntries = useMemo(
    () => initialEntries.map((entry) => normalizeEntry(entry)),
    [initialEntries]
  );

  const startIndex = useMemo(() => {
    const raw =
      typeof initialIndex === "number"
        ? initialIndex
        : normalizedEntries.length - 1;
    return Math.min(Math.max(raw, 0), Math.max(normalizedEntries.length - 1, 0));
  }, [initialIndex, normalizedEntries.length]);

  const [history, setHistory] = useState(() => ({
    entries: normalizedEntries.length
      ? normalizedEntries
      : [normalizeEntry("/")],
    index: startIndex,
  }));

  const location = history.entries[history.index] || normalizeEntry("/");

  const navigate = useCallback((to, options = {}) => {
    if (typeof to === "number") {
      setHistory((current) => {
        const nextIndex = Math.min(
          Math.max(current.index + to, 0),
          current.entries.length - 1
        );
        if (nextIndex === current.index) return current;
        return {
          ...current,
          index: nextIndex,
        };
      });
      return;
    }

    setHistory((current) => {
      const currentLocation = current.entries[current.index] || normalizeEntry("/");
      const nextLocation = resolveToLocation(
        currentLocation,
        to,
        options.state
      );

      if (!nextLocation) return current;

      if (options.replace) {
        const nextEntries = current.entries.slice();
        nextEntries[current.index] = nextLocation;
        return {
          entries: nextEntries,
          index: current.index,
        };
      }

      const nextEntries = current.entries
        .slice(0, current.index + 1)
        .concat(nextLocation);

      return {
        entries: nextEntries,
        index: nextEntries.length - 1,
      };
    });
  }, []);

  const value = useMemo(
    () => ({
      location,
      navigate,
    }),
    [location, navigate]
  );

  return (
    <RouterContext.Provider value={value}>
      <ParamsContext.Provider value={{}}>
        {children}
      </ParamsContext.Provider>
    </RouterContext.Provider>
  );
}

export function BrowserRouter({ children }) {
  const currentEntry =
    typeof window !== "undefined"
      ? `${window.location.pathname || "/"}${window.location.search || ""}${window.location.hash || ""}`
      : "/";

  return <MemoryRouter initialEntries={[currentEntry]}>{children}</MemoryRouter>;
}

export function HashRouter({ children }) {
  return <BrowserRouter>{children}</BrowserRouter>;
}

export function RouterProvider({ router, fallbackElement = null }) {
  const [, forceRender] = useState(0);

  useEffect(() => {
    if (!router?.subscribe) return undefined;
    return router.subscribe(() => {
      forceRender((value) => value + 1);
    });
  }, [router]);

  const location = router?.state?.location || normalizeEntry("/");
  const navigate = useCallback(
    (to, options = {}) => router?.navigate?.(to, options),
    [router]
  );

  const value = useMemo(
    () => ({
      location,
      navigate,
    }),
    [location, navigate]
  );

  if (!router) return fallbackElement;

  return (
    <RouterContext.Provider value={value}>
      <ParamsContext.Provider value={{}}>
        {fallbackElement}
      </ParamsContext.Provider>
    </RouterContext.Provider>
  );
}

export function Routes({ children }) {
  const { location } = useRouterContext();
  const resolved = useMemo(
    () => resolveChildrenForRoutes(children, location.pathname),
    [children, location.pathname]
  );

  return (
    <ParamsContext.Provider value={resolved.params || {}}>
      {resolved.node}
    </ParamsContext.Provider>
  );
}

export function Route() {
  return null;
}

export function Navigate({ to, replace = false, state = null }) {
  const navigate = useNavigate();

  useEffect(() => {
    navigate(to, { replace, state });
  }, [navigate, replace, state, to]);

  return null;
}

export function Outlet() {
  return null;
}

export function useOutlet() {
  return null;
}

export function Link({ to = "", onClick, children, ...rest }) {
  const navigate = useNavigate();
  const href = useHref(to);

  return (
    <a
      {...rest}
      href={href}
      onClick={(event) => {
        onClick?.(event);
        if (event.defaultPrevented) return;
        event.preventDefault();
        navigate(to);
      }}
    >
      {typeof children === "function"
        ? children({ isActive: false, isPending: false })
        : children}
    </a>
  );
}

export function NavLink({
  to = "",
  className,
  style,
  children,
  end = false,
  ...rest
}) {
  const location = useLocation();
  const href = useHref(to);
  const target = useResolvedPath(to);

  const currentPath = location.pathname || "/";
  const targetPath = target.pathname || "/";

  const isActive = end
    ? currentPath === targetPath
    : targetPath === "/"
      ? currentPath === "/"
      : currentPath === targetPath || currentPath.startsWith(`${targetPath}/`);

  const resolvedClassName =
    typeof className === "function"
      ? className({ isActive, isPending: false })
      : className;

  const resolvedStyle =
    typeof style === "function"
      ? style({ isActive, isPending: false })
      : style;

  return (
    <Link
      {...rest}
      to={to}
      className={resolvedClassName}
      style={resolvedStyle}
      href={href}
    >
      {typeof children === "function"
        ? children({ isActive, isPending: false })
        : children}
    </Link>
  );
}

export function Form({ children, onSubmit, ...rest }) {
  return (
    <form
      {...rest}
      onSubmit={(event) => {
        onSubmit?.(event);
        if (!event.defaultPrevented) {
          event.preventDefault();
        }
      }}
    >
      {children}
    </form>
  );
}

export function ScrollRestoration() {
  return null;
}

export function useNavigate() {
  return useRouterContext().navigate;
}

export function useLocation() {
  return useRouterContext().location;
}

export function useSearchParams(defaultInit) {
  const location = useLocation();
  const navigate = useNavigate();

  const searchParams = useMemo(() => {
    const raw = location.search.startsWith("?")
      ? location.search.slice(1)
      : location.search;
    const params = new URLSearchParams(raw);

    if (!raw && defaultInit) {
      const defaults = new URLSearchParams(defaultInit);
      defaults.forEach((value, key) => {
        if (!params.has(key)) params.set(key, value);
      });
    }

    return params;
  }, [defaultInit, location.search]);

  const setSearchParams = useCallback(
    (nextInit, options = {}) => {
      const currentParams = new URLSearchParams(
        location.search.startsWith("?")
          ? location.search.slice(1)
          : location.search
      );

      const resolved =
        typeof nextInit === "function" ? nextInit(currentParams) : nextInit;

      const nextParams = new URLSearchParams(resolved);
      const nextSearch = nextParams.toString();

      navigate(
        {
          pathname: location.pathname,
          search: nextSearch ? `?${nextSearch}` : "",
          hash: location.hash,
        },
        options
      );
    },
    [location.hash, location.pathname, location.search, navigate]
  );

  return [searchParams, setSearchParams];
}

export function useParams() {
  return useContext(ParamsContext) || {};
}

export function useMatch(pattern) {
  const location = useLocation();
  return matchPath(pattern, location.pathname);
}

export function useResolvedPath(to = "") {
  const location = useLocation();
  return resolveToLocation(location, to, location.state);
}

export function useHref(to = "") {
  const resolved = useResolvedPath(to);
  return locationToHref(resolved);
}

export function useNavigationType() {
  return "POP";
}

export function useNavigation() {
  return {
    state: "idle",
    location: null,
    formData: null,
    formMethod: undefined,
    formAction: undefined,
    formEncType: undefined,
  };
}

export function useRouteError() {
  return null;
}

export function useLoaderData() {
  return undefined;
}

export function useActionData() {
  return undefined;
}

export function useRevalidator() {
  return {
    revalidate() {},
    state: "idle",
  };
}

export function matchPath(pattern, pathname) {
  if (typeof pattern === "string") {
    const matched = matchRoutePath(pathname, pattern);
    if (!matched) return null;
    return {
      params: matched.params,
      pathname,
      pattern: { path: pattern },
    };
  }

  const path = pattern?.path || "/";
  const matched = matchRoutePath(pathname, path);
  if (!matched) return null;

  return {
    params: matched.params,
    pathname,
    pattern,
  };
}

export function createSearchParams(init = "") {
  return new URLSearchParams(init);
}

export function generatePath(path = "/", params = {}) {
  return String(path).replace(/:([A-Za-z0-9_]+)/g, (_, key) =>
    params[key] != null ? encodeURIComponent(String(params[key])) : `:${key}`
  );
}

export function createPath(location = {}) {
  return locationToHref(normalizeEntry(location));
}

export function createMemoryRouter(routes = [], options = {}) {
  const router = createMockRouter(
    options.initialEntries || ["/"],
    options.initialIndex
  );
  router.routes = routes;
  return router;
}

export function createBrowserRouter(routes = [], options = {}) {
  return createMemoryRouter(routes, options);
}

export function createRoutesFromElements(children) {
  return React.Children.toArray(children);
}

export function redirect(location, init = 302) {
  return { type: "redirect", location, init };
}

export function replace(location, init = 302) {
  return { type: "replace", location, init };
}

export function defer(value) {
  return value;
}

export function Await({ children, resolve }) {
  if (typeof children === "function") {
    return children(resolve);
  }
  return children ?? null;
}