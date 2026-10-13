# 🚀 LLM StressBench
### by Orçun YILMAZ ([orcunyilmaz.com.tr](https://orcunyilmaz.com.tr))
> **High-Performance Load, TTFT, TPS & KV Cache Benchmark Suite for OpenAI-Compatible LLM Servers (vLLM, LiteLLM, Ollama, SGLang, TGI).**

[![Python 3.10+](https://img.shields.io/badge/Python-3.10%2B-blue.svg)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.100%2B-009688.svg)](https://fastapi.tiangolo.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Author](https://img.shields.io/badge/Author-Orçun%20YILMAZ-0284c7.svg)](https://orcunyilmaz.com.tr)
[![Languages](https://img.shields.io/badge/Languages-TR%20%7C%20EN-emerald.svg)](#)

---

## 🌐 English Overview

**LLM StressBench** is an advanced benchmarking and capacity diagnosis suite tailored for OpenAI-compatible LLM inference servers and gateways (**vLLM**, **LiteLLM**, **SGLang**, **TGI**, **Ollama**). It provides microsecond-precision SSE streaming metrics, saturation knee-point detection, real-time Chart.js visual analytics, and exportable executive PDF/JSON/CSV reports.

### Key Capabilities
- **Time to First Token (TTFT):** Measures streaming latency with precision percentiles (p50, p90, p95, p99).
- **Throughput Saturation (TPS):** Measures aggregate system token generation vs per-user perceived fluidity.
- **Knee-Point Capacity Analysis:** Automatically pinpoints the exact concurrency limit where hardware begins queueing or degrading.
- **KV Cache & Context Scaling:** Stresses the GPU memory by progressively scaling prompt context (512 to 16k+ tokens).
- **Prefix Caching (PagedAttention):** Compares shared system prompt cache hits against cold random prompts.
- **vLLM vs LiteLLM A/B Testing:** Measures proxy latency overhead and connection pooling impact.
- **Bilingual Interface:** Automatic browser language detection (Turkish / English) with instantaneous manual toggle.
- **Executive PDF Reports:** Generates professional A4 print/PDF capacity diagnostic reports in one click.

### Quick Start (Web GUI)
```bash
# Clone the repository
git clone https://github.com/iorcunyilmaz/llm-stressbench.git
cd llm-stressbench

# Install requirements
pip install -r requirements.txt

# Launch Dashboard (Windows / Linux)
python main.py
```
Open **`http://localhost:8765`** in your browser.

---

## 🇹🇷 Türkçe Dokümantasyon

OpenAI API uyumlu tüm LLM sunucularını (**vLLM**, **LiteLLM**, **SGLang**, **TGI**, **Ollama**, vb.) test etmek, donanım kapasite sınırlarını belirlemek, anlık grafiklerle izlemek ve **PDF/CSV/JSON** formatında yönetici raporu almak için geliştirilmiş profesyonel test paketidir.

### 🌟 Öne Çıkan Özellikler ve Ölçülen Metrikler

1. **Saniyedeki Token Sayısı (TPS - Tokens Per Second):**
   - **Toplam Sistem Verimi (Aggregate Generation TPS):** Sunucunun tüm eşzamanlı kullanıcılara aynı anda toplam kaç token ürettiği (GPU doyum seviyesi).
   - **Kullanıcı Başına Akıcılık Hızı (Per-User Streaming TPS):** Her bir son kullanıcının ekranında akan metnin gerçek akıcılık hızı.
   - **Toplam TPS:** Prompt (giriş) + Çıktı tokenlarının toplam işlenme hızı.

2. **İlk Token Tepki Süresi (TTFT - Time To First Token):**
   - Mikro-saniyelik hassasiyetle SSE (Server-Sent Events) üzerinden ilk anlamlı kelime parçacığının geldiği an ölçülür.
   - **p50 (Medyan), p90, p95, p99** yüzdelik dilimleriyle kuyruğa takılan istekler tespit edilir.

3. **Gecikme (Latency) ve Hata Analizi:**
   - **Uçtan Uca Gecikme (E2E Latency):** İstek başlangıcından stream kapanışına kadar geçen süre.
   - **TPOT (Time Per Output Token):** Çıktı tokenları arasındaki ortalama süre.
   - **Hata Takibi:** HTTP 429 (Rate Limit), HTTP 500, HTTP 502/504 (Zaman Aşımı) ve özellikle vLLM'in bellek yetmediğinde döndürdüğü HTTP 503 (Server Overloaded) durumları anlık loglanır.

4. **KV Cache Dayanıklılık & Bağlam (Context) Testi:**
   - **Bağlam Büyütme Testi (Context Sweep):** Prompt boyutu kademeli olarak (512, 1024, 2048, 4096, 8192 token) artırılarak KV Cache belleğinin ne zaman dolduğu ve TTFT'nin ne zaman sıçrama yaptığı gözlemlenir.
   - **Prefix Caching Testi (PagedAttention):** Ortak sistem promptu ile yapılan önbellekli çağrılar (Cache Hit) ile tamamen benzersiz soğuk istemler (Cold Prompts / Cache Miss) karşılaştırılır.

5. **"Aynı Anda Kaç Kişiye Gecikmesiz Hizmet Verebiliyor?" (Knee-Point Doygunluk Analizi):**
   - 1, 2, 4, 8, 16, 32, 64... kullanıcı adımlarıyla eşzamanlı yük bindirilir.
   - Belirlediğiniz SLA sınırına göre (örn. TTFT < 800ms ve Kullanıcı TPS > 15) sunucunun **sıfır gecikmeli azami kapasitesi** ve tıkanmanın başladığı **Kırılım Noktası (Knee-Point)** otomatik hesaplanır.

6. **vLLM vs LiteLLM A/B Karşılaştırması:**
   - Doğrudan vLLM GPU motoruna bağlanan istekler ile LiteLLM proxy üzerinden yönlendirilen istekleri aynı parametrelerle test edip aradaki proxy yükünü, gecikme farkını ve bağlantı havuzu verimini kıyaslar.

---

## 🖥️ Kurulum ve Çalıştırma

### Gereksinimler
- Python 3.10+
- `pip install -r requirements.txt`

### 1. Web Arayüzü (GUI) ile Başlatma

#### Windows:
`start.bat` veya `start.ps1` dosyasını çalıştırın ya da:
```bash
python main.py
```

#### Linux Sunucu:
```bash
chmod +x start.sh
./start.sh
# veya arka planda:
nohup python3 main.py --host 0.0.0.0 --port 8765 > bench.log 2>&1 &
```

Tarayıcınızda açın:
👉 **`http://localhost:8765`**

---

### 2. Terminal / SSH Üzerinden CLI Modu (Headless)

```bash
# Eşzamanlılık testi (1, 2, 4, 8, 16, 32 kullanıcı)
python cli.py --url http://localhost:8000/v1 --concurrency 1,2,4,8,16,32

# Model belirterek KV Cache stres testi
python cli.py --url http://localhost:8000/v1 --model Mercan/Gemma-4-E4B-it --mode kv_cache_stress --contexts 512,1024,2048,4096,8192

# LiteLLM Proxy testi (API Key ile)
python cli.py --url http://localhost:4000/v1 --api-key sk-litellm-key --mode concurrency_sweep

# vLLM Prefix Cache (PagedAttention) hızlanma testi
python cli.py --url http://localhost:8000/v1 --mode prefix_cache_test
```

---

## 📊 Test Modları Rehberi

| Mod | Açıklama | Hangi Soruya Yanıt Verir? |
|---|---|---|
| **1. Eşzamanlı Kullanıcı & Kapasite Tavanı** | Eşzamanlılığı 1'den başlayıp kademeli artırarak (1, 2, 4, 8, 16, 32...) yük bindirir. | *"Sunucum aynı anda kaç kişiye gecikmesiz hizmet verebilir? Donanım nerede tıkanıyor?"* |
| **2. KV Cache & Bağlam Dayanıklılığı** | Eşzamanlılığı sabit tutup istem uzunluğunu (512 -> 8192 token) büyütür. | *"KV Cache ne kadar yük kaldırabiliyor? Uzun belgelerde bellek tükeniyor mu?"* |
| **3. Prefix Caching (PagedAttention)** | Ortak sistem promptu (Warm Cache) ile rastgele benzersiz promptları (Cold Cache) karşılaştırır. | *"vLLM'in önbelleklemesi ilk token yanıtını (TTFT) kaç kat hızlandırıyor?"* |
| **4. Hızlı Test** | 3-5 istek ile anlık TTFT, TPS ve gecikme sağlığını ölçer. | *"Sunucum çalışıyor mu, ilk tepki süresi ne kadar?"* |
| **5. vLLM vs LiteLLM Kıyaslama** | İki sunucuya aynı iş yükünü vererek doğrudan GPU ile proxy arasındaki gecikmeyi ölçer. | *"LiteLLM kullanmak ne kadar ek gecikme (overhead) yaratıyor?"* |

---

## 📈 Rapor Dışa Aktarma
Her test sonucunu Web Arayüzü üzerinden tek tıkla:
- **PDF Raporu:** Yönetici sunumu için hazır, renkli KPI kutuları ve grafik görselleri içeren profesyonel format.
- **JSON Formatında:** Detaylı mikro-saniyelik zaman damgaları ve dağılımlar.
- **CSV Formatında:** Excel veya veri analizi araçlarında açmaya hazır adım özeti.

---

## 📄 Lisans
Bu proje [MIT Lisansı](LICENSE) altında lisanslanmıştır.  
Geliştirici: **Orçun YILMAZ** ([orcunyilmaz.com.tr](https://orcunyilmaz.com.tr))
