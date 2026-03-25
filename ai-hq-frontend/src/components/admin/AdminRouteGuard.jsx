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
    return (
      <div className="min-h-screen bg-[#02050c] px-4 py-10 text-white">
        <div className="mx-auto max-w-md rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-slate-300">
          Admin auth yoxlanılır...
        </div>
      </div>
    );
  }

  if (!authed) {
    return <Navigate to="/admin/login" replace state={{ from: location }} />;
  }

  return children;
}