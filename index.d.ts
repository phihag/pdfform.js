declare function pdfform(): {
    list_fields(pdf: ArrayBuffer | string): {},
    transform(): string,
}
export as namespace pdfform;
export = pdfform;
