// Specific Data Provided by User
const harGharJalData = [
    { district: "Alluri Sitharama Raju", total: 554, certified: 30, percent: 5.42 },
    { district: "Anakapalli", total: 39, certified: 10, percent: 25.64 },
    { district: "Ananthapuramu", total: 106, certified: 52, percent: 49.06 },
    { district: "Annamayya", total: 437, certified: 434, percent: 99.31 },
    { district: "Bapatla", total: 10, certified: 9, percent: 90.00 },
    { district: "Chittoor", total: 758, certified: 750, percent: 98.94 },
    { district: "Dr. B.r. Ambedkar Konaseema", total: 27, certified: 22, percent: 81.48 },
    { district: "East Godavari", total: 39, certified: 36, percent: 92.31 },
    { district: "Eluru", total: 325, certified: 306, percent: 94.15 },
    { district: "Guntur", total: 28, certified: 22, percent: 78.57 },
    { district: "Kakinada", total: 75, certified: 61, percent: 81.33 },
    { district: "Krishna", total: 56, certified: 20, percent: 35.71 },
    { district: "Kurnool", total: 15, certified: 12, percent: 80.00 },
    { district: "Nandyal", total: 91, certified: 80, percent: 87.91 },
    { district: "Ntr", total: 27, certified: 22, percent: 81.48 },
    { district: "Palnadu", total: 16, certified: 11, percent: 68.75 },
    { district: "Parvathipuram Manyam", total: 96, certified: 4, percent: 4.17 },
    { district: "Prakasam", total: 117, certified: 43, percent: 36.75 },
    { district: "Sri Potti Sriramulu Nellore", total: 164, certified: 103, percent: 62.80 },
    { district: "Sri Sathya Sai", total: 91, certified: 52, percent: 57.14 },
    { district: "Srikakulam", total: 57, certified: 26, percent: 45.61 },
    { district: "Tirupati", total: 902, certified: 898, percent: 99.56 },
    { district: "Visakhapatnam", total: 5, certified: 3, percent: 60.00 },
    { district: "Vizianagaram", total: 139, certified: 103, percent: 74.10 },
    { district: "West Godavari", total: 29, certified: 21, percent: 72.41 },
    { district: "Y.s.r.", total: 583, certified: 580, percent: 99.49 },
    { district: "Total", total: "4,786", certified: "3,710", percent: 77.52 }
];

// Project Municipalities (to show on map)
const projectMunicipalities = {
    'Tirupati': [13.6288, 79.4192],
    'Guntur': [16.3067, 80.4365],
    'Nellore': [14.4426, 79.9864],
    'Vijayawada': [16.5062, 80.6480],
    'Kakinada': [16.9891, 82.2475],
    'Vizianagaram': [18.1067, 83.3956],
    'Kadapa': [14.4694, 78.8216],
    'Kurnool': [15.8281, 78.8355],
    'Rajahmundry': [16.9999, 81.7887],
    'Anantapur': [14.5833, 77.6000]
};

function initDashboard() {
    initMap();
    renderTable();
    renderChart();
    renderStatusChart();
    setupModal();
}

function initMap() {
    const map = L.map('andhra-map').setView([15.9129, 79.7400], 7);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap'
    }).addTo(map);

    // Add markers for the 10 project municipalities
    Object.keys(projectMunicipalities).forEach(city => {
        const coords = projectMunicipalities[city];
        const marker = L.circleMarker(coords, {
            radius: 10,
            fillColor: '#004aad', // Blue theme
            color: '#fff',
            weight: 2,
            opacity: 1,
            fillOpacity: 0.8
        }).addTo(map);

        marker.bindPopup(`<b>${city}</b><br>Project Municipality`);
    });
}

function renderTable() {
    const tbody = document.getElementById('table-body');
    let html = '';

    harGharJalData.forEach((row, index) => {
        const isTotal = row.district === 'Total';
        const style = isTotal ? 'font-weight: bold; background: #e0f2f1;' : '';

        html += `
            <tr style="${style}">
                <td>${row.district}</td>
                <td>${row.total}</td>
                <td>${row.certified}</td>
                <td>${row.percent}%</td>
            </tr>
        `;
    });

    tbody.innerHTML = html;
}

function renderChart() {
    // Progress Bar Chart
    const years = ['2019-20', '2020-2021', '2021-2022', '2022-2023', '2023-2024', '2024-2025', '2025-2026'];
    const values = [1.2, 12.5, 9.5, 11.8, 3.8, 0.5, 0.8]; // Approximated from image

    const trace = {
        x: years,
        y: values,
        type: 'bar',
        marker: { color: '#4FC3F7' }
    };

    const layout = {
        title: '',
        yaxis: { title: 'Tap water connections (Lakhs)' },
        margin: { t: 20, l: 50, r: 20, b: 40 },
        height: 350
    };

    Plotly.newPlot('progress-chart', [trace], layout, { responsive: true });
}

function renderStatusChart() {
    // Data for Status Chart (approximated from image, sorted descending by percentage roughly)
    // The image shows horizontal bars for each district representing % coverage.
    // I will use the harGharJalData for this.

    // Sort data by percentage descending for better visualization
    const sortedData = [...harGharJalData].filter(d => d.district !== 'Total').sort((a, b) => a.percent - b.percent);

    const districts = sortedData.map(d => d.district);
    const percentages = sortedData.map(d => d.percent);

    // Gradient colors logic is hard in simple Plotly JS without arrays, 
    // but we can use a color scale.
    // The image shows blue bars. 

    const trace = {
        x: percentages,
        y: districts,
        type: 'bar',
        orientation: 'h',
        marker: {
            color: percentages,
            colorscale: 'Blues',
            showscale: false
        },
        text: percentages.map(p => p.toFixed(2) + '%'),
        textposition: 'auto',
        hoverinfo: 'x+y'
    };

    const layout = {
        title: '',
        xaxis: {
            title: '% Households with Tap Water',
            range: [0, 100],
            fixedrange: true
        },
        yaxis: {
            automargin: true,
            tickfont: { size: 10 }
        },
        margin: { t: 10, l: 150, r: 20, b: 40 },
        height: 600 // Taller for all districts
    };

    Plotly.newPlot('status-chart', [trace], layout, { responsive: true });
}

function setupModal() {
    const modal = document.getElementById("infoModal");
    const btn = document.getElementById("info-icon");
    const span = document.getElementsByClassName("close-modal")[0];

    btn.onclick = function () {
        modal.style.display = "block";
    }

    span.onclick = function () {
        modal.style.display = "none";
    }

    window.onclick = function (event) {
        if (event.target == modal) {
            modal.style.display = "none";
        }
    }
}

function downloadTableCSV() {
    const csvRows = [];
    const headers = ["District", "Total Households", "Certified", "Percentage"];
    csvRows.push(headers.join(","));

    harGharJalData.forEach(row => {
        // Handle commas in numbers for CSV (though our data might be strings already)
        const total = typeof row.total === 'string' ? row.total.replace(/,/g, '') : row.total;
        const certified = typeof row.certified === 'string' ? row.certified.replace(/,/g, '') : row.certified;
        const percent = row.percent;

        const values = [
            `"${row.district}"`,
            total,
            certified,
            percent
        ];
        csvRows.push(values.join(","));
    });

    const csvContent = "data:text/csv;charset=utf-8," + csvRows.join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "har_ghar_jal_status.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

function downloadReport() {
    window.print();
}

document.addEventListener('DOMContentLoaded', initDashboard);
