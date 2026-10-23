
import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";
// @ts-ignore
import ImageModule from "docxtemplater-image-module-free";
import { ExtractedData } from "../types";

const formatProfessionalDate = (date: Date): string => {
  const day = String(date.getDate()).padStart(2, '0');
  const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  return `${day} ${months[date.getMonth()]} ${date.getFullYear()}`;
};

export const optimizeImage = async (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const maxWidth = 1000;
        const scale = img.width > maxWidth ? maxWidth / img.width : 1;
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        if (ctx) {
          ctx.fillStyle = "white";
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        }
        resolve(canvas.toDataURL('image/jpeg', 0.85));
      };
      img.onerror = () => reject(new Error("Error loading image."));
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  });
};

export const generateFilledDoc = async (
  template: File,
  data: ExtractedData,
  frontImgBase64: string,
  backImgBase64: string
): Promise<Blob> => {
  try {
    const arrayBuffer = await template.arrayBuffer();
    const zip = new PizZip(new Uint8Array(arrayBuffer));

    const imageOptions = {
      centered: false,
      getImage: (tagValue: string) => {
        const base64 = tagValue.includes(',') ? tagValue.split(',')[1] : tagValue;
        const binaryString = window.atob(base64);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
        return bytes.buffer;
      },
      getSize: () => [312, 195],
    };

    const ImageModuleClass = ImageModule.default || ImageModule;
    const doc = new Docxtemplater(zip, {
      paragraphLoop: true,
      linebreaks: true,
      modules: [new ImageModuleClass(imageOptions)],
      delimiters: { start: '{{', end: '}}' },
      nullGetter() { return ""; }
    });

    const val = (v: any) => (v === undefined || v === null || v === "N/A" || v === "null" ? "" : String(v));

    const fullData = {
      ...data,
      assignedNumber: val(data.assignedNumber),
      surname: val(data.surname),
      firstName: val(data.firstName),
      middleName: val(data.middleName),
      registration: val(data.registration),
      serial: val(data.serial),
      period: val(data.period),
      firstNames: val(data.firstNames || `${data.firstName} ${data.middleName}`.trim()),
      fullName: val(data.fullName || `${data.surname} ${data.firstName} ${data.middleName}`.trim()),
      class: val(data.class),
      categoriesDates: val(data.categoriesDates),
      codes: val(data.codes),
      licenseNumber: val(data.licenseNumber),
      authority: val(data.authority),
      foto_frente: frontImgBase64,
      foto_reverso: backImgBase64,
      license_front: frontImgBase64,
      license_back: backImgBase64,
      today: formatProfessionalDate(new Date()),
      fechaHoy: formatProfessionalDate(new Date()),
    };

    doc.render(fullData);
    return doc.getZip().generate({
      type: "blob",
      mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      compression: "DEFLATE",
    });
  } catch (error: any) {
    throw new Error(error.message || "Error generating Word file.");
  }
};
