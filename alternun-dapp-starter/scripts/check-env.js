require("dotenv").config({ path: ".env.local" });

const keys = [
  "ALTERNUN_NETWORK",
  "ALTERNUN_ADMIN",
  "ALTERNUN_ORACLE",
  "ALTERNUN_TREASURY",
  "ALTERNUN_GBT_MINTER",
  "ALTERNUN_GBT_TOKEN",
  "ALTERNUN_STABLE_TOKEN",
  "ALTERNUN_ATN_CURVE",
  "ALTERNUN_ATN_TOKEN",
  "ALTERNUN_PROJECT_VAULT",
];

console.log("ENV check →");
for (const k of keys) {
  console.log(k, "=", process.env[k] || "(missing)");
}
