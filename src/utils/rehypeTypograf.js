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

function typografText(value) {
  const leadingSpace = value.match(/^\s+/)?.[0] ?? "";
  const trailingSpace = value.match(/\s+$/)?.[0] ?? "";
  const text = value.slice(
    leadingSpace.length,
    value.length - trailingSpace.length
  );

  if (!text) return value;

  return `${leadingSpace}${typograf.execute(text)}${trailingSpace}`;
}

function getFirstTextWord(node) {
  if (!node || typeof node !== "object") return "";

  if (node.type === "text") {
    return node.value.match(/\S+/)?.[0] ?? "";
  }

  if (!Array.isArray(node.children)) return "";

  for (const child of node.children) {
    const word = getFirstTextWord(child);
    if (word) return word;
  }

  return "";
}

function applyTypographyAcrossLinkBoundaries(children) {
  for (let index = 0; index < children.length - 1; index += 1) {
    const current = children[index];
    const next = children[index + 1];

    if (
      current?.type !== "text" ||
      next?.type !== "element" ||
      next.tagName !== "a" ||
      !/\S\s+$/.test(current.value)
    ) {
      continue;
    }

    const leftWord = current.value.trimEnd().match(/\S+$/)?.[0] ?? "";
    const rightWord = getFirstTextWord(next);

    if (!leftWord || !rightWord) continue;

    if (
      typograf
        .execute(`${leftWord} ${rightWord}`)
        .startsWith(`${leftWord}\u00a0`)
    ) {
      current.value = current.value.replace(/\s+$/, "\u00a0");
    }
  }
}

function transformTextNodes(node, skipped = false) {
  if (!node || typeof node !== "object") return;

  if (node.type === "text" && !skipped) {
    node.value = typografText(node.value);
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

  if (!nextSkipped) {
    applyTypographyAcrossLinkBoundaries(node.children);
  }
}

export default function rehypeTypograf() {
  return tree => {
    transformTextNodes(tree);
  };
}
