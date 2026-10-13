import React, { useState, useEffect } from 'react';
import { useGoogleLogin, googleLogout } from '@react-oauth/google';
import { Mail, Check, LogOut, RefreshCw, Inbox, FolderPlus, X, FolderKanban, CheckCircle2, FolderOpen, Trash2, Briefcase, Settings, ClipboardList, UploadCloud, Zap, Tag, Search, FolderSymlink } from 'lucide-react';
import './index.css';
import ImageEditorModal from './ImageEditorModal';
import TranslationPreviewModal from './TranslationPreviewModal';
import EmailPreviewModal from './EmailPreviewModal';
import EmailDetailModal from './EmailDetailModal';
import ManualUploadModal from './ManualUploadModal';
import AutoOrganizeTab from './AutoOrganizeTab';
import { extractLicenseData, getNormalizedCountryKey } from './utils/geminiApi';
import { generateWordDocument, getAssignedNumber } from './utils/documentGenerator';
import { sendEmailWithPdf, isValidCustomerEmail, extractClientEmailFromMessage } from './utils/gmailService';



const GOOGLE_API_SCOPES = 'https://www.googleapis.com/auth/gmail.modify https://www.googleapis.com/auth/gmail.labels https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive.readonly https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/drive';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, errorInfo) {
    console.error("Modal Render Error caught:", error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="modal-overlay open" onClick={() => this.setState({ hasError: false })}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '600px', padding: '24px', backgroundColor: '#ffffff', borderRadius: '12px' }}>
            <h3 style={{ color: '#dc2626', marginBottom: '12px', fontSize: '18px', fontWeight: 'bold' }}>Error al mostrar la vista previa</h3>
            <p style={{ color: '#374151', fontSize: '14px', marginBottom: '16px' }}>{this.state.error?.message}</p>
            <button className="btn-primary" onClick={() => this.setState({ hasError: false })}>Cerrar y Reintentar</button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// Helper: Checks if a row is a header/metadata row
export const isHeaderRow = (row, tab) => {
  if (!row || !Array.isArray(row) || row.length === 0) return false;
  const headerKeywords = [
    'nombre', 'client', 'cliente', 'name', 'customer', 'dl', 'dl#', 'dl number', 
    'tracking', 'order', 'orden', 'pais', 'país', 'country', 'idioma', 'language', 
    'precio', 'price', 'total', 'trans', 'traductor', 'translator', 'traduccion', 
    'traducción', 'suma', 'resumen', 'notas', 'observaciones'
  ];
  
  for (let cell of row) {
    if (cell) {
      const clean = String(cell).trim().toLowerCase();
      if (['dl', 'dl#', 'trans', 'cliente', 'client', 'nombre'].includes(clean)) return true;
    }
  }

  const clientCell = String(row[2] || row[1] || '').trim().toLowerCase();
  if (headerKeywords.includes(clientCell)) return true;

  return false;
};

// Helper: Checks if a row is occupied by an existing client
export const isRowFilled = (row, tab) => {
  if (!row || !Array.isArray(row) || row.length === 0) return false;
  if (isHeaderRow(row, tab)) return false;
  
  const ignoredValues = ['jc', 'alex', 'trans', 'traductor', 'none', '-', '--', 'n/a', 'nombre', 'client', 'cliente', 'name', 'customer', 'total', 'suma', 'resumen', 'notas', 'observaciones'];
  
  if (tab === '1HRGT') {
    // 1HRGT: Column G (index 2) is Client Name
    const colG = String(row[2] || '').trim();
    return colG !== '' && !ignoredValues.includes(colG.toLowerCase());
  } else {
    // RVA: Column F (index 1) is Client Name
    const colF = String(row[1] || '').trim();
    return colF !== '' && !ignoredValues.includes(colF.toLowerCase());
  }
};

// Helper: Finds maximum DL number in a sheet range
export const getMaxDLNumber = (values) => {
  let maxDL = 0;
  let hasB = true;
  if (Array.isArray(values)) {
    for (const row of values) {
      if (!row || !row[0]) continue;
      const str = String(row[0]).trim();
      const match = str.match(/([A-Za-z]*)[\s-]*(\d+)/);
      if (match) {
        const num = parseInt(match[2], 10);
        if (!isNaN(num) && num > maxDL && num < 1000000) {
          maxDL = num;
          if (match[1]) {
            hasB = match[1].toUpperCase().includes('B');
          }
        }
      }
    }
  }
  if (maxDL === 0) maxDL = 5000;
  return { maxDL, prefix: hasB ? 'B' : '' };
};

function App() {
  // Persisted Auth States with expiration check (Google OAuth token valid for ~1 hour)
  const [token, setToken] = useState(() => {
    const savedToken = localStorage.getItem('google_token');
    const savedTime = localStorage.getItem('google_token_time');
    // If token is older than 50 minutes (3000000 ms), treat as expired
    if (savedToken && savedTime && Date.now() - parseInt(savedTime, 10) > 3000000) {
      localStorage.removeItem('google_token');
      localStorage.removeItem('google_user');
      localStorage.removeItem('google_token_time');
      return null;
    }
    return savedToken || null;
  });
  
  const [user, setUser] = useState(() => {
    const savedToken = localStorage.getItem('google_token');
    const savedTime = localStorage.getItem('google_token_time');
    if (!savedToken || (savedTime && Date.now() - parseInt(savedTime, 10) > 3000000)) {
      return null;
    }
    const saved = localStorage.getItem('google_user');
    return saved ? JSON.parse(saved) : null;
  });
  
  // Data states
  const [emails, setEmails] = useState([]);
  const [activeLabels, setActiveLabels] = useState([]); 
  const [monthLabels, setMonthLabels] = useState([]); 
  
  // UI states
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('inbox'); 
  const [selectedIds, setSelectedIds] = useState(new Set()); 
  
  // Modal states
  const [isTrackingModalOpen, setIsTrackingModalOpen] = useState(false);
  const [isFolderModalOpen, setIsFolderModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
  const [isImageEditorOpen, setIsImageEditorOpen] = useState(false);
  const [isTranslationModalOpen, setIsTranslationModalOpen] = useState(false);
  const [isEmailPreviewOpen, setIsEmailPreviewOpen] = useState(false);
  const [extractedData, setExtractedData] = useState(null);
  const [croppedImages, setCroppedImages] = useState([]);
  const [licenseQueue, setLicenseQueue] = useState([]);
  const [processedDocs, setProcessedDocs] = useState([]);
  
  const [trackingNumber, setTrackingNumber] = useState('');
  const [processing, setProcessing] = useState(false);
  
  const [editorUrls, setEditorUrls] = useState([]);
  const [editorFolder, setEditorFolder] = useState('');
  const [generatedDocxBlob, setGeneratedDocxBlob] = useState(null);
  const [activeEmailItem, setActiveEmailItem] = useState(null);
  const [activeCustomerEmail, setActiveCustomerEmail] = useState('');
  const [viewingEmail, setViewingEmail] = useState(null);
  const [isManualUploadOpen, setIsManualUploadOpen] = useState(false);
  const [manualUploadLabel, setManualUploadLabel] = useState(null);
  
  // Move to 0. Dx Label states
  const [isMoveToLabelModalOpen, setIsMoveToLabelModalOpen] = useState(false);
  const [dxSubLabels, setDxSubLabels] = useState([]);
  const [labelSearchQuery, setLabelSearchQuery] = useState('');
  const [loadingLabels, setLoadingLabels] = useState(false);
  
  // Settings & Persisted
  const [targetMonthFolder, setTargetMonthFolder] = useState(() => {
    const saved = localStorage.getItem('targetMonthFolder');
    return saved ? JSON.parse(saved) : null;
  });
  
  const [sheetName, setSheetName] = useState(() => {
    const defaultMonthYear = new Date().toLocaleString('en-US', { month: 'long', year: 'numeric' });
    return localStorage.getItem('sheetName') || defaultMonthYear;
  });

  const [geminiApiKey, setGeminiApiKey] = useState(() => {
    return localStorage.getItem('geminiApiKey') || '';
  });

  // Preview Data
  const [previewData, setPreviewData] = useState({
    tab: '1HRGT',
    trackingId: '',
    trackingLabel: '',
    licenses: 1,
    availableTrackings: [],
    rowIdx: -1,
    client: '',
    country: '',
    language: '',
    price: '',
    spreadsheetId: ''
  });

  // Initial load if already authenticated
  useEffect(() => {
    if (token && user) {
      refreshData(token, activeTab);
    }
  }, []);

  const handleAuthError = (status) => {
    if (status === 401) {
      logOut();
      alert("Tu sesión de Google ha expirado por seguridad (dura 1 hora). Por favor vuelve a iniciar sesión con un clic.");
      throw new Error("Unauthorized");
    }
  };

  const login = useGoogleLogin({
    onSuccess: (codeResponse) => {
      setToken(codeResponse.access_token);
      localStorage.setItem('google_token', codeResponse.access_token);
      localStorage.setItem('google_token_time', Date.now().toString());
      fetchUserProfile(codeResponse.access_token);
    },
    onError: (error) => console.log('Login Failed:', error),
    scope: GOOGLE_API_SCOPES,
  });

  const logOut = () => {
    googleLogout();
    setUser(null);
    setToken(null);
    setEmails([]);
    setActiveLabels([]);
    setSelectedIds(new Set());
    localStorage.removeItem('google_token');
    localStorage.removeItem('google_user');
    localStorage.removeItem('google_token_time');
  };

  const fetchUserProfile = async (accessToken) => {
    try {
      const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const data = await res.json();
      setUser(data);
      localStorage.setItem('google_user', JSON.stringify(data));
      refreshData(accessToken, 'inbox');
    } catch (err) {
      console.error('Failed to fetch user profile', err);
    }
  };

  const refreshData = (accessToken = token, tab = activeTab) => {
    setSelectedIds(new Set());
    if (tab === 'inbox') {
      fetchInbox(accessToken);
    } else if (tab === 'progress') {
      fetchProgressLabels(accessToken);
    }
  };

  const fetchInbox = async (accessToken) => {
    setLoading(true);
    try {
      const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages?q=in:inbox&maxResults=20', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      handleAuthError(res.status);
      const data = await res.json();
      
      if (data.messages && data.messages.length > 0) {
        const messageDetails = await Promise.all(
          data.messages.map(async (msg) => {
            const msgRes = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}`, {
              headers: { Authorization: `Bearer ${accessToken}` },
            });
            return msgRes.json();
          })
        );
        
        const formattedEmails = messageDetails.map(msg => {
          const headers = msg.payload.headers;
          const subject = headers.find(h => h.name === 'Subject')?.value || 'No Subject';
          const from = headers.find(h => h.name === 'From')?.value || 'Unknown';
          const date = headers.find(h => h.name === 'Date')?.value || '';
          
          const senderMatch = from.match(/^(.*?)\s*</);
          const senderName = senderMatch ? senderMatch[1].replace(/"/g, '') : from;

          let bodyData = '';
          if (msg.payload.parts) {
            for (let part of msg.payload.parts) {
              if (part.mimeType === 'text/plain' && part.body.data) {
                bodyData = part.body.data;
                break;
              } else if (part.mimeType === 'text/html' && part.body.data) {
                bodyData = part.body.data;
              } else if (part.parts) {
                for (let subPart of part.parts) {
                   if (subPart.mimeType === 'text/plain' && subPart.body.data) {
                      bodyData = subPart.body.data; break;
                   }
                }
              }
            }
          } else if (msg.payload.body && msg.payload.body.data) {
            bodyData = msg.payload.body.data;
          }
          
          let fullBody = msg.snippet;
          if (bodyData) {
            try {
              fullBody = decodeURIComponent(escape(atob(bodyData.replace(/-/g, '+').replace(/_/g, '/'))));
              fullBody = fullBody.replace(/<[^>]+>/g, '\n').replace(/&nbsp;/g, ' ').replace(/\n\s*\n/g, '\n\n').trim();
            } catch(e) {}
          }

          return {
            id: msg.id,
            threadId: msg.threadId,
            snippet: msg.snippet,
            fullBody: fullBody,
            subject,
            sender: senderName,
            fromRaw: from,
            rawDate: date ? new Date(date).toLocaleString() : '',
            date: date ? new Date(date).toLocaleDateString([], { month: 'short', day: 'numeric' }) : ''
          };
        });
        setEmails(formattedEmails);
      } else {
        setEmails([]);
      }
    } catch (err) {
      console.error('Failed to fetch inbox', err);
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = () => {
    localStorage.setItem('sheetName', sheetName);
    localStorage.setItem('geminiApiKey', geminiApiKey);
    setIsSettingsModalOpen(false);
  };

  const handleAssignTracking = async (passedTrackingNumber = trackingNumber, closeModals = true) => {
    if (!passedTrackingNumber.trim() || selectedIds.size === 0) return;
    setProcessing(true);
    try {
      const newLabelName = `0. Work/0. 1 HOUR/0. DL IN PROGRESS/${passedTrackingNumber}`;
      let labelId = null;
      
      const createLabelRes = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/labels', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newLabelName, labelListVisibility: 'labelShow', messageListVisibility: 'show' })
      });
      
      handleAuthError(createLabelRes.status);
      const createLabelData = await createLabelRes.json();
      
      if (createLabelRes.ok) {
        labelId = createLabelData.id;
      } else if (createLabelData.error && createLabelData.error.code === 409) {
        const listRes = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/labels', {
          headers: { Authorization: `Bearer ${token}` }
        });
        const listData = await listRes.json();
        const existingLabel = listData.labels.find(l => l.name === newLabelName);
        if (existingLabel) labelId = existingLabel.id;
      }

      if (!labelId) throw new Error("Could not create or find label");

      await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/batchModify', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ids: Array.from(selectedIds),
          addLabelIds: [labelId],
          removeLabelIds: ['INBOX']
        })
      });

      setEmails(emails.filter(e => !selectedIds.has(e.id)));
      setSelectedIds(new Set());
      if (closeModals) {
        setIsTrackingModalOpen(false);
        setTrackingNumber('');
      }
    } catch (err) {
      console.error('Failed to process emails', err);
      if (err.message !== "Unauthorized") {
        alert('Error processing emails. Check console.');
      }
    } finally {
      setProcessing(false);
    }
  };

  // Registration Flow
  const handleRegisterClick = async () => {
    if (selectedIds.size === 0) return;
    if (!token) {
      alert("No estás autenticado. Por favor inicia sesión con Google.");
      return;
    }
    setProcessing(true);
    try {
      // 1. Fetch full email to parse data
      let clientName = '';
      let nombre = '';
      let apellido = '';
      let country = '';
      let language = '';
      let price = '';
      let tab = '1HRGT';
      let foundData = false;

      for (let emailId of Array.from(selectedIds)) {
        const msgRes = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${emailId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (msgRes.status === 401) handleAuthError(msgRes.status);
        const msgData = await msgRes.json();

        let bodyData = '';
        if (msgData.payload?.parts) {
          for (let part of msgData.payload.parts) {
            if (part.mimeType === 'text/plain' && part.body?.data) {
              bodyData = part.body.data;
              break;
            } else if (part.mimeType === 'text/html' && part.body?.data) {
              bodyData = part.body.data; // fallback
            } else if (part.parts) {
              for (let subPart of part.parts) {
                 if (subPart.mimeType === 'text/plain' && subPart.body?.data) {
                    bodyData = subPart.body.data; break;
                 }
              }
            }
          }
        } else if (msgData.payload?.body?.data) {
          bodyData = msgData.payload.body.data;
        }

        let emailText = '';
        if (bodyData) {
          try {
            emailText = decodeURIComponent(escape(atob(bodyData.replace(/-/g, '+').replace(/_/g, '/'))));
          } catch (e) {
            emailText = msgData.snippet || '';
          }
        } else {
          emailText = msgData.snippet || '';
        }

        let cleanText = emailText.replace(/<[^>]+>/g, '\n').replace(/&nbsp;/g, ' ').replace(/\r\n/g, '\n').replace(/\n+/g, '\n');

        const cleanExtracted = (text) => {
          if (!text) return '';
          let cleaned = text.split(/https?:\/\//i)[0]; // remove URLs and everything after
          cleaned = cleaned.replace(/<[^>]+>/g, ''); // remove HTML
          cleaned = cleaned.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/gi, ''); // remove emails
          return cleaned.trim();
        };

        const translateToEnglish = (text) => {
          if (!text) return '';
          const map = {
            'español': 'Spanish', 'espanol': 'Spanish', 'inglés': 'English', 'ingles': 'English',
            'francés': 'French', 'frances': 'French', 'alemán': 'German', 'aleman': 'German',
            'italiano': 'Italian', 'portugués': 'Portuguese', 'portugues': 'Portuguese',
            'japonés': 'Japanese', 'japones': 'Japanese', 'chino': 'Chinese', 'coreano': 'Korean',
            'ruso': 'Russian', 'árabe': 'Arabic', 'arabe': 'Arabic', 'holandés': 'Dutch', 'holandes': 'Dutch',
            'méxico': 'Mexico', 'mexico': 'Mexico', 'españa': 'Spain', 'espana': 'Spain',
            'francia': 'France', 'alemania': 'Germany', 'italia': 'Italy',
            'japón': 'Japan', 'japon': 'Japan', 'china': 'China', 'corea': 'Korea',
            'brasil': 'Brazil', 'rusia': 'Russia', 'suiza': 'Switzerland', 'suecia': 'Sweden',
            'holanda': 'Netherlands', 'países bajos': 'Netherlands', 'paises bajos': 'Netherlands',
            'bélgica': 'Belgium', 'belgica': 'Belgium', 'dinamarca': 'Denmark',
            'noruega': 'Norway', 'finlandia': 'Finland', 'polonia': 'Poland',
            'taiwán': 'Taiwan', 'taiwan': 'Taiwan'
          };
          const lower = text.toLowerCase().trim();
          return map[lower] || text.trim();
        };

        const buildRegex = (keywords) => new RegExp(`(?:^|[\\s>])(?:${keywords})[\\s]*(?:[:：][\\s]*|[\\s]+)([^\\n<]+)`, 'i');
        
        const nombreMatch = cleanText.match(buildRegex('Nombre|First Name|Name|Vorname|名前|氏名'));
        const apellidoMatch = cleanText.match(buildRegex('Apellido|Last Name|Surname|Nachname|苗字'));
        const countryMatch = cleanText.match(buildRegex('Land des[^:]*|Country[^:]*|País|Pais|国|発行国'));
        const languageMatch = cleanText.match(buildRegex('Sprache des[^:]*|Language[^:]*|Idioma|言語'));
        const priceMatch = cleanText.match(/-\s*\$(\d+)/) || cleanText.match(/Price.*\$(\d+)/i) || cleanText.match(/\$(\d+)/);

        if (nombreMatch || apellidoMatch || priceMatch) {
          nombre = cleanExtracted(nombreMatch ? nombreMatch[1] : '');
          apellido = cleanExtracted(apellidoMatch ? apellidoMatch[1] : '');
          clientName = `${nombre} ${apellido}`.trim() || cleanExtracted(nombreMatch ? nombreMatch[1] : '');
          country = translateToEnglish(cleanExtracted(countryMatch ? countryMatch[1] : ''));
          language = translateToEnglish(cleanExtracted(languageMatch ? languageMatch[1] : ''));
          price = priceMatch ? `$${priceMatch[1]}` : '$65';
          
          if (cleanText.includes('RVA') || (msgData.snippet && msgData.snippet.includes('RVA')) || /RVA/i.test(msgData.payload?.headers?.find(h => h.name === 'Subject')?.value || '')) {
            tab = 'RVA';
          }
          foundData = true;
          break; // Stop looking, we found the form email
        }
      }

      // 3. Find Spreadsheet ID
      const cleanSheetName = (sheetName || '').trim();
      let spreadsheetId = null;
      let spreadsheetTitle = '';

      if (cleanSheetName) {
        const escapedName = cleanSheetName.replace(/'/g, "\\'");
        const driveQuery = `(name = '${escapedName}' or name contains '${escapedName}') and mimeType = 'application/vnd.google-apps.spreadsheet' and trashed = false`;
        const driveUrl = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(driveQuery)}&supportsAllDrives=true&includeItemsFromAllDrives=true&fields=files(id,name)`;
        const driveRes = await fetch(driveUrl, { headers: { Authorization: `Bearer ${token}` } });
        if (driveRes.status === 401) handleAuthError(driveRes.status);
        if (driveRes.ok) {
          const driveData = await driveRes.json();
          if (driveData.files && driveData.files.length > 0) {
            const exactMatch = driveData.files.find(f => f.name.trim().toLowerCase() === cleanSheetName.toLowerCase());
            const pickedFile = exactMatch || driveData.files[0];
            spreadsheetId = pickedFile.id;
            spreadsheetTitle = pickedFile.name;
          }
        }
      }

      // Fallback: discover recent spreadsheet with 1HRGT/RVA tabs
      if (!spreadsheetId) {
        const recentRes = await fetch(
          `https://www.googleapis.com/drive/v3/files?q=mimeType%3D'application%2Fvnd.google-apps.spreadsheet'%20and%20trashed%3Dfalse&orderBy=modifiedTime%20desc&pageSize=10&supportsAllDrives=true&includeItemsFromAllDrives=true&fields=files(id,name)`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (recentRes.status === 401) handleAuthError(recentRes.status);
        if (recentRes.ok) {
          const recentData = await recentRes.json();
          for (const file of (recentData.files || [])) {
            try {
              const metaRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${file.id}?fields=sheets.properties.title`, {
                headers: { Authorization: `Bearer ${token}` }
              });
              if (metaRes.ok) {
                const metaData = await metaRes.json();
                const titles = (metaData.sheets || []).map(s => s.properties?.title);
                if (titles.includes('1HRGT') || titles.includes('RVA')) {
                  spreadsheetId = file.id;
                  spreadsheetTitle = file.name;
                  break;
                }
              }
            } catch (e) {
              // ignore
            }
          }
        }
      }

      if (!spreadsheetId) {
        throw new Error(`No se encontró el archivo de Google Sheets "${cleanSheetName}". Verifica que exista en tu Google Drive y que el nombre en Configuración coincida.`);
      }

      // 4. Fetch Sheet Data to find empty row
      const sheetRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent("'" + tab + "'!E:K")}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (sheetRes.status === 401) handleAuthError(sheetRes.status);
      const sheetData = await sheetRes.json();
      const values = sheetData.values || [];

      // Find highest DL number in sheet
      const { maxDL, prefix } = getMaxDLNumber(values);

      // Find last filled client row
      let lastFilledClientIdx = -1;
      for (let i = 0; i < values.length; i++) {
        if (isRowFilled(values[i], tab)) {
          lastFilledClientIdx = i;
        }
      }

      // The target row is immediately after the last filled client
      const startIdx = lastFilledClientIdx >= 0 ? lastFilledClientIdx + 1 : 1;
      const targetRowIdx = startIdx + 1; // 1-indexed for Sheets

      // Collect available consecutive DLs (at least 6)
      let availableTrackings = [];
      let currentDLNum = maxDL;
      for (let i = startIdx; availableTrackings.length < 6; i++) {
        const row = values[i];
        let dl = '';
        if (row && row[0] && String(row[0]).trim() !== '') {
          dl = String(row[0]).trim();
          const m = dl.match(/(\d+)/);
          if (m) {
            const num = parseInt(m[1], 10);
            if (num > currentDLNum) currentDLNum = num;
          }
        } else {
          currentDLNum++;
          dl = `${prefix}${currentDLNum}`;
        }
        availableTrackings.push(dl);
      }

      const trackingId = availableTrackings[0] || `${prefix}${maxDL + 1}`;

      let licensesCount = 1;
      let finalTrackingLabel = `${trackingId} ${nombre}`.trim();
      
      if (['$110', '$130', '$150'].includes(price)) {
         licensesCount = 2;
         if (availableTrackings.length > 1) {
            let t1 = trackingId.startsWith('B') ? trackingId : `B${trackingId}`;
            let t2 = availableTrackings[1];
            if (t2.startsWith('B')) t2 = t2.substring(1);
            finalTrackingLabel = `${t1}, ${t2} ${nombre}`.trim();
         }
      }

      setPreviewData({
        tab,
        trackingId,
        trackingLabel: finalTrackingLabel,
        licenses: licensesCount,
        availableTrackings,
        rowIdx: targetRowIdx,
        client: clientName,
        nombre,
        apellido,
        country,
        language,
        price,
        spreadsheetId,
        spreadsheetTitle: spreadsheetTitle || cleanSheetName
      });
      
      setIsPreviewModalOpen(true);
    } catch (err) {
      console.error("Error al registrar:", err);
      if (err.message !== "Unauthorized") {
        alert(`Error al preparar registro:\n\n${err.message}`);
      }
    } finally {
      setProcessing(false);
    }
  };

  const confirmRegistration = async () => {
    setProcessing(true);
    try {
      const { tab, rowIdx, country, language, price, spreadsheetId, trackingId, trackingLabel, licenses, nombre, apellido, availableTrackings } = previewData;
      const client = `${nombre || ''} ${apellido || ''}`.trim();
      let sheetValues = [];

      for (let i = 0; i < licenses; i++) {
        let currentPrice = i === 0 ? price : '$0';
        let currentDL = (availableTrackings && availableTrackings[i]) || (i === 0 ? trackingId : '');
        
        if (tab === '1HRGT') {
          // 1HRGT: E=DL, F=TRANS ("JC"), G=Client, H=Country, I=Language, J=Payment, K=Price
          sheetValues.push({
            range: `'${tab}'!E${rowIdx + i}:K${rowIdx + i}`,
            values: [[currentDL, "JC", client, country, language, "Stripe", currentPrice]]
          });
        } else {
          // RVA: E=DL, F=Client, G=Country, H=Language, I=Payment, J=Price, N=TRANS ("JC")
          sheetValues.push({
            range: `'${tab}'!E${rowIdx + i}:J${rowIdx + i}`,
            values: [[currentDL, client, country, language, "Stripe", currentPrice]]
          });
          sheetValues.push({
            range: `'${tab}'!N${rowIdx + i}`,
            values: [["JC"]]
          });
        }
      }

      const updateRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchUpdate`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          valueInputOption: 'USER_ENTERED',
          data: sheetValues
        })
      });

      handleAuthError(updateRes.status);

      if (!updateRes.ok) {
        const errorData = await updateRes.json().catch(() => ({}));
        const detailedMsg = errorData?.error?.message || `HTTP ${updateRes.status} (${updateRes.statusText})`;
        console.error("Error detallado de Google Sheets batchUpdate:", errorData);
        throw new Error(`Google Sheets (${updateRes.status}): ${detailedMsg}`);
      }

      // After updating Sheets, assign the label and move the email
      await handleAssignTracking(trackingLabel, false);
      setIsPreviewModalOpen(false);

    } catch (err) {
      console.error("Error al confirmar el registro:", err);
      if (err.message !== "Unauthorized") {
        alert(`Error al confirmar el registro:\n\n${err.message}`);
      }
    } finally {
      setProcessing(false);
    }
  };


  const handleTrashEmails = async () => {
    if (selectedIds.size === 0) return;
    setProcessing(true);
    try {
      const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/batchModify', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ids: Array.from(selectedIds),
          addLabelIds: ['TRASH'],
          removeLabelIds: ['INBOX']
        })
      });
      handleAuthError(res.status);
      setEmails(emails.filter(e => !selectedIds.has(e.id)));
      setSelectedIds(new Set());
    } catch (err) {
      console.error('Failed to trash emails', err);
      if (err.message !== "Unauthorized") {
        alert('Error trashing emails.');
      }
    } finally {
      setProcessing(false);
    }
  };

  const handleWorkLabel = async () => {
    if (selectedIds.size === 0) return;
    setProcessing(true);
    try {
      const listRes = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/labels', {
        headers: { Authorization: `Bearer ${token}` }
      });
      handleAuthError(listRes.status);
      const listData = await listRes.json();
      let workLabel = listData.labels.find(l => l.name === '0. Work');
      
      if (!workLabel) {
        const createRes = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/labels', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: '0. Work', labelListVisibility: 'labelShow', messageListVisibility: 'show' })
        });
        workLabel = await createRes.json();
      }

      await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/batchModify', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ids: Array.from(selectedIds),
          addLabelIds: [workLabel.id],
          removeLabelIds: ['INBOX']
        })
      });

      setEmails(emails.filter(e => !selectedIds.has(e.id)));
      setSelectedIds(new Set());
    } catch (err) {
      console.error('Failed to add Work label', err);
      if (err.message !== "Unauthorized") {
        alert('Error etiquetando como 0. Work');
      }
    } finally {
      setProcessing(false);
    }
  };


  const fetchProgressLabels = async (accessToken) => {
    setLoading(true);
    try {
      const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/labels', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      handleAuthError(res.status);
      const data = await res.json();
      
      if (data.labels) {
        const prefix = '0. Work/0. 1 HOUR/0. DL IN PROGRESS/';
        const progress = data.labels.filter(l => 
          l.name.startsWith(prefix) && l.name !== prefix
        ).map(l => ({
          id: l.id,
          name: l.name,
          displayName: l.name.replace(prefix, '')
        }));

        // Sort ascending by order number (menor al mayor)
        const getOrderNumber = (str) => {
          if (!str) return Infinity;
          const match = str.match(/\b[A-Za-z]?(\d{1,8})\b/) || str.match(/\d+/);
          if (match) {
            const num = parseInt(match[1] || match[0], 10);
            if (!isNaN(num)) return num;
          }
          return Infinity;
        };

        progress.sort((a, b) => {
          const numA = getOrderNumber(a.displayName);
          const numB = getOrderNumber(b.displayName);
          if (numA !== numB) {
            return numA - numB;
          }
          return a.displayName.localeCompare(b.displayName, undefined, { numeric: true, sensitivity: 'base' });
        });

        setActiveLabels(progress);
      }
    } catch (err) {
      console.error('Failed to fetch labels', err);
    } finally {
      setLoading(false);
    }
  };

const KNOWN_COUNTRIES = [
  'vietnam', 'germany', 'alemania', 'france', 'francia', 'china', 'japan', 'japon',
  'korea', 'corea', 'brazil', 'brasil', 'spain', 'espana', 'españa', 'italy', 'italia',
  'portugal', 'russia', 'rusia', 'russian fed', 'switzerland', 'suiza', 'sweden', 'suecia',
  'netherlands', 'holanda', 'belgium', 'belgica', 'denmark', 'dinamarca',
  'norway', 'noruega', 'finland', 'finlandia', 'poland', 'polonia', 'taiwan',
  'indonesia', 'israel', 'czech', 'hungary', 'hungria', 'canada', 'mexico',
  'chile', 'argentina', 'colombia', 'peru', 'uruguay', 'ecuador', 'french poly', 'french polynesia', 'unknown',
  'haiti', 'cuba', 'venezuela', 'usa', 'eeuu', 'uk', 'england', 'inglaterra', 'australia', 'new zealand', 'nz', 'india', 'pakistan', 'philippines', 'filipinas'
];

const getCleanClientLabelName = (rawName) => {
  if (!rawName) return '';
  let leaf = String(rawName).split('/').pop().trim();

  // Remove bracket tags like [Ya registrado] or [Sin DL libre]
  leaf = leaf.replace(/^\[[^\]]+\]\s*/, '').trim();

  // Match order consecutive(s) at start: e.g. "B5244", "B5296, 5297", "B5296, B5297", "RVA3755, RVA3756"
  const match = leaf.match(/^([A-Za-z0-9]+(?:\s*,\s*[A-Za-z0-9]+)*)\s*(.*)$/);
  if (match) {
    const dlPart = match[1].trim();
    let remaining = match[2].trim();

    if (!remaining) return dlPart;

    // Remove known country words if present
    const words = remaining.split(/\s+/);
    if (words.length > 1) {
      const firstTwo = `${words[0]} ${words[1]}`.toLowerCase();
      const firstOne = words[0].toLowerCase();
      const lastTwo = `${words[words.length - 2]} ${words[words.length - 1]}`.toLowerCase();
      const lastOne = words[words.length - 1].toLowerCase();

      if (KNOWN_COUNTRIES.includes(firstTwo)) {
        remaining = words.slice(2).join(' ').trim();
      } else if (KNOWN_COUNTRIES.includes(firstOne)) {
        remaining = words.slice(1).join(' ').trim();
      } else if (KNOWN_COUNTRIES.includes(lastTwo)) {
        remaining = words.slice(0, -2).join(' ').trim();
      } else if (KNOWN_COUNTRIES.includes(lastOne)) {
        remaining = words.slice(0, -1).join(' ').trim();
      }
    } else if (KNOWN_COUNTRIES.includes(words[0].toLowerCase())) {
      remaining = '';
    }

    return remaining ? `${dlPart} ${remaining}`.trim() : dlPart;
  }

  return leaf;
};

  const getMonthFolderLabel = async (accessToken) => {
    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    const now = new Date();
    const currentMonth = monthNames[now.getMonth()];
    const currentYear2Digits = String(now.getFullYear()).slice(-2); // e.g. "26"
    
    const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/labels', {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    handleAuthError(res.status);
    const data = await res.json();
    const allLabels = data.labels || [];

    // 1. Detect base parent prefix (e.g. "0. Work/0. 1 HOUR")
    let basePrefix = '';
    const dlInProgressLabel = allLabels.find(l => l.name.includes('0. DL IN PROGRESS'));
    if (dlInProgressLabel) {
      const parts = dlInProgressLabel.name.split('/0. DL IN PROGRESS')[0];
      if (parts) basePrefix = parts;
    }
    if (!basePrefix) {
      const workLabel = allLabels.find(l => l.name.startsWith('0. Work/0. 1 HOUR'));
      if (workLabel) basePrefix = '0. Work/0. 1 HOUR';
    }

    // 2. If targetMonthFolder is already configured and exists in Gmail labels, use it
    if (targetMonthFolder && targetMonthFolder.name) {
      const matchExisting = allLabels.find(l => 
        l.name.toLowerCase() === targetMonthFolder.name.toLowerCase() || l.id === targetMonthFolder.id
      );
      if (matchExisting) {
        const folderObj = { id: matchExisting.id, name: matchExisting.name, displayName: matchExisting.name.split('/').pop() };
        setTargetMonthFolder(folderObj);
        localStorage.setItem('targetMonthFolder', JSON.stringify(folderObj));
        return folderObj;
      }
    }

    // 3. Search for existing month label under basePrefix or anywhere matching month folder pattern
    const spanishMonthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Setiembre", "Octubre", "Noviembre", "Diciembre"];
    const currentSpanishMonth = spanishMonthNames[now.getMonth()];
    const isCurrentMonthLeaf = (leaf) => {
      if (!leaf || !leaf.startsWith('0.')) return false;
      return new RegExp(`\\b(?:${currentMonth}|${currentSpanishMonth})\\b`, 'i').test(leaf);
    };

    let found = allLabels.find(l => {
      if (l.name.includes('DL IN PROGRESS')) return false;
      if (basePrefix && l.name.startsWith(basePrefix)) {
        const leaf = l.name.split('/').pop();
        return isCurrentMonthLeaf(leaf);
      }
      return false;
    });

    if (!found) {
      found = allLabels.find(l => {
        if (l.name.includes('DL IN PROGRESS')) return false;
        const leaf = l.name.split('/').pop();
        return isCurrentMonthLeaf(leaf);
      });
    }

    if (found) {
      const displayName = found.name.split('/').pop();
      const folderObj = { id: found.id, name: found.name, displayName };
      setTargetMonthFolder(folderObj);
      localStorage.setItem('targetMonthFolder', JSON.stringify(folderObj));
      return folderObj;
    }

    // 4. Create month folder under basePrefix (e.g. "0. Work/0. 1 HOUR/0. Dx September 26")
    const folderBaseName = `0. Dx ${currentMonth} ${currentYear2Digits}`;
    const newFolderName = basePrefix ? `${basePrefix}/${folderBaseName}` : folderBaseName;
    
    const createRes = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/labels', {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newFolderName, labelListVisibility: 'labelShow', messageListVisibility: 'show' })
    });
    handleAuthError(createRes.status);
    const createData = await createRes.json();
    const folderObj = { id: createData.id, name: newFolderName, displayName: folderBaseName };
    setTargetMonthFolder(folderObj);
    localStorage.setItem('targetMonthFolder', JSON.stringify(folderObj));
    return folderObj;
  };

  const openFolderPicker = async () => {
    setIsFolderModalOpen(true);
    setLoading(true);
    try {
      const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/labels', {
        headers: { Authorization: `Bearer ${token}` },
      });
      handleAuthError(res.status);
      const data = await res.json();
      if (data.labels) {
        const monthNamesPattern = /(?:January|February|March|April|May|June|July|August|September|October|November|December|Enero|Febrero|Marzo|Abril|Mayo|Junio|Julio|Agosto|Septiembre|Setiembre|Octubre|Noviembre|Diciembre)/i;
        const availableFolders = data.labels.filter(l => {
          const leaf = l.name.split('/').pop();
          const isDxOrMonth = leaf.startsWith('0.') && (
            monthNamesPattern.test(leaf) || 
            /0\.\s*(?:Dx|Do|D[a-zA-Z0-9]?|E|F|F\s*O|[A-Za-z0-9]+)\s+/i.test(leaf)
          );
          const isNotProgress = !l.name.includes('DL IN PROGRESS');
          const isNotParentOnly = l.name !== '0. Work/0. 1 HOUR' && l.name !== '0. 1 HOUR';
          const parts = l.name.split('/');
          const isTopMonthFolder = parts.length <= (l.name.startsWith('0. Work/') ? 3 : 2);
          return isDxOrMonth && isNotProgress && isNotParentOnly && isTopMonthFolder;
        }).map(l => ({
          id: l.id,
          name: l.name,
          displayName: l.name.split('/').pop()
        }));
        
        const uniqueFolders = [];
        const seen = new Set();
        for (const f of availableFolders) {
          if (!seen.has(f.name)) {
            seen.add(f.name);
            uniqueFolders.push(f);
          }
        }
        uniqueFolders.sort((a, b) => a.displayName.localeCompare(b.displayName));
        setMonthLabels(uniqueFolders);
      }
    } catch(err) {
      console.error('Failed to fetch month folders', err);
    } finally {
      setLoading(false);
    }
  };

  const selectTargetFolder = (folder) => {
    setTargetMonthFolder(folder);
    localStorage.setItem('targetMonthFolder', JSON.stringify(folder));
    setIsFolderModalOpen(false);
  };

  const handleFinalizeLabels = async () => {
    if (selectedIds.size === 0) return;
    
    setProcessing(true);
    try {
      const monthFolder = await getMonthFolderLabel(token);
      if (!monthFolder || !monthFolder.name) {
        throw new Error("No se pudo obtener la carpeta del mes.");
      }
      
      const labelsToMove = activeLabels.filter(l => selectedIds.has(l.id));

      for (const label of labelsToMove) {
        const cleanChildName = getCleanClientLabelName(label.displayName || label.name);
        const newName = `${monthFolder.name}/${cleanChildName}`;
        
        const res = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/labels/${label.id}`, {
          method: 'PATCH',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: newName
          })
        });
        handleAuthError(res.status);
      }

      await fetchProgressLabels(token);
      setSelectedIds(new Set());
    } catch (err) {
      console.error('Failed to move labels', err);
      if (err.message !== "Unauthorized") {
        alert('Error al mover etiquetas: ' + err.message);
      }
    } finally {
      setProcessing(false);
    }
  };

  const openMoveToLabelModal = async () => {
    if (selectedIds.size === 0) return;
    setIsMoveToLabelModalOpen(true);
    setLoadingLabels(true);
    setLabelSearchQuery('');
    try {
      const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/labels', {
        headers: { Authorization: `Bearer ${token}` }
      });
      handleAuthError(res.status);
      const data = await res.json();
      const allLabels = data.labels || [];

      // Find sub-labels under 0. Dx <Month> or month folders
      const subLabels = allLabels.filter(l => {
        const isDxChild = /0\.\s*(?:Dx|Do|D[a-zA-Z0-9]?|E|F|F\s*O|[A-Za-z0-9]+)\s+[^/]+\/.+/i.test(l.name) ||
          /(?:January|February|March|April|May|June|July|August|September|October|November|December|Octubre|Noviembre|Diciembre)\s*\d*\/.+/i.test(l.name) ||
          (l.name.includes('0. Dx') && l.name.split('/').length > 1) ||
          (l.name.includes('0. Do') && l.name.split('/').length > 1);
        const isProgressChild = l.name.startsWith('0. Work/0. 1 HOUR/0. DL IN PROGRESS/') && l.name !== '0. Work/0. 1 HOUR/0. DL IN PROGRESS/';
        const isOneHourChild = l.name.startsWith('0. Work/0. 1 HOUR/') && l.name.split('/').length >= 4;
        return isDxChild || isProgressChild || isOneHourChild;
      }).map(l => {
        const parts = l.name.split('/');
        const childName = parts[parts.length - 1];
        const parentName = parts.slice(0, parts.length - 1).join('/');
        return {
          id: l.id,
          name: l.name,
          displayName: childName,
          parentName: parentName
        };
      });

      subLabels.sort((a, b) => a.displayName.localeCompare(b.displayName));
      setDxSubLabels(subLabels);
    } catch (err) {
      console.error("Error al cargar etiquetas de 0. Dx:", err);
      alert("Error al cargar etiquetas: " + err.message);
    } finally {
      setLoadingLabels(false);
    }
  };

  const handleMoveEmailsToSelectedLabel = async (targetLabel) => {
    if (selectedIds.size === 0 || !targetLabel) return;
    setProcessing(true);
    try {
      const count = selectedIds.size;
      const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/batchModify', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ids: Array.from(selectedIds),
          addLabelIds: [targetLabel.id],
          removeLabelIds: ['INBOX']
        })
      });
      handleAuthError(res.status);

      setEmails(prev => prev.filter(e => !selectedIds.has(e.id)));
      setSelectedIds(new Set());
      setIsMoveToLabelModalOpen(false);
      alert(`✅ ${count} correo(s) movido(s) a "${targetLabel.displayName}" y removido(s) de Inbox.`);
    } catch (err) {
      console.error("Error al mover correos a la etiqueta:", err);
      if (err.message !== "Unauthorized") {
        alert("Error al mover correos: " + err.message);
      }
    } finally {
      setProcessing(false);
    }
  };

  const fetchGmailImageAttachments = async (msgData, accessToken) => {
    const attachmentUrls = [];
    const searchParts = async (parts) => {
      if (!parts) return;
      for (const part of parts) {
        if (part.parts) {
          await searchParts(part.parts);
        }
        const mimeType = part.mimeType || '';
        const filename = part.filename || '';
        const body = part.body || {};
        
        const isImageMime = mimeType.toLowerCase().startsWith('image/');
        const isImageExt = /\.(jpg|jpeg|png|webp|gif|bmp)$/i.test(filename);
        
        if ((isImageMime || isImageExt) && body.attachmentId) {
          try {
            const attachRes = await fetch(
              `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msgData.id}/attachments/${body.attachmentId}`,
              { headers: { Authorization: `Bearer ${accessToken}` } }
            );
            if (attachRes.ok) {
              const attachData = await attachRes.json();
              if (attachData.data) {
                const base64Data = attachData.data.replace(/-/g, '+').replace(/_/g, '/');
                const finalMime = mimeType || 'image/jpeg';
                attachmentUrls.push(`data:${finalMime};base64,${base64Data}`);
              }
            }
          } catch (err) {
            console.error("Error al descargar adjunto de Gmail:", err);
          }
        }
      }
    };

    if (msgData.payload) {
      if (msgData.payload.parts) {
        await searchParts(msgData.payload.parts);
      } else if (msgData.payload.body && msgData.payload.body.attachmentId) {
        await searchParts([msgData.payload]);
      }
    }
    return attachmentUrls;
  };

  const fetchCustomerEmailFromSheet = async (token, folderName, currentSheetName) => {
    try {
      const targetDLs = extractDLNumbers(folderName, []);
      if (targetDLs.length === 0) return '';
      let spreadsheetId = localStorage.getItem('lastSpreadsheetId') || null;
      if (!spreadsheetId) return '';

      for (const tab of ['1HRGT', 'RVA', 'FORMULARIO']) {
        const sheetRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${tab}!A1:Z1000`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (!sheetRes.ok) continue;
        const sheetData = await sheetRes.json();
        const rows = sheetData.values || [];
        if (rows.length === 0) continue;

        let emailColIdx = -1;
        let dlColIdx = -1;
        for (let r = 0; r < Math.min(3, rows.length); r++) {
          const headerRow = rows[r] || [];
          for (let c = 0; c < headerRow.length; c++) {
            const val = String(headerRow[c] || '').trim().toLowerCase();
            if (val.includes('email') || val.includes('correo')) emailColIdx = c;
            if (['dl', 'dl #', 'dl#', 'consecutivo', 'ref', 'dl number'].includes(val)) dlColIdx = c;
          }
        }
        if (dlColIdx === -1) dlColIdx = 4;

        for (let r = 0; r < rows.length; r++) {
          const row = rows[r] || [];
          const dlVal = String(row[dlColIdx] || '').trim().toUpperCase();
          const cleanDlVal = dlVal.replace(/[^A-Z0-9]/g, '');
          const dlDigits = dlVal.replace(/\D/g, '');

          const dlMatch = targetDLs.some(tdl => {
            if (!tdl) return false;
            const cleanTdl = tdl.toUpperCase().replace(/[^A-Z0-9]/g, '');
            const tdlDigits = tdl.replace(/\D/g, '');
            return (cleanDlVal && cleanDlVal === cleanTdl) ||
                   (dlDigits && tdlDigits && dlDigits === tdlDigits && dlDigits.length >= 3);
          });

          if (dlMatch) {
            if (emailColIdx !== -1 && row[emailColIdx] && isValidCustomerEmail(row[emailColIdx])) {
              return String(row[emailColIdx]).trim().toLowerCase();
            }
            for (const cell of row) {
              const cellStr = String(cell || '').trim();
              if (isValidCustomerEmail(cellStr)) {
                return cellStr.toLowerCase();
              }
            }
          }
        }
      }
    } catch (e) {
      console.warn("No se pudo obtener correo desde Google Sheet:", e);
    }
    return '';
  };

  const handleProcessFolder = async (label) => {
    setProcessing(true);
    setActiveEmailItem(label);
    try {
      // 1. Get messages with this label
      const res = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages?labelIds=${label.id}&maxResults=5`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      handleAuthError(res.status);
      const data = await res.json();
      
      if (!data.messages || data.messages.length === 0) {
        throw new Error('No se encontraron correos en esta carpeta.');
      }
      
      let allUrls = [];
      let customerEmailStr = "";
      
      // 2. Fetch the body of the most recent message(s) in parallel (Promise.all)
      const fetchedMessages = await Promise.all(
        data.messages.map(async (msg) => {
          const msgRes = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          return msgRes.json();
        })
      );
      
      for (const msgData of fetchedMessages) {
        let bodyData = '';
        if (msgData.payload.parts) {
          for (let part of msgData.payload.parts) {
            if (part.mimeType === 'text/plain' && part.body.data) {
              bodyData = part.body.data;
              break;
            } else if (part.mimeType === 'text/html' && part.body.data) {
              bodyData = part.body.data;
            } else if (part.parts) {
              for (let subPart of part.parts) {
                 if (subPart.mimeType === 'text/plain' && subPart.body.data) {
                    bodyData = subPart.body.data; break;
                 }
              }
            }
          }
        } else if (msgData.payload.body && msgData.payload.body.data) {
          bodyData = msgData.payload.body.data;
        }

        let emailText = '';
        if (bodyData) {
          emailText = decodeURIComponent(escape(atob(bodyData.replace(/-/g, '+').replace(/_/g, '/'))));
          // Extract wix static urls
          const regex = /https:\/\/static\.wixstatic\.com\/media\/[^\s"']+/gi;
          const matches = emailText.match(regex);
          if (matches) {
            allUrls = [...allUrls, ...matches];
          }
        }

        // Robust client email extraction
        if (!customerEmailStr) {
          const extractedEmail = extractClientEmailFromMessage(msgData, emailText);
          if (extractedEmail) {
            customerEmailStr = extractedEmail;
          }
        }
      }

      // Fallback: If not found in Gmail message body, lookup in Google Sheets for this DL
      if (!customerEmailStr) {
        const sheetEmail = await fetchCustomerEmailFromSheet(token, label.displayName, sheetName);
        if (sheetEmail) {
          customerEmailStr = sheetEmail;
        }
      }

      setActiveCustomerEmail(customerEmailStr || '');
      
      if (allUrls.length === 0) {
         // Fetch image attachments in parallel with Promise.all
         const attachmentsList = await Promise.all(
           fetchedMessages.map(msgData => fetchGmailImageAttachments(msgData, token))
         );
         for (const attachments of attachmentsList) {
           if (attachments && attachments.length > 0) {
             allUrls = [...allUrls, ...attachments];
           }
         }
      }
      
      if (allUrls.length === 0) {
         // Si sigue sin haber enlaces ni adjuntos, abrir el modal de carga manual
         setManualUploadLabel(label);
         setEditorFolder(label.displayName);
         setIsManualUploadOpen(true);
         return;
      }
      
      // Remove duplicates
      allUrls = [...new Set(allUrls)];
      
      setEditorUrls(allUrls);
      setEditorFolder(label.displayName);
      setIsImageEditorOpen(true);
      
    } catch (err) {
      console.error(err);
      if (err.message !== "Unauthorized") {
         alert(`Error: ${err.message}`);
      }
    } finally {
      setProcessing(false);
    }
  };

  const handleManualUploadLoaded = (dataUrls) => {
    setIsManualUploadOpen(false);
    setEditorUrls(dataUrls);
    if (manualUploadLabel) {
      setEditorFolder(manualUploadLabel.displayName);
    }
    setIsImageEditorOpen(true);
  };

  const processNextLicense = async (queue, docs) => {
    if (queue.length === 0) {
      setIsImageEditorOpen(false);
      setIsEmailPreviewOpen(true);
      return;
    }
    
    setProcessing(true);
    try {
      const currentImages = queue[0];
      const matchedKey = getNormalizedCountryKey(editorFolder);
      
      setCroppedImages(currentImages);
      const data = await extractLicenseData(geminiApiKey, currentImages, matchedKey || editorFolder);
      setExtractedData(data);
      setIsImageEditorOpen(false);
      setIsTranslationModalOpen(true);
    } catch(err) {
      console.error("Error extracted data", err);
      setIsImageEditorOpen(true);
      alert("Error procesando imagen: " + err.message);
    } finally {
      setProcessing(false);
    }
  };

  const handleEditorComplete = async (croppedImagesDataUrls) => {
    // Determine if folder contains multiple distinct license numbers (e.g. "B101, B102")
    let dls = [];
    if (editorFolder) {
      const match = editorFolder.match(/^([a-zA-Z0-9]+(?:\s*,\s*[a-zA-Z0-9]+)*)/);
      if (match) {
        dls = match[1].split(',').map(s => s.trim()).filter(Boolean);
      }
    }
    
    const queue = [];
    if (dls.length > 1) {
      // Multiple licenses in folder: distribute images among licenses
      const imagesPerDoc = Math.max(1, Math.floor(croppedImagesDataUrls.length / dls.length));
      for (let i = 0; i < dls.length; i++) {
        const start = i * imagesPerDoc;
        const end = (i === dls.length - 1) ? croppedImagesDataUrls.length : start + imagesPerDoc;
        queue.push(croppedImagesDataUrls.slice(start, end));
      }
    } else {
      // Single license (standard case, e.g. China with 1, 2, 3 or 4 photos): keep all images together
      queue.push(croppedImagesDataUrls);
    }
    
    setLicenseQueue(queue);
    setProcessedDocs([]);
    
    await processNextLicense(queue, []);
  };

  const handleTranslationSave = async (finalData, templateArrayBuffer) => {
    try {
      console.log("Generating Word Document...");
      const docIndex = processedDocs.length;
      const docxBlob = await generateWordDocument(templateArrayBuffer, finalData, croppedImages, editorFolder, docIndex);
      console.log("Word Document generated successfully. Blob size:", docxBlob.size);
      
      const isMultiple = licenseQueue.length + processedDocs.length > 1;
      const displayIndex = processedDocs.length + 1;
      
      const assignedNumber = getAssignedNumber(editorFolder, docIndex);
      const fileName = assignedNumber || editorFolder;
      
      const newDocs = [...processedDocs, { blob: docxBlob, name: fileName }];
      setProcessedDocs(newDocs);
      
      setIsTranslationModalOpen(false);
      
      const nextQueue = licenseQueue.slice(1);
      setLicenseQueue(nextQueue);
      
      await processNextLicense(nextQueue, newDocs);
    } catch (err) {
      console.error("Error generando documento:", err);
      alert("Error al generar documento Word: " + err.message);
    }
  };

  const handleTranslationDownload = async (finalData, templateArrayBuffer) => {
    try {
      console.log("Generating Word Document for download...");
      const docIndex = processedDocs.length;
      const docxBlob = await generateWordDocument(templateArrayBuffer, finalData, croppedImages, editorFolder, docIndex);
      const url = URL.createObjectURL(docxBlob);
      const a = document.createElement('a');
      a.href = url;
      const assignedNumber = getAssignedNumber(editorFolder, docIndex);
      a.download = `${assignedNumber || editorFolder}.docx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Error generating doc for download:", err);
      alert("Error al descargar Word: " + err.message);
    }
  };

  const extractDLNumbers = (folderName, docs = []) => {
    const dls = new Set();
    if (folderName) {
      // Strip any Gmail label path like "0. Work/0. 1 HOUR/0. DL IN PROGRESS/"
      let cleanFolder = String(folderName).replace(/^.*(?:DL IN PROGRESS|1 HOUR|Work)\//i, '').trim();
      if (cleanFolder.includes('/')) {
        cleanFolder = cleanFolder.split('/').pop().trim();
      }

      // Extract B#### or any consecutive like B1234 or numbers
      const bMatches = cleanFolder.match(/\b[A-Za-z]?\d{3,6}\b/g) || [];
      bMatches.forEach(m => {
        const clean = m.toUpperCase().startsWith('B') ? m.toUpperCase() : `B${m}`;
        dls.add(clean);
      });

      const match = cleanFolder.match(/^([a-zA-Z0-9]+(?:\s*,\s*[a-zA-Z0-9]+)*)/);
      if (match) {
        const parts = match[1].split(',').map(s => s.trim());
        const prefixMatch = parts[0].match(/^[a-zA-Z]+/);
        const prefix = prefixMatch ? prefixMatch[0].toUpperCase() : 'B';
        parts.forEach(p => {
          if (/^\d+$/.test(p)) {
            dls.add((prefix + p).toUpperCase());
          } else if (/^[a-zA-Z]+\d+$/.test(p)) {
            dls.add(p.toUpperCase());
          }
        });
      }
    }
    if (docs && docs.length > 0) {
      docs.forEach(doc => {
        if (doc.name) {
          const m = doc.name.match(/\b[A-Za-z]?\d{3,6}\b/g);
          if (m) {
            m.forEach(val => {
              const clean = val.toUpperCase().startsWith('B') ? val.toUpperCase() : `B${val}`;
              dls.add(clean);
            });
          }
        }
      });
    }
    return Array.from(dls);
  };

  const getColumnLetter = (colIndex) => {
    let temp, letter = '';
    let col = colIndex + 1;
    while (col > 0) {
      temp = (col - 1) % 26;
      letter = String.fromCharCode(temp + 65) + letter;
      col = Math.floor((col - temp - 1) / 26);
    }
    return letter;
  };

  const updateSheetStatusCompleted = async (token, folderName, docs, currentSheetName) => {
    try {
      const targetDLs = extractDLNumbers(folderName, docs);
      console.log("Actualizando Status a COMPLETED para DLs:", targetDLs, "en carpeta:", folderName);
      
      let spreadsheetId = localStorage.getItem('lastSpreadsheetId') || null;

      // 1. Search spreadsheet in Drive by configured name
      const cleanSheetName = (currentSheetName || localStorage.getItem('sheetName') || 'July 2026').trim();
      const escapedName = cleanSheetName.replace(/'/g, "\\'");
      const driveQuery = `(name = '${escapedName}' or name contains '${escapedName}') and mimeType = 'application/vnd.google-apps.spreadsheet' and trashed = false`;
      const driveUrl = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(driveQuery)}&supportsAllDrives=true&includeItemsFromAllDrives=true&fields=files(id,name)`;
      
      const driveRes = await fetch(driveUrl, { headers: { Authorization: `Bearer ${token}` } });
      if (driveRes.ok) {
        const driveData = await driveRes.json();
        if (driveData.files && driveData.files.length > 0) {
          const exactMatch = driveData.files.find(f => f.name.trim().toLowerCase() === cleanSheetName.toLowerCase());
          spreadsheetId = exactMatch ? exactMatch.id : driveData.files[0].id;
        }
      }

      // 2. If not found by name, discover recent spreadsheets containing 1HRGT or RVA tabs
      if (!spreadsheetId) {
        const recentRes = await fetch(
          `https://www.googleapis.com/drive/v3/files?q=mimeType%3D'application%2Fvnd.google-apps.spreadsheet'%20and%20trashed%3Dfalse&orderBy=modifiedTime%20desc&pageSize=10&supportsAllDrives=true&includeItemsFromAllDrives=true&fields=files(id,name)`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (recentRes.ok) {
          const recentData = await recentRes.json();
          for (const file of (recentData.files || [])) {
            try {
              const metaRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${file.id}?fields=sheets.properties.title`, {
                headers: { Authorization: `Bearer ${token}` }
              });
              if (metaRes.ok) {
                const metaData = await metaRes.json();
                const titles = (metaData.sheets || []).map(s => s.properties?.title);
                if (titles.includes('1HRGT') || titles.includes('RVA')) {
                  spreadsheetId = file.id;
                  break;
                }
              }
            } catch (e) {
              // ignore
            }
          }
        }
      }

      if (!spreadsheetId) {
        throw new Error(`No se encontró el archivo de Sheets en Drive.`);
      }

      localStorage.setItem('lastSpreadsheetId', spreadsheetId);

      const tabsToCheck = ['1HRGT', 'RVA'];
      const updateRanges = [];
      const updatedInfo = [];

      for (const tab of tabsToCheck) {
        try {
          const sheetRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${tab}!A1:Z1000`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          if (!sheetRes.ok) continue;
          
          const sheetData = await sheetRes.json();
          const rows = sheetData.values || [];
          if (rows.length === 0) continue;

          // Search for "Status" or "Estado" and "DL" column in the first 3 rows
          let statusColIdx = -1;
          let dlColIdx = -1;
          for (let r = 0; r < Math.min(3, rows.length); r++) {
            const headerRow = rows[r] || [];
            for (let c = 0; c < headerRow.length; c++) {
              const val = String(headerRow[c] || '').trim().toLowerCase();
              if (val === 'status' || val === 'estado') {
                statusColIdx = c;
              }
              if (['dl', 'dl #', 'dl#', 'consecutivo', 'ref', 'dl number'].includes(val)) {
                dlColIdx = c;
              }
            }
          }

          if (dlColIdx === -1) {
            dlColIdx = 4; // Column E (index 4) by default
          }

          // Fallback: Columna T (index 19) or Columna L (index 11) for 1HRGT or Columna K (index 10) for RVA
          if (statusColIdx === -1) {
            statusColIdx = 19;
          }

          const statusColLetter = getColumnLetter(statusColIdx);

          // Find rows matching target DLs
          for (let r = 0; r < rows.length; r++) {
            const row = rows[r] || [];
            const dlVal = String(row[dlColIdx] || '').trim().toUpperCase();
            const cleanDlVal = dlVal.replace(/[^A-Z0-9]/g, '');
            const dlDigits = dlVal.replace(/\D/g, '');

            const dlMatch = targetDLs.some(tdl => {
              if (!tdl) return false;
              const cleanTdl = tdl.toUpperCase().replace(/[^A-Z0-9]/g, '');
              const tdlDigits = tdl.replace(/\D/g, '');
              return (cleanDlVal && cleanDlVal === cleanTdl) ||
                     (dlDigits && tdlDigits && dlDigits === tdlDigits && dlDigits.length >= 3) ||
                     (cleanDlVal && cleanTdl && cleanDlVal.includes(cleanTdl));
            });

              if (dlMatch) {
                const rowNum = r + 1; // 1-indexed for Google Sheets
                updateRanges.push({
                  range: `'${tab}'!${statusColLetter}${rowNum}`,
                  values: [["Completed"]] // Exact match for Google Sheet green dropdown option "Completed"
                });
                updatedInfo.push(`${tab} (fila ${rowNum}, ${dlVal || targetDLs.join(', ')})`);
              }
          }
        } catch (tabErr) {
          console.warn(`Error al revisar pestaña ${tab}:`, tabErr);
        }
      }

      if (updateRanges.length > 0) {
        console.log("Enviando actualización de Status a Completed:", updateRanges);
        const updateRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchUpdate`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            valueInputOption: 'USER_ENTERED',
            data: updateRanges
          })
        });
        
        if (!updateRes.ok) {
          const errDetail = await updateRes.text();
          throw new Error(`Error Sheets API (${updateRes.status}): ${errDetail}`);
        }
        return { success: true, details: updatedInfo.join(', ') };
      } else {
        console.warn("No se encontraron filas coincidentes en Sheets para DLs:", targetDLs);
        return { success: false, reason: `No se encontró fila para DL (${targetDLs.join(', ') || folderName}) en el Sheet.` };
      }
    } catch (err) {
      console.error("Error al actualizar Status en Sheet:", err);
      return { success: false, reason: err.message };
    }
  };

  const handleSendEmailFinal = async (pdfBlobsArray, finalEmailTo) => {
    setProcessing(true);
    try {
      if (!finalEmailTo) {
        alert("Falta el correo del cliente.");
        return;
      }
      const subject = "Your Translation is ready!";
      const htmlBody = `
        <div style="text-align: center; margin-bottom: 20px;">
          Hello, your translation is ready 💫<br /><br />
          <strong style="color: #ef4444;">⚠️ IMPORTANT ⚠️</strong><br /><br />
          <strong style="color: #ef4444;">As part of our quality management process, please check all names, dates, and numbers, and let us know if any corrections are required.</strong>
        </div>
        <div style="text-align: center; margin-bottom: 40px;">
          If everything is correct, the translation is ready to use.<br /><br />
          We provide fast and reliable certified translation and interpreting services in all major world languages. We wish you all the best and would be happy to assist you with any future projects.
        </div>
        <div style="text-align: center; font-size: 13px; line-height: 1.6;">
          Kind Regards,<br />
          Juan Carlos Flores<br />
          W: <a href="http://www.globaltranslations.co.nz">www.globaltranslations.co.nz</a><br />
          E: <a href="mailto:info@globaltranslations.co.nz">info@globaltranslations.co.nz</a><br />
          P: +64 6 560 2232 M: +64 22 096 2125<br />
          <a href="https://wa.me/64220962125">WhatsApp Chat</a>
        </div>
        <div style="text-align: center; margin-top: 20px; font-size: 11px; color: #64748b; font-style: italic;">
          Ngā Mihi. शुक्रिया. Thank you. 谢谢. Gracias. ありがとう. Danke. شكra. Obrigado.<br />
          “The World is but one country, and mankind its citizens.” Bahá’u’lláh
        </div>
      `;
      
      await sendEmailWithPdf(token, finalEmailTo, subject, htmlBody, pdfBlobsArray);
      
      const sheetResult = await updateSheetStatusCompleted(token, editorFolder, processedDocs, sheetName);
      
      if (sheetResult && sheetResult.success) {
        alert(`✅ Correo enviado exitosamente a ${finalEmailTo}\n📊 Estado actualizado a 'Completed' en Google Sheets: ${sheetResult.details}`);
      } else {
        alert(`✅ Correo enviado exitosamente a ${finalEmailTo}\n⚠️ Nota: No se pudo actualizar el Status en el Sheet (${sheetResult?.reason || 'Revisar configuración de hoja'}).`);
      }

      
      if (activeEmailItem) {
        try {
          const monthFolder = await getMonthFolderLabel(token);
          if (monthFolder && monthFolder.name) {
            const cleanChildName = getCleanClientLabelName(activeEmailItem.displayName || activeEmailItem.name);
            const newName = `${monthFolder.name}/${cleanChildName}`;
            console.log(`Moviendo etiqueta finalizada a: ${newName}`);
            const patchRes = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/labels/${activeEmailItem.id}`, {
              method: 'PATCH',
              headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
              body: JSON.stringify({ name: newName })
            });
            if (patchRes.ok) {
              console.log("Etiqueta movida con éxito a carpeta del mes:", newName);
              setActiveLabels(prev => prev.filter(l => l.id !== activeEmailItem.id));
            } else {
              setActiveLabels(prev => prev.map(l => l.id === activeEmailItem.id ? { ...l, sent: true, completed: true } : l));
            }
          }
        } catch (labelErr) {
          console.warn("No se pudo mover la etiqueta automáticamente:", labelErr);
          setActiveLabels(prev => prev.map(l => l.id === activeEmailItem.id ? { ...l, sent: true, completed: true } : l));
        }
      }
      setIsEmailPreviewOpen(false);
      setIsTranslationModalOpen(false);
    } catch (err) {
      console.error(err);
      if (err.message && (err.message.includes('expirado') || err.message.includes('authentication credentials') || err.message.includes('401') || err.message.includes('Unauthorized') || err.message.includes('invalid_token'))) {
        handleAuthError(401);
      } else {
        alert("Error enviando correo: " + err.message);
      }
      throw err;
    } finally {
      setProcessing(false);
    }
  };

  const toggleSelection = (id) => {
    const newSelection = new Set(selectedIds);
    if (newSelection.has(id)) {
      newSelection.delete(id);
    } else {
      newSelection.add(id);
    }
    setSelectedIds(newSelection);
  };

  const handleTabSwitch = (tab) => {
    if (processing) return;
    setActiveTab(tab);
    refreshData(token, tab);
  };

  if (!user) {
    return (
      <div className="login-screen">
        <Mail size={64} className="login-icon" />
        <h1 className="login-title">Global Automatization</h1>
        <p className="login-subtitle">Organiza tus ventas de forma automatizada.</p>
        <button className="btn-primary" onClick={() => login()} style={{ padding: '14px 28px', fontSize: '1.1rem' }}>
          Sign in with Google
        </button>
      </div>
    );
  }

  return (
    <div>
      <header className="app-header">
        <div className="app-title">Global Automatization</div>
        <div style={{display: 'flex', gap: '10px'}}>
          <button className={`btn-icon ${loading ? 'spinning' : ''}`} onClick={() => refreshData()} title="Refresh">
            <RefreshCw size={20} />
          </button>
          <button className="btn-icon" onClick={() => setIsSettingsModalOpen(true)} title="Settings">
            <Settings size={20} />
          </button>
          <button className="btn-icon" onClick={logOut} title="Log Out">
            <LogOut size={20} />
          </button>
        </div>
      </header>

      {/* Tabs */}
      <div className="tabs">
        <button 
          className={`tab ${activeTab === 'inbox' ? 'active' : ''}`}
          onClick={() => handleTabSwitch('inbox')}
        >
          Inbox
        </button>
        <button 
          className={`tab ${activeTab === 'progress' ? 'active' : ''}`}
          onClick={() => handleTabSwitch('progress')}
        >
          En Progreso
        </button>
        <button 
          className={`tab ${activeTab === 'autoOrganize' ? 'active' : ''}`}
          onClick={() => handleTabSwitch('autoOrganize')}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
        >
          <Zap size={16} color={activeTab === 'autoOrganize' ? 'var(--accent-color)' : '#f59e0b'} />
          Organizar Inbox
        </button>
      </div>

      {activeTab === 'autoOrganize' && (
        <AutoOrganizeTab 
          token={token}
          sheetName={sheetName}
          handleAuthError={handleAuthError}
          onRefreshTrigger={() => {
            fetchProgressLabels(token);
            fetchInbox(token);
          }}
          onNavigateTab={(t) => handleTabSwitch(t)}
        />
      )}
      
      {/* Target Folder Selector */}
      {activeTab === 'progress' && (
        <div style={{ padding: '12px 16px', backgroundColor: 'var(--surface-color)', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            Carpeta actual: <br/>
            <strong style={{ color: 'var(--text-primary)', fontSize: '0.95rem' }}>
              {targetMonthFolder ? targetMonthFolder.displayName : 'Ninguna seleccionada'}
            </strong>
          </div>
          <button onClick={openFolderPicker} className="btn-primary" style={{ backgroundColor: 'var(--surface-hover)', padding: '6px 12px' }}>
            <FolderOpen size={16} /> Cambiar
          </button>
        </div>
      )}

      {loading && !isSettingsModalOpen && !isPreviewModalOpen && activeTab !== 'autoOrganize' ? (
        <div className="loader-container">
          <svg className="spinner" width="40" height="40" viewBox="0 0 50 50">
            <circle cx="25" cy="25" r="20" fill="none" />
          </svg>
          <p>Cargando datos...</p>
        </div>
      ) : activeTab !== 'autoOrganize' ? (
        <div className="email-list">
          {activeTab === 'inbox' && (
            emails.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>
                <Inbox size={48} style={{ margin: '0 auto 16px', opacity: 0.5 }} />
                <p>No hay correos nuevos.</p>
              </div>
            ) : (
              emails.map(email => {
                const isSelected = selectedIds.has(email.id);
                return (
                  <div 
                    key={email.id} 
                    className={`email-item ${isSelected ? 'selected' : ''}`}
                    onClick={() => setViewingEmail(email)}
                  >
                    <div 
                      className="checkbox-container"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleSelection(email.id);
                      }}
                      title="Seleccionar correo"
                    >
                      {isSelected && <Check size={16} color="white" />}
                    </div>
                    <div className="email-content">
                      <div className="email-header-row">
                        <div className="email-sender">{email.sender}</div>
                        <div className="email-date">{email.date}</div>
                      </div>
                      <div className="email-subject">{email.subject}</div>
                      <div className="email-snippet">{email.snippet}</div>
                    </div>
                  </div>
                );
              })
            )
          )}

          {activeTab === 'progress' && (
            activeLabels.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>
                <FolderKanban size={48} style={{ margin: '0 auto 16px', opacity: 0.5 }} />
                <p>No hay etiquetas en progreso.</p>
              </div>
            ) : (
              activeLabels.map(label => {
                const isSelected = selectedIds.has(label.id);
                return (
                  <div 
                    key={label.id} 
                    className={`email-item ${isSelected ? 'selected' : ''}`}
                    onClick={() => toggleSelection(label.id)}
                  >
                    <div className="checkbox-container">
                      {isSelected && <Check size={16} color="white" />}
                    </div>
                    <div className="email-content" style={{ display: 'flex', alignItems: 'center', minHeight: '32px', justifyContent: 'space-between', width: '100%' }}>
                      <div style={{ display: 'flex', alignItems: 'center' }}>
                        <FolderKanban size={18} style={{ marginRight: '12px', color: 'var(--accent-color)' }} />
                        <div className="email-subject" style={{ margin: 0, fontSize: '1rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                          {label.displayName}
                          {label.displayName.match(/\[(.*?)\]/) && (
                            <span style={{ fontSize: '0.8rem', backgroundColor: '#e2e8f0', color: '#475569', padding: '2px 6px', borderRadius: '4px', fontWeight: '500' }}>
                              {label.displayName.match(/\[(.*?)\]/)[1]}
                            </span>
                          )}
                          {label.sent && <span style={{ fontSize: '0.75rem', backgroundColor: '#10b981', color: 'white', padding: '2px 6px', borderRadius: '4px' }}>Enviado</span>}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <button  
                          className="btn-secondary" 
                          style={{ padding: '6px 10px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '4px' }}
                          onClick={(e) => { 
                            e.stopPropagation(); 
                            setManualUploadLabel(label);
                            setEditorFolder(label.displayName);
                            setIsManualUploadOpen(true);
                          }}
                          disabled={processing}
                          title="Subir fotos manualmente desde tu computadora"
                        >
                          <UploadCloud size={14} /> Fotos
                        </button>
                        <button  
                          className="btn-primary" 
                          style={{ padding: '6px 12px', fontSize: '0.85rem' }}
                          onClick={(e) => { e.stopPropagation(); handleProcessFolder(label); }}
                          disabled={processing}
                        >
                          {processing ? '...' : 'Procesar'}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )
          )}
        </div>
      ) : null}

      {/* Action Bar */}
      <div className={`action-bar ${selectedIds.size > 0 && activeTab !== 'autoOrganize' ? 'visible' : ''}`}>
        <div className="selection-count">
          {selectedIds.size} {selectedIds.size === 1 ? 'sel.' : 'sel.'}
        </div>
        
        {activeTab === 'inbox' ? (
          <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', flexWrap: 'nowrap' }}>
            {/* Trash Action */}
            <button 
              className="btn-primary" 
              style={{ backgroundColor: 'var(--danger-color)', padding: '10px', flexShrink: 0 }}
              onClick={handleTrashEmails}
              disabled={processing}
            >
              <Trash2 size={18} />
            </button>

            {/* 0. Work Action */}
            <button 
              className="btn-primary" 
              style={{ backgroundColor: 'var(--surface-hover)', padding: '10px', flexShrink: 0 }}
              onClick={handleWorkLabel}
              disabled={processing}
            >
              <Briefcase size={18} />
              0. Work
            </button>

            {/* Registrar (Sheets) Action */}
            <button 
              className="btn-primary"
              style={{ backgroundColor: '#10b981', padding: '10px 12px', flexShrink: 0 }}
              onClick={handleRegisterClick}
              disabled={processing}
            >
              <ClipboardList size={18} />
              {processing ? '...' : 'Registrar'}
            </button>

            {/* DL IN PROGRESS Action */}
            <button 
              className="btn-primary" 
              onClick={() => setIsTrackingModalOpen(true)}
              disabled={processing}
              style={{ flexShrink: 0 }}
            >
              <FolderPlus size={18} />
              Tracking
            </button>

            {/* Mover a Etiqueta (0. Dx September) Action */}
            <button 
              className="btn-primary" 
              style={{ backgroundColor: '#6366f1', padding: '10px 12px', flexShrink: 0 }}
              onClick={openMoveToLabelModal}
              disabled={processing}
              title="Mover a una sub-etiqueta mensual"
            >
              <Tag size={18} />
              Label
            </button>
          </div>
        ) : (
          <button 
            className="btn-primary" 
            style={{ backgroundColor: 'var(--success-color)' }}
            onClick={handleFinalizeLabels}
            disabled={processing}
          >
            <CheckCircle2 size={18} />
            {processing ? 'Moviendo...' : 'Mover a Carpeta'}
          </button>
        )}
      </div>

      {/* Settings Modal */}
      <div className={`modal-overlay ${isSettingsModalOpen ? 'open' : ''}`} onClick={() => setIsSettingsModalOpen(false)}>
        <div className="modal-content" onClick={e => e.stopPropagation()}>
          <div className="modal-header">
            <h2 className="modal-title">Configuración</h2>
            <button className="btn-icon" onClick={() => setIsSettingsModalOpen(false)}>
              <X size={24} />
            </button>
          </div>
          <div className="input-group">
            <label className="input-label">Nombre del Archivo Google Sheets (Mes)</label>
            <input 
              type="text" 
              className="text-input" 
              value={sheetName}
              onChange={(e) => setSheetName(e.target.value)}
            />
            <p style={{fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: 8}}>
              Ejemplo: "July 2026". La app buscará este archivo para registrar los pedidos.
            </p>
          </div>
          <div className="input-group" style={{marginTop: '16px'}}>
            <label className="input-label">Gemini API Key</label>
            <input 
              type="password" 
              className="text-input" 
              value={geminiApiKey}
              onChange={(e) => setGeminiApiKey(e.target.value)}
              placeholder="AIzaSy..."
            />
            <p style={{fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: 8}}>
              Esta clave es necesaria para traducir y extraer datos de las fotos.
            </p>
          </div>
          <button className="btn-primary btn-block" onClick={saveSettings}>
            Guardar
          </button>
        </div>
      </div>

      {/* Preview Modal for Sheets Registration */}
      <div className={`modal-overlay ${isPreviewModalOpen ? 'open' : ''}`} onClick={() => !processing && setIsPreviewModalOpen(false)}>
        <div className="modal-content" onClick={e => e.stopPropagation()} style={{ height: '80vh', display: 'flex', flexDirection: 'column' }}>
          <div className="modal-header">
            <h2 className="modal-title">Pre-visualización</h2>
            <button className="btn-icon" onClick={() => !processing && setIsPreviewModalOpen(false)}>
              <X size={24} />
            </button>
          </div>
          
          <div style={{ flex: 1, overflowY: 'auto' }}>
             <div className="input-group" style={{ marginBottom: '14px' }}>
                <label className="input-label">Archivo de Google Sheets</label>
                <div style={{ padding: '8px 12px', background: 'var(--surface-color)', border: '1px solid var(--border-color)', borderRadius: '6px', fontSize: '0.88rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontWeight: '600', color: 'var(--text-primary)' }}>📊 {previewData.spreadsheetTitle || sheetName}</span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Fila: {previewData.rowIdx}</span>
                </div>
             </div>

             <div className="input-group">
                <label className="input-label">Pestaña Detectada</label>
                <select 
                  className="text-input" 
                  value={previewData.tab} 
                  onChange={(e) => setPreviewData({...previewData, tab: e.target.value})}
                >
                  <option value="1HRGT">1HRGT</option>
                  <option value="RVA">RVA</option>
                </select>
             </div>

             <div className="input-group">
                <label className="input-label">Número de Licencias</label>
                <select 
                  className="text-input" 
                  value={previewData.licenses} 
                  onChange={(e) => {
                    const lics = parseInt(e.target.value, 10);
                    let newLabel = previewData.availableTrackings[0] || previewData.trackingId;
                    if (lics > 1 && previewData.availableTrackings.length >= lics) {
                      newLabel = `${previewData.availableTrackings[0]}, ${previewData.availableTrackings[lics - 1]}`;
                    }
                    newLabel = `${newLabel} ${previewData.nombre || ''}`.trim();
                    setPreviewData({...previewData, licenses: lics, trackingLabel: newLabel});
                  }}
                >
                  <option value={1}>1 Licencia</option>
                  <option value={2}>2 Licencias</option>
                  <option value={3}>3 Licencias</option>
                  <option value={4}>4 Licencias</option>
                </select>
             </div>

             <div className="input-group">
                <label className="input-label">Pedido</label>
                <input 
                  type="text" className="text-input" 
                  value={previewData.trackingLabel} 
                  onChange={(e) => setPreviewData({...previewData, trackingLabel: e.target.value})}
                />
                <p style={{fontSize: '0.75rem', color: 'var(--text-secondary)'}}>Fila inicial en Sheets: {previewData.rowIdx}</p>
             </div>

             <div className="input-group">
                <label className="input-label">Nombre</label>
                <input 
                  type="text" className="text-input" 
                  value={previewData.nombre || ''} 
                  onChange={(e) => setPreviewData({...previewData, nombre: e.target.value})}
                />
             </div>

             <div className="input-group">
                <label className="input-label">Apellido</label>
                <input 
                  type="text" className="text-input" 
                  value={previewData.apellido || ''} 
                  onChange={(e) => setPreviewData({...previewData, apellido: e.target.value})}
                />
             </div>

             <div className="input-group">
                <label className="input-label">País (Country)</label>
                <input 
                  type="text" className="text-input" 
                  value={previewData.country} 
                  onChange={(e) => setPreviewData({...previewData, country: e.target.value})}
                />
             </div>

             <div className="input-group">
                <label className="input-label">Idioma (Language)</label>
                <input 
                  type="text" className="text-input" 
                  value={previewData.language} 
                  onChange={(e) => setPreviewData({...previewData, language: e.target.value})}
                />
             </div>

             <div className="input-group">
                <label className="input-label">Precio (Price)</label>
                <input 
                  type="text" className="text-input" 
                  value={previewData.price} 
                  onChange={(e) => setPreviewData({...previewData, price: e.target.value})}
                />
             </div>
          </div>
          
          <button 
            className="btn-primary btn-block" 
            onClick={confirmRegistration}
            disabled={processing}
            style={{marginTop: 15, backgroundColor: '#10b981'}}
          >
            {processing ? 'Guardando en Sheets...' : 'Aceptar y Mover a Progreso'}
          </button>
        </div>
      </div>

      {/* Modal for Tracking Number (Inbox) */}
      <div className={`modal-overlay ${isTrackingModalOpen ? 'open' : ''}`} onClick={() => !processing && setIsTrackingModalOpen(false)}>
        <div className="modal-content" onClick={e => e.stopPropagation()}>
          <div className="modal-header">
            <h2 className="modal-title">Asignar Número de Rastreo</h2>
            <button className="btn-icon" onClick={() => !processing && setIsTrackingModalOpen(false)}>
              <X size={24} />
            </button>
          </div>
          
          <div className="input-group">
            <label className="input-label">Tracking / Order Number</label>
            <input 
              type="text" 
              className="text-input" 
              placeholder="e.g. B3812 or RVA3473" 
              value={trackingNumber}
              onChange={(e) => setTrackingNumber(e.target.value)}
              disabled={processing}
            />
          </div>
          
          <button 
            className="btn-primary btn-block" 
            onClick={() => handleAssignTracking(trackingNumber, true)}
            disabled={!trackingNumber.trim() || processing}
          >
            {processing ? 'Procesando...' : 'Mover a DL IN PROGRESS'}
          </button>
        </div>
      </div>
      
      {/* Modal for Folder Picker */}
      <div className={`modal-overlay ${isFolderModalOpen ? 'open' : ''}`} onClick={() => !loading && setIsFolderModalOpen(false)}>
        <div className="modal-content" onClick={e => e.stopPropagation()} style={{ height: '70vh', display: 'flex', flexDirection: 'column' }}>
          <div className="modal-header" style={{ marginBottom: 10 }}>
            <h2 className="modal-title">Selecciona la Carpeta Destino</h2>
            <button className="btn-icon" onClick={() => setIsFolderModalOpen(false)}>
              <X size={24} />
            </button>
          </div>
          
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {monthLabels.length === 0 && !loading && (
              <p style={{color: 'var(--text-secondary)'}}>No se encontraron carpetas mensuales de finalizadas.</p>
            )}
            
            {monthLabels.map(folder => (
              <div 
                key={folder.id} 
                className="email-item" 
                style={{ marginBottom: 8, padding: '12px' }}
                onClick={() => selectTargetFolder(folder)}
              >
                <FolderOpen size={18} style={{ marginRight: 12, color: 'var(--accent-color)' }}/>
                {folder.displayName}
              </div>
            ))}
          </div>
        </div>
      </div>

        <ImageEditorModal
          isOpen={isImageEditorOpen}
          onClose={() => setIsImageEditorOpen(false)}
          imageUrls={editorUrls}
          folderName={editorFolder}
          onComplete={handleEditorComplete}
          isProcessing={processing}
        />

      <ErrorBoundary>
        <TranslationPreviewModal
          isOpen={isTranslationModalOpen}
          onClose={() => setIsTranslationModalOpen(false)}
          initialData={extractedData}
          folderName={editorFolder}
          onSave={handleTranslationSave}
          onDownloadWord={handleTranslationDownload}
        />
      </ErrorBoundary>

      <EmailPreviewModal
        isOpen={isEmailPreviewOpen}
        onClose={() => setIsEmailPreviewOpen(false)}
        processedDocs={processedDocs}
        folderName={editorFolder}
        customerEmail={activeCustomerEmail}
        token={token}
        onSendEmail={handleSendEmailFinal}
        onBack={() => {
          setIsEmailPreviewOpen(false);
          setIsTranslationModalOpen(true);
        }}
      />

      <EmailDetailModal
        email={viewingEmail}
        isOpen={!!viewingEmail}
        onClose={() => setViewingEmail(null)}
        isSelected={viewingEmail ? selectedIds.has(viewingEmail.id) : false}
        onToggleSelect={toggleSelection}
        token={token}
        onProcessAttachments={(urls, folderName) => {
          setEditorUrls(urls);
          setEditorFolder(folderName);
          setIsImageEditorOpen(true);
        }}
      />

      <ManualUploadModal
        isOpen={isManualUploadOpen}
        onClose={() => setIsManualUploadOpen(false)}
        folderName={manualUploadLabel ? manualUploadLabel.displayName : editorFolder}
        label={manualUploadLabel}
        token={token}
        onImagesLoaded={handleManualUploadLoaded}
      />

      {/* Modal for Moving Inbox Emails to 0. Dx Sub-Labels */}
      <div className={`modal-overlay ${isMoveToLabelModalOpen ? 'open' : ''}`} onClick={() => !loadingLabels && !processing && setIsMoveToLabelModalOpen(false)}>
        <div className="modal-content" onClick={e => e.stopPropagation()} style={{ height: '75vh', maxWidth: '600px', display: 'flex', flexDirection: 'column' }}>
          <div className="modal-header" style={{ marginBottom: 12 }}>
            <div>
              <h2 className="modal-title" style={{ margin: 0 }}>Mover a Etiqueta (0. Dx)</h2>
              <p style={{ margin: '4px 0 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                Selecciona la etiqueta del cliente para mover los correos seleccionados y archivarlos del Inbox.
              </p>
            </div>
            <button className="btn-icon" onClick={() => setIsMoveToLabelModalOpen(false)}>
              <X size={24} />
            </button>
          </div>

          {/* Search input */}
          <div style={{ position: 'relative', marginBottom: '12px' }}>
            <input 
              type="text" 
              className="text-input" 
              placeholder="Buscar por DL (ej. B5267), nombre o país..." 
              value={labelSearchQuery}
              onChange={(e) => setLabelSearchQuery(e.target.value)}
              style={{ paddingLeft: '36px' }}
            />
            <Search size={18} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
          </div>
          
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {loadingLabels ? (
              <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-secondary)' }}>
                <RefreshCw size={24} className="spinning" style={{ margin: '0 auto 8px' }} />
                <p>Cargando etiquetas...</p>
              </div>
            ) : dxSubLabels.length === 0 ? (
              <p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '30px' }}>
                No se encontraron etiquetas secundarias bajo 0. Dx.
              </p>
            ) : (
              dxSubLabels
                .filter(l => !labelSearchQuery.trim() || l.displayName.toLowerCase().includes(labelSearchQuery.toLowerCase()) || l.parentName.toLowerCase().includes(labelSearchQuery.toLowerCase()))
                .map(labelItem => (
                  <div 
                    key={labelItem.id} 
                    className="email-item" 
                    style={{ marginBottom: 6, padding: '10px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', borderRadius: '8px' }}
                    onClick={() => handleMoveEmailsToSelectedLabel(labelItem)}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <Tag size={18} style={{ color: '#6366f1', flexShrink: 0 }} />
                      <div>
                        <div style={{ fontWeight: '600', color: 'var(--text-primary)', fontSize: '0.95rem' }}>
                          {labelItem.displayName}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                          {labelItem.parentName}
                        </div>
                      </div>
                    </div>
                    <button 
                      className="btn-primary" 
                      style={{ backgroundColor: '#6366f1', padding: '4px 10px', fontSize: '0.8rem', borderRadius: '4px' }}
                      onClick={(e) => { e.stopPropagation(); handleMoveEmailsToSelectedLabel(labelItem); }}
                      disabled={processing}
                    >
                      Mover aquí
                    </button>
                  </div>
                ))
            )}
          </div>
        </div>
      </div>

      {processing && (
        <div className="processing-overlay">
          <div className="spinner">
            <svg viewBox="0 0 50 50">
              <circle cx="25" cy="25" r="20" fill="none" strokeWidth="5"></circle>
            </svg>
          </div>
          <div className="processing-text" style={{marginTop: '15px', color: 'white', fontWeight: 'bold', fontSize: '18px'}}>Procesando...</div>
        </div>
      )}
    </div>
  );
}

export default App;
