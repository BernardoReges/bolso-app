const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const fs = require("node:fs");
const os = require("node:os");
const { spawnSync } = require("node:child_process");
const root = path.resolve(__dirname, "..");
const run = (dir) =>
  spawnSync(
    process.execPath,
    [path.join(root, "scripts/configure-signing.cjs")],
    { env: { ...process.env, BOLSO_SIGNING_DIR: dir }, encoding: "utf8" },
  );
test("Assinatura recusa a raiz e subpastas do repositório público antes de gerar credenciais", () => {
  for (const dir of [root, path.join(root, "assets")]) {
    const result = run(dir);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /fora do repositório/);
  }
  assert(!fs.existsSync(path.join(root, "config.json")));
});
test("Uma pasta de assinatura incompleta não gera outra chave nem sobrescreve a existente", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "bolso-signing-test-"));
  try {
    const key = path.join(dir, "bolso.jks");
    fs.writeFileSync(key, "chave-ficticia");
    const result = run(dir);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /incompleta/);
    assert.equal(fs.readFileSync(key, "utf8"), "chave-ficticia");
    assert(!fs.existsSync(path.join(dir, "config.json")));
  } finally {
    assert(
      path.resolve(dir).startsWith(path.resolve(os.tmpdir()) + path.sep) &&
        path.basename(dir).startsWith("bolso-signing-test-"),
    );
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
