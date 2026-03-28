import React from "react";

function passthrough({ children }) {
  return <>{children}</>;
}

function buildHref(to) {
  if (typeof to === "string") return to || "/";
  if (to && typeof to === "object") {
    return `${to.pathname || "/"}${to.search || ""}${to.hash || ""}`;
  }
  return "/";
}

export const MemoryRouter = passthrough;
export const BrowserRouter = passthrough;
export const HashRouter = passthrough;
export const Router = passthrough;
export const RouterProvider = passthrough;
export const HydratedRouter = passthrough;
export const Routes = passthrough;
export const Route = passthrough;
export const Outlet = () => null;

export function Navigate() {
  return null;
}

export function Link({ to, children, ...props }) {
  return (
    <a href={buildHref(to)} {...props}>
      {children}
    </a>
  );
}

export function NavLink({ to, children, className, ...props }) {
  const state = { isActive: false, isPending: false, isTransitioning: false };
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
  return () => {};
}

export function useLocation() {
  return {
    pathname: "/",
    search: "",
    hash: "",
    state: null,
    key: "default",
  };
}

export function useParams() {
  return {};
}

export function useSearchParams() {
  return [new URLSearchParams(), () => {}];
}

export function useMatch() {
  return null;
}

export function useResolvedPath(to) {
  return {
    pathname: buildHref(to),
    search: "",
    hash: "",
  };
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
  return {
    to,
    init: init || null,
  };
}

export function matchPath() {
  return null;
}

export const UNSAFE_NavigationContext = React.createContext(null);
export const UNSAFE_LocationContext = React.createContext(null);
export const UNSAFE_RouteContext = React.createContext({
  outlet: null,
  matches: [],
  isDataRoute: false,
});