/**
 * Self-check for list + detail HTML parsing.
 * Run: pnpm --filter @panneaux/scraper exec tsx src/parse.test.ts
 */
import assert from "node:assert/strict";
import { parseDetailPage, parseListPage, parseListPagination } from "./parse.js";

const LIST_FIXTURE = `
<html><body>
<p>Page 1 sur 23</p>
<div class="fond">
  <a href="../Dispositifs/Details.aspx?cid=12451&amp;cat=DANGR&amp;che=DANGR"
     title="Voir le détail du dispositif D-100-10-D." class="lienCombiner">
    <div class="ImgDispositif">
      <img src="../Gestionnaires/ObtenirImage.ashx?imgId=12451" alt="Signal avancé de direction des voies">
    </div>
    <div class="numero">
      <strong>
        D-100-10-D<br>
        <span class="nomDispositif">Signal avancé de direction des voies</span>
      </strong>
    </div>
  </a>
  <a class="btn_devis_contenu" href="../Utilitaires/Devis.aspx?cid=12451" target="_blank">Devis</a>
</div>
<div class="fond">
  <a href="../Dispositifs/Details.aspx?cid=13792&amp;cat=ECURO&amp;che=INDCT-REPRG-ECURO"
     title="Voir le détail du dispositif Rte-261." class="lienCombiner">
    <img alt="Écusson route 261" src="../Gestionnaires/ObtenirImage.ashx?imgId=13792">
    <strong>Rte-261<br><span class="nomDispositif">Écusson route 261</span></strong>
  </a>
</div>
</body></html>
`;

const DETAIL_FIXTURE = `
<html><body>
<span id="ctl00_cphContenu_FicheDetails_txtNumero">Auto-05</span>
<span id="ctl00_cphContenu_FicheDetails_txtNom">Écusson autoroute 5</span>
<span id="ctl00_cphContenu_FicheDetails_txtDescription">Identification de l'autoroute 5.</span>
<span id="ctl00_cphContenu_FicheDetails_txtUsage">Route</span>
<span id="ctl00_cphContenu_FicheDetails_txtCouleur">Bleu</span>
<span id="ctl00_cphContenu_FicheDetails_txtTypePellicule">IV</span>
<span id="ctl00_cphContenu_FicheDetails_txtReferenceTomeV">5.5.2</span>
<div id="ctl00_cphContenu_FicheDetails_btnUCDevisTexte_divSansDevis"></div>
<img src="../Gestionnaires/ObtenirImage.ashx?imgId=12392" alt="Écusson autoroute 5">
</body></html>
`;

const items = parseListPage(LIST_FIXTURE, {
  che: "DANGR",
  cat: "DANGR",
  pathFr: ["Danger"],
});

assert.equal(items.length, 2);
assert.equal(items[0]?.cid, 12451);
assert.equal(items[0]?.code, "D-100-10-D");
assert.equal(items[0]?.nameFr, "Signal avancé de direction des voies");
assert.equal(items[0]?.hasDevis, true);
assert.equal(items[1]?.code, "Rte-261");
assert.equal(items[1]?.cat, "ECURO");

const pag = parseListPagination(LIST_FIXTURE);
assert.deepEqual(pag, { page: 1, total: 23 });

const detail = parseDetailPage(DETAIL_FIXTURE);
assert.equal(detail.code, "Auto-05");
assert.equal(detail.nameFr, "Écusson autoroute 5");
assert.equal(detail.descriptionFr, "Identification de l'autoroute 5.");
assert.equal(detail.usage, "Route");
assert.equal(detail.couleur, "Bleu");
assert.equal(detail.pellicule, "IV");
assert.equal(detail.tomeV, "5.5.2");
assert.equal(detail.hasDevis, false);

console.log("parse.test.ts OK");
