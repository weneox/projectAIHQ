import test from "node:test";
import assert from "node:assert/strict";

import {
  createStaticAssetOptions,
  isSafePublicAssetRequestPath,
  publicAssetGuard,
} from "../src/utils/staticAssets.js";

test("public asset guard allows known safe media extensions", () => {
  assert.equal(isSafePublicAssetRequestPath("/avatar.png"), true);
  assert.equal(isSafePublicAssetRequestPath("/nested/photo.jpeg"), true);
  assert.equal(isSafePublicAssetRequestPath("/media/video.mp4"), true);
  assert.equal(isSafePublicAssetRequestPath("/audio/clip.mp3"), true);
  assert.equal(isSafePublicAssetRequestPath("/docs/menu.pdf"), true);
});

test("public asset guard blocks dotfiles traversal and executable web content", () => {
  assert.equal(isSafePublicAssetRequestPath("/.env"), false);
  assert.equal(isSafePublicAssetRequestPath("/nested/.secret/photo.png"), false);
  assert.equal(isSafePublicAssetRequestPath("/../.env"), false);
  assert.equal(isSafePublicAssetRequestPath("/index.html"), false);
  assert.equal(isSafePublicAssetRequestPath("/script.js"), false);
  assert.equal(isSafePublicAssetRequestPath("/image.svg"), false);
  assert.equal(isSafePublicAssetRequestPath("/data.json"), false);
});

test("static asset options disable indexes redirects and add safe headers", () => {
  const options = createStaticAssetOptions();

  assert.equal(options.index, false);
  assert.equal(options.redirect, false);
  assert.equal(options.dotfiles, "deny");

  const headers = {};
  options.setHeaders({
    setHeader(name, value) {
      headers[name] = value;
    },
  });

  assert.equal(headers["X-Content-Type-Options"], "nosniff");
  assert.equal(headers["Cross-Origin-Resource-Policy"], "cross-origin");
});

test("publicAssetGuard returns 404 for unsafe paths", () => {
  let statusCode = 200;
  let payload = null;
  let nextCalled = false;

  publicAssetGuard(
    {
      path: "/unsafe.html",
    },
    {
      status(code) {
        statusCode = code;
        return this;
      },
      json(body) {
        payload = body;
        return this;
      },
    },
    () => {
      nextCalled = true;
    }
  );

  assert.equal(statusCode, 404);
  assert.equal(payload?.error, "asset_not_found");
  assert.equal(nextCalled, false);
});

test("publicAssetGuard passes safe paths to next middleware", () => {
  let nextCalled = false;

  publicAssetGuard(
    {
      path: "/safe-photo.webp",
    },
    {
      status() {
        throw new Error("status should not be called for safe assets");
      },
    },
    () => {
      nextCalled = true;
    }
  );

  assert.equal(nextCalled, true);
});
