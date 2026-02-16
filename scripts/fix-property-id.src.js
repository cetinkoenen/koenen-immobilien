import fs from "fs";
import path from "path";

const ROOT = process.cwd();

function walk(dir) {
  for (const file of fs.readdirSync(dir)) {
    const full = path.join(dir, file);

    if (file === "node_modules" || file.startsWith(".")) continue;

    if (fs.statSync(full).isDirectory()) {
      walk(full);
    } else if (/\.(js|ts|tsx|jsx)$/.test(file)) {
      let content = fs.readFileSync(full, "utf8");

      if (content.includes("property.core_property_id")) {
        content = content.replaceAll(
          "property.core_property_id",
          "property.id"
        );
        fs.writeFileSync(full, content);
        console.log("✔ fixed:", full);
      }
    }
  }
}

walk(ROOT);
