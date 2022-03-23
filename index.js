import pdfformJS from "./pdfform";
// we are only supporting basic pdf
import minipdf from "./minipdf";

const pdfform = () => {
  return pdfformJS(minipdf);
};

export default pdfform;
