"""
Multi-Municipality Water Consumption Forecasting API
Flask API server for water consumption predictions
"""

from flask import Flask, jsonify, request, send_file, send_from_directory
from flask_cors import CORS
import pickle
import pandas as pd
import numpy as np
from sklearn.preprocessing import LabelEncoder
import logging
from datetime import datetime, timedelta
import os

# Base directory for deployment (works when run from any cwd)
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# Initialize Flask app with static folder for CSS/JS
app = Flask(__name__, static_folder=os.path.join(BASE_DIR, 'static'))
CORS(app)

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Load models and encoders (paths relative to app file for Render)
try:
    with open(os.path.join(BASE_DIR, 'water_consumption_model.pkl'), 'rb') as f:
        model = pickle.load(f)
    logger.info("✓ Model loaded successfully")
except Exception as e:
    logger.error(f"✗ Error loading model: {e}")
    model = None

try:
    with open(os.path.join(BASE_DIR, 'municipality_encoder.pkl'), 'rb') as f:
        municipality_encoder = pickle.load(f)
    logger.info("✓ Municipality encoder loaded successfully")
except Exception as e:
    logger.error(f"✗ Error loading municipality encoder: {e}")
    municipality_encoder = None

try:
    with open(os.path.join(BASE_DIR, 'feature_columns.pkl'), 'rb') as f:
        feature_columns = pickle.load(f)
    logger.info("✓ Feature columns loaded successfully")
except Exception as e:
    logger.error(f"✗ Error loading feature columns: {e}")
    feature_columns = None

# Load data for reference
try:
    df = pd.read_csv(os.path.join(BASE_DIR, 'water_consumption_100000_rows_improved.csv'))
    logger.info(f"✓ Data loaded: {len(df)} rows")
except Exception as e:
    logger.error(f"✗ Error loading data: {e}")
    df = None

# ========== API ENDPOINTS ==========

@app.route('/api/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'timestamp': datetime.now().isoformat(),
        'model_loaded': model is not None,
        'data_loaded': df is not None
    }), 200

@app.route('/api/municipalities', methods=['GET'])
def get_municipalities():
    """Get list of all municipalities"""
    if df is None:
        return jsonify({'error': 'Data not loaded'}), 500
    
    municipalities = sorted(df['region_name'].unique().tolist())
    return jsonify({
        'municipalities': municipalities,
        'count': len(municipalities)
    }), 200

@app.route('/api/predict', methods=['POST'])
def predict():
    """Make water consumption prediction using trained Random Forest model"""
    if model is None:
        return jsonify({'error': 'Model not loaded'}), 500
    if municipality_encoder is None or feature_columns is None:
        return jsonify({'error': 'Model components not loaded'}), 500
    
    try:
        data = request.json
        municipality = data.get('municipality')
        temperature = float(data.get('temperature', 30))
        humidity = float(data.get('humidity', 65))
        rainfall = float(data.get('rainfall', 0))
        day_type = data.get('day_type', 'weekday')
        
        if not municipality:
            return jsonify({'error': 'Municipality required'}), 400
        
        # Get recent data for the municipality
        muni_data = df[df['region_name'] == municipality].sort_values('date').tail(30)
        
        if len(muni_data) == 0:
            return jsonify({'error': f'No data for municipality: {municipality}'}), 404
        
        # Calculate average baseline for comparison
        avg_consumption = muni_data['water_consumption_liters'].mean() / 1_000_000
        
        # Encode municipality
        try:
            municipality_code = municipality_encoder.transform([municipality])[0]
        except:
            return jsonify({'error': f'Unknown municipality: {municipality}'}), 400
        
        # Get municipality characteristics
        population = int(muni_data['population'].mean())
        industrial_index = int(muni_data['industrial_activity_index'].mean())
        prev_day_avg = muni_data['water_consumption_liters'].mean()
        
        # Create normalized versions (to match the retrained model)
        prev_day_normalized = prev_day_avg / 100_000_000
        consumption_variance = 1.0  # Neutral assumption
        
        # Get month and season
        latest_date = pd.to_datetime(muni_data['date'].iloc[-1])
        month = latest_date.month
        season_map = {'Winter': 0, 'Summer': 1, 'Monsoon': 2, 'Spring': 3}
        season_str = muni_data['season'].iloc[-1]
        season = season_map.get(season_str, 0)
        
        # Create feature vector for prediction (NEW FEATURES)
        feature_dict = {
            'temperature_celsius': temperature,
            'humidity_percent': humidity,
            'rainfall_mm': rainfall,
            'is_weekend': 1 if day_type == 'weekend' else 0,
            'is_holiday': 1 if day_type == 'holiday' else 0,
            'municipality_encoded': municipality_code,
            'population_scaled': population / 1_000_000,
            'industrial_scaled': industrial_index,
            'prev_day_consumption_normalized': prev_day_normalized,
            'prev_7day_avg_normalized': prev_day_normalized,
            'consumption_variance': consumption_variance,
            'month': month,
            'season': season
        }
        
        # Create DataFrame with correct column order
        X_pred = pd.DataFrame([feature_dict])[feature_columns]
        
        # Make prediction using trained model
        predicted_consumption_liters = model.predict(X_pred)[0]
        predicted_consumption = predicted_consumption_liters / 1_000_000
        
        # Calculate change percentage
        change_percent = ((predicted_consumption - avg_consumption) / avg_consumption) * 100 if avg_consumption > 0 else 0
        
        return jsonify({
            'municipality': municipality,
            'predicted_consumption_ml': float(round(predicted_consumption, 2)),
            'change_percent': float(round(change_percent, 2)),
            'average_consumption': float(round(avg_consumption, 2))
        }), 200
    
    except Exception as e:
        logger.error(f"Prediction error: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/statistics/<municipality>', methods=['GET'])
def get_statistics(municipality):
    """Get statistics for a specific municipality"""
    if df is None:
        return jsonify({'error': 'Data not loaded'}), 500
    
    muni_data = df[df['region_name'] == municipality]
    
    if len(muni_data) == 0:
        return jsonify({'error': f'No data for municipality: {municipality}'}), 404
    
    return jsonify({
        'municipality': municipality,
        'average_consumption': float(muni_data['water_consumption_liters'].mean() / 1_000_000),
        'min_consumption': float(muni_data['water_consumption_liters'].min() / 1_000_000),
        'max_consumption': float(muni_data['water_consumption_liters'].max() / 1_000_000),
        'std_consumption': float(muni_data['water_consumption_liters'].std() / 1_000_000),
        'total_records': len(muni_data),
        'date_range': {
            'start': str(muni_data['date'].min()),
            'end': str(muni_data['date'].max())
        }
    }), 200

@app.route('/api/compare', methods=['GET'])
def compare_municipalities():
    """Get comparison data for all municipalities using trained model"""
    if df is None:
        return jsonify({'error': 'Data not loaded'}), 500
    if model is None or municipality_encoder is None or feature_columns is None:
        return jsonify({'error': 'Model not loaded'}), 500
    
    municipalities = df['region_name'].unique()
    comparison_data = []
    
    for muni in sorted(municipalities):
        try:
            muni_data = df[df['region_name'] == muni]
            avg_consumption = muni_data['water_consumption_liters'].mean() / 1_000_000
            
            # Encode municipality
            municipality_code = municipality_encoder.transform([muni])[0]
            
            # Get municipality characteristics
            population = int(muni_data['population'].mean())
            industrial_index = int(muni_data['industrial_activity_index'].mean())
            prev_day_avg = muni_data['water_consumption_liters'].mean()
            
            # Create normalized versions
            prev_day_normalized = prev_day_avg / 100_000_000
            season_str = muni_data['season'].iloc[0]
            season_map = {'Winter': 0, 'Summer': 1, 'Monsoon': 2, 'Spring': 3}
            season = season_map.get(season_str, 0)
            
            # Create feature vector for prediction (NEW FEATURES)
            feature_dict = {
                'temperature_celsius': 32,
                'humidity_percent': 65,
                'rainfall_mm': 0,
                'is_weekend': 0,
                'is_holiday': 0,
                'municipality_encoded': municipality_code,
                'population_scaled': population / 1_000_000,
                'industrial_scaled': industrial_index,
                'prev_day_consumption_normalized': prev_day_normalized,
                'prev_7day_avg_normalized': prev_day_normalized,
                'consumption_variance': 1.0,
                'month': 1,
                'season': season
            }
            
            # Create DataFrame with correct column order
            X_pred = pd.DataFrame([feature_dict])[feature_columns]
            
            # Make prediction using trained model
            predicted_liters = model.predict(X_pred)[0]
            predicted_ml = predicted_liters / 1_000_000
            
            comparison_data.append({
                'municipality': muni,
                'predicted_ml': float(round(predicted_ml, 2)),
                'population': population,
                'avg_consumption': float(round(avg_consumption, 2))
            })
        except Exception as e:
            logger.error(f"Error predicting for {muni}: {e}")
            # Fallback to average
            muni_data = df[df['region_name'] == muni]
            avg_consumption = muni_data['water_consumption_liters'].mean() / 1_000_000
            population = int(muni_data['population'].iloc[0]) if 'population' in muni_data.columns else 100000
            
            comparison_data.append({
                'municipality': muni,
                'predicted_ml': float(round(avg_consumption, 2)),
                'population': population,
                'avg_consumption': float(round(avg_consumption, 2))
            })
    
    return jsonify({'municipalities': comparison_data}), 200

@app.route('/api/forecast', methods=['POST'])
def forecast():
    """Get 7-day forecast using trained Random Forest model"""
    if model is None:
        return jsonify({'error': 'Model not loaded'}), 500
    if municipality_encoder is None or feature_columns is None:
        return jsonify({'error': 'Model components not loaded'}), 500
    
    try:
        data = request.json
        municipality = data.get('municipality')
        weather_forecast = data.get('weather_forecast', [])
        
        if not municipality:
            return jsonify({'error': 'Municipality required'}), 400
        
        # Get recent data for the municipality
        muni_data = df[df['region_name'] == municipality].sort_values('date').tail(30)
        
        if len(muni_data) == 0:
            return jsonify({'error': f'No data for municipality: {municipality}'}), 404
        
        # Encode municipality
        try:
            municipality_code = municipality_encoder.transform([municipality])[0]
        except:
            return jsonify({'error': f'Unknown municipality: {municipality}'}), 400
        
        # Get municipality characteristics
        population = int(muni_data['population'].mean())
        industrial_index = int(muni_data['industrial_activity_index'].mean())
        prev_day_avg = muni_data['water_consumption_liters'].mean()
        prev_day_normalized = prev_day_avg / 100_000_000
        current_date = pd.to_datetime(muni_data['date'].iloc[-1])
        
        season_map = {'Winter': 0, 'Summer': 1, 'Monsoon': 2, 'Spring': 3}
        
        # Generate forecast for 7 days
        forecast_data = []
        baseline_prediction = None  # Store first prediction as baseline
        
        for i in range(7):
            date = (current_date + timedelta(days=i+1)).strftime('%Y-%m-%d')
            
            # Use weather data if available, otherwise use defaults
            if i < len(weather_forecast):
                weather = weather_forecast[i]
                temp = weather.get('temp', 30)
                humidity = weather.get('humidity', 65)
                rainfall = weather.get('rainfall', 0)
            else:
                temp = 30 + (i % 3) - 1
                humidity = 65
                rainfall = 0
            
            # Determine day type (weekday or weekend)
            forecast_date = current_date + timedelta(days=i+1)
            is_weekend = forecast_date.weekday() >= 5
            month = forecast_date.month
            season_str = muni_data['season'].iloc[-1]
            season = season_map.get(season_str, 0)
            
            # Create feature vector for prediction (NEW FEATURES)
            feature_dict = {
                'temperature_celsius': temp,
                'humidity_percent': humidity,
                'rainfall_mm': rainfall,
                'is_weekend': 1 if is_weekend else 0,
                'is_holiday': 0,
                'municipality_encoded': municipality_code,
                'population_scaled': population / 1_000_000,
                'industrial_scaled': industrial_index,
                'prev_day_consumption_normalized': prev_day_normalized,
                'prev_7day_avg_normalized': prev_day_normalized,
                'consumption_variance': 1.0,
                'month': month,
                'season': season
            }
            
            # Create DataFrame with correct column order
            X_pred = pd.DataFrame([feature_dict])[feature_columns]
            
            # Make prediction using trained model
            predicted_liters = model.predict(X_pred)[0]
            predicted_ml = predicted_liters / 1_000_000
            
            # Apply weather adjustments to show variation
            # Higher temperature increases consumption
            temp_adjustment = 1.0 + ((temp - 32) * 0.02)  # ±2% per degree from 32°C
            
            # Higher rainfall reduces consumption (people use less when it rains)
            rainfall_adjustment = max(0.85, 1.0 - (rainfall * 0.03))
            
            # Weekend tends to have slightly lower consumption
            day_adjustment = 0.95 if is_weekend else 1.0
            
            # Apply adjustments
            adjusted_prediction = predicted_ml * temp_adjustment * rainfall_adjustment * day_adjustment
            
            forecast_data.append({
                'date': date,
                'predicted_ml': float(round(adjusted_prediction, 2)),
                'temp': temp,
                'humidity': humidity,
                'rainfall': rainfall
            })
        
        return jsonify({
            'municipality': municipality,
            'forecast': forecast_data
        }), 200
    
    except Exception as e:
        logger.error(f"Forecast error: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/current-weather/<municipality>', methods=['GET'])
def get_current_weather(municipality):
    """Get current weather conditions for a municipality"""
    if df is None:
        return jsonify({'error': 'Data not loaded'}), 500
    
    try:
        muni_data = df[df['region_name'] == municipality].sort_values('date').tail(1)
        
        if len(muni_data) == 0:
            return jsonify({'error': f'No data for municipality: {municipality}'}), 404
        
        latest = muni_data.iloc[0]
        
        return jsonify({
            'municipality': municipality,
            'date': latest['date'],
            'temperature_celsius': float(latest['temperature_celsius']),
            'humidity_percent': float(latest['humidity_percent']),
            'rainfall_mm': float(latest['rainfall_mm']),
            'wind_speed_kmph': float(latest.get('wind_speed_kmph', 0)),
            'heat_index': float(latest.get('heat_index', 0))
        }), 200
    except Exception as e:
        logger.error(f"Error getting weather for {municipality}: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/model-info', methods=['GET'])
def model_info():
    """Get information about the model"""
    # Get feature importances from trained model
    feature_importance = {}
    if model is not None and feature_columns is not None:
        try:
            importances = model.feature_importances_
            feature_importance = dict(zip(feature_columns, importances))
            # Sort by importance (descending)
            feature_importance = dict(sorted(feature_importance.items(), key=lambda x: x[1], reverse=True))
        except:
            feature_importance = {}
    
    return jsonify({
        'model_type': 'Random Forest Regressor',
        'features_used': len(feature_columns) if feature_columns else 0,
        'municipalities_supported': len(df['region_name'].unique()) if df is not None else 0,
        'feature_importance': feature_importance,
        'version': '1.0',
        'last_updated': datetime.now().isoformat()
    }), 200

@app.route('/', methods=['GET'])
def index():
    """Serve main dashboard HTML (single route for root)"""
    try:
        return send_file(os.path.join(BASE_DIR, 'dashboard_with_live_ml.html'), mimetype='text/html')
    except Exception as e:
        logger.error(f"Error serving dashboard: {e}")
        return jsonify({'error': 'Dashboard not found'}), 404

@app.route('/what-if', methods=['GET'])
def what_if():
    """Serve What-If simulator page"""
    try:
        return send_file(os.path.join(BASE_DIR, 'what_if.html'), mimetype='text/html')
    except Exception as e:
        return jsonify({'error': 'What-If page not found'}), 404

@app.route('/water_distribution', methods=['GET'])
def water_distribution():
    """Serve water distribution visualization page"""
    try:
        return send_file(os.path.join(BASE_DIR, 'water_distribution.html'), mimetype='text/html')
    except Exception as e:
        return jsonify({'error': f'Could not load water distribution page: {str(e)}'}), 404

@app.route('/apwrims', methods=['GET'])
def apwrims():
    """Serve APWRIMS page"""
    try:
        return send_file(os.path.join(BASE_DIR, 'apwrims_optimized_final.html'), mimetype='text/html')
    except Exception as e:
        return jsonify({'error': f'Could not load APWRIMS page: {str(e)}'}), 404

@app.route('/dashboard_with_live_ml.html', methods=['GET'])
def serve_dashboard():
    """Serve dashboard explicitly"""
    try:
        return send_file(os.path.join(BASE_DIR, 'dashboard_with_live_ml.html'), mimetype='text/html')
    except Exception as e:
        return jsonify({'error': 'Dashboard not found'}), 404

@app.route('/water_distribution.html', methods=['GET'])
def serve_water_distribution_html():
    """Serve water distribution page explicitly"""
    try:
        return send_file(os.path.join(BASE_DIR, 'water_distribution.html'), mimetype='text/html')
    except Exception as e:
        logger.error(f"Error serving water_distribution.html: {e}")
        return jsonify({'error': 'Water distribution page not found'}), 404

@app.route('/<path:filename>')
def serve_static(filename):
    """Serve static HTML files from BASE_DIR (CSS/JS served by Flask static_folder)"""
    try:
        # Define explicit MIME types to ensure correct serving even if system registry is empty
        mime_types = {
            '.css': 'text/css',
            '.js': 'application/javascript',
            '.html': 'text/html',
            '.json': 'application/json',
            '.csv': 'text/csv',
            '.png': 'image/png',
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.svg': 'image/svg+xml'
        }
        
        allowed_extensions = tuple(mime_types.keys())
        
        if any(filename.endswith(ext) for ext in allowed_extensions):
            file_path = os.path.join(BASE_DIR, filename)
            if os.path.isfile(file_path) and os.path.abspath(file_path).startswith(BASE_DIR):
                # Use explicit map first, then fall back to system guessing
                _, ext = os.path.splitext(filename)
                mimetype = mime_types.get(ext.lower())
                
                if not mimetype:
                    import mimetypes
                    mimetype, _ = mimetypes.guess_type(file_path)
                
                return send_file(file_path, mimetype=mimetype or 'application/octet-stream')
                
        return jsonify({'error': 'File type not allowed'}), 403
    except FileNotFoundError:
        logger.error(f"File not found: {filename}")
        return jsonify({'error': f'File {filename} not found'}), 404
    except Exception as e:
        logger.error(f"Error serving file {filename}: {e}")
        return jsonify({'error': f'Error serving {filename}'}), 500

# ========== ERROR HANDLERS ==========

@app.errorhandler(404)
def not_found(error):
    return jsonify({'error': 'Endpoint not found'}), 404

@app.errorhandler(500)
def internal_error(error):
    return jsonify({'error': 'Internal server error'}), 500

# ========== MAIN ==========

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    logger.info("\n" + "="*70)
    logger.info("  WATER CONSUMPTION FORECASTING API SERVER")
    logger.info("="*70)
    logger.info(f"Starting API server on http://0.0.0.0:{port}")
    logger.info("Dashboard available at http://localhost:%s/", port)
    logger.info("="*70 + "\n")
    app.run(debug=False, host='0.0.0.0', port=port, threaded=True)
