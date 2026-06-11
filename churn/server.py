import os
import json
import math
import csv
from http.server import BaseHTTPRequestHandler, HTTPServer
import urllib.parse

PORT = 8000
MODEL_ASSETS_PATH = "model_assets.json"

# Load model assets on startup
model_assets = {}
if os.path.exists(MODEL_ASSETS_PATH):
    try:
        with open(MODEL_ASSETS_PATH, 'r') as f:
            model_assets = json.load(f)
        print("Model assets loaded successfully from model_assets.json!")
    except Exception as e:
        print(f"Error loading model_assets.json: {e}")
else:
    print("WARNING: model_assets.json not found! Please run 'python train.py' first.")

def calculate_probability(features_input):
    """
    Calculates the logistic regression probability.
    features_input should be a dictionary matching the feature names exactly:
    Age, Gender, Tenure, Usage Frequency, Support Calls, Payment Delay,
    Subscription Type, Contract Length, Total Spend, Last Interaction
    """
    if not model_assets:
        return 0.5, "Model not loaded"
        
    feature_names = model_assets["features"]
    coefficients = model_assets["coefficients"]
    intercept = model_assets["intercept"]
    mappings = model_assets["categorical_mappings"]
    
    # Map input values
    mapped_features = []
    for name in feature_names:
        val = features_input.get(name)
        
        # Check mapping for categorical fields
        if name in mappings:
            # Map string to int or default to 0 if not found
            mapping = mappings[name]
            # Convert string to lowercase for flexible matching
            val_str = str(val).strip()
            # Try exact match first, then case-insensitive
            val_mapped = mapping.get(val_str)
            if val_mapped is None:
                # Find matching key ignoring case
                found = False
                for k, v in mapping.items():
                    if k.lower() == val_str.lower():
                        val_mapped = v
                        found = True
                        break
                if not found:
                    val_mapped = 0 # default fallback
            val = val_mapped
        else:
            # Numeric fields
            try:
                val = float(val) if val is not None else 0.0
            except ValueError:
                val = 0.0
                
        mapped_features.append(val)
        
    # Dot product: intercept + sum(coef_i * x_i)
    z = intercept
    for coef, x in zip(coefficients, mapped_features):
        z += coef * x
        
    # Sigmoid function
    try:
        probability = 1.0 / (1.0 + math.exp(-z))
    except OverflowError:
        probability = 0.0 if z < 0 else 1.0
        
    prediction = 1 if probability >= 0.5 else 0
    return probability, prediction

class ChurnPredictorHandler(BaseHTTPRequestHandler):
    
    def log_message(self, format, *args):
        # Override to suppress default console spam if needed, or print cleanly
        print(f"[HTTP Server] {self.address_string()} - - {format%args}")

    def send_json(self, data, status_code=200):
        self.send_response(status_code)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()
        self.wfile.write(json.dumps(data).encode('utf-8'))

    def send_cors_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_cors_headers()
        self.end_headers()

    def do_GET(self):
        # Parse query parameters if any
        parsed_url = urllib.parse.urlparse(self.path)
        path = parsed_url.path
        
        # 1. API: Dashboard statistics
        if path == '/api/dashboard-stats':
            if model_assets:
                self.send_json(model_assets)
            else:
                self.send_json({"error": "Model assets not loaded"}, 500)
            return
            
        # 2. API: Download CSV Template
        elif path == '/customer_churn_template.csv':
            self.send_response(200)
            self.send_header('Content-Type', 'text/csv')
            self.send_header('Content-Disposition', 'attachment; filename="customer_churn_template.csv"')
            self.send_cors_headers()
            self.end_headers()
            
            # Write standard template header & sample row
            csv_content = (
                "Age,Gender,Tenure,Usage Frequency,Support Calls,Payment Delay,Subscription Type,Contract Length,Total Spend,Last Interaction\n"
                "35,Female,12,15,2,5,Standard,Monthly,450,14\n"
                "48,Male,24,8,7,15,Premium,Quarterly,680,3\n"
                "22,Female,3,25,9,20,Basic,Monthly,150,28\n"
            )
            self.wfile.write(csv_content.encode('utf-8'))
            return
            
        # 3. Static Files Serving
        else:
            # Default to index.html
            filename = path.lstrip('/')
            if filename == '' or filename == 'index.html':
                filename = 'index.html'
                
            filepath = os.path.join("public", filename)
            
            # Simple directory traversal prevention
            normalized_path = os.path.normpath(filepath)
            if not normalized_path.startswith("public"):
                self.send_response(403)
                self.end_headers()
                self.wfile.write(b"Forbidden")
                return
                
            if os.path.exists(filepath) and os.path.isfile(filepath):
                # Determine Content-Type
                if filepath.endswith('.html'):
                    content_type = 'text/html'
                elif filepath.endswith('.css'):
                    content_type = 'text/css'
                elif filepath.endswith('.js'):
                    content_type = 'application/javascript'
                elif filepath.endswith('.png'):
                    content_type = 'image/png'
                elif filepath.endswith('.jpg') or filepath.endswith('.jpeg'):
                    content_type = 'image/jpeg'
                elif filepath.endswith('.json'):
                    content_type = 'application/json'
                else:
                    content_type = 'text/plain'
                    
                try:
                    with open(filepath, 'rb') as f:
                        content = f.read()
                    self.send_response(200)
                    self.send_header('Content-Type', content_type)
                    self.send_cors_headers()
                    self.end_headers()
                    self.wfile.write(content)
                except Exception as e:
                    self.send_response(500)
                    self.end_headers()
                    self.wfile.write(f"Internal server error: {e}".encode('utf-8'))
            else:
                self.send_response(404)
                self.end_headers()
                self.wfile.write(b"Not Found")

    def do_POST(self):
        parsed_url = urllib.parse.urlparse(self.path)
        path = parsed_url.path
        
        # Read request body
        content_length = int(self.headers.get('Content-Length', 0))
        post_data = self.rfile.read(content_length).decode('utf-8')
        
        # 1. API: Single prediction
        if path == '/api/predict':
            try:
                data = json.loads(post_data)
                probability, prediction = calculate_probability(data)
                self.send_json({
                    "probability": probability,
                    "prediction": prediction,
                    "risk_level": "High" if probability >= 0.7 else ("Medium" if probability >= 0.4 else "Low")
                })
            except Exception as e:
                self.send_json({"error": f"Invalid request format: {e}"}, 400)
                
        # 2. API: Batch prediction
        elif path == '/api/predict-batch':
            try:
                # We support JSON payload: {"customers": [ {...}, {...} ]}
                data = json.loads(post_data)
                customers = data.get("customers", [])
                
                results = []
                for index, customer in enumerate(customers):
                    prob, pred = calculate_probability(customer)
                    results.append({
                        "index": index + 1,
                        "customer_id": customer.get("CustomerID", f"CUST-{index+1:04d}"),
                        "probability": prob,
                        "prediction": pred,
                        "risk_level": "High" if prob >= 0.7 else ("Medium" if prob >= 0.4 else "Low")
                    })
                    
                self.send_json({
                    "count": len(results),
                    "results": results
                })
            except json.JSONDecodeError:
                # If not JSON, check if it's CSV text
                try:
                    lines = post_data.strip().split('\n')
                    reader = csv.DictReader(lines)
                    results = []
                    
                    for index, row in enumerate(reader):
                        prob, pred = calculate_probability(row)
                        results.append({
                            "index": index + 1,
                            "customer_id": row.get("CustomerID", f"CUST-{index+1:04d}"),
                            "probability": prob,
                            "prediction": pred,
                            "risk_level": "High" if prob >= 0.7 else ("Medium" if prob >= 0.4 else "Low")
                        })
                        
                    self.send_json({
                        "count": len(results),
                        "results": results
                    })
                except Exception as e:
                    self.send_json({"error": f"Failed to parse CSV: {e}"}, 400)
            except Exception as e:
                self.send_json({"error": f"Internal error during batch prediction: {e}"}, 500)
        else:
            self.send_response(404)
            self.end_headers()

def run_server():
    # Make sure 'public' directory exists
    if not os.path.exists('public'):
        os.makedirs('public')
        
    server_address = ('', PORT)
    httpd = HTTPServer(server_address, ChurnPredictorHandler)
    print(f"\n=============================================")
    print(f"Customer Churn Prediction Server is running!")
    print(f"Open: http://localhost:{PORT}")
    print(f"=============================================\n")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nStopping server...")
        httpd.server_close()

if __name__ == '__main__':
    run_server()
