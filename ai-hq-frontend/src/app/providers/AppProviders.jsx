import { ConfigProvider, App as AntApp, Button, Result } from "antd";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ErrorBoundary } from "react-error-boundary";
import { Toaster } from "sonner";
import { useState } from "react";
import { getAntdTheme } from "../theme/tokens.js";

function AppErrorFallback({ error, resetErrorBoundary }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas px-6 py-12">
      <div className="w-full max-w-[720px] rounded-[32px] border border-line bg-surface p-4 shadow-panel">
        <Result
          status="error"
          title="The app hit an unexpected error"
          subTitle={
            error?.message || "Refresh the page or retry to continue working."
          }
          extra={[
            <Button key="retry" type="primary" size="large" onClick={resetErrorBoundary}>
              Retry
            </Button>,
            <Button key="reload" size="large" onClick={() => window.location.reload()}>
              Reload page
            </Button>,
          ]}
        />
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
        <ConfigProvider theme={getAntdTheme()}>
          <AntApp>
            {children}
            <Toaster
              position="top-right"
              closeButton
              expand={false}
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
