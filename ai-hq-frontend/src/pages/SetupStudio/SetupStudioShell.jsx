import { Link } from "react-router-dom";

export default function SetupStudioShell({ children }) {
  return (
    <div className="min-h-screen bg-transparent text-slate-950 antialiased">
      <div className="sticky top-0 z-20 flex justify-end px-4 pt-4 sm:px-6 lg:px-8">
        <Link
          to="/workspace"
          className="inline-flex items-center rounded-full border border-white/70 bg-white/80 px-4 py-2 text-sm font-medium text-slate-700 shadow-[0_10px_30px_rgba(15,23,42,0.08)] backdrop-blur transition hover:border-white hover:bg-white hover:text-slate-950"
        >
          Open workspace
        </Link>
      </div>
      {children}
    </div>
  );
}
