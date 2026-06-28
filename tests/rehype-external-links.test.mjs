import assert from "node:assert/strict";
import test from "node:test";
import rehypeExternalLinks from "../src/utils/rehypeExternalLinks.js";

function runPlugin(tree) {
  rehypeExternalLinks({ siteUrl: "https://site.test" })(tree);
  return tree;
}

test("adds blank target and safe rel to external links only", () => {
  const tree = {
    type: "root",
    children: [
      {
        type: "element",
        tagName: "a",
        properties: { href: "https://external.test" },
        children: [],
      },
      {
        type: "element",
        tagName: "a",
        properties: { href: "https://site.test/about" },
        children: [],
      },
      {
        type: "element",
        tagName: "a",
        properties: { href: "/posts/example" },
        children: [],
      },
    ],
  };

  runPlugin(tree);

  assert.deepEqual(tree.children[0].properties, {
    href: "https://external.test",
    target: "_blank",
    rel: ["noopener", "noreferrer"],
  });
  assert.deepEqual(tree.children[1].properties, {
    href: "https://site.test/about",
  });
  assert.deepEqual(tree.children[2].properties, {
    href: "/posts/example",
  });
});
