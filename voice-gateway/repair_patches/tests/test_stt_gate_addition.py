"""Proves the STT content-hallucination rejection: stock silence phrases and CJK are
rejected; real short Hebrew/English commands pass. Run with pytest."""
import importlib.util, pathlib
_spec = importlib.util.spec_from_file_location("stt_gate_addition",
    pathlib.Path(__file__).resolve().parents[1] / "stt_gate_addition.py")
g = importlib.util.module_from_spec(_spec); _spec.loader.exec_module(g)


def test_stock_hallucinations_rejected():
    for phrase in ["תודה רבה", "Hello, how are you", "I don't know",
                   "おはようございます", "Thank you"]:
        assert g.reject_content_hallucination(phrase) is not None, phrase


def test_real_commands_pass():
    for phrase in ["עצור", "כן", "לא", "בדוק רשת", "מה השעה עכשיו",
                   "ספר לי על הזהות המוזיקלית שלי", "stop", "check the network"]:
        assert g.reject_content_hallucination(phrase) is None, phrase


def test_cjk_foreign_script_rejected_when_hebrew_expected():
    assert g.reject_content_hallucination("視聴ありがとう") is not None


def test_empty_fails_open():
    assert g.reject_content_hallucination("") is None
    assert g.reject_content_hallucination("   ") is None
