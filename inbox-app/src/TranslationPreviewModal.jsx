import React, { useState, useEffect } from 'react';
import { X, Save, Download, ArrowRight, RefreshCw, FileText, CheckCircle2 } from 'lucide-react';
import { generateClassDescriptions, generateBrazilClassDescriptions, generateChinaClassDescriptions, generateItalyClassDescriptions, normalizeItalianAuthority, filterClassDescriptionsByHeldClasses, formatCategoriesDates, formatLicenseClasses, formatJapanLicenseClasses, getCleanJapanCondition, formatClassDescriptions, getCleanGermanCodes } from './utils/classDescriptions';
import { getAssignedNumber, loadCountryTemplate } from './utils/documentGenerator';
import { getNormalizedCountryKey, formatBrazilAuthority, sanitizeAuthority } from './utils/geminiApi';
import { COUNTRY_TEMPLATES } from './config/countryPrompts';

export const AVAILABLE_TEMPLATES = [
  { id: 'alemania.docx', label: '🇩🇪 Alemania (Germany - alemania.docx)' },
  { id: 'brazil.docx', label: '🇧🇷 Brasil (Brazil CNH - brazil.docx)' },
  { id: 'china.docx', label: '🇨🇳 China (china.docx)' },
  { id: 'francia.docx', label: '🇫🇷 Francia (France - francia.docx)' },
  { id: 'francia_pink.docx', label: '🇫🇷 Francia Rosa (France Pink - francia_pink.docx)' },
  { id: 'spain.docx', label: '🇪🇸 España (Spain - spain.docx)' },
  { id: 'italia.docx', label: '🇮🇹 Italia (Italy - italia.docx)' },
  { id: 'portugal.docx', label: '🇵🇹 Portugal (portugal.docx)' },
  { id: 'latino.docx', label: '🌎 Reino Unido / Latino / Internacional (latino.docx)' },
  { id: 'netherlands.docx', label: '🇳🇱 Países Bajos (Netherlands - netherlands.docx)' },
  { id: 'belgica.docx', label: '🇧🇪 Bélgica (Belgium - belgica.docx)' },
  { id: 'canada.docx', label: '🇨🇦 Canadá (Canada - canada.docx)' },
  { id: 'czech.docx', label: '🇨🇿 Rep. Checa (Czech Republic - czech.docx)' },
  { id: 'denmark.docx', label: '🇩🇰 Dinamarca (Denmark - denmark.docx)' },
  { id: 'finland.docx', label: '🇫🇮 Finlandia (Finland - finland.docx)' },
  { id: 'hungria.docx', label: '🇭🇺 Hungría (Hungary - hungria.docx)' },
  { id: 'indonesia.docx', label: '🇮🇩 Indonesia (indonesia.docx)' },
  { id: 'israel.docx', label: '🇮🇱 Israel (israel.docx)' },
  { id: 'japon.docx', label: '🇯🇵 Japón (Japan - japon.docx)' },
  { id: 'korea.docx', label: '🇰🇷 Corea del Sur (Korea - korea.docx)' },
  { id: 'norway.docx', label: '🇳🇴 Noruega (Norway - norway.docx)' },
  { id: 'suiza.docx', label: '🇨🇭 Suiza (Switzerland - suiza.docx)' },
  { id: 'swedish.docx', label: '🇸🇪 Suecia (Sweden - swedish.docx)' },
  { id: 'taiwan.docx', label: '🇹🇼 Taiwán (taiwan.docx)' },
  { id: 'vietnam.docx', label: '🇻🇳 Vietnam (vietnam.docx)' },
];

export default function TranslationPreviewModal({ 
  isOpen, 
  onClose, 
  initialData, 
  folderName,
  onSave,
  onDownloadWord
}) {
  const [formData, setFormData] = useState(initialData || {});
  const [selectedTemplate, setSelectedTemplate] = useState('alemania.docx');
  const [templateFile, setTemplateFile] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    if (initialData) {
      const normalized = {};
      for (const [key, val] of Object.entries(initialData)) {
        if (val === null || val === undefined) {
          normalized[key] = '';
        } else if (typeof val === 'object') {
          if (Array.isArray(val)) {
            normalized[key] = val.map(item => typeof item === 'object' ? JSON.stringify(item) : String(item)).join('\n');
          } else {
            normalized[key] = Object.values(val).filter(Boolean).map(v => typeof v === 'object' ? JSON.stringify(v) : String(v)).join(' ');
          }
        } else {
          normalized[key] = String(val);
        }
      }

      // Auto-populate assignedNumber if missing
      if (!normalized.assignedNumber || normalized.assignedNumber.trim() === '' || normalized.assignedNumber.trim() === '-') {
        if (folderName) {
          normalized.assignedNumber = getAssignedNumber(folderName);
        }
      }

      // Synchronize Brazil identifiers across all variations
      const rawCardNumber = normalized.cardNumber || normalized.card_number || normalized.cardNumberVertical || normalized.numeroEspelho || normalized.numero_espelho || normalized.espelho || normalized.nEspelho || normalized.serialNumber || normalized.serial;
      if (rawCardNumber) normalized.cardNumber = String(rawCardNumber).trim();

      const rawIdDoc = normalized.idDocument || normalized.id_document || normalized.docIdentidade || normalized.doc_identidade || normalized.identityDocument || normalized.rg || normalized.identidade || normalized.sec4c || normalized.point4c;
      if (rawIdDoc) normalized.idDocument = String(rawIdDoc).trim();

      const rawCpf = normalized.cpf || normalized.CPF || normalized.individualTaxpayerNumber || normalized.taxpayerNumber || normalized.taxId || normalized.taxNumber || normalized.sec4d || normalized.point4d;
      if (rawCpf) {
        normalized.cpf = String(rawCpf).trim();
        normalized.personal = normalized.cpf;
        normalized.point4d = normalized.cpf;
      }

      const rawParents = normalized.parents || normalized.filiação || normalized.filiacao || normalized.nameOfParents || normalized.parentNames || normalized.parentsNames || normalized.motherName || normalized.fatherName;
      if (rawParents) {
        normalized.parents = String(rawParents).toUpperCase().trim();
        normalized.nameOfParents = normalized.parents;
        normalized.filiação = normalized.parents;
        normalized.filiacao = normalized.parents;
      }

      const folderLower = (folderName || '').toLowerCase();
      const isChina = (normalized.nationality && /chin/i.test(normalized.nationality)) ||
                      (normalized.authority && /chin|车辆管理所|公安/i.test(normalized.authority)) ||
                      (normalized.country && /chin/i.test(normalized.country)) ||
                      /china|chinese|chino/i.test(folderLower);

      const isBrazil = (normalized.nationality && /brazil|brasil|brazilian/i.test(normalized.nationality)) ||
                       (normalized.authority && /brazil|brasil|detran|denatran|senatran/i.test(normalized.authority)) ||
                       (normalized.country && /brazil|brasil/i.test(normalized.country)) ||
                       /brazil|brasil|cnh/i.test(folderLower);

      const isItaly = (normalized.nationality && /ital/i.test(normalized.nationality)) ||
                      (normalized.authority && /ital|MC[-/\s]?[A-Z]{2}|MIT-UCO|UCO|MIT-DTT|DTT/i.test(normalized.authority)) ||
                      (normalized.country && /ital/i.test(normalized.country)) ||
                      /italia|italy/i.test(folderLower);

      const isJapan = (normalized.nationality && /japan|japon/i.test(normalized.nationality)) ||
                      (normalized.authority && /japan|japon|public safety commission/i.test(normalized.authority)) ||
                      (normalized.country && /japan|japon/i.test(normalized.country)) ||
                      /japan|japon/i.test(folderLower);

      const isGerman = (normalized.country && /germany|alemania|deutschland/i.test(normalized.country)) ||
                       /german|aleman|alemania|deutsch/i.test(folderLower) ||
                       (!/denmark|dinamarca|danmark|france|francia|spain|espa|ital|japan|japon|china|czech|checa|brazil|brasil/i.test(folderLower) &&
                        !/denmark|dinamarca|danmark|france|francia|spain|espa|ital|japan|japon|china|czech|checa|brazil|brasil/i.test(normalized.country || '') &&
                        ((normalized.nationality && /german|alemania|deutsch/i.test(normalized.nationality)) ||
                         (normalized.authority && /germany|alemania|deutschland/i.test(normalized.authority))));

      const isNetherlands = (normalized.nationality && /dutch|netherland/i.test(normalized.nationality)) ||
                            (normalized.authority && /netherland|holand|rijbewijs|rdw/i.test(normalized.authority)) ||
                            (normalized.country && /netherland|holand|pa[íi]ses bajos/i.test(normalized.country)) ||
                            /netherland|holand|pa[íi]ses bajos|dutch/i.test(folderLower);

      const isNorway = (normalized.nationality && /norway|norwegian|norge|norsk/i.test(normalized.nationality)) ||
                       (normalized.authority && /norway|noruega|statens vegvesen|vegvesen/i.test(normalized.authority)) ||
                       (normalized.country && /norway|noruega|norge/i.test(normalized.country)) ||
                       /norway|noruega|norge/i.test(folderLower);

      const isDenmark = (normalized.nationality && /denmark|danish|danmark/i.test(normalized.nationality)) ||
                        (normalized.authority && /færdselsstyrelsen|danmark|rigspolitichefen|politi|kørekort/i.test(normalized.authority)) ||
                        (normalized.country && /denmark|dinamarca|danmark/i.test(normalized.country)) ||
                        /denmark|dinamarca|danmark/i.test(folderLower);

      const isIndonesia = (normalized.nationality && /indonesia|indonesian/i.test(normalized.nationality)) ||
                          (normalized.authority && /indonesia|korlantas|polri/i.test(normalized.authority)) ||
                          (normalized.country && /indonesia/i.test(normalized.country)) ||
                          /indonesia|indonesian/i.test(folderLower);

      // Default Nationality
      if (!normalized.nationality || normalized.nationality.trim() === '' || normalized.nationality === '-') {
        if (isChina) normalized.nationality = 'Chinese';
        else if (isBrazil) normalized.nationality = 'Brazilian';
        else if (isItaly) normalized.nationality = 'Italian';
        else if (isJapan) normalized.nationality = 'Japanese';
        else if (isGerman || /germany|deutschland|berlin|munich|münchen|köln/i.test(normalized.authority || '') || /germany|deutschland/i.test(normalized.placeOfBirth || '')) normalized.nationality = 'German';
        else if (/franc/i.test(folderLower)) normalized.nationality = 'French';
        else if (/taiwan/i.test(folderLower)) normalized.nationality = 'Taiwanese';
        else if (isDenmark || /denmark|dinamarca|danmark/i.test(folderLower)) normalized.nationality = 'Danish';
        else if (/netherland|holand|dutch/i.test(folderLower)) normalized.nationality = 'Dutch';
        else if (/swiss|suiz/i.test(folderLower)) normalized.nationality = 'Swiss';
        else if (/canada/i.test(folderLower)) normalized.nationality = 'Canadian';
        else if (/vietnam/i.test(folderLower)) normalized.nationality = 'Vietnamese';
        else if (/hungar|hungri/i.test(folderLower)) normalized.nationality = 'Hungarian';
        else if (isIndonesia || /indonesia/i.test(folderLower)) normalized.nationality = 'Indonesian';
      }

      // Italian authority normalization
      if (isItaly && normalized.authority) {
        normalized.authority = normalizeItalianAuthority(normalized.authority);
      }

      // Brazil authority normalization
      if (isBrazil && normalized.authority) {
        normalized.authority = formatBrazilAuthority(normalized.authority);
      }

      // Japan authority normalization & conditions sync
      if (isJapan) {
        if (normalized.authority && !normalized.authority.toLowerCase().includes('japan')) {
          normalized.authority = `${normalized.authority.trim()}, Japan`;
        }
        if (normalized.class) {
          normalized.class = formatJapanLicenseClasses(normalized.class);
        }
        const cleanCond = getCleanJapanCondition(normalized);
        normalized.codes = cleanCond;
        normalized.explicacionCodigos = cleanCond;
        normalized.conditions = cleanCond;
        normalized.explicacion = cleanCond;
      }

      // German authority normalization & codes sync
      if (isGerman) {
        if (normalized.authority && !normalized.authority.toLowerCase().includes('germany')) {
          normalized.authority = `${normalized.authority.trim()}, Germany`;
        }
        const cleanGerman = getCleanGermanCodes(normalized);
        if (cleanGerman !== '-') {
          normalized.codes = cleanGerman;
          normalized.explicacionCodigos = cleanGerman;
          normalized.conditions = cleanGerman;
          normalized.explicacion = cleanGerman;
        }
      }

      // Sanitize authority so it strictly contains only the single country of the license
      const effectiveCountry = normalized.country || folderName || normalized.nationality;
      if (normalized.authority) {
        normalized.authority = sanitizeAuthority(normalized.authority, effectiveCountry);
      }

      // Auto-detect best initial template
      const candidates = [
        folderName,
        normalized.nationality,
        normalized.country,
        normalized.authority,
        normalized.placeOfBirth,
        normalized.licenseLanguage
      ];
      let autoTemplate = '';
      for (const cand of candidates) {
        if (!cand || typeof cand !== 'string') continue;
        const key = getNormalizedCountryKey(cand);
        if (key && COUNTRY_TEMPLATES[key]) {
          autoTemplate = COUNTRY_TEMPLATES[key];
          break;
        }
      }
      if (!autoTemplate) {
        if (isChina) autoTemplate = 'china.docx';
        else if (isBrazil) autoTemplate = 'brazil.docx';
        else if (isItaly) autoTemplate = 'italia.docx';
        else if (isJapan) autoTemplate = 'japon.docx';
        else if (isNetherlands) autoTemplate = 'netherlands.docx';
        else if (isNorway) autoTemplate = 'norway.docx';
        else if (isDenmark) autoTemplate = 'denmark.docx';
        else if (isIndonesia) autoTemplate = 'indonesia.docx';
        else autoTemplate = 'alemania.docx';
      }
      setSelectedTemplate(autoTemplate);

      if (isBrazil) {
        normalized.gender = 'Not stated';
        normalized.sex = 'Not stated';
        if (normalized.parents) normalized.parents = normalized.parents.toUpperCase().trim();
        if (normalized.surname) normalized.surname = normalized.surname.toUpperCase().trim();
        if (normalized.firstName) normalized.firstName = normalized.firstName.toUpperCase().trim();
      }

      // Sync citizen
      let defaultCitizen = (normalized.citizen && normalized.citizen.trim() !== '' && normalized.citizen !== '-') 
        ? normalized.citizen 
        : (normalized.bsn || normalized.rsn || normalized.citizenNumber || normalized.citizen_number || normalized.burgerservicenummer || '');

      if (!defaultCitizen && isNetherlands) {
        if (normalized.codes && /\d{6,12}/.test(normalized.codes)) {
          const digitGroups = String(normalized.codes).match(/\d{6,12}/g);
          if (digitGroups && digitGroups.length >= 2) {
            defaultCitizen = `${digitGroups[0]} / ${digitGroups[1]}`;
          } else {
            defaultCitizen = String(normalized.codes).trim();
          }
        }
      }

      if (defaultCitizen) {
        if (/RSN|BSN/i.test(defaultCitizen)) {
          const matches = defaultCitizen.match(/\d+/g);
          if (matches && matches.length >= 2) {
            defaultCitizen = `${matches[0]} / ${matches[1]}`;
          }
        }
        normalized.citizen = defaultCitizen;
      }

      // Format license classes (e.g., C1, C2 or Ordinary Vehicle)
      if (normalized.class) {
        normalized.class = formatLicenseClasses(normalized.class, isChina, isJapan);
      }

      // China expiry permanent / long term check
      if (isChina && normalized.expiryDate && typeof normalized.expiryDate === 'string') {
        const expLow = normalized.expiryDate.toLowerCase();
        if (expLow.includes('long') || expLow.includes('term') || expLow.includes('perm') || expLow.includes('indefinite') || normalized.expiryDate.includes('长期')) {
          normalized.expiryDate = 'To Long Term';
        }
      }

      // Auto-populate classDescriptions if missing, empty, or '-'
      if ((!normalized.classDescriptions || normalized.classDescriptions.trim() === '' || normalized.classDescriptions.trim() === '-') && normalized.class) {
        if (isChina) {
          normalized.classDescriptions = generateChinaClassDescriptions(normalized.class);
        } else if (isBrazil) {
          normalized.classDescriptions = generateBrazilClassDescriptions(normalized.class);
        } else if (isItaly) {
          normalized.classDescriptions = generateItalyClassDescriptions(normalized.class);
        } else {
          normalized.classDescriptions = generateClassDescriptions(normalized.class);
        }
      } else if (normalized.classDescriptions) {
        if (isItaly) {
          normalized.classDescriptions = filterClassDescriptionsByHeldClasses(normalized.classDescriptions, normalized.class, 'italia');
        } else {
          normalized.classDescriptions = formatClassDescriptions(normalized.classDescriptions);
        }
      }

      // Format categoriesDates grouping if present
      if (normalized.categoriesDates) {
        normalized.categoriesDates = formatCategoriesDates(normalized.categoriesDates);
      }

      // Sync firstIssued, firstObtained and categoriesDates
      const firstDate = normalized.firstIssued || normalized.firstObtained || normalized.categoriesDates || '';
      if (firstDate && firstDate !== '-') {
        if (!normalized.firstIssued || normalized.firstIssued === '-') normalized.firstIssued = firstDate;
        if (!normalized.firstObtained || normalized.firstObtained === '-') normalized.firstObtained = firstDate;
        if (!normalized.categoriesDates || normalized.categoriesDates === '-') normalized.categoriesDates = firstDate;
      }

      // Sync barcodeNumber & fileNumber
      const rawBarcode = normalized.barcodeNumber || normalized.barcode || normalized.barcode_number || normalized.barCode || normalized.barCodeNumber || normalized.barcodeNo;
      if (rawBarcode) {
        normalized.barcodeNumber = rawBarcode;
        normalized.barcode = rawBarcode;
      }

      const rawFile = normalized.fileNumber || normalized.file || normalized.fileNo || normalized.file_no || normalized.filenumber || normalized.file_number || normalized.recordNumber || normalized.recordFileNumber || normalized.archiveNumber || normalized.danganNumber;
      if (rawFile) {
        normalized.fileNumber = rawFile;
        normalized.file = rawFile;
        normalized.fileNo = rawFile;
      }

      const rawExplicacion = normalized.explicacionCodigos || normalized.conditions || normalized.condition || normalized.explicacion || normalized.record || normalized.records || normalized.recordCard || normalized.remarks || normalized.observations || normalized.observaciones || normalized.notes;
      if (rawExplicacion) {
        normalized.explicacionCodigos = rawExplicacion;
        normalized.conditions = rawExplicacion;
        normalized.explicacion = rawExplicacion;
      }

      // Sync reference and assignedNumber
      if (normalized.assignedNumber && (!normalized.reference || normalized.reference === '-')) {
        normalized.reference = normalized.assignedNumber;
      } else if (normalized.reference && (!normalized.assignedNumber || normalized.assignedNumber === '-')) {
        normalized.assignedNumber = normalized.reference;
      }

      // Middle name fallback: for Brazil and China leave empty string "", for other countries '-'
      if (!normalized.middleName || normalized.middleName.trim() === '""' || ((isChina || isBrazil) && normalized.middleName.trim() === '-')) {
        normalized.middleName = (isChina || isBrazil) ? '' : '-';
      }
      
      // Keep codes and explicacionCodigos strictly separate and preserved
      if (normalized.codes === undefined || normalized.codes === null || normalized.codes.trim() === '') {
        normalized.codes = '-';
      }
      if (normalized.explicacionCodigos === undefined || normalized.explicacionCodigos === null || normalized.explicacionCodigos.trim() === '') {
        normalized.explicacionCodigos = (normalized.conditions && normalized.conditions !== '-') ? normalized.conditions : '-';
      }
      if (normalized.conditions === undefined || normalized.conditions === null || normalized.conditions.trim() === '') {
        normalized.conditions = normalized.explicacionCodigos;
      }

      // Sync firstName and firstNames
      if (normalized.firstName !== undefined && normalized.firstNames === undefined) {
        normalized.firstNames = normalized.firstName;
      } else if (normalized.firstNames !== undefined && normalized.firstName === undefined) {
        normalized.firstName = normalized.firstNames;
      }

      // Sync code, codes, and reverse
      const rawInitCode = normalized.code || normalized.codes || normalized.reverse;
      if (rawInitCode && String(rawInitCode).trim() !== '' && rawInitCode !== '-') {
        normalized.code = String(rawInitCode).trim();
        normalized.codes = normalized.code;
        normalized.reverse = normalized.code;
      } else {
        if (normalized.code !== undefined) {
          normalized.codes = normalized.code;
          normalized.reverse = normalized.code;
        } else if (normalized.codes !== undefined) {
          normalized.code = normalized.codes;
          normalized.reverse = normalized.codes;
        }
      }
      
      // Sync Blood and blood
      const rawInitBlood = normalized.Blood || normalized.blood || normalized.bloodType || normalized.golDarah || normalized.gol_darah;
      if (rawInitBlood && String(rawInitBlood).trim() !== '' && rawInitBlood !== '-') {
        normalized.blood = String(rawInitBlood).trim();
        normalized.Blood = normalized.blood;
      } else if (normalized.Blood !== undefined) {
        normalized.blood = normalized.Blood;
      } else if (normalized.blood !== undefined) {
        normalized.Blood = normalized.blood;
      }

      // Sync address and alamat
      const rawInitAddress = normalized.address || normalized.alamat || normalized.fullAddress;
      if (rawInitAddress && String(rawInitAddress).trim() !== '') {
        normalized.address = String(rawInitAddress).trim();
      }

      let sec4d = (normalized.personal && normalized.personal.trim() !== '' && normalized.personal !== '-') 
        ? normalized.personal 
        : ((normalized.point4d && normalized.point4d.trim() !== '' && normalized.point4d !== '-') 
          ? normalized.point4d 
          : (normalized.cpr || normalized.cprNumber || normalized.cpr_nummer || normalized.personalNumber || normalized.personalId || normalized.sec4d || (normalized.cpf && normalized.cpf !== '-' ? normalized.cpf : '')));

      if ((!sec4d || sec4d === '-') && isNorway && normalized.assignedNumber && /\d{6}[\s-]?\d{5}/.test(normalized.assignedNumber)) {
        sec4d = normalized.assignedNumber.trim();
        if (folderName) {
          normalized.assignedNumber = getAssignedNumber(folderName);
        } else {
          normalized.assignedNumber = '-';
        }
      } else if ((!sec4d || sec4d === '-') && isDenmark && normalized.assignedNumber && /\d{6}[\s-]?\d{4}/.test(normalized.assignedNumber)) {
        sec4d = normalized.assignedNumber.trim();
        if (folderName) {
          normalized.assignedNumber = getAssignedNumber(folderName);
        } else {
          normalized.assignedNumber = '-';
        }
      }

      normalized.personal = sec4d || '-';
      normalized.point4d = sec4d || '-';

      // Sync eye & eyeColor
      const finalEye = (normalized.eye && normalized.eye.trim() !== '') 
        ? normalized.eye 
        : ((normalized.eyeColor && normalized.eyeColor.trim() !== '') ? normalized.eyeColor : (normalized.Eye || ''));
      if (finalEye) {
        normalized.eye = finalEye;
        normalized.eyeColor = finalEye;
      }

      // Sync sex & gender with full translations (Male/Female)
      let finalSex = (normalized.sex && normalized.sex.trim() !== '') 
        ? normalized.sex 
        : ((normalized.gender && normalized.gender.trim() !== '') ? normalized.gender : '');
      if (finalSex === '男' || finalSex.toLowerCase() === 'm' || finalSex.toLowerCase() === 'male') {
        finalSex = 'Male';
      } else if (finalSex === '女' || finalSex.toLowerCase() === 'f' || finalSex.toLowerCase() === 'female') {
        finalSex = 'Female';
      }
      if (finalSex) {
        normalized.sex = finalSex;
        normalized.gender = finalSex;
      }

      setFormData(normalized);
    }
  }, [initialData, folderName]);


  if (!isOpen) return null;

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => {
      const updated = { ...prev, [name]: value };
      if (name === 'firstName') updated.firstNames = value;
      if (name === 'firstNames') updated.firstName = value;
      if (name === 'explicacionCodigos') {
        updated.conditions = value;
        updated.explicacion = value;
        if (selectedTemplate === 'japon.docx' || prev.nationality === 'Japanese' || selectedTemplate === 'alemania.docx' || prev.nationality === 'German') {
          updated.codes = value;
        }
      }
      if (name === 'conditions') {
        updated.explicacionCodigos = value;
        updated.explicacion = value;
        if (selectedTemplate === 'japon.docx' || prev.nationality === 'Japanese' || selectedTemplate === 'alemania.docx' || prev.nationality === 'German') {
          updated.codes = value;
        }
      }
      if (name === 'codes') {
        updated.code = value;
        if (selectedTemplate === 'japon.docx' || prev.nationality === 'Japanese' || selectedTemplate === 'alemania.docx' || prev.nationality === 'German') {
          updated.explicacionCodigos = value;
          updated.conditions = value;
          updated.explicacion = value;
        }
      }
      if (name === 'code') {
        updated.codes = value;
        updated.reverse = value;
      }
      if (name === 'barcodeNumber') updated.barcode = value;
      if (name === 'barcode') updated.barcodeNumber = value;
      if (name === 'fileNumber') {
        updated.file = value;
        updated.fileNo = value;
      }
      if (name === 'file' || name === 'fileNo') {
        updated.fileNumber = value;
      }
      if (name === 'reverse') {
        updated.code = value;
        updated.codes = value;
      }
      if (name === 'blood') {
        updated.Blood = value;
        updated.bloodType = value;
      }
      if (name === 'Blood') {
        updated.blood = value;
        updated.bloodType = value;
      }
      if (name === 'address') {
        updated.alamat = value;
      }
      if (name === 'personal') updated.point4d = value;
      if (name === 'point4d') updated.personal = value;
      if (name === 'assignedNumber') updated.reference = value;
      if (name === 'reference') updated.assignedNumber = value;
      if (name === 'firstObtained') updated.categoriesDates = value;
      if (name === 'categoriesDates') updated.firstObtained = value;
      if (name === 'eye') updated.eyeColor = value;
      if (name === 'eyeColor') updated.eye = value;
      if (name === 'cardNumber') updated.CardNumber = value;
      if (name === 'idDocument') updated.IdDocument = value;
      if (name === 'cpf') {
        updated.CPF = value;
        updated.individualTaxpayerNumber = value;
        updated.personal = value;
      }
      if (name === 'parents') {
        updated.Parents = value;
        updated.nameOfParents = value;
        updated.filiação = value;
        updated.filiacao = value;
      }
      if (name === 'sex') updated.gender = value;
      if (name === 'gender') updated.sex = value;
      return updated;
    });
  };

  const getEffectiveTemplateBuffer = async () => {
    if (templateFile) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.onerror = (err) => reject(err);
        reader.readAsArrayBuffer(templateFile);
      });
    }
    // Auto-load chosen country template from server
    return await loadCountryTemplate(
      selectedTemplate,
      formData.nationality,
      formData.authority,
      formData.licenseLanguage,
      formData.placeOfBirth,
      formData.country,
      folderName
    );
  };

  const handleSave = async () => {
    try {
      setIsGenerating(true);
      const arrayBuffer = await getEffectiveTemplateBuffer();
      const isJapan = selectedTemplate === 'japon.docx' || (formData.nationality && /japan|japon/i.test(formData.nationality)) || (formData.authority && /japan|japon|public safety commission/i.test(formData.authority));
      const isGerman = selectedTemplate === 'alemania.docx' || (formData.nationality && /german|alemania|deutsch/i.test(formData.nationality)) || (formData.authority && /germany|alemania|deutschland/i.test(formData.authority));
      const cleanGermanCodes = isGerman ? getCleanGermanCodes(formData) : '';
      const effectiveDocCountry = formData.country || folderName || formData.nationality || selectedTemplate;
      const cleanData = {
        ...formData,
        authority: sanitizeAuthority(formData.authority, effectiveDocCountry),
        templateName: selectedTemplate,
        class: isJapan ? formatJapanLicenseClasses(formData.class) : formData.class,
        categoriesDates: formatCategoriesDates(formData.categoriesDates),
        codes: isGerman ? (cleanGermanCodes !== '-' ? cleanGermanCodes : formData.codes) : (isJapan ? getCleanJapanCondition(formData) : (formData.codes || formData.code)),
        code: formData.code || formData.codes,
        blood: formData.blood || formData.Blood,
        Blood: formData.Blood || formData.blood,
        address: formData.address || formData.alamat || '',
        personal: formData.personal || formData.point4d || '-',
        point4d: formData.point4d || formData.personal || '-',
        explicacionCodigos: isGerman ? (cleanGermanCodes !== '-' ? cleanGermanCodes : formData.explicacionCodigos) : (isJapan ? getCleanJapanCondition(formData) : formData.explicacionCodigos),
        conditions: isGerman ? (cleanGermanCodes !== '-' ? cleanGermanCodes : formData.conditions) : (isJapan ? getCleanJapanCondition(formData) : formData.conditions)
      };
      onSave(cleanData, arrayBuffer);
    } catch (err) {
      console.error("Error al cargar la plantilla Word:", err);
      alert("Error al cargar la plantilla Word: " + err.message);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownload = async () => {
    try {
      setIsGenerating(true);
      const arrayBuffer = await getEffectiveTemplateBuffer();
      const isJapan = selectedTemplate === 'japon.docx' || (formData.nationality && /japan|japon/i.test(formData.nationality)) || (formData.authority && /japan|japon|public safety commission/i.test(formData.authority));
      const isGerman = selectedTemplate === 'alemania.docx' || (formData.nationality && /german|alemania|deutsch/i.test(formData.nationality)) || (formData.authority && /germany|alemania|deutschland/i.test(formData.authority));
      const cleanGermanCodes = isGerman ? getCleanGermanCodes(formData) : '';
      const effectiveDocCountry = formData.country || folderName || formData.nationality || selectedTemplate;
      const cleanData = {
        ...formData,
        authority: sanitizeAuthority(formData.authority, effectiveDocCountry),
        templateName: selectedTemplate,
        class: isJapan ? formatJapanLicenseClasses(formData.class) : formData.class,
        categoriesDates: formatCategoriesDates(formData.categoriesDates),
        codes: isGerman ? (cleanGermanCodes !== '-' ? cleanGermanCodes : formData.codes) : (isJapan ? getCleanJapanCondition(formData) : (formData.codes || formData.code)),
        code: formData.code || formData.codes,
        blood: formData.blood || formData.Blood,
        Blood: formData.Blood || formData.blood,
        address: formData.address || formData.alamat || '',
        personal: formData.personal || formData.point4d || '-',
        point4d: formData.point4d || formData.personal || '-',
        explicacionCodigos: isGerman ? (cleanGermanCodes !== '-' ? cleanGermanCodes : formData.explicacionCodigos) : (isJapan ? getCleanJapanCondition(formData) : formData.explicacionCodigos),
        conditions: isGerman ? (cleanGermanCodes !== '-' ? cleanGermanCodes : formData.conditions) : (isJapan ? getCleanJapanCondition(formData) : formData.conditions)
      };
      if (onDownloadWord) {
        onDownloadWord(cleanData, arrayBuffer);
      }
    } catch (err) {
      console.error("Error al cargar la plantilla Word:", err);
      alert("Error al cargar la plantilla Word: " + err.message);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="modal-overlay open" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '800px', width: '90%', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
        <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <h2 className="modal-title" style={{ margin: 0 }}>Revisar Datos Extraídos (IA)</h2>
            <span style={{ 
              backgroundColor: '#3b82f6', 
              color: '#ffffff', 
              padding: '4px 12px', 
              borderRadius: '6px', 
              fontWeight: 'bold', 
              fontSize: '13px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px'
            }}>
              🏷️ DL: {formData.assignedNumber || formData.reference || getAssignedNumber(folderName) || (folderName ? folderName.match(/\b([A-Za-z]?\d{3,6})\b/)?.[0]?.toUpperCase() : '') || 'En Proceso'}
            </span>
            {folderName && <span style={{ fontSize: '13px', color: '#6b7280' }}>({folderName})</span>}
          </div>
          <button className="btn-icon" onClick={onClose}>
            <X size={24} />
          </button>
        </div>
        
        <div style={{ padding: '20px', overflowY: 'auto', flex: 1, backgroundColor: '#f9fafb' }}>
          
          {/* Active Template Selector Banner */}
          <div style={{
            backgroundColor: '#ffffff',
            border: '1px solid #bfdbfe',
            borderRadius: '8px',
            padding: '12px 16px',
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <FileText size={20} color="#2563eb" />
              <div>
                <div style={{ fontSize: '13px', fontWeight: 'bold', color: '#1e293b' }}>
                  Plantilla Word Oficial de Traducción:
                </div>
                <div style={{ fontSize: '11px', color: '#64748b' }}>
                  Puedes cambiar la plantilla manualmente en cualquier momento:
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <select
                value={selectedTemplate}
                onChange={(e) => {
                  const newTemp = e.target.value;
                  setSelectedTemplate(newTemp);
                  if (newTemp === 'china.docx' && formData.class) {
                    setFormData(prev => ({ ...prev, classDescriptions: generateChinaClassDescriptions(prev.class) }));
                  } else if (newTemp === 'brazil.docx' && formData.class) {
                    setFormData(prev => ({ ...prev, classDescriptions: generateBrazilClassDescriptions(prev.class) }));
                  } else if (newTemp === 'italia.docx' && formData.class) {
                    setFormData(prev => ({ ...prev, classDescriptions: generateItalyClassDescriptions(prev.class) }));
                  } else if (newTemp === 'japon.docx') {
                    setFormData(prev => {
                      const cleanCond = getCleanJapanCondition(prev);
                      return {
                        ...prev,
                        class: prev.class ? formatJapanLicenseClasses(prev.class) : prev.class,
                        codes: cleanCond,
                        explicacionCodigos: cleanCond,
                        conditions: cleanCond,
                        explicacion: cleanCond
                      };
                    });
                  } else if (formData.class) {
                    setFormData(prev => ({ ...prev, classDescriptions: generateClassDescriptions(prev.class) }));
                  }
                }}
                style={{
                  padding: '8px 12px',
                  borderRadius: '6px',
                  border: '2px solid #2563eb',
                  backgroundColor: '#ffffff',
                  fontSize: '13px',
                  fontWeight: 'bold',
                  color: '#1e293b',
                  cursor: 'pointer',
                  minWidth: '280px'
                }}
              >
                {AVAILABLE_TEMPLATES.map(t => (
                  <option key={t.id} value={t.id}>{t.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', marginBottom: '24px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: 'bold', marginBottom: '4px', color: '#374151' }}>Surname</label>
              <input type="text" name="surname" value={formData.surname || ''} onChange={handleChange} style={inputStyle} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: 'bold', marginBottom: '4px', color: '#374151' }}>First Name</label>
              <input type="text" name="firstName" value={formData.firstName || ''} onChange={handleChange} style={inputStyle} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: 'bold', marginBottom: '4px', color: '#374151' }}>Middle Name ({"{{middleName}}"})</label>
              <input type="text" name="middleName" value={formData.middleName || ''} onChange={handleChange} style={inputStyle} />
            </div>
          </div>

          {(formData.fullName !== undefined) && (
            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: 'bold', marginBottom: '4px', color: '#374151' }}>Full Name (Vietnam etc.)</label>
              <input type="text" name="fullName" value={formData.fullName || ''} onChange={handleChange} style={inputStyle} />
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: 'bold', marginBottom: '4px', color: '#374151' }}>Date of Birth</label>
              <input type="text" name="dateOfBirth" value={formData.dateOfBirth || ''} onChange={handleChange} style={inputStyle} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: 'bold', marginBottom: '4px', color: '#374151' }}>Place of Birth</label>
              <input type="text" name="placeOfBirth" value={formData.placeOfBirth || ''} onChange={handleChange} style={inputStyle} />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '16px', marginBottom: '24px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: 'bold', marginBottom: '4px', color: '#374151' }}>Height ({"{{height}}"})</label>
              <input type="text" name="height" value={formData.height || ''} onChange={handleChange} style={inputStyle} placeholder="-" />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: 'bold', marginBottom: '4px', color: '#374151' }}>Eye Color ({"{{eye}}"} / {"{{eyeColor}}"})</label>
              <input type="text" name="eye" value={formData.eye || formData.eyeColor || ''} onChange={handleChange} style={inputStyle} placeholder="-" />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: 'bold', marginBottom: '4px', color: '#374151' }}>Sex / Gender ({"{{sex}}"} / {"{{gender}}"})</label>
              <input type="text" name="sex" value={formData.sex || formData.gender || ''} onChange={handleChange} style={inputStyle} placeholder="-" />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: 'bold', marginBottom: '4px', color: '#374151' }}>Blood Type ({"{{Blood}}"} / {"{{blood}}"})</label>
              <input type="text" name="blood" value={formData.Blood || formData.blood || ''} onChange={handleChange} style={inputStyle} placeholder="ej. O, A, B, AB, -" />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: 'bold', marginBottom: '4px', color: '#374151' }}>Address ({"{{address}}"})</label>
              <input type="text" name="address" value={formData.address || ''} onChange={handleChange} style={inputStyle} placeholder="-" />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: 'bold', marginBottom: '4px', color: '#374151' }}>Reference No. ({"{{reference}}"})</label>
              <input type="text" name="reference" value={formData.reference || ''} onChange={handleChange} style={inputStyle} placeholder="-" />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: 'bold', marginBottom: '4px', color: '#374151' }}>Licence Number</label>
              <input type="text" name="licenseNumber" value={formData.licenseNumber || ''} onChange={handleChange} style={inputStyle} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: 'bold', marginBottom: '4px', color: '#374151' }}>Assigned No. ({"{{assignedNumber}}"})</label>
              <input type="text" name="assignedNumber" value={formData.assignedNumber || ''} onChange={handleChange} style={inputStyle} placeholder="ej. B1234" />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', marginBottom: '24px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: 'bold', marginBottom: '4px', color: '#374151' }}>Card / Espelho No. ({"{{cardNumber}}"})</label>
              <input type="text" name="cardNumber" value={formData.cardNumber || ''} onChange={handleChange} style={inputStyle} placeholder="Nº Espelho (Vertical)" />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: 'bold', marginBottom: '4px', color: '#374151' }}>Doc. Identidade / Sec 4c ({"{{idDocument}}"})</label>
              <input type="text" name="idDocument" value={formData.idDocument || ''} onChange={handleChange} style={inputStyle} placeholder="ej. 392634570 SSP SP" />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: 'bold', marginBottom: '4px', color: '#374151' }}>CPF / Sec 4d ({"{{cpf}}"})</label>
              <input type="text" name="cpf" value={formData.cpf || ''} onChange={handleChange} style={inputStyle} placeholder="000.000.000-00" />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', marginBottom: '24px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: 'bold', marginBottom: '4px', color: '#374151' }}>Parents / Filiação ({"{{parents}}"})</label>
              <input type="text" name="parents" value={formData.parents || ''} onChange={handleChange} style={inputStyle} placeholder="Nombres de los padres" />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: 'bold', marginBottom: '4px', color: '#374151' }}>1ª Habilitação / First Issued ({"{{firstObtained}}"} / {"{{firstIssued}}"})</label>
              <input type="text" name="firstObtained" value={formData.firstObtained || formData.firstIssued || ''} onChange={handleChange} style={inputStyle} placeholder="DD Month YYYY" />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: 'bold', marginBottom: '4px', color: '#374151' }}>Nationality ({"{{nationality}}"})</label>
              <input type="text" name="nationality" value={formData.nationality || ''} onChange={handleChange} style={inputStyle} placeholder="Chinese / German / Brazilian" />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: 'bold', marginBottom: '4px', color: '#374151' }}>Barcode Number (China / {"{{barcodeNumber}}"})</label>
              <input type="text" name="barcodeNumber" value={formData.barcodeNumber || formData.barcode || ''} onChange={handleChange} style={inputStyle} placeholder="ej. 3180019278004" />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: 'bold', marginBottom: '4px', color: '#374151' }}>File No. (China / {"{{fileNumber}}"} / {"{{file}}"})</label>
              <input type="text" name="fileNumber" value={formData.fileNumber || formData.fileNo || formData.file || ''} onChange={handleChange} style={inputStyle} placeholder="ej. 110000123456" />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: 'bold', marginBottom: '4px', color: '#374151' }}>Personal No. / Sec 4d ({"{{personal}}"})</label>
              <input type="text" name="personal" value={formData.personal || formData.point4d || formData.cpf || ''} onChange={handleChange} style={inputStyle} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: 'bold', marginBottom: '4px', color: '#374151' }}>Citizen No. / Netherlands Back Top-Left ({"{{citizen}}"})</label>
              <input type="text" name="citizen" value={formData.citizen || ''} onChange={handleChange} style={inputStyle} placeholder="ej. 230773941 / 5899184886" />
            </div>
          </div>

          <div style={{ marginBottom: '24px' }}>
            <label style={{ display: 'block', fontSize: '14px', fontWeight: 'bold', marginBottom: '4px', color: '#374151' }}>Issuing Authority</label>
            <input type="text" name="authority" value={formData.authority || ''} onChange={handleChange} style={inputStyle} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: 'bold', marginBottom: '4px', color: '#374151' }}>Date First Obtained ({"{{categoriesDates}}"})</label>
              <textarea name="categoriesDates" value={formData.categoriesDates || formData.firstIssued || ''} onChange={handleChange} style={{...inputStyle, height: '80px'}} />
            </div>
            <div>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: 'bold', marginBottom: '4px', color: '#374151' }}>Date Issued</label>
                <input type="text" name="issueDate" value={formData.issueDate || ''} onChange={handleChange} style={inputStyle} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: 'bold', marginBottom: '4px', color: '#374151' }}>Expiry Date</label>
                <input type="text" name="expiryDate" value={formData.expiryDate || ''} onChange={handleChange} style={inputStyle} />
              </div>
            </div>
          </div>

          <div style={{ marginBottom: '24px' }}>
            <label style={{ display: 'block', fontSize: '14px', fontWeight: 'bold', marginBottom: '4px', color: '#374151' }}>Licence Class/es Held</label>
            <input type="text" name="class" value={formData.class || ''} onChange={handleChange} style={inputStyle} />
          </div>

          <div style={{ marginBottom: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <label style={{ fontSize: '14px', fontWeight: 'bold', color: '#374151' }}>
                Class Descriptions ({"{{classDescriptions}}"})
              </label>
              <button
                type="button"
                onClick={() => {
                  const isChina = (formData.nationality && formData.nationality.toLowerCase().includes('chin')) ||
                                  (formData.authority && formData.authority.toLowerCase().includes('chin')) ||
                                  Boolean(formData.barcodeNumber && formData.barcodeNumber !== '-') ||
                                  Boolean(folderName && /china|chinese|chino/i.test(folderName));
                  const isBrazil = (formData.nationality && formData.nationality.toLowerCase().includes('brazil')) ||
                                   (formData.authority && formData.authority.toLowerCase().includes('brazil')) ||
                                   Boolean(formData.cpf && formData.cpf !== '-') ||
                                   Boolean(folderName && /brazil|brasil/i.test(folderName));
                  const isItaly = (formData.nationality && formData.nationality.toLowerCase().includes('ital')) ||
                                  (formData.authority && /ital|MC[-/\s]?[A-Z]{2}|MIT-UCO|UCO|MIT-DTT|DTT/i.test(formData.authority)) ||
                                  selectedTemplate === 'italia.docx' ||
                                  Boolean(folderName && /italia|italy/i.test(folderName));
                  const generated = isChina
                    ? generateChinaClassDescriptions(formData.class || '')
                    : (isBrazil 
                      ? generateBrazilClassDescriptions(formData.class || '') 
                      : (isItaly
                        ? generateItalyClassDescriptions(formData.class || '')
                        : generateClassDescriptions(formData.class || '')));
                  if (generated) {
                    setFormData(prev => ({ ...prev, classDescriptions: generated }));
                  } else {
                    alert("No se pudieron detectar categorías válidas en 'Licence Class/es Held'.");
                  }
                }}
                style={{
                  backgroundColor: '#eff6ff',
                  color: '#1d4ed8',
                  border: '1px solid #93c5fd',
                  borderRadius: '4px',
                  padding: '3px 10px',
                  fontSize: '12px',
                  fontWeight: 'bold',
                  cursor: 'pointer'
                }}
              >
                ⚡ Auto-generar descripciones
              </button>
            </div>
            <textarea name="classDescriptions" value={formData.classDescriptions || ''} onChange={handleChange} style={{...inputStyle, height: '150px'}} />
          </div>

          <div style={{ marginBottom: '24px' }}>
            <label style={{ display: 'block', fontSize: '14px', fontWeight: 'bold', marginBottom: '4px', color: '#374151' }}>
              Series / Códigos Reverso / Code ({"{{code}}"} / {"{{codes}}"})
            </label>
            <input 
              type="text" 
              name="codes" 
              value={formData.codes || formData.code || ''} 
              onChange={handleChange} 
              style={inputStyle} 
              placeholder="Códigos reverso (ej. Sup. Izq en Francia/Holanda, Sup. Der en Indonesia)" 
            />
          </div>

          <div style={{ marginBottom: '24px' }}>
            <label style={{ display: 'block', fontSize: '14px', fontWeight: 'bold', marginBottom: '4px', color: '#374151' }}>
              Restrictions / Conditions / Explicación Códigos ({"{{explicacionCodigos}}"})
            </label>
            <textarea 
              name="explicacionCodigos" 
              value={formData.explicacionCodigos || formData.conditions || ''} 
              onChange={handleChange} 
              style={{...inputStyle, height: '90px'}} 
              placeholder="ej. 106- Subject to the application of article R. 413-5..."
            />
          </div>

          <div style={{ marginBottom: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px', flexWrap: 'wrap', gap: '8px' }}>
              <label style={{ fontSize: '14px', fontWeight: 'bold', color: '#374151' }}>
                Japón: Franja Dorada / Excellent Driver ({"{{gold}}"})
              </label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => {
                    const text = `The issue authority is recognised the licence holder as an excellent driver.\n"Excellent Driver" is one of the categories on a driver's license. It applies to individuals under the age of 70, who have held a license for a continuous period of 5 years or more and have not been involved in any violations or accidents causing injuries.`;
                    setFormData(prev => ({ ...prev, gold: text }));
                  }}
                  style={{
                    backgroundColor: '#fef3c7',
                    color: '#92400e',
                    border: '1px solid #f59e0b',
                    borderRadius: '4px',
                    padding: '3px 10px',
                    fontSize: '12px',
                    fontWeight: 'bold',
                    cursor: 'pointer'
                  }}
                >
                  ⭐ Con Franja Dorada (Excellent Driver)
                </button>
                <button
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, gold: '-' }))}
                  style={{
                    backgroundColor: '#f3f4f6',
                    color: '#374151',
                    border: '1px solid #d1d5db',
                    borderRadius: '4px',
                    padding: '3px 10px',
                    fontSize: '12px',
                    fontWeight: 'bold',
                    cursor: 'pointer'
                  }}
                >
                  ⚪ Sin Franja Dorada (-)
                </button>
              </div>
            </div>
            <textarea 
              name="gold" 
              value={formData.gold || ''} 
              onChange={handleChange} 
              placeholder="Texto para franja dorada o guion (-)..." 
              style={{ ...inputStyle, height: '90px' }} 
            />
            <span style={{ fontSize: '11px', color: '#6b7280', marginTop: '4px', display: 'block' }}>
              *(Este campo controla la etiqueta {"{{gold}}"} en tu machote. Usa los botones superiores para cambiar rápidamente)*
            </span>
          </div>


        </div>

        <div style={{ padding: '16px', display: 'flex', flexWrap: 'wrap', gap: '16px', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #e5e7eb', backgroundColor: '#f8fafc' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
              <CheckCircle2 size={16} color="#16a34a" />
              <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#1e293b' }}>
                Plantilla Seleccionada: <span style={{ color: '#2563eb' }}>{selectedTemplate}</span>
              </span>
              <span style={{ fontSize: '11px', backgroundColor: '#dcfce7', color: '#15803d', padding: '2px 8px', borderRadius: '4px', fontWeight: '600' }}>
                ✓ Auto-cargada desde el servidor
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <label style={{ fontSize: '12px', color: '#64748b' }}>
                ¿Subir archivo Word local? (Opcional):
              </label>
              <input 
                type="file" 
                accept=".docx" 
                onChange={(e) => setTemplateFile(e.target.files[0])} 
                style={{ fontSize: '12px' }}
              />
              {templateFile && (
                <button 
                  type="button" 
                  onClick={() => setTemplateFile(null)} 
                  style={{ fontSize: '11px', color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}
                >
                  (Quitar y usar oficial)
                </button>
              )}
            </div>
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <button 
              className="btn-secondary" 
              onClick={handleDownload} 
              disabled={isGenerating}
              style={{ display: 'flex', alignItems: 'center', opacity: isGenerating ? 0.7 : 1 }}
            >
              <Download size={18} style={{ marginRight: '8px' }} /> 
              {isGenerating ? 'Generando Word...' : 'Descargar Word'}
            </button>
            <button 
              className="btn-primary" 
              onClick={handleSave} 
              disabled={isGenerating}
              style={{ display: 'flex', alignItems: 'center', opacity: isGenerating ? 0.7 : 1 }}
            >
              {isGenerating ? 'Generando...' : 'Continuar a Enviar'} <ArrowRight size={18} style={{ marginLeft: '8px' }} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

const inputStyle = {
  width: '100%',
  padding: '8px 12px',
  borderRadius: '4px',
  border: '1px solid #d1d5db',
  fontSize: '14px'
};
