from pathlib import Path
from faster_whisper import WhisperModel

audio = Path(r"C:\Downloads\20261008_111716.m4a")
output = Path(r"C:\Pictures\CAPSTONE 2\output\kadayo-discussion-transcript.txt")
output.parent.mkdir(parents=True, exist_ok=True)

model = WhisperModel("small", device="cpu", compute_type="int8")
segments, info = model.transcribe(
    str(audio),
    beam_size=1,
    vad_filter=True,
    vad_parameters={"min_silence_duration_ms": 500},
    condition_on_previous_text=True,
)

def stamp(seconds: float) -> str:
    total = int(seconds)
    return f"{total // 60:02d}:{total % 60:02d}"

with output.open("w", encoding="utf-8") as handle:
    handle.write(f"Detected language: {info.language} ({info.language_probability:.3f})\n")
    handle.write(f"Audio duration: {info.duration:.1f} seconds\n\n")
    for segment in segments:
        text = segment.text.strip()
        if text:
            line = f"[{stamp(segment.start)}-{stamp(segment.end)}] {text}"
            print(line, flush=True)
            handle.write(line + "\n")

print(f"TRANSCRIPT_SAVED={output}", flush=True)
