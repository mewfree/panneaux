export type ScrapedListItem = {
  cid: number;
  code: string;
  nameFr: string;
  hasDevis: boolean;
  che: string;
  cat: string;
  pathFr: string[];
};

export type { CatalogFile, Panneau } from "../../data/types.js";

export type ScrapeReport = {
  startedAt: string;
  finishedAt: string;
  sample: boolean;
  categoriesAttempted: number;
  itemsListed: number;
  detailsFetched: number;
  imagesDownloaded: number;
  imageFailures: number;
  pagesCrawled: number;
  errors: { where: string; message: string }[];
};

export type DetailFields = {
  code?: string;
  nameFr?: string;
  descriptionFr?: string;
  usage?: string;
  couleur?: string;
  pellicule?: string;
  tomeV?: string;
  hasDevis?: boolean;
  imgAlt?: string;
};
