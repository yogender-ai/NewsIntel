import React, { useEffect, useState } from 'react';
import { Activity } from 'lucide-react';

export default function TransparentPipeline() {
  const [nodes, setNodes] = useState([]);

  useEffect(() => {
    // Generate some random pipeline nodes for visual effect
    const interval = setInterval(() => {
      setNodes(prev => {
        const newNodes = [...prev, { id: Date.now(), x: Math.random() * 100, y: Math.random() * 100 }];
        if (newNodes.length > 20) newNodes.shift();
        return newNodes;
      });
    }, 150);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="transparent-pipeline-overlay">
      <div className="pipeline-grid" />
      <div className="pipeline-content">
        <div className="pipeline-spinner">
          <Activity size={48} className="spin-icon" />
        </div>
        <h2>ESTABLISHING SECURE PIPELINE</h2>
        <p>Connecting to global intelligence network...</p>
        <div className="pipeline-status-bar">
          <div className="pipeline-progress" />
        </div>
      </div>
      {nodes.map(node => (
        <div 
          key={node.id} 
          className="pipeline-node" 
          style={{ left: `${node.x}%`, top: `${node.y}%` }} 
        />
      ))}
    </div>
  );
}
