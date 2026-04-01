import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  AlertCircle,
  ArrowRight,
  Building2,
  Loader2,
  Lock,
  Mail,
  User2,
} from "lucide-react";

import { signupUser } from "../../api/auth.js";
import { clearAppSessionContext, getAppAuthContext } from "../../lib/appSession.js";
import { resolveAuthenticatedLanding } from "../../lib/appEntry.js";

function s(value, fallback = "") {
  return String(value ?? fallback).trim();
}

function getFriendlyError(error, fallback = "Unable to create your account.") {
  return s(
    error?.payload?.error ||
      error?.payload?.message ||
      error?.response?.data?.error ||
      error?.response?.data?.message ||
      error?.message ||
      fallback,
    fallback
  );
}

function resolvePostAuthTarget({ auth = null, payload = {} } = {}) {
  return resolveAuthenticatedLanding({
    auth,
    bootstrap: payload,
  });
}

function AuthField({
  label,
  icon: Icon,
  type = "text",
  name,
  value,
  placeholder,
  onChange,
}) {
  return (
    <label className="block">
      <div className="mb-2 text-[12px] font-medium text-slate-800">{label}</div>
      <div className="flex h-[54px] items-center gap-3 rounded-[14px] border border-[#d8dddd] bg-white px-4 transition focus-within:border-[#0b6870] focus-within:shadow-[0_0_0_1.5px_rgba(11,104,112,.14)]">
        <Icon className="h-4 w-4 text-slate-400" />
        <input
          type={type}
          name={name}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          className="h-full w-full border-0 bg-transparent text-[15px] text-slate-900 outline-none placeholder:text-slate-400"
        />
      </div>
    </label>
  );
}

export default function Signup() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    fullName: "",
    companyName: "",
    email: "",
    password: "",
  });

  function onChange(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
    if (error) setError("");
  }

  async function onSubmit(event) {
    event.preventDefault();
    if (loading) return;

    const payload = {
      fullName: s(form.fullName),
      companyName: s(form.companyName),
      email: s(form.email),
      password: String(form.password || ""),
    };

    if (!payload.companyName || !payload.email || !payload.password) {
      setError("Enter your business name, email, and password.");
      return;
    }

    try {
      setLoading(true);
      setError("");

      const response = await signupUser(payload);
      clearAppSessionContext();

      let auth = null;
      try {
        auth = await getAppAuthContext({ force: true });
      } catch {}

      navigate(
        resolvePostAuthTarget({
          auth,
          payload: response,
        }),
        { replace: true }
      );
    } catch (signupError) {
      setError(getFriendlyError(signupError));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#f6f7f6] px-6 py-10 text-slate-950">
      <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-[1.05fr_.95fr] lg:items-center">
        <div className="order-2 rounded-[30px] bg-[radial-gradient(circle_at_top,_rgba(11,106,113,.16),_transparent_44%),linear-gradient(180deg,#07161c_0%,#0c2730_100%)] p-8 text-white lg:order-1 lg:min-h-[620px] lg:p-10">
          <div className="max-w-[420px]">
            <div className="inline-flex rounded-full border border-white/15 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/72">
              Canonical workspace access
            </div>

            <h1 className="mt-6 text-[34px] font-semibold tracking-[-0.05em]">
              Create your first workspace and enter setup in one flow.
            </h1>

            <p className="mt-4 text-[15px] leading-8 text-white/72">
              Your account becomes the canonical identity, your first business is
              created, and we route you straight into setup or the ready
              workspace.
            </p>

            <div className="mt-8 space-y-4 text-sm text-white/78">
              <div className="rounded-[18px] border border-white/10 bg-white/5 p-4">
                Email and password live on the identity layer, not the old
                company-name login model.
              </div>

              <div className="rounded-[18px] border border-white/10 bg-white/5 p-4">
                Workspace membership is created immediately so switching between
                businesses stays clean later.
              </div>
            </div>
          </div>
        </div>

        <div className="order-1 lg:order-2">
          <div className="mx-auto w-full max-w-[440px] rounded-[28px] border border-white/70 bg-white p-7 shadow-[0_20px_70px_rgba(15,23,42,.08)]">
            <div className="text-[12px] font-semibold uppercase tracking-[0.18em] text-[#0b6a71]">
              Sign up
            </div>

            <h2 className="mt-3 text-[32px] font-semibold tracking-[-0.04em] text-slate-950">
              Start your workspace
            </h2>

            <p className="mt-3 text-[15px] leading-7 text-slate-600">
              Create your identity and first business in the canonical auth
              flow.
            </p>

            {error ? (
              <div className="mt-5 flex items-start gap-3 rounded-[16px] border border-rose-200 bg-rose-50 px-4 py-3 text-rose-900">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <div className="text-sm leading-6">{error}</div>
              </div>
            ) : null}

            <form className="mt-6 space-y-4" onSubmit={onSubmit}>
              <AuthField
                label="Your name"
                icon={User2}
                name="fullName"
                value={form.fullName}
                placeholder="Jane Doe"
                onChange={onChange}
              />

              <AuthField
                label="Business name"
                icon={Building2}
                name="companyName"
                value={form.companyName}
                placeholder="Acme Clinic"
                onChange={onChange}
              />

              <AuthField
                label="Email"
                icon={Mail}
                name="email"
                type="email"
                value={form.email}
                placeholder="owner@acme.com"
                onChange={onChange}
              />

              <AuthField
                label="Password"
                icon={Lock}
                name="password"
                type="password"
                value={form.password}
                placeholder="Create a password"
                onChange={onChange}
              />

              <motion.button
                whileHover={loading ? {} : { y: -1 }}
                whileTap={loading ? {} : { scale: 0.995 }}
                type="submit"
                disabled={loading}
                className="inline-flex h-[54px] w-full items-center justify-center gap-2 rounded-[14px] bg-[#0a5961] px-5 text-[15px] font-semibold text-white transition hover:bg-[#084a51] disabled:cursor-not-allowed disabled:opacity-70"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Creating account...
                  </>
                ) : (
                  <>
                    Create workspace
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </motion.button>
            </form>

            <div className="mt-5 text-center text-[14px] text-slate-500">
              Already have an account?{" "}
              <button
                type="button"
                onClick={() => navigate("/login")}
                className="font-medium text-[#0b6a71] transition hover:text-[#084c52]"
              >
                Sign in
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
