const radarLabelFooterPlugin = {
  id: 'radarLabelFooter',
  afterDatasetsDraw(chart) {
    const scale = chart?.scales?.r;
    if (!scale) {
      return;
    }
    const pluginOptions = chart.options?.plugins?.radarLabelFooter;
    const footers = Array.isArray(pluginOptions?.footers) ? pluginOptions.footers : [];
    if (footers.length === 0) {
      return;
    }
    const ctx = chart.ctx;
    if (!ctx) {
      return;
    }
    const offset = Number.isFinite(pluginOptions?.offset) ? pluginOptions.offset : 26;
    const baseFont = chart.options?.font || {};
    const pluginFont = pluginOptions?.font || {};
    const fontSize = Number.isFinite(pluginFont.size) ? pluginFont.size : Number(baseFont.size) || 12;
    const fontFamily = pluginFont.family || baseFont.family || 'sans-serif';
    const fontStyle = pluginFont.style || baseFont.style || '';
    const fontWeight = pluginFont.weight || baseFont.weight || '';
    const fontTokens = [];
    if (fontStyle) {
      fontTokens.push(fontStyle);
    }
    if (fontWeight) {
      fontTokens.push(fontWeight);
    }
    fontTokens.push(`${fontSize}px`);
    fontTokens.push(fontFamily);
    const fontString = fontTokens.join(' ');
    const color = pluginOptions?.color || 'rgba(148, 163, 184, 0.78)';
    const centerX = scale.xCenter || 0;
    const centerY = scale.yCenter || 0;
    const radius = scale.drawingArea || 0;
    if (!Number.isFinite(radius) || radius <= 0) {
      return;
    }
    ctx.save();
    ctx.font = fontString;
    ctx.fillStyle = color;
    footers.forEach((footer, index) => {
      if (footer === undefined || footer === null || footer === '') {
        return;
      }
      const outer = scale.getPointPosition(index, radius);
      const dx = outer.x - centerX;
      const dy = outer.y - centerY;
      const distance = Math.sqrt(dx * dx + dy * dy) || 1;
      const targetDistance = Math.max(distance - offset, 0);
      const targetX = centerX + (dx / distance) * targetDistance;
      const targetY = centerY + (dy / distance) * targetDistance;
      let textAlign = 'center';
      let textBaseline = 'middle';
      if (Math.abs(dx) > Math.abs(dy) * 0.6) {
        textAlign = dx > 0 ? 'left' : 'right';
      }
      if (Math.abs(dy) > Math.abs(dx) * 0.6) {
        textBaseline = dy > 0 ? 'bottom' : 'top';
      }
      ctx.save();
      ctx.textAlign = textAlign;
      ctx.textBaseline = textBaseline;
      ctx.fillText(String(footer), targetX, targetY);
      ctx.restore();
    });
    ctx.restore();
  },
};

let registeredPlugins = false;

function ensurePlugins(chartLib) {
  if (registeredPlugins) {
    return;
  }
  if (chartLib && typeof chartLib.register === 'function') {
    chartLib.register(radarLabelFooterPlugin);
    registeredPlugins = true;
  }
}

export default function ChartCanvas({ type, data, options, className, ariaLabel }) {
  const canvasRef = React.useRef(null);
  const chartRef = React.useRef(null);

  React.useEffect(() => {
    const Chart = window.Chart;
    ensurePlugins(Chart);
    if (!canvasRef.current || typeof Chart !== 'function') {
      return undefined;
    }
    const context = canvasRef.current.getContext('2d');
    const chartInstance = new Chart(context, {
      type,
      data,
      options,
    });
    chartRef.current = chartInstance;
    return () => {
      chartInstance.destroy();
      chartRef.current = null;
    };
  }, [type]);

  React.useEffect(() => {
    const chartInstance = chartRef.current;
    if (!chartInstance) {
      return;
    }
    chartInstance.data = data;
    chartInstance.options = options;
    chartInstance.update('none');
  }, [data, options]);

  return (
    <canvas
      ref={canvasRef}
      className={className || 'chart-canvas'}
      role={ariaLabel ? 'img' : undefined}
      aria-label={ariaLabel || undefined}
    />
  );
}
