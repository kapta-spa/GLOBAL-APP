
import React from 'react';
import { ExtractedData } from '../types';
import { Info, Copy, Hash } from 'lucide-react';
import { generateClassDescriptions } from '../services/docService';

interface DataPreviewProps {
  data: ExtractedData;
  onChange: (newData: ExtractedData) => void;
}

const DataPreview: React.FC<DataPreviewProps> = ({ data, onChange }) => {
  const handleInputChange = (key: string, value: string) => {
    const updatedData = { ...data, [key]: value || "" };
    
    // If class changes, automatically update classDescriptions
    if (key === 'class') {
      updatedData.classDescriptions = generateClassDescriptions(value || "");
    }
    
    onChange(updatedData);
  };

  const copy = (txt: string) => navigator.clipboard.writeText(txt);

  const fieldLabels: Record<string, { label: string, tag: string }> = {
    assignedNumber: { label: "Assigned Number (File Name)", tag: "{{assignedNumber}}" },
    surname: { label: "1: Surname", tag: "{{surname}}" },
    firstName: { label: "2: First Name", tag: "{{firstName}}" },
    middleName: { label: "2: Middle Name", tag: "{{middleName}}" },
    licenseNumber: { label: "License Number", tag: "{{licenseNumber}}" },
    dateOfBirth: { label: "3: Date of Birth", tag: "{{dateOfBirth}}" },
    placeOfBirth: { label: "3: Place of Birth", tag: "{{placeOfBirth}}" },
    issueDate: { label: "4a: Issue Date", tag: "{{issueDate}}" },
    expiryDate: { label: "4b: Expiry Date", tag: "{{expiryDate}}" },
    authority: { label: "4c: Authority", tag: "{{authority}}" },
    class: { label: "9: Categories", tag: "{{class}}" },
    classDescriptions: { label: "Class Descriptions", tag: "{{classDescriptions}}" },
    categoriesDates: { label: "10: Categories Dates", tag: "{{categoriesDates}}" },
    codes: { label: "12: Restrictions & Explanations", tag: "{{codes}}" },
  };

  return (
    <div className="space-y-6">
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
        <div className="px-6 py-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-slate-800 text-sm">Review Extracted Data</h3>
            <p className="text-[11px] text-slate-500">Verify information and codes before generating the document.</p>
          </div>
          <div className="flex items-center gap-2 text-[10px] font-bold text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded-full border border-indigo-100">
            <Info size={12} /> VERIFICATION MODE
          </div>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-5">
            {Object.entries(fieldLabels).map(([key, item]) => {
              const isFullWidth = key === 'codes' || key === 'classDescriptions' || key === 'categoriesDates';
              const isAssignedNum = key === 'assignedNumber';
              const isFirstOrMiddle = key === 'firstName' || key === 'middleName';
              
              return (
                <div key={key} className={`group flex flex-col gap-1.5 ${isFullWidth ? 'md:col-span-2' : ''} ${isAssignedNum ? 'md:col-span-2 bg-red-50/30 p-4 rounded-2xl border border-red-100 mb-2' : ''} ${isFirstOrMiddle ? 'border-l-2 border-indigo-100 pl-4' : ''}`}>
                  <div className="flex items-center justify-between">
                    <label className={`text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 ${isAssignedNum ? 'text-red-600' : (isFirstOrMiddle ? 'text-indigo-600' : 'text-slate-400')}`}>
                      {isAssignedNum && <Hash size={12} />} {item.label}
                    </label>
                    <button 
                      onClick={() => copy(item.tag)}
                      className="opacity-0 group-hover:opacity-100 text-[9px] font-bold text-indigo-500 hover:text-indigo-700 transition-all flex items-center gap-1"
                    >
                      <Copy size={10} /> {item.tag}
                    </button>
                  </div>
                  {isFullWidth ? (
                    <textarea
                      value={data[key as keyof ExtractedData] || ''}
                      onChange={(e) => handleInputChange(key, e.target.value)}
                      rows={key === 'classDescriptions' ? 8 : 5}
                      className="w-full px-4 py-3 bg-indigo-50/30 border border-indigo-100 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-semibold text-slate-700 placeholder:text-slate-300 resize-none"
                      placeholder={key === 'classDescriptions' ? "No descriptions available for selected classes." : "No specific codes detected in Section 12."}
                    />
                  ) : (
                    <input
                      type="text"
                      value={data[key as keyof ExtractedData] || ''}
                      onChange={(e) => handleInputChange(key, e.target.value)}
                      className={`w-full px-4 py-3 border rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-semibold placeholder:text-slate-300 ${isAssignedNum ? 'bg-white border-red-300 text-red-700 text-lg shadow-sm' : 'bg-slate-50 border-slate-200 text-slate-700'}`}
                      placeholder={isAssignedNum ? "Type assigned number..." : "Not detected"}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DataPreview;
