const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");
const campusDirectory = require("../../lib/institutions/indonesian-campuses-2025.json");
const source = ts.transpileModule(fs.readFileSync(path.resolve(__dirname, "../../app/api/institutions/route.ts"), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
}).outputText;

function route(fetch) {
  const module = { exports: {} };
  new Function("require", "module", "exports", "fetch", source)(
    () => campusDirectory, module, module.exports, fetch,
  );
  return module.exports.GET;
}

const request = (q, level) => new Request("http://localhost/api/institutions?" + new URLSearchParams({ q, level }));
const html = '<section class="search-panel"><form action="/satpen/cari"></form><table><tbody>'
  + '<tr><td>1</td><td>50103142</td><td><a class="search-school"\n'
  + 'href="/satpen/detail/50103142?kembali=search">SMP NEGERI 1 DENPASAR</a></td>'
  + '<td>SMP</td><td>NEGERI</td><td><div>Kota Denpasar</div><div>Jl. Surapati</div></td></tr>'
  + '</tbody></table></section>';

test("school names use the current directory endpoint and preserve the city and identifier", async () => {
  const GET = route(async url => {
    assert.equal(url.origin, "https://referensi.data.kemendikdasmen.go.id");
    assert.equal(url.pathname, "/satpen/cari");
    assert.equal(url.searchParams.get("q"), "SMP Negeri 1 Denpasar");
    return new Response(html);
  });
  const response = await GET(request("SMP Negeri 1 Denpasar", "smp"));
  assert.equal(response.status, 200);
  assert.deepEqual((await response.json()).items, [{
    id: "50103142", name: "SMP NEGERI 1 DENPASAR", city: "Kota Denpasar", type: "SMP",
  }]);
});

test("campus index preserves leading-zero codes even when the remote directory is unavailable", async () => {
  const GET = route(() => assert.fail("Known campuses should use the published index"));
  for (const [name, code] of [["Universitas Indonesia", "001002"], ["Institut Teknologi Bandung", "002001"], ["Universitas Gadjah Mada", "001001"]]) {
    const response = await GET(request(name, "mahasiswa"));
    assert.equal(response.status, 200);
    assert.equal((await response.json()).items[0].id, code);
  }
});

test("empty results remain empty and a transient directory failure is retried", async () => {
  const empty = route(async () => new Response('<section class="search-panel"><form action="/satpen/cari"></form></section>'));
  assert.deepEqual(await (await empty(request("Tidak ada", "smp"))).json(), { items: [] });
  let attempts = 0;
  const retry = route(async () => {
    attempts++;
    if (attempts === 1) throw new Error("Timeout");
    return new Response(html);
  });
  assert.equal((await retry(request("SMP Negeri 1 Denpasar", "smp"))).status, 200);
  assert.equal(attempts, 2);
});
