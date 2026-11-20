import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const projectRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const workerPath = resolve(projectRoot, "dist/server/index.js");
const manifestPath = resolve(projectRoot, "dist/.openai/hosting.json");

const [source, manifest] = await Promise.all([
  readFile(workerPath, "utf8"),
  readFile(manifestPath, "utf8"),
]);
JSON.parse(manifest);

const workerModule = await import(`${pathToFileURL(workerPath)}?validate=${Date.now()}`);
assert.equal(
  typeof workerModule.default?.fetch,
  "function",
  `${pathToFileURL(workerPath)} must export default.fetch`,
);

const environment = {};
const home = await workerModule.default.fetch(new Request("http://local.test/"), environment);
const css = await workerModule.default.fetch(new Request("http://local.test/assets/styles.css"), environment);
const client = await workerModule.default.fetch(new Request("http://local.test/assets/app.js"), environment);
const versionedCss = await workerModule.default.fetch(new Request("http://local.test/assets/styles.css?v=test"), environment);
const versionedClient = await workerModule.default.fetch(new Request("http://local.test/assets/app.js?v=test"), environment);
const health = await workerModule.default.fetch(new Request("http://local.test/api/health"), environment);

assert.equal(home.status, 200);
assert.match(home.headers.get("content-type") || "", /text\/html/);
assert.match(home.headers.get("cache-control") || "", /no-cache/);
const html = await home.text();
assert.match(html, /Community pulse/);
assert.match(html, /\/assets\/styles\.css\?v=[a-f0-9]{12}/);
assert.match(html, /\/assets\/app\.js\?v=[a-f0-9]{12}/);
assert.equal(css.status, 200);
assert.match(css.headers.get("content-type") || "", /text\/css/);
assert.match(css.headers.get("cache-control") || "", /no-cache/);
assert.match(await css.text(), /community-redesign/);
assert.equal(client.status, 200);
assert.match(client.headers.get("content-type") || "", /javascript/);
assert.match(client.headers.get("cache-control") || "", /no-cache/);
assert.match(await client.text(), /function render/);
assert.match(versionedCss.headers.get("cache-control") || "", /immutable/);
assert.match(versionedClient.headers.get("cache-control") || "", /immutable/);
assert.deepEqual(await health.json(), { status: "ok", service: "flarum-community", supabase: "demo" });

console.log("Artifact is valid and serves HTML, CSS, JavaScript, and API routes");
