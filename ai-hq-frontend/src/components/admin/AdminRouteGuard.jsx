import { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { getAdminAuthMe } from "../../api/adminAuth.js";

export default function AdminRouteGuard({ children }) {
  const location = useLocation();
  const [loading, setLoading] = useState(true);
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    let alive = true;

    getAdminAuthMe()
      .then((j) => {
        if (!alive) return;
        setAuthed(!!j?.authenticated?.admin);
      })
      .catch(() => {
        if (!alive) return;
        setAuthed(false);
      })
      .finally(() => {
        if (!alive) return;
        setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [location.pathname]);

  if (loading) {
    return null;
  }

  if (!authed) {
    return <Navigate to="/admin/login" replace state={{ from: location }} />;
  }

  return children;
}
