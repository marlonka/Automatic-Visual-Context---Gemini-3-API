
import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';

/**
 * @fileoverview Final Deliverable Artifact.
 * 
 * UX PATTERN:
 * Distinct from the conversational stream, this component represents the 
 * "Product" or "Artifact" created by the AI (e.g., Code, Document, Strategy).
 * 
 * It is visually distinct (Green/Lime branding) to signal "Success/Completion" 
 * versus the Violet branding used for "Thinking/Analysis".
 */

interface FinalOutputProps {
  content: string;
}

export const FinalOutput: React.FC<FinalOutputProps> = ({ content }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy: ', err);
    }
  };

  return (
    <div className="bg-white border border-violet-100 rounded-3xl shadow-sm overflow-hidden flex flex-col ring-[10px] ring-violet-400/5 animate-slideUp">
      <div className="bg-lime-50/30 px-6 py-5 sm:px-10 sm:py-6 border-b border-violet-100 flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-lime-400 rounded-2xl text-slate-900 flex items-center justify-center shadow-lg transform rotate-2">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-6 h-6">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 9v.906a2.25 2.25 0 0 1-1.183 1.981l-6.478 3.488M2.25 9v.906a2.25 2.25 0 0 0 1.183 1.981l6.478 3.488m8.839 2.51-4.66-2.51m0 0-1.023-.55a2.25 2.25 0 0 0-2.134 0l-1.022.55m0 0-4.661 2.51m16.5 1.615a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V8.844a2.25 2.25 0 0 1 1.183-1.981l7.5-4.039a2.25 2.25 0 0 1 2.134 0l7.5 4.039a2.25 2.25 0 0 1 1.183 1.98V19.5Z" />
            </svg>
          </div>
          <div>
            <h2 className="text-xl font-black text-slate-900 tracking-tight leading-none">Answer</h2>
            <p className="text-[10px] text-slate-400 font-bold tracking-widest leading-none mt-1.5 uppercase">Prepared for you</p>
          </div>
        </div>
        <button 
          onClick={handleCopy}
          className={`text-xs font-black px-5 py-2.5 rounded-2xl transition-all flex items-center gap-2 shadow-md active:scale-95 uppercase tracking-wider ${
            copied 
              ? 'bg-lime-500 text-white' 
              : 'bg-violet-600 text-white hover:bg-violet-700'
          }`}
        >
          {copied ? (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
          ) : (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" /></svg>
          )}
          {copied ? 'Copied!' : 'Copy Text'}
        </button>
      </div>

      <div className="p-6 sm:p-10 bg-white">
        <div className="prose prose-slate prose-violet max-w-none text-slate-900 leading-relaxed selection:bg-violet-200 font-medium text-lg">
          <ReactMarkdown>{content}</ReactMarkdown>
        </div>
      </div>
    </div>
  );
};
