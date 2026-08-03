import "server-only";

import packageMetadata from "@/package.json";

export function appVersion() {
  const version = packageMetadata.version.trim();
  return version.startsWith("v") ? version : `v${version}`;
}

export function appRevision(length = 12) {
  const commitSha = process.env.RAILWAY_GIT_COMMIT_SHA?.trim();
  if (commitSha) return commitSha.slice(0, length);

  return "local";
}
