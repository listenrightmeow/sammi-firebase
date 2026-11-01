import { describe, expect, it } from "vitest";
import { parseConfigBlock } from "./config-block.ts";

const CONFIG = {
  apiKey: "AIzaSyFAKEFAKEFAKEFAKEFAKEFAKEFAKEFAKE0",
  authDomain: "demo.firebaseapp.com",
  databaseURL: "https://demo-default-rtdb.firebaseio.com",
  projectId: "demo",
  storageBucket: "demo.firebasestorage.app",
  messagingSenderId: "123456789012",
  appId: "1:123456789012:web:0123456789abcdef012345",
  measurementId: "G-ABCDEFGHIJ",
};
const lines = Object.entries(CONFIG)
  .map(([k, v]) => `  ${k}: "${v}"`)
  .join(",\n");

describe("parseConfigBlock", () => {
  it("reads the console's config block, whose values hold colons", () => {
    expect(parseConfigBlock(`const firebaseConfig = {\n${lines}\n};`)).toEqual(CONFIG);
  });
  it("reads the whole npm snippet, skipping the import braces and the comments", () => {
    const snippet = [
      "// Import the functions you need from the SDKs you need",
      'import { initializeApp } from "firebase/app";',
      "// https://firebase.google.com/docs/web/setup#available-libraries",
      "const firebaseConfig = {",
      "  // a comment: inside the block",
      lines,
      "};",
      "const app = initializeApp(firebaseConfig);",
    ].join("\n");
    expect(parseConfigBlock(snippet)).toEqual(CONFIG);
  });
  it("reads a bare object, JSON, single quotes and a trailing comma", () => {
    expect(parseConfigBlock(JSON.stringify(CONFIG))).toEqual(CONFIG);
    expect(parseConfigBlock(`{ apiKey: 'a', appId: "1:2:web:3", }`)).toEqual({ apiKey: "a", appId: "1:2:web:3" });
  });
  it("answers undefined for text that is not a config block", () => {
    for (const bad of ["", "hello", "{", "{ }", "{ apiKey: 5 }", "const firebaseConfig = {"]) {
      expect(parseConfigBlock(bad)).toBeUndefined();
    }
  });
});
