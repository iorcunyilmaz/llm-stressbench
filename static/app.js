/**
 * LLM StressBench - Frontend Application Engine
 * Handles real-time SSE streaming, Chart.js updates, capacity analysis, and benchmarks.
 * Integrated with i18n support (TR / EN) and dynamic report generation.
 */

let currentMode = 'concurrency_sweep';
let eventSource = null;
let currentRunId = null;
let liveRequestCount = 0;
let stepSummariesData = [];
let latestReportData = null;

// Chart.js instances
let chartTtftLatency = null;
let chartThroughput = null;
let chartPercentiles = null;
let chartKvCache = null;

// Initialize Lucide icons, i18n & Charts on load
document.addEventListener('DOMContentLoaded', () => {
  if (window.i18n) {
    window.i18n.applyTranslations();
    window.i18n.onLanguageChange(() => {
      updateChartLabels();
      refreshTableAndDiagnosis();
    });
  }

  if (window.lucide) {
    window.lucide.createIcons();
  }

  initCharts();
  checkInitialStatus();
});

// Update Chart Dataset Labels based on current language
function updateChartLabels() {
  if (chartTtftLatency) {
    chartTtftLatency.data.datasets[0].label = window.t('chart_ttft_ds_ttft');
    chartTtftLatency.data.datasets[1].label = window.t('chart_ttft_ds_latency');
    chartTtftLatency.update();
  }
  if (chartThroughput) {
    chartThroughput.data.datasets[0].label = window.t('chart_tps_ds_total');
    chartThroughput.data.datasets[1].label = window.t('chart_tps_ds_user');
    chartThroughput.update();
  }
  if (chartPercentiles) {
    chartPercentiles.data.datasets[0].label = window.t('chart_percentiles_ds_p50');
    chartPercentiles.data.datasets[1].label = window.t('chart_percentiles_ds_p90');
    chartPercentiles.data.datasets[2].label = window.t('chart_percentiles_ds_p95');
    chartPercentiles.update();
  }
  if (chartKvCache) {
    chartKvCache.data.datasets[0].label = window.t('chart_kv_ds_ttft');
    chartKvCache.update();
  }
}

// Refresh table rows & diagnosis card when language changes
function refreshTableAndDiagnosis() {
  const tbody = document.getElementById('tableStepBody');
  if (stepSummariesData.length > 0) {
    tbody.innerHTML = '';
    stepSummariesData.forEach((s, idx) => {
      addStepToTable(`Step ${idx + 1}`, s);
    });
  }

  if (latestReportData) {
    renderExecutiveDiagnosis(latestReportData);
  }
}

// Server Presets
function applyPreset(preset) {
  const urlInput = document.getElementById('targetUrl');
  const typeSelect = document.getElementById('targetType');
  const keyInput = document.getElementById('apiKey');

  if (preset === 'vllm_local') {
    urlInput.value = 'http://localhost:8000/v1';
    typeSelect.value = 'vllm';
  } else if (preset === 'litellm_local') {
    urlInput.value = 'http://localhost:4000/v1';
    typeSelect.value = 'litellm';
  } else if (preset === 'deepnity_vllm') {
    urlInput.value = 'http://vllm.deepnity.com:1234/v1';
    keyInput.value = 'Bearer sk-9wjQ1nG0zovWArVzYhLzlA';
    typeSelect.value = 'vllm';
  }
  fetchServerModels();
}

// Mode Selection Tab Handler
function setTestMode(mode) {
  currentMode = mode;
  document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
  const activeBtn = document.getElementById(`tab-${mode}`);
  if (activeBtn) activeBtn.classList.add('active');

  const groupConcurrency = document.getElementById('groupConcurrency');
  const groupContexts = document.getElementById('groupContexts');
  const compareSettings = document.getElementById('compareSettings');

  if (mode === 'concurrency_sweep') {
    groupConcurrency.classList.remove('opacity-40', 'pointer-events-none');
    groupContexts.classList.add('opacity-40', 'pointer-events-none');
    compareSettings.classList.add('hidden');
  } else if (mode === 'kv_cache_stress') {
    groupConcurrency.classList.add('opacity-40', 'pointer-events-none');
    groupContexts.classList.remove('opacity-40', 'pointer-events-none');
    compareSettings.classList.add('hidden');
  } else if (mode === 'prefix_cache_test') {
    groupConcurrency.classList.add('opacity-40', 'pointer-events-none');
    groupContexts.classList.remove('opacity-40', 'pointer-events-none');
    compareSettings.classList.add('hidden');
  } else if (mode === 'compare') {
    groupConcurrency.classList.remove('opacity-40', 'pointer-events-none');
    groupContexts.classList.add('opacity-40', 'pointer-events-none');
    compareSettings.classList.remove('hidden');
  } else if (mode === 'quick') {
    groupConcurrency.classList.add('opacity-40', 'pointer-events-none');
    groupContexts.classList.add('opacity-40', 'pointer-events-none');
    compareSettings.classList.add('hidden');
  }
}

// Fetch Server Models automatically
async function fetchServerModels() {
  const statusSpan = document.getElementById('modelFetchStatus');
  const datalist = document.getElementById('modelsDatalist');
  const url = document.getElementById('targetUrl').value;
  const apiKey = document.getElementById('apiKey').value;

  statusSpan.innerText = window.t('status_querying');
  statusSpan.className = 'text-[11px] text-cyan-400';

  try {
    const res = await fetch('/api/fetch-models', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ base_url: url, api_key: apiKey })
    });
    const data = await res.json();

    if (data.status === 'online' && data.models && data.models.length > 0) {
      datalist.innerHTML = '';
      data.models.forEach(m => {
        const opt = document.createElement('option');
        opt.value = m;
        datalist.appendChild(opt);
      });
      document.getElementById('modelName').value = data.models[0];
      statusSpan.innerText = `✔ ${window.t('status_models_found', { count: data.models.length })} (${data.ping_ms}ms ping)`;
      statusSpan.className = 'text-[11px] text-emerald-400 font-semibold';
    } else {
      statusSpan.innerText = data.message || window.t('status_models_empty');
      statusSpan.className = 'text-[11px] text-amber-400';
    }
  } catch (err) {
    statusSpan.innerText = window.t('status_models_failed', { error: err.message || 'Error' });
    statusSpan.className = 'text-[11px] text-rose-400';
  }
}

// Check if a benchmark is currently running
async function checkInitialStatus() {
  try {
    const res = await fetch('/api/status');
    const data = await res.json();
    if (data.is_running) {
      setRunningUI(true);
      startEventStream();
    }
  } catch (e) {
    console.warn('Initial status check failed', e);
  }
}

// Initialize Chart.js instances
function initCharts() {
  const chartDefaults = {
    responsive: true,
    maintainAspectRatio: false,
    color: '#94a3b8',
    plugins: {
      legend: { labels: { color: '#94a3b8', font: { family: 'Plus Jakarta Sans', size: 11 } } },
      tooltip: {
        backgroundColor: '#0f172a',
        titleColor: '#38bdf8',
        bodyColor: '#f8fafc',
        borderColor: '#334155',
        borderWidth: 1
      }
    },
    scales: {
      x: {
        grid: { color: 'rgba(51, 65, 85, 0.25)' },
        ticks: { color: '#94a3b8', font: { family: 'JetBrains Mono', size: 10 } }
      },
      y: {
        grid: { color: 'rgba(51, 65, 85, 0.25)' },
        ticks: { color: '#94a3b8', font: { family: 'JetBrains Mono', size: 10 } }
      }
    }
  };

  // Chart 1: TTFT & Latency Curve
  const ctx1 = document.getElementById('chartTtftLatency').getContext('2d');
  chartTtftLatency = new Chart(ctx1, {
    type: 'line',
    data: {
      labels: [],
      datasets: [
        {
          label: window.t('chart_ttft_ds_ttft'),
          data: [],
          borderColor: '#10b981',
          backgroundColor: 'rgba(16, 185, 129, 0.1)',
          fill: true,
          tension: 0.3,
          borderWidth: 2.5
        },
        {
          label: window.t('chart_ttft_ds_latency'),
          data: [],
          borderColor: '#f59e0b',
          backgroundColor: 'transparent',
          borderDash: [5, 5],
          tension: 0.3,
          borderWidth: 2
        }
      ]
    },
    options: { ...chartDefaults }
  });

  // Chart 2: Throughput (Total Tokens/sec)
  const ctx2 = document.getElementById('chartThroughput').getContext('2d');
  chartThroughput = new Chart(ctx2, {
    type: 'bar',
    data: {
      labels: [],
      datasets: [
        {
          label: window.t('chart_tps_ds_total'),
          data: [],
          backgroundColor: 'rgba(6, 182, 212, 0.65)',
          borderColor: '#06b6d4',
          borderWidth: 1.5,
          borderRadius: 6
        },
        {
          label: window.t('chart_tps_ds_user'),
          data: [],
          type: 'line',
          borderColor: '#8b5cf6',
          backgroundColor: 'transparent',
          borderWidth: 2,
          tension: 0.3
        }
      ]
    },
    options: { ...chartDefaults }
  });

  // Chart 3: Latency Distribution Percentiles
  const ctx3 = document.getElementById('chartPercentiles').getContext('2d');
  chartPercentiles = new Chart(ctx3, {
    type: 'bar',
    data: {
      labels: [],
      datasets: [
        { label: window.t('chart_percentiles_ds_p50'), data: [], backgroundColor: 'rgba(16, 185, 129, 0.7)' },
        { label: window.t('chart_percentiles_ds_p90'), data: [], backgroundColor: 'rgba(245, 158, 11, 0.7)' },
        { label: window.t('chart_percentiles_ds_p95'), data: [], backgroundColor: 'rgba(244, 63, 94, 0.7)' }
      ]
    },
    options: { ...chartDefaults }
  });

  // Chart 4: KV Cache Context Scaling vs TTFT
  const ctx4 = document.getElementById('chartKvCache').getContext('2d');
  chartKvCache = new Chart(ctx4, {
    type: 'line',
    data: {
      labels: [],
      datasets: [
        {
          label: window.t('chart_kv_ds_ttft'),
          data: [],
          borderColor: '#06b6d4',
          backgroundColor: 'rgba(6, 182, 212, 0.15)',
          fill: true,
          tension: 0.25,
          borderWidth: 2.5
        }
      ]
    },
    options: { ...chartDefaults }
  });
}

// Start Benchmark Request
async function startBenchmark() {
  const url = document.getElementById('targetUrl').value.trim();
  const apiKey = document.getElementById('apiKey').value.trim();
  const model = document.getElementById('modelName').value.trim();
  const targetType = document.getElementById('targetType').value;

  if (!url) {
    alert(window.t('alert_no_url'));
    return;
  }
  if (!model) {
    alert(window.t('alert_no_model'));
    return;
  }

  const concurrencyStr = document.getElementById('concurrencyList').value;
  const concurrencyList = concurrencyStr.split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n) && n > 0);

  const contextStr = document.getElementById('contextLengths').value;
  const contextLengths = contextStr.split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n) && n > 0);

  const requestsPerStep = parseInt(document.getElementById('requestsPerStep').value) || 10;
  const slaMaxTtft = parseFloat(document.getElementById('slaMaxTtft').value) || 800;
  const slaMinTps = parseFloat(document.getElementById('slaMinTps').value) || 15;

  const compareUrl = document.getElementById('compareUrl').value.trim();
  const compareKey = document.getElementById('compareKey').value.trim();
  const compareModel = document.getElementById('compareModel').value.trim() || model;

  const payload = {
    target_type: targetType,
    base_url: url,
    api_key: apiKey,
    model: model,
    mode: currentMode,
    concurrency_list: concurrencyList,
    requests_per_step: requestsPerStep,
    context_lengths: contextLengths,
    sla_max_ttft_ms: slaMaxTtft,
    sla_min_user_tps: slaMinTps,
    compare_target_url: compareUrl,
    compare_target_key: compareKey,
    compare_target_model: compareModel
  };

  resetUI();
  setRunningUI(true);

  try {
    const res = await fetch('/api/start-benchmark', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const err = await res.json();
      alert(`Hata: ${err.detail || 'Test başlatılamadı'}`);
      setRunningUI(false);
      return;
    }

    const data = await res.json();
    currentRunId = data.run_id;
    startEventStream();
  } catch (e) {
    alert(`Ağ Hatası: ${e.message}`);
    setRunningUI(false);
  }
}

// Stop Running Benchmark
async function stopBenchmark() {
  try {
    await fetch('/api/stop-benchmark', { method: 'POST' });
    appendLogMessage('info', window.t('status_stopping'));
  } catch (e) {
    console.error(e);
  }
}

// Connect to Server-Sent Events (SSE)
function startEventStream() {
  if (eventSource) {
    eventSource.close();
  }

  eventSource = new EventSource('/api/stream-events');

  eventSource.onmessage = (event) => {
    try {
      const parsed = JSON.parse(event.data);
      handleServerEvent(parsed);
    } catch (e) {
      // heartbeats or ignore
    }
  };

  eventSource.onerror = (err) => {
    console.warn('SSE bağlantısı kapandı veya kesildi.', err);
  };
}

// Handle Incoming Real-Time Events
function handleServerEvent(event) {
  const { type, data } = event;

  if (type === 'benchmark_started') {
    appendLogMessage('info', `🚀 ${window.t('status_running')}: ${data.config?.model} | Mod: ${data.config?.mode}`);
    document.getElementById('metricSlaDetails').innerText = `Maks TTFT < ${data.config?.sla_max_ttft_ms}ms`;
  }

  else if (type === 'step_started') {
    document.getElementById('metricConcurrency').innerText = data.concurrency;
    appendLogMessage('step', `▶ Adım: ${data.step_label} (${data.concurrency} ${window.i18n.getLang() === 'en' ? 'Users' : 'Kullanıcı'}, ${data.total_requests} ${window.i18n.getLang() === 'en' ? 'Requests' : 'İstek'})`);
  }

  else if (type === 'request_completed') {
    liveRequestCount++;
    const req = data.request;
    const prog = data.progress;
    document.getElementById('streamCounter').innerText = `${prog.completed} / ${prog.total} ${window.i18n.getLang() === 'en' ? 'Requests' : 'İstek'}`;

    if (req.success) {
      document.getElementById('metricTtft').innerHTML = `${req.ttft_ms} <span class="text-sm font-normal text-slate-400">ms</span>`;
      document.getElementById('metricUserTps').innerText = req.generation_tps;

      appendLogMessage('success', `✔ [${req.request_id}] TTFT: ${req.ttft_ms}ms | TPS: ${req.generation_tps} tok/s | Token: ${req.completion_tokens} | Latency: ${req.latency_ms}ms`);
    } else {
      appendLogMessage('error', `✘ [${req.request_id}] ERROR ${req.status_code || ''}: ${req.error}`);
    }
  }

  else if (type === 'step_completed') {
    const summary = data.summary;
    stepSummariesData.push(summary);

    // Update Top Counters
    document.getElementById('metricTotalTps').innerText = summary.aggregate_generation_tps;
    document.getElementById('metricTtft').innerHTML = `${summary.ttft_stats.p50} <span class="text-sm font-normal text-slate-400">ms</span>`;
    document.getElementById('metricUserTps').innerText = summary.user_tps_stats.p50;
    document.getElementById('metricErrorRate').innerText = `%${summary.error_rate_pct}`;
    document.getElementById('metricErrorCount').innerText = window.t('metric_error_count_fmt', { failed: summary.failed_requests, total: summary.total_requests });

    // SLA Badge
    const slaStatusEl = document.getElementById('metricSlaStatus');
    const slaIconEl = document.getElementById('slaIcon');
    if (summary.sla_passed) {
      slaStatusEl.innerText = window.t('metric_sla_passed');
      slaStatusEl.className = 'text-base font-bold text-emerald-400 truncate';
      slaIconEl.className = 'w-4 h-4 text-emerald-400';
    } else {
      slaStatusEl.innerText = window.t('metric_sla_exceeded');
      slaStatusEl.className = 'text-base font-bold text-rose-400 truncate';
      slaIconEl.className = 'w-4 h-4 text-rose-400';
    }

    addStepToTable(data.step_label, summary);
    updateCharts(summary);
  }

  else if (type === 'benchmark_completed') {
    latestReportData = data;
    setRunningUI(false);
    if (eventSource) eventSource.close();
    appendLogMessage('info', `🏁 ${window.t('status_completed')}! ${window.t('pdf_seconds', { n: data.total_duration_sec })}`);
    renderExecutiveDiagnosis(data);
    if (window.lucide) window.lucide.createIcons();
  }

  else if (type === 'error') {
    setRunningUI(false);
    if (eventSource) eventSource.close();
    appendLogMessage('error', `${window.t('status_error')}: ${data.message}`);
  }
}

// Update Chart Data in real-time
function updateCharts(summary) {
  const userUnit = window.i18n.getLang() === 'en' ? 'Users' : 'Kul.';
  const label = `${summary.concurrency} ${userUnit}`;

  // Chart 1
  chartTtftLatency.data.labels.push(label);
  chartTtftLatency.data.datasets[0].data.push(summary.ttft_stats.p50);
  chartTtftLatency.data.datasets[1].data.push(summary.latency_stats.p95);
  chartTtftLatency.update();

  // Chart 2
  chartThroughput.data.labels.push(label);
  chartThroughput.data.datasets[0].data.push(summary.aggregate_generation_tps);
  chartThroughput.data.datasets[1].data.push(summary.user_tps_stats.p50);
  chartThroughput.update();

  // Chart 3
  chartPercentiles.data.labels.push(label);
  chartPercentiles.data.datasets[0].data.push(summary.ttft_stats.p50);
  chartPercentiles.data.datasets[1].data.push(summary.ttft_stats.p90);
  chartPercentiles.data.datasets[2].data.push(summary.ttft_stats.p95);
  chartPercentiles.update();

  // Chart 4 (KV Cache or sequential step)
  chartKvCache.data.labels.push(label);
  chartKvCache.data.datasets[0].data.push(summary.ttft_stats.p50);
  chartKvCache.update();
}

// Add step row to results table
function addStepToTable(stepLabel, s) {
  const tbody = document.getElementById('tableStepBody');
  // clear placeholder if first
  if (tbody.children.length === 1 && (tbody.children[0].innerText.includes('Henüz test') || tbody.children[0].innerText.includes('No benchmark'))) {
    tbody.innerHTML = '';
  }

  const row = document.createElement('tr');
  row.className = 'hover:bg-slate-900/60 transition';

  const slaBadge = s.sla_passed
    ? `<span class="px-2 py-0.5 rounded-full text-[10px] bg-emerald-950 text-emerald-400 border border-emerald-800">${window.t('sla_passed_badge')}</span>`
    : `<span class="px-2 py-0.5 rounded-full text-[10px] bg-rose-950 text-rose-400 border border-rose-800">${window.t('sla_exceeded_badge')}</span>`;

  const userUnit = window.i18n.getLang() === 'en' ? 'Users' : 'Kullanıcı';

  row.innerHTML = `
    <td class="py-2.5 px-3 font-semibold text-slate-200">${s.concurrency} ${userUnit} <span class="text-[10px] text-slate-500 font-sans">(${stepLabel})</span></td>
    <td class="py-2.5 px-3">${s.successful_requests} / <span class="${s.failed_requests > 0 ? 'text-rose-400 font-bold' : 'text-slate-400'}">${s.failed_requests}</span></td>
    <td class="py-2.5 px-3 font-bold text-cyan-400">${s.aggregate_generation_tps} tok/s</td>
    <td class="py-2.5 px-3 text-indigo-400">${s.user_tps_stats.p50} tok/s</td>
    <td class="py-2.5 px-3 text-emerald-400">${s.ttft_stats.p50} ms</td>
    <td class="py-2.5 px-3 text-yellow-400">${s.ttft_stats.p95} ms</td>
    <td class="py-2.5 px-3 text-slate-300">${s.latency_stats.p95} ms</td>
    <td class="py-2.5 px-3 text-slate-400">${s.tpot_stats.p50} ms</td>
    <td class="py-2.5 px-3">${slaBadge}</td>
  `;
  tbody.appendChild(row);
}

// Executive Capacity Diagnosis Renderer
function renderExecutiveDiagnosis(report) {
  const card = document.getElementById('diagnosisCard');
  const runIdEl = document.getElementById('diagnosisRunId');
  const summaryEl = document.getElementById('diagnosisSummaryText');

  card.classList.remove('hidden');
  runIdEl.innerText = window.t('run_label', { id: report.run_id });

  const a = report.analysis || {};
  const translatedSummary = window.i18n.generateExecutiveSummary(a).replace(/\n/g, '<br/>');
  const translatedBottleneck = window.i18n.translateBottleneck(a.bottleneck_diagnosis);
  const userUnit = window.i18n.getLang() === 'en' ? 'Users' : 'Kul.';

  summaryEl.innerHTML = `
    <div class="space-y-2">
      <p class="font-medium text-slate-100 text-sm leading-relaxed">${translatedSummary}</p>
      <div class="grid grid-cols-1 md:grid-cols-3 gap-2 pt-2 border-t border-slate-800 text-xs">
        <div class="p-2 rounded bg-slate-900/80 border border-slate-800">
          <span class="text-slate-400 block text-[10px]">${window.t('kpi_zero_latency_capacity')}</span>
          <span class="font-bold text-emerald-400 text-sm">${a.optimal_zero_latency_concurrency} ${userUnit}</span>
        </div>
        <div class="p-2 rounded bg-slate-900/80 border border-slate-800">
          <span class="text-slate-400 block text-[10px]">${window.t('kpi_peak_tps')}</span>
          <span class="font-bold text-cyan-400 text-sm">${a.peak_generation_tps} tok/s (${a.peak_throughput_concurrency} ${userUnit})</span>
        </div>
        <div class="p-2 rounded bg-slate-900/80 border border-slate-800">
          <span class="text-slate-400 block text-[10px]">${window.t('kpi_bottleneck')}</span>
          <span class="font-bold text-amber-400 text-sm">${translatedBottleneck}</span>
        </div>
      </div>
    </div>
  `;
}

// UI State Toggles
function setRunningUI(isRunning) {
  const btnStart = document.getElementById('btnStart');
  const btnStop = document.getElementById('btnStop');
  const statusBadge = document.getElementById('statusBadge');
  const statusText = document.getElementById('statusText');

  if (isRunning) {
    btnStart.classList.add('hidden');
    btnStop.classList.remove('hidden');
    statusBadge.className = 'flex items-center space-x-2 px-3 py-1 rounded-full text-xs font-medium bg-cyan-950 border border-cyan-800 text-cyan-400';
    statusText.innerText = window.t('status_running');
  } else {
    btnStart.classList.remove('hidden');
    btnStop.classList.add('hidden');
    statusBadge.className = 'flex items-center space-x-2 px-3 py-1 rounded-full text-xs font-medium bg-slate-800 border border-slate-700 text-slate-300';
    statusText.innerText = window.t('status_ready');
  }
}

// Reset UI before new test
function resetUI() {
  liveRequestCount = 0;
  stepSummariesData = [];

  document.getElementById('metricTotalTps').innerText = '0.0';
  document.getElementById('metricTtft').innerHTML = '0 <span class="text-sm font-normal text-slate-400">ms</span>';
  document.getElementById('metricUserTps').innerText = '0.0';
  document.getElementById('metricConcurrency').innerText = '0';
  document.getElementById('metricErrorRate').innerText = '0.0%';
  document.getElementById('metricErrorCount').innerText = window.t('metric_error_count_fmt', { failed: 0, total: 0 });
  document.getElementById('metricSlaStatus').innerText = window.t('metric_sla_balanced');

  document.getElementById('tableStepBody').innerHTML = `<tr><td colspan="9" class="py-6 text-center text-slate-500 font-sans">${window.t('table_empty')}</td></tr>`;
  document.getElementById('liveStreamTerminal').innerHTML = '';
  document.getElementById('diagnosisCard').classList.add('hidden');

  [chartTtftLatency, chartThroughput, chartPercentiles, chartKvCache].forEach(chart => {
    if (chart) {
      chart.data.labels = [];
      chart.data.datasets.forEach(d => d.data = []);
      chart.update();
    }
  });
}

// Append log to live stream terminal
function appendLogMessage(level, text) {
  const terminal = document.getElementById('liveStreamTerminal');
  const line = document.createElement('div');
  line.className = 'flex items-start space-x-2';

  const locale = window.i18n.getLang() === 'en' ? 'en-US' : 'tr-TR';
  const timeStr = new Date().toLocaleTimeString(locale, { hour12: false });
  let color = 'text-slate-400';
  if (level === 'success') color = 'text-emerald-400';
  if (level === 'error') color = 'text-rose-400 font-semibold';
  if (level === 'step') color = 'text-amber-400 font-semibold';
  if (level === 'info') color = 'text-cyan-400';

  line.innerHTML = `<span class="text-slate-600 select-none">[${timeStr}]</span> <span class="${color}">${text}</span>`;
  terminal.appendChild(line);
  terminal.scrollTop = terminal.scrollHeight;
}

// Export Data Download (JSON / CSV)
function exportData(format) {
  if (!currentRunId) {
    alert(window.t('alert_no_report'));
    return;
  }
  window.open(`/api/export/${currentRunId}?format=${format}`, '_blank');
}

// Export Comprehensive PDF Report (Supports TR and EN)
async function exportPdf() {
  let report = latestReportData;

  // Fallback to fetch report if not in memory
  if (!report && currentRunId) {
    try {
      const res = await fetch(`/api/report/${currentRunId}`);
      if (res.ok) {
        report = await res.json();
      }
    } catch (e) {
      console.warn('Rapor getirilemedi:', e);
    }
  }

  // If still no report, build from stepSummariesData if present
  if (!report && stepSummariesData.length > 0) {
    report = {
      run_id: currentRunId || 'RUN-LIVE',
      status: 'completed',
      total_duration_sec: 0,
      config: {
        model: document.getElementById('modelName').value,
        base_url: document.getElementById('targetUrl').value,
        mode: currentMode
      },
      step_summaries: stepSummariesData,
      analysis: {
        optimal_zero_latency_concurrency: stepSummariesData[0]?.concurrency || 1,
        peak_generation_tps: Math.max(...stepSummariesData.map(s => s.aggregate_generation_tps || 0)),
        peak_throughput_concurrency: stepSummariesData[0]?.concurrency || 1,
        bottleneck_diagnosis: 'Test Adımları Tamamlandı',
        executive_summary: ''
      }
    };
  }

  if (!report || !report.step_summaries || report.step_summaries.length === 0) {
    alert(window.t('alert_no_report'));
    return;
  }

  // Capture Chart Images as high-res PNG base64
  const imgTtft = (chartTtftLatency && chartTtftLatency.data.labels.length > 0) ? chartTtftLatency.toBase64Image('image/png', 1) : '';
  const imgThroughput = (chartThroughput && chartThroughput.data.labels.length > 0) ? chartThroughput.toBase64Image('image/png', 1) : '';
  const imgPercentiles = (chartPercentiles && chartPercentiles.data.labels.length > 0) ? chartPercentiles.toBase64Image('image/png', 1) : '';
  const imgKvCache = (chartKvCache && chartKvCache.data.labels.length > 0) ? chartKvCache.toBase64Image('image/png', 1) : '';

  const cfg = report.config || {};
  const analysis = report.analysis || {};
  const isEn = window.i18n.getLang() === 'en';
  const locale = isEn ? 'en-US' : 'tr-TR';
  const dateStr = new Date().toLocaleString(locale);
  const userUnit = isEn ? 'Users' : 'Kullanıcı';
  const userUnitShort = isEn ? 'Users' : 'Kul.';

  // Build table rows HTML
  const tableRowsHtml = (report.step_summaries || []).map(s => {
    const slaBadge = s.sla_passed
      ? `<span style="color: #059669; font-weight: bold; background: #ecfdf5; padding: 2px 8px; border-radius: 9999px; border: 1px solid #a7f3d0;">${window.t('sla_passed_badge')}</span>`
      : `<span style="color: #dc2626; font-weight: bold; background: #fef2f2; padding: 2px 8px; border-radius: 9999px; border: 1px solid #fecaca;">${window.t('sla_exceeded_badge')}</span>`;

    return `
      <tr style="border-bottom: 1px solid #e2e8f0; font-family: 'JetBrains Mono', monospace; font-size: 11px;">
        <td style="padding: 8px 10px; font-weight: 600; font-family: sans-serif;">${s.concurrency} ${userUnit}</td>
        <td style="padding: 8px 10px; text-align: center;">${s.successful_requests} / ${s.failed_requests}</td>
        <td style="padding: 8px 10px; text-align: right; font-weight: bold; color: #0284c7;">${s.aggregate_generation_tps} tok/s</td>
        <td style="padding: 8px 10px; text-align: right; color: #4f46e5;">${s.user_tps_stats?.p50 || 0} tok/s</td>
        <td style="padding: 8px 10px; text-align: right; color: #059669;">${s.ttft_stats?.p50 || 0} ms</td>
        <td style="padding: 8px 10px; text-align: right; color: #d97706;">${s.ttft_stats?.p95 || 0} ms</td>
        <td style="padding: 8px 10px; text-align: right;">${s.latency_stats?.p95 || 0} ms</td>
        <td style="padding: 8px 10px; text-align: right;">${s.tpot_stats?.p50 || 0} ms</td>
        <td style="padding: 8px 10px; text-align: center;">${slaBadge}</td>
      </tr>
    `;
  }).join('');

  const formattedSummary = window.i18n.generateExecutiveSummary(analysis).replace(/\n/g, '<br/>');
  const translatedBottleneck = window.i18n.translateBottleneck(analysis.bottleneck_diagnosis);

  // Printable HTML document template
  const printContent = `
<!DOCTYPE html>
<html lang="${window.i18n.getLang()}">
<head>
  <meta charset="UTF-8">
  <title>${window.t('pdf_window_title', { run_id: report.run_id })}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap');
    * { box-sizing: border-box; }
    body {
      font-family: 'Plus Jakarta Sans', -apple-system, sans-serif;
      margin: 0;
      padding: 24px;
      color: #0f172a;
      background: #ffffff;
      line-height: 1.5;
    }
    .report-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 2px solid #0284c7;
      padding-bottom: 16px;
      margin-bottom: 20px;
    }
    .report-title {
      font-size: 24px;
      font-weight: 800;
      color: #0f172a;
      margin: 0;
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .author-badge {
      display: inline-block;
      font-size: 11px;
      font-weight: 700;
      background: #f0fdf4;
      color: #166534;
      padding: 3px 10px;
      border-radius: 9999px;
      border: 1px solid #bbf7d0;
      text-decoration: none;
    }
    .meta-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 12px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      padding: 12px 16px;
      margin-bottom: 20px;
      font-size: 12px;
    }
    .meta-item span { display: block; color: #64748b; font-size: 10px; text-transform: uppercase; font-weight: 600; }
    .meta-item strong { color: #0f172a; font-family: 'JetBrains Mono', monospace; font-size: 12px; }
    .diagnosis-card {
      background: #f0fdfa;
      border-left: 4px solid #0d9488;
      border-radius: 8px;
      padding: 14px 18px;
      margin-bottom: 20px;
    }
    .diagnosis-title { font-weight: 700; font-size: 14px; color: #134e4a; margin-bottom: 6px; }
    .diagnosis-summary { font-size: 12px; color: #0f766e; line-height: 1.6; margin-bottom: 12px; }
    .kpi-row {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 10px;
    }
    .kpi-box {
      background: #ffffff;
      border: 1px solid #ccfbf1;
      padding: 8px 12px;
      border-radius: 6px;
    }
    .kpi-box span { font-size: 10px; color: #64748b; display: block; }
    .kpi-box strong { font-size: 14px; color: #0f172a; }
    .section-title {
      font-size: 14px;
      font-weight: 700;
      color: #1e293b;
      margin: 20px 0 10px 0;
      border-bottom: 1px solid #cbd5e1;
      padding-bottom: 4px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .charts-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
      margin-bottom: 20px;
      page-break-inside: avoid;
    }
    .chart-box {
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 10px;
      background: #ffffff;
    }
    .chart-box h4 {
      margin: 0 0 8px 0;
      font-size: 11px;
      color: #334155;
      font-weight: 700;
      text-transform: uppercase;
    }
    .chart-box img {
      width: 100%;
      height: auto;
      max-height: 220px;
      object-fit: contain;
      display: block;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 10px;
      margin-bottom: 20px;
    }
    th {
      background: #f1f5f9;
      color: #475569;
      font-weight: 700;
      font-size: 11px;
      text-transform: uppercase;
      padding: 8px 10px;
      border-bottom: 2px solid #cbd5e1;
      text-align: left;
    }
    .footer {
      margin-top: 30px;
      padding-top: 12px;
      border-top: 1px solid #e2e8f0;
      font-size: 11px;
      color: #64748b;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .no-print-bar {
      position: sticky;
      top: 0;
      background: #0f172a;
      color: #ffffff;
      padding: 12px 24px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin: -24px -24px 24px -24px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      z-index: 1000;
    }
    .btn-print {
      background: #0284c7;
      color: #ffffff;
      border: none;
      padding: 8px 18px;
      border-radius: 6px;
      font-weight: 600;
      cursor: pointer;
      font-size: 13px;
    }
    .btn-print:hover { background: #0369a1; }
    .btn-close {
      background: transparent;
      color: #94a3b8;
      border: 1px solid #475569;
      padding: 6px 14px;
      border-radius: 6px;
      cursor: pointer;
      font-size: 12px;
    }
    .btn-close:hover { color: #ffffff; border-color: #cbd5e1; }
    @media print {
      .no-print-bar { display: none !important; }
      body { padding: 0; }
      @page { size: A4; margin: 12mm; }
    }
  </style>
</head>
<body>

  <div class="no-print-bar">
    <div style="font-weight: 600; font-size: 14px;">
      ${window.t('pdf_toolbar_title')}
    </div>
    <div style="display: flex; gap: 10px;">
      <button class="btn-print" onclick="window.print()">${window.t('pdf_btn_print')}</button>
      <button class="btn-close" onclick="window.close()">${window.t('pdf_btn_close')}</button>
    </div>
  </div>

  <div class="report-header">
    <div>
      <h1 class="report-title">
        ${window.t('pdf_report_title')}
        <a href="https://orcunyilmaz.com.tr" target="_blank" class="author-badge">${window.t('app_author')}</a>
      </h1>
      <div style="font-size: 12px; color: #64748b; margin-top: 4px;">
        ${window.t('pdf_report_subtitle')}
      </div>
    </div>
    <div style="text-align: right; font-size: 11px; color: #64748b;">
      <div><strong>${window.t('pdf_meta_report_id')}</strong> <span style="font-family: monospace;">${report.run_id}</span></div>
      <div><strong>${window.t('pdf_meta_date')}</strong> ${dateStr}</div>
      <div><strong>${window.t('pdf_meta_web')}</strong> <a href="https://orcunyilmaz.com.tr" target="_blank" style="color: #0284c7; text-decoration: none;">orcunyilmaz.com.tr</a></div>
    </div>
  </div>

  <div class="meta-grid">
    <div class="meta-item">
      <span>${window.t('pdf_meta_target_url')}</span>
      <strong>${cfg.base_url || 'N/A'}</strong>
    </div>
    <div class="meta-item">
      <span>${window.t('pdf_meta_model')}</span>
      <strong>${cfg.model || 'N/A'}</strong>
    </div>
    <div class="meta-item">
      <span>${window.t('pdf_meta_mode')}</span>
      <strong>${cfg.mode || 'N/A'}</strong>
    </div>
    <div class="meta-item">
      <span>${window.t('pdf_meta_duration')}</span>
      <strong>${window.t('pdf_seconds', { n: report.total_duration_sec || 0 })}</strong>
    </div>
  </div>

  <div class="diagnosis-card">
    <div class="diagnosis-title">${window.t('diagnosis_title')}</div>
    <div class="diagnosis-summary">${formattedSummary}</div>
    <div class="kpi-row">
      <div class="kpi-box">
        <span>${window.t('kpi_zero_latency_capacity')}</span>
        <strong style="color: #059669;">${analysis.optimal_zero_latency_concurrency || 1} ${userUnit}</strong>
      </div>
      <div class="kpi-box">
        <span>${window.t('kpi_peak_tps')}</span>
        <strong style="color: #0284c7;">${analysis.peak_generation_tps || 0} tok/s (${analysis.peak_throughput_concurrency || 1} ${userUnitShort})</strong>
      </div>
      <div class="kpi-box">
        <span>${window.t('kpi_bottleneck')}</span>
        <strong style="color: #d97706;">${translatedBottleneck}</strong>
      </div>
    </div>
  </div>

  <div class="section-title">${window.t('pdf_sec_charts')}</div>
  <div class="charts-grid">
    <div class="chart-box">
      <h4>${window.t('chart_ttft_title')}</h4>
      ${imgTtft ? `<img src="${imgTtft}" alt="TTFT Latency Curve" />` : `<div style="color: #94a3b8; padding: 40px; text-align: center;">${window.t('chart_no_data')}</div>`}
    </div>
    <div class="chart-box">
      <h4>${window.t('chart_tps_title')}</h4>
      ${imgThroughput ? `<img src="${imgThroughput}" alt="Throughput Saturation" />` : `<div style="color: #94a3b8; padding: 40px; text-align: center;">${window.t('chart_no_data')}</div>`}
    </div>
    <div class="chart-box">
      <h4>${window.t('chart_percentiles_title')}</h4>
      ${imgPercentiles ? `<img src="${imgPercentiles}" alt="Percentiles" />` : `<div style="color: #94a3b8; padding: 40px; text-align: center;">${window.t('chart_no_data')}</div>`}
    </div>
    <div class="chart-box">
      <h4>${window.t('chart_kv_title')}</h4>
      ${imgKvCache ? `<img src="${imgKvCache}" alt="KV Cache Scaling" />` : `<div style="color: #94a3b8; padding: 40px; text-align: center;">${window.t('chart_no_data')}</div>`}
    </div>
  </div>

  <div class="section-title">${window.t('pdf_sec_table')}</div>
  <table>
    <thead>
      <tr>
        <th>${window.t('col_concurrency')}</th>
        <th style="text-align: center;">${window.t('col_success_fail')}</th>
        <th style="text-align: right;">${window.t('col_total_tps')}</th>
        <th style="text-align: right;">${window.t('col_user_tps')}</th>
        <th style="text-align: right;">${window.t('col_ttft_p50')}</th>
        <th style="text-align: right;">${window.t('col_ttft_p95')}</th>
        <th style="text-align: right;">${window.t('col_latency_p95')}</th>
        <th style="text-align: right;">${window.t('col_tpot')}</th>
        <th style="text-align: center;">${window.t('col_sla')}</th>
      </tr>
    </thead>
    <tbody>
      ${tableRowsHtml}
    </tbody>
  </table>

  <div class="footer">
    <div>${window.t('pdf_footer_dev')}</div>
    <div>${window.t('pdf_footer_web')}</div>
  </div>

  <script>
    window.addEventListener('load', () => {
      setTimeout(() => {
        window.print();
      }, 400);
    });
  </script>
</body>
</html>
  `;

  const printWindow = window.open('', '_blank');
  if (printWindow) {
    printWindow.document.open();
    printWindow.document.write(printContent);
    printWindow.document.close();
  } else {
    alert(window.t('popup_blocked'));
  }
}
