let elkRegistered = false;
let elkAvailable = false;

function ensureCytoscape() {
  const cytoscapeLib = window?.cytoscape;
  if (typeof cytoscapeLib !== 'function') {
    return null;
  }
  if (!elkRegistered) {
    const elkExtension = window?.cytoscapeElk;
    if (typeof elkExtension === 'function') {
      try {
        cytoscapeLib.use(elkExtension);
        elkAvailable = true;
      } catch (error) {
        console.error('Unable to register Cytoscape ELK extension', error);
        elkAvailable = false;
      }
    }
    elkRegistered = true;
  } else if (typeof window?.cytoscapeElk === 'function') {
    elkAvailable = true;
  }
  return cytoscapeLib;
}

const DEFAULT_LAYOUT = {
  name: 'elk',
  fit: true,
  padding: 50,
  nodeDimensionsIncludeLabels: true,
};

const BASE_STYLE = [
  {
    selector: 'node',
    style: {
      'background-color': '#475569',
      'border-width': 2,
      'border-color': '#0f172a',
      'color': '#e2e8f0',
      'font-size': 12,
      'font-weight': 600,
      'text-outline-width': 2,
      'text-outline-color': '#0f172a',
      'text-valign': 'center',
      'text-halign': 'center',
      'text-margin-y': '-2px',
      label: 'data(label)',
      width: 46,
      height: 46,
    },
  },
  {
    selector: 'node.node-group',
    style: {
      'background-color': 'rgba(15, 23, 42, 0.35)',
      'background-opacity': 0.45,
      'border-color': '#1e293b',
      'border-width': 2,
      'shape': 'round-rectangle',
      width: 'auto',
      height: 'auto',
      padding: 18,
      label: 'data(label)',
      'compound-sizing-wrt-labels': 'exclude',
      'color': '#cbd5f5',
      'font-size': 12,
      'font-weight': 700,
      'text-outline-width': 0,
      'text-valign': 'top',
      'text-halign': 'center',
      'text-margin-y': '-12px',
      'text-background-opacity': 0,
      'z-compound-depth': 'bottom',
    },
  },
  {
    selector: 'node.node-origin',
    style: {
      'background-color': '#1d4ed8',
      'border-color': '#1e3a8a',
    },
  },
  {
    selector: 'node.node-alternate',
    style: {
      'background-color': '#38bdf8',
      'border-color': '#0e7490',
      color: '#0f172a',
      'text-outline-color': '#f8fafc',
    },
  },
  {
    selector: 'node.node-other',
    style: {
      'background-color': '#64748b',
      'border-color': '#1f2937',
    },
  },
  {
    selector: 'edge',
    style: {
      width: 2,
      'line-color': '#94a3b8',
      'curve-style': 'bezier',
      'target-arrow-shape': 'none',
      'source-arrow-shape': 'none',
      'line-cap': 'round',
      label: 'data(sharedRunsLabel)',
      'font-size': 10,
      color: '#cbd5f5',
      'text-background-color': 'rgba(15, 23, 42, 0.65)',
      'text-background-opacity': 1,
      'text-background-padding': 2,
      'text-rotation': 'autorotate',
    },
  },
  {
    selector: 'edge.relationship-alternate',
    style: {
      width: 3,
      'line-style': 'dashed',
      'line-color': '#f87171',
      color: '#fecaca',
    },
  },
  {
    selector: 'edge.relationship-strong',
    style: {
      width: 4,
      'line-color': '#34d399',
      color: '#bbf7d0',
    },
  },
  {
    selector: 'edge.relationship-medium',
    style: {
      width: 3,
      'line-color': '#64748b',
      color: '#e2e8f0',
    },
  },
  {
    selector: 'edge.relationship-weak',
    style: {
      width: 2,
      'line-color': '#94a3b8',
      color: '#cbd5f5',
      opacity: 0.85,
    },
  },
];

export default function PlayerRelationshipGraph({
  elements,
  layout = DEFAULT_LAYOUT,
  className = '',
  ariaLabel,
}) {
  const containerRef = React.useRef(null);

  React.useEffect(() => {
    const cytoscapeLib = ensureCytoscape();
    if (!containerRef.current || !cytoscapeLib) {
      return undefined;
    }
    const resolvedElements = Array.isArray(elements) ? elements : [];
    const layoutOptions =
      typeof layout === 'string'
        ? { ...DEFAULT_LAYOUT, name: layout }
        : { ...DEFAULT_LAYOUT, ...(layout || {}) };
    if (layoutOptions?.name === 'elk' && !elkAvailable) {
      layoutOptions.name = 'breadthfirst';
    }
    const cy = cytoscapeLib({
      container: containerRef.current,
      elements: resolvedElements,
      layout: layoutOptions,
      style: BASE_STYLE,
      wheelSensitivity: 0.25,
      pixelRatio: 1,
    });

    const handleResize = () => {
      cy.resize();
      cy.layout(layoutOptions).run();
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      cy.destroy();
    };
  }, [elements, layout]);

  const combinedClassName = className
    ? `player-relationship-graph ${className}`
    : 'player-relationship-graph';

  return <div ref={containerRef} className={combinedClassName} role="img" aria-label={ariaLabel || undefined} />;
}
