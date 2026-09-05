import React, { useMemo } from 'react';
import { ReactFlow, Background, Controls } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useOutletContext } from 'react-router-dom';

const BacklinksNetworkGraph = ({ localData }) => {
  const { project, projectData } = useOutletContext();
  const domain = project?.domain || 'Target Domain';
  const data = localData?.backlinksOverview || projectData?.backlinksOverview || {};
  
  const { nodes, edges } = useMemo(() => {
    const nodes = [
      {
        id: 'root',
        position: { x: 400, y: 300 },
        data: { label: domain },
        style: { background: 'var(--accent-primary)', color: 'white', fontWeight: 'bold', padding: '10px 20px', borderRadius: 8, border: 'none', boxShadow: '0 4px 12px rgba(91,97,244,0.3)' },
        draggable: true
      }
    ];
    const edges = [];
    
    // Top Referring Domains/Pages if available
    const topPages = (data.refDomainsList || data.indexedPages || []).slice(0, 15);
    const radius = 250;
    
    if (topPages.length > 0) {
      topPages.forEach((p, idx) => {
        const angle = (idx / topPages.length) * 2 * Math.PI;
        // Adding a bit of randomness to radius for a more organic look
        const r = radius + (Math.random() * 80 - 40); 
        const x = 400 + r * Math.cos(angle);
        const y = 300 + r * Math.sin(angle);
        
        const id = `node-${idx}`;
        // Extract domain from url if possible or use the url or domain property
        let labelStr = p.domain || p.url;
        try {
           if (p.url) labelStr = new URL(p.url).hostname.replace('www.', '');
        } catch(e) {}
        
        nodes.push({
          id,
          position: { x, y },
          data: { label: labelStr },
          style: { background: 'white', border: '1px solid #d9d9d9', borderRadius: 6, padding: '6px 12px', fontSize: 12, maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
          draggable: true
        });
        
        edges.push({
          id: `e-${id}-root`,
          source: id,
          target: 'root',
          animated: true,
          style: { stroke: '#a8a8a8', strokeWidth: 1.5 }
        });
      });
    }
    
    return { nodes, edges };
  }, [domain, data]);

  return (
    <div style={{ height: 600, background: 'white', border: '1px solid var(--border-color)', borderRadius: 8 }}>
      <ReactFlow nodes={nodes} edges={edges} fitView attributionPosition="bottom-left">
        <Background color="#e0e0e0" gap={16} />
        <Controls />
      </ReactFlow>
    </div>
  );
};

export default BacklinksNetworkGraph;
