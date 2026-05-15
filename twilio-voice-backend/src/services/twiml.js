import twilio from "twilio";
import { cfg } from "../config.js";

function s(v, d = "") {
  return String(v ?? d).trim();
}

export function getBaseUrlFromReq(req) {
  const envBase = s(cfg.PUBLIC_BASE_URL);
  if (envBase) return envBase.replace(/\/+$/, "");

  const proto = (req.headers["x-forwarded-proto"] || req.protocol || "https")
    .toString()
    .split(",")[0]
    .trim();

  const host = (req.headers["x-forwarded-host"] || req.get("host") || "")
    .toString()
    .split(",")[0]
    .trim();

  return `${proto}://${host}`.replace(/\/+$/, "");
}

export function toWsUrl(httpUrl) {
  return httpUrl.replace(/^https:\/\//i, "wss://").replace(/^http:\/\//i, "ws://");
}

export function createVoiceResponseXml({ wsUrl, from, to, tenantKey, callSid }) {
  const vr = new twilio.twiml.VoiceResponse();
  const connect = vr.connect();
  const stream = connect.stream({ url: wsUrl });

  stream.parameter({ name: "From", value: s(from) });
  stream.parameter({ name: "To", value: s(to) });
  stream.parameter({ name: "TenantKey", value: s(tenantKey) });
  stream.parameter({ name: "CallSid", value: s(callSid) });

  return vr.toString();
}

export function createTransferResponseXml({
  operatorPhone,
  callerId,
  transferText,
  unavailableText,
}) {
  const vr = new twilio.twiml.VoiceResponse();

  if (!s(operatorPhone)) {
    vr.say({ voice: "alice" }, unavailableText || "Operator is not available right now.");
    return vr.toString();
  }

  vr.say({ voice: "alice" }, transferText || "Okay, I will connect you now.");

  const dial = vr.dial({
    callerId: s(callerId) || undefined,
    timeout: 25,
  });

  dial.number(operatorPhone);

  vr.say({ voice: "alice" }, unavailableText || "Operator is not available right now.");

  return vr.toString();
}

export function createSimpleSayXml(text) {
  const vr = new twilio.twiml.VoiceResponse();
  vr.say({ voice: "alice" }, s(text, "The service is temporarily unavailable."));
  return vr.toString();
}
