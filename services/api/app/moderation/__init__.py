"""On-device NSFW scoring engine.

CLIP (open_clip ViT-L/14) image embeddings -> LAION-AI's AutoKeras binary-NSFW
classifier -> a 0..1 safety score (1 = NSFW). Runs entirely on the operator's
hardware; no third-party moderation API and no second API key.

Heavy ML imports (torch / open_clip / tensorflow / autokeras) are deferred to
call time inside `scorer`, so importing this package (and the FastAPI app /
tests) never requires the full ML stack to be installed.
"""
