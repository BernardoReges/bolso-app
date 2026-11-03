// Uso local: guarda uma chave de assinatura PRIVADA fora da pasta pública do projeto.
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { execFileSync } = require("node:child_process");
const dir = process.env.BOLSO_SIGNING_DIR;
if (!dir || !path.isAbsolute(dir))
  throw Error(
    "Defina BOLSO_SIGNING_DIR como pasta privada absoluta, fora do repositório.",
  );
const root = path.resolve(__dirname, "..");
if (path.resolve(dir) === root || path.resolve(dir).startsWith(root + path.sep))
  throw Error("A assinatura deve ficar fora do repositório.");
fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
const relative = path.relative(fs.realpathSync(root), fs.realpathSync(dir));
if (
  !relative ||
  (!relative.startsWith(".." + path.sep) &&
    relative !== ".." &&
    !path.isAbsolute(relative))
)
  throw Error(
    "A assinatura deve ficar fora do repositório, inclusive ao usar links de pasta.",
  );
const configFile = path.join(dir, "config.json"),
  keystore = path.join(dir, "bolso.jks");
if (fs.existsSync(configFile) !== fs.existsSync(keystore))
  throw Error(
    "Pasta de assinatura incompleta. Restaure config.json e bolso.jks da sua cópia privada; a chave não será recriada automaticamente.",
  );
let config;
if (fs.existsSync(configFile)) config = JSON.parse(fs.readFileSync(configFile));
else {
  config = { password: crypto.randomBytes(32).toString("hex") };
  fs.writeFileSync(configFile, JSON.stringify(config), { mode: 0o600 });
}
if (!fs.existsSync(keystore))
  execFileSync(
    "keytool",
    [
      "-genkeypair",
      "-keystore",
      keystore,
      "-alias",
      "bolso",
      "-keyalg",
      "RSA",
      "-keysize",
      "2048",
      "-validity",
      "10000",
      "-storepass:env",
      "BOLSO_KEY_PASSWORD",
      "-keypass:env",
      "BOLSO_KEY_PASSWORD",
      "-dname",
      "CN=Bolso, OU=Open Source, O=Bolso, C=BR",
    ],
    {
      env: { ...process.env, BOLSO_KEY_PASSWORD: config.password },
      stdio: "inherit",
    },
  );
let file = path.join(root, "android/app/build.gradle"),
  gradle = fs.readFileSync(file, "utf8");
if (!gradle.includes("bolsoPrivate {"))
  gradle = gradle
    .replace(
      "signingConfigs {",
      `signingConfigs {
        bolsoPrivate {
            storeFile file(System.getenv("BOLSO_SIGNING_DIR") + "/bolso.jks")
            storePassword System.getenv("BOLSO_KEY_PASSWORD")
            keyAlias "bolso"
            keyPassword System.getenv("BOLSO_KEY_PASSWORD")
        }`,
    )
    .replace(
      /(release\s*\{[\s\S]*?)signingConfig signingConfigs.debug/,
      "$1signingConfig signingConfigs.bolsoPrivate",
    );
fs.writeFileSync(file, gradle);
if (process.argv.includes("--build"))
  execFileSync(
    process.platform === "win32" ? "gradlew.bat" : "./gradlew",
    ["assembleRelease", "--no-daemon", "-PreactNativeArchitectures=arm64-v8a"],
    {
      cwd: path.join(root, "android"),
      env: { ...process.env, BOLSO_KEY_PASSWORD: config.password },
      stdio: "inherit",
    },
  );
