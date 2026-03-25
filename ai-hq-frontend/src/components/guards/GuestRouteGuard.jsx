import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { getAuthMe } from "../../api/auth.js";

export default function GuestRouteGuard({ children }) {
  const [state, setState] = useState({
    checked: false,
    ok: false,
  });

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        const j = await getAuthMe();
        if (!alive) return;

        setState({
          checked: true,
          ok: !!j?.authenticated,
        });
      } catch {
        if (!alive) return;

        setState({
          checked: true,
          ok: false,
        });
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  if (state.checked && state.ok) {
    return <Navigate to="/" replace />;
  }

  return children;
}