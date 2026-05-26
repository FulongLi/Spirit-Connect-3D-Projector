'use client';

export default function Overlay({ models, activeIndex, activeModel, voiceState, onSelectModel, onUploadedModel }) {
  function prev() {
    onSelectModel(activeIndex - 1);
  }

  function next() {
    onSelectModel(activeIndex + 1);
  }

  function handleUpload(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    onUploadedModel({
      id: `upload-${file.name}-${file.lastModified}`,
      label: file.name.replace(/\.[^.]+$/, '').slice(0, 18),
      type: 'file',
      file
    });
  }

  return (
    <div className="overlay-root">
      <header className="top-hud">
        <p>VOICE · PARTICLE FORM</p>
        <h1>Spirit Connect</h1>
        <span>{modeLabel(voiceState.mode)}</span>
      </header>

      <label className="upload-pill">
        <span>Upload</span>
        <input type="file" accept=".obj,.fbx,.glb,.gltf,.stl" onChange={handleUpload} />
      </label>

      <nav className="model-selector" aria-label="Particle form selector">
        <button type="button" className="arrow-button" onClick={prev} aria-label="Previous model">
          <svg width="15" height="15" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.2">
            <polyline points="7,1 3,5 7,9" />
          </svg>
        </button>
        <div className="model-track">
          {models.map((model, index) => {
            const offset = index - activeIndex;
            const isActive = !activeModel.file && index === activeIndex;
            return (
              <button
                key={model.id}
                type="button"
                className={`model-item ${isActive ? 'is-active' : ''}`}
                style={{ '--offset': offset }}
                onClick={() => onSelectModel(index)}
              >
                {isActive && <Corners />}
                <span>{model.label}</span>
              </button>
            );
          })}
          {activeModel.file && (
            <button type="button" className="model-item is-active uploaded-item" style={{ '--offset': 0 }}>
              <Corners />
              <span>{activeModel.label}</span>
            </button>
          )}
        </div>
        <button type="button" className="arrow-button" onClick={next} aria-label="Next model">
          <svg width="15" height="15" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.2">
            <polyline points="3,1 7,5 3,9" />
          </svg>
        </button>
      </nav>

      <footer className="bottom-hud">
        <span>{activeModel.label}</span>
        <span>120,000 particles</span>
        <span>surface morph</span>
      </footer>
    </div>
  );
}

function Corners() {
  return (
    <>
      <i className="corner tl" />
      <i className="corner tr" />
      <i className="corner bl" />
      <i className="corner br" />
    </>
  );
}

function modeLabel(mode) {
  if (mode === 'listening') return 'LISTENING';
  if (mode === 'thinking') return 'THINKING';
  if (mode === 'speaking') return 'SPEAKING';
  return 'IDLE';
}
