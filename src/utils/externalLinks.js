export function isExternalHttpUrl(href, siteUrl) {
  if (typeof href !== "string") return false;

  try {
    const url = new URL(href);
    const isHttp = url.protocol === "http:" || url.protocol === "https:";

    if (!isHttp) return false;
    if (!siteUrl) return true;

    return url.origin !== new URL(siteUrl).origin;
  } catch {
    return false;
  }
}

export function mergeSafeRel(rel) {
  const current = Array.isArray(rel)
    ? rel
    : typeof rel === "string"
      ? rel.split(/\s+/)
      : [];

  return Array.from(new Set([...current, "noopener", "noreferrer"]));
}
