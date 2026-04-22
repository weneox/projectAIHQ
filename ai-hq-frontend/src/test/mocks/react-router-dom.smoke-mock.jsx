import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

const RouterContext = createContext(null);
const RouteContext = createContext({
  outlet: null,
  params: {},
});

function normalizePathname(value = "/") {
  const raw = String(value || "/").trim();
  if (!raw) return "/";

  const withLeadingSlash = raw.startsWith("/") ? raw : `/${raw}`;
  const withoutTrailingSlash = withLeadingSlash.replace(/\/+$/, "");
  return withoutTrailingSlash || "/";
}

function normalizeSearch(value = "") {
  const raw = String(value || "").trim();
  if (!raw) return "";
  return raw.startsWith("?") ? raw : `?${raw}`;
}

function normalizeHash(value = "") {
  const raw = String(value || "").trim();
  if (!raw) return "";
  return raw.startsWith("#") ? raw : `#${raw}`;
}

function buildKey() {
  return Math.random().toString(36).slice(2, 10);
}

function normalizeEntry(entry = "/") {
  if (typeof entry === "string") {
    const url = new URL(entry, "https://smoke-router.test");
    return {
      pathname: normalizePathname(url.pathname),
      search: url.search || "",
      hash: url.hash || "",
      state: null,
      key: buildKey(),
    };
  }

  if (entry && typeof entry === "object") {
    return {
      pathname: normalizePathname(entry.pathname || "/"),
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

    const baseUrl = `https://smoke-router.test${currentLocation.pathname}${currentLocation.search}${currentLocation.hash}`;
    const nextUrl = new URL(to, baseUrl);

    return {
      pathname: normalizePathname(nextUrl.pathname),
      search: nextUrl.search || "",
      hash: nextUrl.hash || "",
      state: stateOverride ?? null,
      key: buildKey(),
    };
  }

  if (to && typeof to === "object") {
    const nextPathname =
      to.pathname != null
        ? normalizePathname(to.pathname || "/")
        : currentLocation.pathname;
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
      pathname: nextPathname,
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

function locationToHref(location = {}) {
  return `${location.pathname || "/"}${location.search || ""}${location.hash || ""}`;
}

function joinRoutePath(basePath = "/", routePath = "") {
  if (!routePath) return normalizePathname(basePath || "/");
  if (routePath.startsWith("/")) return normalizePathname(routePath);

  const base = normalizePathname(basePath || "/");
  return normalizePathname(base === "/" ? `/${routePath}` : `${base}/${routePath}`);
}

function escapeRegex(value = "") {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function matchPathname(pathname = "/", routePath = "/", end = true) {
  const normalizedPathname = normalizePathname(pathname);
  const normalizedRoutePath = normalizePathname(routePath);

  if (normalizedRoutePath === "/" && !end) {
    return { params: {} };
  }

  const parts =
    normalizedRoutePath === "/"
      ? []
      : normalizedRoutePath.slice(1).split("/").filter(Boolean);

  const paramNames = [];
  let source = "^";

  if (parts.length === 0) {
    source += "/";
  } else {
    source += parts
      .map((part) => {
        if (part === "*") {
          paramNames.push("*");
          return "/(.*)";
        }

        if (part.startsWith(":")) {
          paramNames.push(part.slice(1));
          return "/([^/]+)";
        }

        return `/${escapeRegex(part)}`;
      })
      .join("");
  }

  source += end ? "/?$" : "(?:/.*)?$";

  const match = new RegExp(source).exec(normalizedPathname);
  if (!match) return null;

  const params = {};
  paramNames.forEach((name, index) => {
    params[name] = decodeURIComponent(match[index + 1] || "");
  });

  return { params };
}

function toRouteObjects(children) {
  return React.Children.toArray(children)
    .filter(React.isValidElement)
    .map((element) => ({
      path: element.props.path,
      index: Boolean(element.props.index),
      element: element.props.element ?? null,
      children: toRouteObjects(element.props.children),
    }));
}

function matchRouteBranch(routes, pathname, basePath = "/") {
  const normalizedPathname = normalizePathname(pathname);

  for (const route of routes) {
    if (route.index) {
      if (normalizedPathname === normalizePathname(basePath || "/")) {
        return [{ route, params: {} }];
      }
      continue;
    }

    if (route.path == null) {
      const childBranch = matchRouteBranch(
        route.children,
        normalizedPathname,
        basePath
      );

      if (!childBranch) continue;
      return route.element ? [{ route, params: {} }, ...childBranch] : childBranch;
    }

    const absolutePath = joinRoutePath(basePath, route.path);
    const partialMatch = matchPathname(
      normalizedPathname,
      absolutePath,
      route.children.length === 0
    );

    if (!partialMatch) continue;

    if (route.children.length > 0) {
      const childBranch = matchRouteBranch(
        route.children,
        normalizedPathname,
        absolutePath
      );

      if (childBranch) {
        return route.element
          ? [{ route, params: partialMatch.params }, ...childBranch]
          : childBranch;
      }
    }

    return route.element ? [{ route, params: partialMatch.params }] : [];
  }

  return null;
}

function renderRouteBranch(branch = []) {
  let outlet = null;
  let params = {};

  for (let index = branch.length - 1; index >= 0; index -= 1) {
    const current = branch[index];
    params = {
      ...current.params,
      ...params,
    };

    if (!current.route.element) continue;

    outlet = (
      <RouteContext.Provider value={{ outlet, params }}>
        {current.route.element}
      </RouteContext.Provider>
    );
  }

  return outlet;
}

function useRouterContext() {
  const value = useContext(RouterContext);
  if (!value) {
    throw new Error("react-router-dom.smoke-mock: router context is unavailable");
  }
  return value;
}

function useRouteContext() {
  return useContext(RouteContext);
}

export function MemoryRouter({
  initialEntries = ["/"],
  initialIndex,
  children,
}) {
  const seededEntries = useMemo(() => {
    const entries =
      Array.isArray(initialEntries) && initialEntries.length
        ? initialEntries
        : ["/"];

    return entries.map((entry) => normalizeEntry(entry));
  }, [initialEntries]);

  const seededIndex = useMemo(() => {
    const rawIndex =
      typeof initialIndex === "number" ? initialIndex : seededEntries.length - 1;
    return Math.min(Math.max(rawIndex, 0), seededEntries.length - 1);
  }, [initialIndex, seededEntries.length]);

  const [history, setHistory] = useState(() => ({
    entries: seededEntries,
    index: seededIndex,
  }));

  const location = history.entries[history.index] || normalizeEntry("/");

  const navigate = useCallback((to, options = {}) => {
    setHistory((current) => {
      if (typeof to === "number") {
        const nextIndex = Math.min(
          Math.max(current.index + to, 0),
          current.entries.length - 1
        );

        if (nextIndex === current.index) return current;

        return {
          ...current,
          index: nextIndex,
        };
      }

      const currentLocation =
        current.entries[current.index] || normalizeEntry("/");
      const nextLocation = resolveToLocation(currentLocation, to, options.state);

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
      <RouteContext.Provider value={{ outlet: null, params: {} }}>
        {children}
      </RouteContext.Provider>
    </RouterContext.Provider>
  );
}

export function BrowserRouter({ children }) {
  const currentEntry =
    typeof window === "undefined"
      ? "/"
      : `${window.location.pathname || "/"}${window.location.search || ""}${window.location.hash || ""}`;

  return <MemoryRouter initialEntries={[currentEntry]}>{children}</MemoryRouter>;
}

export function Routes({ children }) {
  const { location } = useRouterContext();
  const routes = useMemo(() => toRouteObjects(children), [children]);
  const branch = useMemo(
    () => matchRouteBranch(routes, location.pathname),
    [location.pathname, routes]
  );

  return branch ? renderRouteBranch(branch) : null;
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
  return useRouteContext().outlet;
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

        if (
          event.defaultPrevented ||
          event.button !== 0 ||
          event.metaKey ||
          event.ctrlKey ||
          event.altKey ||
          event.shiftKey
        ) {
          return;
        }

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
  const resolvedTarget = useResolvedPath(to);
  const currentPath = normalizePathname(location.pathname || "/");
  const targetPath = normalizePathname(resolvedTarget.pathname || "/");

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
    >
      {typeof children === "function"
        ? children({ isActive, isPending: false })
        : children}
    </Link>
  );
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
    const rawSearch = location.search.startsWith("?")
      ? location.search.slice(1)
      : location.search;
    const params = new URLSearchParams(rawSearch);

    if (!rawSearch && defaultInit != null) {
      const defaults = new URLSearchParams(defaultInit);
      defaults.forEach((value, key) => {
        if (!params.has(key)) params.set(key, value);
      });
    }

    return params;
  }, [defaultInit, location.search]);

  const setSearchParams = useCallback(
    (nextInit, options = {}) => {
      const current = new URLSearchParams(
        location.search.startsWith("?")
          ? location.search.slice(1)
          : location.search
      );

      const resolved =
        typeof nextInit === "function" ? nextInit(current) : nextInit;
      const nextParams = new URLSearchParams(resolved);

      navigate(
        {
          pathname: location.pathname,
          search: nextParams.toString(),
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
  return useRouteContext().params;
}

export function useResolvedPath(to = "") {
  const location = useLocation();
  return resolveToLocation(location, to, location.state) || location;
}

export function useHref(to = "") {
  return locationToHref(useResolvedPath(to));
}

export function createSearchParams(init = "") {
  return new URLSearchParams(init);
}
