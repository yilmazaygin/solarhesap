import os
import re

file_path = "app/modelchain/page.tsx"
with open(file_path, "r") as f:
    content = f.read()

# 1. Add imports
import_str = """import { useLanguage } from "@/context/LanguageContext";
import { ModuleConfig, TempConfig, InverterConfig, ArrayState, defaultModuleConfig, DEFAULT_FLAT_MODULE, DEFAULT_INVERTER, defaultTempConfig, defaultArray } from "@/lib/advanced-types";
import SAMSearch from "@/components/simulation/advanced/SAMSearch";
import ModulePanel from "@/components/simulation/advanced/ModulePanel";
import TempPanel from "@/components/simulation/advanced/TempPanel";
import InverterPanel from "@/components/simulation/advanced/InverterPanel";
"""
content = content.replace('import { useLanguage } from "@/context/LanguageContext";', import_str)

# 2. Delete lines 25-499 (approx)
# Find the start of types
start_idx = content.find("/* ─── Types ─────────────────────────────────────────── */")
# Find the start of payload builder
end_idx = content.find("/* ─── Payload builder ───────────────────────────────── */")

if start_idx != -1 and end_idx != -1:
    content = content[:start_idx] + content[end_idx:]

# 3. Rename components in the rest of the file
content = content.replace("<ModuleConfigPanel ", "<ModulePanel ")
content = content.replace("<TempConfigPanel ", "<TempPanel ")
content = content.replace("<InverterConfigPanel ", "<InverterPanel ")

# Also remove searchSamComponents from imports if it's there
content = content.replace("searchSamComponents", "")

with open(file_path, "w") as f:
    f.write(content)

print("Done refactoring modelchain/page.tsx")
