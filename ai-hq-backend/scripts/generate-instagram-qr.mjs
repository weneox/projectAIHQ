import fs from "node:fs/promises";
import path from "node:path";
import QRCode from "qrcode";

function normalizeInstagram(input = "") {
  const raw = String(input).trim().replace(/^@/, "");

  if (!raw) {
    throw new Error("Instagram username və ya link verilməlidir.");
  }

  if (raw.startsWith("http://") || raw.startsWith("https://")) {
    return raw;
  }

  return `https://instagram.com/${raw}`;
}

function getSlugFromInstagramUrl(url) {
  try {
    const parsed = new URL(url);
    const slug = parsed.pathname.replace(/^\/+|\/+$/g, "") || "instagram";
    return slug.replace(/[^a-zA-Z0-9-_]/g, "-");
  } catch {
    return "instagram";
  }
}

async function main() {
  const input = process.argv[2];

  if (!input) {
    console.error("İstifadə: node scripts/generate-instagram-qr.mjs dostununusername");
    process.exit(1);
  }

  const instagramUrl = normalizeInstagram(input);
  const slug = getSlugFromInstagramUrl(instagramUrl);

  const outputDir = path.resolve("qr-output");
  await fs.mkdir(outputDir, { recursive: true });

  const svgPath = path.join(outputDir, `${slug}-instagram-qr.svg`);
  const pngPath = path.join(outputDir, `${slug}-instagram-qr.png`);

  const svg = await QRCode.toString(instagramUrl, {
    type: "svg",
    errorCorrectionLevel: "H",
    margin: 2,
    width: 1200,
    color: {
      dark: "#111111",
      light: "#FFFFFF",
    },
  });

  const png = await QRCode.toBuffer(instagramUrl, {
    type: "png",
    errorCorrectionLevel: "H",
    margin: 2,
    width: 1200,
    color: {
      dark: "#111111",
      light: "#FFFFFF",
    },
  });

  await fs.writeFile(svgPath, svg, "utf8");
  await fs.writeFile(pngPath, png);

  console.log("Hazırdır:");
  console.log(svgPath);
  console.log(pngPath);
  console.log("Instagram URL:", instagramUrl);
}

main().catch((error) => {
  console.error("Xəta:", error.message);
  process.exit(1);
});