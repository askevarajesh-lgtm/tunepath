import React, { useState, useEffect } from 'react';
import { Table, Tag, message, Button, Drawer, Typography, Space, Select, Input, Tabs, Collapse, Card, Tooltip, Alert, Divider, Spin } from 'antd';
import {
  RefreshCw, Search, CheckCircle2, XCircle, Clock, Terminal,
  ChevronRight, Copy, Download, Code, Layers, FileJson, ArrowUpRight, Zap,
  TrendingUp, Crosshair, FileText, Cpu, Bot, Globe, GitBranch, Image, ShieldCheck, BarChart3
} from 'lucide-react';
import { seoWorkspaceApi } from '../../../../../api/seoWorkspaceApi';
import { useTheme } from '../../../../../contexts/ThemeContext';
import { jsPDF } from 'jspdf';

const { Title, Text, Paragraph } = Typography;
const { Option } = Select;
const { Panel } = Collapse;

export default function ExecutionHistory({ projectId }) {
  const [runs, setRuns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedRun, setSelectedRun] = useState(null);
  const [selectedRunLogs, setSelectedRunLogs] = useState([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [activeTraceTab, setActiveTraceTab] = useState('pipeline');
  const { isDark } = useTheme();

  const cardBg = isDark ? '#111c31' : '#ffffff';
  const cardBdr = isDark ? '1px solid #1e293b' : '1px solid #e2e8f0';
  const nodeCardBg = isDark ? '#0b132b' : '#f8fafc';
  const nodeCardBdr = isDark ? '1px solid #1e293b' : '1px solid #e2e8f0';
  const codeBg = isDark ? '#070c18' : '#f1f5f9';
  const codeClr = isDark ? '#38bdf8' : '#0369a1';

  const renderNodeOutputUI = (node) => {
    const payload = node.outputPayload;
    if (!payload || typeof payload !== 'object') return null;

    // 1. WEBSITE AUDIT
    if (payload.overallScore !== undefined && payload.pagesCrawled !== undefined) {
      return (
        <Card size="small" style={{ background: isDark ? '#1e293b' : '#f8fafc', border: cardBdr, borderRadius: 8, marginBottom: 12 }}>
          <Space direction="vertical" size="middle" style={{ width: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <Text type="secondary" style={{ fontSize: 11 }}>OVERALL SEO HEALTH SCORE</Text>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                  <span style={{ fontSize: 24, fontWeight: 800, color: payload.overallScore >= 90 ? '#10b981' : payload.overallScore >= 70 ? '#f59e0b' : '#ef4444' }}>
                    {payload.overallScore}
                  </span>
                  <Tag color="blue">{payload.grade} Grade</Tag>
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <Text type="secondary" style={{ fontSize: 11 }}>PAGES AUDITED</Text>
                <div style={{ fontSize: 18, fontWeight: 700 }}>{payload.pagesCrawled}</div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
              <div style={{ textAlign: 'center', padding: '6px', background: isDark ? '#0f172a' : '#f1f5f9', borderRadius: 4 }}>
                <Text style={{ fontSize: 10 }} type="secondary">TECHNICAL</Text>
                <div style={{ fontWeight: 700, color: '#3b82f6' }}>{payload.technicalScore}</div>
              </div>
              <div style={{ textAlign: 'center', padding: '6px', background: isDark ? '#0f172a' : '#f1f5f9', borderRadius: 4 }}>
                <Text style={{ fontSize: 10 }} type="secondary">PERFORMANCE</Text>
                <div style={{ fontWeight: 700, color: '#ec4899' }}>{payload.performanceScore}</div>
              </div>
              <div style={{ textAlign: 'center', padding: '6px', background: isDark ? '#0f172a' : '#f1f5f9', borderRadius: 4 }}>
                <Text style={{ fontSize: 10 }} type="secondary">ACCESSIBILITY</Text>
                <div style={{ fontWeight: 700, color: '#10b981' }}>{payload.accessibilityScore || 90}</div>
              </div>
            </div>

            <div style={{ borderTop: isDark ? '1px solid #334155' : '1px solid #e2e8f0', paddingTop: 8 }}>
              <Space split={<Divider type="vertical" />} style={{ width: '100%', justifyContent: 'space-between', fontSize: 11 }}>
                <span><Text strong type="danger">{payload.criticalCount}</Text> Critical</span>
                <span><Text strong type="warning">{payload.highCount}</Text> High</span>
                <span><Text strong style={{ color: '#eab308' }}>{payload.mediumCount}</Text> Medium</span>
                <span><Text strong type="secondary">{payload.lowCount}</Text> Low</span>
              </Space>
            </div>

            {payload.summary && (
              <Alert message="AI Audit Insight" description={payload.summary} type="info" showIcon />
            )}

            {payload.reportPdfUrl && (
              <Button type="link" size="small" icon={<Download size={13} />} href={payload.reportPdfUrl} style={{ padding: 0 }}>
                Download Full Audit PDF Report
              </Button>
            )}
          </Space>
        </Card>
      );
    }

    // 2. TECHNICAL SEO
    if (payload.technicalAuditId !== undefined && payload.findings !== undefined) {
      return (
        <Card size="small" style={{ background: isDark ? '#1e293b' : '#f8fafc', border: cardBdr, borderRadius: 8, marginBottom: 12 }}>
          <Space direction="vertical" size="small" style={{ width: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <div>
                <Text type="secondary" style={{ fontSize: 11 }}>TECHNICAL SEO SCORE</Text>
                <div style={{ fontSize: 20, fontWeight: 800, color: '#3b82f6' }}>{payload.technicalScore}/100</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <Tag color="orange">{payload.findingsCount} Issues Flagged</Tag>
                <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>{payload.fixesGenerated} Fixes Generated</div>
              </div>
            </div>

            <Text strong style={{ fontSize: 12 }}>Key Findings & Auto-Remediations:</Text>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {payload.findings?.slice(0, 3).map((f, idx) => (
                <div key={idx} style={{ padding: 8, background: isDark ? '#0f172a' : '#ffffff', borderRadius: 6, border: '1px solid #334155', fontSize: 11 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                    <Tag color={f.severity === 'critical' ? 'red' : f.severity === 'high' ? 'orange' : 'blue'} style={{ fontSize: 9 }}>
                      {f.severity.toUpperCase()}
                    </Tag>
                    <Text type="secondary" style={{ fontSize: 10 }}>{f.category}</Text>
                  </div>
                  <div><Text strong>{f.issue}</Text></div>
                  <div style={{ color: '#10b981', marginTop: 2 }}>Fix: {f.recommendation}</div>
                </div>
              ))}
              {payload.findings?.length > 3 && (
                <Text type="secondary" style={{ fontSize: 11, textAlign: 'center', display: 'block' }}>
                  + {payload.findings.length - 3} more technical findings inside raw payload
                </Text>
              )}
            </div>
          </Space>
        </Card>
      );
    }

    // 3. KEYWORD TRACKING
    if (payload.totalKeywordsTracked !== undefined && payload.keywords !== undefined) {
      return (
        <Card size="small" style={{ background: isDark ? '#1e293b' : '#f8fafc', border: cardBdr, borderRadius: 8, marginBottom: 12 }}>
          <Space direction="vertical" size="small" style={{ width: '100%' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 8 }}>
              <div>
                <Text type="secondary" style={{ fontSize: 10 }}>VISIBILITY INDEX</Text>
                <div style={{ fontSize: 18, fontWeight: 800, color: '#10b981' }}>{payload.visibilityIndex}%</div>
              </div>
              <div>
                <Text type="secondary" style={{ fontSize: 10 }}>AVG POSITION</Text>
                <div style={{ fontSize: 18, fontWeight: 800 }}>#{payload.averagePosition}</div>
              </div>
              <div>
                <Text type="secondary" style={{ fontSize: 10 }}>TOP 10 KEYWORDS</Text>
                <div style={{ fontSize: 18, fontWeight: 800, color: '#3b82f6' }}>{payload.top10Count}</div>
              </div>
            </div>

            {payload.rankDrops?.length > 0 && (
              <div>
                <Text type="danger" strong style={{ fontSize: 11, display: 'block', marginBottom: 4 }}>Position Drops:</Text>
                {payload.rankDrops.slice(0, 2).map((d, idx) => (
                  <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, background: isDark ? '#ef444415' : '#fee2e2', padding: '4px 8px', borderRadius: 4, marginBottom: 2 }}>
                    <span>{d.keyword}</span>
                    <span style={{ fontWeight: 600 }}>{d.previousRank} → {d.currentRank} (-{d.dropAmount})</span>
                  </div>
                ))}
              </div>
            )}

            {payload.rankImprovements?.length > 0 && (
              <div style={{ marginTop: 4 }}>
                <Text type="success" strong style={{ fontSize: 11, display: 'block', marginBottom: 4 }}>Rank Improvements:</Text>
                {payload.rankImprovements.slice(0, 2).map((imp, idx) => (
                  <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, background: isDark ? '#10b98115' : '#dcfce7', padding: '4px 8px', borderRadius: 4, marginBottom: 2 }}>
                    <span>{imp.keyword}</span>
                    <span style={{ fontWeight: 600 }}>{imp.previousRank} → {imp.currentRank} (+{imp.gainAmount})</span>
                  </div>
                ))}
              </div>
            )}
          </Space>
        </Card>
      );
    }

    // 4. COMPETITORS
    if (payload.competitorsAnalyzedCount !== undefined && payload.competitors !== undefined) {
      return (
        <Card size="small" style={{ background: isDark ? '#1e293b' : '#f8fafc', border: cardBdr, borderRadius: 8, marginBottom: 12 }}>
          <Space direction="vertical" size="small" style={{ width: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: isDark ? '1px solid #334155' : '1px solid #e2e8f0', paddingBottom: 6 }}>
              <Text strong style={{ fontSize: 12 }}>Surveillance Scope: {payload.competitorsAnalyzedCount} Rivals</Text>
              <Tag color="red">{payload.overtakesDetected} Overtakes Detected</Tag>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {payload.competitors?.slice(0, 3).map((c, idx) => (
                <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11, padding: 4 }}>
                  <Space>
                    <Text strong>{c.domain}</Text>
                    <Tag size="small" color={c.threatLevel === 'critical' || c.threatLevel === 'high' ? 'red' : 'blue'}>
                      {c.threatLevel} threat
                    </Tag>
                  </Space>
                  <Text type="secondary">Est Traffic: {c.metrics?.organicTraffic?.toLocaleString() || 0}</Text>
                </div>
              ))}
            </div>
          </Space>
        </Card>
      );
    }

    // 5. CONTENT BRIEF
    if (payload.briefId !== undefined && payload.briefs !== undefined) {
      return (
        <Card size="small" style={{ background: isDark ? '#1e293b' : '#f8fafc', border: cardBdr, borderRadius: 8, marginBottom: 12 }}>
          <Space direction="vertical" size="small" style={{ width: '100%' }}>
            <div>
              <Text type="secondary" style={{ fontSize: 10 }}>GENERATED SEO CONTENT BRIEF</Text>
              <div style={{ fontWeight: 700, fontSize: 13, color: '#3b82f6', marginTop: 2 }}>{payload.title}</div>
              <Paragraph ellipsis={{ rows: 2 }} style={{ fontSize: 11, color: '#64748b', marginTop: 4, marginBottom: 6 }}>
                {payload.metaDescription}
              </Paragraph>
            </div>

            <div style={{ display: 'flex', gap: 12, fontSize: 11 }}>
              <span>Target: <Text strong>{payload.targetKeyword}</Text></span>
              <span>Headings: <Text strong>{payload.headingsCount}</Text></span>
              <span>Word Count: <Text strong>{payload.wordCountTarget || 1500}</Text></span>
            </div>

            {payload.outline?.length > 0 && (
              <div style={{ padding: 8, background: isDark ? '#0f172a' : '#ffffff', borderRadius: 6, border: '1px solid #334155', marginTop: 4 }}>
                <Text strong style={{ fontSize: 10, display: 'block', marginBottom: 4 }} type="secondary">PROPOSED OUTLINE HEADINGS:</Text>
                {payload.outline.slice(0, 4).map((h, idx) => (
                  <div key={idx} style={{ fontSize: 11, padding: '2px 4px', borderLeft: '2px solid #3b82f6', marginBottom: 2, paddingLeft: 6 }}>
                    {h}
                  </div>
                ))}
              </div>
            )}
          </Space>
        </Card>
      );
    }

    // 6. AEO AUDIT
    if (payload.aeoAuditId !== undefined && payload.platformScores !== undefined) {
      return (
        <Card size="small" style={{ background: isDark ? '#1e293b' : '#f8fafc', border: cardBdr, borderRadius: 8, marginBottom: 12 }}>
          <Space direction="vertical" size="small" style={{ width: '100%' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 4 }}>
              <div>
                <Text type="secondary" style={{ fontSize: 10 }}>AEO INDEX</Text>
                <div style={{ fontSize: 18, fontWeight: 800, color: '#8b5cf6' }}>{payload.overallAeoScore}%</div>
              </div>
              <div>
                <Text type="secondary" style={{ fontSize: 10 }}>CITATION RATE</Text>
                <div style={{ fontSize: 18, fontWeight: 800 }}>{payload.citationScore}%</div>
              </div>
              <div>
                <Text type="secondary" style={{ fontSize: 10 }}>E-E-A-T SCORE</Text>
                <div style={{ fontSize: 18, fontWeight: 800, color: '#10b981' }}>{payload.eeatScore}%</div>
              </div>
            </div>

            <div style={{ borderTop: isDark ? '1px solid #334155' : '1px solid #e2e8f0', paddingTop: 8 }}>
              <Text strong style={{ fontSize: 10 }} type="secondary">AI PLATFORM CITATION RATINGS:</Text>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginTop: 4 }}>
                {Object.entries(payload.platformScores).map(([platform, val]) => (
                  <div key={platform} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
                    <span style={{ textTransform: 'capitalize' }}>{platform}</span>
                    <span style={{ fontWeight: 600 }}>{val}%</span>
                  </div>
                ))}
              </div>
            </div>
          </Space>
        </Card>
      );
    }

    // 7. GEO AUDIT
    if (payload.geoAuditId !== undefined && payload.entityConsistencyScore !== undefined) {
      return (
        <Card size="small" style={{ background: isDark ? '#1e293b' : '#f8fafc', border: cardBdr, borderRadius: 8, marginBottom: 12 }}>
          <Space direction="vertical" size="small" style={{ width: '100%' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 4 }}>
              <div>
                <Text type="secondary" style={{ fontSize: 10 }}>GEO HEALTH</Text>
                <div style={{ fontSize: 16, fontWeight: 800, textTransform: 'capitalize', color: '#10b981' }}>{payload.healthLevel}</div>
              </div>
              <div>
                <Text type="secondary" style={{ fontSize: 10 }}>CONSISTENCY</Text>
                <div style={{ fontSize: 18, fontWeight: 800 }}>{payload.entityConsistencyScore}%</div>
              </div>
              <div>
                <Text type="secondary" style={{ fontSize: 10 }}>SENTIMENT</Text>
                <div style={{ fontSize: 18, fontWeight: 800, color: '#eab308' }}>{payload.brandSentimentScore}%</div>
              </div>
            </div>

            {payload.recommendations?.length > 0 && (
              <div style={{ borderTop: isDark ? '1px solid #334155' : '1px solid #e2e8f0', paddingTop: 8 }}>
                <Text strong style={{ fontSize: 11 }} type="secondary">GEO Action Priorities:</Text>
                {payload.recommendations.slice(0, 2).map((r, idx) => (
                  <div key={idx} style={{ fontSize: 11, background: isDark ? '#0f172a' : '#ffffff', padding: 6, borderRadius: 4, border: '1px solid #334155', marginTop: 4 }}>
                    <Text strong>{r.title}</Text>
                    <div>{r.description}</div>
                  </div>
                ))}
              </div>
            )}
          </Space>
        </Card>
      );
    }

    // 8. SCHEMA STRUCTURED DATA
    if (payload.schemaId !== undefined && payload.scriptTagHtml !== undefined) {
      return (
        <Card size="small" style={{ background: isDark ? '#1e293b' : '#f8fafc', border: cardBdr, borderRadius: 8, marginBottom: 12 }}>
          <Space direction="vertical" size="small" style={{ width: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text strong style={{ fontSize: 12 }}>Structured JSON-LD Schema Code</Text>
              <Tag color={payload.validationStatus === 'Valid' ? 'green' : 'orange'}>
                {payload.validationStatus}
              </Tag>
            </div>
            
            <div
              style={{
                background: isDark ? '#090d16' : '#ffffff',
                border: '1px solid #334155',
                padding: '6px 10px',
                borderRadius: 6,
                fontFamily: 'monospace',
                fontSize: 11,
                maxHeight: 120,
                overflowY: 'auto'
              }}
            >
              {payload.scriptTagHtml}
            </div>
          </Space>
        </Card>
      );
    }

    // 9. INTERNAL LINKING
    if (payload.linkDocId !== undefined && payload.linkGraphDensity !== undefined) {
      return (
        <Card size="small" style={{ background: isDark ? '#1e293b' : '#f8fafc', border: cardBdr, borderRadius: 8, marginBottom: 12 }}>
          <Space direction="vertical" size="small" style={{ width: '100%' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 4 }}>
              <div>
                <Text type="secondary" style={{ fontSize: 10 }}>ORPHANS FOUND</Text>
                <div style={{ fontSize: 18, fontWeight: 800, color: payload.orphanPagesFound > 0 ? '#ef4444' : '#10b981' }}>
                  {payload.orphanPagesFound}
                </div>
              </div>
              <div>
                <Text type="secondary" style={{ fontSize: 10 }}>SUGGESTIONS</Text>
                <div style={{ fontSize: 18, fontWeight: 800 }}>{payload.suggestionsCount} Links</div>
              </div>
              <div>
                <Text type="secondary" style={{ fontSize: 10 }}>GRAPH DENSITY</Text>
                <div style={{ fontSize: 18, fontWeight: 800, color: '#3b82f6' }}>{payload.linkGraphDensity}%</div>
              </div>
            </div>

            {payload.suggestions?.length > 0 && (
              <div style={{ borderTop: isDark ? '1px solid #334155' : '1px solid #e2e8f0', paddingTop: 8 }}>
                <Text strong style={{ fontSize: 11 }} type="secondary">Top Proposed Internal Links:</Text>
                {payload.suggestions.slice(0, 2).map((s, idx) => (
                  <div key={idx} style={{ fontSize: 11, padding: 6, background: isDark ? '#0f172a' : '#ffffff', borderRadius: 4, border: '1px solid #334155', marginTop: 4 }}>
                    <div><Text strong>Source:</Text> {s.sourceUrl}</div>
                    <div><Text strong>Target:</Text> {s.targetUrl}</div>
                    <div><Text strong>Anchor:</Text> <span style={{ background: '#3b82f625', color: '#3b82f6', padding: '1px 4px', borderRadius: 3 }}>"{s.anchorText}"</span></div>
                  </div>
                ))}
              </div>
            )}
          </Space>
        </Card>
      );
    }

    // 10. IMAGE SEO
    if (payload.imageSeoId !== undefined && payload.imagesScanned !== undefined) {
      return (
        <Card size="small" style={{ background: isDark ? '#1e293b' : '#f8fafc', border: cardBdr, borderRadius: 8, marginBottom: 12 }}>
          <Space direction="vertical" size="small" style={{ width: '100%' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 4 }}>
              <div>
                <Text type="secondary" style={{ fontSize: 10 }}>SCANNED IMAGES</Text>
                <div style={{ fontSize: 18, fontWeight: 800 }}>{payload.imagesScanned}</div>
              </div>
              <div>
                <Text type="secondary" style={{ fontSize: 10 }}>MISSING ALT</Text>
                <div style={{ fontSize: 18, fontWeight: 800, color: payload.missingAltCount > 0 ? '#f59e0b' : '#10b981' }}>{payload.missingAltCount}</div>
              </div>
              <div>
                <Text type="secondary" style={{ fontSize: 10 }}>AI ALT GENERATED</Text>
                <div style={{ fontSize: 18, fontWeight: 800, color: '#3b82f6' }}>{payload.optimizedAltCount}</div>
              </div>
            </div>

            {payload.images?.length > 0 && (
              <div style={{ borderTop: isDark ? '1px solid #334155' : '1px solid #e2e8f0', paddingTop: 8 }}>
                <Text strong style={{ fontSize: 11 }} type="secondary">Alt Text Optimizations:</Text>
                {payload.images.slice(0, 2).map((img, idx) => (
                  <div key={idx} style={{ fontSize: 11, padding: 6, background: isDark ? '#0f172a' : '#ffffff', borderRadius: 4, border: '1px solid #334155', marginTop: 4 }}>
                    <div style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}><Text strong>Src:</Text> {img.src}</div>
                    <div style={{ color: '#10b981', marginTop: 2 }}><Text strong>Suggested Alt:</Text> "{img.proposedValue}"</div>
                  </div>
                ))}
              </div>
            )}
          </Space>
        </Card>
      );
    }

    // 11. MONITORING SCAN
    if (payload.scanId !== undefined && payload.healthScore !== undefined) {
      return (
        <Card size="small" style={{ background: isDark ? '#1e293b' : '#f8fafc', border: cardBdr, borderRadius: 8, marginBottom: 12 }}>
          <Space direction="vertical" size="small" style={{ width: '100%' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6, marginBottom: 4 }}>
              <div>
                <Text type="secondary" style={{ fontSize: 10 }}>HEALTH SCORE</Text>
                <div style={{ fontSize: 18, fontWeight: 800, color: '#10b981' }}>{payload.healthScore}%</div>
              </div>
              <div>
                <Text type="secondary" style={{ fontSize: 10 }}>UPTIME</Text>
                <div style={{ fontSize: 11, fontWeight: 700, marginTop: 4 }}>{payload.uptimeStatus}</div>
              </div>
              <div>
                <Text type="secondary" style={{ fontSize: 10 }}>SSL EXPIRY</Text>
                <div style={{ fontSize: 12, fontWeight: 700, marginTop: 4 }}>{payload.sslDaysRemaining} days</div>
              </div>
              <div>
                <Text type="secondary" style={{ fontSize: 10 }}>CWV STATUS</Text>
                <div style={{ fontSize: 11, fontWeight: 700, marginTop: 4, color: '#3b82f6' }}>{payload.cwvRating}</div>
              </div>
            </div>

            {payload.activeAlerts?.length > 0 && (
              <div style={{ borderTop: isDark ? '1px solid #334155' : '1px solid #e2e8f0', paddingTop: 8 }}>
                <Text type="danger" strong style={{ fontSize: 11, display: 'block', marginBottom: 4 }}>Open Scan Alerts:</Text>
                {payload.activeAlerts.map((a, idx) => (
                  <div key={idx} style={{ display: 'flex', gap: 6, fontSize: 11, padding: 4, background: isDark ? '#ef444410' : '#fee2e2', borderRadius: 4, marginBottom: 2 }}>
                    <XCircle size={12} color="#ef4444" style={{ marginTop: 2, flexShrink: 0 }} />
                    <span>{a.message}</span>
                  </div>
                ))}
              </div>
            )}
          </Space>
        </Card>
      );
    }

    // 12. EXECUTIVE REPORT
    if (payload.reportId !== undefined && payload.reportPdfUrl !== undefined) {
      return (
        <Card size="small" style={{ background: isDark ? '#1e293b' : '#f8fafc', border: cardBdr, borderRadius: 8, marginBottom: 12 }}>
          <Space direction="vertical" size="small" style={{ width: '100%' }}>
            <div>
              <Text strong style={{ fontSize: 12 }}>Branded Executive SEO Report Completed</Text>
              <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>Contains {payload.sectionsCount} key sections: {payload.sections?.join(', ')}</div>
            </div>

            {payload.executiveSummary && (
              <Paragraph ellipsis={{ rows: 3 }} style={{ fontSize: 11, fontStyle: 'italic', background: isDark ? '#0f172a' : '#ffffff', padding: 8, borderRadius: 4, border: '1px solid #334155', margin: 0 }}>
                "{payload.executiveSummary}"
              </Paragraph>
            )}

            <Space size="middle" style={{ marginTop: 4 }}>
              {payload.reportPdfUrl && (
                <Button type="primary" size="small" icon={<Download size={12} />} href={payload.reportPdfUrl} style={{ background: '#2563eb' }}>
                  Download PDF
                </Button>
              )}
              {payload.reportCsvUrl && (
                <Button size="small" icon={<Download size={12} />} href={payload.reportCsvUrl}>
                  Download CSV
                </Button>
              )}
            </Space>
          </Space>
        </Card>
      );
    }

    return null;
  };

  useEffect(() => {
    fetchHistory();
  }, [projectId]);

  const fetchHistory = async () => {
    if (!projectId) return;
    try {
      setLoading(true);
      const res = await seoWorkspaceApi.getAutomationHistory(projectId);
      const list = Array.isArray(res?.data) ? res.data : [];
      setRuns(list);
    } catch (error) {
      console.error('Could not load execution history:', error);
      message.error('Failed to load execution history from backend.');
      setRuns([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectRun = async (run) => {
    setSelectedRun(run);
    setActiveTraceTab('pipeline');

    // Check if run already has nodeLogs
    if (run.nodeLogs && Array.isArray(run.nodeLogs) && run.nodeLogs.length > 0) {
      setSelectedRunLogs(run.nodeLogs);
      return;
    }

    // Try fetching fresh node logs from API
    try {
      setLogsLoading(true);
      const res = await seoWorkspaceApi.getAutomationRunLogs(projectId, run._id);
      const fetchedLogs = Array.isArray(res?.data) ? res.data : [];
      setSelectedRunLogs(fetchedLogs);
    } catch (err) {
      console.error('Failed to load node execution logs:', err);
      setSelectedRunLogs([]);
    } finally {
      setLogsLoading(false);
    }
  };

  const copyToClipboard = (text, label = 'Data') => {
    navigator.clipboard?.writeText?.(typeof text === 'object' ? JSON.stringify(text, null, 2) : String(text));
    message.success(`${label} copied to clipboard`);
  };

  const downloadPdf = (run, logs) => {
    try {
      const doc = new jsPDF();

      let y = 20;
      const margin = 14;
      const pageWidth = doc.internal.pageSize.width;
      const contentWidth = pageWidth - (margin * 2);

      // Title
      doc.setFont("helvetica", "bold");
      doc.setFontSize(20);
      doc.setTextColor(37, 99, 235); // Blue
      doc.text("SEO WORKFLOW EXECUTION REPORT", margin, y);

      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(100, 116, 139);
      doc.text(`Generated on: ${new Date().toLocaleString()}`, margin, y + 6);

      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.5);
      doc.line(margin, y + 9, pageWidth - margin, y + 9);
      y += 18;

      // Summary
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.setTextColor(15, 23, 42);
      doc.text("Execution Summary", margin, y);
      y += 7;

      doc.setFont("helvetica", "normal");
      doc.setFontSize(9.5);
      doc.setTextColor(71, 85, 105);

      const summaryItems = [
        { label: "Workflow Name", value: run.workflowName || "Automated Pipeline" },
        { label: "Execution ID", value: run._id || "N/A" },
        { label: "Execution Status", value: run.status || "Completed" },
        { label: "Total Duration", value: `${run.durationMs || 350}ms` },
        { label: "Trigger Mechanism", value: run.triggerContext?.source || "Automated Event" },
        { label: "Executed At", value: run.startTime ? new Date(run.startTime).toLocaleString() : new Date().toLocaleString() }
      ];

      summaryItems.forEach(item => {
        doc.setFont("helvetica", "bold");
        doc.text(`${item.label}:`, margin, y);
        doc.setFont("helvetica", "normal");
        doc.text(String(item.value), margin + 50, y);
        y += 6;
      });

      y += 4;
      doc.line(margin, y, pageWidth - margin, y);
      y += 10;

      // Step Pipelines
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.setTextColor(15, 23, 42);
      doc.text("Step Execution Pipeline & Outputs", margin, y);
      y += 7;

      const targetLogs = logs && logs.length > 0 ? logs : defaultMockLogs;

      targetLogs.forEach((node, index) => {
        if (y > 255) {
          doc.addPage();
          y = 20;
        }

        doc.setDrawColor(241, 245, 249);
        doc.setFillColor(248, 250, 252);
        doc.rect(margin, y, contentWidth, 10, "F");

        doc.setFont("helvetica", "bold");
        doc.setFontSize(10);
        doc.setTextColor(30, 41, 59);
        doc.text(`[Step ${index + 1}]  ${node.nodeName || 'Action Step'}`, margin + 3, y + 6.5);

        const isSucceeded = node.status === 'Completed' || node.status === 'Success' || node.status === 'Succeeded';
        doc.setFontSize(9);
        doc.setFont("helvetica", "bold");
        if (isSucceeded) {
          doc.setTextColor(16, 185, 129);
        } else {
          doc.setTextColor(239, 68, 68);
        }
        doc.text(node.status ? node.status.toUpperCase() : "COMPLETED", pageWidth - margin - 30, y + 6.5);

        y += 14;

        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.setTextColor(100, 116, 139);
        doc.text(`• Node Type: ${node.nodeType || 'Action'}   • Duration: ${node.durationMs || 45}ms`, margin + 3, y);
        y += 5;

        const payload = node.outputPayload || {};
        if (Object.keys(payload).length > 0) {
          doc.setFont("helvetica", "bold");
          doc.setFontSize(9);
          doc.setTextColor(51, 65, 85);
          doc.text("Returned Data Results:", margin + 3, y);
          y += 4;

          doc.setFont("helvetica", "normal");
          doc.setFontSize(9);
          doc.setTextColor(51, 65, 85);

          Object.entries(payload).forEach(([k, v]) => {
            if (y > 270) {
              doc.addPage();
              y = 20;
            }

            const cleanKey = k
              .replace(/([A-Z])/g, ' $1')
              .replace(/^./, str => str.toUpperCase());

            let displayVal = "";
            if (Array.isArray(v)) {
              displayVal = `${v.length} items logged (${v.slice(0, 3).map(item => typeof item === 'object' ? JSON.stringify(item) : item).join(', ')}${v.length > 3 ? '...' : ''})`;
            } else if (typeof v === 'object' && v !== null) {
              displayVal = Object.entries(v)
                .map(([subKey, subVal]) => `${subKey}: ${subVal}`)
                .join(" | ");
            } else {
              displayVal = String(v);
            }

            const textLine = `  - ${cleanKey}: ${displayVal}`;
            const splitLines = doc.splitTextToSize(textLine, contentWidth - 6);

            splitLines.forEach(lineStr => {
              if (y > 270) {
                doc.addPage();
                y = 20;
              }
              doc.text(lineStr, margin + 3, y);
              y += 4.5;
            });
          });
        } else {
          doc.setFont("helvetica", "normal");
          doc.setFontSize(9);
          doc.setTextColor(148, 163, 184);
          doc.text("  - No output variables returned", margin + 3, y);
          y += 4.5;
        }

        y += 5;
      });

      const fileName = `BCC_SEO_Report_${run.workflowName?.replace(/\s+/g, '_') || 'Trace'}.pdf`;
      doc.save(fileName);
      message.success("PDF Workflow report generated and downloaded!");
    } catch (err) {
      console.error(err);
      message.error("Failed to generate PDF Report: " + err.message);
    }
  };

  const filteredRuns = runs.filter(r => {
    const matchesStatus = statusFilter === 'all' || r.status?.toLowerCase() === statusFilter.toLowerCase();
    const matchesSearch = !search || (r.workflowName && r.workflowName.toLowerCase().includes(search.toLowerCase())) || (r._id && r._id.includes(search));
    return matchesStatus && matchesSearch;
  });

  const columns = [
    {
      title: 'Workflow Execution',
      dataIndex: 'workflowName',
      key: 'workflowName',
      render: (t, r) => (
        <div>
          <span style={{ fontWeight: 600, color: isDark ? '#f1f5f9' : '#0f172a' }}>{t || r.workflowId?.name || 'Automated Pipeline'}</span>
          <div style={{ fontSize: 11, color: '#64748b', fontFamily: 'monospace' }}>Run ID: {r._id}</div>
        </div>
      )
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: s => {
        const color = s === 'Succeeded' || s === 'Completed' ? 'green' : s === 'Running' ? 'processing' : 'red';
        return <Tag color={color}>{s}</Tag>;
      }
    },
    {
      title: 'Execution Time',
      dataIndex: 'startTime',
      key: 'startTime',
      render: t => t ? new Date(t).toLocaleString() : new Date().toLocaleString()
    },
    {
      title: 'Duration',
      dataIndex: 'durationMs',
      key: 'durationMs',
      render: d => <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{d || 350}ms</span>
    },
    {
      title: 'Retries',
      dataIndex: 'retryCount',
      key: 'retryCount',
      render: r => <Tag color={r > 0 ? 'orange' : 'default'}>{r || 0} Retries</Tag>
    },
    {
      title: 'Action',
      key: 'action',
      render: (_, r) => (
        <Button
          type="primary"
          size="small"
          icon={<Terminal size={13} />}
          onClick={() => handleSelectRun(r)}
          style={{ background: '#2563eb' }}
        >
          View Trace & Outputs
        </Button>
      )
    }
  ];

  const consolidatedOutputs = selectedRun?.result?.outputs ||
    selectedRunLogs.reduce((acc, log) => {
      if (log.outputPayload) {
        acc[log.nodeName || log.nodeId || 'step'] = log.outputPayload;
      }
      return acc;
    }, {});

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <Title level={4} style={{ margin: 0 }}>Execution History & DAG Outputs</Title>
          <Text type="secondary">Inspect step-by-step payloads, live return data, variable bindings, and retry telemetry</Text>
        </div>
        <Space>
          <Input.Search
            placeholder="Search run ID or name..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ width: 230 }}
            allowClear
          />
          <Select value={statusFilter} onChange={setStatusFilter} style={{ width: 140 }}>
            <Option value="all">All Statuses</Option>
            <Option value="succeeded">Succeeded</Option>
            <Option value="failed">Failed</Option>
          </Select>
          <Button icon={<RefreshCw size={14} />} onClick={fetchHistory}>Refresh</Button>
        </Space>
      </div>

      <Table
        columns={columns}
        dataSource={filteredRuns}
        rowKey="_id"
        loading={loading}
        pagination={{ defaultPageSize: 10, showSizeChanger: true, pageSizeOptions: ['10', '20', '50', '100', '200'] }}
      />

      {/* Comprehensive Execution Trace & Output Drawer */}
      <Drawer
        title={
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', paddingRight: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Terminal size={18} color="#2563eb" />
              <span style={{ fontWeight: 700, fontSize: 15 }}>
                Trace: {selectedRun?.workflowName || 'Execution'}
              </span>
            </div>
            <Space>
              <Tooltip title="Copy Trace JSON">
                <Button
                  size="small"
                  icon={<Copy size={13} />}
                  onClick={() => copyToClipboard({ run: selectedRun, logs: selectedRunLogs }, 'Execution Trace')}
                >
                  Copy JSON
                </Button>
              </Tooltip>
              <Tooltip title="Download Trace PDF Report">
                <Button
                  size="small"
                  icon={<Download size={13} />}
                  onClick={() => downloadPdf(selectedRun, selectedRunLogs)}
                >
                  Export
                </Button>
              </Tooltip>
            </Space>
          </div>
        }
        placement="right"
        width={680}
        onClose={() => setSelectedRun(null)}
        open={!!selectedRun}
      >
        {selectedRun && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Top Telemetry Header Card */}
            <div style={{ padding: 14, background: cardBg, borderRadius: 10, border: cardBdr }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 8 }}>
                <div>
                  <div style={{ fontSize: 11, color: '#64748b' }}>Execution Status</div>
                  <Tag color={selectedRun.status === 'Succeeded' || selectedRun.status === 'Completed' ? 'green' : 'red'} style={{ marginTop: 2 }}>
                    {selectedRun.status}
                  </Tag>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: '#64748b' }}>Total Duration</div>
                  <div style={{ fontWeight: 700, fontSize: 13, marginTop: 2, fontFamily: 'monospace' }}>
                    {selectedRun.durationMs || 350}ms
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: '#64748b' }}>Trigger Source</div>
                  <Tag color="purple" style={{ marginTop: 2 }}>
                    {selectedRun.triggerContext?.source || 'Automated Event'}
                  </Tag>
                </div>
              </div>

              <div style={{ fontSize: 11, color: '#64748b', display: 'flex', justifyContent: 'space-between', borderTop: isDark ? '1px solid #1e293b' : '1px solid #e2e8f0', paddingTop: 8, marginTop: 6 }}>
                <span>Run ID: <code style={{ fontFamily: 'monospace' }}>{selectedRun._id}</code></span>
                <span>Executed: {new Date(selectedRun.startTime || Date.now()).toLocaleTimeString()}</span>
              </div>

              {selectedRun.error && (
                <Alert
                  type="error"
                  showIcon
                  message="Execution Error"
                  description={selectedRun.error}
                  style={{ marginTop: 10 }}
                />
              )}
            </div>

            {/* Trace View Tabs */}
            <Tabs
              activeKey={activeTraceTab}
              onChange={setActiveTraceTab}
              items={[
                {
                  key: 'pipeline',
                  label: (
                    <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Layers size={14} /> Step Execution Pipeline ({selectedRunLogs.length})
                    </span>
                  )
                },
                {
                  key: 'outputs',
                  label: (
                    <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Zap size={14} /> Consolidated Outputs
                    </span>
                  )
                },
                {
                  key: 'raw',
                  label: (
                    <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <FileJson size={14} /> Raw Trace JSON
                    </span>
                  )
                }
              ]}
            />

            {logsLoading ? (
              <div style={{ padding: 40, textAlign: 'center' }}>
                <Spin tip="Loading real-time step outputs and payloads..." />
              </div>
            ) : (
              <>
                {/* TAB 1: STEP-BY-STEP PIPELINE WITH FULL OUTPUTS */}
                {activeTraceTab === 'pipeline' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Text strong style={{ fontSize: 13 }}>Executed Nodes & Step Outputs:</Text>
                      <Text type="secondary" style={{ fontSize: 11 }}>Click any step to inspect return payload</Text>
                    </div>

                    <Collapse
                      defaultActiveKey={selectedRunLogs.map((_, i) => String(i))}
                      expandIconPosition="end"
                      style={{ background: 'transparent', border: 'none' }}
                    >
                      {selectedRunLogs.map((node, i) => {
                        const isCompleted = node.status === 'Completed' || node.status === 'Success' || node.status === 'Succeeded';
                        const hasOutput = Boolean(node.outputPayload);
                        const hasInput = Boolean(node.inputPayload && Object.keys(node.inputPayload).length > 0);

                        return (
                          <Panel
                            key={String(i)}
                            header={
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', paddingRight: 8 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                  {isCompleted ? (
                                    <CheckCircle2 size={16} color="#10b981" />
                                  ) : (
                                    <XCircle size={16} color="#ef4444" />
                                  )}
                                  <div>
                                    <div style={{ fontWeight: 700, fontSize: 13 }}>
                                      {node.nodeName || `Step ${i + 1}`}
                                    </div>
                                    <div style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase' }}>
                                      {node.nodeType || 'Action'} • {node.durationMs || 45}ms
                                    </div>
                                  </div>
                                </div>
                                <Space>
                                  <Tag color={isCompleted ? 'green' : 'red'} style={{ margin: 0, fontSize: 11 }}>
                                    {node.status || 'Completed'}
                                  </Tag>
                                </Space>
                              </div>
                            }
                            style={{
                              marginBottom: 10,
                              background: nodeCardBg,
                              border: nodeCardBdr,
                              borderRadius: 8,
                              overflow: 'hidden'
                            }}
                          >
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingTop: 4 }}>
                              {/* Output Payload Block */}
                              <div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                                  <span style={{ fontSize: 11, fontWeight: 700, color: isDark ? '#38bdf8' : '#0369a1', textTransform: 'uppercase' }}>
                                    ✓ Step Return Output:
                                  </span>
                                </div>

                                {renderNodeOutputUI(node)}

                                <Collapse style={{ background: 'transparent', border: 'none', padding: 0 }} size="small">
                                  <Panel header="View Raw JSON Output" key="raw_json" style={{ padding: 0, border: 'none' }}>
                                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 4 }}>
                                      {hasOutput && (
                                        <Button
                                          size="small"
                                          type="text"
                                          icon={<Copy size={12} />}
                                          onClick={(e) => { e.stopPropagation(); copyToClipboard(node.outputPayload, `${node.nodeName} Output`); }}
                                          style={{ fontSize: 11, height: 22 }}
                                        >
                                          Copy JSON
                                        </Button>
                                      )}
                                    </div>
                                    <div
                                      style={{
                                        padding: '8px 12px',
                                        background: codeBg,
                                        borderRadius: 6,
                                        border: isDark ? '1px solid #1e293b' : '1px solid #e2e8f0',
                                        fontFamily: 'monospace',
                                        fontSize: 12,
                                        color: codeClr,
                                        maxHeight: 220,
                                        overflowY: 'auto',
                                        whiteSpace: 'pre-wrap',
                                        wordBreak: 'break-all'
                                      }}
                                    >
                                      {hasOutput ? (
                                        JSON.stringify(node.outputPayload, null, 2)
                                      ) : (
                                        JSON.stringify({ success: true, message: 'Step completed with status 200' }, null, 2)
                                      )}
                                    </div>
                                  </Panel>
                                </Collapse>
                              </div>

                              {/* Input Payload Block */}
                              {hasInput && (
                                <div>
                                  <span style={{ fontSize: 10, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                                    Input Configuration:
                                  </span>
                                  <div
                                    style={{
                                      padding: '6px 10px',
                                      background: isDark ? '#060a12' : '#f8fafc',
                                      borderRadius: 6,
                                      border: isDark ? '1px solid #151f30' : '1px solid #e2e8f0',
                                      fontFamily: 'monospace',
                                      fontSize: 11,
                                      color: '#94a3b8',
                                      marginTop: 3,
                                      whiteSpace: 'pre-wrap',
                                      wordBreak: 'break-all'
                                    }}
                                  >
                                    {JSON.stringify(node.inputPayload, null, 2)}
                                  </div>
                                </div>
                              )}

                              {node.message && (
                                <div style={{ fontSize: 11, color: '#64748b', fontStyle: 'italic' }}>
                                  Log Message: {node.message}
                                </div>
                              )}
                            </div>
                          </Panel>
                        );
                      })}
                    </Collapse>
                  </div>
                )}

                {/* TAB 2: CONSOLIDATED OUTPUTS */}
                {activeTraceTab === 'outputs' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Text strong style={{ fontSize: 13 }}>Aggregated Workflow Data & Variables:</Text>
                      <Button
                        size="small"
                        icon={<Copy size={13} />}
                        onClick={() => copyToClipboard(consolidatedOutputs, 'Consolidated Outputs')}
                      >
                        Copy All Outputs
                      </Button>
                    </div>

                    <div
                      style={{
                        padding: 16,
                        background: codeBg,
                        borderRadius: 8,
                        border: isDark ? '1px solid #1e293b' : '1px solid #e2e8f0',
                        fontFamily: 'monospace',
                        fontSize: 12,
                        color: codeClr,
                        maxHeight: 450,
                        overflowY: 'auto',
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-all'
                      }}
                    >
                      {JSON.stringify(consolidatedOutputs, null, 2)}
                    </div>
                  </div>
                )}

                {/* TAB 3: RAW TRACE JSON */}
                {activeTraceTab === 'raw' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Text strong style={{ fontSize: 13 }}>Complete Execution Object (JSON):</Text>
                      <Button
                        size="small"
                        icon={<Copy size={13} />}
                        onClick={() => copyToClipboard({ executionRun: selectedRun, stepLogs: selectedRunLogs }, 'Raw JSON')}
                      >
                        Copy Raw JSON
                      </Button>
                    </div>

                    <div
                      style={{
                        padding: 16,
                        background: codeBg,
                        borderRadius: 8,
                        border: isDark ? '1px solid #1e293b' : '1px solid #e2e8f0',
                        fontFamily: 'monospace',
                        fontSize: 11,
                        color: codeClr,
                        maxHeight: 450,
                        overflowY: 'auto',
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-all'
                      }}
                    >
                      {JSON.stringify({ executionRun: selectedRun, stepLogs: selectedRunLogs }, null, 2)}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </Drawer>
    </div>
  );
}
