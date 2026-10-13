"""
LLM StressBench Pro - Synthetic Prompt Generator
Generates realistic conversational and stress prompts of varying token lengths,
supporting cold cache prompts and shared prefix caching scenarios.
"""

import random
import string
from typing import List, Dict, Any, Tuple

# Sample base texts for building multi-length context
BASE_KNOWLEDGE_CHUNKS = [
    "Dağıtık sistemlerde veri tutarlılığı ve konsensus algoritmaları, özellikle Raft ve Paxos protokolleri "
    "üzerinden incelenmektedir. Durum makinelerinin replikasyonu, lider seçimi, günlük sıkıştırma ve log "
    "replikasyonu gibi temel aşamalar, yüksek erişilebilirlik ve hata toleransı sağlamak amacıyla kullanılır. ",
    
    "Büyük Dil Modellerinde (LLM) çıkarım (inference) mimarisi; prefill (ön-doldurma) ve decode (çözümleme) "
    "olmak üzere iki ana evreden oluşur. Prefill aşaması matris çarpımları açısından compute-bound iken, "
    "decode aşaması autoregressive yapısı ve bellek bant genişliği darboğazı nedeniyle memory-bandwidth-bound "
    "karakteristik sergiler. ",
    
    "vLLM mimarisinde PagedAttention teknolojisi, sanal bellek sayfalandırma (paging) tekniğinden esinlenerek "
    "Key-Value (KV) önbellek parçalanmasını (fragmentation) sıfıra indirmeyi hedefler. Geleneksel bitişik "
    "bellek tahsisatı yerine blok tabanlı dinamik KV bellek yönetimi uygulanır. ",
    
    "LiteLLM kütüphanesi, çoklu model sağlayıcıları arasında yük dengeleme (load balancing), hata durumunda "
    "otomatik yönlendirme (failover), hız sınırlama (rate limiting) ve istek kuyruklama katmanı sağlayan "
    "bir proxy mimarisidir. Arka uçtaki vLLM sunucuları ile istemciler arasında yönlendirici görevi görür. ",
    
    "CUDA çekirdekleri üzerinde FlashAttention ve FlashInfer kütüphaneleri, GPU SRAM bellek hiyerarşisini "
    "optimum düzeyde kullanarak IO karmaşıklığını O(N^2) seviyesinden O(N) seviyesine indirir. Böylece uzun "
    "bağlamlı (long-context) istemlerde TTFT gecikmesi minimize edilir. "
]

SHARED_SYSTEM_PREFIX = """# SYSTEM CONTEXT PROTOCOL: HIGH PERFORMANCE AGENT ENGINE
You are an ultra-high performance AI assistant optimized for technical architecture, systems programming, and high-concurrency analysis.
Follow these operational guidelines strictly:
1. Provide accurate, concise, and structured answers.
2. Analyze trade-offs between memory bandwidth, GPU utilization, and latency.
3. Highlight bottlenecks such as KV cache limits, queue contention, and prefill overhead.
4. Always respond with technical precision and factual clarity.
"""

class PromptGenerator:
    """Generates synthetic prompts for testing TTFT, TPS, and KV Cache."""

    @staticmethod
    def generate_random_context(target_tokens: int) -> str:
        """
        Approximate 1 token ~ 3.5 - 4 chars for Turkish/English mixed technical text.
        Generates structured text of approx target_tokens.
        """
        chars_needed = int(target_tokens * 3.8)
        content_parts = []
        current_len = 0
        
        while current_len < chars_needed:
            chunk = random.choice(BASE_KNOWLEDGE_CHUNKS)
            # Add some entropy so cold prompts are truly distinct
            entropy_id = "".join(random.choices(string.ascii_letters + string.digits, k=6))
            part = f"[Ref {entropy_id}] {chunk} "
            content_parts.append(part)
            current_len += len(part)
            
        return "".join(content_parts)

    @classmethod
    def get_prompt_for_mode(
        cls,
        mode: str,
        token_length: int = 256,
        prefix_caching: bool = False,
        custom_system: str = "",
        custom_prompt: str = ""
    ) -> List[Dict[str, str]]:
        """
        Builds the OpenAI messages payload according to the test type.
        """
        if custom_prompt.strip():
            messages = []
            if custom_system.strip():
                messages.append({"role": "system", "content": custom_system})
            messages.append({"role": "user", "content": custom_prompt})
            return messages

        if prefix_caching:
            # Shared prefix caching mode: System prompt is massive and identical for all requests.
            # Only user prompt changes slightly.
            shared_system = SHARED_SYSTEM_PREFIX + "\n" + cls.generate_random_context(target_tokens=max(token_length - 50, 100))
            user_question = f"Sistem mimarisiyle ilgili temel çıkarım darboğazlarını kısaca 3 maddede özetle. İstek ID: {random.randint(1000, 999999)}"
            return [
                {"role": "system", "content": shared_system},
                {"role": "user", "content": user_question}
            ]

        # Cold / unique prompts: Context is generated freshly with unique tokens
        if token_length <= 150:
            questions = [
                "Büyük dil modellerinde KV Cache nedir ve bellek bant genişliğini nasıl etkiler? Kısaca açıkla.",
                "vLLM ile LiteLLM arasındaki farkları 3 maddede özetle.",
                "Prefill ve decode aşamalarının farklarını teknik olarak açıkla.",
                "Eşzamanlı istekler arttığında Time To First Token (TTFT) neden yükselir?",
                "PagedAttention algoritmasının geleneksel dikkat mekanizmasına göre temel avantajı nedir?",
                "Yapay zeka çıkarımında kuantizasyon (AWQ, FP8, GPTQ) bellek kullanımını nasıl optimize eder?",
                "HTTP 503 ve 429 yanıt kodlarının LLM sunucu kapasite testlerindeki anlamı nedir?",
                "GPU bellek doygunluğu (OOM) öncesi KV Cache preemption belirtileri nelerdir?"
            ]
            q = random.choice(questions)
            unique_salt = "".join(random.choices(string.ascii_letters + string.digits, k=8))
            return [
                {"role": "system", "content": "Sen yardımcı ve teknik bir yapay zeka asistanısın."},
                {"role": "user", "content": f"{q} [İstek referans kodu: {unique_salt}]"}
            ]
        else:
            context = cls.generate_random_context(target_tokens=token_length - 50)
            unique_salt = "".join(random.choices(string.ascii_letters + string.digits, k=10))
            return [
                {"role": "system", "content": "Aşağıdaki teknik bağlamı incele ve verilen soruyu yanıtla."},
                {
                    "role": "user",
                    "content": f"Bağlam Belgesi:\n{context}\n\nSoru [{unique_salt}]: Yukarıdaki sistem bağlamına dayanarak, bellek yönetimi ve çıkarım optimizasyonlarını 2 paragrafta değerlendir."
                }
            ]
