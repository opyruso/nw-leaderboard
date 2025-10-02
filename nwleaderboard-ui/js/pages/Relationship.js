import { LangContext } from '../i18n.js';
import { ThemeContext } from '../theme.js';

const { Link, useParams } = ReactRouterDOM;

const API_BASE_URL = (window.CONFIG?.['nwleaderboard-api-url'] || '').replace(/\/$/, '');

function createEmptyGraphState() {
  return {
    nodes: new Map(),
    edges: new Map(),
    nodeOwners: new Map(),
    edgeOwners: new Map(),
    expanded: new Set(),
  };
}

function cloneOwnerMap(source) {
  const clone = new Map();
  source.forEach((owners, id) => {
    clone.set(id, new Set(owners));
  });
  return clone;
}

function addOwner(ownerMap, id, ownerId) {
  if (!id || !ownerId) {
    return;
  }
  let owners = ownerMap.get(id);
  if (!owners) {
    owners = new Set();
    ownerMap.set(id, owners);
  }
  owners.add(ownerId);
}

function removeOwner(ownerMap, id, ownerId) {
  if (!id || !ownerId) {
    return false;
  }
  const owners = ownerMap.get(id);
  if (!owners) {
    return false;
  }
  owners.delete(ownerId);
  if (owners.size === 0) {
    ownerMap.delete(id);
    return true;
  }
  return false;
}

function toNumeric(value) {
  if (value === undefined || value === null || value === '') {
    return 0;
  }
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

function computeNodeSize(node) {
  const base = node.type === 'origin' ? 88 : node.type === 'alternate' ? 64 : 44;
  const scale = Math.min(Math.log10(toNumeric(node.runCount) + 1) * 28, 42);
  return base + scale;
}

function computeEdgeWidth(edge) {
  if (edge.alternate) {
    return 2;
  }
  const count = toNumeric(edge.runCount);
  if (count <= 0) {
    return 2;
  }
  return Math.min(2 + Math.log10(count + 1) * 2.6, 9);
}

function formatRunCountLabel(t, count) {
  if (!Number.isFinite(count)) {
    return '';
  }
  if (typeof t.relationshipRunCount === 'function') {
    return t.relationshipRunCount(count);
  }
  if (count === 1) {
    return '1';
  }
  return String(count);
}

function mergeGraphData(previous, ownerId, payload, t) {
  const ownerKey = ownerId ? String(ownerId) : '';
  const nodes = new Map(previous.nodes);
  const edges = new Map(previous.edges);
  const nodeOwners = cloneOwnerMap(previous.nodeOwners);
  const edgeOwners = cloneOwnerMap(previous.edgeOwners);
  const expanded = new Set(previous.expanded);

  function registerNode(nodePayload) {
    if (!nodePayload || nodePayload.playerId === null || nodePayload.playerId === undefined) {
      return;
    }
    const id = String(nodePayload.playerId);
    const existing = nodes.get(id) || {};
    const type = existing.type || (nodePayload.origin ? 'origin' : nodePayload.alternate ? 'alternate' : 'related');
    const runCount = Math.max(toNumeric(nodePayload.runCount), toNumeric(existing.runCount));
    const label = nodePayload.playerName || existing.label || (t.playerIdLabel ? t.playerIdLabel(id) : `ID #${id}`);
    nodes.set(id, {
      id,
      label,
      type,
      runCount,
    });
    if (ownerKey) {
      addOwner(nodeOwners, id, ownerKey);
    }
  }

  function registerEdge(edgePayload) {
    if (!edgePayload) {
      return;
    }
    const source = edgePayload.sourcePlayerId;
    const target = edgePayload.targetPlayerId;
    if (source === null || source === undefined || target === null || target === undefined) {
      return;
    }
    const sourceId = String(source);
    const targetId = String(target);
    const [first, second] = sourceId <= targetId ? [sourceId, targetId] : [targetId, sourceId];
    const key = `${first}__${second}`;
    const runCount = edgePayload.runCount !== undefined && edgePayload.runCount !== null
      ? toNumeric(edgePayload.runCount)
      : null;
    const alternate = Boolean(edgePayload.alternateLink);
    const existing = edges.get(key);
    if (existing) {
      edges.set(key, {
        id: key,
        source: existing.source,
        target: existing.target,
        runCount: runCount !== null ? Math.max(runCount, toNumeric(existing.runCount)) : existing.runCount,
        alternate: existing.alternate || alternate,
      });
    } else {
      edges.set(key, {
        id: key,
        source: sourceId,
        target: targetId,
        runCount,
        alternate,
      });
    }
    if (ownerKey) {
      addOwner(edgeOwners, key, ownerKey);
    }
  }

  if (payload && typeof payload === 'object') {
    registerNode(payload.origin);
    if (Array.isArray(payload.alternates)) {
      payload.alternates.forEach(registerNode);
    }
    if (Array.isArray(payload.relatedPlayers)) {
      payload.relatedPlayers.forEach(registerNode);
    }
    if (Array.isArray(payload.edges)) {
      payload.edges.forEach(registerEdge);
    }
  }

  if (ownerKey) {
    expanded.add(ownerKey);
  }

  return { nodes, edges, nodeOwners, edgeOwners, expanded };
}

function collapseGraphData(previous, ownerId) {
  const ownerKey = ownerId ? String(ownerId) : '';
  if (!ownerKey) {
    return previous;
  }
  const nodes = new Map(previous.nodes);
  const edges = new Map(previous.edges);
  const nodeOwners = cloneOwnerMap(previous.nodeOwners);
  const edgeOwners = cloneOwnerMap(previous.edgeOwners);
  const expanded = new Set(previous.expanded);

  expanded.delete(ownerKey);

  nodeOwners.forEach((owners, id) => {
    if (removeOwner(nodeOwners, id, ownerKey)) {
      nodes.delete(id);
    }
  });

  edgeOwners.forEach((owners, id) => {
    if (removeOwner(edgeOwners, id, ownerKey)) {
      edges.delete(id);
    }
  });

  edges.forEach((edge, key) => {
    if (!nodes.has(edge.source) || !nodes.has(edge.target)) {
      edges.delete(key);
      edgeOwners.delete(key);
    }
  });

  return { nodes, edges, nodeOwners, edgeOwners, expanded };
}

function applyGraphTheme(cy, theme) {
  if (!cy) {
    return;
  }
  const isLight = theme === 'light';
  const nodeText = isLight ? '#0f172a' : '#f8fafc';
  const labelBackground = isLight ? 'rgba(226, 232, 240, 0.85)' : 'rgba(15, 23, 42, 0.75)';
  const relatedBg = isLight ? '#0ea5e9' : '#0284c7';
  const relatedBorder = isLight ? '#0284c7' : '#38bdf8';
  const originBg = isLight ? '#6d28d9' : '#7c3aed';
  const originBorder = isLight ? '#a855f7' : '#c084fc';
  const altBg = isLight ? '#fb923c' : '#f97316';
  const altBorder = isLight ? '#f97316' : '#fb923c';
  const edgeColor = isLight ? '#0f172a' : '#f8fafc';
  const edgeLine = isLight ? '#64748b' : '#94a3b8';
  cy.style()
    .fromJson([
      {
        selector: 'node',
        style: {
          'background-color': relatedBg,
          'border-color': relatedBorder,
          'border-width': 2,
          'color': nodeText,
          'width': 'data(size)',
          'height': 'data(size)',
          'label': 'data(label)',
          'font-size': '12px',
          'text-wrap': 'wrap',
          'text-max-width': '120px',
          'text-valign': 'center',
          'text-halign': 'center',
          'text-background-color': labelBackground,
          'text-background-opacity': 1,
          'text-background-padding': 2,
        },
      },
      {
        selector: 'node[type = "origin"]',
        style: {
          'background-color': originBg,
          'border-color': originBorder,
          'font-size': '13px',
          'font-weight': '600',
        },
      },
      {
        selector: 'node[type = "alternate"]',
        style: {
          'background-color': altBg,
          'border-color': altBorder,
        },
      },
      {
        selector: 'edge',
        style: {
          'line-color': edgeLine,
          'width': 'data(width)',
          'curve-style': 'bezier',
          'target-arrow-shape': 'none',
          'control-point-step-size': 60,
          'label': 'data(label)',
          'font-size': '11px',
          'color': edgeColor,
          'text-background-color': labelBackground,
          'text-background-opacity': 1,
          'text-background-padding': 2,
          'opacity': 0.9,
        },
      },
      {
        selector: 'edge[alternateLink = 1]',
        style: {
          'line-style': 'dashed',
          'line-color': altBg,
          'width': 3,
          'label': '',
          'opacity': 0.7,
        },
      },
      {
        selector: 'node:selected',
        style: {
          'border-width': 4,
          'border-color': isLight ? '#2563eb' : '#38bdf8',
        },
      },
    ])
    .update();
}

export default function Relationship() {
  const { t } = React.useContext(LangContext);
  const { theme } = React.useContext(ThemeContext);
  const params = useParams();
  const routePlayerId = params?.playerId;
  const [graphData, setGraphData] = React.useState(() => createEmptyGraphState());
  const graphRef = React.useRef(graphData);
  const [initialLoading, setInitialLoading] = React.useState(true);
  const [initialError, setInitialError] = React.useState(false);
  const [actionError, setActionError] = React.useState('');
  const [loadingNodes, setLoadingNodes] = React.useState(() => new Set());
  const loadingNodesRef = React.useRef(new Set());
  const [cyUnavailable, setCyUnavailable] = React.useState(false);
  const containerRef = React.useRef(null);
  const cyRef = React.useRef(null);

  React.useEffect(() => {
    graphRef.current = graphData;
  }, [graphData]);

  const normalisedPlayerId = React.useMemo(() => {
    if (routePlayerId === undefined || routePlayerId === null) {
      return '';
    }
    if (typeof routePlayerId === 'string') {
      return routePlayerId.trim();
    }
    return String(routePlayerId);
  }, [routePlayerId]);

  const originNodeLabel = React.useMemo(() => {
    if (!normalisedPlayerId) {
      return '';
    }
    const node = graphData.nodes.get(String(normalisedPlayerId));
    return node?.label || '';
  }, [graphData.nodes, normalisedPlayerId]);

  React.useEffect(() => {
    const cytoscapeLib = window.cytoscape;
    if (typeof cytoscapeLib !== 'function') {
      setCyUnavailable(true);
      return undefined;
    }
    if (!containerRef.current) {
      return undefined;
    }
    const cy = cytoscapeLib({
      container: containerRef.current,
      elements: [],
      userZoomingEnabled: true,
      wheelSensitivity: 0.2,
      autoungrabify: false,
      autounselectify: false,
      boxSelectionEnabled: false,
    });
    setCyUnavailable(false);
    cyRef.current = cy;
    applyGraphTheme(cy, theme);
    const handleResize = () => {
      cy.resize();
    };
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      cy.destroy();
      cyRef.current = null;
    };
  }, []);

  React.useEffect(() => {
    const cy = cyRef.current;
    if (!cy) {
      return;
    }
    applyGraphTheme(cy, theme);
  }, [theme]);

  function updateLoadingNodes(updater) {
    setLoadingNodes((prev) => {
      const next = new Set(prev);
      updater(next);
      return next;
    });
  }

  const fetchRelationships = React.useCallback(async (playerId) => {
    if (!playerId) {
      throw new Error('invalid player id');
    }
    const encoded = encodeURIComponent(playerId);
    const response = await fetch(`${API_BASE_URL}/player/${encoded}/relationships`);
    if (!response.ok) {
      const error = new Error(`Failed to load relationships: ${response.status}`);
      error.status = response.status;
      throw error;
    }
    return response.json();
  }, []);

  React.useEffect(() => {
    let cancelled = false;
    const playerId = normalisedPlayerId;
    setInitialLoading(true);
    setInitialError(false);
    setActionError('');
    setGraphData(createEmptyGraphState());
    loadingNodesRef.current.clear();
    setLoadingNodes(new Set());
    if (!playerId) {
      setInitialLoading(false);
      setInitialError(true);
      return undefined;
    }
    fetchRelationships(playerId)
      .then((payload) => {
        if (cancelled) {
          return;
        }
        setGraphData((prev) => mergeGraphData(createEmptyGraphState(), playerId, payload, t));
        setInitialLoading(false);
      })
      .catch(() => {
        if (cancelled) {
          return;
        }
        setInitialError(true);
        setInitialLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [fetchRelationships, normalisedPlayerId, t]);

  const handleNodeToggle = React.useCallback(
    (nodeId) => {
      if (!nodeId) {
        return;
      }
      const ownerId = String(nodeId);
      const originId = String(normalisedPlayerId);
      if (ownerId === originId) {
        return;
      }
      const currentGraph = graphRef.current;
      if (!currentGraph.nodes.has(ownerId)) {
        return;
      }
      if (currentGraph.expanded.has(ownerId)) {
        setGraphData((prev) => collapseGraphData(prev, ownerId));
        return;
      }
      if (loadingNodesRef.current.has(ownerId)) {
        return;
      }
      loadingNodesRef.current.add(ownerId);
      updateLoadingNodes((set) => set.add(ownerId));
      setActionError('');
      fetchRelationships(ownerId)
        .then((payload) => {
          setGraphData((prev) => mergeGraphData(prev, ownerId, payload, t));
        })
        .catch(() => {
          setActionError(t.relationshipFetchFailed || 'Unable to load additional relationships.');
        })
        .finally(() => {
          loadingNodesRef.current.delete(ownerId);
          updateLoadingNodes((set) => set.delete(ownerId));
        });
    },
    [fetchRelationships, normalisedPlayerId, t],
  );

  React.useEffect(() => {
    const cy = cyRef.current;
    if (!cy) {
      return;
    }
    cy.off('tap');
    cy.on('tap', 'node', (event) => {
      const id = event?.target?.id();
      if (!id) {
        return;
      }
      handleNodeToggle(id);
    });
    return () => {
      cy.off('tap');
    };
  }, [handleNodeToggle]);

  React.useEffect(() => {
    const cy = cyRef.current;
    if (!cy) {
      return;
    }
    cy.startBatch();
    const nodeIds = new Set(graphData.nodes.keys());
    cy.nodes().forEach((node) => {
      if (!nodeIds.has(node.id())) {
        cy.remove(node);
      }
    });
    const edgeIds = new Set(graphData.edges.keys());
    cy.edges().forEach((edge) => {
      if (!edgeIds.has(edge.id())) {
        cy.remove(edge);
      }
    });
    graphData.nodes.forEach((node, id) => {
      const size = computeNodeSize(node);
      const existing = cy.getElementById(id);
      const data = {
        id,
        label: node.label,
        type: node.type,
        size,
        runCount: node.runCount,
      };
      if (existing && existing.nonempty()) {
        existing.data(data);
      } else {
        cy.add({ group: 'nodes', data });
      }
    });
    graphData.edges.forEach((edge, id) => {
      const width = computeEdgeWidth(edge);
      const label = edge.alternate
        ? ''
        : formatRunCountLabel(t, edge.runCount !== null && edge.runCount !== undefined ? edge.runCount : 0);
      const data = {
        id,
        source: edge.source,
        target: edge.target,
        width,
        label,
        alternateLink: edge.alternate ? 1 : 0,
      };
      const existing = cy.getElementById(id);
      if (existing && existing.nonempty()) {
        existing.data(data);
      } else {
        cy.add({ group: 'edges', data });
      }
    });
    cy.endBatch();
    const layout = cy.layout({
      name: 'cose',
      animate: false,
      fit: true,
      padding: 160,
      nodeRepulsion: 140000,
      idealEdgeLength: 240,
      edgeElasticity: 0.18,
      gravity: 0.35,
      componentSpacing: 320,
      nodeOverlap: 6,
    });
    layout.run();
    cy.resize();
  }, [graphData, t]);

  const loadingLabels = React.useMemo(() => {
    const labels = [];
    loadingNodes.forEach((id) => {
      const node = graphData.nodes.get(id);
      if (node && node.label) {
        labels.push(node.label);
      }
    });
    return labels;
  }, [graphData.nodes, loadingNodes]);

  const hasRelatedEdges = React.useMemo(() => {
    for (const edge of graphData.edges.values()) {
      if (!edge.alternate) {
        return true;
      }
    }
    return false;
  }, [graphData.edges]);

  const statusMessage = React.useMemo(() => {
    if (initialError) {
      return t.relationshipError || 'Unable to load relationship data.';
    }
    if (initialLoading) {
      return t.relationshipLoading || 'Loading relationship data…';
    }
    if (cyUnavailable) {
      return t.relationshipUnsupported || 'Relationship graph unavailable.';
    }
    if (!hasRelatedEdges) {
      return t.relationshipEmpty || 'No related players were found.';
    }
    return '';
  }, [cyUnavailable, hasRelatedEdges, initialError, initialLoading, t]);

  const instructions = t.relationshipInstructions || 'Click a player to expand or collapse their connections.';

  return (
    <div className="relationship-page">
      <header className="relationship-header">
        <div className="relationship-title-group">
          <h1 className="relationship-title">
            {t.relationshipTitle || 'Relationship graph'}
            {originNodeLabel ? ` — ${originNodeLabel}` : ''}
          </h1>
          <p className="relationship-instructions">{instructions}</p>
        </div>
        <div className="relationship-actions">
          <Link
            to={normalisedPlayerId ? `/player/${encodeURIComponent(normalisedPlayerId)}` : '/player'}
            className="button-tertiary relationship-back"
          >
            {t.relationshipBackToProfile || 'Back to profile'}
          </Link>
        </div>
      </header>
      {statusMessage ? <p className="relationship-status">{statusMessage}</p> : null}
      {actionError ? <p className="relationship-action-error">{actionError}</p> : null}
      {loadingLabels.length > 0 ? (
        <p className="relationship-status relationship-status--loading">
          {(t.relationshipExpanding || 'Expanding')}:{' '}
          {loadingLabels.join(', ')}
        </p>
      ) : null}
      <div className="relationship-graph-container">
        <div
          ref={containerRef}
          className="relationship-graph"
          role="img"
          aria-label={t.relationshipGraphAria || 'Interactive relationship graph'}
        />
      </div>
    </div>
  );
}
