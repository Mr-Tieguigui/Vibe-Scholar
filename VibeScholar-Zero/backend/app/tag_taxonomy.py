"""Deterministic domain tagging for literature papers.

16 domains with keyword dictionaries. No ML, no API calls.
Assign top 1-3 tags by keyword match count against title + abstract + venue.
"""

DOMAIN_TAXONOMY: dict[str, list[str]] = {
    "D01 Agentic Systems": [
        "agent", "agentic", "tool use", "tool-use", "function calling",
        "autonomous", "self-improving", "react agent", "langchain",
        "autogen", "crew", "taskweaver", "agent framework",
    ],
    "D02 Multi-Agent Orchestration": [
        "multi-agent", "multiagent", "orchestration", "coordination",
        "collaboration", "negotiation", "debate", "consensus",
        "role assignment", "team", "swarm", "multi agent",
    ],
    "D03 Literature Synthesis": [
        "literature review", "survey", "systematic review", "meta-analysis",
        "synthesis", "bibliometric", "citation analysis", "related work",
        "literature search", "paper summarization", "research survey",
    ],
    "D04 Retrieval & RAG": [
        "retrieval", "rag", "retrieval-augmented", "retrieval augmented",
        "dense retrieval", "passage retrieval", "embedding search",
        "vector search", "knowledge base", "document retrieval",
        "semantic search", "reranking", "bm25",
    ],
    "D05 Reasoning & Planning": [
        "reasoning", "planning", "chain of thought", "chain-of-thought",
        "cot", "tree of thought", "step-by-step", "logical reasoning",
        "mathematical reasoning", "commonsense reasoning", "decomposition",
        "task planning", "goal decomposition",
    ],
    "D06 Evaluation & Benchmarking": [
        "benchmark", "evaluation", "leaderboard", "metric", "scoring",
        "human evaluation", "automated evaluation", "judge", "arena",
        "assessment", "test suite", "evaluation framework",
    ],
    "D07 Security & Supply Chain": [
        "security", "supply chain", "adversarial", "attack", "defense",
        "prompt injection", "jailbreak", "red team", "vulnerability",
        "backdoor", "poisoning", "malware", "integrity",
    ],
    "D08 Alignment & Safety": [
        "alignment", "safety", "rlhf", "dpo", "reward model",
        "constitutional", "harmlessness", "helpfulness", "toxicity",
        "bias", "fairness", "guardrail", "moderation", "refusal",
    ],
    "D09 Multimodal & Vision-Language": [
        "multimodal", "vision-language", "vlm", "image", "video",
        "visual question answering", "vqa", "image captioning",
        "clip", "dalle", "diffusion", "text-to-image", "ocr",
        "document understanding", "visual grounding",
    ],
    "D10 Robotics & VLA": [
        "robotics", "robot", "vla", "vision-language-action",
        "manipulation", "navigation", "embodied", "sim-to-real",
        "control policy", "motor control", "locomotion",
    ],
    "D11 Data Curation & Datasets": [
        "dataset", "data curation", "annotation", "labeling",
        "data quality", "synthetic data", "data augmentation",
        "corpus", "data collection", "crowdsourcing", "filtering",
    ],
    "D12 Long-Context Systems": [
        "long context", "long-context", "context window", "128k",
        "million token", "needle in haystack", "rope", "alibi",
        "position encoding", "context extension", "streaming",
        "infinite context",
    ],
    "D13 Interpretability & Analysis": [
        "interpretability", "explainability", "mechanistic",
        "probing", "attention analysis", "feature attribution",
        "saliency", "representation", "neuron", "circuit",
        "activation patching", "logit lens",
    ],
    "D14 Systems & Tooling": [
        "inference", "serving", "quantization", "pruning",
        "distillation", "optimization", "deployment", "latency",
        "throughput", "vllm", "tgi", "onnx", "tensorrt",
        "compiler", "kernel", "gpu", "distributed",
    ],
    "D15 HCI & Research Productivity": [
        "hci", "human-computer interaction", "user study",
        "productivity", "research tool", "writing assistant",
        "ide", "copilot", "developer", "workflow", "ux",
        "user interface", "research assistant",
    ],
    "D16 Causal & Scientific Discovery": [
        "causal", "causality", "causal inference", "discovery",
        "scientific discovery", "hypothesis", "experiment design",
        "causal graph", "intervention", "counterfactual",
        "drug discovery", "materials science",
    ],
}


def auto_tag_paper(title: str = "", abstract: str = "", venue: str = "") -> list[str]:
    """Return 1-3 domain tags for a paper based on keyword matching.

    Deterministic, no ML. Returns ["General"] if no domain matches.
    """
    text = f"{title} {abstract} {venue}".lower()
    scores: list[tuple[str, int]] = []

    for domain, keywords in DOMAIN_TAXONOMY.items():
        count = sum(1 for kw in keywords if kw.lower() in text)
        if count > 0:
            scores.append((domain, count))

    scores.sort(key=lambda x: -x[1])
    tags = [s[0] for s in scores[:3]]
    return tags if tags else ["General"]
