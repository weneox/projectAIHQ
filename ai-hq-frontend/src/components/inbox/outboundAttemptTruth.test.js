import { describe, expect, it } from "vitest";

import {
  getAttemptMessageCorrelation,
  getMessageAttemptCorrelation,
  getMessageOutboundTruth,
  indexAttemptsByMessageCorrelation,
} from "./outboundAttemptTruth.js";

describe("outboundAttemptTruth", () => {
  it("uses object-shaped outbound_attempt_correlation for outbound message binding", () => {
    const message = {
      direction: "outbound",
      outbound_attempt_correlation: {
        type: "outbound_attempt",
        message_id: "msg-42",
        provider_message_id: "provider-7",
      },
    };

    const attemptsByCorrelation = indexAttemptsByMessageCorrelation([
      {
        id: "attempt-42",
        status: "retrying",
        attempt_count: 2,
        max_attempts: 4,
        message_correlation: {
          provider_message_id: "provider-7",
          message_id: "msg-42",
          type: "outbound_attempt",
        },
      },
    ]);

    expect(getMessageAttemptCorrelation(message)).toBe(
      '{"message_id":"msg-42","provider_message_id":"provider-7","type":"outbound_attempt"}'
    );
    expect(getMessageOutboundTruth(message, attemptsByCorrelation)).toMatchObject({
      kind: "attempt_bound",
      status: "retrying",
      attempt: { id: "attempt-42" },
    });
  });

  it("accepts object-shaped message_correlation and exposes a stable lookup key", () => {
    const attempt = {
      id: "attempt-9",
      message_correlation: {
        scope: "tenant",
        message_id: "msg-9",
      },
    };

    expect(getAttemptMessageCorrelation(attempt)).toBe(
      '{"message_id":"msg-9","scope":"tenant"}'
    );
  });

  it("keeps legacy string correlations working safely", () => {
    const attemptsByCorrelation = indexAttemptsByMessageCorrelation([
      {
        id: "attempt-1",
        status: "failed",
        message_correlation: "corr-1",
      },
    ]);

    expect(
      getMessageOutboundTruth(
        {
          direction: "outbound",
          outbound_attempt_correlation: "corr-1",
        },
        attemptsByCorrelation
      )
    ).toMatchObject({
      kind: "attempt_bound",
      status: "failed",
      attempt: { id: "attempt-1" },
    });
  });
});
