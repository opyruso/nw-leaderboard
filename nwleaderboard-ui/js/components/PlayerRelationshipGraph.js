const LAYOUT_OPTIONS = {
  name: 'elk',
  fit: true,
  padding: 60,
  animate: false,
  nodeDimensionsIncludeLabels: true,
  elk: {
    'elk.direction': 'DOWN',
    'spacing.nodeNode': 50,
    'spacing.nodeNodeBetweenLayers': 50,
    'spacing.edgeEdge': 30,
    'spacing.edgeNode': 30,
  },
};

const GRAPH_STYLE = [
  {
    selector: 'node',
    style: {
      'background-color': 'data(color)',
      'background-opacity': 0.95,
      'border-color': 'rgba(15, 23, 42, 0.28)',
      'border-width': 2,
      color: '#f8fafc',
      'font-family': 'Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      'font-size': 14,
      label: 'data(label)',
      'text-wrap': 'wrap',
      'text-max-width': 160,
      'text-valign': 'center',
      'text-halign': 'center',
      'text-margin-y': 0,
      'text-outline-width': 3,
      'text-outline-color': 'rgba(15, 23, 42, 0.6)',
      'min-zoomed-font-size': 8,
      width: 'data(size)',
      height: 'data(size)',
      shape: 'round-rectangle',
      'padding': '12px',
    },
  },
  {
    selector: 'edge',
    style: {
      'curve-style': 'straight',
      'line-color': 'data(color)',
      'width': 'data(width)',
      'line-style': 'data(lineStyle)',
      'target-arrow-shape': 'none',
      'opacity': 0.92,
    },
  },
];

export default function PlayerRelationshipGraph({ elements }) {
  const containerRef = React.useRef(null);
  const cyRef = React.useRef(null);

  React.useEffect(() => {
    if (typeof window === 'undefined') {
      return () => {};
    }
    const cytoscapeLib = window.cytoscape;
    if (!cytoscapeLib || !containerRef.current) {
      return () => {};
    }

    if (window.cytoscapeElk && !window.__NWLB_CYTOSCAPE_ELK_REGISTERED__) {
      try {
        cytoscapeLib.use(window.cytoscapeElk);
        window.__NWLB_CYTOSCAPE_ELK_REGISTERED__ = true;
      } catch (registrationError) {
        console.error('Unable to register cytoscape-elk', registrationError);
      }
    }

    const cy = cytoscapeLib({
      container: containerRef.current,
      elements: Array.isArray(elements) ? elements : [],
      style: GRAPH_STYLE,
      wheelSensitivity: 0.25,
      boxSelectionEnabled: false,
      autoungrabify: false,
      minZoom: 0.2,
      maxZoom: 2.5,
      textureOnViewport: false,
    });

    cyRef.current = cy;

    const layout = cy.layout(LAYOUT_OPTIONS);
    layout.run();
    layout.one('layoutstop', () => {
      if (!cyRef.current) {
        return;
      }
      cyRef.current.fit(undefined, 80);
    });

    return () => {
      layout.stop();
      cy.destroy();
      cyRef.current = null;
    };
  }, []);

  React.useEffect(() => {
    const cy = cyRef.current;
    if (!cy) {
      return;
    }
    const safeElements = Array.isArray(elements) ? elements : [];
    cy.batch(() => {
      cy.elements().remove();
      if (safeElements.length > 0) {
        cy.add(safeElements);
      }
    });
    const layout = cy.layout(LAYOUT_OPTIONS);
    layout.run();
    layout.one('layoutstop', () => {
      if (!cyRef.current) {
        return;
      }
      cyRef.current.fit(undefined, 80);
    });
  }, [elements]);

  React.useEffect(() => {
    const handleResize = () => {
      if (!cyRef.current) {
        return;
      }
      cyRef.current.resize();
    };
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  return <div ref={containerRef} className="player-relationship-graph" role="presentation" aria-hidden="true" />;
}
