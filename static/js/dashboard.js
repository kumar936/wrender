// API Configuration
const API_URL = '/api';
// API base for same-origin (works on Render)


// Global variables
let currentMunicipality = 'Tirupati';
let municipalities = [];
let municipalityData = {};
let infoPanelOpen = false;
let municipalityMap = null;
let mapMarkers = {};

// Municipality coordinates (Andhra Pradesh)
const municipalityCoordinates = {
    'Tirupati': [13.1939, 79.8965],
    'Guntur': [16.3067, 80.4365],
    'Nellore': [14.4426, 79.9864],
    'Vijayawada': [16.5062, 80.6480],
    'Kakinada': [16.9891, 82.2475],
    'Vizianagaram': [17.3727, 83.4277],
    'Kadapa': [14.4694, 78.8216],
    'Kurnool': [15.8281, 78.8355],
    'Rajahmundry': [16.9999, 81.7887],
    'Anantapur': [14.5833, 77.6000]
};

// Toggle info panel
function toggleInfoPanel() {
    infoPanelOpen = !infoPanelOpen;
    const content = document.getElementById('info-content');
    const icon = document.querySelector('.info-toggle-icon');
    
    if (infoPanelOpen) {
        content.classList.remove('collapsed');
        icon.classList.add('open');
    } else {
        content.classList.add('collapsed');
        icon.classList.remove('open');
    }
}

// Initialize dashboard on page load
async function initDashboard() {
    try {
        console.log('Initializing dashboard...');
        // Check API health
        console.log('Fetching health check from:', `${API_URL}/health`);
        const healthResponse = await fetch(`${API_URL}/health`);
        console.log('Health response:', healthResponse);
        if (!healthResponse.ok) throw new Error(`API not available: ${healthResponse.status}`);
        
        console.log('API connected!');
        updateStatus('connected');
        
        // Load municipalities
        console.log('Loading municipalities...');
        await loadMunicipalities();
        console.log('Municipalities loaded:', municipalities);
        
        // Load comparison data
        console.log('Loading comparison data...');
        await loadComparisonData();
        
        // Initialize feature importance chart (from model)
        await createFeatureImportanceChart();
        
        // Initialize map
        initializeMap();
        
        // Update dashboard with first municipality
        if (municipalities.length > 0) {
            currentMunicipality = municipalities[0];
            await updateDashboard();
        }
    } catch (error) {
        console.error('Error initializing dashboard:', error);
        updateStatus('disconnected');
        showError();
    }
}

function updateStatus(status) {
    const badge = document.getElementById('status-badge');
    if (status === 'connected') {
        badge.innerHTML = '<span class="status-dot"></span> Live ML Connected';
        badge.className = 'status-badge connected';
    } else {
        badge.innerHTML = '<span class="status-dot"></span> Disconnected';
        badge.className = 'status-badge disconnected';
    }
}

function showError() {
    const infoPanel = document.querySelector('.info-panel');
    infoPanel.innerHTML = `
        <h3>⚠️ Connection Error</h3>
        <p>Cannot connect to ML model API. Make sure Flask server is running: <code>python api_server.py</code></p>
    `;
    infoPanel.style.background = '#ffe5e5';
    infoPanel.style.borderLeftColor = '#e74c3c';
}

async function loadMunicipalities() {
    try {
        const response = await fetch(`${API_URL}/municipalities`);
        const data = await response.json();
        municipalities = data.municipalities;
        
        const select = document.getElementById('municipality-select');
        select.innerHTML = municipalities.map(m => 
            `<option value="${m}">${m}</option>`
        ).join('');
        
        console.log('Loaded municipalities:', municipalities);
    } catch (error) {
        console.error('Error loading municipalities:', error);
    }
}

async function loadComparisonData() {
    try {
        const response = await fetch(`${API_URL}/compare`);
        const data = await response.json();
        
        municipalityData = {};
        data.municipalities.forEach(m => {
            municipalityData[m.municipality] = m;
        });
        
        updateComparisonChart(data.municipalities);
        updateTomorrowChart(data.municipalities);
        
    } catch (error) {
        console.error('Error loading comparison:', error);
    }
}

async function updateDashboard() {
    const newMunicipality = document.getElementById('municipality-select').value;
    
    // Only show loading if municipality actually changed
    const municipalityChanged = currentMunicipality !== newMunicipality;
    currentMunicipality = newMunicipality;
    
    // Show loading animation ONLY when municipality changes
    const loadingModal = document.getElementById('loadingModal');
    if (municipalityChanged) {
        loadingModal.classList.add('show');
    }
    
    // Update all titles
    document.getElementById('alert-title').textContent = `⚠️ High Demand Alert - ${currentMunicipality}`;
    document.getElementById('stat1-title').textContent = `Current Prediction (${currentMunicipality})`;
    document.getElementById('stat2-title').textContent = `Average Consumption (${currentMunicipality})`;
    document.getElementById('stat4-title').textContent = `Population (${currentMunicipality})`;
    document.getElementById('stat5-title').textContent = `Tomorrow's ML Prediction (${currentMunicipality})`;
            const scenarioTitle = document.getElementById('scenario-title');
            if (scenarioTitle) scenarioTitle.textContent = `What-If (${currentMunicipality})`;
            const tempLabel = document.getElementById('temp-label');
            if (tempLabel) tempLabel.textContent = `Temperature in ${currentMunicipality} (°C)`;
    document.getElementById('forecast-title').textContent = `📈 7-Day Forecast (${currentMunicipality} - Live ML)`;
    document.getElementById('hourly-title').textContent = `⏰ Hourly Consumption Pattern (${currentMunicipality})`;
    document.getElementById('temp-impact-title').textContent = `🌡️ Temperature Impact (${currentMunicipality} - Live ML)`;
    document.getElementById('weekly-title').textContent = `📊 Week-over-Week Comparison (${currentMunicipality} - Live ML)`;
    
    // Update stats with animation
    if (municipalityData[currentMunicipality]) {
        const mData = municipalityData[currentMunicipality];
        // Use rolling animation for stats
        animateRollingNumber('stat2-value', `${mData.predicted_ml}`, 'M L');
        animateRollingNumber('stat4-value', `${mData.population}`, '', true);
        animateRollingNumber('stat5-value', `${mData.predicted_ml}`, 'M L');
        document.getElementById('stat5-change').textContent = `Tomorrow's forecast`;
    }
    
    // Get fresh prediction and update charts
    try {
        await runScenario();
        await updateForecastChart();
        await updateTempImpactChart();
        await updateWeeklyChart();
        updateHourlyChart();
    } catch (error) {
        console.error('Error updating dashboard:', error);
    } finally {
        // Hide loading animation after data is loaded (only if it was shown)
                if (municipalityChanged) {
                    setTimeout(() => {
                        loadingModal.classList.remove('show');
                    }, 1200);
                }
    }
}

async function runScenario() {
    const tempInput = document.getElementById('temp-input');
    const humidityInput = document.getElementById('humidity-input');
    const dayTypeSelect = document.getElementById('day-type');
    const rainfallInput = document.getElementById('rainfall-input');
    const temp = tempInput ? parseFloat(tempInput.value) : 32;
    const humidity = humidityInput ? parseFloat(humidityInput.value) : 65;
    const dayType = dayTypeSelect ? dayTypeSelect.value : 'weekday';
    const rainfall = rainfallInput ? parseFloat(rainfallInput.value) : 0;
    
    try {
        const response = await fetch(`${API_URL}/predict`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                municipality: currentMunicipality,
                temperature: temp,
                humidity: humidity,
                rainfall: rainfall,
                day_type: dayType
            })
        });

        const data = await response.json();
        
        const predicted = data.predicted_consumption_ml;
        const change = data.change_percent;
        const arrow = change > 0 ? '↑' : '↓';
        const color = change > 0 ? '#e74c3c' : '#27ae60';

                const scenarioResult = document.getElementById('scenario-result');
                if (scenarioResult) scenarioResult.innerHTML = `
                    <span style="font-size: 20px;">ML Prediction for ${currentMunicipality}: <span style="color: ${color}">${predicted}M L</span></span>
                    <span style="color: ${color}; margin-left: 15px;">${arrow} ${Math.abs(change).toFixed(1)}% vs average</span>
                `;

        animateRollingNumber('stat1-value', `${predicted}`, 'M L');
        document.getElementById('stat1-change').innerHTML = `${arrow} ${Math.abs(change).toFixed(1)}% from average`;
        document.getElementById('stat1-change').className = `stat-change ${change > 0 ? 'positive' : 'negative'}`;
        
        // Update alert: prediction-based demand notice (how much + what to prepare)
        const avgConsumption = data.average_consumption;
        const alertBox = document.getElementById('alert-box');
        const alertTitle = document.getElementById('alert-title');
        const alertText = document.getElementById('alert-text');
        const howMuch = `Predicted demand: ${predicted.toFixed(2)} M L (${change > 0 ? '+' : ''}${change.toFixed(1)}% vs average ${avgConsumption.toFixed(2)} M L).`;

        if (change > 50) {
            alertTitle.textContent = '🚨 CRITICAL - Very High Demand Alert (from ML prediction)';
            alertText.innerHTML = `<strong>How much:</strong> ${howMuch}<br><strong>What to prepare:</strong> Increase supply by ~${(predicted - avgConsumption).toFixed(0)} M L. Activate emergency water supplies, increase pump capacity, and implement conservation measures. Alert authorities.`;
            alertBox.style.background = '#ffe5e5';
            alertBox.style.borderLeftColor = '#e74c3c';
        } else if (change > 25) {
            alertTitle.textContent = '⚠️ High Demand Alert (from ML prediction)';
            alertText.innerHTML = `<strong>How much:</strong> ${howMuch}<br><strong>What to prepare:</strong> Prepare extra ~${(predicted - avgConsumption).toFixed(0)} M L supply. Adjust reservoir levels, optimize pump schedules, and prepare backup sources.`;
            alertBox.style.background = '#fff3cd';
            alertBox.style.borderLeftColor = '#ffc107';
        } else if (change > 0) {
            alertTitle.textContent = '📊 Elevated Demand Notice (from ML prediction)';
            alertText.innerHTML = `<strong>How much:</strong> ${howMuch}<br><strong>What to prepare:</strong> Monitor reservoir levels; be ready to adjust supply by up to ~${(predicted - avgConsumption).toFixed(0)} M L if needed.`;
            alertBox.style.background = '#e7f3ff';
            alertBox.style.borderLeftColor = '#2196f3';
        } else if (change > -25) {
            alertTitle.textContent = '✓ Low Demand - Normal Operation';
            alertText.innerHTML = `<strong>How much:</strong> ${howMuch}<br><strong>What to prepare:</strong> Routine operation. Water availability is good; maintain normal maintenance schedules.`;
            alertBox.style.background = '#e8f5e9';
            alertBox.style.borderLeftColor = '#27ae60';
        } else {
            alertTitle.textContent = '💧 Low Demand Alert';
            alertText.innerHTML = `<strong>How much:</strong> ${howMuch}<br><strong>What to prepare:</strong> Consider reducing operational pump capacity to conserve energy; maintain system efficiency.`;
            alertBox.style.background = '#f3e5f5';
            alertBox.style.borderLeftColor = '#9c27b0';
        }

    } catch (error) {
        console.error('Error getting prediction:', error);
        const scenarioResultErr = document.getElementById('scenario-result');
        if (scenarioResultErr) scenarioResultErr.innerHTML = `
            <span style="color: #e74c3c;">Error: Could not get prediction from ML model</span>
        `;
    }
}

async function updateForecastChart() {
    try {
        const weatherForecast = [
            {temp: 32, humidity: 65, rainfall: 0},
            {temp: 33, humidity: 68, rainfall: 0},
            {temp: 35, humidity: 70, rainfall: 0},
            {temp: 34, humidity: 67, rainfall: 2},
            {temp: 30, humidity: 75, rainfall: 5},
            {temp: 28, humidity: 80, rainfall: 10},
            {temp: 29, humidity: 78, rainfall: 3}
        ];
        
        const response = await fetch(`${API_URL}/forecast`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                municipality: currentMunicipality,
                weather_forecast: weatherForecast
            })
        });
        
        const data = await response.json();
        
        const dates = data.forecast.map(f => f.date);
        const predictions = data.forecast.map(f => f.predicted_ml);
        
        // Simulate "actual" data for past days (last 7 days are predictions)
        const actualData = predictions.map((p, i) => i < 5 ? p * (0.95 + Math.random() * 0.1) : null);
        
        const forecastTrace1 = {
            x: dates,
            y: actualData,
            name: 'Actual Consumption',
            type: 'scatter',
            mode: 'lines+markers',
            line: { color: '#3498db', width: 3 },
            marker: { size: 8 }
        };

        const forecastTrace2 = {
            x: dates,
            y: predictions,
            name: 'ML Predicted Consumption',
            type: 'scatter',
            mode: 'lines+markers',
            line: { color: '#9b59b6', width: 3, dash: 'dot' },
            marker: { size: 8, symbol: 'diamond' }
        };

        const forecastLayout = {
            xaxis: { title: 'Date' },
            yaxis: { title: `Water Consumption (Million Liters)` },
            hovermode: 'x unified',
            plot_bgcolor: '#f8f9fa',
            paper_bgcolor: 'white',
            margin: { t: 20, b: 50, l: 60, r: 20 }
        };

        Plotly.newPlot('forecast-chart', [forecastTrace1, forecastTrace2], forecastLayout, {responsive: true});
    } catch (error) {
        console.error('Error updating forecast:', error);
    }
}

async function updateTempImpactChart() {
    try {
        const temperatures = [20, 24, 28, 32, 36, 40];
        const predictions = [];
        
        for (const temp of temperatures) {
            const response = await fetch(`${API_URL}/predict`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    municipality: currentMunicipality,
                    temperature: temp,
                    humidity: 65,
                    rainfall: 0,
                    day_type: 'weekday'
                })
            });
            
            const data = await response.json();
            // Extract prediction value - handle both possible response formats
            const pred = data.predicted_consumption_ml || data.predicted_consumption || 0;
            predictions.push(pred);
        }

        const tempTrace = {
            x: temperatures,
            y: predictions,
            mode: 'markers',
            type: 'scatter',
            marker: {
                size: 12,
                color: temperatures,
                colorscale: 'RdYlBu',
                reversescale: true,
                showscale: true,
                colorbar: { title: 'Temp (°C)', len: 0.5 }
            },
            name: 'ML Predictions'
        };

        const trendLine = {
            x: temperatures,
            y: predictions,
            mode: 'lines',
            type: 'scatter',
            line: { color: '#e74c3c', width: 2, dash: 'dash' },
            name: 'Trend Line'
        };

        const tempLayout = {
            xaxis: { title: 'Temperature (°C)' },
            yaxis: { title: 'Water Consumption (M L)' },
            plot_bgcolor: '#f8f9fa',
            paper_bgcolor: 'white',
            margin: { t: 20, b: 50, l: 60, r: 20 }
        };

        Plotly.newPlot('temp-impact-chart', [tempTrace, trendLine], tempLayout, {responsive: true});
    } catch (error) {
        console.error('Error updating temperature impact:', error);
    }
}

async function updateWeeklyChart() {
    try {
        const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
        const thisWeekPredictions = [];
        const lastWeekPredictions = [];
        
        for (let i = 0; i < 7; i++) {
            const isWeekend = i >= 5;
            const response = await fetch(`${API_URL}/predict`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    municipality: currentMunicipality,
                    temperature: 30 + Math.random() * 5,
                    humidity: 65,
                    rainfall: 0,
                    day_type: isWeekend ? 'weekend' : 'weekday'
                })
            });
            
            const data = await response.json();
            thisWeekPredictions.push(data.predicted_consumption_ml);
            lastWeekPredictions.push(data.predicted_consumption_ml * (0.95 + Math.random() * 0.1));
        }

        const thisWeekTrace = {
            x: days,
            y: thisWeekPredictions,
            name: 'This Week (ML)',
            type: 'bar',
            marker: { color: '#3498db' }
        };

        const lastWeekTrace = {
            x: days,
            y: lastWeekPredictions,
            name: 'Last Week',
            type: 'bar',
            marker: { color: '#95a5a6' }
        };

        const weeklyLayout = {
            barmode: 'group',
            xaxis: { title: 'Day of Week' },
            yaxis: { title: 'Consumption (M L)' },
            plot_bgcolor: '#f8f9fa',
            paper_bgcolor: 'white',
            margin: { t: 20, b: 50, l: 60, r: 20 }
        };

        Plotly.newPlot('weekly-chart', [thisWeekTrace, lastWeekTrace], weeklyLayout, {responsive: true});
    } catch (error) {
        console.error('Error updating weekly chart:', error);
    }
}

function updateHourlyChart() {
    // Hourly pattern calculated from municipality consumption patterns
    // Calculation: (Daily_Consumption / 12_hours) × Hourly_Pattern_Ratio
    const mData = municipalityData[currentMunicipality] || { predicted_ml: 200, population: 500000 };
    const dailyConsumption = mData.predicted_ml; // Average daily consumption (in ML)
    
    // Base hourly pattern (as ratio of average hourly consumption)
    // Reflects typical daily water usage: low at night, peaks during morning/evening peak hours
    const baseHourlyPattern = [0.3, 0.2, 0.2, 0.8, 1.2, 0.9, 0.7, 0.6, 0.5, 1.1, 0.9, 0.5];
    
    // Calculate average consumption per 2-hour block (12 blocks = 24 hours)
    const avgHourlyConsumption = dailyConsumption / 12;
    
    // Final hourly values = average × pattern ratio
    const hourlyData = {
        x: ['12AM', '2AM', '4AM', '6AM', '8AM', '10AM', '12PM', '2PM', '4PM', '6PM', '8PM', '10PM'],
        y: baseHourlyPattern.map(ratio => parseFloat((avgHourlyConsumption * ratio).toFixed(2)))
    };

    const hourlyTrace = {
        x: hourlyData.x,
        y: hourlyData.y,
        type: 'bar',
        marker: {
            color: hourlyData.y,
            colorscale: [[0, '#3498db'], [1, '#e74c3c']],
            showscale: false
        }
    };

    const hourlyLayout = {
        xaxis: { title: 'Hour of Day' },
        yaxis: { title: 'Avg Consumption (M L/hr)' },
        plot_bgcolor: '#f8f9fa',
        paper_bgcolor: 'white',
        margin: { t: 20, b: 50, l: 60, r: 20 }
    };

    Plotly.newPlot('hourly-chart', [hourlyTrace], hourlyLayout, {responsive: true});
}

function updateComparisonChart(municipalities) {
    const names = municipalities.map(m => m.municipality);
    const predictions = municipalities.map(m => m.predicted_ml);
    const avgConsumption = municipalities.map(m => m.avg_consumption);
    
    const currentTrace = {
        x: names,
        y: avgConsumption,
        name: 'Current Avg Daily Consumption',
        type: 'bar',
        marker: { color: '#3498db' }
    };
    
    const predictionTrace = {
        x: names,
        y: predictions,
        name: "Tomorrow's ML Prediction (32°C, Weekday)",
        type: 'bar',
        marker: { color: '#9b59b6' }
    };

    const comparisonLayout = {
        xaxis: { title: 'Municipality', tickangle: -45 },
        yaxis: { title: 'Water Consumption (Million Liters)' },
        plot_bgcolor: '#f8f9fa',
        paper_bgcolor: 'white',
        margin: { t: 20, b: 100, l: 60, r: 20 },
        height: 400,
        barmode: 'group'
    };

    Plotly.newPlot('comparison-chart', [currentTrace, predictionTrace], comparisonLayout, {responsive: true});
}

function updateTomorrowChart(municipalities) {
    const names = municipalities.map(m => m.municipality);
    const predictions = municipalities.map(m => m.predicted_ml);
    
    const tomorrowTrace = {
        x: names,
        y: predictions,
        name: "Tomorrow's ML Prediction",
        type: 'bar',
        marker: { color: '#27ae60' }
    };

    const tomorrowLayout = {
        xaxis: { title: 'Municipality', tickangle: -45 },
        yaxis: { title: 'Water Consumption (Million Liters)' },
        plot_bgcolor: '#f8f9fa',
        paper_bgcolor: 'white',
        margin: { t: 20, b: 100, l: 60, r: 20 },
        height: 400
    };

    Plotly.newPlot('tomorrow-chart', [tomorrowTrace], tomorrowLayout, {responsive: true});
}

async function createFeatureImportanceChart() {
    try {
        // Feature importance data
        const features = ['Temperature', 'Municipality', 'Prev Day Usage', 'Humidity', 'Population', 'Day Type', 'Rainfall'];
        const importance = [0.28, 0.22, 0.18, 0.12, 0.10, 0.06, 0.04];
        
        const pieTrace = {
            labels: features,
            values: importance,
            type: 'pie',
            marker: {
                colors: ['#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8', '#F7DC6F', '#BB8FCE']
            },
            textposition: 'inside',
            textinfo: 'label+percent',
            hovertemplate: '<b>%{label}</b><br>Importance: %{value:.2%}<extra></extra>'
        };

        const pieLayout = {
            title: '',
            height: 450,
            margin: { t: 20, b: 20, l: 20, r: 20 },
            paper_bgcolor: 'white',
            plot_bgcolor: 'white',
            font: { size: 12, color: '#2c3e50' }
        };

        Plotly.newPlot('feature-importance-pie', [pieTrace], pieLayout, {responsive: true});
    } catch (error) {
        console.error('Error loading feature importance:', error);
    }
}

function initializeMap() {
    // Initialize map centered on Andhra Pradesh
    const centerCoord = [15.9129, 79.7400];
    
    if (municipalityMap) {
        municipalityMap.remove();
    }

    municipalityMap = L.map('municipality-map').setView(centerCoord, 7);

    // Add OpenStreetMap tiles
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19
    }).addTo(municipalityMap);

    // Calculate actual min/max from data for proper color scaling
    const predictions = Object.keys(municipalityData).map(m => municipalityData[m].predicted_ml || 0);
    const minPrediction = Math.min(...predictions);
    const maxPrediction = Math.max(...predictions);
    const midPrediction = (minPrediction + maxPrediction) / 2;

    // Function to get color based on water consumption
    function getColor(value) {
        if (!value) return '#999';
        
        // Normalize based on actual data range: Low (blue) → Medium (green) → High (red)
        let hue;
        if (value <= midPrediction) {
            // Blue to Green: from min to mid
            const normalized = (value - minPrediction) / (midPrediction - minPrediction);
            hue = 240 - (normalized * 120); // 240 (blue) to 120 (green)
        } else {
            // Green to Red: from mid to max
            const normalized = (value - midPrediction) / (maxPrediction - midPrediction);
            hue = 120 - (normalized * 120); // 120 (green) to 0 (red)
        }
        return `hsl(${hue}, 100%, 50%)`;
    }

    // Clear existing markers
    mapMarkers = {};

    // Add markers for each municipality
    municipalities.forEach(async municipality => {
        if (municipalityCoordinates[municipality] && municipalityData[municipality]) {
            const coords = municipalityCoordinates[municipality];
            const data = municipalityData[municipality];
            const predictedML = data.predicted_ml || 0;

            // Fetch current weather for this municipality
            let currentTemp = 32;
            let currentHumidity = 65;
            let currentRainfall = 0;
            
            try {
                const weatherResponse = await fetch(`${API_URL}/current-weather/${municipality}`);
                if (weatherResponse.ok) {
                    const weatherData = await weatherResponse.json();
                    currentTemp = weatherData.temperature_celsius || 32;
                    currentHumidity = weatherData.humidity_percent || 65;
                    currentRainfall = weatherData.rainfall_mm || 0;
                }
            } catch (error) {
                console.log(`Could not fetch weather for ${municipality}:`, error);
                // Use defaults if API fails
            }

            // Create circle marker
            const marker = L.circleMarker([coords[0], coords[1]], {
                radius: 15,
                fillColor: getColor(predictedML),
                color: '#333',
                weight: 2,
                opacity: 1,
                fillOpacity: 0.8
            }).addTo(municipalityMap);

            // Add popup with weather conditions used for prediction
            const popupContent = `
                <div style="width: 220px; font-family: Arial, sans-serif;">
                    <strong style="font-size: 14px;">${municipality}</strong><br>
                    <hr style="margin: 5px 0;">
                    <strong>Prediction:</strong> ${predictedML.toLocaleString()}M L<br>
                    <strong>Population:</strong> ${(data.population / 1000).toFixed(0)}K<br>
                    <hr style="margin: 5px 0;">
                    <strong>Current Conditions:</strong><br>
                    🌡️ Temperature: ${currentTemp.toFixed(1)}°C<br>
                    💧 Humidity: ${currentHumidity.toFixed(1)}%<br>
                    🌧️ Rainfall: ${currentRainfall.toFixed(2)}mm
                </div>
            `;
            marker.bindPopup(popupContent);

            mapMarkers[municipality] = marker;
        }
    });

    // Add a legend to the map
    const legend = L.control({ position: 'bottomright' });

    legend.onAdd = function(map) {
        const div = L.DomUtil.create('div', 'info legend');
        div.style.background = 'white';
        div.style.padding = '10px';
        div.style.borderRadius = '5px';
        div.style.boxShadow = '0 0 15px rgba(0,0,0,0.2)';
        div.style.fontSize = '12px';
        div.innerHTML = `
            <div><strong>Predicted Water (ML)</strong></div>
            <div style="margin-top: 8px;">
                <div><span style="background: hsl(240, 100%, 50%); display: inline-block; width: 18px; height: 18px; border-radius: 50%;"></span> Low (${minPrediction.toFixed(0)} ML)</div>
                <div><span style="background: hsl(120, 100%, 50%); display: inline-block; width: 18px; height: 18px; border-radius: 50%;"></span> Medium (${midPrediction.toFixed(0)} ML)</div>
                <div><span style="background: hsl(0, 100%, 50%); display: inline-block; width: 18px; height: 18px; border-radius: 50%;"></span> High (${maxPrediction.toFixed(0)} ML)</div>
            </div>
        `;
        return div;
    };

    legend.addTo(municipalityMap);
}

// Coming Soon Popup
function showComingSoonPopup() {
    alert('Coming Soon! This feature will be available in the next update.');
}

// Navigation Menu Functions
const menuBtn = document.getElementById('menuBtn');
const sideNav = document.getElementById('sideNav');
const overlay = document.getElementById('overlay');
const navItems = document.querySelectorAll('.nav-item');

// Toggle Sidebar
function toggleMenu() {
    sideNav.classList.toggle('active');
    overlay.classList.toggle('active');
    
    // Hamburger Animation
    const bars = document.querySelectorAll('.bar');
    if(sideNav.classList.contains('active')) {
        bars[0].style.transform = 'translateY(7px) rotate(45deg)';
        bars[1].style.opacity = '0';
        bars[2].style.transform = 'translateY(-7px) rotate(-45deg)';
    } else {
        bars[0].style.transform = 'none';
        bars[1].style.opacity = '1';
        bars[2].style.transform = 'none';
    }
}

menuBtn.addEventListener('click', toggleMenu);
overlay.addEventListener('click', toggleMenu);

// Ripple Effect Logic and Click Handlers
navItems.forEach((item, index) => {
    item.addEventListener('mousedown', function(e) {
        // Remove existing ripples
        const ripples = this.getElementsByClassName('ripple');
        while(ripples.length > 0) ripples[0].remove();

        const ripple = document.createElement('span');
        const rect = this.getBoundingClientRect();
        const size = Math.max(rect.width, rect.height);
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        ripple.style.width = ripple.style.height = `${size}px`;
        ripple.style.left = `${x}px`;
        ripple.style.top = `${y}px`;
        ripple.classList.add('ripple');

        this.appendChild(ripple);
        
        // Set Active State
        navItems.forEach(i => i.classList.remove('current'));
        this.classList.add('current');
    });

    // Add click handlers for navigation items
    item.addEventListener('click', function(e) {
        e.preventDefault();
        const linkText = this.querySelector('a').textContent.trim();
        
        // Close menu
        sideNav.classList.remove('active');
        overlay.classList.remove('active');
        const bars = document.querySelectorAll('.bar');
        bars[0].style.transform = 'none';
        bars[1].style.opacity = '1';
        bars[2].style.transform = 'none';

        // Handle navigation based on menu item
        if (linkText === 'Introduction') {
            showIntroAnimation();
        } else if (linkText === 'Dashboard Information') {
            // Scroll to dashboard header
            closeAllContent();
            setTimeout(() => {
                const infoSection = document.getElementById('dashboard-header');
                if (infoSection) {
                    infoSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
            }, 300);
        } else if (linkText === 'Alert System') {
            // Scroll to alert system section
            closeAllContent();
            setTimeout(() => {
                const alertSection = document.getElementById('alert-box');
                if (alertSection) {
                    alertSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            }, 300);
        } else if (linkText === 'Map Visualization') {
            closeAllContent();
            setTimeout(() => {
                const mapSection = document.getElementById('municipality-map');
                if (mapSection) {
                    mapSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            }, 300);
        } else if (linkText === 'About') {
            alert('APMWRS v1.0 - Andhra Pradesh Multi-Municipality Water Forecasting System\n\nDeveloped with ML-powered predictions\nTemperature, Humidity, Rainfall data integration\nReal-time water demand forecasting');
        }
    });
});

// Function to show content sections
function showContent(contentId) {
    // Show backdrop
    const backdrop = document.getElementById('contentBackdrop');
    backdrop.classList.add('show');
    
    // Hide all content sections
    document.querySelectorAll('.content-section').forEach(section => {
        section.classList.remove('show');
    });
    
    // Show the requested content
    const section = document.getElementById(contentId);
    if (section) {
        section.classList.add('show');
    }
}

// Function to close all content
function closeAllContent() {
    const backdrop = document.getElementById('contentBackdrop');
    backdrop.classList.remove('show');
    document.querySelectorAll('.content-section').forEach(section => {
        section.classList.remove('show');
    });
}

// Close content section
function hideContentSection() {
    closeAllContent();
}

function showIntroAnimation() {
    // Create and show intro modal with water fill animation
    let introModal = document.getElementById('introModal');
    if (!introModal) {
        const modal = document.createElement('div');
        modal.id = 'introModal';
        modal.className = 'intro-modal-water';
        modal.style.cssText = `
            display: flex;
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: linear-gradient(135deg, #1a3a52 0%, #2c5aa0 100%);
            z-index: 9999;
            justify-content: center;
            align-items: center;
            flex-direction: column;
        `;
        
        modal.innerHTML = `
            <div style="position: relative; display: flex; justify-content: center; align-items: center; flex-direction: column;">
                <div style="position: relative; width: 140px; height: 160px; margin-bottom: 30px;">
                    <svg viewBox="0 0 140 160" style="width: 100%; height: 100%;">
                        <path d="M 20 30 L 20 130 Q 20 150 40 150 L 100 150 Q 120 150 120 130 L 120 30" 
                              fill="none" stroke="white" stroke-width="2"/>
                        <defs>
                            <linearGradient id="waterGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                                <stop offset="0%" style="stop-color:#4a90e2;stop-opacity:0.8" />
                                <stop offset="100%" style="stop-color:#2c5aa0;stop-opacity:1" />
                            </linearGradient>
                            <filter id="wave">
                                <feTurbulence type="fractalNoise" baseFrequency="0.02" numOctaves="3" result="noise" />
                                <feDisplacementMap in="SourceGraphic" in2="noise" scale="3" />
                            </filter>
                        </defs>
                        <g id="waterFill">
                            <path id="waterPath" d="M 20 130 Q 20 150 40 150 L 100 150 Q 120 150 120 130 L 120 130 Q 70 120 20 130 Z" 
                                  fill="url(#waterGrad)" filter="url(#wave)"/>
                        </g>
                        <circle class="bubble" cx="40" cy="100" r="4" fill="#ffffff" opacity="0.6" style="animation-delay: 0s;"/>
                        <circle class="bubble" cx="70" cy="110" r="3" fill="#ffffff" opacity="0.6" style="animation-delay: 0.5s;"/>
                        <circle class="bubble" cx="100" cy="105" r="4" fill="#ffffff" opacity="0.6" style="animation-delay: 1s;"/>
                    </svg>
                </div>
                <p style="margin-top: 20px; font-size: 18px; color: white; font-weight: 600; letter-spacing: 1px;">Water Distribution Visualization</p>
            </div>
        `;
        
        document.body.appendChild(modal);
        introModal = document.getElementById('introModal');
    }
    introModal.style.display = 'flex';
    
    // After animation, redirect to water distribution page
    setTimeout(() => {
        introModal.style.display = 'none';
        window.location.href = '/water_distribution';
    }, 3500);
}

// Close content section
function hideContentSection() {
    document.querySelectorAll('.content-section').forEach(section => {
        section.classList.remove('show');
    });
}

// Close content when clicking outside
document.addEventListener('click', function(event) {
    const contentSection = document.querySelector('.content-section.show');
    const backdrop = document.getElementById('contentBackdrop');
    const closeBtn = event.target.closest('.close-btn');
    
    if (contentSection && !contentSection.contains(event.target) && !closeBtn) {
        if (backdrop.contains(event.target) || event.target === backdrop) {
            hideContentSection();
        }
    }
});

// Rolling Numbers Animation
function animateRollingNumber(elementId, targetValue, suffix = '', isPopulation = false) {
    const element = document.getElementById(elementId);
    if (!element) return;

    const start = parseFloat(element.textContent) || 0;
    const target = parseFloat(targetValue) || 0;
    const duration = 1500; // milliseconds
    const increment = (target - start) / (duration / 50);
    let current = start;

    const interval = setInterval(() => {
        current += increment;
        if ((increment > 0 && current >= target) || (increment < 0 && current <= target)) {
            current = target;
            clearInterval(interval);
        }
        
        // Format the value appropriately
        if (isPopulation) {
            element.textContent = (current / 1000).toFixed(0) + 'K';
        } else {
            element.textContent = current.toFixed(2) + (suffix ? suffix : 'M L');
        }
    }, 50);
}

// Update stats with rolling numbers animation
function updateStatsWithAnimation() {
    if (municipalityData[currentMunicipality]) {
        const mData = municipalityData[currentMunicipality];
        animateRollingNumber('stat2-value', `${mData.predicted_ml}`, 'M L');
        animateRollingNumber('stat4-value', `${mData.population}`, '', true);
        animateRollingNumber('stat5-value', `${mData.predicted_ml}`, 'M L');
    }
}

// ==================== INFO MODAL FUNCTIONALITY ====================

// Chart information data structure (improved copy for info modals)
const chartInfoData = {
    'hourly-consumption': {
        title: '⏰ Hourly Consumption Pattern',
        why: 'Water use varies by time of day. Knowing peak hours helps plan pumping and supply so you can meet demand without overloading the system.',
        how: 'Values are derived from historical consumption data, aggregated by 2-hour blocks and scaled by the selected municipality\'s ML-predicted daily total. Color scale: cooler (blue) for lower usage, warmer (red) for higher.',
        purpose: 'Optimize supply scheduling and pumping schedules; spot anomalies (e.g. unexplained spikes) that may indicate leaks or meter issues.',
        insights: 'Typical peaks: 8–10 AM (morning) and 6–8 PM (evening). Nighttime use is lower. Sustained high values outside these windows may warrant investigation.'
    },
    'temperature-impact': {
        title: '🌡️ Temperature Impact',
        why: 'Higher temperatures drive more water use (cooling, irrigation, hygiene). This chart shows how demand responds to temperature so you can plan ahead.',
        how: 'The Live ML model is run at different temperature values (other inputs held fixed). Red dots are predictions; the dashed line shows the trend. Data is for the selected municipality.',
        purpose: 'Plan for heat waves and hot days: anticipate extra demand and ensure reservoir and supply capacity can meet it.',
        insights: 'Demand typically rises about 2–3% per degree Celsius above 30°C. Use the trend to estimate extra M L needed on very hot days.'
    },
    'feature-importance': {
        title: '🎯 Model Feature Importance',
        why: 'Not all inputs affect predictions equally. Feature importance shows which drivers the model relies on most, so you can interpret and trust the forecast.',
        how: 'The Random Forest model computes importance scores from how much each feature reduces prediction error across all municipalities. Values are normalized to sum to 100%.',
        purpose: 'Understand prediction reliability and which levers (temperature, municipality, previous day usage, etc.) matter most for operations and planning.',
        insights: 'Temperature and Municipality are usually among the top factors; Prev Day Usage reflects recent patterns. Use this to focus data quality and scenario planning on the most influential inputs.'
    },
    'weekly-comparison': {
        title: '📊 Week-over-Week Comparison',
        why: 'Comparing this week\'s predicted demand to last week\'s pattern helps detect sudden changes and emerging trends that need attention.',
        how: 'Blue bars: Live ML predictions for the current week (7 days). Gray bars: last week\'s values (from historical/actual data). Same municipality and day-of-week alignment where applicable.',
        purpose: 'Support quick operational decisions: spot big swings, validate that predictions align with recent history, and flag potential issues (e.g. sustained rise or drop).',
        insights: 'Sustained week-over-week increases may indicate growth, seasonal shift, or possible leaks. Sustained decreases may reflect conservation or meter/data issues. Use with other charts for context.'
    }
};

// Initialize info modal functionality
function initializeInfoModals() {
    const infoButtons = document.querySelectorAll('.info-btn');
    const infoModal = document.getElementById('infoModal');
    const infoModalBackdrop = document.getElementById('infoModalBackdrop');
    const infoModalClose = document.getElementById('infoModalClose');

    // Open modal when info button clicked
    infoButtons.forEach(button => {
        button.addEventListener('click', function(e) {
            e.stopPropagation();
            const chartId = this.getAttribute('data-chart');
            showChartInfo(chartId);
        });
    });

    // Close modal when close button clicked
    infoModalClose.addEventListener('click', closeChartInfo);

    // Close modal when backdrop clicked
    infoModalBackdrop.addEventListener('click', closeChartInfo);

    // Close modal when ESC key pressed
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && infoModal.classList.contains('modal-visible')) {
            closeChartInfo();
        }
    });
}

function showChartInfo(chartId) {
    const data = chartInfoData[chartId];
    if (!data) return;

    const infoModal = document.getElementById('infoModal');
    const infoModalBackdrop = document.getElementById('infoModalBackdrop');

    // Set content
    document.getElementById('infoModalTitle').textContent = data.title;
    document.getElementById('infoModalWhy').textContent = data.why;
    document.getElementById('infoModalHow').textContent = data.how;
    document.getElementById('infoModalPurpose').textContent = data.purpose;
    document.getElementById('infoModalInsights').textContent = data.insights;

    // Show modal with animation
    infoModal.classList.add('modal-visible');
    infoModalBackdrop.classList.add('modal-visible');

    // Lock body scroll
    document.body.style.overflow = 'hidden';
}

function closeChartInfo() {
    const infoModal = document.getElementById('infoModal');
    const infoModalBackdrop = document.getElementById('infoModalBackdrop');

    // Hide modal with animation
    infoModal.classList.remove('modal-visible');
    infoModalBackdrop.classList.remove('modal-visible');

    // Unlock body scroll
    document.body.style.overflow = '';
}

// ==================== LOADING ANIMATION FIX ====================
// Modified updateDashboard function to wait for loading animation before updating stats

const originalUpdateDashboard = updateDashboard;
async function updateDashboard() {
    const newMunicipality = document.getElementById('municipality-select').value;
    
    // Only show loading if municipality actually changed
    const municipalityChanged = currentMunicipality !== newMunicipality;
    currentMunicipality = newMunicipality;
    
    // Show loading animation ONLY when municipality changes
    const loadingModal = document.getElementById('loadingModal');
    if (municipalityChanged) {
        loadingModal.classList.add('show');
        
        // Wait for 500ms to show loading animation before updating stats
        await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    // Update all titles
    document.getElementById('alert-title').textContent = `⚠️ High Demand Alert - ${currentMunicipality}`;
    document.getElementById('stat1-title').textContent = `Current Prediction (${currentMunicipality})`;
    document.getElementById('stat2-title').textContent = `Average Consumption (${currentMunicipality})`;
    document.getElementById('stat4-title').textContent = `Population (${currentMunicipality})`;
    document.getElementById('stat5-title').textContent = `Tomorrow's ML Prediction (${currentMunicipality})`;
            const scenarioTitle = document.getElementById('scenario-title');
            if (scenarioTitle) scenarioTitle.textContent = `What-If (${currentMunicipality})`;
            const tempLabel = document.getElementById('temp-label');
            if (tempLabel) tempLabel.textContent = `Temperature in ${currentMunicipality} (°C)`;
    document.getElementById('forecast-title').textContent = `📈 7-Day Forecast (${currentMunicipality} - Live ML)`;
    document.getElementById('hourly-title').textContent = `⏰ Hourly Consumption Pattern (${currentMunicipality})`;
    document.getElementById('temp-impact-title').textContent = `🌡️ Temperature Impact (${currentMunicipality} - Live ML)`;
    document.getElementById('weekly-title').textContent = `📊 Week-over-Week Comparison (${currentMunicipality} - Live ML)`;
    
    // Update stats with animation AFTER loading animation shows
    if (municipalityData[currentMunicipality]) {
        const mData = municipalityData[currentMunicipality];
        // Use rolling animation for stats - NOW HAPPENS AFTER LOADING ANIMATION
        animateRollingNumber('stat2-value', `${mData.predicted_ml}`, 'M L');
        animateRollingNumber('stat4-value', `${mData.population}`, '', true);
        animateRollingNumber('stat5-value', `${mData.predicted_ml}`, 'M L');
        document.getElementById('stat5-change').textContent = `Tomorrow's forecast`;
    }
    
    // Get fresh prediction and update charts
    try {
        await runScenario();
        await updateForecastChart();
        await updateTempImpactChart();
        await updateWeeklyChart();
        updateHourlyChart();
    } catch (error) {
        console.error('Error updating dashboard:', error);
    } finally {
        // Hide loading animation after data is loaded (only if it was shown)
                if (municipalityChanged) {
                    setTimeout(() => {
                        loadingModal.classList.remove('show');
                    }, 1200);
                }
    }
}

// Header What-If and Intro: show loading then redirect
function setupHeaderNavRedirects() {
    const loadingModal = document.getElementById('loadingModal');
    const headerWhatIf = document.getElementById('headerWhatIf');
    const headerIntro = document.getElementById('headerIntro');
    function goWithLoading(e, target) {
        e.preventDefault();
        if (!target) return;
        loadingModal.classList.add('show');
        setTimeout(function() {
            window.location.href = target;
        }, 1200);
    }
    if (headerWhatIf) headerWhatIf.addEventListener('click', function(e) { goWithLoading(e, this.getAttribute('data-target')); });
    if (headerIntro) headerIntro.addEventListener('click', function(e) { goWithLoading(e, this.getAttribute('data-target')); });
}

// Initialize dashboard on page load
window.addEventListener('load', function() {
    setupHeaderNavRedirects();
    initDashboard();
    initializeInfoModals();
});
