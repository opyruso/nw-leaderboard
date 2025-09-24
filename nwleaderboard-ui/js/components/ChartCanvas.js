export default function ChartCanvas({ type, data, options, className, ariaLabel }) {
  const canvasRef = React.useRef(null);
  const chartRef = React.useRef(null);

  React.useEffect(() => {
    const Chart = window.Chart;
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
