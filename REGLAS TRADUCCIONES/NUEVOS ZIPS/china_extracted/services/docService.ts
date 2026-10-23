
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
        const maxWidth = 800;
        const scale = img.width > maxWidth ? maxWidth / img.width : 1;
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        if (ctx) {
          ctx.fillStyle = "white";
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        }
        const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
        resolve(dataUrl);
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
  images: string[] 
): Promise<Blob> => {
  try {
    const arrayBuffer = await template.arrayBuffer();
    const zip = new PizZip(new Uint8Array(arrayBuffer));

    const imageOptions = {
      centered: false,
      getImage: (tagValue: string) => {
        if (!tagValue) return new ArrayBuffer(0);
        const base64 = tagValue.includes(',') ? tagValue.split(',')[1] : tagValue;
        const binaryString = window.atob(base64);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        return bytes.buffer;
      },
      getSize: () => [280, 175], // Tamaño tarjeta estándar en el Word
    };

    const ImageModuleClass = ImageModule.default || ImageModule;
    const DocxtemplaterClass = (Docxtemplater as any).default || Docxtemplater;

    // IMPORTANTE: Usamos los delimitadores estándar {{ y }}
    const doc = new DocxtemplaterClass(zip, {
      paragraphLoop: true,
      linebreaks: true,
      delimiters: { start: "{{", end: "}}" },
      modules: [new ImageModuleClass(imageOptions)],
      nullGetter() { return ""; }
    });

    const val = (v: any) => (v === undefined || v === null || String(v) === "N/A" ? "" : String(v));

    const renderData = {
      ...data,
      assignedNumber: val(data.assignedNumber),
      surname: val(data.surname),
      firstName: val(data.firstName),
      fullName: val(data.fullName),
      licenseNumber: val(data.licenseNumber),
      fileNumber: val(data.fileNumber),
      barcodeNumber: val(data.barcodeNumber),
      dateOfBirth: val(data.dateOfBirth),
      firstIssued: val(data.firstIssued),
      issueDate: val(data.issueDate),
      expiryDate: val(data.expiryDate),
      class: val(data.class),
      authority: val(data.authority),
      address: val(data.address),
      explicacionCodigos: val(data.explicacionCodigos),
      validPeriod: `${val(data.issueDate)} - ${val(data.expiryDate)}`,
      // Para las imágenes, la clave en el JSON NO lleva el %
      foto_1: images[0] || "",
      foto_2: images[1] || "",
      foto_3: images[2] || "",
      foto_4: images[3] || "",
      today: formatProfessionalDate(new Date()),
      fechaHoy: formatProfessionalDate(new Date()),
    };

    doc.render(renderData);

    return doc.getZip().generate({
      type: "blob",
      mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      compression: "DEFLATE",
    });
  } catch (error: any) {
    console.error("Error detallado:", error);
    if (error.properties && error.properties.errors) {
      const messages = error.properties.errors.map((e: any) => e.message).join(" | ");
      throw new Error(`Error en el Word: ${messages}. Revisa que las llaves {{ }} estén bien escritas.`);
    }
    throw new Error(error.message || "Error desconocido al generar el Word.");
  }
};
