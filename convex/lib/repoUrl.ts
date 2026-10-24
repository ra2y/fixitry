export type ParsedRepo = { owner: string; repo: string; canonicalUrl: string };

const SEGMENT = /^[A-Za-z0-9_][A-Za-z0-9_.-]{0,99}$/;

export function parseGithubRepoUrl(input: string): ParsedRepo {
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    throw new Error("Not a valid URL");
  }
  if (url.protocol !== "https:") throw new Error("Only https URLs are allowed");
  if (url.hostname !== "github.com") throw new Error("Only github.com repositories are allowed");
  if (url.username || url.password || url.port || url.search || url.hash) {
    throw new Error("URL must not contain credentials, a port, a query, or a fragment");
  }
  const parts = url.pathname.split("/").filter(Boolean);
  if (parts.length !== 2) throw new Error("Expected https://github.com/owner/repo");
  const owner = parts[0];
  const repo = parts[1].replace(/\.git$/, "");
  if (!SEGMENT.test(owner) || !SEGMENT.test(repo) || repo === "." || repo === "..") {
    throw new Error("Owner or repository name contains invalid characters");
  }
  return { owner, repo, canonicalUrl: `https://github.com/${owner}/${repo}` };
}

export function isAllowed(input: string, allowlist: string[]): boolean {
  const target = parseGithubRepoUrl(input).canonicalUrl.toLowerCase();
  return allowlist.some((entry) => {
    try {
      return parseGithubRepoUrl(entry).canonicalUrl.toLowerCase() === target;
    } catch {
      return false;
    }
  });
}
