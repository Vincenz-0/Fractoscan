from flask import Flask, request, jsonify
from flask_cors import CORS
import numpy as np
import onnxruntime as ort
from PIL import Image
import io
import os
import traceback

app = Flask(__name__)
CORS(app)

UPLOAD_FOLDER = "uploads"
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

MODEL_PATH = os.getenv("MODEL_PATH", "model.onnx")
CONF_THRESHOLD = float(os.getenv("CONF_THRESHOLD", "0.25"))
IOU_THRESHOLD = float(os.getenv("IOU_THRESHOLD", "0.45"))

print("[ML Server] Loading ONNX model...")
try:
    session = ort.InferenceSession(MODEL_PATH, providers=["CPUExecutionProvider"])
    input_name = session.get_inputs()[0].name
    input_shape = session.get_inputs()[0].shape
    model_height = int(input_shape[2]) if isinstance(input_shape[2], int) else 768
    model_width = int(input_shape[3]) if isinstance(input_shape[3], int) else 768
    print(f"[ML Server] ONNX model loaded: {MODEL_PATH} ({model_width}x{model_height})")
except Exception as e:
    session = None
    input_name = None
    model_height = 768
    model_width = 768
    print(f"[ML Server] Error loading ONNX model: {e}")


def letterbox(image_array, new_shape=(768, 768), color=(114, 114, 114)):
    """Resize and pad image to fit new_shape (H, W), keeping aspect ratio."""
    shape = image_array.shape[:2]  # (h, w)
    if shape[0] == 0 or shape[1] == 0:
        raise ValueError("Invalid image with zero width/height")

    new_h, new_w = new_shape
    r = min(new_w / shape[1], new_h / shape[0])
    resized_w = int(round(shape[1] * r))
    resized_h = int(round(shape[0] * r))

    pil_image = Image.fromarray(image_array)
    if (resized_w, resized_h) != (shape[1], shape[0]):
        pil_image = pil_image.resize((resized_w, resized_h), Image.BILINEAR)

    resized = np.array(pil_image)

    pad_w = new_w - resized_w
    pad_h = new_h - resized_h
    pad_left = pad_w // 2
    pad_right = pad_w - pad_left
    pad_top = pad_h // 2
    pad_bottom = pad_h - pad_top

    padded = np.full((new_h, new_w, 3), color, dtype=resized.dtype)
    padded[pad_top:pad_top + resized_h, pad_left:pad_left + resized_w] = resized

    return padded, r, pad_left, pad_top


def nms_boxes(boxes, scores, iou_threshold=0.45):
    """Pure numpy NMS. boxes: Nx4 (x1,y1,x2,y2), scores: N."""
    if boxes.size == 0:
        return []

    x1 = boxes[:, 0]
    y1 = boxes[:, 1]
    x2 = boxes[:, 2]
    y2 = boxes[:, 3]

    areas = (x2 - x1 + 1) * (y2 - y1 + 1)
    order = scores.argsort()[::-1]

    keep = []
    while order.size > 0:
        i = int(order[0])
        keep.append(i)
        if order.size == 1:
            break

        xx1 = np.maximum(x1[i], x1[order[1:]])
        yy1 = np.maximum(y1[i], y1[order[1:]])
        xx2 = np.minimum(x2[i], x2[order[1:]])
        yy2 = np.minimum(y2[i], y2[order[1:]])

        w = np.maximum(0.0, xx2 - xx1 + 1)
        h = np.maximum(0.0, yy2 - yy1 + 1)
        inter = w * h

        iou = inter / (areas[i] + areas[order[1:]] - inter + 1e-9)
        remaining = np.where(iou <= iou_threshold)[0]
        order = order[remaining + 1]

    return keep


@app.route("/", methods=["GET"])
def home():
    return jsonify({"status": "FractoScan ML API is running"})


@app.route("/predict", methods=["POST"])
def predict():
    """Predict fractures in X-ray image"""
    try:
        if session is None or input_name is None:
            return jsonify({"error": "ML model not loaded"}), 500

        if "image" not in request.files and "file" not in request.files:
            return jsonify({"error": "No image uploaded"}), 400

        image = request.files.get("image") or request.files.get("file")
        
        if not image or image.filename == "":
            return jsonify({"error": "No image selected"}), 400

        file_bytes = image.read()
        if not file_bytes:
            return jsonify({"error": "Empty image"}), 400

        pil_image = Image.open(io.BytesIO(file_bytes))
        original_width, original_height = pil_image.size

        max_dim = int(os.getenv("MAX_IMAGE_DIM", "3072"))
        downscale = 1.0
        if max_dim > 0 and max(original_width, original_height) > max_dim:
            downscale = max_dim / float(max(original_width, original_height))
            new_w = max(1, int(round(original_width * downscale)))
            new_h = max(1, int(round(original_height * downscale)))
            pil_image = pil_image.resize((new_w, new_h), Image.BILINEAR)

        pil_image = pil_image.convert("RGB")
        processed_array = np.array(pil_image)

        padded, ratio, pad_left, pad_top = letterbox(
            processed_array, new_shape=(model_height, model_width)
        )

        input_tensor = padded.astype(np.float32) / 255.0
        input_tensor = np.transpose(input_tensor, (2, 0, 1))  # HWC -> CHW
        input_tensor = np.expand_dims(input_tensor, axis=0)  # 1CHW

        outputs = session.run(None, {input_name: input_tensor})
        if not outputs:
            return jsonify({"error": "No output from model"}), 500

        pred = outputs[0]
        if pred.ndim == 3:
            pred = pred[0]
        if pred.ndim != 2:
            return jsonify({"error": "Unexpected model output shape"}), 500

        if pred.shape[0] == 5 and pred.shape[1] != 5:
            pred = pred.T
        elif pred.shape[1] != 5:
            return jsonify({"error": "Unexpected model output format"}), 500

        boxes_xywh = pred[:, :4]
        scores = pred[:, 4]

        mask = scores >= CONF_THRESHOLD
        boxes_xywh = boxes_xywh[mask]
        scores = scores[mask]

        detections = []
        has_fracture = False
        max_confidence = 0

        if scores.size > 0:
            cx = boxes_xywh[:, 0]
            cy = boxes_xywh[:, 1]
            w = boxes_xywh[:, 2]
            h = boxes_xywh[:, 3]

            x1 = cx - w / 2
            y1 = cy - h / 2
            x2 = cx + w / 2
            y2 = cy + h / 2

            boxes = np.stack([x1, y1, x2, y2], axis=1)
            keep = nms_boxes(boxes, scores, iou_threshold=IOU_THRESHOLD)

            for idx in keep:
                confidence = float(scores[idx])
                max_confidence = max(max_confidence, confidence)
                has_fracture = True

                bx1, by1, bx2, by2 = boxes[idx]
                bx1 = (bx1 - pad_left) / ratio
                by1 = (by1 - pad_top) / ratio
                bx2 = (bx2 - pad_left) / ratio
                by2 = (by2 - pad_top) / ratio

                if downscale and downscale != 1.0:
                    bx1 = bx1 / downscale
                    by1 = by1 / downscale
                    bx2 = bx2 / downscale
                    by2 = by2 / downscale

                bx1 = float(max(0.0, min(bx1, original_width)))
                by1 = float(max(0.0, min(by1, original_height)))
                bx2 = float(max(0.0, min(bx2, original_width)))
                by2 = float(max(0.0, min(by2, original_height)))

                detections.append({
                    "x1": bx1,
                    "y1": by1,
                    "x2": bx2,
                    "y2": by2,
                    "confidence": confidence,
                    "class": "Fracture"
                })

        # Determine prediction label and confidence
        if has_fracture:
            prediction_label = "Fracture Detected"
            confidence_score = max_confidence
        else:
            prediction_label = "No Fracture"
            confidence_score = 1.0 - max_confidence if max_confidence > 0 else 0.95

        response_data = {
            "prediction": prediction_label,
            "confidence": float(confidence_score),
            "detections": detections,
            "has_fracture": bool(has_fracture)
        }
        
        return jsonify(response_data)

    except Exception as e:
        print(f"[ML] Error in predict: {str(e)}")
        print(f"[ML] Traceback: {traceback.format_exc()}")
        return jsonify({"error": str(e)}), 500


if __name__ == "__main__":
    port = int(os.getenv("PORT", "5000"))
    host = os.getenv("HOST", "0.0.0.0")
    debug = os.getenv("FLASK_DEBUG", "0") == "1"
    print(f"[ML Server] Starting on http://{host}:{port}")
    app.run(host=host, port=port, debug=debug)
