"""
News-Intel NLP Pipeline — HuggingFace Space
Hosts 3 models on free CPU tier:
  1. Summarization: sshleifer/distilbart-cnn-12-6
  2. Sentiment: cardiffnlp/twitter-roberta-base-sentiment-latest
  3. NER: dslim/bert-base-NER

Deploy to: huggingface.co/spaces/<your-username>/newsintel-nlp
"""

import gradio as gr
from transformers import pipeline
import json

# ── Load Models (cached on Space startup) ────────────────────────────────────
print("Loading summarization model...")
summarizer = pipeline("summarization", model="sshleifer/distilbart-cnn-12-6", device=-1)
print("✓ Summarization ready")

print("Loading sentiment model...")
sentiment_analyzer = pipeline(
    "sentiment-analysis",
    model="cardiffnlp/twitter-roberta-base-sentiment-latest",
    device=-1,
    top_k=None
)
print("✓ Sentiment ready")

print("Loading NER model...")
ner_extractor = pipeline(
    "ner",
    model="dslim/bert-base-NER",
    aggregation_strategy="simple",
    device=-1
)
print("✓ NER ready")


# ── Endpoint Functions ───────────────────────────────────────────────────────

def summarize(text: str) -> str:
    """Summarize input text using distilbart-cnn-12-6"""
    if not text or len(text.strip()) < 30:
        return json.dumps({"error": "Text too short for summarization", "min_length": 30})

    # distilbart works best with 50-1024 tokens input
    # Truncate very long input to avoid OOM on CPU
    truncated = text[:3000]

    try:
        result = summarizer(
            truncated,
            max_length=150,
            min_length=30,
            do_sample=False,
            truncation=True
        )
        summary = result[0]["summary_text"]
        return json.dumps({
            "summary": summary,
            "model": "sshleifer/distilbart-cnn-12-6",
            "input_length": len(text),
            "output_length": len(summary)
        })
    except Exception as e:
        return json.dumps({"error": str(e)})


def analyze_sentiment(text: str) -> str:
    """Analyze sentiment using twitter-roberta-base-sentiment-latest"""
    if not text or len(text.strip()) < 5:
        return json.dumps({"error": "Text too short for sentiment analysis"})

    # Truncate to model's max length (512 tokens ~ 2000 chars)
    truncated = text[:2000]

    try:
        result = sentiment_analyzer(truncated)
        # result is [[{label, score}, ...]] — flatten
        scores = result[0] if isinstance(result[0], list) else result

        # Map RoBERTa labels to standard labels
        label_map = {
            "positive": "positive",
            "negative": "negative",
            "neutral": "neutral",
            # Some model versions use different label formats
            "LABEL_0": "negative",
            "LABEL_1": "neutral",
            "LABEL_2": "positive",
        }

        mapped = []
        for item in scores:
            label = label_map.get(item["label"].lower(), item["label"].lower())
            mapped.append({"label": label, "score": round(item["score"], 4)})

        # Sort by score descending
        mapped.sort(key=lambda x: x["score"], reverse=True)
        top = mapped[0]

        return json.dumps({
            "label": top["label"],
            "score": top["score"],
            "all_scores": mapped,
            "model": "cardiffnlp/twitter-roberta-base-sentiment-latest"
        })
    except Exception as e:
        return json.dumps({"error": str(e)})


def extract_entities(text: str) -> str:
    """Extract named entities using bert-base-NER"""
    if not text or len(text.strip()) < 5:
        return json.dumps({"error": "Text too short for NER"})

    # Truncate to model's max length
    truncated = text[:2000]

    try:
        result = ner_extractor(truncated)

        entities = []
        seen = set()
        for ent in result:
            name = ent["word"].strip()
            etype = ent["entity_group"]
            score = round(ent["score"], 4)

            # Skip very short or noisy entities
            if len(name) < 2 or name.startswith("##"):
                continue

            # Deduplicate by name
            key = f"{name.lower()}:{etype}"
            if key in seen:
                continue
            seen.add(key)

            entities.append({
                "name": name,
                "type": etype,
                "score": score
            })

        # Sort by score, limit to top 15
        entities.sort(key=lambda x: x["score"], reverse=True)
        entities = entities[:15]

        return json.dumps({
            "entities": entities,
            "count": len(entities),
            "model": "dslim/bert-base-NER"
        })
    except Exception as e:
        return json.dumps({"error": str(e)})


# ── Health Check ─────────────────────────────────────────────────────────────

def health_check() -> str:
    """Simple health check to verify all models are loaded"""
    return json.dumps({
        "status": "healthy",
        "models": {
            "summarization": "sshleifer/distilbart-cnn-12-6",
            "sentiment": "cardiffnlp/twitter-roberta-base-sentiment-latest",
            "ner": "dslim/bert-base-NER"
        },
        "device": "cpu"
    })


# ── Gradio Interface ─────────────────────────────────────────────────────────

with gr.Blocks(title="News-Intel NLP Pipeline") as demo:
    gr.Markdown("# 🧠 News-Intel NLP Pipeline")
    gr.Markdown("Real AI-powered text analysis for News-Intel platform.")

    with gr.Tab("Summarization"):
        gr.Markdown("### Summarize news articles using distilBART")
        sum_input = gr.Textbox(label="Input Text", lines=8, placeholder="Paste news article text here...")
        sum_output = gr.Textbox(label="Result (JSON)", lines=6)
        sum_btn = gr.Button("Summarize", variant="primary")
        sum_btn.click(fn=summarize, inputs=sum_input, outputs=sum_output)

    with gr.Tab("Sentiment"):
        gr.Markdown("### Analyze sentiment using RoBERTa")
        sent_input = gr.Textbox(label="Input Text", lines=5, placeholder="Enter text to analyze sentiment...")
        sent_output = gr.Textbox(label="Result (JSON)", lines=6)
        sent_btn = gr.Button("Analyze Sentiment", variant="primary")
        sent_btn.click(fn=analyze_sentiment, inputs=sent_input, outputs=sent_output)

    with gr.Tab("NER"):
        gr.Markdown("### Extract entities using BERT-NER")
        ner_input = gr.Textbox(label="Input Text", lines=5, placeholder="Enter text to extract entities...")
        ner_output = gr.Textbox(label="Result (JSON)", lines=8)
        ner_btn = gr.Button("Extract Entities", variant="primary")
        ner_btn.click(fn=extract_entities, inputs=ner_input, outputs=ner_output)

    with gr.Tab("Health"):
        gr.Markdown("### System Health Check")
        health_output = gr.Textbox(label="Status", lines=6)
        health_btn = gr.Button("Check Health")
        health_btn.click(fn=health_check, outputs=health_output)

demo.launch()
