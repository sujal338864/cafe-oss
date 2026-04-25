'use client';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTheme } from '@/context/ThemeContext';
import { toast } from 'react-hot-toast';
import api from '@/lib/api';

export default function MarketingStudio() {
  const { theme } = useTheme();
  
  const [activeTab, setActiveTab] = useState<'brain' | 'brand' | 'caption' | 'poster' | 'reel' | 'review' | 'segments' | 'email'>('brain');
  
  // States
  const [prompt, setPrompt] = useState('');
  const [language, setLanguage] = useState('English');
  const [tone, setTone] = useState('Polite');

  // Brand Identity States
  const [brandType, setBrandType] = useState('PREMIUM_CAFE');
  const [brandTone, setBrandTone] = useState('PROFESSIONAL');
  const [primaryColor, setPrimaryColor] = useState('#000000');
  
  // Email Campaign States
  const [emailSubject, setEmailSubject] = useState('');
  const [emailHtml, setEmailHtml] = useState('');
  const [emailTarget, setEmailTarget] = useState('VIP');
  
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const generate = async () => {
    if (!prompt.trim() && activeTab !== 'review') return;
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      let res;
      if (activeTab === 'caption') {
        res = await api.post('/api/marketing/generate/caption', { prompt, language });
      } else if (activeTab === 'poster') {
        res = await api.post('/api/marketing/generate/poster', { prompt });
      } else if (activeTab === 'reel') {
        res = await api.post('/api/marketing/generate/reel', { prompt });
      } else {
        res = await api.post('/api/marketing/generate/review', { tone });
      }
      
      if (res.data.error) throw new Error(res.data.error);
      setResult(res.data.text);
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Generation failed');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = () => {
    if (result) {
      navigator.clipboard.writeText(result);
      toast.success('Copied to clipboard!');
    }
  };

  const { data: segData, isLoading: loadingSegs } = useQuery({
    queryKey: ['marketing-segments'],
    queryFn: () => api.get('/api/marketing/segments').then(r => r.data),
    staleTime: 60000,
  });

  const { data: brainData, isLoading: loadingBrain, refetch: refetchBrain } = useQuery({
    queryKey: ['marketing-intel-today'],
    queryFn: () => api.get('/api/marketing/intel/today').then(r => r.data.intel),
  });

  const forceBrainSync = async () => {
    setLoading(true);
    try {
      await api.post('/api/marketing/intel/force');
      await refetchBrain();
      toast.success('AI Brain updated!');
    } catch (e) {
      toast.error('Failed to run AI Brain.');
    } finally {
      setLoading(false);
    }
  };

  const { data: brandData, isLoading: loadingBrand, refetch: refetchBrand } = useQuery({
    queryKey: ['brand-profile'],
    queryFn: () => api.get('/api/marketing/brand').then(r => {
      if (r.data?.profile) {
        setBrandType(r.data.profile.brandType);
        setBrandTone(r.data.profile.toneOfVoice);
        setPrimaryColor(r.data.profile.primaryColor);
      }
      return r.data;
    })
  });

  const saveBrandProfile = async () => {
    setLoading(true); setError(null);
    try {
      await api.put('/api/marketing/brand', { brandType, toneOfVoice: brandTone, primaryColor });
      toast.success('Brand Identity Saved! AI will match this style.');
    } catch (e: any) {
      setError('Failed to save brand profile');
    } finally {
      setLoading(false);
    }
  };

  const segmentsList = [
    { id: 'VIP', label: 'VIP Customers', desc: 'Big spenders with frequent orders.', icon: '👑', color: '#f59e0b', count: segData?.counts?.VIP },
    { id: 'FREQUENT', label: 'Frequent Visitors', desc: 'Ordered 3+ times recently.', icon: '🔥', color: '#ef4444', count: segData?.counts?.FREQUENT },
    { id: 'NEW', label: 'New Customers', desc: 'Joined in the last 14 days.', icon: '🌱', color: '#10b981', count: segData?.counts?.NEW },
    { id: 'HIGH_SPENDER', label: 'High Spenders', desc: 'Total spend over ₹5,000.', icon: '💎', color: '#3b82f6', count: segData?.counts?.HIGH_SPENDER },
    { id: 'INACTIVE_30D', label: 'Slipping Away', desc: 'Ordered previously but not in 30 days.', icon: '⚠️', color: '#f97316', count: segData?.counts?.INACTIVE_30D },
    { id: 'INACTIVE_60D', label: 'Lost Customers', desc: 'No orders in over 60 days.', icon: '👻', color: '#6b7280', count: segData?.counts?.INACTIVE_60D },
  ];

  const { data: campaignData, refetch: refetchCampaigns } = useQuery({
    queryKey: ['campaigns'],
    queryFn: () => api.get('/api/marketing/campaigns').then(r => r.data),
    enabled: activeTab === 'email'
  });

  const sendEmailCampaign = async () => {
    if (!emailSubject.trim() || !emailHtml.trim()) {
      toast.error('Subject and Body are required');
      return;
    }
    setLoading(true); setError(null);
    try {
      await api.post('/api/marketing/campaigns/send', {
        name: `Campaign: ${emailSubject}`,
        targetSegment: emailTarget,
        subject: emailSubject,
        htmlContent: emailHtml
      });
      toast.success('Campaign queued successfully! 🚀');
      setEmailSubject(''); setEmailHtml('');
      refetchCampaigns();
    } catch (e: any) {
      setError(e.response?.data?.error || 'Failed to dispatch campaign');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '24px 32px', maxWidth: 1000, margin: '0 auto' }}>
      
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 28, fontWeight: 900, color: theme.text, margin: '0 0 8px 0', display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 32 }}>✨</span> Marketing Studio
        </h1>
        <p style={{ color: theme.textFaint, fontSize: 15, margin: 0 }}>
          Generate engaging content, captions, and offers powered by AI.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(250px, 300px) 1fr', gap: 24 }}>
        
        {/* Left Sidebar - Navigation */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <button
            onClick={() => { setActiveTab('brain'); setResult(null); setError(null); }}
            style={{ padding: 16, textAlign: 'left', borderRadius: 12, background: activeTab === 'brain' ? 'rgba(124,58,237,0.1)' : theme.card, border: `1px solid ${activeTab === 'brain' ? '#7c3aed' : theme.border}`, color: theme.text, cursor: 'pointer', transition: 'all 0.2s', marginBottom: 16 }}
          >
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>⚡ AI Marketing Brain</div>
            <div style={{ fontSize: 13, color: theme.textFaint }}>Your daily auto-generated growth plan.</div>
          </button>

          <button
            onClick={() => { setActiveTab('brand'); setResult(null); setError(null); }}
            style={{ padding: 16, textAlign: 'left', borderRadius: 12, background: activeTab === 'brand' ? 'rgba(124,58,237,0.1)' : theme.card, border: `1px solid ${activeTab === 'brand' ? '#7c3aed' : theme.border}`, color: theme.text, cursor: 'pointer', transition: 'all 0.2s', marginBottom: 16 }}
          >
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>🧠 Brand Identity</div>
            <div style={{ fontSize: 13, color: theme.textFaint }}>Set your cafe's AI personality and style.</div>
          </button>

          <button
            onClick={() => { setActiveTab('caption'); setResult(null); setError(null); }}
            style={{ padding: 16, textAlign: 'left', borderRadius: 12, background: activeTab === 'caption' ? 'rgba(124,58,237,0.1)' : theme.card, border: `1px solid ${activeTab === 'caption' ? '#7c3aed' : theme.border}`, color: theme.text, cursor: 'pointer', transition: 'all 0.2s' }}
          >
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>📸 Instagram Caption</div>
            <div style={{ fontSize: 13, color: theme.textFaint }}>Generate engaging post captions with hashtags.</div>
          </button>
          
          <button
            onClick={() => { setActiveTab('poster'); setResult(null); setError(null); }}
            style={{ padding: 16, textAlign: 'left', borderRadius: 12, background: activeTab === 'poster' ? 'rgba(124,58,237,0.1)' : theme.card, border: `1px solid ${activeTab === 'poster' ? '#7c3aed' : theme.border}`, color: theme.text, cursor: 'pointer', transition: 'all 0.2s' }}
          >
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>🎨 Poster Text</div>
            <div style={{ fontSize: 13, color: theme.textFaint }}>Catchy 3-line copy for digital flyers and banners.</div>
          </button>

          <button
            onClick={() => { setActiveTab('reel'); setResult(null); setError(null); }}
            style={{ padding: 16, textAlign: 'left', borderRadius: 12, background: activeTab === 'reel' ? 'rgba(124,58,237,0.1)' : theme.card, border: `1px solid ${activeTab === 'reel' ? '#7c3aed' : theme.border}`, color: theme.text, cursor: 'pointer', transition: 'all 0.2s' }}
          >
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>🎬 Reel / Video Ideas</div>
            <div style={{ fontSize: 13, color: theme.textFaint }}>Generate viral video hooks, scripts & shot lists.</div>
          </button>

          <button
            onClick={() => { setActiveTab('review'); setResult(null); setError(null); }}
            style={{ padding: 16, textAlign: 'left', borderRadius: 12, background: activeTab === 'review' ? 'rgba(124,58,237,0.1)' : theme.card, border: `1px solid ${activeTab === 'review' ? '#7c3aed' : theme.border}`, color: theme.text, cursor: 'pointer', transition: 'all 0.2s' }}
          >
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>⭐ Review Request</div>
            <div style={{ fontSize: 13, color: theme.textFaint }}>Polite WhatsApp/SMS templates to get Google reviews.</div>
          </button>
          
          <button
            onClick={() => { setActiveTab('segments'); setResult(null); setError(null); }}
            style={{ padding: 16, textAlign: 'left', borderRadius: 12, background: activeTab === 'segments' ? 'rgba(124,58,237,0.1)' : theme.card, border: `1px solid ${activeTab === 'segments' ? '#7c3aed' : theme.border}`, color: theme.text, cursor: 'pointer', transition: 'all 0.2s', marginTop: 16 }}
          >
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>🎯 Smart Segments</div>
            <div style={{ fontSize: 13, color: theme.textFaint }}>Auto-generated customer lists for targeting.</div>
          </button>

          <button
            onClick={() => { setActiveTab('email'); setResult(null); setError(null); }}
            style={{ padding: 16, textAlign: 'left', borderRadius: 12, background: activeTab === 'email' ? 'rgba(124,58,237,0.1)' : theme.card, border: `1px solid ${activeTab === 'email' ? '#7c3aed' : theme.border}`, color: theme.text, cursor: 'pointer', transition: 'all 0.2s', marginTop: 16 }}
          >
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>📧 Email Campaigns</div>
            <div style={{ fontSize: 13, color: theme.textFaint }}>Send 1-click bulk emails to smart segments.</div>
          </button>
        </div>

        {/* Right Section - Main Form & Output */}
        <div style={{ background: theme.card, border: `1px solid ${theme.border}`, borderRadius: 16, padding: '24px 32px' }}>
          
          <h2 style={{ fontSize: 20, fontWeight: 800, color: theme.text, marginBottom: 24, paddingBottom: 16, borderBottom: `1px solid ${theme.border}` }}>
            {activeTab === 'brain' && '🧠 Daily Marketing Plan'}
            {activeTab === 'brand' && 'Configure AI Brand Identity'}
            {activeTab === 'caption' && 'Generate Instagram Caption'}
            {activeTab === 'poster' && 'Generate Poster Text'}
            {activeTab === 'reel' && 'Generate Viral Reel Idea'}
            {activeTab === 'review' && 'Generate Review Request'}
            {activeTab === 'segments' && 'Customer Segments'}
            {activeTab === 'email' && 'Email Campaigns Manager'}
          </h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 20, marginBottom: 32 }}>

            {activeTab === 'brain' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <p style={{ color: theme.textFaint, fontSize: 14 }}>The AI Marketing Brain scans your customer data every night and generates a targeted plan for the day.</p>
                
                {loadingBrain ? (
                  <div style={{ padding: 20, textAlign: 'center', color: theme.textFaint }}>Analyzing your cafe's data...</div>
                ) : brainData ? (
                  <div style={{ background: 'rgba(124,58,237,0.05)', border: '1px solid #7c3aed', borderRadius: 12, padding: 20 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                      <div style={{ fontSize: 18, fontWeight: 800, color: '#7c3aed' }}>Today's Focus: {brainData.keyFocus}</div>
                      <div style={{ fontSize: 12, color: theme.textFaint }}>Generated: {new Date(brainData.date).toLocaleDateString()}</div>
                    </div>
                    <div style={{ whiteSpace: 'pre-wrap', color: theme.text, fontSize: 15, lineHeight: 1.6, marginBottom: 20 }}>
                      {brainData.planText}
                    </div>
                    <div style={{ background: theme.bg, padding: 12, borderRadius: 8 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8, color: theme.text }}>Immediate Action Items:</div>
                      {brainData.actionItems.map((item: string, i: number) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, color: theme.text, marginBottom: 6 }}>
                          <span>✅</span> {item}
                        </div>
                      ))}
                    </div>
                    <div style={{ marginTop: 20, display: 'flex', gap: 10 }}>
                      <button onClick={forceBrainSync} disabled={loading} style={{ background: theme.bg, border: `1px solid ${theme.border}`, padding: '8px 16px', borderRadius: 6, color: theme.text, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
                        {loading ? 'Thinking...' : '🔄 Run Brain Again'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div style={{ textAlign: 'center', padding: 40, background: theme.bg, borderRadius: 12, border: `1px dashed ${theme.border}` }}>
                    <div style={{ fontSize: 40, marginBottom: 16 }}>😴</div>
                    <h3 style={{ fontSize: 16, color: theme.text, marginBottom: 8 }}>The Brain is Asleep</h3>
                    <p style={{ fontSize: 14, color: theme.textFaint, marginBottom: 24 }}>No marketing plan found for today. The brain runs every night at 2:00 AM.</p>
                    <button onClick={forceBrainSync} disabled={loading} style={{ background: '#7c3aed', color: 'white', padding: '10px 20px', borderRadius: 8, border: 'none', fontWeight: 600, cursor: 'pointer' }}>
                      {loading ? 'Generating...' : '⚡ Wake the Brain Up Now'}
                    </button>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'brand' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <p style={{ color: theme.textFaint, fontSize: 14 }}>The AI Marketing Brain will use these settings to ensure all generated captions, posters, and plans perfectly match your shop's specific look and feel.</p>
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: theme.text, marginBottom: 8 }}>Vibe / Business Model</label>
                  <select value={brandType} onChange={e => setBrandType(e.target.value)} style={{ width: '100%', background: theme.bg, border: `1px solid ${theme.border}`, borderRadius: 8, padding: '10px 12px', color: theme.text, fontSize: 14 }}>
                    <option value="PREMIUM_CAFE">Premium / High-End Cafe</option>
                    <option value="YOUTH">Trendy / Youth / College Cafe</option>
                    <option value="FAMILY">Family Restaurant</option>
                    <option value="BUDGET">Budget / Quick Snack Vendor</option>
                    <option value="LUXURY">Luxury Dining</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: theme.text, marginBottom: 8 }}>Tone of Voice</label>
                  <select value={brandTone} onChange={e => setBrandTone(e.target.value)} style={{ width: '100%', background: theme.bg, border: `1px solid ${theme.border}`, borderRadius: 8, padding: '10px 12px', color: theme.text, fontSize: 14 }}>
                    <option value="PROFESSIONAL">Professional & Polite</option>
                    <option value="CASUAL">Casual & Friendly</option>
                    <option value="GENZ">Slang / Gen-Z (Fun)</option>
                    <option value="WITTY">Witty & Sarcastic</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: theme.text, marginBottom: 8 }}>Brand Primary Color</label>
                  <input type="color" value={primaryColor} onChange={e => setPrimaryColor(e.target.value)} style={{ width: 100, height: 40, padding: 0, border: 'none', borderRadius: 8, cursor: 'pointer' }} />
                </div>
                <button onClick={saveBrandProfile} disabled={loading} style={{ marginTop: 12, padding: '12px 24px', background: '#7c3aed', color: 'white', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 15, cursor: loading ? 'not-allowed' : 'pointer' }}>
                  {loading ? 'Saving...' : '💾 Save Brand Identity'}
                </button>
              </div>
            )}
            
            {(activeTab === 'caption' || activeTab === 'poster' || activeTab === 'reel') && (
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: theme.text, marginBottom: 8 }}>
                  What is the post/poster about?
                </label>
                <textarea 
                  value={prompt}
                  onChange={e => setPrompt(e.target.value)}
                  placeholder="e.g. Wednesday Special Buy 1 Get 1 Free on all milkshakes!"
                  style={{ width: '100%', height: 100, background: theme.bg, border: `1px solid ${theme.border}`, borderRadius: 8, padding: 12, color: theme.text, fontSize: 14, fontFamily: 'inherit', resize: 'vertical' }}
                />
              </div>
            )}

            {activeTab === 'caption' && (
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: theme.text, marginBottom: 8 }}>Language</label>
                <select value={language} onChange={e => setLanguage(e.target.value)} style={{ width: '100%', background: theme.bg, border: `1px solid ${theme.border}`, borderRadius: 8, padding: '10px 12px', color: theme.text, fontSize: 14 }}>
                  <option value="English">English</option>
                  <option value="Hindi">Hindi</option>
                  <option value="Gujarati">Gujarati</option>
                  <option value="Hinglish">Hinglish</option>
                </select>
              </div>
            )}

            {activeTab === 'review' && (
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: theme.text, marginBottom: 8 }}>Tone</label>
                <select value={tone} onChange={e => setTone(e.target.value)} style={{ width: '100%', background: theme.bg, border: `1px solid ${theme.border}`, borderRadius: 8, padding: '10px 12px', color: theme.text, fontSize: 14 }}>
                  <option value="Polite">Polite & Professional</option>
                  <option value="Casual">Casual & Friendly</option>
                  <option value="Enthusiastic">Enthusiastic & Excited</option>
                </select>
              </div>
            )}
            
            {/* AI Generator Button */}
            {(activeTab === 'caption' || activeTab === 'poster' || activeTab === 'reel' || activeTab === 'review') && (
              <button
                onClick={generate}
                disabled={loading || (!prompt.trim() && activeTab !== 'review')}
                style={{ padding: '12px 24px', background: '#7c3aed', color: 'white', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 15, cursor: (loading || (!prompt.trim() && activeTab !== 'review')) ? 'not-allowed' : 'pointer', opacity: (loading || (!prompt.trim() && activeTab !== 'review')) ? 0.7 : 1, width: '100%' }}
              >
                {loading ? 'Generating...' : '✨ Generate Now'}
              </button>
            )}

            {/* Email Form */}
            {activeTab === 'email' && (
              <div>
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16, marginBottom: 16 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: theme.text, marginBottom: 8 }}>Email Subject *</label>
                    <input value={emailSubject} onChange={e => setEmailSubject(e.target.value)} placeholder="e.g. 50% Off VIP Exclusive!" style={{ width: '100%', background: theme.bg, border: `1px solid ${theme.border}`, borderRadius: 8, padding: '10px 12px', color: theme.text, fontSize: 14 }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: theme.text, marginBottom: 8 }}>Target Audience</label>
                    <select value={emailTarget} onChange={e => setEmailTarget(e.target.value)} style={{ width: '100%', background: theme.bg, border: `1px solid ${theme.border}`, borderRadius: 8, padding: '10px 12px', color: theme.text, fontSize: 14 }}>
                      {segmentsList.map(s => <option key={s.id} value={s.id}>{s.label} ({s.count || 0})</option>)}
                    </select>
                  </div>
                </div>

                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: theme.text, marginBottom: 8 }}>Email Body (HTML supported) *</label>
                  <textarea value={emailHtml} onChange={e => setEmailHtml(e.target.value)} placeholder="Hello {{name}}, we have a special gift..." style={{ width: '100%', height: 160, background: theme.bg, border: `1px solid ${theme.border}`, borderRadius: 8, padding: 12, color: theme.text, fontSize: 14, fontFamily: 'monospace', resize: 'vertical' }} />
                </div>

                <button onClick={sendEmailCampaign} disabled={loading || !emailSubject} style={{ width: '100%', padding: '12px', background: '#10b981', color: 'white', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 15, cursor: loading ? 'not-allowed' : 'pointer' }}>
                  {loading ? 'Queuing Campaign...' : '🚀 Dispatch Email Campaign'}
                </button>

                {/* Campaign History */}
                <div style={{ marginTop: 40, borderTop: `1px solid ${theme.border}`, paddingTop: 20 }}>
                  <h3 style={{ fontSize: 16, fontWeight: 800, color: theme.text, marginBottom: 16 }}>Broadcast History</h3>
                  {campaignData?.campaigns?.length === 0 ? (
                    <div style={{ color: theme.textFaint, fontSize: 13 }}>No email campaigns dispatched yet.</div>
                  ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                      <thead>
                        <tr>
                          <th style={{ textAlign: 'left', paddingBottom: 10, color: theme.textFaint }}>Subject</th>
                          <th style={{ textAlign: 'left', paddingBottom: 10, color: theme.textFaint }}>Target</th>
                          <th style={{ textAlign: 'left', paddingBottom: 10, color: theme.textFaint }}>Status</th>
                          <th style={{ textAlign: 'left', paddingBottom: 10, color: theme.textFaint }}>Sent</th>
                        </tr>
                      </thead>
                      <tbody>
                        {campaignData?.campaigns?.map((c: any) => (
                          <tr key={c.id} style={{ borderTop: `1px solid ${theme.border}` }}>
                            <td style={{ padding: '12px 0', color: theme.text, fontWeight: 600 }}>{c.name}</td>
                            <td style={{ padding: '12px 0', color: theme.textMuted }}>{c.targetSegment}</td>
                            <td style={{ padding: '12px 0', color: c.status === 'COMPLETED' ? '#10b981' : '#f59e0b', fontWeight: 800 }}>{c.status}</td>
                            <td style={{ padding: '12px 0', color: theme.text }}>{c.sentCount}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            )}
          </div>

          {activeTab === 'segments' && (
            <div>
              <p style={{ fontSize: 14, color: theme.textFaint, marginBottom: 20 }}>
                These are real-time, zero-effort audiences built automatically from your checkout data. You can copy the phone numbers of these segments right from the Customers tab to send them the campaigns you just generated!
              </p>
              
              {loadingSegs ? (
                <div style={{ color: theme.textFaint, fontSize: 14 }}>Loading segments...</div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16 }}>
                  {segmentsList.map(s => (
                    <div key={s.id} style={{ padding: 16, border: `1px solid ${theme.border}`, borderRadius: 12, background: theme.bg }}>
                      <div style={{ fontSize: 24, marginBottom: 8 }}>{s.icon}</div>
                      <div style={{ fontSize: 14, fontWeight: 800, color: theme.text, marginBottom: 4 }}>{s.label}</div>
                      <div style={{ fontSize: 12, color: theme.textFaint, marginBottom: 12, minHeight: 36 }}>{s.desc}</div>
                      <div style={{ fontSize: 22, fontWeight: 900, color: s.color }}>
                        {s.count || 0} <span style={{ fontSize: 12, fontWeight: 600, color: theme.textFaint }}>customers</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Results Area */}
          {error && (
            <div style={{ padding: 16, background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', borderRadius: 8, fontSize: 14, fontWeight: 600, marginBottom: 20 }}>
              {error}
            </div>
          )}

          {result && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <h3 style={{ fontSize: 15, fontWeight: 800, color: theme.text, margin: 0 }}>Generated Result:</h3>
                <button onClick={copyToClipboard} style={{ background: 'transparent', border: `1px solid ${theme.border}`, color: theme.text, padding: '4px 12px', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                  Copy Text
                </button>
              </div>
              <div style={{ background: theme.bg, border: `1px solid ${theme.border}`, borderRadius: 8, padding: 16, whiteSpace: 'pre-wrap', color: theme.text, fontSize: 15, lineHeight: 1.5, fontFamily: activeTab === 'poster' ? 'monospace' : 'inherit' }}>
                {result}
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
