const packageName = String(process.argv[2] || "workspace").trim() || "workspace";
console.log(`[validate:env] ${packageName}: no environment validation required`);
