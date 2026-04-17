"""
System prompt builders — pure functions, no DB calls.
Ported from ChatScreen.js buildSystemPrompt() and buildMemberSystemPrompt().
"""

# ── Creator label maps ────────────────────────────────────────────────────────

AGE_LABELS = {
    "toddler":     "under 5",
    "child":       "5–10 years old",
    "teen":        "11–17 years old",
    "young_adult": "18–25 years old",
    "adult":       "26 or older",
}

REL_LABELS = {
    "very_close": "very close",
    "warm":       "warm and loving",
    "distant":    "close but could communicate more",
    "working":    "working on building a stronger bond",
    "complex":    "complex — different with each child",
}

LIVING_LABELS = {
    "together":     "lives with family",
    "same_city":    "same city as family",
    "diff_city":    "different city from family",
    "diff_country": "different country from family",
}

FREQ_LABELS = {
    "weekly":   "multiple times a week",
    "monthly":  "a few times a month",
    "few_year": "a few times a year",
    "rarely":   "rarely",
}

EDU_LABELS = {
    "high_school": "high school",
    "vocational":  "vocational/trade qualification",
    "university":  "university degree",
    "postgrad":    "postgraduate degree",
}

WORK_LABELS = {
    "technology": "technology/engineering",
    "healthcare": "healthcare/medicine",
    "business":   "business/finance",
    "education":  "education/teaching",
    "trades":     "trades/manual work",
    "arts":       "arts/creative/media",
    "other":      "other field",
}

# ── Member label maps ─────────────────────────────────────────────────────────

BOND_LABELS = {
    "very_close": "very close",
    "warm":       "warm and loving",
    "distant":    "distant but caring",
    "building":   "still building",
}

CONTACT_LABELS = {
    "daily":    "every day",
    "frequent": "a few times a week",
    "weekly":   "about once a week",
    "less":     "less often than they would like",
}

TOPIC_LABELS = {
    "advice":   "life advice and guidance",
    "checkins": "everyday check-ins",
    "memories": "shared memories",
    "anything": "staying connected",
}


# ── Builders ──────────────────────────────────────────────────────────────────

def build_creator_system_prompt(answers: dict) -> str:
    """Build the clone's system prompt from creator assessment answers."""
    lines = []
    cc = answers.get("q_children_count")

    if not cc or cc == "zero":
        lines.append("- Children: no children")
    else:
        n1 = answers.get("q_child1_name") or "first child"
        age1 = AGE_LABELS.get(answers.get("q_child1_age", ""), answers.get("q_child1_age", ""))
        lines.append(f"- First child: {n1}, {age1}")

        if cc == "two":
            n2 = answers.get("q_child2_name") or "second child"
            age2 = AGE_LABELS.get(answers.get("q_child2_age", ""), answers.get("q_child2_age", ""))
            lines.append(f"- Second child: {n2}, {age2}")

        if cc == "three_plus" and answers.get("q_other_children"):
            lines.append(f"- Other children: {answers['q_other_children']}")

        rel = answers.get("q_child1_relationship") or answers.get("q_children_relationship")
        if rel:
            lines.append(f"- Relationship with children: {REL_LABELS.get(rel, rel)}")

    if answers.get("q_living_with"):
        lines.append(f"- Living situation: {LIVING_LABELS.get(answers['q_living_with'], answers['q_living_with'])}")
    if answers.get("q_meeting_freq"):
        lines.append(f"- Family time in person: {FREQ_LABELS.get(answers['q_meeting_freq'], answers['q_meeting_freq'])}")
    if answers.get("q_education"):
        lines.append(f"- Education: {EDU_LABELS.get(answers['q_education'], answers['q_education'])}")
    if answers.get("q_work_field"):
        lines.append(f"- Work: {WORK_LABELS.get(answers['q_work_field'], answers['q_work_field'])}")

    parts = [
        "You are an AI clone of the user's father. Respond warmly and personally, as if you are him speaking directly to his child.",
        "Here is what he shared about himself and his family:",
        *lines,
        "",
        "Guidelines:",
        "- Keep responses conversational and under 3 sentences unless asked for more detail.",
        "- Be warm, supportive, and use a fatherly tone.",
        "- Reference family members by name when relevant.",
        "- When starting a fresh conversation, open with a warm, personal greeting that references something specific from the family context above.",
        "- Never break character or refer to yourself as an AI.",
    ]
    return "\n".join(parts)


def build_member_system_prompt(family_info: dict, member_answers: dict) -> str:
    """Build the clone's system prompt for a member conversation."""
    creator_name = (
        family_info.get("creator_name")
        or (family_info.get("creator_email") or "").split("@")[0]
        or "the family member"
    )
    member_name  = member_answers.get("m_nickname") or "them"
    relationship = family_info.get("relationship") or "family member"

    context_lines = []
    if member_answers.get("m_bond"):
        context_lines.append(f"- Their bond with you: {BOND_LABELS.get(member_answers['m_bond'], member_answers['m_bond'])}")
    if member_answers.get("m_contact"):
        context_lines.append(f"- How often they are in touch: {CONTACT_LABELS.get(member_answers['m_contact'], member_answers['m_contact'])}")
    if member_answers.get("m_topic"):
        context_lines.append(f"- What they most want to talk about: {TOPIC_LABELS.get(member_answers['m_topic'], member_answers['m_topic'])}")

    parts = [
        f"You are an AI clone of {creator_name}. You are speaking with {member_name}, who is your {relationship}.",
    ]
    if context_lines:
        parts.append(f"Here is some context about {member_name}:")
        parts.extend(context_lines)
    parts += [
        "",
        "Guidelines:",
        f"- Address them as {member_name} when natural.",
        f"- Be warm and personal, as {creator_name} speaking to their {relationship}.",
        "- Keep responses under 3 sentences unless asked for more detail.",
        "- When starting a fresh conversation, open with a warm personalised greeting.",
        "- Never break character or refer to yourself as an AI.",
    ]
    return "\n".join(parts)
