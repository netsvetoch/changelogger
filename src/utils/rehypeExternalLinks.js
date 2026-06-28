import { isExternalHttpUrl, mergeSafeRel } from "./externalLinks.js";

function visit(node, visitor) {
  if (!node || typeof node !== "object") return;

  visitor(node);

  if (Array.isArray(node.children)) {
    for (const child of node.children) {
      visit(child, visitor);
    }
  }
}

export default function rehypeExternalLinks(options = {}) {
  return tree => {
    visit(tree, node => {
      if (node.type !== "element" || node.tagName !== "a") return;

      const properties = node.properties ?? {};

      if (!isExternalHttpUrl(properties.href, options.siteUrl)) return;

      node.properties = {
        ...properties,
        target: "_blank",
        rel: mergeSafeRel(properties.rel),
      };
    });
  };
}
