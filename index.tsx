
import React, { useState, useEffect, useMemo } from 'react';
import { createRoot } from 'react-dom/client';
import { GoogleGenAI } from "@google/genai";

// --- Mock Data Repository (Simulation Mode Fallback) ---
const MOCK_DATA: Record<string, any> = {
  '/api/dashboard/stats': {
    total_groups: 142,
    sa_groups: 64,
    eo_groups: 78,
    monitored_contacts: 4077,
    high_value_messages_24h: 28,
    pending_drafts: 12
  },
  '/api/members': [
    { member_id: 1, display_name: 'David Chen', phone_number: '+27 82 111 2222', company_name: 'Apex Solar Solutions', instance_id: 2, is_eo_member: true, eo_chapter: 'Johannesburg', monitoring_enabled: true, last_interaction_date: '2024-10-20', group_ids: ['12036302@g.us', '12036305@g.us'], is_direct: true },
    { member_id: 2, display_name: 'Sarah Smith', phone_number: '+27 71 333 4444', company_name: 'Sarahs Boutique', instance_id: 1, is_eo_member: false, monitoring_enabled: false, last_interaction_date: '2024-09-15', group_ids: ['12036305@g.us'], is_direct: false },
    { member_id: 3, display_name: 'Marcus Thorne', phone_number: '+27 60 555 6666', company_name: 'Thorne Logistics', instance_id: 2, is_eo_member: true, eo_chapter: 'Cape Town', is_ypo_member: true, ypo_chapter: 'Africa South', monitoring_enabled: true, last_interaction_date: '2024-10-22', group_ids: ['12036302@g.us'], is_direct: true }
  ],
  '/api/groups': [
    { group_id: 101, group_name: 'EO JHB Official', instance_id: 2, member_count: 85, group_category: 'eo_official', monitoring_enabled: true, jid: '12036302@g.us' },
    { group_id: 102, group_name: 'Business Networking SA', instance_id: 1, member_count: 250, group_category: 'business_sa', monitoring_enabled: true, jid: '12036305@g.us' },
    { group_id: 103, group_name: 'Tech Founders SA', instance_id: 1, member_count: 120, group_category: 'industry', monitoring_enabled: false, jid: '12036308@g.us' }
  ],
  '/api/social/birthdays/upcoming?days=30': [
    { member_id: 1, name: 'David Chen', birthday_date: 'Oct 28', company_name: 'Apex Solar Solutions', instance_id: 2, phone_number: '+27821112222' },
    { member_id: 4, name: 'Linda Mbeki', birthday_date: 'Oct 30', company_name: 'Innovate SA', instance_id: 1, phone_number: '+27713334444' }
  ],
  '/api/social/linkedin/recent-posts?days=7': [
    { post_id: 'li1', name: 'Marcus Thorne', post_date: '2h ago', post_summary: 'Just closed a major deal for the new logistics hub! Grateful for the team.', engagement_opportunity: 'Congratulate on the new hub closure.', instance_id: 2, phone_number: '+27605556666' }
  ],
  '/api/inbox/high-value': [
    { message_id: 'm1', sender_name: 'David Chen', group_name: 'EO JHB Official', instance_id: 2, sender_is_eo_member: true, sender_eo_chapter: 'Johannesburg', value_score: 92, message_body: 'Looking for a solar partner for a 5MW project in Gauteng. Any leads?', should_reply: true, reasoning: 'Direct high-value project lead with specific scale mentioned.', group_draft: 'Hi David! Apex is well-positioned for this. Should we hop on a 10min call tomorrow morning to discuss technical specs?', dm_draft: 'Hey David, saw your message in the EO group. I actually have a direct connection for solar projects of that scale. Let me know if you want an intro.', group_jid: '12036302@g.us', sender_id: '27821112222@s.whatsapp.net' }
  ]
};

// --- Config Initializers ---
const getInitialBaseUrl = () => {
  // Always prefer the Environment Variable injected by Coolify/Vite
  const envUrl = (import.meta as any).env?.VITE_API_BASE_URL;
  if (envUrl && envUrl.includes('http')) return envUrl;

  // Fallback to window injection or localhost (only for local dev)
  return (window as any).VITE_API_BASE_URL || 'http://localhost:3001';
};

const getInitialConfig = () => {
  const saved = localStorage.getItem('nexus_config');
  if (saved) return JSON.parse(saved);
  return {
    evolutionApiUrl: process.env.EVOLUTION_API_URL || '',
    evolutionApiKey: process.env.EVOLUTION_API_KEY || '',
    instanceName: process.env.INSTANCE_NAME || 'Unified',
    instanceName2: process.env.INSTANCE_NAME_2 || '',
    myWhatsAppId: '',
    aiProvider: 'openai',
    openaiApiKey: process.env.OPENAI_API_KEY || '',
    openaiModel: 'gpt-5-mini',
    persona: 'You are a strategic business assistant specializing in high-value real estate opportunities and professional networking. Identify leads and close deals with precision.',
    scoringRules: `1. If message contains budget or investment amount, add +20 points\n2. If user asks about specific property/project, add +30 points\n3. If direct question to user, add +15 points\n4. If generic hello or social pleasantries, subtract -20 points\n5. If spam or unsolicited selling, score = 0`,
    draftStyle: 'Professional, concise (1-2 sentences), always end with helpful follow-up question.',
    threshold: 75
  };
};

const SimpleLogin = ({ onLogin, initialRemember }: { onLogin: (persist: boolean) => void, initialRemember: boolean }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(initialRemember);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const validEmail = process.env.ACCESS_EMAIL;
    const validPassword = process.env.ACCESS_PASSWORD;

    if (!validEmail || !validPassword) {
      console.warn("No AUTH vars set, allowing bypass.");
      onLogin(rememberMe);
      return;
    }

    if (email === validEmail && password === validPassword) {
      onLogin(rememberMe);
    } else {
      setError('Invalid credentials.');
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="bg-white rounded-[32px] p-10 w-full max-w-md space-y-8 shadow-2xl">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-black italic tracking-tighter text-slate-900">SyncNexus</h1>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Secure Access Gateway</p>
        </div>
        <form onSubmit={handleLogin} className="space-y-6">
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase text-slate-400 ml-2">Email Identity</label>
            <input type="email" name="email" autoComplete="username" value={email} onChange={e => setEmail(e.target.value)} className="w-full bg-slate-50 border-2 border-slate-100 p-4 rounded-2xl outline-none focus:border-indigo-600 transition-all font-bold text-slate-700" placeholder="remote@admin.co" />
          </div>
          <div className="space-y-2 relative">
            <label className="text-[10px] font-black uppercase text-slate-400 ml-2">Passphrase</label>
            <div className="relative">
              <input type={showPassword ? "text" : "password"} name="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} className="w-full bg-slate-50 border-2 border-slate-100 p-4 rounded-2xl outline-none focus:border-indigo-600 transition-all font-bold text-slate-700 pr-12" placeholder="••••••••" />
              <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-indigo-600 text-[10px] font-black uppercase">{showPassword ? 'HIDE' : 'SHOW'}</button>
            </div>
          </div>
          <div className="flex items-center gap-2 ml-2 cursor-pointer" onClick={() => setRememberMe(!rememberMe)}>
            <div className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${rememberMe ? 'bg-indigo-600 border-indigo-600' : 'bg-slate-100 border-slate-300'}`}>
              {rememberMe && <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
            </div>
            <span className="text-[10px] font-bold text-slate-500 uppercase select-none">Remember Identity</span>
          </div>

          {error && <p className="text-rose-500 text-xs font-black text-center bg-rose-50 py-2 rounded-lg">{error}</p>}
          <button type="submit" className="w-full py-5 bg-indigo-600 text-white rounded-[20px] text-xs font-black uppercase tracking-widest hover:scale-[1.02] transition-all shadow-lg">Authenticate</button>
        </form>
        <p className="text-center text-[9px] text-slate-300 font-mono">Encrypted Connection • v2.1.0</p>
      </div>
    </div>
  );
};

// --- Icons ---
const Icons = {
  Dashboard: () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>,
  Users: () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>,
  Groups: () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>,
  Inbox: () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0a2 2 0 01-2 2H6a2 2 0 01-2-2m16 0l-8 5-8-5" /></svg>,
  Terminal: () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>,
  Sync: () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>,
  Settings: () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>,
  Brain: () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>,
  Sparkles: () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" /></svg>,
};

const App = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(() => localStorage.getItem('nexus_auth') === 'true');
  const [activeTab, setActiveTab] = useState('dashboard');

  const [selectedInstance, setSelectedInstance] = useState<number | 'all'>('all');
  const [baseUrl, setBaseUrl] = useState(getInitialBaseUrl());
  const [isSimulationMode, setIsSimulationMode] = useState(false);
  const [isGlobalLoading, setIsGlobalLoading] = useState(false);

  // Real Data States
  const [groups, setGroups] = useState<any[]>([]);
  const [contacts, setContacts] = useState<any[]>([]);
  const [birthdays, setBirthdays] = useState<any[]>([]);
  const [linkedinActivity, setLinkedinActivity] = useState<any[]>([]);
  const [aiQueue, setAiQueue] = useState<any[]>([]);
  const [messages, setMessages] = useState<any[]>([]);
  const [stats, setStats] = useState<any>({
    totalGroups: 0,
    saGroups: 0,
    eoGroups: 0,
    monitoredContacts: 0,
    highValueMessages: 0,
    pendingDrafts: 0
  });

  // Intel States
  const [costs, setCosts] = useState({ total: 0, today: 0, tokens: 0 });
  const [logs, setLogs] = useState<any[]>([]);
  const [isEnriching, setIsEnriching] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedEntity, setSelectedEntity] = useState<any>(null);
  const [selectedGroup, setSelectedGroup] = useState<any>(null);
  const [crmMode, setCrmMode] = useState<'known' | 'passive'>('known');
  const [config, setConfig] = useState(getInitialConfig());

  // ... existing detailed code ...




  // --- Helpers ---
  const addLog = (type: 'info' | 'success' | 'error' | 'ai', text: string) => {
    setLogs(prev => [{ id: Date.now(), type, text }, ...prev.slice(0, 49)]);
  };

  async function apiCall(endpoint: string, options?: RequestInit) {
    try {
      const response = await fetch(`${baseUrl}${endpoint}`, {
        ...options,
        headers: { 'Content-Type': 'application/json', ...options?.headers }
      });
      if (!response.ok) throw new Error(`API Error: ${response.status}`);
      setIsSimulationMode(false);
      return response.json();
    } catch (err: any) {
      console.warn(`Fetch failure for ${endpoint}: ${err.message}.`);
      setIsSimulationMode(true);
      const mockKey = Object.keys(MOCK_DATA).find(key => endpoint.includes(key.split('?')[0]));
      if (mockKey) return MOCK_DATA[mockKey];
      throw err;
    }
  }

  // --- AI Logic ---
  async function callAI(prompt: string, json: boolean = true): Promise<string> {
    if (config.aiProvider === 'openai') {
      if (!config.openaiApiKey) throw new Error('OpenAI API Key missing');
      try {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${config.openaiApiKey}` },
          body: JSON.stringify({
            model: config.openaiModel,
            messages: [{ role: 'user', content: prompt }],
            response_format: json ? { type: 'json_object' } : undefined
          })
        });
        const data = await response.json();
        if (data.error) throw new Error(data.error.message);
        setCosts(prev => ({ ...prev, tokens: prev.tokens + data.usage.total_tokens, total: prev.total + (data.usage.total_tokens / 1000) * 0.001, today: prev.today + (data.usage.total_tokens / 1000) * 0.001 }));
        return data.choices[0].message.content;
      } catch (err: any) { addLog('error', `OpenAI error: ${err.message}`); throw err; }
    } else {
      try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });
        const result = await ai.models.generateContent({
          model: 'gemini-3-flash-preview',
          contents: prompt,
          config: { systemInstruction: config.persona, responseMimeType: json ? 'application/json' : undefined }
        });
        setCosts(prev => ({ ...prev, tokens: prev.tokens + 450, total: prev.total + 0.0005, today: prev.today + 0.0005 }));
        return result.text || '';
      } catch (err: any) { addLog('error', `Gemini error: ${err.message}`); throw err; }
    }
  }

  async function enrichProfile(contact: any, silent: boolean = false) {
    if (!silent) setIsEnriching(true);
    if (!silent) addLog('ai', `Enriching ${contact.display_name}...`);
    const relevantMsgs = messages.filter(m => m.sender_id === contact.member_id).map(m => m.body).join('\n');
    const prompt = `CORE PERSONA: ${config.persona}\nTASK: Create identity profile.\nNAME: ${contact.display_name}\nCONTEXT: ${relevantMsgs}\nRETURN JSON ONLY:\n{"role": "string", "industry": "string", "summary": "string", "score": number }`;
    try {
      const text = await callAI(prompt);
      const enrichment = JSON.parse(text);
      const updatedContact = { ...contact, relevance: enrichment.score, enrichment, research_log: [{ date: new Date().toISOString(), provider: config.aiProvider, result: enrichment.summary }, ...(contact.research_log || [])] };
      setContacts(prev => prev.map(c => (c.member_id === contact.member_id ? updatedContact : c)));
      if (!silent) { setSelectedEntity(updatedContact); addLog('success', `Enriched: ${contact.display_name}`); }
    } catch (err: any) { if (!silent) addLog('error', `Enrichment error: ${err.message}`); } finally { if (!silent) setIsEnriching(false); }
  }

  async function triggerAutoEnrichment(targets: any[]) {
    addLog('ai', `Auto-enrichment batch: ${targets.length} targets`);
    for (const contact of targets) {
      await enrichProfile(contact, true);
      await new Promise(r => setTimeout(r, 1500));
    }
    addLog('success', `Batch enrichment completed.`);
  }

  async function analyzeMessage(msg: any) {
    setIsProcessing(true);
    addLog('ai', `Analyzing signal from ${msg.sender_name}...`);
    const prompt = `CORE PERSONA: ${config.persona}\nSCORING: ${config.scoringRules}\nSTYLE: ${config.draftStyle}\nTASK: Generate Group Draft and Private DM.\nMESSAGE: "${msg.body}"\nRETURN JSON ONLY:\n{"score": number, "intent": "string", "reasoning": "string", "shouldReply": boolean, "groupDraft": "string", "dmDraft": "string" }`;
    try {
      const text = await callAI(prompt);
      const result = JSON.parse(text);
      if (result.score >= config.threshold && result.shouldReply) {
        setAiQueue(prev => [{ id: `q-${Date.now()}`, message_id: msg.id, sender_id: msg.sender_id, group_jid: msg.group_id, sender_name: msg.sender_name, message_body: msg.body, value_score: result.score, reasoning: result.reasoning, group_draft: result.groupDraft, dm_draft: result.dmDraft, should_reply: true }, ...prev]);
        addLog('success', `Triage created (${result.score})`);
      }
    } catch (err: any) { addLog('error', `Analysis failed: ${err.message}`); } finally { setIsProcessing(false); }
  }

  // --- Evolution API ---
  async function fetchEvolutionGroups() {
    if (!config.evolutionApiUrl || !config.evolutionApiKey) return addLog('error', 'Evolution API missing');
    addLog('info', `Syncing Evolution Matrix...`);

    const instancesToSync = [];
    if (selectedInstance === 'all' || selectedInstance === 1) instancesToSync.push(config.instanceName);
    if ((selectedInstance === 'all' || selectedInstance === 2) && config.instanceName2) instancesToSync.push(config.instanceName2);

    let allGroups: any[] = [];

    for (const instance of instancesToSync) {
      if (!instance) continue;
      try {
        const response = await fetch(`${config.evolutionApiUrl}/group/fetchAllGroups/${instance}`, { headers: { 'apikey': config.evolutionApiKey } });
        const data = await response.json();
        const transformed = data.map((g: any) => ({
          group_id: g.id,
          group_name: g.subject || 'Unnamed',
          member_count: g.size || 0,
          group_category: 'whatsapp',
          monitoring_enabled: true,
          jid: g.id
        }));
        allGroups = [...allGroups, ...transformed];
      } catch (err: any) {
        addLog('error', `Sync failed for ${instance}: ${err.message}`);
      }
    }

    // Deduplicate by JID
    const uniqueGroups = Array.from(new Map(allGroups.map(item => [item.jid, item])).values());
    setGroups(uniqueGroups);
    addLog('success', `Matrix Synced: ${uniqueGroups.length} groups.`);
  }

  async function fetchEvolutionMembers(groupJid: string) {
    if (!config.evolutionApiUrl || !config.evolutionApiKey) return;
    addLog('info', `Importing participants...`);

    // We try both instances to find where the group exists, or default to primary
    // In reality, we should know which instance the group belongs to.
    // For simplicity, we trigger the fetch on the primary likely instance, or try both.

    const targetInstance = config.instanceName2 && selectedInstance === 2 ? config.instanceName2 : config.instanceName;

    try {
      const response = await fetch(`${config.evolutionApiUrl}/group/participants/${targetInstance}?groupJid=${groupJid}`, { headers: { 'apikey': config.evolutionApiKey } });
      const participants = await response.json();
      const newContacts = participants.map((p: any) => ({
        member_id: p.id, display_name: p.pushName || p.notify || p.id.split('@')[0], phone_number: p.id.replace('@s.whatsapp.net', '').replace('@c.us', ''), instance_id: parseInt(config.instanceName.includes('UAE') ? '2' : '1'), is_eo_member: false, monitoring_enabled: true, enrichment: null, research_log: [], group_ids: [groupJid], is_direct: false
      }));
      setContacts(prev => {
        const existingIds = new Set(prev.map(c => c.member_id));
        const uniqueNew = newContacts.filter((c: any) => !existingIds.has(c.member_id));
        if (uniqueNew.length > 0) triggerAutoEnrichment(uniqueNew);
        return [...prev, ...uniqueNew];
      });
      addLog('success', `Imported ${newContacts.length} contacts.`);
    } catch (err: any) { addLog('error', `Member error: ${err.message}`); }
  }

  async function fetchEvolutionMessages(groupJid: string) {
    if (!config.evolutionApiUrl || !config.evolutionApiKey) return;
    addLog('info', `Restoring intelligence for ${groupJid}...`);
    try {
      const response = await fetch(`${config.evolutionApiUrl}/chat/findMessages/${config.instanceName}?where[key.remoteJid]=${groupJid}&limit=20`, { headers: { 'apikey': config.evolutionApiKey } });
      const rawMsgs = await response.json();
      const transformed = rawMsgs.map((m: any) => ({ id: m.key.id, group_id: groupJid, sender_id: m.key.participant || m.key.remoteJid, sender_name: m.pushName || 'Unknown', body: m.message?.conversation || m.message?.extendedTextMessage?.text || '', timestamp: m.messageTimestamp, is_from_me: m.key.fromMe })).filter((m: any) => m.body);
      setMessages(prev => [...transformed, ...prev]);
      addLog('success', `Restored ${transformed.length} logs.`);
      if (transformed.length > 0) analyzeMessage(transformed[0]);
    } catch (err: any) { addLog('error', `History error: ${err.message}`); }
  }

  async function sendEvolutionWhatsApp(jid: string, text: string): Promise<boolean> {
    if (!config.evolutionApiUrl || !config.evolutionApiKey) return false;
    addLog('info', `Deploying to ${jid}...`);
    try {
      const response = await fetch(`${config.evolutionApiUrl}/message/sendText/${config.instanceName}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': config.evolutionApiKey },
        body: JSON.stringify({ number: jid, text: text })
      });
      if (response.ok) { addLog('success', `Delivered.`); return true; }
      addLog('error', `Send failed.`); return false;
    } catch (err: any) { addLog('error', `Send error: ${err.message}`); return false; }
  }

  // --- Fetch Logic ---
  // --- Fetch Logic ---
  useEffect(() => {
    if (!isAuthenticated) return;

    setIsGlobalLoading(true);
    const p1 = apiCall(`/api/groups`).then(d => setGroups(d));
    const p2 = apiCall(`/api/members`).then(d => setContacts(d));
    const p3 = apiCall('/api/social/birthdays/upcoming?days=30').then(d => setBirthdays(d));
    const p4 = apiCall('/api/social/linkedin/recent-posts?days=7').then(d => setLinkedinActivity(d));
    const p5 = apiCall('/api/inbox/high-value').then(d => setAiQueue(d));
    const p6 = apiCall('/api/dashboard/stats').then(d => setStats({ totalGroups: d.total_groups, saGroups: d.sa_groups, eoGroups: d.eo_groups, monitoredContacts: d.monitored_contacts, highValueMessages: d.high_value_messages_24h, pendingDrafts: d.pending_drafts }));

    Promise.allSettled([p1, p2, p3, p4, p5, p6]).then(() => {
      // Small delay to ensure smooth transition
      setTimeout(() => setIsGlobalLoading(false), 800);
    });
  }, [baseUrl, isAuthenticated]);

  // --- Navigation Helpers ---
  const goToContact = (contactId: string | number) => {
    const contact = contacts.find(c => c.member_id === contactId || c.phone_number === contactId);
    if (contact) {
      setSelectedEntity(contact);
      setCrmMode(contact.enrichment ? 'known' : 'passive');
      setActiveTab('contacts');
    } else {
      addLog('error', `Contact ${contactId} not found in localized matrix.`);
    }
  };

  // --- Components ---
  const Badge = ({ contact }: { contact: any }) => (
    <div className="flex flex-wrap gap-1 mt-1">
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold ${contact.instance_id === 1 ? 'bg-blue-50 text-blue-600 border border-blue-100' : 'bg-green-50 text-green-600 border border-green-100'}`}>
        {contact.instance_id === 1 ? '📱 SA' : '🌍 UAE'}
      </span>
      {contact.is_eo_member && <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-purple-50 text-purple-600 border border-purple-100 rounded-md text-[10px] font-bold italic">✨ UAE - {contact.eo_chapter}</span>}
      {contact.is_direct && <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-rose-50 text-rose-600 border border-rose-100 rounded-md text-[10px] font-bold uppercase tracking-tighter">👤 Direct Partner</span>}
    </div>
  );

  return (
    <>
      {!isAuthenticated && (
        <SimpleLogin
          initialRemember={localStorage.getItem('nexus_auth') === 'true'}
          onLogin={(persist) => {
            setIsAuthenticated(true);
            if (persist) localStorage.setItem('nexus_auth', 'true');
          }}
        />
      )}

      {isAuthenticated && isGlobalLoading && (
        <div className="min-h-screen bg-slate-900 flex items-center justify-center p-10 flex-col gap-6">
          <div className="w-16 h-16 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-indigo-400 font-mono text-xs uppercase animate-pulse">Initializing Neural Core...</p>
        </div>
      )}

      {isAuthenticated && !isGlobalLoading && (
        <div className="min-h-screen bg-[#F8FAFC] flex text-slate-900 font-sans overflow-hidden">

          {/* Sidebar */}
          <aside className="w-[280px] bg-white border-r border-slate-200 flex flex-col h-screen shrink-0 z-50">
            <div className="p-8">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg"><span className="text-xl font-bold">N</span></div>
                <h1 className="text-xl font-black tracking-tight italic">SyncNexus</h1>
              </div>
            </div>
            <nav className="flex-1 px-4 space-y-1 overflow-y-auto">
              {[
                { name: 'Dashboard', path: 'dashboard', icon: Icons.Dashboard },
                { name: 'AI Inbox', path: 'inbox', icon: Icons.Inbox, badge: aiQueue.length },
                { name: 'Identity Grid', path: 'contacts', icon: Icons.Users },
                { name: 'Brain Core', path: 'brain', icon: Icons.Brain },
                { name: 'Groups Matrix', path: 'groups', icon: Icons.Groups },
                { name: 'Infrastructure', path: 'settings', icon: Icons.Settings },
                { name: 'Core Shell', path: 'command', icon: Icons.Terminal },
              ].map(nav => (
                <button key={nav.path} onClick={() => setActiveTab(nav.path)} className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm font-semibold transition-all ${activeTab === nav.path ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-50'}`}>
                  <div className="flex items-center gap-3"><nav.icon /><span>{nav.name}</span></div>
                  {nav.badge ? <span className="px-2 py-0.5 bg-rose-500 text-white text-[10px] rounded-full">{nav.badge}</span> : null}
                </button>
              ))}
            </nav>
          </aside>

          {/* Main Container */}
          <main className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
            <header className="h-[80px] bg-white border-b border-slate-200 px-10 flex items-center justify-between shrink-0 z-40">
              <div className="flex items-center gap-8">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Instance</span>
                  <select value={selectedInstance} onChange={(e) => setSelectedInstance(e.target.value === 'all' ? 'all' : parseInt(e.target.value))} className="bg-slate-100 border-none rounded-xl px-4 py-2 text-xs font-bold outline-none cursor-pointer">
                    <option value="all">📊 Unified</option><option value="1">📱 SA</option><option value="2">🌍 UAE</option>
                  </select>
                </div>
              </div>
              <div className="flex items-center gap-6">
                <div className="text-right">
                  <p className={`text-xs font-black uppercase flex items-center gap-2 ${isSimulationMode ? 'text-amber-500' : 'text-emerald-500'}`}>
                    <span className={`w-2 h-2 rounded-full ${isSimulationMode ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500'}`} />
                    {isSimulationMode ? 'Simulation Active' : 'STABLE'}
                  </p>
                  <p className="text-[9px] text-slate-400 font-mono mt-1">{baseUrl}</p>
                </div>
              </div>
            </header>

            <div className="flex-1 overflow-y-auto p-10 bg-[#F8FAFC]">

              {/* TAB: DASHBOARD */}
              {activeTab === 'dashboard' && (
                <div className="space-y-12 animate-in fade-in">
                  <div className="flex items-end justify-between">
                    <h2 className="text-4xl font-black tracking-tight italic">Intelligence Deck</h2>
                    <div className="flex gap-4">
                      <div className="px-6 py-4 bg-white border border-slate-200 rounded-2xl shadow-sm text-center">
                        <p className="text-[10px] font-black text-slate-400 uppercase">Tokens Burned</p>
                        <p className="text-xl font-black text-indigo-500">{costs.tokens.toLocaleString()}</p>
                      </div>
                      <div className="px-6 py-4 bg-white border border-slate-200 rounded-2xl shadow-sm text-center">
                        <p className="text-[10px] font-black text-slate-400 uppercase">Est. Cost</p>
                        <p className="text-xl font-black text-emerald-500">${costs.today.toFixed(3)}</p>
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-4 gap-6">
                    {[
                      { label: 'Total Groups', value: groups.length, icon: Icons.Groups, color: 'indigo' },
                      { label: 'Identities', value: contacts.length, icon: Icons.Users, color: 'emerald' },
                      { label: 'High Value Hits', value: aiQueue.length, icon: Icons.Inbox, color: 'rose' },
                      { label: 'Threshold', value: config.threshold, icon: Icons.Brain, color: 'amber' }
                    ].map((stat, i) => (
                      <div key={i} className="bg-white p-8 rounded-[32px] border border-slate-200 shadow-sm flex flex-col justify-between hover:scale-105 transition-all">
                        <div className="flex items-center justify-between mb-4">
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{stat.label}</p>
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center bg-${stat.color}-50 text-${stat.color}-600`}><stat.icon /></div>
                        </div>
                        <p className="text-3xl font-black text-slate-900">{stat.value.toLocaleString()}</p>
                      </div>
                    ))}
                  </div>

                  {/* Social Intel Grid */}
                  <div className="grid grid-cols-2 gap-10">
                    <div className="bg-white rounded-[40px] border border-slate-200 p-8 space-y-6">
                      <h3 className="text-xl font-black flex items-center gap-2">🎂 Social Opportunities</h3>
                      <div className="space-y-4">
                        {birthdays.map(b => (
                          <div key={b.member_id} className="p-6 bg-slate-50 rounded-3xl flex items-center justify-between group">
                            <div className="flex items-center gap-4">
                              <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-xl shadow-sm">🧁</div>
                              <div>
                                <p className="font-bold">{b.name}</p>
                                <p className="text-[10px] text-slate-400 font-black uppercase">{b.birthday_date}</p>
                              </div>
                            </div>
                            <button onClick={() => sendEvolutionWhatsApp(b.phone_number || b.member_id, `Hey ${b.name}, happy birthday! Hope you have an amazing day.`)} className="px-5 py-2.5 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase hover:scale-105 transition-all">Send Wishes</button>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="bg-white rounded-[40px] border border-slate-200 p-8 space-y-6">
                      <h3 className="text-xl font-black flex items-center gap-2">💼 Recent Intelligence</h3>
                      <div className="space-y-4">
                        {linkedinActivity.map(p => (
                          <div key={p.post_id} className="p-6 bg-slate-50 rounded-3xl space-y-3">
                            <div className="flex items-center justify-between">
                              <p className="font-bold text-sm">{p.name}</p>
                              <span className="text-[10px] font-black text-slate-400 uppercase">{p.post_date}</span>
                            </div>
                            <p className="text-xs text-slate-600 italic">"{p.post_summary}"</p>
                            <div className="flex justify-between items-center mt-2">
                              <div className="text-[10px] font-black text-emerald-600 uppercase tracking-widest flex items-center gap-1">
                                <div className="w-1 h-1 bg-emerald-500 rounded-full" /> {p.engagement_opportunity}
                              </div>
                              <button onClick={() => goToContact(p.phone_number || p.name)} className="text-[9px] font-black text-indigo-500 uppercase hover:underline">View Profile</button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB: IDENTITY GRID */}
              {activeTab === 'contacts' && (
                <div className="h-full flex gap-10 animate-in slide-in-from-right-4">
                  <div className="w-[420px] bg-white rounded-[48px] border border-slate-200 shadow-sm flex flex-col overflow-hidden shrink-0">
                    <div className="p-10 border-b bg-slate-50/10">
                      <div className="flex p-2 bg-slate-100 rounded-3xl">
                        <button onClick={() => setCrmMode('known')} className={`flex-1 py-3 text-[10px] font-black uppercase rounded-2xl transition-all ${crmMode === 'known' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500'}`}>🎯 Leads</button>
                        <button onClick={() => setCrmMode('passive')} className={`flex-1 py-3 text-[10px] font-black uppercase rounded-2xl transition-all ${crmMode === 'passive' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500'}`}>📊 Pool</button>
                      </div>
                    </div>
                    <div className="flex-1 overflow-y-auto">
                      {contacts.filter(c => crmMode === 'known' ? c.enrichment : !c.enrichment).map(item => (
                        <div key={item.member_id} onClick={() => setSelectedEntity(item)} className={`p-8 border-b cursor-pointer hover:bg-slate-50 transition-all ${selectedEntity?.member_id === item.member_id ? 'bg-indigo-50 border-indigo-100' : ''}`}>
                          <div className="flex items-center gap-6">
                            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-white font-black text-xl ${item.enrichment ? 'bg-indigo-600 shadow-lg' : 'bg-slate-800'}`}>{item.display_name?.charAt(0) || 'U'}</div>
                            <div className="flex-1 truncate">
                              <p className="font-black text-slate-900 truncate">{item.display_name}</p>
                              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">{item.phone_number}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="flex-1 bg-white rounded-[48px] border border-slate-200 shadow-sm flex flex-col overflow-hidden">
                    {selectedEntity ? (
                      <div className="flex flex-col h-full animate-in fade-in">
                        <div className="p-12 border-b flex justify-between items-start bg-slate-50/20">
                          <div className="flex gap-10">
                            <div className="w-24 h-24 rounded-[32px] bg-white border flex items-center justify-center text-4xl font-black text-indigo-600 shadow-sm">{selectedEntity.display_name?.charAt(0) || 'U'}</div>
                            <div>
                              <h3 className="text-3xl font-black tracking-tighter">{selectedEntity.display_name}</h3>
                              <p className="text-xs text-slate-400 font-bold uppercase mt-2">{selectedEntity.phone_number}</p>
                              <div className="flex gap-2 mt-4"><Badge contact={selectedEntity} /></div>
                            </div>
                          </div>
                          <button onClick={() => enrichProfile(selectedEntity)} disabled={isEnriching} className="px-10 py-5 bg-indigo-600 text-white rounded-3xl text-[10px] font-black uppercase tracking-widest shadow-xl flex items-center gap-3 disabled:opacity-50">
                            {isEnriching ? <Icons.Sync className="animate-spin" /> : <Icons.Brain />} {isEnriching ? 'Scanning...' : 'Enrich Identity'}
                          </button>
                        </div>
                        <div className="flex-1 flex overflow-hidden">
                          <div className="flex-1 overflow-y-auto p-12 bg-slate-50/10 space-y-8 border-r">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Signal History</span>
                            {messages.filter(m => m.sender_id === selectedEntity.member_id).length > 0 ? messages.filter(m => m.sender_id === selectedEntity.member_id).map(m => (
                              <div key={m.id} className="max-w-[85%] p-6 bg-white border rounded-[32px] rounded-bl-none shadow-sm space-y-2">
                                <p className="text-sm font-semibold">{m.body}</p>
                                <p className="text-[9px] text-slate-300 uppercase font-black">{new Date(m.timestamp * 1000).toLocaleString()}</p>
                              </div>
                            )) : <p className="text-center py-20 text-xs text-slate-300 italic">No chat history recorded for this node.</p>}
                          </div>
                          <div className="w-[380px] p-10 shrink-0 space-y-10 overflow-y-auto">
                            <div className="space-y-4">
                              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Affiliated Clusters</p>
                              <div className="flex flex-wrap gap-2">
                                {selectedEntity.group_ids?.map((gid: any) => {
                                  const group = groups.find(g => g.group_id === gid || g.jid === gid);
                                  return (
                                    <span key={gid} className="px-3 py-1 bg-slate-100 rounded-lg text-[10px] font-bold text-slate-600 border">
                                      {group?.group_name || gid}
                                    </span>
                                  );
                                })}
                              </div>
                            </div>
                            <div className="space-y-4">
                              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Neural Identity</p>
                              {selectedEntity.enrichment ? (
                                <div className="space-y-6">
                                  <div className="p-8 bg-indigo-600 text-white rounded-[40px] shadow-xl">
                                    <p className="text-lg font-black italic">"{selectedEntity.enrichment.summary}"</p>
                                    <div className="flex gap-2 mt-6">
                                      <span className="px-3 py-1 bg-white/20 rounded-lg text-[9px] font-black uppercase">{selectedEntity.enrichment.role}</span>
                                      <span className="px-3 py-1 bg-white/20 rounded-lg text-[9px] font-black uppercase">{selectedEntity.enrichment.industry}</span>
                                    </div>
                                  </div>
                                </div>
                              ) : <div className="p-10 bg-slate-50 rounded-[40px] text-center text-xs text-slate-400 italic">No enrichment data.</div>}
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : <div className="flex-1 flex flex-col items-center justify-center opacity-30"><Icons.Users className="w-16 h-16" /><h3 className="text-2xl font-black mt-8 italic">Grid Unselected</h3></div>}
                  </div>
                </div>
              )}

              {/* TAB: BRAIN CORE */}
              {activeTab === 'brain' && (
                <div className="space-y-12 animate-in fade-in max-w-5xl mx-auto">
                  <div className="flex justify-between items-end">
                    <div><h2 className="text-4xl font-black tracking-tight italic">Intelligence Core</h2><p className="text-slate-500 font-semibold mt-2">Fine-tune the neural logic of your AI brain.</p></div>
                    <button onClick={() => { localStorage.setItem('nexus_config', JSON.stringify(config)); addLog('success', 'Brain committed.'); }} className="px-10 py-5 bg-indigo-600 text-white rounded-[24px] text-[10px] font-black uppercase shadow-xl hover:scale-105 transition-all">💾 Commit Heuristics</button>
                  </div>
                  <div className="grid grid-cols-2 gap-10">
                    <section className="bg-white rounded-[48px] border p-12 space-y-8 shadow-sm col-span-2">
                      <h3 className="text-2xl font-black flex items-center gap-3 text-indigo-600"><Icons.Brain /> Global Persona</h3>
                      <textarea value={config.persona} onChange={e => setConfig({ ...config, persona: e.target.value })} className="w-full h-40 bg-slate-50 border p-8 rounded-[32px] font-medium text-slate-700 outline-none focus:ring-4 focus:ring-indigo-100 transition-all resize-none" />
                    </section>
                    <section className="bg-white rounded-[48px] border p-12 space-y-8 shadow-sm">
                      <h3 className="text-2xl font-black flex items-center gap-3 text-emerald-600"><Icons.Sparkles /> Scoring Heuristics</h3>
                      <textarea value={config.scoringRules} onChange={e => setConfig({ ...config, scoringRules: e.target.value })} className="w-full h-80 bg-slate-50 border p-8 rounded-[32px] font-mono text-xs text-slate-600 outline-none focus:ring-4 focus:ring-emerald-100 transition-all resize-none" />
                    </section>
                    <section className="bg-white rounded-[48px] border p-12 space-y-8 shadow-sm">
                      <h3 className="text-2xl font-black flex items-center gap-3 text-amber-600"><Icons.Sync /> Auto-Deployment</h3>
                      <div className="space-y-8">
                        <div className="space-y-4">
                          <div className="flex justify-between"><label className="text-[10px] font-black uppercase text-slate-400">Triage Threshold</label><span className="text-2xl font-black text-indigo-600">{config.threshold}</span></div>
                          <input type="range" min="0" max="100" value={config.threshold} onChange={e => setConfig({ ...config, threshold: parseInt(e.target.value) })} className="w-full accent-indigo-600" />
                        </div>
                        <div className="space-y-4">
                          <label className="text-[10px] font-black uppercase text-slate-400">Drafting Style</label>
                          <textarea value={config.draftStyle} onChange={e => setConfig({ ...config, draftStyle: e.target.value })} className="w-full h-40 bg-slate-50 border p-8 rounded-[32px] font-medium text-slate-700 outline-none" />
                        </div>
                      </div>
                    </section>
                  </div>
                </div>
              )}

              {/* TAB: GROUPS MATRIX */}
              {activeTab === 'groups' && (
                <div className="space-y-12 animate-in fade-in h-full flex flex-col">
                  {!selectedGroup ? (
                    <>
                      <div className="flex justify-between items-end">
                        <div><h2 className="text-4xl font-black tracking-tight italic">Groups Matrix</h2><p className="text-slate-500 font-semibold mt-2">Correlating {groups.length} clusters.</p></div>
                        <button onClick={fetchEvolutionGroups} className="px-10 py-5 bg-slate-900 text-white rounded-[24px] text-[10px] font-black uppercase shadow-xl flex items-center gap-3"><Icons.Sync /> Restore Matrix JIDs</button>
                      </div>
                      <div className="grid grid-cols-2 gap-10">
                        {groups.map(g => (
                          <div key={g.group_id} onClick={() => setSelectedGroup(g)} className="bg-white rounded-[56px] border p-12 flex flex-col gap-10 hover:border-indigo-400 transition-all shadow-sm cursor-pointer group">
                            <div className="flex justify-between items-start">
                              <div className="space-y-4">
                                <h3 className="text-2xl font-black group-hover:text-indigo-600 transition-colors">{g.group_name}</h3>
                                <div className="flex gap-4 items-center">
                                  <span className="text-[10px] font-mono bg-slate-50 px-3 py-1 rounded-lg border">{g.jid || 'NO-JID'}</span>
                                  <span className="text-[10px] font-black text-indigo-600 uppercase">{g.member_count} Members</span>
                                </div>
                              </div>
                              <span className={`px-4 py-2 text-[10px] font-black uppercase rounded-2xl ${g.monitoring_enabled ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-50 text-slate-400'}`}>Live</span>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                              <button onClick={(e) => { e.stopPropagation(); fetchEvolutionMessages(g.jid); }} className="py-5 bg-emerald-50 text-emerald-600 rounded-[24px] text-[10px] font-black uppercase hover:bg-emerald-100 transition-all">🔄 History</button>
                              <button onClick={(e) => { e.stopPropagation(); fetchEvolutionMembers(g.jid); }} className="py-5 bg-indigo-50 text-indigo-600 rounded-24px text-10px font-black uppercase hover:bg-indigo-100 transition-all">📥 Participants</button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  ) : (
                    <div className="flex flex-col gap-10 h-full">
                      <button onClick={() => setSelectedGroup(null)} className="text-[10px] font-black text-indigo-600 uppercase flex items-center gap-2 hover:translate-x-[-4px] transition-all">← Back to Clusters</button>
                      <div className="bg-white rounded-[56px] border border-slate-200 shadow-sm flex flex-col flex-1 overflow-hidden">
                        <div className="p-10 bg-slate-50 border-b flex justify-between items-center">
                          <div className="space-y-2">
                            <h3 className="text-4xl font-black italic">{selectedGroup.group_name}</h3>
                            <p className="text-[10px] font-mono text-slate-400">{selectedGroup.jid}</p>
                          </div>
                          <div className="flex gap-4">
                            <button onClick={() => fetchEvolutionMessages(selectedGroup.jid)} className="px-6 py-3 bg-white border rounded-xl text-[10px] font-black uppercase shadow-sm">Sync History</button>
                            <button onClick={() => fetchEvolutionMembers(selectedGroup.jid)} className="px-6 py-3 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase shadow-sm">Sync Participants</button>
                          </div>
                        </div>
                        <div className="flex-1 flex overflow-hidden">
                          {/* Chat History Column */}
                          <div className="flex-1 overflow-y-auto p-12 space-y-6 border-r">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6">Latest Intelligence</p>
                            {messages.filter(m => m.group_id === selectedGroup.jid).length > 0 ? messages.filter(m => m.group_id === selectedGroup.jid).map(m => (
                              <div key={m.id} className="p-6 bg-slate-50 rounded-[32px] rounded-bl-none border border-slate-100">
                                <div className="flex justify-between items-start mb-2">
                                  <p className="text-xs font-black text-indigo-600 cursor-pointer hover:underline" onClick={() => goToContact(m.sender_id)}>{m.sender_name}</p>
                                  <p className="text-[9px] text-slate-300 font-bold uppercase">{new Date(m.timestamp * 1000).toLocaleTimeString()}</p>
                                </div>
                                <p className="text-sm font-medium">{m.body}</p>
                              </div>
                            )) : <p className="text-center py-20 text-xs text-slate-300 italic">No messages synced for this group yet.</p>}
                          </div>
                          {/* Participant Column */}
                          <div className="w-[380px] overflow-y-auto p-10 bg-slate-50/10">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6">Participant Matrix</p>
                            <div className="space-y-4">
                              {contacts.filter(c => c.group_ids?.includes(selectedGroup.jid) || c.group_ids?.includes(selectedGroup.group_id)).length > 0 ? contacts.filter(c => c.group_ids?.includes(selectedGroup.jid) || c.group_ids?.includes(selectedGroup.group_id)).map(c => (
                                <div key={c.member_id} onClick={() => goToContact(c.member_id)} className="p-5 bg-white border border-slate-100 rounded-3xl flex items-center gap-4 cursor-pointer hover:border-indigo-400 hover:shadow-sm transition-all">
                                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-white font-black text-sm ${c.enrichment ? 'bg-indigo-600' : 'bg-slate-800'}`}>{c.display_name.charAt(0)}</div>
                                  <div className="flex-1 truncate">
                                    <p className="text-sm font-black truncate">{c.display_name}</p>
                                    <p className="text-[9px] text-slate-400 font-bold uppercase">{c.phone_number}</p>
                                  </div>
                                </div>
                              )) : <p className="text-[10px] text-slate-400 italic">Click "Sync Participants" to populate.</p>}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* TAB: SETTINGS / INFRASTRUCTURE */}
              {activeTab === 'settings' && (
                <div className="max-w-4xl mx-auto space-y-12 animate-in fade-in">
                  <h2 className="text-4xl font-black tracking-tight italic">Infrastructure</h2>
                  <div className="grid gap-10">
                    <section className="bg-white rounded-[48px] border p-12 space-y-8 shadow-sm">
                      <h3 className="text-2xl font-black flex items-center gap-3"><Icons.Sync /> Evolution Bridge</h3>
                      <div className="p-6 bg-slate-50 rounded-[24px] border border-slate-100">
                        <p className="text-xs font-black uppercase text-slate-400 tracking-widest mb-2">Active Connection</p>
                        <p className="font-mono text-sm text-slate-600 break-all">{config.evolutionApiUrl || 'No API URL Configured'}</p>
                        <div className="flex gap-4 mt-4">
                          <span className="px-3 py-1 bg-indigo-100 text-indigo-600 rounded-lg text-[10px] font-black uppercase">Instance: {config.instanceName}</span>
                          {config.instanceName2 && <span className="px-3 py-1 bg-emerald-100 text-emerald-600 rounded-lg text-[10px] font-black uppercase">Instance 2: {config.instanceName2}</span>}
                        </div>
                      </div>
                    </section>
                    <section className="bg-white rounded-[48px] border p-12 space-y-8 shadow-sm">
                      <h3 className="text-2xl font-black flex items-center gap-3"><Icons.Brain /> AI Core</h3>
                      <div className="flex items-center gap-4 p-6 bg-slate-50 rounded-[24px] border border-slate-100">
                        <div className="w-12 h-12 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center"><Icons.Sparkles /></div>
                        <div>
                          <p className="text-xs font-black uppercase text-slate-400 tracking-widest">Active Model</p>
                          <p className="text-lg font-black text-slate-900">GPT-5 Mini (Next Gen)</p>
                        </div>
                      </div>
                    </section>
                    <button onClick={() => { localStorage.setItem('nexus_config', JSON.stringify(config)); addLog('success', 'Config updated.'); }} className="w-full py-8 bg-indigo-600 text-white rounded-[32px] text-xs font-black uppercase tracking-[0.4em] shadow-2xl hover:scale-[1.02] transition-all">💾 COMMIT INFRASTRUCTURE</button>
                  </div>
                </div>
              )}

              {/* TAB: CORE SHELL */}
              {activeTab === 'command' && (
                <div className="h-full flex flex-col space-y-10 animate-in fade-in">
                  <h2 className="text-4xl font-black tracking-tight italic">Nexus Core Shell</h2>
                  <div className="flex-1 bg-slate-950 rounded-[48px] border border-slate-800 shadow-2xl flex flex-col p-2 overflow-hidden">
                    <div className="p-8 border-b border-slate-800 flex justify-between">
                      <div className="flex gap-2"><div className="w-3 h-3 rounded-full bg-rose-500" /><div className="w-3 h-3 rounded-full bg-amber-500" /><div className="w-3 h-3 rounded-full bg-emerald-500" /></div>
                      <span className="text-[10px] font-black text-white/40 uppercase tracking-widest">HYBRID-MATRIX-{config.aiProvider}</span>
                    </div>
                    <div className="flex-1 overflow-y-auto p-10 font-mono text-[11px] space-y-6">
                      {logs.map(log => (
                        <div key={log.id} className="flex gap-6">
                          <span className="text-slate-600">[{new Date(log.id).toLocaleTimeString()}]</span>
                          <span className={`uppercase font-black ${log.type === 'error' ? 'text-rose-400' : log.type === 'ai' ? 'text-indigo-400' : 'text-emerald-400'}`}>{log.type}:</span>
                          <span className="text-slate-300">{log.text}</span>
                        </div>
                      ))}
                      <div className="flex gap-6"><span className="text-slate-600">[{new Date().toLocaleTimeString()}]</span><span className="text-indigo-400 uppercase font-black">SYSTEM:</span><span className="text-slate-300 animate-pulse">Monitoring signals...</span></div>
                    </div>
                  </div>
                </div>
              )}

              {/* AI INBOX */}
              {activeTab === 'inbox' && (
                <div className="space-y-10 max-w-5xl mx-auto animate-in fade-in pb-20">
                  <h2 className="text-4xl font-black tracking-tight italic">Triage Center</h2>
                  {aiQueue.length === 0 ? <div className="p-40 text-center opacity-30 italic font-black text-2xl">SCANNING MATRIX...</div> : aiQueue.map(msg => (
                    <div key={msg.id} className="bg-white rounded-[40px] border p-12 shadow-sm border-l-8 border-l-indigo-600 space-y-8">
                      <div className="flex justify-between items-start">
                        <div className="space-y-2">
                          <h3 className="text-2xl font-black cursor-pointer hover:text-indigo-600" onClick={() => goToContact(msg.sender_id)}>{msg.sender_name}</h3>
                          <p className="text-xs text-slate-400 font-bold uppercase">{msg.group_name || 'Signal Matrix'}</p>
                        </div>
                        <span className="px-5 py-2 bg-indigo-50 text-indigo-600 rounded-xl text-xs font-black uppercase tracking-widest shadow-sm">Value: {msg.value_score}</span>
                      </div>
                      <p className="text-xl font-medium text-slate-600 italic border-l-4 border-indigo-200 pl-6 bg-slate-50/50 py-4 rounded-r-xl">"{msg.message_body}"</p>
                      <div className="p-8 bg-slate-50 rounded-[32px] border border-slate-100">
                        <p className="text-[10px] font-black text-indigo-400 uppercase mb-4">Neural Reasoning</p>
                        <p className="text-xs font-bold text-slate-700 leading-relaxed mb-8">{msg.reasoning}</p>
                        <div className="grid grid-cols-2 gap-8">
                          <div className="space-y-4">
                            <div className="flex items-center justify-between"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">📱 Group Draft</label></div>
                            <textarea className="w-full h-32 bg-slate-900 text-emerald-400 p-6 rounded-[24px] font-mono text-xs outline-none border-2 border-slate-800" defaultValue={msg.group_draft} />
                            <button onClick={async () => await sendEvolutionWhatsApp(msg.group_jid || msg.sender_id, msg.group_draft)} className="w-full py-4 bg-blue-600 text-white rounded-[20px] text-[10px] font-black uppercase tracking-[0.2em] shadow-lg hover:scale-[1.02] transition-all">🚀 Deploy Group</button>
                          </div>
                          <div className="space-y-4">
                            <div className="flex items-center justify-between"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">👤 Personal DM</label></div>
                            <textarea className="w-full h-32 bg-slate-900 text-purple-300 p-6 rounded-[24px] font-mono text-xs outline-none border-2 border-slate-800" defaultValue={msg.dm_draft} />
                            <button onClick={async () => { if (await sendEvolutionWhatsApp(msg.sender_id, msg.dm_draft)) setAiQueue(prev => prev.filter(q => q.id !== msg.id)); }} className="w-full py-4 bg-indigo-600 text-white rounded-[20px] text-[10px] font-black uppercase tracking-[0.2em] shadow-lg hover:scale-[1.02] transition-all">🚀 Deploy Private DM</button>
                          </div>
                        </div>
                        <div className="mt-8 flex justify-center"><button onClick={() => setAiQueue(prev => prev.filter(q => q.id !== msg.id))} className="px-8 py-3 text-slate-400 hover:text-rose-500 text-[10px] font-black uppercase tracking-widest transition-all">Archive Signal</button></div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

            </div>
          </main>
        </div>
      );
};

      const root = createRoot(document.getElementById('root')!);
      root.render(<App />);
