import { useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { SETUP_WIDGET_ROUTE } from "../../lib/appEntry.js";

function s(value, fallback = "") {
  return String(value ?? fallback).trim();
}

export default function FloatingAiWidget({
  hidden = false,
  open = false,
  onOpenChange,
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const redirectedRef = useRef(false);

  useEffect(() => {
    if (hidden) {
      redirectedRef.current = false;
      return;
    }

    if (!open) {
      redirectedRef.current = false;
      return;
    }

    const currentPath = `${s(location.pathname)}${s(location.search)}`;
    const targetPath = s(SETUP_WIDGET_ROUTE);

    if (!targetPath) {
      if (typeof onOpenChange === "function") {
        onOpenChange(false);
      }
      redirectedRef.current = false;
      return;
    }

    if (currentPath === targetPath) {
      if (typeof onOpenChange === "function") {
        onOpenChange(false);
      }
      redirectedRef.current = false;
      return;
    }

    if (redirectedRef.current) return;
    redirectedRef.current = true;

    navigate(targetPath);

    if (typeof onOpenChange === "function") {
      onOpenChange(false);
    }
  }, [hidden, open, onOpenChange, navigate, location.pathname, location.search]);

  return null;
}