import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const ROOT = path.resolve(__dirname, "../..");
export const DATA_DIR = path.join(ROOT, "data");
export const CACHE_DIR = path.join(ROOT, "scraper/.cache");
export const IMAGES_DIR = path.join(ROOT, "data/images");

export const BASE_URL = "https://www.rsr.transports.gouv.qc.ca";
export const PANNEAUX_URL = `${BASE_URL}/Dispositifs/Panneaux.aspx`;

/** Top-level category leaves (and nested) used for structured crawl. */
export const CATEGORY_SEEDS: { che: string; cat: string; pathFr: string[] }[] = [
  { che: "DANGR", cat: "DANGR", pathFr: ["Danger"] },
  { che: "PRESC", cat: "PRESC", pathFr: ["Prescription"] },
  { che: "TRAVX", cat: "TRAVX", pathFr: ["Travaux"] },
  { che: "PANCX", cat: "PANCX", pathFr: ["Panonceaux"] },
  { che: "INDCT-DESTN", cat: "DESTN", pathFr: ["Indication", "Destination"] },
  { che: "INDCT-EQUSP", cat: "EQUSP", pathFr: ["Indication", "Équipements spécifiques"] },
  { che: "INDCT-INFRM", cat: "INFRM", pathFr: ["Indication", "Information"] },
  { che: "INDCT-EQUTO-ARRHI", cat: "ARRHI", pathFr: ["Indication", "Équipements touristiques", "Site patrimonial"] },
  { che: "INDCT-EQUTO-ATTPR", cat: "ATTPR", pathFr: ["Indication", "Équipements touristiques", "Attraits privés"] },
  { che: "INDCT-EQUTO-ATTPU", cat: "ATTPU", pathFr: ["Indication", "Équipements touristiques", "Attraits publics"] },
  { che: "INDCT-EQUTO-INFTO", cat: "INFTO", pathFr: ["Indication", "Équipements touristiques", "Information touristique"] },
  { che: "INDCT-EQUTO-ITCHR", cat: "ITCHR", pathFr: ["Indication", "Équipements touristiques", "Itinéraire cyclable hors route"] },
  { che: "INDCT-EQUTO-PARRO", cat: "PARRO", pathFr: ["Indication", "Équipements touristiques", "Parcs routiers"] },
  { che: "INDCT-EQUTO-PICTG", cat: "PICTG", pathFr: ["Indication", "Équipements touristiques", "Pictogrammes"] },
  { che: "INDCT-EQUTO-RESFA", cat: "RESFA", pathFr: ["Indication", "Équipements touristiques", "Réserves, parcs et refuges fauniques"] },
  { che: "INDCT-EQUTO-ROUTO", cat: "ROUTO", pathFr: ["Indication", "Équipements touristiques", "Route touristique"] },
  { che: "INDCT-EQUTO-SERVC", cat: "SERVC", pathFr: ["Indication", "Équipements touristiques", "Services"] },
  { che: "INDCT-REPRG-DIVRS", cat: "DIVRS", pathFr: ["Indication", "Repérage", "Divers"] },
  { che: "INDCT-REPRG-ECUAU", cat: "ECUAU", pathFr: ["Indication", "Repérage", "Écussons d'autoroute"] },
  { che: "INDCT-REPRG-ECURO", cat: "ECURO", pathFr: ["Indication", "Repérage", "Écussons de route"] },
  { che: "INDCT-REPRG-LIMTT", cat: "LIMTT", pathFr: ["Indication", "Repérage", "Limite territoriale"] },
  { che: "INDCT-REPRG-NOMCP", cat: "NOMCP", pathFr: ["Indication", "Repérage", "Nom d'un chemin ou d'un pont"] },
  { che: "INDCT-REPRG-REPGE", cat: "REPGE", pathFr: ["Indication", "Repérage", "Repères géographiques"] },
  { che: "INDCT-REPRG-REPKI", cat: "REPKI", pathFr: ["Indication", "Repérage", "Repères kilométriques"] },
];

export const DEFAULT_DELAY_MS = 750;
export const NAV_TIMEOUT_MS = 60_000;
