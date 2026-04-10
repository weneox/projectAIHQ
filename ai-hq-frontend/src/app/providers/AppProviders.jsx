import { useState } from "react";
import { App as AntApp, Button, ConfigProvider, Result } from "antd";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ErrorBoundary } from "react-error-boundary";
import { Toaster } from "sonner";
import { getAntdTheme } from "../theme/antdTheme.js";

function AppErrorFallback({ error, resetErrorBoundary }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas px-6 py-10">
      <div className="w-full max-w-[760px] overflow-hidden rounded-[24px] border border-line bg-surface shadow-panel-strong">
        <div className="h-1.5 w-full bg-[linear-gradient(90deg,rgb(var(--color-brand)),rgba(var(--color-brand),0.34),transparent)]" />
        <div className="p-4 sm:p-5">
          <Result
            status="error"
            title="The app hit an unexpected error"
            subTitle={
              error?.message || "Refresh the page or retry to continue working."
            }
            extra={[
              <Button
                key="retry"
                type="primary"
                size="large"
                onClick={resetErrorBoundary}
              >
                Retry
              </Button>,
              <Button
                key="reload"
                size="large"
                onClick={() => window.location.reload()}
              >
                Reload page
              </Button>,
            ]}
          />
        </div>
      </div>
    </div>
  );
}

export default function AppProviders({ children }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            retry: 1,
            refetchOnWindowFocus: false,
            staleTime: 30_000,
          },
          mutations: {
            retry: 0,
          },
        },
      })
  );

  return (
    <ErrorBoundary FallbackComponent={AppErrorFallback}>
      <QueryClientProvider client={queryClient}>
        <ConfigProvider theme={getAntdTheme()} componentSize="middle">
          <AntApp>
            {children}
            <Toaster
              position="top-right"
              closeButton
              expand={false}
              visibleToasts={5}
              richColors={false}
              toastOptions={{
                classNames: {
                  toast: "sonner-toast",
                  title: "sonner-toast-title",
                  description: "sonner-toast-description",
                },
              }}
            />
          </AntApp>
        </ConfigProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}