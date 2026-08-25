import assert from "node:assert/strict";
import test from "node:test";
import { getActiveNavHref, navItems } from "../src/navigation.js";

test("selects page navigation items from the current pathname", () => {
  assert.equal(getActiveNavHref(navItems, "/product", ""), "/product");
  assert.equal(getActiveNavHref(navItems, "/pricing/", ""), "/pricing");
});

test("selects exact section links before their parent page", () => {
  assert.equal(getActiveNavHref(navItems, "/", "#workflow"), "/#workflow");
  assert.equal(getActiveNavHref(navItems, "/", "#proof"), "/#proof");
  assert.equal(getActiveNavHref(navItems, "/product", "#docs"), "/product#docs");
});

test("keeps the parent page active for unrelated anchors", () => {
  assert.equal(getActiveNavHref(navItems, "/product", "#demo"), "/product");
  assert.equal(getActiveNavHref(navItems, "/", "#demo"), null);
  assert.equal(getActiveNavHref(navItems, "/unknown", ""), null);
});
