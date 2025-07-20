from fastapi import FastAPI
from pydantic import BaseModel
from transformers import AutoTokenizer, AutoModelForCausalLM
from peft import PeftModel
import torch

app = FastAPI()

BASE_MODEL = "TinyLlama/TinyLlama-1.1B-Chat-v1.0"
ADAPTER_PATH = "lora-tinyllama-stem-10k"

tokenizer = AutoTokenizer.from_pretrained(BASE_MODEL)
model = AutoModelForCausalLM.from_pretrained(BASE_MODEL, device_map="auto")
model = PeftModel.from_pretrained(model, ADAPTER_PATH)
model.eval()

# ---- Request/Response Schema ----
class QueryRequest(BaseModel):
    query: str
    level: str = "college"      # e.g., "Class 10", "Class 12", "college"
    affiliation: str = "student"  # Optional: role/field/stream
    mode: str = "default"       # "table", "stepwise", etc.

def get_user_prompt_prefix(level, affiliation):
    if level.lower() in ["class 10", "class 12", "school"]:
        intro = "You are an approachable tutor. Answer in very simple, beginner-friendly language for a high school student."
    elif level.lower() == "college":
        intro = "You are a helpful tutor. Give a clear, detailed answer suitable for a college student."
    else:
        intro = f"You are a helpful tutor. Adapt your answer for a {level} student."

    if "teacher" in affiliation.lower():
        intro += " Your answer can include additional depth and optional teaching tips."
    elif "student" in affiliation.lower():
        intro += " Use simple analogies and avoid jargon if possible."

    special_patch = (
        " If the question is about Java, do NOT mention destructors—Java does not have destructors like C++/Python. "
        "Focus on OOP concepts relevant to Java: class, object, inheritance, encapsulation, polymorphism, abstraction, interface."
    )
    return intro + special_patch

def detect_answer_type(query, mode):
    # Table: compare/difference queries
    table_keywords = ["difference", "differences", "compare", "comparison", "versus", "vs.", "table"]
    # Code: code/algorithm/program queries
    code_keywords = [
        "python code", "code in", "program", "write a program", "algorithm", "source code",
        "write code", "function to", "script", "snippet", "java code", "c++ code", "javascript code"
    ]

    q = query.lower()
    if mode == "table" or any(w in q for w in table_keywords):
        return "table"
    if any(w in q for w in code_keywords):
        return "code"
    return "text"

def llm_structured_response(query, level="college", mode="default", affiliation="student", max_new_tokens=400):
    # Detect answer type
    answer_type = detect_answer_type(query, mode)
    student_line = get_user_prompt_prefix(level, affiliation) + "\n"

    if answer_type == "table":
        prompt = (
            f"{student_line}"
            f"Question: {query}\n"
            "First, give a concise 2-3 sentence summary.\n"
            "Then, provide a Markdown table comparing the most important features, differences, or pros/cons. "
            "The table must be clear, at least 4 rows, and with good headings.\n"
            "Below the table, add 2-3 key bullet points highlighting main insights or practical implications.\n"
            "End with a study tip and 'End of answer.'\n"
            "\n"
            "Example table format:\n"
            "| Feature           | IPv4                   | IPv6                      |\n"
            "|-------------------|------------------------|---------------------------|\n"
            "| Address Length    | 32 bits                | 128 bits                  |\n"
            "| Address Format    | Dotted decimal         | Hexadecimal               |\n"
            "| Address Space     | ~4.3 billion           | ~3.4 x 10^38              |\n"
            "| Security          | Optional (IPSec)       | Built-in (IPSec required) |\n"
            "\n"
            "- IPv6 offers a vastly larger address space and improved security.\n"
            "- Transitioning from IPv4 to IPv6 is a global effort.\n"
            "- IPv6 uses a different address notation, which is more complex but future-proof.\n"
            "Tip: Review this table for quick revision before exams.\n"
            "End of answer."
        )
    elif answer_type == "code":
        prompt = (
            f"{student_line}"
            f"Question: {query}\n"
            "Provide a step-by-step explanation first (2-3 sentences max if needed). Then output only a clean code block (in correct language, use triple backticks markdown, e.g. ```python ...```). "
            "If there's input/output, show a sample. Do not output extra explanation after the code. Always end the code block with 'End of answer.' on a new line."
        )
    elif mode == "stepwise":
        prompt = (
            f"{student_line}"
            f"Question: {query}\n"
            "Format your answer as:\n"
            "Title: ...\n"
            "Summary: ...\n"
            "Steps:\n1. ...\n2. ...\n3. ...\n"
            "End with a key takeaway and 'End of answer.'"
        )
    else:
        prompt = (
            f"{student_line}"
            f"Question: {query}\n"
            "Give a concise summary, key points or steps, and end with 'End of answer.'"
        )
    formatted = f"{prompt}\n\n### Answer:"
    inputs = tokenizer(formatted, return_tensors="pt").to(model.device)
    with torch.no_grad():
        outputs = model.generate(
            **inputs,
            max_new_tokens=max_new_tokens,
            do_sample=False,
            temperature=0.0,
            repetition_penalty=1.1,
            eos_token_id=tokenizer.eos_token_id,
            pad_token_id=tokenizer.eos_token_id
        )
    response = tokenizer.decode(outputs[0], skip_special_tokens=True)
    answer = response.split("### Answer:")[-1].strip() if "### Answer:" in response else response.strip()
    if "End of answer." in answer:
        answer = answer.split("End of answer.")[0].strip() + "\nEnd of answer."
    return answer, answer_type

@app.post("/explain")
async def explain(req: QueryRequest):
    answer, answer_type = llm_structured_response(
        req.query,
        req.level,
        req.mode,
        req.affiliation
    )
    return {
        "query": req.query,
        "level": req.level,
        "affiliation": req.affiliation,
        "mode": req.mode,
        "answer": answer,
        "answer_type": answer_type  # "table", "code", or "text"
    }

@app.get("/")
def read_root():
    return {"status": "LLM API running"}
