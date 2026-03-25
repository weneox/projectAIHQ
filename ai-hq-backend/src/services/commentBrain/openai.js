import OpenAI from "openai";
import { cfg } from "../../config.js";
import { s } from "./shared.js";

let openaiSingleton = null;

export function ensureOpenAI() {
  const key = s(cfg?.ai?.openaiApiKey || "");
  if (!key) return null;

  if (!openaiSingleton) {
    openaiSingleton = new OpenAI({ apiKey: key });
  }

  return openaiSingleton;
}