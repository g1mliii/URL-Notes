#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const blockedPackages = new Map([
  [
    "axios",
    {
      versions: new Set(["1.14.1", "0.30.4"]),
      reason: "known-bad axios release",
    },
  ],
  [
    "plain-crypto-js",
    {
      versions: new Set(["4.2.1"]),
      reason: "known-bad plain-crypto-js release",
    },
  ],
]);

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function collectFromLockfile(lockfilePath) {
  const findings = [];
  const lockfile = readJson(lockfilePath);
  const packages = lockfile.packages || {};

  for (const [packagePath, metadata] of Object.entries(packages)) {
    if (!metadata || typeof metadata !== "object" || !metadata.version) {
      continue;
    }

    const segments = packagePath.split("node_modules/").filter(Boolean);
    const name = segments.at(-1);
    if (!name || !blockedPackages.has(name)) {
      continue;
    }

    const rule = blockedPackages.get(name);
    if (rule.versions.has(metadata.version)) {
      findings.push({
        name,
        version: metadata.version,
        source: path.basename(lockfilePath),
        packagePath,
        reason: rule.reason,
      });
    }
  }

  return findings;
}

function main() {
  const targetDir = path.resolve(process.argv[2] || ".");
  const candidateFiles = ["package-lock.json", "npm-shrinkwrap.json"]
    .map((fileName) => path.join(targetDir, fileName))
    .filter((filePath) => fs.existsSync(filePath));

  if (candidateFiles.length === 0) {
    console.error(`No npm lockfile found in ${targetDir}`);
    process.exit(1);
  }

  const findings = candidateFiles.flatMap(collectFromLockfile);

  if (findings.length === 0) {
    console.log(`No blocked package versions found in ${targetDir}`);
    return;
  }

  console.error(`Blocked package versions found in ${targetDir}:`);
  for (const finding of findings) {
    console.error(
      `- ${finding.name}@${finding.version} via ${finding.packagePath} in ${finding.source} (${finding.reason})`
    );
  }

  process.exit(1);
}

main();
