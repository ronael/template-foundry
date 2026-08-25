export const navItems = [
  ["Platform", "/product"],
  ["Solutions", "/#workflow"],
  ["Pricing", "/pricing"],
  ["Docs", "/product#docs"],
  ["Resources", "/#proof"],
];

function normalizePath(pathname) {
  const normalized = pathname.replace(/\/+$/, "");
  return normalized || "/";
}

export function getActiveNavHref(items, pathname, hash) {
  const currentPath = normalizePath(pathname);
  const matches = items.filter(([, href]) => {
    const target = new URL(href, "https://kern.local");
    return normalizePath(target.pathname) === currentPath;
  });

  const exactLocation = matches.find(([, href]) => new URL(href, "https://kern.local").hash === hash && hash);
  if (exactLocation) return exactLocation[1];

  const page = matches.find(([, href]) => !new URL(href, "https://kern.local").hash);
  return page?.[1] ?? null;
}
