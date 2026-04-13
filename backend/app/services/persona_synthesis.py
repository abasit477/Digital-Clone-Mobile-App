"""
Persona synthesis service.
Takes onboarding questionnaire answers and produces:
  - persona_prompt: rich first-person personality description for the clone's system prompt
  - knowledge_text: formatted Q&A for ChromaDB ingestion
"""
import json
import boto3
from functools import lru_cache
from ..core.config import get_settings

QUESTIONS = {
    "q1":  "What is your full name and what do people call you?",
    "q2":  "Describe your profession and career journey in your own words.",
    "q3":  "Where did you grow up and how did that shape who you are?",
    "q4":  "What is your educational background?",
    "q5":  "Tell me about your spouse or partner.",
    "q6":  "How many children do you have? Tell me their names, ages, and something special about each one.",
    "q7":  "What family traditions are most important to you?",
    "q8":  "Share a favourite family memory.",
    "q9":  "What are your top 3 core values and why do they matter to you?",
    "q10": "What is the most important life lesson you have learned?",
    "q11": "How do you handle adversity? What advice would you give about it?",
    "q12": "What do you want your legacy to be?",
    "q13": "How would your family describe you in 3 words?",
    "q14": "What topics do you love discussing most?",
    "q15": "How do you typically show love and care to your family?",
    "q16": "Describe your sense of humor — share a joke or funny story.",
    "q17": "What advice would you give your children about relationships and love?",
    "q18": "What do you wish you had known at 20 that you know now?",
    "q19": "What are your hopes and dreams for your family's future?",
    "q20": "Is there anything else you want your family to know and remember about you?",
}


@lru_cache(maxsize=1)
def _get_bedrock_client():
    """Cached Bedrock client — created once per process, reused for all calls."""
    settings = get_settings()
    return boto3.client(
        "bedrock-runtime",
        region_name=settings.AWS_REGION,
        aws_access_key_id=settings.AWS_ACCESS_KEY_ID or None,
        aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY or None,
    )


def _build_qa_text(answers: dict) -> str:
    lines = []
    for key, question in QUESTIONS.items():
        answer = answers.get(key, "").strip()
        if answer:
            lines.append(f"Q: {question}\nA: {answer}\n")
    return "\n".join(lines)


def synthesize_persona(answers: dict) -> dict:
    """
    Returns {"persona_prompt": str, "knowledge_text": str}
    persona_prompt: 200-300 word first-person personality description
    knowledge_text: formatted Q&A for ChromaDB
    """
    settings = get_settings()
    qa_text = _build_qa_text(answers)

    system_prompt = (
        "You are an expert biographer and AI persona designer. "
        "Your task is to synthesize a rich, first-person personality description "
        "from interview answers. The result will be used as a system prompt for an AI clone "
        "that talks to this person's family members. "
        "Write 200-300 words in first-person voice. "
        "Capture their values, communication style, sense of humor, emotional warmth, "
        "life wisdom, and how they speak about their family. "
        "Do NOT use bullet points — write in flowing paragraphs as if the person is introducing themselves. "
        "Start with 'I am' and their name."
    )

    user_message = f"Here are the interview answers:\n\n{qa_text}\n\nNow write the first-person persona description."

    response = _get_bedrock_client().converse(
        modelId=settings.BEDROCK_MODEL_ID,
        system=[{"text": system_prompt}],
        messages=[{"role": "user", "content": [{"text": user_message}]}],
        inferenceConfig={"maxTokens": 600, "temperature": 0.7},
    )

    persona_prompt = response["output"]["message"]["content"][0]["text"].strip()
    knowledge_text = qa_text

    return {"persona_prompt": persona_prompt, "knowledge_text": knowledge_text}
