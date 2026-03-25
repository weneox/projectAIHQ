import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const listDurableExecutions = vi.fn();
const getDurableExecutionSummary = vi.fn();
const getDurableExecution = vi.fn();
const retryDurableExecution = vi.fn();

vi.mock("../api/executions.js", () => ({
  listDurableExecutions: (...args) => listDurableExecutions(...args),
  getDurableExecutionSummary: (...args) => getDurableExecutionSummary(...args),
  getDurableExecution: (...args) => getDurableExecution(...args),
  retryDurableExecution: (...args) => retryDurableExecution(...args),
}));

import Executions from "./Executions.jsx";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

beforeEach(() => {
  listDurableExecutions.mockResolvedValue([
    {
      id: "exec-1",
      tenant_key: "acme",
      tenant_id: "tenant-1",
      provider: "meta",
      channel: "instagram",
      action_type: "meta.outbound.send",
      target_id: "thread-1",
      status: "retryable",
      attempt_count: 2,
      max_attempts: 5,
      created_at: "2026-03-26T10:00:00.000Z",
      updated_at: "2026-03-26T10:01:00.000Z",
      next_retry_at: "2026-03-26T10:05:00.000Z",
      payload_summary: {
        text: "hello",
      },
      last_error_message: "temporary failure",
    },
  ]);

  getDurableExecutionSummary.mockResolvedValue({
    counts: {
      pending: 0,
      in_progress: 1,
      succeeded: 10,
      retryable: 1,
      terminal: 0,
      dead_lettered: 2,
    },
    oldestRetryable: {
      id: "exec-1",
      next_retry_at: "2026-03-26T10:05:00.000Z",
    },
    oldestInProgress: {
      id: "exec-2",
      last_attempt_at: "2026-03-26T09:59:00.000Z",
    },
    deadLetterCount: 2,
    worker: {
      enabled: true,
      running: true,
      lastClaimAt: "2026-03-26T10:02:00.000Z",
    },
    sourceSyncWorker: {
      enabled: true,
      running: false,
      lastHeartbeatAt: "2026-03-26T10:01:30.000Z",
    },
    operational: {
      status: "attention",
      alerts: [
        {
          code: "retryable_backlog",
          message: "Retryable backlog is above the attention threshold.",
        },
      ],
      recentSignals: {
        realtimeAuthFailures: 1,
        sourceSyncAttentionEvents: 0,
      },
      workers: {
        durableExecution: {
          health: {
            status: "running",
          },
        },
        sourceSync: {
          health: {
            status: "idle",
          },
        },
      },
    },
  });

  getDurableExecution.mockResolvedValue({
    execution: {
      id: "exec-1",
      tenant_key: "acme",
      provider: "meta",
      channel: "instagram",
      action_type: "meta.outbound.send",
      status: "retryable",
      target_id: "thread-1",
      created_at: "2026-03-26T10:00:00.000Z",
      next_retry_at: "2026-03-26T10:05:00.000Z",
      payload_summary: {
        text: "hello",
      },
      last_error_message: "temporary failure",
      last_error_code: "http_503",
      last_error_classification: "retryable_gateway_failure",
    },
    attempts: [
      {
        id: "attempt-2",
        attempt_number: 2,
        status_from: "retryable",
        status_to: "retryable",
        started_at: "2026-03-26T10:01:00.000Z",
        error_message: "temporary failure",
      },
    ],
    auditTrail: [
      {
        id: "audit-1",
        action: "durable_execution.manual_retry",
        actor: "operator@acme.test",
        created_at: "2026-03-26T10:03:00.000Z",
        meta: {
          requestedBy: "operator@acme.test",
        },
      },
    ],
  });

  retryDurableExecution.mockResolvedValue({
    execution: {
      id: "exec-1",
      status: "pending",
    },
    auditTrail: [
      {
        id: "audit-2",
        action: "durable_execution.manual_retry",
        actor: "operator@acme.test",
        created_at: "2026-03-26T10:06:00.000Z",
        meta: {
          requestedBy: "operator@acme.test",
        },
      },
    ],
  });
});

describe("Executions durable surface", () => {
  it("renders summary, detail, and manual retry flow", async () => {
    render(<Executions />);

    expect(await screen.findByText(/operator execution surface/i)).toBeInTheDocument();
    const summarySection = screen.getByText(/worker health/i).closest("section");
    expect(summarySection).not.toBeNull();
    expect(within(summarySection).getByText("Dead-lettered")).toBeInTheDocument();
    expect(within(summarySection).getByText(/attention needed/i)).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: /meta\.outbound\.send/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /meta.outbound.send/i }));

    expect(await screen.findByText(/manual retry audit/i)).toBeInTheDocument();
    const auditSection = screen.getByText(/manual retry audit/i).closest("section");
    expect(auditSection).not.toBeNull();
    expect(within(auditSection).getByText(/actor:\s*operator@acme\.test/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /manual retry/i }));

    await waitFor(() => {
      expect(retryDurableExecution).toHaveBeenCalledWith("exec-1");
    });
  });

  it("shows honest loading and error states", async () => {
    listDurableExecutions.mockRejectedValueOnce(new Error("backend unavailable"));
    render(<Executions />);

    expect(await screen.findByText(/backend unavailable/i)).toBeInTheDocument();
  });
});
