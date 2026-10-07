import assert from "node:assert/strict";
import test from "node:test";
import { isMasterPlaylist, parseMediaPlaylist, segmentIv, selectVariant } from "./hls";

const base = new URL("https://media.example.org/hls/index.m3u8");

test("detects a master playlist", () => {
  const master = [
    "#EXTM3U",
    "#EXT-X-STREAM-INF:BANDWIDTH=800000,RESOLUTION=640x360",
    "360/index.m3u8",
    "#EXT-X-STREAM-INF:BANDWIDTH=5000000,RESOLUTION=1920x1080",
    "1080/index.m3u8",
  ].join("\n");
  assert.equal(isMasterPlaylist(master), true);
});

test("selects the highest-bandwidth variant and resolves relative URIs", () => {
  const master = [
    "#EXTM3U",
    "#EXT-X-STREAM-INF:BANDWIDTH=800000,RESOLUTION=640x360",
    "360/index.m3u8",
    "#EXT-X-STREAM-INF:BANDWIDTH=5000000,RESOLUTION=1920x1080",
    "1080/index.m3u8",
  ].join("\n");
  const variant = selectVariant(master, base);
  assert.equal(variant.url.toString(), "https://media.example.org/hls/1080/index.m3u8");
  assert.equal(variant.resolution, "1920x1080");
  assert.equal(variant.bandwidth, 5000000);
});

test("parses a media playlist with durations and resolves segment URLs", () => {
  const media = [
    "#EXTM3U",
    "#EXT-X-VERSION:3",
    "#EXT-X-TARGETDURATION:10",
    "#EXTINF:9.009,",
    "segment0.ts",
    "#EXTINF:9.009,",
    "segment1.ts",
  ].join("\n");
  const playlist = parseMediaPlaylist(media, base);
  assert.equal(playlist.segments.length, 2);
  assert.equal(playlist.segments[0].url.toString(), "https://media.example.org/hls/segment0.ts");
  assert.equal(playlist.segments[1].duration, 9.009);
  assert.equal(playlist.byteLength, 18.018);
});

test("parses AES-128 keys and applies the sequence-derived IV", () => {
  const media = [
    "#EXTM3U",
    "#EXT-X-MEDIA-SEQUENCE:4",
    '#EXT-X-KEY:METHOD=AES-128,URI="https://media.example.org/hls/key.bin"',
    "#EXTINF:4,",
    "segment4.ts",
    "#EXTINF:4,",
    "segment5.ts",
  ].join("\n");
  const playlist = parseMediaPlaylist(media, base);
  assert.equal(playlist.segments[0].key?.method, "AES-128");
  assert.equal(playlist.segments[0].key?.url.toString(), "https://media.example.org/hls/key.bin");
  // Default IV is the media sequence number, big-endian, in the low 64 bits.
  assert.equal(segmentIv(playlist.segments[0])?.readUInt32BE(12), 4);
  assert.equal(segmentIv(playlist.segments[1])?.readUInt32BE(12), 5);
});

test("honours an explicit IV and clears the key on METHOD=NONE", () => {
  const media = [
    "#EXTM3U",
    "#EXT-X-KEY:METHOD=AES-128,URI=\"key.bin\",IV=0x0000000000000000000000000000000A",
    "#EXTINF:4,",
    "a.ts",
    "#EXT-X-KEY:METHOD=NONE",
    "#EXTINF:4,",
    "b.ts",
  ].join("\n");
  const playlist = parseMediaPlaylist(media, base);
  assert.equal(segmentIv(playlist.segments[0])?.readUInt32BE(12), 10);
  assert.equal(playlist.segments[1].key, null);
  assert.equal(segmentIv(playlist.segments[1]), null);
});

test("rejects an unsupported encryption method", () => {
  const media = [
    "#EXTM3U",
    '#EXT-X-KEY:METHOD=SAMPLE-AES,URI="key.bin"',
    "#EXTINF:4,",
    "a.ts",
  ].join("\n");
  assert.throws(() => parseMediaPlaylist(media, base), /SAMPLE-AES/);
});

test("rejects segments hosted on another hostname", () => {
  const media = ["#EXTM3U", "#EXTINF:4,", "https://other.example.org/a.ts"].join("\n");
  assert.throws(() => parseMediaPlaylist(media, base), /autre hôte/);
});

test("rejects a playlist without segments", () => {
  assert.throws(() => parseMediaPlaylist("#EXTM3U\n#EXT-X-ENDLIST\n", base), /aucun segment/);
});
