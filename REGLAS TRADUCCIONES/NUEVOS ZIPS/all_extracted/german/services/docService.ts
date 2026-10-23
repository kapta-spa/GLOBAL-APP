
import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";
// @ts-ignore
import ImageModule from "docxtemplater-image-module-free";
import { ExtractedData } from "../types";
import { LICENSE_CLASS_DESCRIPTIONS } from "../constants";

const formatProfessionalDate = (date: Date): string => {
  const day = String(date.getDate()).padStart(2, '0');
  const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  return `${day} ${months[date.getMonth()]} ${date.getFullYear()}`;
};

export const extractClassesFromText = (text: string): string => {
  if (!text) return "";
  const upperInput = text.toUpperCase();
  const sortedClasses = Object.keys(LICENSE_CLASS_DESCRIPTIONS);
  const found: string[] = [];
  
  sortedClasses.forEach(className => {
    const regex = new RegExp(`(^|[^A-Z0-9])${className}([^A-Z0-9]|$)`);
    if (regex.test(upperInput)) {
      found.push(className);
    }
  });
  
  return found.join(", ");
};

export const generateClassDescriptions = (classString: string): string => {
  if (!classString) return "";
  
  const upperInput = classString.toUpperCase();
  const descriptions: string[] = [];
  
  // Sort keys to ensure consistent order
  const sortedClasses = Object.keys(LICENSE_CLASS_DESCRIPTIONS);
  
  sortedClasses.forEach(className => {
    // Check if the class name exists as a standalone category in the string
    const regex = new RegExp(`(^|[^A-Z0-9])${className}([^A-Z0-9]|$)`);
    if (regex.test(upperInput)) {
      const desc = LICENSE_CLASS_DESCRIPTIONS[className];
      descriptions.push(`${className} - ${desc}${desc.endsWith('.') ? '' : '.'}`);
    }
  });
  
  return descriptions.join("\n");
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

    const surname = val(data.surname);
    const firstName = val(data.firstName);
    const middleName = val(data.middleName);
    const firstNames = val(data.firstNames) || [firstName, middleName].filter(Boolean).join(" ");
    const fullName = val(data.fullName) || [surname, firstNames].filter(Boolean).join(" ");
    
    let licenseClass = val(data.class);
    if (!licenseClass && data.categoriesDates) {
      licenseClass = extractClassesFromText(data.categoriesDates);
    }

    const categoriesDates = val(data.categoriesDates);
    const classDescriptions = val(data.classDescriptions) || generateClassDescriptions(`${licenseClass} ${categoriesDates}`);
    const expiryDate = val(data.expiryDate) || "Indefinite";
    const todayStr = formatProfessionalDate(new Date());

    const fullData = {
      ...data,
      // English Standard Keys
      assignedNumber: val(data.assignedNumber),
      surname: surname,
      firstName: firstName,
      middleName: middleName,
      firstNames: firstNames,
      fullName: fullName,
      licenseNumber: val(data.licenseNumber),
      dateOfBirth: val(data.dateOfBirth),
      placeOfBirth: val(data.placeOfBirth),
      issueDate: val(data.issueDate),
      expiryDate: expiryDate,
      authority: val(data.authority),
      class: licenseClass,
      classDescriptions: classDescriptions,
      categoriesDates: categoriesDates,
      codes: val(data.codes),
      
      // Images
      foto_frente: frontImgBase64,
      foto_reverso: backImgBase64,
      license_front: frontImgBase64,
      license_back: backImgBase64,
      front_image: frontImgBase64,
      back_image: backImgBase64,
      
      // Date tags
      today: todayStr,
      fechaHoy: todayStr,
      fecha: todayStr,

      // Spanish and Common Synonym Tags
      apellidos: surname,
      apellido: surname,
      nombre: firstName,
      primerNombre: firstName,
      primer_nombre: firstName,
      segundoNombre: middleName,
      segundosNombres: middleName,
      segundo_nombre: middleName,
      nombres: firstNames,
      nombreCompleto: fullName,
      nombre_completo: fullName,
      numeroLicencia: val(data.licenseNumber),
      numero_licencia: val(data.licenseNumber),
      licencia: val(data.licenseNumber),
      fechaNacimiento: val(data.dateOfBirth),
      fecha_nacimiento: val(data.dateOfBirth),
      lugarNacimiento: val(data.placeOfBirth),
      lugar_nacimiento: val(data.placeOfBirth),
      fechaExpedicion: val(data.issueDate),
      fecha_expedicion: val(data.issueDate),
      fechaExpiracion: expiryDate,
      fecha_expiracion: expiryDate,
      fechaVencimiento: expiryDate,
      autoridad: val(data.authority),
      autoridadExpedidora: val(data.authority),
      clase: licenseClass,
      clases: licenseClass,
      categoria: licenseClass,
      categorias: licenseClass,
      descripcionClases: classDescriptions,
      descripcion_clases: classDescriptions,
      fechasCategorias: categoriesDates,
      fechas_categorias: categoriesDates,
      codigos: val(data.codes),
      restricciones: val(data.codes),
      numeroAsignado: val(data.assignedNumber),
      numero_asignado: val(data.assignedNumber),
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
