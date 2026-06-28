import assert from "node:assert/strict";
import test from "node:test";
import rehypeTypograf from "../src/utils/rehypeTypograf.js";

function runPlugin(tree) {
  rehypeTypograf()(tree);
  return tree;
}

test("applies typograf rules to text nodes", () => {
  const tree = {
    type: "root",
    children: [
      {
        type: "element",
        tagName: "p",
        children: [
          {
            type: "text",
            value: 'В 2026 году "релиз" - это 10 кг пользы...',
          },
        ],
      },
    ],
  };

  runPlugin(tree);

  assert.equal(
    tree.children[0].children[0].value,
    "В\u00a02026 году «релиз»\u00a0— это 10 кг\u00a0пользы…"
  );
});

test("does not typograf code blocks or inline code", () => {
  const tree = {
    type: "root",
    children: [
      {
        type: "element",
        tagName: "p",
        children: [
          {
            type: "element",
            tagName: "code",
            children: [{ type: "text", value: '"const x = 1" - ok...' }],
          },
        ],
      },
      {
        type: "element",
        tagName: "pre",
        children: [{ type: "text", value: '"code" - ok...' }],
      },
    ],
  };

  runPlugin(tree);

  assert.equal(tree.children[0].children[0].children[0].value, '"const x = 1" - ok...');
  assert.equal(tree.children[1].children[0].value, '"code" - ok...');
});
