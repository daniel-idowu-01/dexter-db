import { readdirSync } from "fs";
import { join } from "path";

const modelsPath = join(__dirname, "src", "models");
const files = readdirSync(modelsPath);

console.log("Files in models directory:", files);

files.forEach(file => {
  if (file.endsWith(".ts") && file !== "index.ts") {
    const filePath = join(modelsPath, file);
    console.log(`\nTrying to load: ${file}`);
    try {
      const model = require(filePath);
      console.log("Loaded:", model.default?.modelName || "No model found");
    } catch (error) {
      console.log("Error:", error);
    }
  }
});
