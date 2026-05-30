const fs = require('fs');

const filePath = "app/historical/page.tsx";
let content = fs.readFileSync(filePath, "utf-8");

// 1. Delete lines 50 to 264
// We can find "interface ModuleConfig" and "function parseJsonOrNull"
const startIdx = content.indexOf("interface ModuleConfig {");
const endIdx = content.indexOf("/* ═══════════════════════════════════════════════════════\n   Helpers\n   ═══════════════════════════════════════════════════════ */");

if (startIdx !== -1 && endIdx !== -1) {
    // Delete the block
    content = content.slice(0, startIdx) + content.slice(endIdx);
}

// 2. Add imports at the top
const extraImports = `
import { ModuleConfig, TempConfig, InverterConfig, ArrayState, defaultModuleConfig, DEFAULT_FLAT_MODULE, DEFAULT_INVERTER, defaultTempConfig, defaultArray } from "@/lib/advanced-types";
import ModulePanel from "@/components/simulation/advanced/ModulePanel";
import TempPanel from "@/components/simulation/advanced/TempPanel";
import InverterPanel from "@/components/simulation/advanced/InverterPanel";
import { AOI_MODELS, SPECTRAL_MODELS, LOSSES_MODELS, DC_MODELS, AC_MODELS } from "@/lib/constants";
`;

content = content.replace('import Modal from "@/components/shared/Modal";', 'import Modal from "@/components/shared/Modal";\n' + extraImports);
content = content.replace(', searchSamComponents', '');

// 3. Rename usages
content = content.replace(/<ModulePanel/g, '<ModulePanel'); // It's already named ModulePanel in historical!

fs.writeFileSync(filePath, content);
console.log("Done refactoring historical/page.tsx");
