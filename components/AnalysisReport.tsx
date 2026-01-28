
import React from 'react';
import ReactMarkdown from 'react-markdown';

/**
 * @fileoverview Reasoning Trace Visualization.
 * 
 * UX PURPOSE:
 * Explains the AI's "Chain of Thought" to the user.
 * Instead of a black box, this component renders the intermediate reasoning steps
 * (analysis) that the model performed before arriving at the final output.
 * 
 * This builds trust and allows the user to verify if the model understood 
 * the constraints correctly.
 */

interface AnalysisReportProps {
  content: string;
  references?: string[];
}

export const AnalysisReport: React.FC<AnalysisReportProps> = ({ content, references }) => {
  return (
    <div className="animate-fadeIn w-full bg-white border border-violet-100 ring-[10px] ring-violet-400/5 rounded-3xl overflow-hidden flex flex-col shadow-sm">
      <div className="bg-slate-50/50 px-6 py-5 sm:px-10 sm:py-6 border-b border-slate-100 flex items-center gap-4">
        <div className="w-12 h-12 bg-violet-500 rounded-2xl text-white flex items-center justify-center shadow-lg shrink-0 transform -rotate-2">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-6 h-6">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 18v-5.25m0 0a6.01 6.01 0 0 0 1.5-.189m-1.5.189a6.01 6.01 0 0 1-1.5-.189m3.75 7.478a12.06 12.06 0 0 1-4.5 0m3.75 2.383a14.406 14.406 0 0 1-3 0M14.25 18v-.192c0-.983.658-1.823 1.508-2.316a7.5 7.5 0 1 0-7.517 0c.85.493 1.509 1.333 1.509 2.316V18" />
          </svg>
        </div>
        <div>
          <h2 className="text-xl font-black text-slate-900 tracking-tight leading-none">Analysis</h2>
          <p className="text-[10px] text-slate-400 mt-1.5 font-bold tracking-widest uppercase">Based on your context</p>
        </div>
      </div>

      <div className="p-6 sm:p-10">
        <div className="prose prose-slate prose-violet max-w-none text-slate-800 leading-relaxed font-medium tracking-tight text-lg selection:bg-violet-200">
          <ReactMarkdown>{content}</ReactMarkdown>
        </div>

        {/* 
           Entity Extraction Display:
           Shows key entities (Concepts, Files, Dates) identified during the reasoning phase.
        */}
        {references && references.length > 0 && (
          <div className="mt-8 pt-6 border-t border-slate-100">
            <div className="flex flex-wrap gap-2">
              {references.map(ref => (
                <span key={ref} className="px-3 py-1.5 bg-violet-900 rounded-xl text-[10px] font-black text-violet-100 shadow-sm border border-violet-800 uppercase tracking-wider">
                  {ref}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
