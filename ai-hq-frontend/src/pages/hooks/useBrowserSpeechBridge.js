export function arrayBufferToBase64(buffer) {
  const bytes = buffer instanceof Uint8Array
    ? buffer
    : new Uint8Array(buffer || new ArrayBuffer(0));

  if (!bytes.byteLength) return "";

  if (typeof btoa !== "function") {
    throw new Error("base64 encoder unavailable");
  }

  let binary = "";
  const chunkSize = 0x8000;

  for (let index = 0; index < bytes.length; index += chunkSize) {
    const chunk = bytes.subarray(index, index + chunkSize);
    binary += String.fromCharCode(...chunk);
  }

  return btoa(binary);
}

export async function blobToBrowserSpeechPayload(blob, options = {}) {
  if (!blob || typeof blob.arrayBuffer !== "function") {
    throw new Error("audio blob is required");
  }

  const arrayBuffer = await blob.arrayBuffer();
  const audioBase64 = arrayBufferToBase64(arrayBuffer);

  if (!audioBase64) {
    throw new Error("audio blob is empty");
  }

  return {
    audioBase64,
    encoding: "base64",
    mimeType: String(blob.type || options.mimeType || ""),
    audioByteLength: Number(blob.size || arrayBuffer.byteLength || 0),
    finalize: options.finalize !== false,
  };
}

export async function transcribeBrowserAudioBlob(
  blob,
  options = {},
  transcribeBrowserSpeech
) {
  if (typeof transcribeBrowserSpeech !== "function") {
    throw new Error("transcribeBrowserSpeech is required");
  }

  const payload = await blobToBrowserSpeechPayload(blob, options);
  return transcribeBrowserSpeech(payload);
}
