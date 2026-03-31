import { describe, expect, it } from "vitest";

import {
  getAttemptMessageCorrelation,
  getMessageAttemptCorrelation,
  getMessageOutboundTruth,
  indexAttemptsByMessageCorrelation,
} from "./outboundAttemptTruth.js";

describe("outboundAttemptTruth", () => {
  it("supports object-shaped outbound_attempt_correlation deterministically", () => {
    const message = {
      direction: "outbound",
      outbound_attempt_correlation: {
        provider_message_id: "provider-7",
        message_id: "msg-42",
        type: "outbound_attempt",
      },
    };

    expect(getMessageAttemptCorrelation(message)).toBe(
      '{"message_id":"msg-42","provider_message_id":"provider-7","type":"outbound_attempt"}'
    );
  });

  it("supports object-shaped message_correlation deterministically", () => {
    const attempt = {
      message_correlation: {
        type: "outbound_attempt",
        provider_message_id: "provider-7",
        message_id: "msg-42",
      },
    };

    expect(getAttemptMessageCorrelation(attempt)).toBe(
      '{"message_id":"msg-42","provider_message_id":"provider-7","type":"outbound_attempt"}'
    );
  });

  it("binds outbound messages to attempts when both use object correlations", () => {
    const attemptsByCorrelation = indexAttemptsByMessageCorrelation([
      {
        id: "attempt-42",
        status: "retrying",
        attempt_count: 2,
        max_attempts: 5,
        message_correlation: {
          type: "outbound_attempt",
          provider_message_id: "provider-7",
          message_id: "msg-42",
        },
      },
    ]);

    expect(
      getMessageOutboundTruth(
        {
          direction: "outbound",
          outbound_attempt_correlation: {
            message_id: "msg-42",
            provider_message_id: "provider-7",
            type: "outbound_attempt",
          },
        },
        attemptsByCorrelation
      )
    ).toMatchObject({
      kind: "attempt_bound",
      status: "retrying",
      attempt: { id: "attempt-42" },
    });
  });

  it("preserves legacy string correlation compatibility", () => {
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
