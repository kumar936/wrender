(function() {
    const API_URL = '/api';
    const municipalitySelect = document.getElementById('whatif-municipality');
    const predictBtn = document.getElementById('whatif-predict-btn');
    const resultDiv = document.getElementById('whatif-result');
    const predValueEl = document.getElementById('whatif-pred-value');
    const changeMsgEl = document.getElementById('whatif-change-msg');
    const chartsDiv = document.getElementById('whatif-charts');

    async function loadMunicipalities() {
        try {
            const res = await fetch(API_URL + '/municipalities');
            const data = await res.json();
            if (data.municipalities && data.municipalities.length) {
                municipalitySelect.innerHTML = data.municipalities.map(function(m) {
                    return '<option value="' + m + '">' + m + '</option>';
                }).join('');
            }
        } catch (e) {
            console.error('Load municipalities:', e);
        }
    }

    function buildFactorPie(temp, humidity, rainfall, dayType, predicted, average) {
        var tempShare = Math.min(0.35, 0.2 + (temp - 25) / 100);
        var humidityShare = 0.15 + (humidity - 50) / 500;
        var rainfallShare = Math.max(0.05, 0.2 - rainfall / 200);
        var dayShare = dayType === 'weekend' ? 0.12 : dayType === 'holiday' ? 0.08 : 0.15;
        var other = 1 - tempShare - humidityShare - rainfallShare - dayShare;
        if (other < 0) other = 0;
        var labels = ['Temperature', 'Humidity', 'Rainfall', 'Day type', 'Other'];
        var values = [tempShare, humidityShare, rainfallShare, dayShare, other].map(function(v) { return Math.round(v * 100); });
        var trace = {
            labels: labels,
            values: values,
            type: 'pie',
            marker: { colors: ['#FF6B6B', '#4ECDC4', '#45B7D1', '#98D8C8', '#BB8FCE'] },
            textinfo: 'label+percent',
            hovertemplate: '<b>%{label}</b><br>%{percent}<extra></extra>'
        };
        var layout = { margin: { t: 10, b: 10, l: 10, r: 10 }, height: 280, paper_bgcolor: 'white', plot_bgcolor: 'white' };
        Plotly.newPlot('whatif-pie', [trace], layout, { responsive: true });
    }

    function buildPredVsBaseline(predicted, average, municipality) {
        var trace = {
            x: ['Average (baseline)', 'ML Prediction'],
            y: [average, predicted],
            type: 'bar',
            marker: { color: ['#95a5a6', '#3498db'] },
            text: [average.toFixed(2) + ' M L', predicted.toFixed(2) + ' M L'],
            textposition: 'outside'
        };
        var layout = {
            margin: { t: 20, b: 40, l: 50, r: 20 },
            height: 280,
            yaxis: { title: 'Consumption (M L)' },
            paper_bgcolor: 'white',
            plot_bgcolor: 'white'
        };
        Plotly.newPlot('whatif-bar', [trace], layout, { responsive: true });
    }

    predictBtn.addEventListener('click', async function() {
        var municipality = municipalitySelect.value;
        if (!municipality) {
            alert('Please select a municipality.');
            return;
        }
        var temp = parseFloat(document.getElementById('whatif-temp').value) || 32;
        var humidity = parseFloat(document.getElementById('whatif-humidity').value) || 65;
        var dayType = document.getElementById('whatif-day-type').value || 'weekday';
        var rainfall = parseFloat(document.getElementById('whatif-rainfall').value) || 0;
        predictBtn.disabled = true;
        predictBtn.textContent = 'Predicting…';
        try {
            var res = await fetch(API_URL + '/predict', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    municipality: municipality,
                    temperature: temp,
                    humidity: humidity,
                    rainfall: rainfall,
                    day_type: dayType
                })
            });
            var data = await res.json();
            if (data.error) {
                predValueEl.textContent = 'Error';
                changeMsgEl.textContent = data.error;
            } else {
                var pred = data.predicted_consumption_ml;
                var avg = data.average_consumption;
                var change = data.change_percent;
                predValueEl.textContent = pred.toFixed(2) + ' M L';
                var arrow = change > 0 ? '↑' : '↓';
                var color = change > 0 ? '#e74c3c' : '#27ae60';
                changeMsgEl.innerHTML = '<span style="color:' + color + '">' + arrow + ' ' + Math.abs(change).toFixed(1) + '% vs average</span> (' + avg.toFixed(2) + ' M L baseline)';
                resultDiv.style.display = 'block';
                chartsDiv.style.display = 'grid';
                buildFactorPie(temp, humidity, rainfall, dayType, pred, avg);
                buildPredVsBaseline(pred, avg, municipality);
            }
        } catch (e) {
            predValueEl.textContent = 'Error';
            changeMsgEl.textContent = 'Could not get prediction.';
        }
        predictBtn.disabled = false;
        predictBtn.textContent = 'Get Prediction';
    });

    loadMunicipalities();
})();
