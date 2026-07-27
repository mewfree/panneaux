export type ScrapedListItem = {
  cid: number;
  code: string;
  nameFr: string;
  hasDevis: boolean;
  che: string;
  cat: string;
  pathFr: string[];
};

export type Panneau = {
  cid: number;
  code: string;
  nameFr: string;
  nameEn?: string;
  descriptionFr?: string;
  descriptionEn?: string;
  category: {
    che: string;
    cat: string;
    pathFr: string[];
  };
  hasDevis: boolean;
  imageKey: string;
  sourceUrl: string;
  scrapedAt: string;
};

export type CatalogFile = {
  version: number;
  scrapedAt: string;
  source: string;
  count: number;
  panneaux: Panneau[];
};

export type ScrapeReport = {
  startedAt: string;
  finishedAt: string;
  sample: boolean;
  categoriesAttempted: number;
  itemsListed: number;
  detailsFetched: number;
  imagesDownloaded: number;
  errors: { where: string; message: string }[];
};
