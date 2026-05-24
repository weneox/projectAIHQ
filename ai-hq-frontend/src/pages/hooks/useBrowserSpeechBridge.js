import { useCallback, useEffect, useMemo, useRef, useState } from "react";

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


const DEFAULT_BROWSER_SPEECH_MIME_TYPES = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/mp4",
  "audio/ogg;codecs=opus",
];

function readGlobalNavigator() {
  return typeof globalThis !== "undefined" ? globalThis.navigator : null;
}

function readGlobalMediaRecorder() {
  return typeof globalThis !== "undefined" ? globalThis.MediaRecorder : null;
}

function cleanString(value, fallback = "") {
  return String(value ?? fallback).trim() || fallback;
}

function readRecorderState(recorder) {
  return cleanString(recorder?.state).toLowerCase();
}

function readErrorMessage(err, fallback = "browser speech recording failed") {
  return cleanString(err?.message || err, fallback);
}

export function pickBrowserSpeechMimeType(
  mediaRecorderCtor = readGlobalMediaRecorder(),
  candidates = DEFAULT_BROWSER_SPEECH_MIME_TYPES
) {
  if (!mediaRecorderCtor || typeof mediaRecorderCtor.isTypeSupported !== "function") {
    return "";
  }

  return candidates.find((mimeType) => (
    cleanString(mimeType) && mediaRecorderCtor.isTypeSupported(mimeType)
  )) || "";
}

export function isBrowserSpeechRecordingSupported({
  navigatorRef = readGlobalNavigator(),
  mediaRecorderCtor = readGlobalMediaRecorder(),
} = {}) {
  return Boolean(
    navigatorRef?.mediaDevices &&
      typeof navigatorRef.mediaDevices.getUserMedia === "function" &&
      typeof mediaRecorderCtor === "function"
  );
}

export function stopBrowserSpeechStream(stream) {
  const tracks = typeof stream?.getTracks === "function" ? stream.getTracks() : [];

  tracks.forEach((track) => {
    if (typeof track?.stop === "function") {
      track.stop();
    }
  });

  return tracks.length;
}

export async function createBrowserSpeechMediaRecorder({
  navigatorRef = readGlobalNavigator(),
  mediaRecorderCtor = readGlobalMediaRecorder(),
  audio = true,
  mimeType = "",
  candidates = DEFAULT_BROWSER_SPEECH_MIME_TYPES,
} = {}) {
  if (!navigatorRef?.mediaDevices || typeof navigatorRef.mediaDevices.getUserMedia !== "function") {
    throw new Error("browser microphone is unavailable");
  }

  if (typeof mediaRecorderCtor !== "function") {
    throw new Error("MediaRecorder is unavailable");
  }

  const selectedMimeType = cleanString(mimeType) || pickBrowserSpeechMimeType(
    mediaRecorderCtor,
    candidates
  );

  const stream = await navigatorRef.mediaDevices.getUserMedia({ audio });

  try {
    const recorder = new mediaRecorderCtor(
      stream,
      selectedMimeType ? { mimeType: selectedMimeType } : undefined
    );

    return {
      recorder,
      stream,
      mimeType: selectedMimeType,
    };
  } catch (err) {
    stopBrowserSpeechStream(stream);
    throw err;
  }
}

function createSpeechRecorderBlob(chunks = [], recorder = null, mimeType = "") {
  const type = cleanString(recorder?.mimeType || mimeType);

  return new Blob(chunks, type ? { type } : undefined);
}

export function useBrowserSpeechRecorder({
  createRecorder = createBrowserSpeechMediaRecorder,
  transcribeSpeech = transcribeBrowserAudioBlob,
  transcribeBrowserSpeech,
  onTranscript,
  onError,
} = {}) {
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");
  const [text, setText] = useState("");

  const chunksRef = useRef([]);
  const mountedRef = useRef(false);
  const recorderRef = useRef(null);
  const statusRef = useRef("idle");
  const streamRef = useRef(null);

  const isSupported = useMemo(() => isBrowserSpeechRecordingSupported(), []);

  const setSafeStatus = useCallback((nextStatus) => {
    statusRef.current = nextStatus;

    if (mountedRef.current) {
      setStatus(nextStatus);
    }
  }, []);

  const cleanupRecorder = useCallback(() => {
    stopBrowserSpeechStream(streamRef.current);
    streamRef.current = null;
    recorderRef.current = null;
    chunksRef.current = [];
  }, []);

  const handleError = useCallback((err) => {
    const message = readErrorMessage(err);
    setSafeStatus("error");

    if (mountedRef.current) {
      setError(message);
    }

    onError?.(err);
  }, [onError, setSafeStatus]);

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;

      const recorder = recorderRef.current;
      const recorderState = readRecorderState(recorder);

      if (recorder && (recorderState === "recording" || recorderState === "paused")) {
        try {
          recorder.stop();
        } catch {
          // Ignore cleanup stop failures.
        }
      }

      cleanupRecorder();
    };
  }, [cleanupRecorder]);

  const startRecording = useCallback(async () => {
    if (statusRef.current === "starting" || statusRef.current === "recording") {
      return {
        ok: false,
        reasonCode: "browser_speech_recording_in_progress",
      };
    }

    if (typeof transcribeBrowserSpeech !== "function") {
      const err = new Error("transcribeBrowserSpeech is required");
      handleError(err);

      return {
        ok: false,
        reasonCode: "browser_speech_transcribe_client_missing",
        error: err.message,
      };
    }

    chunksRef.current = [];

    if (mountedRef.current) {
      setError("");
      setText("");
    }

    setSafeStatus("starting");

    try {
      const { recorder, stream, mimeType } = await createRecorder();

      recorderRef.current = recorder;
      streamRef.current = stream;

      recorder.ondataavailable = (event) => {
        const data = event?.data;

        if (data && Number(data.size || 0) > 0) {
          chunksRef.current.push(data);
        }
      };

      recorder.onerror = (event) => {
        handleError(event?.error || new Error("browser speech recorder failed"));
      };

      recorder.onstop = async () => {
        const blob = createSpeechRecorderBlob(chunksRef.current, recorder, mimeType);

        try {
          setSafeStatus("transcribing");

          const result = await transcribeSpeech(
            blob,
            { finalize: true },
            transcribeBrowserSpeech
          );

          const transcriptText = cleanString(result?.text || result?.result?.text);

          if (mountedRef.current) {
            setText(transcriptText);
          }

          onTranscript?.(result);
          setSafeStatus("done");
        } catch (err) {
          handleError(err);
        } finally {
          cleanupRecorder();
        }
      };

      recorder.start();
      setSafeStatus("recording");

      return {
        ok: true,
        status: "recording",
      };
    } catch (err) {
      cleanupRecorder();
      handleError(err);

      return {
        ok: false,
        reasonCode: "browser_speech_recording_start_failed",
        error: readErrorMessage(err),
      };
    }
  }, [
    cleanupRecorder,
    createRecorder,
    handleError,
    onTranscript,
    setSafeStatus,
    transcribeBrowserSpeech,
    transcribeSpeech,
  ]);

  const stopRecording = useCallback(() => {
    const recorder = recorderRef.current;
    const recorderState = readRecorderState(recorder);

    if (recorder && (recorderState === "recording" || recorderState === "paused")) {
      recorder.stop();

      return {
        ok: true,
        status: "stopping",
      };
    }

    return {
      ok: false,
      reasonCode: "browser_speech_recorder_not_recording",
    };
  }, []);

  return {
    error,
    isSupported,
    recording: status === "recording",
    startRecording,
    status,
    stopRecording,
    text,
  };
}
