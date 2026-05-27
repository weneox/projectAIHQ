import {
  AudioFrame,
  AudioSource,
  LocalAudioTrack,
  TrackPublishOptions,
  TrackSource,
} from "@livekit/rtc-node";

import { s } from "../../shared.js";

export const PIONERO_LIVEKIT_AUDIO_TRACK_PUBLISHER_VERSION =
  "pionero_livekit_audio_track_publisher.v1";

const DEFAULT_SAMPLE_RATE_HZ = 24000;
const DEFAULT_CHANNELS = 1;
const DEFAULT_TRACK_NAME = "pionero-openai-realtime-audio";

function n(value, fallback = 0) {
  const next = Number(value);
  return Number.isFinite(next) && next > 0 ? Math.floor(next) : fallback;
}

function normalizePcmBuffer(audio) {
  if (Buffer.isBuffer(audio)) return Buffer.from(audio);
  if (audio instanceof ArrayBuffer) return Buffer.from(audio);
  if (ArrayBuffer.isView(audio)) {
    return Buffer.from(audio.buffer, audio.byteOffset, audio.byteLength);
  }
  return Buffer.alloc(0);
}

function pcmBufferToInt16Array(audio) {
  const pcm = normalizePcmBuffer(audio);
  const byteLength = pcm.byteLength - (pcm.byteLength % 2);

  if (byteLength <= 0) return new Int16Array(0);

  const aligned = new ArrayBuffer(byteLength);
  new Uint8Array(aligned).set(pcm.subarray(0, byteLength));
  return new Int16Array(aligned);
}

export function createLiveKitAudioTrackPublisher({
  room = null,
  sampleRateHz = DEFAULT_SAMPLE_RATE_HZ,
  channels = DEFAULT_CHANNELS,
  trackName = DEFAULT_TRACK_NAME,
  rtc = {
    AudioFrame,
    AudioSource,
    LocalAudioTrack,
    TrackPublishOptions,
    TrackSource,
  },
} = {}) {
  const safeSampleRateHz = n(sampleRateHz, DEFAULT_SAMPLE_RATE_HZ);
  const safeChannels = n(channels, DEFAULT_CHANNELS);
  const safeTrackName = s(trackName, DEFAULT_TRACK_NAME);
  let source = null;
  let track = null;
  let published = false;
  let audioByteLength = 0;
  let audioDeltaCount = 0;

  async function start() {
    if (published) {
      return getStatus();
    }

    if (!room?.localParticipant?.publishTrack) {
      const err = new Error("livekit_local_participant_missing");
      err.code = "livekit_local_participant_missing";
      throw err;
    }

    source = new rtc.AudioSource(safeSampleRateHz, safeChannels);
    track = rtc.LocalAudioTrack.createAudioTrack(safeTrackName, source);

    const options = new rtc.TrackPublishOptions();
    options.source = rtc.TrackSource?.SOURCE_MICROPHONE;

    await room.localParticipant.publishTrack(track, options);
    published = true;

    return getStatus();
  }

  async function publishAudioDelta(audio) {
    if (!published || !source) {
      const err = new Error("livekit_audio_track_not_published");
      err.code = "livekit_audio_track_not_published";
      throw err;
    }

    const samples = pcmBufferToInt16Array(audio);
    const samplesPerChannel = Math.floor(samples.length / safeChannels);

    if (samplesPerChannel <= 0) {
      return getStatus();
    }

    await source.captureFrame(
      new rtc.AudioFrame(
        samples,
        safeSampleRateHz,
        safeChannels,
        samplesPerChannel
      )
    );

    audioByteLength += samples.byteLength;
    audioDeltaCount += 1;

    return getStatus();
  }

  async function interrupt() {
    source?.clearQueue?.();
    return getStatus();
  }

  async function close() {
    await track?.close?.();
    await source?.close?.();
    source = null;
    track = null;
    published = false;
  }

  function getStatus() {
    return {
      version: PIONERO_LIVEKIT_AUDIO_TRACK_PUBLISHER_VERSION,
      published,
      trackName: safeTrackName,
      sampleRateHz: safeSampleRateHz,
      channels: safeChannels,
      audioDeltaCount,
      audioByteLength,
    };
  }

  return {
    close,
    getStatus,
    interrupt,
    publishAudioDelta,
    start,
  };
}
