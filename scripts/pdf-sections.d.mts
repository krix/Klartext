export interface PdfSection {
  no: string;
  page: number;
  rule: string;
  words: string[];
  build?: Array<[string, string[]]>;
  pairs?: Array<[string, string]>;
  error?: Array<[string, string]>;
  sentences?: string[];
}

export declare const pdfSections: PdfSection[];
