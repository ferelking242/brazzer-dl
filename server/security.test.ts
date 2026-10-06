import assert from "node:assert/strict";
import test from "node:test";
import { assertSafeRedirect, validateMediaUrlShape } from "./security";

test("accepts a direct HTTPS video URL without query parameters", () => {
  const url = validateMediaUrlShape("https://media.example.org/clip.mp4");
  assert.equal(url.hostname, "media.example.org");
  assert.equal(url.pathname, "/clip.mp4");
});

test("rejects Brazzers hostnames and subdomains", () => {
  assert.throws(() => validateMediaUrlShape("https://site-ma.brazzers.com/clip.mp4"), /liens Brazzers/);
  assert.throws(() => validateMediaUrlShape("https://cdn.brazzers.com/clip.mp4"), /liens Brazzers/);
});

test("rejects authenticated, parameterized, non-HTTPS, and non-video URLs", () => {
  assert.throws(() => validateMediaUrlShape("https://user:pass@media.example.org/clip.mp4"), /identifiants/);
  assert.throws(() => validateMediaUrlShape("https://media.example.org/clip.mp4?token=abc"), /paramètres/);
  assert.throws(() => validateMediaUrlShape("http://media.example.org/clip.mp4"), /HTTPS/);
  assert.throws(() => validateMediaUrlShape("https://media.example.org/watch"), /lien HTTPS direct/);
});

test("rejects local hosts and IP literals", () => {
  assert.throws(() => validateMediaUrlShape("https://127.0.0.1/clip.mp4"), /adresses IP/);
  assert.throws(() => validateMediaUrlShape("https://printer.local/clip.mp4"), /liens locaux/);
});

test("rejects redirects to another hostname", () => {
  assert.throws(
    () => assertSafeRedirect("media.example.org", new URL("https://other.example.org/clip.mp4")),
    /autre hôte/,
  );
});
