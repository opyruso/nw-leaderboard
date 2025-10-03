const DEFAULT_LAYOUT = {
  name: 'elk',
  fit: true,
  nodeDimensionsIncludeLabels: true,
  animate: false,
  elk: {
    algorithm: 'layered',
    'elk.direction': 'DOWN',
  },
};

let cytoscapeInitialised = false;

function ensureCytoscapePlugins() {
  const cytoscapeLib = window.cytoscape;
  const elk = window.cytoscapeElk;
  if (cytoscapeInitialised) {
    return cytoscapeLib;
  }
  if (typeof cytoscapeLib !== 'function') {
    return null;
  }
  if (elk && typeof elk === 'function') {
    // cytoscape-elk registers automatically when the global cytoscape is available,
    // but we invoke the factory to ensure the layout is ready.
    try {
      cytoscapeLib.use(elk);
    } catch (error) {
      // ignore if already registered
    }
  }
  cytoscapeInitialised = true;
  return cytoscapeLib;
}

export default function RelationshipGraph({ elements, className }) {
  const containerRef = React.useRef(null);
  const cyRef = React.useRef(null);

  React.useEffect(() => {
    const cytoscapeLib = ensureCytoscapePlugins();
    if (!containerRef.current || !cytoscapeLib) {
      return undefined;
    }
    const instance = cytoscapeLib({
      container: containerRef.current,
      elements: elements || [],
      layout: DEFAULT_LAYOUT,
      style: [
        {
          selector: 'node',
          style: {
            'background-color': 'data(color)',
            color: '#f8fafc',
            'font-size': 12,
            'text-valign': 'center',
            'text-halign': 'center',
            label: 'data(label)',
            padding: '8px',
            'text-wrap': 'wrap',
            'text-max-width': 120,
            'border-width': 1,
            'border-color': 'rgba(15, 23, 42, 0.35)',
          },
        },
        {
          selector: 'edge',
          style: {
            'line-color': 'data(color)',
            'line-style': 'data(lineStyle)',
            width: 'data(width)',
            'target-arrow-shape': 'none',
            'curve-style': 'bezier',
            label: 'data(label)',
            'font-size': 10,
            color: '#cbd5f5',
            'text-background-color': 'rgba(15, 23, 42, 0.85)',
            'text-background-opacity': 1,
            'text-background-padding': 4,
            'text-background-shape': 'roundrectangle',
            'text-rotation': 'autorotate',
          },
        },
      ],
    });
    cyRef.current = instance;
    return () => {
      if (cyRef.current) {
        cyRef.current.destroy();
        cyRef.current = null;
      }
    };
  }, []);

  React.useEffect(() => {
    const cy = cyRef.current;
    if (!cy) {
      return;
    }
    cy.json({ elements: elements || [] });
    cy.layout(DEFAULT_LAYOUT).run();
  }, [elements]);

  const combinedClassName = className
    ? `player-relationship-graph ${className}`
    : 'player-relationship-graph';

  return <div ref={containerRef} className={combinedClassName} role="img" aria-hidden="true" />;
}
