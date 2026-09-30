import { useNavigate } from 'react-router-dom';

const DRILLS = [
  { name: 'Common words', desc: '60 seconds of high-frequency words to build raw speed.', icon: '🔤', mode: 'time', value: 60 },
  { name: 'Short sprints', desc: 'Quick 15-second bursts to sharpen your reaction time.', icon: '⚡', mode: 'time', value: 15 },
  { name: 'Word accuracy', desc: '50 fixed words — finish every one before you stop.', icon: '🎯', mode: 'words', value: 50 },
  { name: 'Code practice', desc: 'Type real code syntax: brackets, semicolons, symbols.', icon: '{ }', mode: 'code', value: '' },
];

export default function Practice() {
  const navigate = useNavigate();
  return (
    <>
      <div className="view-header">
        <h2>Practice drills</h2>
        <p>Short, focused sessions that target specific weaknesses.</p>
      </div>
      <div className="drill-grid">
        {DRILLS.map((d) => (
          <div className="card drill-card" key={d.name}>
            <div className="drill-ic">{d.icon}</div>
            <div className="drill-body"><h4>{d.name}</h4><p>{d.desc}</p></div>
            <button className="btn btn-secondary btn-sm" onClick={() => navigate('/typing-test', { state: { mode: d.mode, value: d.value } })}>
              Practice
            </button>
          </div>
        ))}
      </div>
    </>
  );
}
