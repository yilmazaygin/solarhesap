const fs = require('fs');

const filePath = "app/modelchain/page.tsx";
let content = fs.readFileSync(filePath, "utf-8");

// 1. Add imports
const importStr = `import { useLanguage } from "@/context/LanguageContext";
import { ModuleConfig, TempConfig, InverterConfig, ArrayState, defaultModuleConfig, DEFAULT_FLAT_MODULE, DEFAULT_INVERTER, defaultTempConfig, defaultArray } from "@/lib/advanced-types";
import SAMSearch from "@/components/simulation/advanced/SAMSearch";
import ModulePanel from "@/components/simulation/advanced/ModulePanel";
import TempPanel from "@/components/simulation/advanced/TempPanel";
import InverterPanel from "@/components/simulation/advanced/InverterPanel";
`;
content = content.replace('import { useLanguage } from "@/context/LanguageContext";', importStr);

// 2. Delete lines
const startIdx = content.indexOf("/* ─── Types ─────────────────────────────────────────── */");
const endIdx = content.indexOf("/* ─── Payload builder ───────────────────────────────── */");

if (startIdx !== -1 && endIdx !== -1) {
    content = content.slice(0, startIdx) + content.slice(endIdx);
}

// 3. Rename components
content = content.replace(/<ModuleConfigPanel /g, "<ModulePanel ");
content = content.replace(/<TempConfigPanel /g, "<TempPanel ");
content = content.replace(/<InverterConfigPanel /g, "<InverterPanel ");
content = content.replace(/, searchSamComponents/g, "");

fs.writeFileSync(filePath, content);
console.log("Done refactoring modelchain/page.tsx");
