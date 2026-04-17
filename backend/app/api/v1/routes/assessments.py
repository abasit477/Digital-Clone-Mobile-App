"""
Assessment endpoints.
Creator: save/load onboarding answers + serve question bank.
Member:  save/load 4-question assessment answers + serve questions.
"""
import uuid
import json
import logging
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ....db.database import get_db
from ....models.assessment import AssessmentAnswer, MemberAssessmentAnswer
from ....models.clone import Clone
from ....models.family import FamilyMember
from ....models.schemas import (
    AssessmentSaveRequest, AssessmentAnswersResponse,
    QuestionsResponse, Question,
)
from ....core.security import verify_token
from ....services.prompt_builder import build_creator_system_prompt

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/assessments", tags=["assessments"])


# ── Creator question bank (ported from FamilyAssessmentScreen.js) ─────────────

CREATOR_QUESTION_BANK = {
    "q_children_count": Question(
        key="q_children_count",
        text="How many children do you have?",
        type="mcq",
        category="Family",
        options={
            "zero":       "No children",
            "one":        "1 child",
            "two":        "2 children",
            "three_plus": "3 or more",
        },
    ),
    "q_child1_name": Question(
        key="q_child1_name",
        text="What is your first child's name?",
        type="text",
        category="Family",
        placeholder="Enter their name",
    ),
    "q_child1_age": Question(
        key="q_child1_age",
        text="How old is {{child1Name}}?",
        type="mcq",
        category="Family",
        options={
            "toddler":     "Under 5",
            "child":       "5–10 years old",
            "teen":        "11–17 years old",
            "young_adult": "18–25 years old",
            "adult":       "26 or older",
        },
    ),
    "q_child1_relationship": Question(
        key="q_child1_relationship",
        text="How would you describe your relationship with {{child1Name}}?",
        type="mcq",
        category="Family",
        options={
            "very_close": "Very close — we share everything",
            "warm":       "Warm and loving",
            "distant":    "Close but could communicate more",
            "working":    "Working on building a stronger bond",
        },
    ),
    "q_child2_name": Question(
        key="q_child2_name",
        text="What is your second child's name?",
        type="text",
        category="Family",
        placeholder="Enter their name",
    ),
    "q_child2_age": Question(
        key="q_child2_age",
        text="How old is {{child2Name}}?",
        type="mcq",
        category="Family",
        options={
            "toddler":     "Under 5",
            "child":       "5–10 years old",
            "teen":        "11–17 years old",
            "young_adult": "18–25 years old",
            "adult":       "26 or older",
        },
    ),
    "q_other_children": Question(
        key="q_other_children",
        text="Tell us briefly about your other children.",
        type="text",
        category="Family",
        placeholder="Names, ages, or anything you'd like to share",
    ),
    "q_children_relationship": Question(
        key="q_children_relationship",
        text="How would you describe your relationship with your children overall?",
        type="mcq",
        category="Family",
        options={
            "very_close": "Very close — we share everything",
            "warm":       "Warm and loving",
            "distant":    "Close but could communicate more",
            "working":    "Working on building a stronger bond",
            "complex":    "Complex — different with each child",
        },
    ),
    "q_living_with": Question(
        key="q_living_with",
        text="Where do you currently live in relation to your family?",
        type="mcq",
        category="Living",
        options={
            "together":     "Together — same home",
            "same_city":    "Same city",
            "diff_city":    "Different city",
            "diff_country": "Different country",
        },
    ),
    "q_meeting_freq": Question(
        key="q_meeting_freq",
        text="How often do you see your family in person?",
        type="mcq",
        category="Living",
        options={
            "weekly":   "Multiple times a week",
            "monthly":  "A few times a month",
            "few_year": "A few times a year",
            "rarely":   "Rarely",
        },
    ),
    "q_education": Question(
        key="q_education",
        text="What is your highest level of education?",
        type="mcq",
        category="Background",
        options={
            "high_school": "High school",
            "vocational":  "Vocational / trade qualification",
            "university":  "University degree",
            "postgrad":    "Postgraduate degree",
        },
    ),
    "q_work_field": Question(
        key="q_work_field",
        text="What field do you work in?",
        type="mcq",
        category="Background",
        options={
            "technology": "Technology / engineering",
            "healthcare": "Healthcare / medicine",
            "business":   "Business / finance",
            "education":  "Education / teaching",
            "trades":     "Trades / manual work",
            "arts":       "Arts / creative / media",
            "other":      "Other",
        },
    ),
}

# Branching rules: given an answer, which keys come next
CREATOR_BRANCHING_RULES = {
    # Always start here
    "__start__": ["q_children_count"],
    # Children count branches
    "q_children_count:zero":        ["q_living_with"],
    "q_children_count:one":         ["q_child1_name"],
    "q_children_count:two":         ["q_child1_name"],
    "q_children_count:three_plus":  ["q_child1_name"],
    # Child 1
    "q_child1_name:*":              ["q_child1_age"],
    "q_child1_age:*":               ["q_child1_relationship_or_child2"],  # resolved client-side
    # Child 1 (single child) → relationship → living
    "q_child1_relationship:*":      ["q_living_with"],
    # Child 2 (when count == two)
    "q_child2_name:*":              ["q_child2_age"],
    "q_child2_age:*":               ["q_children_relationship"],
    # 3+ children
    "q_other_children:*":           ["q_children_relationship"],
    "q_children_relationship:*":    ["q_living_with"],
    # Living
    "q_living_with:together":       ["q_education"],
    "q_living_with:same_city":      ["q_meeting_freq"],
    "q_living_with:diff_city":      ["q_meeting_freq"],
    "q_living_with:diff_country":   ["q_meeting_freq"],
    "q_meeting_freq:*":             ["q_education"],
    # Background
    "q_education:*":                ["q_work_field"],
    "q_work_field:*":               [],  # done
}


# ── Member question bank (ported from MemberAssessmentScreen.js) ──────────────

MEMBER_QUESTIONS = [
    Question(
        key="m_nickname",
        text="What should the clone call you?",
        type="text",
        category="Personal",
        placeholder="Enter your name or nickname",
    ),
    Question(
        key="m_bond",
        text="How would you describe your bond with {{creatorName}}?",
        type="mcq",
        category="Personal",
        options={
            "very_close": "Very close — we share a lot",
            "warm":       "Warm and loving, with our own rhythm",
            "distant":    "Close but we could connect more",
            "building":   "Still building our relationship",
        },
    ),
    Question(
        key="m_contact",
        text="How often are you currently in touch with {{creatorName}}?",
        type="mcq",
        category="Personal",
        options={
            "daily":    "Every day",
            "frequent": "A few times a week",
            "weekly":   "About once a week",
            "less":     "Less often than I'd like",
        },
    ),
    Question(
        key="m_topic",
        text="What do you most want to talk about?",
        type="mcq",
        category="Personal",
        options={
            "advice":   "Life advice and guidance",
            "checkins": "Everyday check-ins and updates",
            "memories": "Shared memories and stories",
            "anything": "Everything — just to feel connected",
        },
    ),
]


# ── Question endpoints ────────────────────────────────────────────────────────

@router.get("/questions/creator", response_model=QuestionsResponse)
def get_creator_questions(token: dict = Depends(verify_token)):
    return QuestionsResponse(
        questions=list(CREATOR_QUESTION_BANK.values()),
        branching_rules=CREATOR_BRANCHING_RULES,
    )


@router.get("/questions/member", response_model=QuestionsResponse)
def get_member_questions(token: dict = Depends(verify_token)):
    return QuestionsResponse(
        questions=MEMBER_QUESTIONS,
        branching_rules={},  # sequential, no branching
    )


# ── Creator assessment save/load ──────────────────────────────────────────────

@router.post("/creator", response_model=AssessmentAnswersResponse, status_code=200)
def save_creator_answers(
    payload: AssessmentSaveRequest,
    db: Session = Depends(get_db),
    token: dict = Depends(verify_token),
):
    user_email = token.get("email", "")
    existing = db.query(AssessmentAnswer).filter(AssessmentAnswer.user_email == user_email).first()
    if existing:
        existing.answers = json.dumps(payload.answers)
        db.commit()
    else:
        row = AssessmentAnswer(
            id=str(uuid.uuid4()),
            user_email=user_email,
            answers=json.dumps(payload.answers),
        )
        db.add(row)
        db.commit()

    # Keep clone's persona_prompt in sync if a clone already exists
    clone = db.query(Clone).filter(Clone.creator_email == user_email, Clone.is_active == True).first()
    if clone:
        clone.persona_prompt = build_creator_system_prompt(payload.answers)
        db.commit()

    return AssessmentAnswersResponse(answers=payload.answers)


@router.get("/creator", response_model=AssessmentAnswersResponse)
def get_creator_answers(
    db: Session = Depends(get_db),
    token: dict = Depends(verify_token),
):
    user_email = token.get("email", "")
    row = db.query(AssessmentAnswer).filter(AssessmentAnswer.user_email == user_email).first()
    if not row:
        raise HTTPException(status_code=404, detail="No assessment answers found")
    return AssessmentAnswersResponse(answers=json.loads(row.answers))


# ── Member assessment save/load ───────────────────────────────────────────────

@router.post("/member", response_model=AssessmentAnswersResponse, status_code=200)
def save_member_answers(
    payload: AssessmentSaveRequest,
    db: Session = Depends(get_db),
    token: dict = Depends(verify_token),
):
    user_email = token.get("email", "")

    # Look up which family this member belongs to
    membership = db.query(FamilyMember).filter(
        FamilyMember.user_email == user_email
    ).first()
    if not membership:
        raise HTTPException(status_code=404, detail="You are not in any family")

    existing = db.query(MemberAssessmentAnswer).filter(
        MemberAssessmentAnswer.user_email == user_email
    ).first()
    if existing:
        existing.answers = json.dumps(payload.answers)
        db.commit()
    else:
        row = MemberAssessmentAnswer(
            id=str(uuid.uuid4()),
            user_email=user_email,
            family_id=membership.family_id,
            answers=json.dumps(payload.answers),
        )
        db.add(row)
        db.commit()
    return AssessmentAnswersResponse(answers=payload.answers)


@router.get("/member", response_model=AssessmentAnswersResponse)
def get_member_answers(
    db: Session = Depends(get_db),
    token: dict = Depends(verify_token),
):
    user_email = token.get("email", "")
    row = db.query(MemberAssessmentAnswer).filter(
        MemberAssessmentAnswer.user_email == user_email
    ).first()
    if not row:
        raise HTTPException(status_code=404, detail="No member assessment answers found")
    return AssessmentAnswersResponse(answers=json.loads(row.answers))
