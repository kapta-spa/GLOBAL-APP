
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

    // Rules for Reglas Latino:
    // 1. Fields to be deleted/removed if empty or not indicated: organs, address, nationality
    const valOmitIfEmpty = (v: any) => {
      if (v === undefined || v === null || v === "" || v === "null" || v === "undefined" || v === "N/A" || v === "-") {
        return "";
      }
      return String(v).trim();
    };

    // 2. All other fields must have "-" if no data:
    const valWithDash = (v: any) => {
      if (v === undefined || v === null || v === "" || v === "null" || v === "undefined" || v === "N/A") {
        return "-";
      }
      const trimmed = String(v).trim();
      return trimmed === "" ? "-" : trimmed;
    };

    const expText = data.explicacion || data.explicacionCodigos || "-";
    const organText = valOmitIfEmpty(data.organs || data.organDonor || data.donor || data.donante);
    const addressText = valOmitIfEmpty(data.address || data.domicilio || data.direccion);
    const natText = valOmitIfEmpty(data.nationality || data.nacionalidad);
    const genderText = valWithDash(data.gender || data.sex || data.sexo || data.genero);

    const firstN = valWithDash(data.firstName);
    const midN = data.middleName && data.middleName !== '-' ? data.middleName.trim() : '';
    const fullN = data.fullName && data.fullName !== '-' 
      ? data.fullName 
      : `${valWithDash(data.surname)} ${firstN} ${midN}`.trim();
    const allFirsts = data.firstNames && data.firstNames !== '-'
      ? data.firstNames
      : `${firstN} ${midN}`.trim();

    const fullData = {
      ...data,
      assignedNumber: data.assignedNumber ? String(data.assignedNumber).trim() : "",
      surname: valWithDash(data.surname),
      firstName: firstN,
      middleName: data.middleName ? String(data.middleName).trim() : "-",
      firstNames: allFirsts || "-",
      fullName: fullN || "-",
      
      // Latin America Rules Fields
      gender: genderText,
      sex: genderText,
      sexo: genderText,
      genero: genderText,

      organs: organText,
      organDonor: organText,
      donor: organText,
      donante: organText,
      donador: organText,
      organos: organText,

      address: addressText,
      domicilio: addressText,
      direccion: addressText,

      nationality: natText,
      nacionalidad: natText,

      explicacion: expText,
      explicacionCodigos: expText,
      explanation: expText,

      licenseNumber: valWithDash(data.licenseNumber),
      licenceNumber: valWithDash(data.licenseNumber),
      folio: valWithDash(data.licenseNumber),
      numeroLicencia: valWithDash(data.licenseNumber),

      dateOfBirth: valWithDash(data.dateOfBirth),
      dob: valWithDash(data.dateOfBirth),
      fechaNacimiento: valWithDash(data.dateOfBirth),

      placeOfBirth: valWithDash(data.placeOfBirth),
      pob: valWithDash(data.placeOfBirth),
      lugarNacimiento: valWithDash(data.placeOfBirth),

      issueDate: valWithDash(data.issueDate),
      expeditionDate: valWithDash(data.issueDate),
      fechaExpedicion: valWithDash(data.issueDate),

      expiryDate: valWithDash(data.expiryDate),
      expirationDate: valWithDash(data.expiryDate),
      fechaVencimiento: valWithDash(data.expiryDate),
      vigencia: valWithDash(data.expiryDate),

      authority: valWithDash(data.authority),
      autoridad: valWithDash(data.authority),

      class: valWithDash(data.class),
      clase: valWithDash(data.class),
      category: valWithDash(data.class),
      categoria: valWithDash(data.class),

      curp: valWithDash(data.curp),
      rfc: valWithDash(data.curp),
      dni: valWithDash(data.curp),
      rut: valWithDash(data.curp),
      cedula: valWithDash(data.curp),

      blood: valWithDash(data.blood),
      bloodType: valWithDash(data.blood),
      sangre: valWithDash(data.blood),
      rh: valWithDash(data.blood),

      barcode: valWithDash(data.barcode),
      codes: valWithDash(data.codes),
      categoriesDates: valWithDash(data.categoriesDates),

      foto_frente: frontImgBase64,
      foto_reverso: backImgBase64,
      license_front: frontImgBase64,
      license_back: backImgBase64,
      today: formatProfessionalDate(new Date()),
      fechaHoy: formatProfessionalDate(new Date()),
      date: formatProfessionalDate(new Date()),
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
