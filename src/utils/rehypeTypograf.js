import Typograf from "typograf";

const skippedTagNames = new Set([
  "code",
  "kbd",
  "pre",
  "samp",
  "script",
  "style",
]);

const typograf = new Typograf({
  locale: ["ru", "en-US"],
});

function transformTextNodes(node, skipped = false) {
  if (!node || typeof node !== "object") return;

  if (node.type === "text" && !skipped) {
    node.value = typograf.execute(node.value);
    return;
  }

  const nextSkipped =
    skipped ||
    (node.type === "element" &&
      typeof node.tagName === "string" &&
      skippedTagNames.has(node.tagName));

  if (!Array.isArray(node.children)) return;

  for (const child of node.children) {
    transformTextNodes(child, nextSkipped);
  }
}

export default function rehypeTypograf() {
  return tree => {
    transformTextNodes(tree);
  };
}
