import cytoscape from 'cytoscape';
import cytoscapeElk from 'cytoscape-elk';
import ELK from 'elkjs/lib/elk.bundled.js';

let elkInitialised = false;
function ensureElkRegistered() {
  if (!elkInitialised) {
    cytoscapeElk(cytoscape, ELK);
    elkInitialised = true;
  }
}

const DEFAULT_STYLE = [
  {
    selector: 'node',
    style: {
      'background-color': 'data(color)',
      label: 'data(label)',
      color: '#f8fafc',
      'font-size': 12,
      'text-max-width': 140,
      'text-wrap': 'wrap',
      'text-valign': 'center',
      'text-halign': 'center',
      'padding': '10px',
      'shape': 'round-rectangle',
      'border-width': 1.5,
      'border-color': 'rgba(15, 23, 42, 0.45)',
    },
  },
  {
    selector: 'edge',
    style: {
      'line-color': 'data(color)',
      'target-arrow-color': 'data(color)',
      'target-arrow-shape': 'none',
      'line-style': 'data(lineStyle)',
      width: 'data(width)',
      opacity: 'data(opacity)',
      'curve-style': 'bezier',
      label: 'data(label)',
      'font-size': 11,
      color: '#cbd5f5',
      'text-background-color': 'rgba(15, 23, 42, 0.85)',
      'text-background-opacity': 0.85,
      'text-background-padding': 3,
      'text-rotation': 'autorotate',
    },
  },
];

const DEFAULT_LAYOUT = {
  name: 'elk',
  fit: true,
  padding: 30,
  animate: false,
  elk: {
    algorithm: 'layered',
    'spacing.nodeNodeBetweenLayers': 70,
    'spacing.edgeEdgeBetweenLayers': 40,
  },
};

function normaliseElements(data) {
  if (!data) {
    return { nodes: [], edges: [] };
  }
  const nodes = (Array.isArray(data.nodes) ? data.nodes : []).map((entry, index) => {
    const payload = entry && typeof entry === 'object' && entry.data ? entry.data : entry;
    const id = payload?.id !== undefined && payload?.id !== null ? String(payload.id) : `node-${index}`;
    const label = payload?.label !== undefined && payload?.label !== null ? String(payload.label) : '';
    return {
      data: {
        id,
        label,
        color: payload?.color || '#94a3b8',
        type: payload?.type || 'teammate',
      },
    };
  });

  const edges = (Array.isArray(data.edges) ? data.edges : []).map((entry, index) => {
    const payload = entry && typeof entry === 'object' && entry.data ? entry.data : entry;
    const source = payload?.source !== undefined && payload?.source !== null ? String(payload.source) : '';
    const target = payload?.target !== undefined && payload?.target !== null ? String(payload.target) : '';
    const id = payload?.id !== undefined && payload?.id !== null ? String(payload.id) : `edge-${index}`;
    const count = Number(payload?.count ?? 0);
    const label = Number.isFinite(count) && count > 0 ? String(count) : '';
    return {
      data: {
        id,
        source,
        target,
        color: payload?.color || '#94a3b8',
        lineStyle: payload?.lineStyle || 'solid',
        width: Number.isFinite(Number(payload?.width)) ? Number(payload.width) : 2,
        opacity: Number.isFinite(Number(payload?.opacity)) ? Number(payload.opacity) : 0.9,
        count,
        label,
      },
    };
  });

  return { nodes, edges };
}

export default function PlayerRelationshipGraph({
  apiBaseUrl,
  playerId,
  seasonId,
  active,
  loadingLabel,
  errorLabel,
  emptyLabel,
}) {
  const containerRef = React.useRef(null);
  const cyRef = React.useRef(null);
  const [state, setState] = React.useState({ status: 'idle', data: null, error: null });

  const key = React.useMemo(() => `${playerId ?? ''}:${seasonId ?? ''}`, [playerId, seasonId]);

  React.useEffect(() => {
    setState({ status: 'idle', data: null, error: null });
    if (cyRef.current) {
      cyRef.current.destroy();
      cyRef.current = null;
    }
  }, [key]);

  React.useEffect(() => {
    if (!active) {
      return undefined;
    }
    if (!playerId || state.status === 'loading' || state.status === 'success') {
      return undefined;
    }
    const controller = new AbortController();
    let cancelled = false;

    setState((previous) => ({ ...previous, status: 'loading', error: null }));

    const params = new URLSearchParams();
    if (seasonId !== null && seasonId !== undefined) {
      params.set('seasonId', seasonId);
    }
    const query = params.toString();
    const url = query
      ? `${apiBaseUrl}/player/${encodeURIComponent(playerId)}/relationships?${query}`
      : `${apiBaseUrl}/player/${encodeURIComponent(playerId)}/relationships`;

    fetch(url, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Failed to load relationships: ${response.status}`);
        }
        return response.json();
      })
      .then((data) => {
        if (cancelled) {
          return;
        }
        setState({ status: 'success', data, error: null });
      })
      .catch((error) => {
        if (cancelled || error.name === 'AbortError') {
          return;
        }
        console.error('Unable to load relationship graph', error);
        setState({ status: 'error', data: null, error });
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [active, apiBaseUrl, playerId, seasonId, state.status]);

  React.useEffect(() => {
    if (!active) {
      return undefined;
    }
    if (state.status !== 'success' || !containerRef.current) {
      return undefined;
    }

    ensureElkRegistered();
    const elements = normaliseElements(state.data);
    const cy = cytoscape({
      container: containerRef.current,
      elements: [...elements.nodes, ...elements.edges],
      style: DEFAULT_STYLE,
      layout: DEFAULT_LAYOUT,
      pixelRatio: 'auto',
      wheelSensitivity: 0.2,
    });

    cyRef.current = cy;

    const handleResize = () => {
      if (cyRef.current) {
        cyRef.current.resize();
        cyRef.current.fit();
      }
    };

    window.addEventListener('resize', handleResize);
    cy.on('layoutstop', () => {
      cy.fit();
    });

    return () => {
      window.removeEventListener('resize', handleResize);
      cy.destroy();
      cyRef.current = null;
    };
  }, [active, state.status, state.data]);

  React.useEffect(() => {
    if (!active && cyRef.current) {
      cyRef.current.destroy();
      cyRef.current = null;
    }
  }, [active]);

  const status = state.status;

  if (status === 'loading') {
    return (
      <div className="player-relationship-placeholder">
        <p>{loadingLabel}</p>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="player-relationship-placeholder error">
        <p>{errorLabel}</p>
      </div>
    );
  }

  const hasNodes = Array.isArray(state.data?.nodes) && state.data.nodes.length > 1;
  if (!hasNodes) {
    return (
      <div className="player-relationship-placeholder">
        <p>{emptyLabel}</p>
      </div>
    );
  }

  return <div ref={containerRef} className="player-relationship-graph" role="presentation" />;
}
