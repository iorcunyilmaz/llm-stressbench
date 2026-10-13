/**
 * LLM StressBench - Internationalization (i18n) Engine
 * Supported Languages:
 *   - 'tr': Türkçe
 *   - 'en': English
 * Auto-detection:
 *   - Browser starts with 'tr' -> Turkish
 *   - Browser starts with 'en' -> English
 *   - Any other -> English (default)
 * Manual override stored in localStorage ('bench_lang').
 */

const I18N_RESOURCES = {
  tr: {
    // Branding & Header
    app_title: "LLM StressBench",
    app_author: "by Orçun YILMAZ",
    app_subtitle: "OpenAI API Uyumlu Yük, TTFT, TPS ve KV Cache Stres Analiz Laboratuvarı",
    status_ready: "HAZIR",
    status_running: "TEST ÇALIŞIYOR",
    status_stopping: "DURDURULUYOR...",
    status_stopped: "DURDURULDU",
    status_completed: "TAMAMLANDI",
    status_error: "HATA OLUŞTU",
    btn_start: "TESTİ BAŞLAT",
    btn_stop: "DURDUR",

    // Live HUD Metrics
    metric_total_tps_title: "Toplam Sistem TPS",
    metric_total_tps_sub: "tokens/saniye (Tüm kullanıcılar)",
    metric_ttft_title: "Medyan TTFT (İlk Token)",
    metric_ttft_sub: "İlk chunk tepki süresi (p50)",
    metric_user_tps_title: "Kullanıcı Başı Hız",
    metric_user_tps_sub: "Akıcılık hızı (tok/s/kullanıcı)",
    metric_concurrency_title: "Aktif Eşzamanlılık",
    metric_concurrency_sub: "Simültane sanal kullanıcı",
    metric_error_rate_title: "Hata Oranı",
    metric_error_count_fmt: "{failed} Hata / {total} İstek",
    metric_sla_title: "SLA Kapasite Durumu",
    metric_sla_balanced: "Dengeli / Bekliyor",
    metric_sla_sub: "TTFT < 800ms Hedefi",
    metric_sla_passed: "SLA Sağlandı (Akıcı)",
    metric_sla_exceeded: "SLA Eşiği Aşıldı",

    // Config Section
    config_title: "Test & Sunucu Parametreleri",
    tab_concurrency: "1. Eşzamanlı Kullanıcı & Kapasite Tavanı",
    tab_kv_cache: "2. KV Cache & Bağlam Dayanıklılığı",
    tab_prefix_cache: "3. Prefix Caching (PagedAttention)",
    tab_quick: "4. Hızlı Test",
    tab_compare: "5. vLLM vs LiteLLM Kıyaslama",

    lbl_target_url: "Hedef API URL (OpenAI Uyumlu)",
    hint_target_url: "vLLM: :8000/v1 | LiteLLM: :4000/v1",
    lbl_api_key: "API Key (Opsiyonel / LiteLLM için)",
    hint_api_key: "Gerekiyorsa Bearer token girin",
    placeholder_api_key: "Bearer sk-...",
    lbl_model_name: "Model Adı",
    btn_fetch_models: "Modelleri Getir",
    hint_model_fetch: "Sunucudan otomatik sorgulayabilirsiniz",
    status_querying: "Sorgulanıyor...",
    status_models_found: "{count} model bulundu.",
    status_models_empty: "Model bulunamadı.",
    status_models_failed: "Sorgulanamadı: {error}",

    lbl_target_type: "Sunucu Mimarisi",
    hint_target_type: "Mimarilere özel teşhis kuralları",
    opt_vllm: "vLLM (Doğrudan GPU Çıkarım Motoru)",
    opt_litellm: "LiteLLM (Yönlendirici / Proxy Katmanı)",
    opt_custom: "Özel OpenAI Uyumlu Uç Nokta",

    lbl_concurrency_steps: "Eşzamanlılık Adımları (Virgülle)",
    hint_concurrency_steps: "Örnek: 1, 2, 4, 8, 16, 32, 64",
    lbl_requests_per_step: "Adım Başına İstek Sayısı",
    hint_requests_per_step: "Her adımda gönderilecek toplam sorgu",
    lbl_context_lengths: "KV Cache Bağlam Boyutları (Token)",
    hint_context_lengths: "Prompt uzunluğunu kademeli büyütür",
    lbl_sla_targets: "SLA Hedefleri",
    badge_sla_threshold: "Gecikmesiz Eşik",
    hint_sla: "Maks TTFT (ms) / Min Kullanıcı TPS",

    compare_title: "Karşılaştırılacak İkinci Hedef (LiteLLM veya vLLM)",
    lbl_compare_url: "Hedef B URL",
    lbl_compare_key: "Hedef B API Key",
    lbl_compare_model: "Hedef B Model Adı",

    // Executive Diagnosis Card
    diagnosis_title: "Sunucu Kapasite & Gecikmesiz Kullanıcı Analizi",
    diagnosis_initial: "Test tamamlandığında sunucunun aynı anda kaç kullanıcıya gecikmesiz hizmet verebildiği burada özetlenecektir.",
    btn_export_pdf: "PDF Raporu Al",
    run_label: "Run: {id}",
    kpi_zero_latency_capacity: "Sıfır Gecikmeli Kapasite",
    kpi_zero_latency_users: "{n} Eşzamanlı Kullanıcı",
    kpi_peak_tps: "Zirve Sistem Verimi (Peak TPS)",
    kpi_peak_tps_fmt: "{tps} tok/s ({n} Kul.)",
    kpi_bottleneck: "Teşhis Edilen Darboğaz",
    kpi_not_specified: "Belirtilmedi",

    // Charts
    chart_ttft_title: "Eşzamanlı Kullanıcı vs TTFT & Gecikme (Kapasite Tavanı)",
    chart_ttft_sub: "Doygunluk Kırılımı",
    chart_ttft_ds_ttft: "Medyan TTFT (ms)",
    chart_ttft_ds_latency: "p95 Toplam Gecikme (ms)",

    chart_tps_title: "Toplam Sistem Verimi (Tokens / Saniye)",
    chart_tps_sub: "GPU Doyum Platosu",
    chart_tps_ds_total: "Toplam Sistem Verimi (tok/s)",
    chart_tps_ds_user: "Kullanıcı Başına TPS (tok/s)",

    chart_percentiles_title: "Gecikme Dağılımı & Kuyruk (p50 / p90 / p95 / p99)",
    chart_percentiles_sub: "Kuyruklanma Jitterı",
    chart_percentiles_ds_p50: "p50 TTFT (ms)",
    chart_percentiles_ds_p90: "p90 TTFT (ms)",
    chart_percentiles_ds_p95: "p95 TTFT (ms)",

    chart_kv_title: "KV Cache & Bağlam Uzunluğu vs TTFT",
    chart_kv_sub: "KV Bellek Doyumu",
    chart_kv_ds_ttft: "TTFT (ms) vs Bağlam Boyutu",

    chart_no_data: "Grafik verisi yok",

    // Detailed Table
    table_title: "Adım Bazlı Test Metrikleri",
    btn_download_pdf: "PDF Olarak İndir",
    col_concurrency: "Eşzamanlılık",
    col_success_fail: "Başarılı / Hata",
    col_total_tps: "Toplam Verim (TPS)",
    col_user_tps: "Kullanıcı TPS",
    col_ttft_p50: "TTFT p50",
    col_ttft_p95: "TTFT p95",
    col_latency_p95: "Gecikme p95",
    col_tpot: "TPOT",
    col_sla: "SLA Durumu",
    table_empty: "Henüz test çalıştırılmadı. Yukarıdaki \"Testi Başlat\" butonuna tıklayarak testi başlatın.",
    table_user_unit: "{n} Kullanıcı",
    sla_passed_badge: "UYGUN",
    sla_exceeded_badge: "AŞILDI",

    // Live Stream Terminal
    terminal_title: "Canlı İstek Akışı (Gerçek Zamanlı Log)",
    terminal_counter: "{n} İstek",
    terminal_ready: "Sistem hazır. Test başlatıldığında her isteğin mikro-saniyelik TTFT ve TPS değerleri burada akacaktır...",

    // Footer
    footer_text: "LLM StressBench • <a href=\"https://orcunyilmaz.com.tr\" target=\"_blank\" rel=\"noopener noreferrer\" class=\"text-cyan-400 hover:underline font-medium\">by Orçun YILMAZ</a> • OpenAI API Uyumlu LLM Performans & Stres Test Laboratuvarı",

    // Alerts & Confirmations
    alert_no_url: "Lütfen geçerli bir hedef API URL girin.",
    alert_no_model: "Lütfen bir model adı belirtin.",
    alert_no_report: "Henüz yazdırılacak veya PDF yapılacak bir test sonucu bulunmuyor. Lütfen önce bir test çalıştırın.",
    popup_blocked: "Açılır pencere engellendi. Lütfen tarayıcınızdan bu sayfa için açılır pencerelere izin verin.",

    // PDF Printable Document
    pdf_window_title: "LLM StressBench Raporu - {run_id}",
    pdf_toolbar_title: "📄 LLM StressBench Rapor Önizleme & PDF İndirme",
    pdf_btn_print: "🖨️ PDF Olarak Kaydet / Yazdır",
    pdf_btn_close: "Kapat",
    pdf_report_title: "LLM StressBench",
    pdf_report_subtitle: "OpenAI API Uyumlu LLM Sunucu Performans & Kapasite Analiz Raporu",
    pdf_meta_report_id: "Rapor ID:",
    pdf_meta_date: "Tarih:",
    pdf_meta_web: "Web:",
    pdf_meta_target_url: "Hedef Sunucu (Base URL)",
    pdf_meta_model: "Test Edilen Model",
    pdf_meta_mode: "Test Modu",
    pdf_meta_duration: "Toplam Test Süresi",
    pdf_seconds: "{n} saniye",
    pdf_sec_charts: "📊 Performans ve Kapasite Grafikleri",
    pdf_sec_table: "📋 Adım Bazlı Detaylı Test Metrikleri",
    pdf_footer_dev: "LLM StressBench • Geliştirici: <strong>Orçun YILMAZ</strong>",
    pdf_footer_web: "Web: <a href=\"https://orcunyilmaz.com.tr\" target=\"_blank\" style=\"color: #0284c7; text-decoration: none;\">orcunyilmaz.com.tr</a>",

    // Bottleneck & Diagnosis Translations
    bn_normal: "Normal / Dengeli",
    bn_overload: "Sunucu Aşırı Yükü / Bellek Yetersizliği (HTTP 503 / 429 Hataları)",
    bn_queue: "KV Cache Kuyruklanması (Prefill & Batching Kuyruk Şişmesi)",
    bn_bandwidth: "GPU Decode Bellek Bant Genişliği Doyumu",
    bn_no_limit: "Kapasite Sınırına Ulaşılmadı (Sunucu Daha Fazla Yük Kaldırabilir)",
    bn_completed: "Test Adımları Tamamlandı"
  },

  en: {
    // Branding & Header
    app_title: "LLM StressBench",
    app_author: "by Orçun YILMAZ",
    app_subtitle: "OpenAI Compatible Load, TTFT, TPS & KV Cache Stress Analysis Lab",
    status_ready: "READY",
    status_running: "TEST RUNNING",
    status_stopping: "STOPPING...",
    status_stopped: "STOPPED",
    status_completed: "COMPLETED",
    status_error: "ERROR ENCOUNTERED",
    btn_start: "START BENCHMARK",
    btn_stop: "STOP",

    // Live HUD Metrics
    metric_total_tps_title: "Total System TPS",
    metric_total_tps_sub: "tokens/second (All users aggregate)",
    metric_ttft_title: "Median TTFT (First Token)",
    metric_ttft_sub: "First chunk response latency (p50)",
    metric_user_tps_title: "Per-User Speed",
    metric_user_tps_sub: "Streaming fluidity (tok/s/user)",
    metric_concurrency_title: "Active Concurrency",
    metric_concurrency_sub: "Simultaneous virtual users",
    metric_error_rate_title: "Error Rate",
    metric_error_count_fmt: "{failed} Errors / {total} Requests",
    metric_sla_title: "SLA Capacity Status",
    metric_sla_balanced: "Balanced / Idle",
    metric_sla_sub: "Target: TTFT < 800ms",
    metric_sla_passed: "SLA Met (Smooth)",
    metric_sla_exceeded: "SLA Threshold Exceeded",

    // Config Section
    config_title: "Test & Server Parameters",
    tab_concurrency: "1. Concurrency & Capacity Ceiling",
    tab_kv_cache: "2. KV Cache & Context Stress",
    tab_prefix_cache: "3. Prefix Caching (PagedAttention)",
    tab_quick: "4. Quick Benchmark",
    tab_compare: "5. vLLM vs LiteLLM Comparison",

    lbl_target_url: "Target API URL (OpenAI Compatible)",
    hint_target_url: "vLLM: :8000/v1 | LiteLLM: :4000/v1",
    lbl_api_key: "API Key (Optional / for Proxy)",
    hint_api_key: "Enter Bearer token if required",
    placeholder_api_key: "Bearer sk-...",
    lbl_model_name: "Model Name",
    btn_fetch_models: "Fetch Models",
    hint_model_fetch: "Can be queried automatically from server",
    status_querying: "Querying...",
    status_models_found: "{count} models found.",
    status_models_empty: "No models found.",
    status_models_failed: "Query failed: {error}",

    lbl_target_type: "Server Architecture",
    hint_target_type: "Architecture-specific diagnostic rules",
    opt_vllm: "vLLM (Direct GPU Inference Engine)",
    opt_litellm: "LiteLLM (Router / Gateway Proxy)",
    opt_custom: "Custom OpenAI Compatible Endpoint",

    lbl_concurrency_steps: "Concurrency Steps (Comma-separated)",
    hint_concurrency_steps: "Example: 1, 2, 4, 8, 16, 32, 64",
    lbl_requests_per_step: "Requests Per Step",
    hint_requests_per_step: "Total queries to send per step",
    lbl_context_lengths: "KV Cache Context Sizes (Tokens)",
    hint_context_lengths: "Gradually increases prompt length",
    lbl_sla_targets: "SLA Targets",
    badge_sla_threshold: "Zero-Latency Threshold",
    hint_sla: "Max TTFT (ms) / Min User TPS",

    compare_title: "Second Target for Comparison (LiteLLM or vLLM)",
    lbl_compare_url: "Target B URL",
    lbl_compare_key: "Target B API Key",
    lbl_compare_model: "Target B Model Name",

    // Executive Diagnosis Card
    diagnosis_title: "Server Capacity & Zero-Latency User Analysis",
    diagnosis_initial: "Once the benchmark completes, a summary of how many concurrent users your server can handle without latency will appear here.",
    btn_export_pdf: "Download PDF Report",
    run_label: "Run: {id}",
    kpi_zero_latency_capacity: "Zero-Latency Capacity",
    kpi_zero_latency_users: "{n} Concurrent Users",
    kpi_peak_tps: "Peak System Throughput (Peak TPS)",
    kpi_peak_tps_fmt: "{tps} tok/s ({n} Users)",
    kpi_bottleneck: "Diagnosed Bottleneck",
    kpi_not_specified: "Not specified",

    // Charts
    chart_ttft_title: "Concurrent Users vs TTFT & Latency (Capacity Ceiling)",
    chart_ttft_sub: "Saturation Knee-Point",
    chart_ttft_ds_ttft: "Median TTFT (ms)",
    chart_ttft_ds_latency: "p95 Total Latency (ms)",

    chart_tps_title: "Total System Throughput (Tokens / Second)",
    chart_tps_sub: "GPU Saturation Plateau",
    chart_tps_ds_total: "Total System Throughput (tok/s)",
    chart_tps_ds_user: "Per-User TPS (tok/s)",

    chart_percentiles_title: "Latency Distribution & Queue (p50 / p90 / p95 / p99)",
    chart_percentiles_sub: "Queueing Jitter",
    chart_percentiles_ds_p50: "p50 TTFT (ms)",
    chart_percentiles_ds_p90: "p90 TTFT (ms)",
    chart_percentiles_ds_p95: "p95 TTFT (ms)",

    chart_kv_title: "KV Cache & Context Length vs TTFT",
    chart_kv_sub: "KV Memory Saturation",
    chart_kv_ds_ttft: "TTFT (ms) vs Context Size",

    chart_no_data: "No chart data available",

    // Detailed Table
    table_title: "Step-by-Step Test Metrics",
    btn_download_pdf: "Download as PDF",
    col_concurrency: "Concurrency",
    col_success_fail: "Success / Error",
    col_total_tps: "Total TPS",
    col_user_tps: "User TPS",
    col_ttft_p50: "TTFT p50",
    col_ttft_p95: "TTFT p95",
    col_latency_p95: "Latency p95",
    col_tpot: "TPOT",
    col_sla: "SLA Status",
    table_empty: "No benchmark has been executed yet. Click \"Start Benchmark\" above to begin testing.",
    table_user_unit: "{n} Users",
    sla_passed_badge: "PASSED",
    sla_exceeded_badge: "EXCEEDED",

    // Live Stream Terminal
    terminal_title: "Live Request Stream (Real-Time Log)",
    terminal_counter: "{n} Requests",
    terminal_ready: "System ready. Microsecond-level TTFT and TPS metrics will stream here in real time once started...",

    // Footer
    footer_text: "LLM StressBench • <a href=\"https://orcunyilmaz.com.tr\" target=\"_blank\" rel=\"noopener noreferrer\" class=\"text-cyan-400 hover:underline font-medium\">by Orçun YILMAZ</a> • OpenAI Compatible LLM Performance & Stress Test Lab",

    // Alerts & Confirmations
    alert_no_url: "Please enter a valid target API URL.",
    alert_no_model: "Please specify a model name.",
    alert_no_report: "No test results available to print or export. Please run a benchmark first.",
    popup_blocked: "Pop-up blocked. Please allow pop-ups for this site in your browser to view the PDF report.",

    // PDF Printable Document
    pdf_window_title: "LLM StressBench Report - {run_id}",
    pdf_toolbar_title: "📄 LLM StressBench Report Preview & PDF Download",
    pdf_btn_print: "🖨️ Save as PDF / Print",
    pdf_btn_close: "Close",
    pdf_report_title: "LLM StressBench",
    pdf_report_subtitle: "OpenAI Compatible LLM Server Performance & Capacity Analysis Report",
    pdf_meta_report_id: "Report ID:",
    pdf_meta_date: "Date:",
    pdf_meta_web: "Web:",
    pdf_meta_target_url: "Target Server (Base URL)",
    pdf_meta_model: "Model Tested",
    pdf_meta_mode: "Test Mode",
    pdf_meta_duration: "Total Test Duration",
    pdf_seconds: "{n} seconds",
    pdf_sec_charts: "📊 Performance and Capacity Charts",
    pdf_sec_table: "📋 Step-by-Step Test Metrics",
    pdf_footer_dev: "LLM StressBench • Developer: <strong>Orçun YILMAZ</strong>",
    pdf_footer_web: "Web: <a href=\"https://orcunyilmaz.com.tr\" target=\"_blank\" style=\"color: #0284c7; text-decoration: none;\">orcunyilmaz.com.tr</a>",

    // Bottleneck & Diagnosis Translations
    bn_normal: "Normal / Balanced",
    bn_overload: "Server Overload / Out of Memory (HTTP 503 / 429 Errors)",
    bn_queue: "KV Cache Queueing (Prefill & Batching Congestion)",
    bn_bandwidth: "GPU Decode Memory Bandwidth Saturation",
    bn_no_limit: "Capacity Limit Not Reached (Server Can Handle Higher Load)",
    bn_completed: "Test Steps Completed"
  }
};

class I18nManager {
  constructor() {
    this.currentLang = this.detectLanguage();
    this.listeners = [];
  }

  /**
   * Automatic language selection:
   * 1. Checks localStorage for previous user manual choice
   * 2. Checks browser language:
   *    - If starts with 'tr' -> 'tr'
   *    - If starts with 'en' -> 'en'
   *    - If neither -> 'en' (default)
   */
  detectLanguage() {
    const saved = localStorage.getItem('bench_lang');
    if (saved === 'tr' || saved === 'en') {
      return saved;
    }

    const browserLang = (navigator.language || (navigator.languages && navigator.languages[0]) || '').toLowerCase();
    if (browserLang.startsWith('tr')) {
      return 'tr';
    } else if (browserLang.startsWith('en')) {
      return 'en';
    }
    // Neither Turkish nor English -> Default to English
    return 'en';
  }

  getLang() {
    return this.currentLang;
  }

  setLang(lang) {
    if (lang !== 'tr' && lang !== 'en') return;
    this.currentLang = lang;
    localStorage.setItem('bench_lang', lang);
    document.documentElement.lang = lang;
    this.applyTranslations();
    this.notifyListeners();
  }

  onLanguageChange(callback) {
    this.listeners.push(callback);
  }

  notifyListeners() {
    this.listeners.forEach(cb => {
      try { cb(this.currentLang); } catch (e) { console.error('i18n listener error:', e); }
    });
  }

  t(key, replacements = {}) {
    const dict = I18N_RESOURCES[this.currentLang] || I18N_RESOURCES.en;
    let text = dict[key] || I18N_RESOURCES.en[key] || key;
    for (const [k, v] of Object.entries(replacements)) {
      text = text.replace(new RegExp(`\\{${k}\\}`, 'g'), v);
    }
    return text;
  }

  translateBottleneck(bnText) {
    if (!bnText) return this.t('kpi_not_specified');
    const b = bnText.trim();
    if (b.includes('Kapasite Sınırına')) return this.t('bn_no_limit');
    if (b.includes('Aşırı Yük') || b.includes('503')) return this.t('bn_overload');
    if (b.includes('KV Cache Kuyruk') || b.includes('Prefill')) return this.t('bn_queue');
    if (b.includes('Bant Genişliği') || b.includes('Decode')) return this.t('bn_bandwidth');
    if (b.includes('Dengeli') || b.includes('Normal')) return this.t('bn_normal');
    if (b.includes('Tamamlandı')) return this.t('bn_completed');
    return bnText;
  }

  generateExecutiveSummary(analysis) {
    if (!analysis) return '';
    const optimal = analysis.optimal_zero_latency_concurrency || 1;
    const peakConc = analysis.peak_throughput_concurrency || 1;
    const peakTps = analysis.peak_generation_tps || 0;
    const kneePoint = analysis.saturation_knee_point || optimal;
    const rawBn = analysis.bottleneck_diagnosis || '';
    const translatedBn = this.translateBottleneck(rawBn);

    if (this.currentLang === 'en') {
      return `🎯 **Zero-Latency Service Capacity:** Your server can smoothly serve up to **${optimal} concurrent users** without perceptible latency or queueing (within SLA limits).\n` +
             `🚀 **Maximum System Throughput (Peak Throughput):** Highest aggregate token generation was measured at **${peakTps} tokens/sec at ${peakConc} concurrent users**.\n` +
             `⚠️ **Saturation Knee-Point:** Beyond **${kneePoint} users**, latency begins to increase exponentially due to ${translatedBn}.`;
    } else {
      return `🎯 **Gecikmesiz Hizmet Kapasitesi:** Sunucunuz **${optimal} eşzamanlı kullanıcıya** kadar hiçbir hissedilir gecikme veya kuyruklanma olmadan (SLA sınırları içinde) akıcı hizmet verebilmektedir.\n` +
             `🚀 **Maksimum Sistem Verimi (Peak Throughput):** En yüksek toplam token üretimi **${peakConc} eşzamanlı kullanıcıda ${peakTps} tokens/sn** olarak ölçülmüştür.\n` +
             `⚠️ **Doygunluk Kırılım Noktası (Knee-Point):** **${kneePoint} kullanıcı** seviyesinde ${translatedBn} nedeniyle gecikmeler eksponansiyel olarak artışa geçmektedir.`;
    }
  }

  applyTranslations() {
    // 1. Text elements with data-i18n
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.getAttribute('data-i18n');
      if (key) {
        el.innerHTML = this.t(key);
      }
    });

    // 2. Placeholders with data-i18n-placeholder
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
      const key = el.getAttribute('data-i18n-placeholder');
      if (key) {
        el.placeholder = this.t(key);
      }
    });

    // 3. Titles with data-i18n-title
    document.querySelectorAll('[data-i18n-title]').forEach(el => {
      const key = el.getAttribute('data-i18n-title');
      if (key) {
        el.title = this.t(key);
      }
    });

    // 4. Update Language Switcher UI active button
    const btnTr = document.getElementById('langBtnTr');
    const btnEn = document.getElementById('langBtnEn');
    if (btnTr && btnEn) {
      if (this.currentLang === 'tr') {
        btnTr.className = 'px-2.5 py-1 rounded-md text-xs font-bold bg-cyan-600 text-white shadow-sm transition';
        btnEn.className = 'px-2.5 py-1 rounded-md text-xs font-semibold text-slate-400 hover:text-white transition';
      } else {
        btnTr.className = 'px-2.5 py-1 rounded-md text-xs font-semibold text-slate-400 hover:text-white transition';
        btnEn.className = 'px-2.5 py-1 rounded-md text-xs font-bold bg-cyan-600 text-white shadow-sm transition';
      }
    }
  }
}

// Global singleton
window.i18n = new I18nManager();
window.t = (k, r) => window.i18n.t(k, r);
