/**
 * Quick self-check for list HTML parsing (run: pnpm --filter @panneaux/scraper exec tsx src/parse.test.ts)
 */
import assert from "node:assert/strict";
import { parseListPage } from "./parse.js";

const FIXTURE = `
<html><body>
<a href="/Dispositifs/Details.aspx?cid=12571&che=DANGR&cat=DANGR" title="Voir le détail du dispositif D-230-6.">
  <img src="/Gestionnaires/ObtenirImage.ashx?imgId=12571" alt="Pente raide composée" />
  <strong>D-230-6</strong>
  <strong>Pente raide composée</strong>
</a>
<a href="/Utilitaires/Devis.aspx?cid=12571">Devis</a>
<a href="/Dispositifs/Details.aspx?cid=13792&che=INDCT-REPRG-ECURO&cat=ECURO">
  <strong>Rte-261</strong>
  <strong>Écusson route 261</strong>
</a>
</body></html>
`;

const items = parseListPage(FIXTURE, {
  che: "DANGR",
  cat: "DANGR",
  pathFr: ["Danger"],
});

assert.equal(items.length, 2);
assert.equal(items[0]?.cid, 12571);
assert.equal(items[0]?.code, "D-230-6");
assert.equal(items[0]?.nameFr, "Pente raide composée");
assert.equal(items[0]?.hasDevis, true);
assert.equal(items[1]?.code, "Rte-261");
assert.equal(items[1]?.cat, "ECURO");

console.log("parse.test.ts OK", items.map((i) => i.code).join(", "));
