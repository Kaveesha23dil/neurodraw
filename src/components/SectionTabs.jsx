import { useRoom } from '../context/RoomContext';
import { Plus, X } from 'lucide-react';

export default function SectionTabs() {
  const { sections, activeSection, createSection, switchSection, deleteSection } = useRoom();

  return (
    <div className="section-tabs">
      {sections.map((sec) => (
        <button
          key={sec.id}
          className={`sec-tab ${sec.id === activeSection ? 'active' : ''}`}
          onClick={() => switchSection(sec.id)}
          title={sec.name}
        >
          <span className="sec-tab-name">{sec.name}</span>
          {sections.length > 1 && (
            <span
              className="sec-tab-close"
              onClick={(e) => {
                e.stopPropagation();
                deleteSection(sec.id);
              }}
            >
              <X size={12} />
            </span>
          )}
        </button>
      ))}
      <button
        className="sec-tab add-tab"
        onClick={() => createSection()}
        title="New Board"
      >
        <Plus size={14} />
      </button>
    </div>
  );
}
