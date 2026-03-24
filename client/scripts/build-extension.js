import AdmZip from 'adm-zip';
import path from 'path';

const zip = new AdmZip();
const extensionFolder = path.resolve(process.cwd(), '../extension');
const outputFile = path.resolve(process.cwd(), 'public/JobPilot-Extension.zip');

try {
  console.log("Zipping extension from:", extensionFolder);
  zip.addLocalFolder(extensionFolder);
  zip.writeZip(outputFile);
  console.log("\n✅ Extension successfully zipped to public/JobPilot-Extension.zip");
} catch (error) {
  console.error("Error zipping extension:", error);
}
