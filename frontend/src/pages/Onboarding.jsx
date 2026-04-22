import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Target, MapPin, CheckCircle2 } from 'lucide-react';

const TOPICS = ["Tech", "Politics", "Markets", "AI", "Climate", "Healthcare"];
const REGIONS = ["US", "China", "India", "Europe", "Middle East"];

export default function Onboarding() {
  const [selectedTopics, setSelectedTopics] = useState([]);
  const [selectedRegions, setSelectedRegions] = useState([]);
  const navigate = useNavigate();

  const toggleSelection = (item, list, setList) => {
    if (list.includes(item)) {
      setList(list.filter(i => i !== item));
    } else {
      setList([...list, item]);
    }
  };

  const handleSave = async () => {
    try {
      await axios.post('http://127.0.0.1:8000/api/user/preferences', {
        display_name: "Test User",
        email: "test@example.com",
        preferred_categories: selectedTopics,
        preferred_regions: selectedRegions,
        youtube_channels: [],
        onboarded: true
      });
      navigate('/dashboard');
    } catch (error) {
      console.error("Failed to save preferences", error);
      // Navigate anyway for demo purposes if backend isn't up
      navigate('/dashboard');
    }
  };

  return (
    <div className="glass-panel" style={{ padding: '40px', maxWidth: '600px', margin: '0 auto', marginTop: '10vh' }}>
      <h1 style={{ marginBottom: '10px' }}>Build Your Intelligence Profile</h1>
      <p style={{ color: 'var(--text-secondary)', marginBottom: '40px' }}>Select what matters to you so we can personalize your daily briefing and impact analysis.</p>

      <div style={{ marginBottom: '30px' }}>
        <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--accent-primary)' }}>
          <Target size={20} /> Select Topics
        </h3>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginTop: '15px' }}>
          {TOPICS.map(topic => (
            <button
              key={topic}
              onClick={() => toggleSelection(topic, selectedTopics, setSelectedTopics)}
              className="btn"
              style={{
                borderColor: selectedTopics.includes(topic) ? 'var(--accent-primary)' : 'var(--border-color)',
                backgroundColor: selectedTopics.includes(topic) ? 'rgba(0, 240, 255, 0.1)' : 'transparent',
                color: selectedTopics.includes(topic) ? 'var(--accent-primary)' : 'var(--text-primary)'
              }}
            >
              {topic}
            </button>
          ))}
        </div>
      </div>

      <div style={{ marginBottom: '40px' }}>
        <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--accent-secondary)' }}>
          <MapPin size={20} /> Select Regions
        </h3>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginTop: '15px' }}>
          {REGIONS.map(region => (
            <button
              key={region}
              onClick={() => toggleSelection(region, selectedRegions, setSelectedRegions)}
              className="btn"
              style={{
                borderColor: selectedRegions.includes(region) ? 'var(--accent-secondary)' : 'var(--border-color)',
                backgroundColor: selectedRegions.includes(region) ? 'rgba(255, 0, 60, 0.1)' : 'transparent',
                color: selectedRegions.includes(region) ? 'var(--accent-secondary)' : 'var(--text-primary)'
              }}
            >
              {region}
            </button>
          ))}
        </div>
      </div>

      <button className="btn btn-primary" style={{ width: '100%', padding: '15px' }} onClick={handleSave}>
        <CheckCircle2 size={20} /> Complete Setup
      </button>
    </div>
  );
}
