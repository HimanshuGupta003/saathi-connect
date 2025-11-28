import i18n from "i18n";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

i18n.configure({
  locales: [
    "en",
    "hi",
    "mr",
    "bn",
    "ta",
    "te",
    "kn",
    "ml",
    "gu",
    "pa",
    "or",
    "ur",
  ],
  directory: path.join(__dirname, "../locales"),
  defaultLocale: "en",
  objectNotation: true,
});

export default i18n;
