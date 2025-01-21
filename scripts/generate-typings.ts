import ts from "typescript";
import fs from "fs";
import path from "path";

// 1) The directory we scan for .ts files
const SRC_DIR = path.resolve("src");
// 2) Output file
const OUTPUT_FILE = path.resolve("src/global.d.ts");

// Collect interface declarations
const collectedInterfaces: string[] = [];

// Helper to recursively scan files
function scanDir(dir: string) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      scanDir(fullPath);
    } else if (entry.isFile() && entry.name.endsWith(".d.ts")) {
      parseFile(fullPath);
    }
  }
}

function parseFile(filePath: string) {
  const sourceCode = fs.readFileSync(filePath, "utf-8");
  const sourceFile = ts.createSourceFile(
    filePath,
    sourceCode,
    ts.ScriptTarget.ESNext,
    /*setParentNodes*/ true
  );

  // Walk the AST to find interface declarations
  sourceFile.forEachChild((node) => {
    if (ts.isInterfaceDeclaration(node)) {
      // This is a top-level interface
      // const interfaceName = node.name.text; // name of the interface

      // For simplicity, let's just extract the text of this interface
      const textOfInterface = sourceCode.slice(node.pos, node.end);

      // Store it
      collectedInterfaces.push(textOfInterface);
    }
  });
}

function main() {
  // 1) Recursively scan 'src' dir
  scanDir(SRC_DIR);

  // 2) Build the global .d.ts content
  let output = `/* 
    Not a good practice to use global definitions, but here's a way to do it.
  
    AUTO-GENERATED FILE: DO NOT EDIT
  */\n`;
  output += `declare global {\n\n`;
  for (const intf of collectedInterfaces) {
    // Indent or reformat if needed
    output += `  ${intf.replace(/\n/g, "\n  ")}\n\n`;
  }
  output += `}\n\nexport {};\n`;

  // 3) Write to file
  fs.writeFileSync(OUTPUT_FILE, output, "utf-8");
  console.log(`Global definitions written to: ${OUTPUT_FILE}`);
}

main();
