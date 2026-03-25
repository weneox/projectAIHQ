// src/api/comments.js

import { apiGet } from "./client.js";

export async function listComments({
  channel = "",
  category = "",
  q = "",
  limit = 50,
} = {}) {
  const params = new URLSearchParams();
  if (channel) params.set("channel", channel);
  if (category) params.set("category", category);
  if (q) params.set("q", q);
  params.set("limit", String(limit));

  return apiGet(`/api/comments?${params.toString()}`);
}

export async function getCommentById(id) {
  if (!id) throw new Error("comment id required");
  return apiGet(`/api/comments/${encodeURIComponent(id)}`);
}
