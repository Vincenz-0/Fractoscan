# FractoScan ML Integration Setup Guide

## System Architecture

```
Frontend (React)
    ↓ (POST /api/predict)
Backend (Node.js/Express) - Port 5001
    ↓ (forwards to)
ML Server (Flask/YOLO) - Port 5000
    ↓ (processes)
best(1).pt (YOLO Model)
```

## Setup Instructions

### 1. Install ML Server Dependencies

```bash
cd fractoscan-ml
pip install -r requirements.txt
```

**Required packages:**
- flask
- flask-cors
- ultralytics (YOLO)
- opencv-python
- pillow

### 2. Install Backend Dependencies

```bash
cd fractoscan-backend
npm install
```

**New dependencies added:**
- axios (HTTP client)
- form-data (FormData builder)
- multer (File upload handling)

### 3. Start the ML Server

```bash
cd fractoscan-ml
python app.py
```

The ML server defaults to port `5000` (configurable via `PORT`) and binds to all interfaces (`HOST=0.0.0.0`).

### 4. Start the Backend Server

In a new terminal:

```bash
cd fractoscan-backend
npm start
```

The backend defaults to port `5001` (configurable via `PORT`) and binds to all interfaces (`HOST=0.0.0.0`).

### 5. Start the Frontend

In a new terminal:

```bash
npm run dev
```

## API Endpoints

### ML Server (Port 5000)

**POST /predict**
- Accepts: multipart/form-data with `file` field
- Returns:
  ```json
  {
    "prediction": "Fracture Detected" or "No Fracture",
    "confidence": 0.95,
    "has_fracture": true,
    "detections": [
      {
        "x1": 123,
        "y1": 456,
        "x2": 789,
        "y2": 1011,
        "confidence": 0.95,
        "class": "Fracture"
      }
    ]
  }
  ```

### Backend Server (Port 5001)

**POST /api/predict**
- Accepts: multipart/form-data with `file` field
- Forwards to ML server and returns the response
- Error handling for connection failures

## Frontend Integration

The `XrayUpload` component now:
1. Sends X-ray images to `${VITE_API_ORIGIN}/api/predict` (defaults to `http://127.0.0.1:5001`)
2. Receives prediction results with confidence scores
3. Displays results using the enhanced `ResultCard` component
4. Shows confidence visualizations with progress bars

## Testing the Integration

1. Open the app in browser (http://localhost:5173 or configured port)
2. Navigate to Dashboard
3. Upload an X-ray image
4. Wait for analysis (typically 1-5 seconds depending on image size)
5. View the prediction result with confidence score

## Environment Variables

**Frontend (.env)**
- `VITE_API_ORIGIN` (backend origin; defaults to `http://127.0.0.1:5001`)

**Backend (`fractoscan-backend/.env`)**
- `MONGO_URI`: MongoDB connection string
- `JWT_SECRET`: JWT signing secret
- `ML_PREDICT_URL`: full ML `/predict` URL (defaults to `http://127.0.0.1:5000/predict`)

**ML Server (`fractoscan-ml/.env`, optional)**
- `PORT` (default `5000`)
- `HOST` (default `0.0.0.0`)

## Troubleshooting

### Port Already in Use
- ML Server port 5000: `lsof -i :5000` then kill the process
- Backend port 5001: `lsof -i :5001` then kill the process

### Module Not Found Errors
- Make sure you ran `npm install` in the backend directory
- Make sure you ran `pip install -r requirements.txt` in the ML directory

### Connection Refused
- Check that ML server is running on port 5000
- Check that backend is running on port 5001
- Verify firewall settings

### Model Not Loading
- Ensure `best(1).pt` file exists in `fractoscan-ml/` directory
- Check file permissions
- Verify model format is compatible with ultralytics YOLO

## Performance Considerations

- First prediction takes longer (model initialization)
- Subsequent predictions are faster (cached model)
- Image preprocessing happens on the ML server
- Large images (>10MB) may timeout - consider resizing

## Next Steps

1. Connect to MongoDB for storing predictions
2. Add user authentication/authorization
3. Implement prediction history
4. Add export functionality (PDF reports)
5. Enhance UI with detection visualization (bounding boxes)
