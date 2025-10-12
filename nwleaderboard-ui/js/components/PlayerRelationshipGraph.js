let elkRegistered = false;
let elkAvailable = false;
let fcoseRegistered = false;
let fcoseAvailable = false;
let colaRegistered = false;
let colaAvailable = false;

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
  if (!fcoseRegistered) {
    const fcoseExtension = window?.cytoscapeFcose;
    if (typeof fcoseExtension === 'function') {
      try {
        cytoscapeLib.use(fcoseExtension);
        fcoseAvailable = true;
      } catch (error) {
        console.error('Unable to register Cytoscape fCoSE extension', error);
        fcoseAvailable = false;
      }
    }
    fcoseRegistered = true;
  } else if (typeof window?.cytoscapeFcose === 'function') {
    fcoseAvailable = true;
  }
  if (!colaRegistered) {
    const colaExtension = window?.cytoscapeCola;
    if (typeof colaExtension === 'function') {
      try {
        cytoscapeLib.use(colaExtension);
        colaAvailable = true;
      } catch (error) {
        console.error('Unable to register Cytoscape CoLa extension', error);
        colaAvailable = false;
      }
    }
    colaRegistered = true;
  } else if (typeof window?.cytoscapeCola === 'function') {
    colaAvailable = true;
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
  {
    selector: 'node.selected',
    style: {
      'border-color': '#facc15',
      'border-width': 3,
      'background-opacity': 1,
      'box-shadow': '0 0 0 2px rgba(250, 204, 21, 0.35)',
    },
  },
  {
    selector: 'node.faded',
    style: {
      opacity: 0.25,
      'text-opacity': 0.25,
    },
  },
  {
    selector: 'edge.faded',
    style: {
      opacity: 0.2,
      'text-opacity': 0.25,
    },
  },
  {
    selector: 'node.highlighted',
    style: {
      opacity: 1,
    },
  },
  {
    selector: 'edge.highlighted',
    style: {
      opacity: 1,
    },
  },
];

const PlayerRelationshipGraph = React.forwardRef(function PlayerRelationshipGraph(
  { elements, layout = DEFAULT_LAYOUT, className = '', ariaLabel, onSelectionChange },
  forwardedRef,
) {
  const containerRef = React.useRef(null);
  const selectionRef = React.useRef(new Set());
  const resetSelectionRef = React.useRef(() => {});
  const lastSelectionSizeRef = React.useRef(0);

  React.useImperativeHandle(
    forwardedRef,
    () => ({
      resetSelection: () => {
        const reset = resetSelectionRef.current;
        if (typeof reset === 'function') {
          reset();
        }
      },
    }),
    [],
  );

  React.useEffect(() => {
    const cytoscapeLib = ensureCytoscape();
    if (!containerRef.current || !cytoscapeLib) {
      selectionRef.current = new Set();
      resetSelectionRef.current = () => {};
      lastSelectionSizeRef.current = 0;
      if (typeof onSelectionChange === 'function') {
        onSelectionChange(false);
      }
      return undefined;
    }
    const resolvedElements = Array.isArray(elements) ? elements : [];
    const layoutOptions =
      typeof layout === 'string'
        ? { ...DEFAULT_LAYOUT, name: layout }
        : { ...DEFAULT_LAYOUT, ...(layout || {}) };
    if (layoutOptions?.name === 'elk' && !elkAvailable) {
      layoutOptions.name = 'breadthfirst';
    } else if (layoutOptions?.name === 'fcose' && !fcoseAvailable) {
      layoutOptions.name = 'cose';
    } else if (layoutOptions?.name === 'cola' && !colaAvailable) {
      layoutOptions.name = 'cose';
    }
    const cy = cytoscapeLib({
      container: containerRef.current,
      elements: resolvedElements,
      layout: layoutOptions,
      style: BASE_STYLE,
      pixelRatio: 1,
    });

    const selection = new Set();
    selectionRef.current = selection;
    lastSelectionSizeRef.current = 0;
    if (typeof onSelectionChange === 'function') {
      onSelectionChange(false);
    }

    const applySelectionStyles = () => {
      if (!cy || cy.destroyed()) {
        return;
      }
      let hasInvalidSelection = false;
      Array.from(selection).forEach((id) => {
        const element = cy.getElementById(id);
        if (!element || element.empty()) {
          selection.delete(id);
          hasInvalidSelection = true;
        }
      });
      const hasSelection = selection.size > 0;
      cy.batch(() => {
        cy.nodes().removeClass('selected highlighted faded');
        cy.edges().removeClass('highlighted faded');
        if (!hasSelection) {
          return;
        }
        const selectedNodes = cy.nodes().filter((node) => selection.has(node.id()));
        selectedNodes.addClass('selected');
        const neighbourhood = selectedNodes.closedNeighborhood();
        neighbourhood.nodes().addClass('highlighted');
        neighbourhood.edges().addClass('highlighted');
        cy.nodes().not(neighbourhood.nodes()).addClass('faded');
        cy.edges().not(neighbourhood.edges()).addClass('faded');
      });
      const selectionSize = selection.size;
      if (hasInvalidSelection || lastSelectionSizeRef.current !== selectionSize) {
        lastSelectionSizeRef.current = selectionSize;
        if (typeof onSelectionChange === 'function') {
          onSelectionChange(selectionSize > 0);
        }
      }
    };

    const handleNodeTap = (event) => {
      const target = event?.target;
      if (!target || typeof target.id !== 'function') {
        return;
      }
      const nodeId = target.id();
      if (!nodeId) {
        return;
      }
      if (selection.has(nodeId)) {
        selection.delete(nodeId);
      } else {
        selection.add(nodeId);
      }
      applySelectionStyles();
    };

    const resetSelection = () => {
      if (selection.size === 0) {
        return;
      }
      selection.clear();
      applySelectionStyles();
    };

    resetSelectionRef.current = resetSelection;

    cy.on('tap', 'node', handleNodeTap);

    const handleResize = () => {
      cy.resize();
      cy.layout(layoutOptions).run();
    };
    window.addEventListener('resize', handleResize);

    applySelectionStyles();

    return () => {
      window.removeEventListener('resize', handleResize);
      cy.off('tap', 'node', handleNodeTap);
      resetSelectionRef.current = () => {};
      selectionRef.current = new Set();
      lastSelectionSizeRef.current = 0;
      if (typeof onSelectionChange === 'function') {
        onSelectionChange(false);
      }
      cy.destroy();
    };
  }, [elements, layout, onSelectionChange]);

  const combinedClassName = className
    ? `player-relationship-graph ${className}`
    : 'player-relationship-graph';

  return <div ref={containerRef} className={combinedClassName} role="img" aria-label={ariaLabel || undefined} />;
});

export default PlayerRelationshipGraph;
