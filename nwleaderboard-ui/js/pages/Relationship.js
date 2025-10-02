import { LangContext } from '../i18n.js';

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

  function registerAlternateEdge(mainPayload, alternatePayload) {
    if (!mainPayload || !alternatePayload) {
      return;
    }
    const mainId = mainPayload.playerId;
    const altId = alternatePayload.playerId;
    if (
      mainId === null ||
      mainId === undefined ||
      altId === null ||
      altId === undefined ||
      mainId === altId
    ) {
      return;
    }
    const mainKey = String(mainId);
    const altKey = String(altId);
    const [first, second] = mainKey <= altKey ? [mainKey, altKey] : [altKey, mainKey];
    const key = `${first}__${second}`;
    const existing = edges.get(key);
    const source = existing?.source || mainKey;
    const target = existing?.target || (source === mainKey ? altKey : mainKey);
    const runCount = existing?.runCount ?? null;
    edges.set(key, {
      id: key,
      source,
      target,
      runCount,
      alternate: true,
    });
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

    let primaryNode = null;
    const alternates = Array.isArray(payload.alternates) ? payload.alternates : [];
    if (
      payload.origin &&
      payload.origin.playerId !== null &&
      payload.origin.playerId !== undefined &&
      payload.origin.origin &&
      !payload.origin.alternate
    ) {
      primaryNode = payload.origin;
    }
    if (!primaryNode) {
      primaryNode = alternates.find(
        (node) =>
          node &&
          node.playerId !== null &&
          node.playerId !== undefined &&
          node.alternate === false,
      );
    }
    if (!primaryNode && payload.origin && payload.origin.playerId !== null && payload.origin.playerId !== undefined) {
      primaryNode = payload.origin;
    }
    if (primaryNode) {
      const primaryId = String(primaryNode.playerId);
      const uniqueAlternates = new Map();
      if (
        payload.origin &&
        payload.origin.playerId !== null &&
        payload.origin.playerId !== undefined &&
        String(payload.origin.playerId) !== primaryId &&
        payload.origin.alternate
      ) {
        uniqueAlternates.set(String(payload.origin.playerId), payload.origin);
      }
      alternates.forEach((node) => {
        if (!node || node.playerId === null || node.playerId === undefined) {
          return;
        }
        const id = String(node.playerId);
        if (id === primaryId) {
          return;
        }
        if (node.alternate) {
          uniqueAlternates.set(id, node);
        }
      });
      uniqueAlternates.forEach((node) => {
        registerAlternateEdge(primaryNode, node);
      });
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

export default function Relationship() {
  const { t } = React.useContext(LangContext);
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
  const layoutNameRef = React.useRef('cose');

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
    let fcoseAvailable = false;
    if (typeof cytoscapeLib.extension === 'function' && typeof cytoscapeLib.use === 'function') {
      fcoseAvailable = Boolean(cytoscapeLib.extension('layout', 'fcose'));
      if (!fcoseAvailable) {
        const fcose = window.cytoscapeFcose;
        if (typeof fcose === 'function') {
          cytoscapeLib.use(fcose);
          fcoseAvailable = Boolean(cytoscapeLib.extension('layout', 'fcose'));
        }
      }
    }
    layoutNameRef.current = fcoseAvailable ? 'fcose' : 'cose';
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
      const existing = cy.getElementById(id);
      const data = {
        id,
        label: node.label,
        type: node.type,
        runCount: node.runCount,
      };
      if (existing && existing.nonempty()) {
        existing.data(data);
      } else {
        cy.add({ group: 'nodes', data });
      }
    });
    graphData.edges.forEach((edge, id) => {
      const data = {
        id,
        source: edge.source,
        target: edge.target,
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
    const layoutName = layoutNameRef.current;
    const layoutOptions = {
      name: layoutName,
      animate: false,
      fit: true,
      padding: layoutName === 'fcose' ? 240 : 220,
    };
    if (layoutName === 'fcose') {
      Object.assign(layoutOptions, {
        quality: 'proof',
        randomize: false,
        nodeDimensionsIncludeLabels: true,
        packComponents: true,
        nodeRepulsion: 140000,
        nodeSeparation: 180,
        idealEdgeLength: 380,
        edgeElasticity: 0.07,
        gravity: 0.18,
        gravityRange: 3.5,
        gravityCompound: 0.65,
        gravityRangeCompound: 3.1,
        tilingPaddingHorizontal: 128,
        tilingPaddingVertical: 128,
        uniformNodeDimensions: false,
        numIter: 2800,
      });
    } else {
      Object.assign(layoutOptions, {
        nodeDimensionsIncludeLabels: true,
        nodeRepulsion: 180000,
        idealEdgeLength: 360,
        edgeElasticity: 0.07,
        gravity: 0.2,
        componentSpacing: 400,
        nodeOverlap: 12,
      });
    }

    const runLayout = (options, isFallback = false) => {
      const layoutInstance = cy.layout(options);
      if (!isFallback) {
        layoutInstance.one('layoutstop', () => {
          const nodes = cy.nodes();
          if (nodes.length <= 1) {
            return;
          }
          let minX = Infinity;
          let minY = Infinity;
          let maxX = -Infinity;
          let maxY = -Infinity;
          nodes.forEach((node) => {
            const position = node.position();
            if (!position) {
              return;
            }
            if (position.x < minX) {
              minX = position.x;
            }
            if (position.x > maxX) {
              maxX = position.x;
            }
            if (position.y < minY) {
              minY = position.y;
            }
            if (position.y > maxY) {
              maxY = position.y;
            }
          });
          const spreadX = maxX - minX;
          const spreadY = maxY - minY;
          if (spreadX < 120 && spreadY < 120) {
            runLayout(
              {
                name: 'breadthfirst',
                animate: false,
                fit: true,
                padding: 260,
                circle: false,
                spacingFactor: 1.4,
                avoidOverlap: true,
              },
              true,
            );
          }
        });
      }
      layoutInstance.run();
    };

    runLayout(layoutOptions);
    cy.resize();
  }, [graphData]);

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
