from pathlib import Path
import subprocess

_root = Path(__file__).resolve().parents[2]
TARGET_FILES_SOURCE = subprocess.check_output([
    "node", "--input-type=module", "-e",
    'import { TARGET_MODULE_SOURCES } from "./src/target-channel/deployment-source/assemble-runtime-source.ts"; '
    'process.stdout.write(TARGET_MODULE_SOURCES.files);',
], cwd=_root, universal_newlines=True)
