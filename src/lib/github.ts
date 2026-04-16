const GITHUB_API = "https://api.github.com";

const BINARY_EXTENSIONS = new Set([
  "7z", "avif", "bmp", "class", "dll", "doc", "docx", "eot", "exe", "gif", "gz", "ico", "jar",
  "jpeg", "jpg", "lockb", "mov", "mp3", "mp4", "otf", "pdf", "png", "pyc", "so", "tar", "ttf",
  "wav", "webm", "webp", "woff", "woff2", "zip",
]);

function headers(token: string) {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github.v3+json",
  };
}

export interface Repo {
  id: number;
  name: string;
  full_name: string;
  private: boolean;
  description: string | null;
  default_branch: string;
  updated_at: string;
}

export interface TreeItem {
  path: string;
  mode: string;
  type: "blob" | "tree";
  sha: string;
  size?: number;
}

export async function fetchUser(token: string) {
  const res = await fetch(`${GITHUB_API}/user`, { headers: headers(token) });
  if (!res.ok) throw new Error("Invalid token");
  return res.json();
}

export async function fetchRepos(token: string): Promise<Repo[]> {
  const res = await fetch(`${GITHUB_API}/user/repos?sort=updated&per_page=100&type=all`, { headers: headers(token) });
  if (!res.ok) throw new Error("Failed to fetch repos");
  return res.json();
}

export async function fetchTree(token: string, owner: string, repo: string, branch: string): Promise<TreeItem[]> {
  const res = await fetch(`${GITHUB_API}/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`, { headers: headers(token) });
  if (!res.ok) throw new Error("Failed to fetch tree");
  const data = await res.json();
  return data.tree || [];
}

export async function fetchFileContent(token: string, owner: string, repo: string, path: string, branch: string): Promise<string> {
  const res = await fetch(`${GITHUB_API}/repos/${owner}/${repo}/contents/${path}?ref=${branch}`, { headers: headers(token) });
  if (!res.ok) throw new Error("Failed to fetch file");
  const data = await res.json();
  if (data.encoding === "base64") {
    return atob(data.content);
  }
  return data.content;
}

export async function updateFile(
  token: string,
  owner: string,
  repo: string,
  path: string,
  content: string,
  message: string,
  branch: string
): Promise<void> {
  // Get current file SHA
  const getRes = await fetch(`${GITHUB_API}/repos/${owner}/${repo}/contents/${path}?ref=${branch}`, { headers: headers(token) });
  let sha: string | undefined;
  if (getRes.ok) {
    const existing = await getRes.json();
    sha = existing.sha;
  }

  const body: any = {
    message,
    content: btoa(unescape(encodeURIComponent(content))),
    branch,
  };
  if (sha) body.sha = sha;

  const res = await fetch(`${GITHUB_API}/repos/${owner}/${repo}/contents/${path}`, {
    method: "PUT",
    headers: { ...headers(token), "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.message || "Failed to update file");
  }
}

export function isTextFilePath(path: string): boolean {
  const filename = path.split("/").pop()?.toLowerCase() || "";
  if (!filename.includes(".")) return true;
  const ext = filename.split(".").pop() || "";
  return !BINARY_EXTENSIONS.has(ext);
}

export function getLanguage(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase() || "";
  const map: Record<string, string> = {
    js: "javascript", jsx: "javascript", ts: "javascript", tsx: "javascript",
    py: "python", html: "html", htm: "html", css: "css",
    json: "json", md: "markdown", yaml: "yaml", yml: "yaml",
    sh: "shell", bash: "shell", rs: "rust", go: "go",
    java: "java", rb: "ruby", php: "php", c: "c", cpp: "cpp",
    h: "cpp", swift: "swift", kt: "kotlin", sql: "sql",
  };
  return map[ext] || "text";
}
