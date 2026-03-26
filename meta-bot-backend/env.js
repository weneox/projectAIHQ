try {
  await import("dotenv/config");
} catch {
  await import("../node_modules/dotenv/config.js");
}
