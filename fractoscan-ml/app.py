from flask import Flask, request, jsonify
from flask_cors import CORS
from ultralytics import YOLO
import os
import traceback

app = Flask(__name__)
CORS(app)

UPLOAD_FOLDER = "uploads"
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

# Load YOLO model once
print("[ML Server] Loading YOLO model...")
try:
    model = YOLO("best(1).pt")
    print("[ML Server] Model loaded successfully")
except Exception as e:
    print(f"[ML Server] Error loading model: {e}")


@app.route("/", methods=["GET"])
def home():
    return jsonify({"status": "FractoScan ML API is running"})


@app.route("/predict", methods=["POST"])
def predict():
    """Predict fractures in X-ray image"""
    try:
        print("[ML] Received prediction request")
        
        if "image" not in request.files and "file" not in request.files:
            print("[ML] No file in request")
            return jsonify({"error": "No image uploaded"}), 400

        image = request.files.get("image") or request.files.get("file")
        
        if not image or image.filename == "":
            print("[ML] Invalid image")
            return jsonify({"error": "No image selected"}), 400

        print(f"[ML] Processing image: {image.filename}")
        img_path = os.path.join(UPLOAD_FOLDER, image.filename)
        image.save(img_path)

        # Run YOLO prediction
        print("[ML] Running YOLO prediction...")
        results = model(img_path)
        print(f"[ML] Prediction complete, got {len(results)} result(s)")

        detections = []
        has_fracture = False
        max_confidence = 0

        for r in results:
            print(f"[ML] Processing result with {len(r.boxes)} boxes")
            for box in r.boxes:
                confidence = float(box.conf[0])
                max_confidence = max(max_confidence, confidence)
                has_fracture = True
                
                detections.append({
                    "x1": float(box.xyxy[0][0]),
                    "y1": float(box.xyxy[0][1]),
                    "x2": float(box.xyxy[0][2]),
                    "y2": float(box.xyxy[0][3]),
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
        
        print(f"[ML] Sending response: {response_data}")
        return jsonify(response_data)

    except Exception as e:
        print(f"[ML] Error in predict: {str(e)}")
        print(f"[ML] Traceback: {traceback.format_exc()}")
        return jsonify({"error": str(e)}), 500


if __name__ == "__main__":
    print("[ML Server] Starting on http://127.0.0.1:5000")
    app.run(host="127.0.0.1", port=5000, debug=True)
