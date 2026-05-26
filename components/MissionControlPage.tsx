import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, Download, Share, Lock, ExternalLink, Edit3, Cloud, FileText, 
  Calendar, Mail, Folder, Users, CheckSquare, Sparkles,
  Monitor, Terminal, Settings, Search, Image as ImageIcon,
  Play, Cpu, Activity
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { useUI, useLogStore } from '../lib/state';

// --- Helpers from ArtifactOverlay ---

const highlightJson = (jsonStr: string) => {
  const lines = jsonStr.split('\n');
  return (
    <div className="font-mono text-[10px] leading-relaxed w-full">
      {lines.map((line, idx) => {
        const regex = /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*")(\s*:)?|\b(true|false|null)\b|-?\b\d+(?:\.\d*)?(?:[eE][+-]?\d+)?\b/g;
        let lastIndex = 0;
        const result: React.ReactNode[] = [];
        let match;

        while ((match = regex.exec(line)) !== null) {
          const index = match.index;
          if (index > lastIndex) {
            result.push(line.substring(lastIndex, index));
          }

          const text = match[0];
          if (/^"/.test(text)) {
            if (/:$/.test(text)) {
              result.push(<span key={index} className="text-[#a855f7] font-bold">{text.replace(/:$/, '')}</span>);
              result.push(":");
            } else {
              result.push(<span key={index} className="text-[#059669]">{text}</span>);
            }
          } else if (/^(true|false|null)$/.test(text)) {
            result.push(<span key={index} className="text-[#ea580c] font-semibold">{text}</span>);
          } else {
            result.push(<span key={index} className="text-[#dc2626]">{text}</span>);
          }

          lastIndex = regex.lastIndex;
        }

        if (lastIndex < line.length) {
          result.push(line.substring(lastIndex));
        }

        return (
          <div key={idx} className="flex min-h-[16px] hover:bg-gray-50/50 px-1">
            <span className="w-6 text-gray-400 font-sans text-[8px] text-right pr-1.5 select-none border-r border-gray-100 mr-2 shrink-0">{idx + 1}</span>
            <span className="whitespace-pre overflow-x-auto text-gray-700 break-all font-mono">
              {result.length > 0 ? result : line}
            </span>
          </div>
        );
      })}
    </div>
  );
};

const highlightCode = (code: string) => {
  if (!code) return <span className="text-gray-400">No content</span>;
  const lines = code.split('\n');

  return (
    <div className="font-mono text-[10px] leading-relaxed w-full">
      {lines.map((line, idx) => {
        const regex = /(\/\/.*|#.*)|(["'`].*?["'`])|\b(const|let|var|function|return|import|from|export|if|else|for|while|do|class|interface|new|type|as|extends|implements|try|catch|finally|throw|async|await|null|undefined|true|false)\b|\b(def|elif|import|print|with|as|lambda|pass|in|is|not|and|or)\b|\b([a-zA-Z_]\w*)(?=\()|\b(\d+(?:\.\d+)?)\b/g;
        let lastIndex = 0;
        const result: React.ReactNode[] = [];
        let match;

        while ((match = regex.exec(line)) !== null) {
          const index = match.index;
          if (index > lastIndex) {
            result.push(line.substring(lastIndex, index));
          }

          const text = match[0];
          if (match[1]) {
            result.push(<span key={index} className="text-gray-400 italic">{text}</span>);
          } else if (match[2]) {
            result.push(<span key={index} className="text-[#059669]">{text}</span>);
          } else if (match[3]) {
            result.push(<span key={index} className="text-[#a855f7] font-bold">{text}</span>);
          } else if (match[4]) {
            result.push(<span key={index} className="text-[#2563eb] font-bold">{text}</span>);
          } else if (match[5]) {
            result.push(<span key={index} className="text-[#3b82f6] font-medium">{text}</span>);
          } else if (match[6]) {
            result.push(<span key={index} className="text-[#dc2626]">{text}</span>);
          }

          lastIndex = regex.lastIndex;
        }

        if (lastIndex < line.length) {
          result.push(line.substring(lastIndex));
        }

        return (
          <div key={idx} className="flex min-h-[16px] hover:bg-gray-50/50 px-1">
            <span className="w-6 text-gray-400 font-sans text-[8px] text-right pr-1.5 select-none border-r border-gray-100 mr-2 shrink-0">{idx + 1}</span>
            <span className="whitespace-pre overflow-x-auto text-gray-700 break-all font-mono">{result.length > 0 ? result : line}</span>
          </div>
        );
      })}
    </div>
  );
};

const ActionButton = ({ icon: Icon, label, onClick, isDocx }: { icon: any, label: string, onClick: () => void, isDocx?: boolean }) => (
  <button 
    onClick={onClick}
    className="flex items-center gap-2 bg-[#0d1014] border border-white/5 hover:bg-[#161a22] transition-colors text-white text-[11px] font-medium rounded-[10px] h-[38px] px-2.5 w-full cursor-pointer"
  >
    {isDocx ? (
      <div className="flex items-center justify-center bg-[#1a56db] text-white font-[800] text-[10px] w-[18px] h-[18px] rounded-[4px]">W</div>
    ) : (
      <Icon size={16} strokeWidth={2} />
    )}
    {label}
  </button>
);

const DownloadButton = ({ content, title, type, ext }: { content: string, title: string, type: string, ext: string }) => {
  const handleDownload = () => {
    let url;
    if (content.startsWith('data:')) {
      url = content;
    } else {
      const blob = new Blob([content], { type });
      url = URL.createObjectURL(blob);
    }
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title?.replace(/[^a-z0-9]/gi, '_') || 'document'}.${ext}`;
    a.click();
    if (!content.startsWith('data:')) {
      URL.revokeObjectURL(url);
    }
  };
  return <ActionButton icon={Download} label={`Download ${ext.toUpperCase()}`} onClick={handleDownload} />;
};

const DownloadDocButton = ({ content, title, type }: { content: string, title: string, type: string }) => {
  const handleDownload = () => {
    let htmlContent = content;
    if (type === 'markdown' || type === 'text' || type === 'code' || type === 'structured' || type === 'json') {
       let parsedContent = content;
       if (type === 'structured' || type === 'json') {
         try { parsedContent = JSON.stringify(JSON.parse(content), null, 2); } catch(e) {}
       }
       htmlContent = `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'><head><meta charset='utf-8'><title>${title}</title></head><body><pre style="white-space: pre-wrap; font-family: monospace;">${parsedContent}</pre></body></html>`;
    } else if (type === 'html') {
       htmlContent = `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'><head><meta charset='utf-8'><title>${title}</title></head><body>${content}</body></html>`;
    } else {
      return;
    }
    const blob = new Blob(['\\ufeff', htmlContent], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title?.replace(/[^a-z0-9]/gi, '_') || 'document'}.doc`;
    a.click();
    URL.revokeObjectURL(url);
  };
  
  if (['markdown', 'text', 'html', 'code', 'structured', 'json', 'pdf'].includes(type)) {
     return <ActionButton icon={FileText} label="Download DOCX" onClick={handleDownload} isDocx />;
  }
  return null;
};

const WorkspaceDataViewer: React.FC<{ data: any }> = ({ data }) => {
  if (!data) return null;

  const isCalendar = data.kind === "calendar#events" || (Array.isArray(data.items) && data.items.some((item: any) => item.start && item.end));
  const isDrive = data.kind === "drive#fileList" || Array.isArray(data.files);
  const isGmail = data.messages || data.threads || (data.id && (data.threadId || data.labelIds));
  const isContacts = Array.isArray(data.connections);
  const isTasks = data.kind === "tasks#tasks" || (Array.isArray(data.items) && data.items.some((item: any) => item.due !== undefined || (item.kind && item.kind.includes('task'))));

  if (isCalendar) {
    const events = data.items || [];
    return (
      <div className="w-full text-white bg-[#0e1117] rounded-2xl border border-white/10 p-4 shrink-0 flex flex-col gap-4 font-sans text-xs">
        <div className="flex items-center gap-2 border-b border-white/10 pb-3">
          <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center text-blue-400 shrink-0">
            <Calendar size={18} />
          </div>
          <div>
            <h4 className="font-bold text-[14px]">Google Calendar Events</h4>
            <p className="text-[10px] text-gray-400">Active reminders and meeting schedules</p>
          </div>
        </div>
        {events.length === 0 ? (
          <p className="text-gray-400 text-center py-4 font-mono">No upcoming events scheduled.</p>
        ) : (
          <div className="flex flex-col gap-2 max-h-[220px] overflow-y-auto pr-1">
            {events.map((evt: any, i: number) => {
              const start = evt.start?.dateTime || evt.start?.date || '';
              const end = evt.end?.dateTime || evt.end?.date || '';
              const formattedDate = start ? new Date(start).toLocaleDateString() : 'All day';
              const formattedTime = start && evt.start?.dateTime ? `${new Date(start).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} - ${new Date(end).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}` : 'All Day';
              return (
                <div key={evt.id || i} className="p-3 bg-white/5 rounded-xl border border-white/5 hover:border-white/15 transition-all flex flex-col gap-1.5">
                  <div className="flex justify-between items-start gap-2">
                    <span className="font-bold text-white text-[12px]">{evt.summary || 'Untitled Event'}</span>
                    <span className="text-[10px] font-semibold text-blue-400 shrink-0 bg-blue-500/10 px-2 py-0.5 rounded-full">{formattedDate}</span>
                  </div>
                  {evt.location && <div className="text-[11px] text-gray-300">📍 {evt.location}</div>}
                  <div className="text-[10px] text-gray-400 font-mono">⏰ {formattedTime}</div>
                  {evt.hangoutLink && (
                    <a href={evt.hangoutLink} target="_blank" rel="noopener noreferrer" className="mt-1 self-start flex items-center gap-1 px-2.5 py-1 bg-emerald-500/20 text-emerald-300 rounded-lg hover:bg-emerald-500/30 font-medium text-[10px] transition-all">
                      <Sparkles size={11} /> Join Google Meet
                    </a>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  if (isDrive) {
    const files = data.files || [];
    return (
      <div className="w-full text-white bg-[#0e1117] rounded-2xl border border-white/10 p-4 shrink-0 flex flex-col gap-4 font-sans text-xs">
        <div className="flex items-center gap-2 border-b border-white/10 pb-3">
          <div className="w-8 h-8 rounded-lg bg-yellow-500/20 flex items-center justify-center text-yellow-400 shrink-0">
            <Folder size={18} />
          </div>
          <div>
            <h4 className="font-bold text-[14px]">Google Drive Files</h4>
            <p className="text-[10px] text-gray-400">Stored documents, forms, slides, and files</p>
          </div>
        </div>
        {files.length === 0 ? (
          <p className="text-gray-400 text-center py-4 font-mono">No files found.</p>
        ) : (
          <div className="flex flex-col gap-2 max-h-[220px] overflow-y-auto pr-1">
            {files.map((file: any, i: number) => (
              <div key={file.id || i} className="p-3 bg-white/5 rounded-xl border border-white/5 hover:border-white/15 transition-all flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 overflow-hidden">
                  <div className="p-1.5 rounded bg-white/10 shrink-0 text-white">
                    <FileText size={16} />
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="font-bold text-white truncate text-[11px]">{file.name}</span>
                    <span className="text-[9px] text-[#888] font-mono truncate">{file.mimeType?.split('.').pop() || 'File'}</span>
                  </div>
                </div>
                {file.webViewLink && (
                  <a href={file.webViewLink} target="_blank" rel="noopener noreferrer" className="p-1.5 text-gray-400 hover:text-white hover:bg-white/10 rounded transition-all shrink-0">
                    <ExternalLink size={14} />
                  </a>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  if (isGmail) {
    const messages = data.messages || [];
    const isSingleMessage = data.id && (data.snippet || data.body);

    if (isSingleMessage) {
      const subject = data.payload?.headers?.find((h: any) => h.name === 'Subject')?.value || 'No Subject';
      const from = data.payload?.headers?.find((h: any) => h.name === 'From')?.value || 'Unknown Sender';
      const date = data.payload?.headers?.find((h: any) => h.name === 'Date')?.value || '';
      return (
        <div className="w-full text-white bg-[#0e1117] rounded-2xl border border-white/10 p-4 shrink-0 flex flex-col gap-4 font-sans text-xs">
          <div className="flex items-center gap-2 border-b border-white/10 pb-3">
            <div className="w-8 h-8 rounded-lg bg-red-500/20 flex items-center justify-center text-red-400 shrink-0">
              <Mail size={18} />
            </div>
            <div className="min-w-0 flex-1">
              <h4 className="font-bold text-[13px] truncate">{subject}</h4>
              <p className="text-[10px] text-gray-400 truncate">From: {from}</p>
            </div>
          </div>
          <div className="text-[11px] leading-relaxed text-gray-300 whitespace-pre-wrap max-h-[180px] overflow-y-auto pr-1">
            {data.snippet || data.body || 'No message content.'}
          </div>
          {date && <div className="text-[9px] text-gray-500 font-mono">Received: {date}</div>}
        </div>
      );
    }

    return (
      <div className="w-full text-white bg-[#0e1117] rounded-2xl border border-white/10 p-4 shrink-0 flex flex-col gap-4 font-sans text-xs">
        <div className="flex items-center gap-2 border-b border-white/10 pb-3">
          <div className="w-8 h-8 rounded-lg bg-red-500/20 flex items-center justify-center text-red-400 shrink-0">
            <Mail size={18} />
          </div>
          <div>
            <h4 className="font-bold text-[14px]">Gmail Messages</h4>
            <p className="text-[10px] text-gray-400">Conversations from your Inbox</p>
          </div>
        </div>
        {messages.length === 0 ? (
          <p className="text-gray-400 text-center py-4 font-mono">No recent emails found.</p>
        ) : (
          <div className="flex flex-col gap-2 max-h-[220px] overflow-y-auto pr-1">
            {messages.map((msg: any, i: number) => (
              <div key={msg.id || i} className="p-3 bg-white/5 rounded-xl border border-white/5 hover:border-white/15 transition-all flex flex-col gap-1">
                <span className="font-mono text-[9px] text-red-400 uppercase font-semibold">Message ID: {msg.id}</span>
                <p className="text-gray-300 text-[11px] line-clamp-2 leading-normal">{msg.snippet || 'Click email thread to open details.'}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  if (isContacts) {
    const connections = data.connections || [];
    return (
      <div className="w-full text-white bg-[#0e1117] rounded-2xl border border-white/10 p-4 shrink-0 flex flex-col gap-4 font-sans text-xs">
        <div className="flex items-center gap-2 border-b border-white/10 pb-3">
          <div className="w-8 h-8 rounded-lg bg-indigo-500/20 flex items-center justify-center text-indigo-400 shrink-0">
            <Users size={18} />
          </div>
          <div>
            <h4 className="font-bold text-[14px]">Google Contacts</h4>
            <p className="text-[10px] text-gray-400">People API Connections</p>
          </div>
        </div>
        {connections.length === 0 ? (
          <p className="text-gray-400 text-center py-4 font-mono">No contacts found.</p>
        ) : (
          <div className="flex flex-col gap-2 max-h-[220px] overflow-y-auto pr-1">
            {connections.map((conn: any, i: number) => {
              const name = conn.names?.[0]?.displayName || 'Unnamed Contact';
              const email = conn.emailAddresses?.[0]?.value || '';
              const phone = conn.phoneNumbers?.[0]?.value || '';
              return (
                <div key={conn.resourceName || i} className="p-3 bg-white/5 rounded-xl border border-white/5 hover:border-white/15 transition-all flex flex-col gap-1">
                  <span className="font-bold text-white text-[12px]">{name}</span>
                  {email && <span className="text-[10px] text-gray-300">✉️ {email}</span>}
                  {phone && <span className="text-[10px] text-gray-400">📞 {phone}</span>}
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  if (isTasks) {
    const tasks = data.items || [];
    return (
      <div className="w-full text-white bg-[#0e1117] rounded-2xl border border-white/10 p-4 shrink-0 flex flex-col gap-4 font-sans text-xs">
        <div className="flex items-center gap-2 border-b border-white/10 pb-3">
          <div className="w-8 h-8 rounded-lg bg-teal-500/20 flex items-center justify-center text-teal-400 shrink-0">
            <CheckSquare size={18} />
          </div>
          <div>
            <h4 className="font-bold text-[14px]">Google Tasks</h4>
            <p className="text-[10px] text-gray-400">Active reminders and to-do lists</p>
          </div>
        </div>
        {tasks.length === 0 ? (
          <p className="text-gray-400 text-center py-4 font-mono">No outstanding tasks.</p>
        ) : (
          <div className="flex flex-col gap-2 max-h-[220px] overflow-y-auto pr-1">
            {tasks.map((task: any, i: number) => (
              <div key={task.id || i} className="p-3 bg-white/5 rounded-xl border border-white/5 hover:border-white/15 transition-all flex items-center justify-between gap-3">
                <div className="flex flex-col gap-1 min-w-0">
                  <span className="font-bold text-white text-[12px] truncate">{task.title || 'Untitled Task'}</span>
                  {task.notes && <p className="text-[10px] text-gray-400 truncate">{task.notes}</p>}
                </div>
                {task.due && (
                  <span className="text-[9px] font-mono text-teal-400 bg-teal-500/10 px-2 py-0.5 rounded-full shrink-0">
                    {new Date(task.due).toLocaleDateString()}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="w-full text-white bg-[#0e1117] rounded-2xl border border-white/10 p-4 shrink-0 flex flex-col gap-4 font-sans text-xs">
      <div className="flex items-center gap-2 border-b border-white/10 pb-3">
        <div className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center text-purple-400 shrink-0">
          <Sparkles size={18} />
        </div>
        <div>
          <h4 className="font-bold text-[14px]">Workspace Request Successful</h4>
          <p className="text-[10px] text-gray-400">Workspace data payload and response</p>
        </div>
      </div>
      <div className="p-3 bg-white/5 border border-white/5 rounded-xl overflow-y-auto max-h-[200px]">
        {highlightJson(JSON.stringify(data, null, 2))}
      </div>
    </div>
  );
};

const DocumentView: React.FC<{ artifact: any }> = ({ artifact }) => {
  return (
    <div className="w-full text-black bg-white rounded shadow-[0_4px_15px_rgba(0,0,0,0.15)] p-4 md:p-6 flex flex-col relative overflow-hidden text-xs">
      <div className="flex justify-between items-start border-b border-gray-200 pb-2 mb-3 shrink-0 font-sans">
        <div className="flex items-center gap-1.5">
          <svg width="18" height="18" viewBox="0 0 100 100">
            <path d="M50,18 C61,35 77,54 81,66 C85,78 75,88 62,84 C50,80 50,62 50,62 C50,62 50,80 38,84 C25,88 15,78 19,66 C23,54 39,35 50,18 Z" stroke="black" strokeWidth="10" fill="none" strokeLinejoin="round" />
            <circle cx="50" cy="58" r="20" stroke="black" strokeWidth="7" fill="none" />
          </svg>
          <span className="text-[10px] font-black tracking-wider text-black">EBURON AI</span>
        </div>
        <div className="text-right text-[8px] text-gray-500 font-sans">
          <div className="font-bold uppercase tracking-wider text-black">
            {artifact.type === 'markdown' ? 'PROPOSAL' : artifact.type.toUpperCase()}
          </div>
          <div className="mt-0.5">{new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}</div>
        </div>
      </div>
      <div className="doc-content flex-grow flex flex-col text-black min-h-0 overflow-hidden font-sans">
        <div className="doc-title text-[14px] md:text-[18px] font-extrabold leading-tight text-gray-950 mb-0.5 shrink-0">
          {artifact.title || 'Q2 2024 Strategic Partnership Proposal'}
        </div>
        <div className="doc-subtitle text-[8.5px] font-medium text-gray-500 uppercase tracking-widest mb-2 shrink-0">
          Elevating Innovation Together • Session Workspace Delivery
        </div>
        <div className="doc-divider border-t border-gray-200 mb-2 shrink-0"></div>
        <div className="flex-1 overflow-y-auto pr-1 text-gray-800 leading-relaxed font-sans text-[11px]">
          {artifact.type === 'image' && (
            <div className="flex items-center justify-center bg-black rounded p-2 h-full min-h-[180px]">
              <img src={artifact.content} alt={artifact.title || 'Image Artifact'} className="max-w-full max-h-[160px] object-contain" />
            </div>
          )}
          {artifact.type === 'video' && (
            <div className="flex items-center justify-center bg-black rounded p-2 h-full min-h-[180px]">
              <video src={artifact.content} controls className="max-w-full max-h-[160px] object-contain" />
            </div>
          )}
          {artifact.type === 'pdf' && (
            <iframe src={artifact.content} className="w-full h-full border-0 rounded bg-white min-h-[180px]" title="PDF Preview" />
          )}
          {artifact.type === 'html' && (
            <iframe srcDoc={artifact.content} className="w-full h-full border-0 rounded bg-white min-h-[180px]" title="HTML Preview" />
          )}
          {artifact.type === 'markdown' && (
            <div className="prose prose-xs max-w-none prose-slate text-[11px] px-1 pb-4 leading-normal">
              <ReactMarkdown
                components={{
                  h1: ({node, ...props}) => <h1 className="text-[14px] font-black text-gray-900 border-b border-gray-100 pb-1 mt-4 mb-2" {...props}/>,
                  h2: ({node, ...props}) => <h2 className="text-[12px] font-bold text-gray-800 border-b border-gray-100 pb-0.5 mt-3.5 mb-1.5" {...props}/>,
                  h3: ({node, ...props}) => <h3 className="text-[11px] font-bold text-gray-700 mt-3 mb-1" {...props}/>,
                  p: ({node, ...props}) => <p className="text-[11px] text-gray-700 mb-2.5 leading-relaxed" {...props}/>,
                  ul: ({node, ...props}) => <ul className="list-disc pl-4 mb-3 space-y-1.5" {...props}/>,
                  ol: ({node, ...props}) => <ol className="list-decimal pl-4 mb-3 space-y-1.5" {...props}/>,
                  li: ({node, ...props}) => <li className="text-[11px] text-gray-700 leading-relaxed" {...props}/>,
                  strong: ({node, ...props}) => <strong className="font-bold text-gray-950" {...props}/>,
                  em: ({node, ...props}) => <em className="italic text-gray-900" {...props}/>,
                  blockquote: ({node, ...props}) => <blockquote className="border-l-4 border-[#cef158] pl-3 py-1 italic my-3 text-gray-600 bg-gray-50/50 rounded-r text-[11px] leading-relaxed" {...props}/>,
                  code: ({node, className, children, ...props}: any) => {
                    const inline = !className || !className.includes('language-');
                    return inline ? (
                      <code className="bg-gray-100 px-1.5 py-0.5 rounded text-[10px] font-mono text-purple-600 font-medium" {...props}>{children}</code>
                    ) : (
                      <pre className="bg-gray-900 text-[#ececec] p-3 rounded-lg my-3 overflow-auto font-mono text-[10px] border border-white/5"><code className={className} {...props}>{children}</code></pre>
                    )
                  },
                }}
              >
                {artifact.content}
              </ReactMarkdown>
            </div>
          )}
          {(artifact.type === 'structured' || artifact.type === 'json') && (
            <div className="p-3 bg-gray-50/50 border border-gray-100 rounded-xl overflow-y-auto w-full min-h-[180px]">
              {(() => {
                const content = artifact.content;
                let jsonStr = '';
                if (typeof content === 'string') {
                  try {
                    jsonStr = JSON.stringify(JSON.parse(content), null, 2);
                  } catch (e) {
                    jsonStr = content;
                  }
                } else {
                  jsonStr = JSON.stringify(content, null, 2);
                }
                return highlightJson(jsonStr);
              })()}
            </div>
          )}
          {artifact.type === 'code' && (
            <div className="p-3 bg-gray-50/50 border border-gray-100 rounded-xl overflow-y-auto w-full min-h-[180px]">
              {highlightCode(artifact.content)}
            </div>
          )}
        </div>
        <div className="doc-footer-line border-t-[1.5px] border-[#cef158] mt-3 pt-2 shrink-0 font-sans">
          <div className="flex justify-between items-center text-[8.5px] font-bold text-black uppercase">
            <span>Eburon AI</span>
            <span>Page 1 of 1</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export const MissionControlPage: React.FC = () => {
  const { activeWorkspaceResult, isGenerating, setActiveWorkspaceResult, setIsGenerating } = useUI((state) => ({
    activeWorkspaceResult: state.activeWorkspaceResult,
    isGenerating: state.isGenerating,
    setActiveWorkspaceResult: state.setActiveWorkspaceResult,
    setIsGenerating: state.setIsGenerating,
  }));
  const turns = useLogStore((state) => state.turns);
  const [bootProgress, setBootProgress] = useState(0);
  const [bootStage, setBootStage] = useState(0);
  const [isBooting, setIsBooting] = useState(true);
  const [statusText, setStatusText] = useState('system booting');

  useEffect(() => {
    const bootInterval = setInterval(() => {
      setBootProgress(prev => {
        if (prev >= 100) {
          clearInterval(bootInterval);
          return 100;
        }
        return prev + 2;
      });
    }, 30);

    const stageInterval = setInterval(() => {
      setBootStage(prev => {
        if (prev >= 3) {
          clearInterval(stageInterval);
          return 3;
        }
        return prev + 1;
      });
    }, 800);

    const bootTimer = setTimeout(() => {
      setIsBooting(false);
      setStatusText('system ready');
    }, 2500);

    return () => {
      clearInterval(bootInterval);
      clearInterval(stageInterval);
      clearTimeout(bootTimer);
    };
  }, []);

  const closeMissionControl = () => {
    setActiveWorkspaceResult(null);
    setIsGenerating(false);
  };

  return (
    <div className="fixed inset-0 bg-[#080504] text-zinc-100 font-sans flex flex-col justify-between relative overflow-hidden select-none z-[100]">
      {/* Ambient Background Lighting */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(208,167,139,0.015),transparent_75%)] pointer-events-none z-0"></div>

      {/* STICKY TOP HEADER */}
      <header className="sticky top-0 w-full bg-black/95 backdrop-blur-md border-b border-zinc-900/80 px-6 py-4 flex items-center justify-between z-35">
        <div className="flex items-center">
          <div className="p-1.5 -ml-1.5 text-zinc-400">
            <Monitor className="w-6 h-6 text-[#d0a78b]" />
          </div>
        </div>
        <div className="text-center flex flex-col items-center">
          <h1 className="text-xl font-semibold tracking-wide text-[#d0a78b]">Eburon Computer</h1>
          <p className="text-[9px] text-zinc-500 tracking-[0.18em] lowercase -mt-0.5">beatrice - ai operator</p>
        </div>
        <div className="flex items-center">
          <button 
            onClick={closeMissionControl}
            className="p-1.5 -mr-1.5 rounded-lg text-zinc-400 hover:text-rose-500 hover:bg-zinc-900/50 focus:outline-none transition-all duration-300" 
            aria-label="Close"
          >
            <X className="w-6 h-6" />
          </button>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-start relative z-10 pt-2 pb-6 px-4">
        <p className="text-zinc-600 text-[10px] font-mono tracking-widest uppercase mb-3 transition-all duration-300">
          {statusText}
        </p>

        <div className="relative w-full max-w-sm flex-1 max-h-[440px] bg-zinc-950 border border-[#d0a78b]/20 rounded-2xl overflow-y-auto scroll-smooth flex flex-col">
          
          {/* Boot Screen */}
          <AnimatePresence>
            {isBooting && (
              <motion.div 
                initial={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.7 }}
                className="absolute inset-0 bg-black z-35 flex flex-col justify-between p-6"
              >
                <div className="font-mono text-[10px] text-[#d0a78b]/85 leading-relaxed text-left flex flex-col gap-1">
                  <p>EBURON SYSTEM ARCH v5.1 BIOS</p>
                  <p>CPU: COGNITIVE DEEP NODE @ 4.80GHz</p>
                  <p>MEM: {bootProgress * 163}MB / 16384MB REGISTERED...</p>
                  <p className="mt-2 text-zinc-500">INIT BEATRICE AI AGENT MODULES...</p>
                  {bootStage >= 1 && <p className="text-[#d0a78b]">&gt; DRIVERS VERIFIED [100%]</p>}
                  {bootStage >= 2 && <p className="text-[#d0a78b]">&gt; STACK PIPELINE CONNECTED</p>}
                  {bootStage >= 3 && <p className="text-zinc-300 animate-pulse">&gt; MOUNTING EBURON OS INTERFACE... {bootProgress}%</p>}
                </div>
                <div className="flex items-center justify-between text-[9px] font-mono text-zinc-600">
                  <span>EBURON CORP (C) 2026</span>
                  <span className="animate-pulse">LOADING KERNEL...</span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="sticky top-0 bg-zinc-900 border-b border-zinc-900 px-4 py-1.5 flex items-center justify-between select-none z-25 shrink-0">
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
              <span className="font-mono text-[9px] text-[#d0a78b]/80 uppercase tracking-widest">eburon_desk_v5.0</span>
            </div>
            <span className="font-mono text-[9px] text-zinc-500">sec_ip: localhost</span>
          </div>

          <div className="sticky top-[29px] w-full h-[200px] border-b border-[#ab7b60]/20 relative overflow-hidden flex flex-col justify-start p-3 shrink-0 select-none z-20 transition-all duration-1000 ease-in-out" style={{ background: 'radial-gradient(circle at 60% 45%, #2a1a14 0%, #120b08 60%, #080504 100%)' }}>
            
            <div className="w-[90%] max-w-[280px] bg-white/10 backdrop-blur border border-white/5 rounded-full py-1.5 px-4 flex items-center justify-between mx-auto mb-2 relative">
              <div className="flex items-center gap-1.5">
                <span className="text-white/85 font-extrabold text-[9px] font-sans">G</span>
                <span className="text-zinc-400 text-[6.5px] tracking-wide truncate max-w-[170px]">Search your device...</span>
              </div>
              <div className="flex items-center gap-0.5">
                <span className="w-1 h-1 rounded-full bg-[#4285F4]"></span>
                <span className="w-1 h-1 rounded-full bg-[#EA4335]"></span>
                <span className="w-1 h-1 rounded-full bg-[#FBBC05]"></span>
                <span className="w-1 h-1 rounded-full bg-[#34A853]"></span>
              </div>
            </div>

            <div className="flex items-center justify-center gap-1 mb-2.5 text-[5.5px] text-zinc-400">
              <span className="bg-white/5 px-1.5 py-0.5 rounded-full border border-white/5">Play Store</span>
              <span className="bg-white/5 px-1.5 py-0.5 rounded-full border border-white/5">Elevate</span>
              <span className="bg-white/5 px-1.5 py-0.5 rounded-full border border-white/5 text-[#d0a78b]">Photos</span>
              <span className="bg-white/5 px-1.5 py-0.5 rounded-full border border-white/5">Settings</span>
            </div>

            <div className="grid grid-cols-5 gap-y-2.5 gap-x-1 justify-items-center w-full max-w-[320px] mx-auto px-1.5">
              <div className="flex flex-col items-center gap-0.5 cursor-pointer" onClick={() => {}}>
                <div className="w-7 h-7 rounded-full bg-zinc-900 border border-zinc-850 flex items-center justify-center relative overflow-hidden">
                  <div className="w-4 h-4 bg-[#ab7b60] rounded-tl-full absolute left-1.5 top-1.5"></div>
                  <div className="w-4 h-4 bg-[#d0a78b] rounded-tr-full absolute right-1.5 top-1.5"></div>
                  <div className="w-4 h-4 bg-yellow-600 rounded-bl-full absolute left-1.5 bottom-1.5"></div>
                  <div className="w-4 h-4 bg-orange-700 rounded-br-full absolute right-1.5 bottom-1.5"></div>
                  <div className="absolute inset-1 rounded-full bg-zinc-900 flex items-center justify-center"><span className="text-[5px] text-zinc-400">P</span></div>
                </div>
                <span className="text-[6px] text-zinc-300">Photos</span>
              </div>
              <div className="flex flex-col items-center gap-0.5 opacity-35">
                <div className="w-7 h-7 rounded-full bg-stone-700 flex items-center justify-center">
                  <ImageIcon className="w-3.5 h-3.5 text-white" />
                </div>
                <span className="text-[6px] text-zinc-300">Camera</span>
              </div>
              <div className="flex flex-col items-center gap-0.5 opacity-35">
                <div className="w-7 h-7 rounded-full bg-[#ab7b60]/50 flex items-center justify-center">
                  <div className="w-3.5 h-3.5 text-white" />
                </div>
                <span className="text-[6px] text-zinc-300">Duo</span>
              </div>
              <div className="flex flex-col items-center gap-0.5">
                <div className="w-7 h-7 rounded-full bg-amber-800 flex items-center justify-center border border-transparent">
                  <Terminal className="w-4 h-4 text-white" />
                </div>
                <span className="text-[6px] text-zinc-300">Terminal</span>
              </div>
              <div className="flex flex-col items-center gap-0.5">
                <div className="w-7 h-7 rounded-full bg-[#ab7b60] flex items-center justify-center">
                  <Settings className="w-3.5 h-3.5 text-white" />
                </div>
                <span className="text-[6px] text-zinc-300">Settings</span>
              </div>
            </div>

            {/* Output Area within Desktop Viewport */}
            <div className="absolute inset-x-4 top-1.5 h-[168px] bg-zinc-950/90 backdrop-blur-md border border-zinc-800/80 rounded-xl flex flex-col p-2.5 z-25 shadow-xl shadow-black/80 overflow-hidden">
               <div className="flex justify-between items-center border-b border-zinc-900 pb-1.5 mb-1.5 select-none">
                  <div className="flex items-center gap-1 shrink-0">
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                  </div>
                  <span className="font-mono text-[7px] text-[#d0a78b] font-bold uppercase">Mission Payload</span>
                  <span className="font-mono text-[6px] text-zinc-600">LOCKED</span>
               </div>
               <div className="flex-1 overflow-y-auto p-1">
                  {isGenerating ? (
                    <div className="flex flex-col items-center justify-center h-full gap-2">
                      <div className="w-4 h-4 border-2 border-t-[#d0a78b] border-zinc-800 rounded-full animate-spin" />
                      <span className="font-mono text-[8px] text-[#d0a78b] animate-pulse uppercase">Calculating Payload...</span>
                    </div>
                  ) : activeWorkspaceResult?.artifact ? (
                    <div className="scale-[0.6] origin-top-left w-[166%] h-[166%] overflow-auto">
                      <DocumentView artifact={activeWorkspaceResult.artifact} />
                    </div>
                  ) : activeWorkspaceResult ? (
                    <div className="scale-[0.6] origin-top-left w-[166%] h-[166%] overflow-auto">
                      <WorkspaceDataViewer data={activeWorkspaceResult} />
                    </div>
                  ) : (
                    <div className="flex items-center justify-center h-full text-zinc-600 font-mono text-[8px] italic">
                      No active payload detected...
                    </div>
                  )}
               </div>
            </div>
          </div>

          <div className="w-full bg-[#080504] p-3 relative z-10 flex flex-col select-text min-h-[200px]">
            <div className="flex-1 flex flex-col border border-[#d0a78b]/20 rounded-xl overflow-hidden p-2.5 gap-2 bg-[#0c0a09]/40 relative">
              <div className="flex items-center justify-between border-b border-zinc-900/60 pb-1.5 select-none">
                <span className="font-mono text-[8px] text-[#d0a78b] tracking-widest font-bold">┌── SYSTEM DEC_TUI ────────┐</span>
                <span className="font-mono text-[8px] text-zinc-600 tracking-widest">v5.1_secure</span>
              </div>

              <div className="flex-1 flex gap-2.5 overflow-hidden">
                <div className="w-[45%] flex flex-col gap-2 border-r border-zinc-900/40 pr-2 select-none text-left justify-between">
                  <div className="flex flex-col gap-1.5">
                    <span className="font-mono text-[7px] text-zinc-500 tracking-wider uppercase">Status Gauges</span>
                    <div className="flex flex-col gap-0.5">
                      <span className="font-mono text-[7px] text-zinc-400">CPU LOAD:</span>
                      <span className="font-mono text-[8px] text-[#d0a78b]/80">██░░░░░░░░ 20%</span>
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <span className="font-mono text-[7px] text-zinc-400">MEM LOAD:</span>
                      <span className="font-mono text-[8px] text-[#d0a78b]/80">████░░░░░░ 40%</span>
                    </div>
                  </div>

                  <div className="flex flex-col gap-1 border-t border-zinc-900/60 pt-1.5">
                    <span className="font-mono text-[7px] text-zinc-500 uppercase">Active Threads</span>
                    <div className="font-mono text-[6.5px] leading-tight text-zinc-400 flex flex-col gap-0.5">
                      <div className="flex justify-between border-b border-zinc-900/20 text-zinc-500 font-bold pb-0.5">
                        <span>PID</span><span className="w-12 text-left">PROCESS</span><span>CPU</span><span>ST</span>
                      </div>
                      <div className="flex justify-between text-[#d0a78b]/80 font-medium">
                        <span>104</span><span className="w-12 truncate text-left">beatrice</span><span>42%</span><span>RUN</span>
                      </div>
                      <div className="flex justify-between">
                        <span>212</span><span className="w-12 truncate text-left">sys_log</span><span>3%</span><span>SLP</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex-1 flex flex-col text-left overflow-hidden">
                  <div className="flex justify-between items-center mb-1 select-none">
                    <span className="font-mono text-[7px] text-zinc-500 tracking-wider">EXECUTION LOGS</span>
                  </div>
                  <div className="flex-1 overflow-y-auto pr-1 flex flex-col gap-1 scroll-smooth font-mono text-[8px] max-h-[110px]">
                    {turns.filter(t => t.role !== 'system').map((turn, i) => (
                      <div key={i} className={`flex gap-2 ${turn.role === 'user' ? 'text-zinc-500' : 'text-[#d0a78b]/80'}`}>
                        <span className="shrink-0">[{turn.role === 'user' ? 'USR' : 'AI'}]</span>
                        <span className="truncate">{turn.text}</span>
                      </div>
                    ))}
                    <div className="text-zinc-600 animate-pulse">&gt; system idle...</div>
                  </div>
                </div>
              </div>
              <div className="font-mono text-[8px] text-zinc-700/80 tracking-widest text-left select-none mt-1">
                └─────────────────────────────────┘
              </div>
            </div>
          </div>

        </div>
      </main>
    </div>
  );
};
