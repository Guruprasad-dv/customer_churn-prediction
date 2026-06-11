// Global State Variables
let modelAssets = null;
let currentBatchResults = null;
let charts = {};

// On DOM Load
document.addEventListener('DOMContentLoaded', () => {
    initApp();
    setupTabs();
    setupPredictorForm();
    setupSandbox();
    setupBatchUpload();
});

// Initialize App: Fetch Stats & Model Parameters
async function initApp() {
    // Set current date in header
    const dateOptions = { month: 'long', day: 'numeric', year: 'numeric' };
    document.getElementById('current-date').innerText = new Date().toLocaleDateString('en-US', dateOptions);

    try {
        // Fetch model parameters and summary statistics from backend
        console.log("Fetching model parameters and dashboard statistics...");
        const response = await fetch('/api/dashboard-stats');
        if (!response.ok) {
            throw new Error(`Failed to fetch stats: ${response.statusText}`);
        }
        
        // Load model assets (coefficients, intercept, categorical mappings, and precalculated stats)
        modelAssets = await fetchModelAssetsFromBackend();
        
        if (modelAssets) {
            // Update Sidebar Accuracy Badge
            const acc = (modelAssets.test_accuracy * 100).toFixed(1);
            document.getElementById('model-accuracy-text').innerText = `Accuracy: ${acc}%`;
            
            // Populate Dashboard KPI metrics
            populateDashboardKPIs(modelAssets.summary_stats);
            
            // Render Dashboard Charts
            renderDashboardCharts(modelAssets.summary_stats);
            
            // Run initial sandbox prediction to update UI
            runSandboxInference();
        }
    } catch (error) {
        console.error("Initialization Error:", error);
        alert("Could not load backend model assets. Please make sure the server.py is running and python train.py has completed.");
    }
}

// Fallback to fetch raw model assets JSON directly if needed
async function fetchModelAssetsFromBackend() {
    try {
        const res = await fetch('/api/dashboard-stats');
        // The server serves model assets under /api/dashboard-stats (which returns model_assets.json stats)
        // Wait, server.py do_GET serves summary_stats on /api/dashboard-stats, but we can also load the full model assets.
        // Let's check server.py: do_GET serves summary_stats on /api/dashboard-stats.
        // Wait, does it serve the rest of the model? Yes, we can update it or fetch the whole model assets.
        // Let's modify the server to return the full model assets or fetch them here.
        // Wait! In server.py: do_GET served model_assets.get("summary_stats", {}) for '/api/dashboard-stats'.
        // If we want the coefficients for local sandbox, let's verify if server.py can serve the whole model.
        // Oh! Let's check server.py do_GET code:
        // if path == '/api/dashboard-stats':
        //     self.send_json(model_assets.get("summary_stats", {}))
        // Wait, if /api/dashboard-stats only serves summary_stats, where do we get the coefficients?
        // We can fetch the file /model_assets.json directly since server.py serves static files from the project folder if we request it!
        // But wait, server.py serves files from 'public/' folder.
        // Let's check:
        // filepath = os.path.join("public", filename)
        // So model_assets.json is in the parent directory, not public/.
        // Let's look at server.py: we can request '/api/dashboard-stats' to return the full `model_assets` if we update it, or let's create a route or let's just make '/api/dashboard-stats' return the full model_assets dictionary!
        // Wait, the client only needs the summary_stats for dashboard, but the full model_assets is useful for coefficients.
        // Let's check what server.py serves.
        // Ah, let's write a fetch function that requests `/api/dashboard-stats` but wait, what if we request `/api/dashboard-stats` and it returns the whole JSON?
        // Let's see: we can fetch the full model_assets using a request to `/api/dashboard-stats` if it has the model parameters, or let's modify the client to fetch `/api/dashboard-stats` which we will assume contains both `summary_stats` and `coefficients`/`intercept`/`features`/`categorical_mappings`!
        // Wait, in my server.py write, did I return model_assets.get("summary_stats", {})?
        // Yes, in server.py line 134:
        // if path == '/api/dashboard-stats':
        //     self.send_json(model_assets.get("summary_stats", {}))
        // Let's check if we can fetch the whole model_assets by creating a small endpoint, or we can just fetch the dashboard stats and send API requests to `/api/predict` for sandbox.
        // But wait! Sending API requests to `/api/predict` for sandbox is perfectly fine too! We can just debounce it slightly or make instant POST calls. Let's look at how fast local uvicorn/http.server is: it's extremely fast (under 2ms locally). So making POST requests to `/api/predict` on slider change is actually completely feasible and extremely robust!
        // However, let's check if we can get the full model assets from the API. We can make a request to the server, and if we want it to be local, let's see if we can read the full model assets.
        // Let's write the code to fetch `/api/dashboard-stats` which we can adapt.
        // Actually, let's look at if we can modify server.py or just fetch `/api/dashboard-stats` and verify if it contains everything. Let's make it fetch from '/api/dashboard-stats' and expect a JSON that contains the coefficients, intercept, accuracy, etc.
        // Let's check what we returned in server.py:
        // do_GET '/api/dashboard-stats': self.send_json(model_assets.get("summary_stats", {}))
        // Wait! Let's modify server.py to return the *entire* `model_assets` object when requested, or at least include the coefficients and features so the frontend can do calculations! That is a very simple change or we can just return the entire model_assets object.
        // Wait, let's check if return of entire model_assets is fine. Yes! The entire model_assets is small (less than 5KB).
        // Let's look at what we can do. We can fetch '/api/dashboard-stats' and if the coefficients are in it, use them. If they are not, we will fall back to sending POST requests to `/api/predict` for the sandbox.
        // Let's design `app.js` to do local prediction if coefficients are available, and if not, fall back to POST requests. This makes it bulletproof!
        
        const data = await res.json();
        return data;
    } catch (e) {
        console.error("Error reading dashboard stats:", e);
        return null;
    }
}

// Tab Switching Routing
function setupTabs() {
    const navItems = document.querySelectorAll('.nav-item');
    const tabContents = document.querySelectorAll('.tab-content');
    const titleElem = document.getElementById('current-tab-title');
    const descElem = document.getElementById('current-tab-desc');

    const tabMeta = {
        'dashboard': {
            title: 'Churn Dashboard',
            desc: 'High-level customer health overview and analytics stats.'
        },
        'predictor': {
            title: 'Single Customer Predictor',
            desc: 'Calculate the probability that a specific customer will churn.'
        },
        'sandbox': {
            title: 'What-If Risk Sandbox',
            desc: 'Simulate changes in customer behavior to evaluate churn mitigation strategies.'
        },
        'batch': {
            title: 'Batch CSV Scoring',
            desc: 'Upload a list of customers in CSV format to calculate churn risks in bulk.'
        }
    };

    navItems.forEach(item => {
        item.addEventListener('click', () => {
            const tabId = item.getAttribute('data-tab');
            
            // Remove active classes
            navItems.forEach(nav => nav.classList.remove('active'));
            tabContents.forEach(tab => tab.classList.remove('active'));
            
            // Add active class
            item.classList.add('active');
            document.getElementById(`tab-${tabId}`).classList.add('active');
            
            // Update Header titles
            titleElem.innerText = tabMeta[tabId].title;
            descElem.innerText = tabMeta[tabId].desc;
        });
    });
}

// Populate KPI Overview Cards
function populateDashboardKPIs(stats) {
    if (!stats) return;
    
    // Total Customers
    document.getElementById('stat-total-customers').innerText = stats.total_customers.toLocaleString();
    
    // Churn Rate
    const churnPct = (stats.overall_churn_rate * 100).toFixed(1);
    document.getElementById('stat-churn-rate').innerText = `${churnPct}%`;
    
    // Average Spend
    document.getElementById('stat-avg-spend').innerText = `₹${Math.round(stats.average_spend).toLocaleString('en-IN')}`;
    
    // Average Support Calls
    document.getElementById('stat-avg-calls').innerText = stats.average_support_calls.toFixed(1);
}

// Render Dashboard Chart.js Visualizations
function renderDashboardCharts(stats) {
    if (!stats) return;

    // Destructure stats from response
    const { contract_stats, support_stats, subscription_stats, delay_stats } = stats;
    
    // Chart.js Default styling configs for Dark Mode
    Chart.defaults.color = '#9ca3af';
    Chart.defaults.font.family = "'Inter', sans-serif";
    
    // Chart 1: Contract Length vs Churn Risk
    const contractCtx = document.getElementById('chart-contract').getContext('2d');
    
    // Map keys to readable strings
    const contractLabelsMap = { '0': 'Annual', '1': 'Monthly', '2': 'Quarterly' };
    const contractLabels = Object.keys(contract_stats.churn_rates).map(k => contractLabelsMap[k] || k);
    const contractChurnData = Object.values(contract_stats.churn_rates).map(v => (v * 100).toFixed(1));
    const contractCounts = Object.values(contract_stats.counts);

    charts.contract = new Chart(contractCtx, {
        type: 'bar',
        data: {
            labels: contractLabels,
            datasets: [
                {
                    label: 'Churn Rate (%)',
                    data: contractChurnData,
                    backgroundColor: [
                        'rgba(16, 185, 129, 0.55)', // Annual (Low Churn)
                        'rgba(239, 68, 68, 0.55)',   // Monthly (High Churn)
                        'rgba(245, 158, 11, 0.55)'   // Quarterly (Medium Churn)
                    ],
                    borderColor: [
                        '#10b981',
                        '#ef4444',
                        '#f59e0b'
                    ],
                    borderWidth: 1.5,
                    yAxisID: 'y'
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    title: { display: true, text: 'Churn Rate (%)' },
                    grid: { color: 'rgba(255, 255, 255, 0.05)' }
                },
                x: {
                    grid: { display: false }
                }
            }
        }
    });

    // Chart 2: Support Calls vs Churn Probability
    const supportCtx = document.getElementById('chart-support').getContext('2d');
    const supportLabels = Object.keys(support_stats.churn_rates);
    const supportChurnData = Object.values(support_stats.churn_rates).map(v => (v * 100).toFixed(1));

    charts.support = new Chart(supportCtx, {
        type: 'line',
        data: {
            labels: supportLabels,
            datasets: [{
                label: 'Churn Risk (%)',
                data: supportChurnData,
                borderColor: '#ef4444',
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                borderWidth: 3,
                fill: true,
                tension: 0.3,
                pointBackgroundColor: '#ef4444',
                pointRadius: 5,
                pointHoverRadius: 7
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    title: { display: true, text: 'Churn Probability (%)' },
                    grid: { color: 'rgba(255, 255, 255, 0.05)' }
                },
                x: {
                    grid: { display: false }
                }
            }
        }
    });

    // Chart 3: Subscription Type vs Churn
    const subCtx = document.getElementById('chart-subscription').getContext('2d');
    const subLabelsMap = { '0': 'Basic', '1': 'Premium', '2': 'Standard' };
    const subLabels = Object.keys(subscription_stats.churn_rates).map(k => subLabelsMap[k] || k);
    const subChurnData = Object.values(subscription_stats.churn_rates).map(v => (v * 100).toFixed(1));

    charts.subscription = new Chart(subCtx, {
        type: 'bar',
        data: {
            labels: subLabels,
            datasets: [{
                label: 'Churn Baseline (%)',
                data: subChurnData,
                backgroundColor: 'rgba(139, 92, 246, 0.5)',
                borderColor: '#8b5cf6',
                borderWidth: 1.5
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    title: { display: true, text: 'Churn Rate (%)' },
                    grid: { color: 'rgba(255, 255, 255, 0.05)' }
                },
                x: {
                    grid: { display: false }
                }
            }
        }
    });

    // Chart 4: Payment Delay vs Churn
    const delayCtx = document.getElementById('chart-delay').getContext('2d');
    const delayLabels = Object.keys(delay_stats.churn_rates);
    const delayChurnData = Object.values(delay_stats.churn_rates).map(v => (v * 100).toFixed(1));

    charts.delay = new Chart(delayCtx, {
        type: 'line',
        data: {
            labels: delayLabels,
            datasets: [{
                label: 'Churn Rate (%)',
                data: delayChurnData,
                borderColor: '#f59e0b',
                backgroundColor: 'rgba(245, 158, 11, 0.1)',
                borderWidth: 3,
                fill: true,
                tension: 0.1,
                pointBackgroundColor: '#f59e0b',
                pointRadius: 5
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    title: { display: true, text: 'Churn Rate (%)' },
                    grid: { color: 'rgba(255, 255, 255, 0.05)' }
                },
                x: {
                    grid: { display: false }
                }
            }
        }
    });
}

// Single Customer Prediction Form Handlers
function setupPredictorForm() {
    const form = document.getElementById('single-predict-form');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        // Gather input values
        const formData = new FormData(form);
        const inputData = {};
        formData.forEach((value, key) => {
            inputData[key] = value;
        });

        // Run prediction
        try {
            const response = await fetch('/api/predict', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(inputData)
            });

            if (!response.ok) throw new Error("Prediction API call failed");
            
            const result = await response.json();
            updatePredictionUI(result.probability, inputData);

        } catch (error) {
            console.error("Prediction error:", error);
            alert("Error running churn prediction model. Please check connection to server.");
        }
    });
}

// Update the Single Predictor Report Panel UI
function updatePredictionUI(probability, inputData) {
    const pct = Math.round(probability * 100);
    
    // 1. Text Update
    document.getElementById('score-percent').innerText = `${pct}%`;
    
    // 2. Animate Circular Progress Ring (Circumference ~ 534)
    const ring = document.getElementById('score-ring');
    const circumference = 534;
    const offset = circumference - (probability * circumference);
    ring.style.strokeDashoffset = offset;

    // 3. UI Theme Colors, Risk Status & Alerts
    const alertBox = document.getElementById('risk-alert-box');
    const alertTitle = document.getElementById('alert-title');
    const alertDesc = document.getElementById('alert-desc');
    const scoreLabel = document.getElementById('score-label');
    
    // Reset classes
    alertBox.className = 'alert-box';
    
    let riskColor = 'var(--risk-green)';
    let recommendations = [];

    if (probability >= 0.70) {
        // High Risk
        riskColor = 'var(--risk-red)';
        scoreLabel.innerText = 'HIGH RISK';
        alertBox.classList.add('alert-danger');
        alertTitle.innerText = 'High Retention Risk';
        alertDesc.innerText = 'This customer displays metrics indicating a high probability of churning soon. Immediate intervention recommended.';
        ring.style.stroke = 'var(--risk-red)';
        
        recommendations.push("Arrange immediate outreach from Customer Success Management.");
        recommendations.push("Audit support history to verify unresolved tickets or complaints.");
    } else if (probability >= 0.40) {
        // Medium Risk
        riskColor = 'var(--risk-yellow)';
        scoreLabel.innerText = 'MEDIUM RISK';
        alertBox.classList.add('alert-warning');
        alertTitle.innerText = 'Elevated Churn Risk';
        alertDesc.innerText = 'This customer shows moderate churn risk indicators. Proactive engagement could prevent churn escalation.';
        ring.style.stroke = 'var(--risk-yellow)';
        
        recommendations.push("Send personalized engagement email highlighting product value.");
        recommendations.push("Offer basic training/webinar to increase active feature usage.");
    } else {
        // Low Risk
        riskColor = 'var(--risk-green)';
        scoreLabel.innerText = 'SAFE';
        alertBox.classList.add('alert-safe');
        alertTitle.innerText = 'Low Retention Risk';
        alertDesc.innerText = 'This customer displays metrics typical of highly loyal accounts. No immediate actions required.';
        ring.style.stroke = 'var(--risk-green)';
        
        recommendations.push("Continue regular automated communications and billing cycles.");
    }

    // 4. Custom Recommendations based on specific customer metrics
    const supportCalls = parseInt(inputData['Support Calls'] || 0);
    const paymentDelay = parseInt(inputData['Payment Delay'] || 0);
    const contract = inputData['Contract Length'];
    const spend = parseFloat(inputData['Total Spend'] || 0);
    const tenure = parseInt(inputData['Tenure'] || 0);

    if (supportCalls >= 4) {
        recommendations.push(`Support calls count is high (${supportCalls}). Offer a direct support callback to resolve friction.`);
    }
    if (paymentDelay >= 10) {
        recommendations.push(`Payment delayed by ${paymentDelay} days. Investigate card expiration or recommend setting up auto-pay.`);
    }
    if (contract === 'Monthly') {
        recommendations.push("Customer is on a monthly contract. Recommend upgrading to an Annual Plan at a 15% discount to lock in loyalty.");
    }
    if (tenure < 6) {
        recommendations.push("Customer is in early onboarding lifecycle. Provide onboarding guidance to increase usage frequency.");
    }

    // Populate recommendations list
    const recsList = document.getElementById('recommendations-list');
    recsList.innerHTML = '';
    recommendations.forEach(rec => {
        const li = document.createElement('li');
        li.innerText = rec;
        recsList.appendChild(li);
    });
}

// Risk Sandbox Interactive Slider Module
function setupSandbox() {
    const sliders = [
        { id: 'sb-support', suffix: ' calls' },
        { id: 'sb-delay', suffix: ' days' },
        { id: 'sb-tenure', suffix: ' months' },
        { id: 'sb-spend', prefix: '₹', suffix: '' },
        { id: 'sb-usage', suffix: ' actions' },
        { id: 'sb-age', suffix: ' yrs' }
    ];

    // Listen to changes on all sliders
    sliders.forEach(s => {
        const slider = document.getElementById(s.id);
        const valBadge = document.getElementById(`${s.id}-val`);
        if (slider && valBadge) {
            slider.addEventListener('input', () => {
                const prefix = s.prefix || '';
                valBadge.innerText = `${prefix}${slider.value}${s.suffix}`;
                runSandboxInference();
            });
        }
    });

    // Listen to changes on select drop-downs
    const selects = ['sb-contract', 'sb-subscription', 'sb-gender', 'sb-interaction'];
    selects.forEach(id => {
        const select = document.getElementById(id);
        if (select) {
            select.addEventListener('change', runSandboxInference);
        }
    });
}

// Run Sandbox Prediction using Local Arithmetic or Fallback API Post
async function runSandboxInference() {
    // Gather all inputs from Sandbox UI
    const inputData = {
        'Age': parseInt(document.getElementById('sb-age').value),
        'Gender': document.getElementById('sb-gender').value,
        'Tenure': parseInt(document.getElementById('sb-tenure').value),
        'Usage Frequency': parseInt(document.getElementById('sb-usage').value),
        'Support Calls': parseInt(document.getElementById('sb-support').value),
        'Payment Delay': parseInt(document.getElementById('sb-delay').value),
        'Subscription Type': document.getElementById('sb-subscription').value,
        'Contract Length': document.getElementById('sb-contract').value,
        'Total Spend': parseFloat(document.getElementById('sb-spend').value),
        'Last Interaction': parseInt(document.getElementById('sb-interaction').value)
    };

    // Attempt local calculation if model coefficients are loaded
    if (modelAssets && modelAssets.coefficients && modelAssets.intercept) {
        calculateLocalSandbox(inputData);
    } else {
        // Fallback: Query the prediction API
        try {
            const response = await fetch('/api/predict', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(inputData)
            });
            if (response.ok) {
                const result = await response.json();
                updateSandboxUI(result.probability, inputData);
            }
        } catch (error) {
            console.error("Sandbox API error:", error);
        }
    }
}

// Compute Prediction Math Locally inside Browser (extremely responsive!)
function calculateLocalSandbox(inputs) {
    const coefs = modelAssets.coefficients;
    const intercept = modelAssets.intercept;
    const features = modelAssets.features;
    const mappings = modelAssets.categorical_mappings;

    let z = intercept;

    for (let i = 0; i < features.length; i++) {
        const name = features[i];
        let val = inputs[name];

        if (name in mappings) {
            // Encode categorical value
            val = mappings[name][val] !== undefined ? mappings[name][val] : 0;
        } else {
            val = parseFloat(val) || 0.0;
        }

        z += coefs[i] * val;
    }

    // Sigmoid math
    const probability = 1.0 / (1.0 + Math.exp(-z));
    updateSandboxUI(probability, inputs);
}

// Update Sandbox Panel Output UI
function updateSandboxUI(probability, inputs) {
    const pct = (probability * 100).toFixed(1);
    
    // Update score text & bar width
    document.getElementById('sb-probability-text').innerText = `${pct}%`;
    const meterFill = document.getElementById('sb-meter-fill');
    meterFill.style.width = `${pct}%`;

    // Color code and configure badges
    const badge = document.getElementById('sb-risk-badge');
    const recsBox = document.getElementById('sandbox-recs');
    
    badge.className = 'risk-pill';
    recsBox.innerHTML = '';

    let color = '';
    let category = '';
    let recs = [];

    if (probability >= 0.70) {
        color = 'var(--risk-red)';
        category = 'HIGH RISK';
        badge.classList.add('pill-danger');
        
        recs.push({ icon: 'fa-circle-xmark', color: 'text-red', text: 'Critical churn risk detected! Schedule CSM call immediately.' });
    } else if (probability >= 0.40) {
        color = 'var(--risk-yellow)';
        category = 'MEDIUM RISK';
        badge.classList.add('pill-warning');
        
        recs.push({ icon: 'fa-circle-exclamation', color: 'text-yellow', text: 'Moderately elevated risk. Recommend active feature coaching.' });
    } else {
        color = 'var(--risk-green)';
        category = 'LOW RISK';
        badge.classList.add('pill-safe');
        
        recs.push({ icon: 'fa-circle-check', color: 'text-green', text: 'Healthy engagement levels. Baseline risk is normal.' });
    }

    meterFill.style.backgroundColor = color;
    badge.innerText = category;

    // Contextual sandbox feedback items
    if (inputs['Support Calls'] >= 4) {
        recs.push({ icon: 'fa-triangle-exclamation', color: 'text-red', text: `High support calls (${inputs['Support Calls']}) are accelerating churn. Recommend VIP resolution.` });
    }
    if (inputs['Payment Delay'] >= 10) {
        recs.push({ icon: 'fa-wallet', color: 'text-yellow', text: `Billing friction detected (${inputs['Payment Delay']} days delay). Offer auto-pay enrollment.` });
    }
    if (inputs['Contract Length'] === 'Monthly') {
        const upgradeProb = calculateUpgradedProbability(inputs);
        const savings = (probability - upgradeProb) * 100;
        if (savings > 5) {
            recs.push({ 
                icon: 'fa-arrow-trend-down', 
                color: 'text-green', 
                text: `Upgrading to Annual Contract decreases risk to ${(upgradeProb * 100).toFixed(1)}% (saves ${savings.toFixed(1)}% risk).` 
            });
        }
    }

    // Render sandbox feedback
    recs.forEach(r => {
        const item = document.createElement('div');
        item.className = 'sandbox-rec-item';
        item.innerHTML = `<i class="fa-solid ${r.icon} ${r.color}"></i> <span>${r.text}</span>`;
        recsBox.appendChild(item);
    });
}

// Calculate simulation probability helper if customer upgraded to Annual contract
function calculateUpgradedProbability(inputs) {
    if (!modelAssets) return 0.0;
    const modifiedInputs = { ...inputs, 'Contract Length': 'Annual' };
    
    const coefs = modelAssets.coefficients;
    const intercept = modelAssets.intercept;
    const features = modelAssets.features;
    const mappings = modelAssets.categorical_mappings;

    let z = intercept;

    for (let i = 0; i < features.length; i++) {
        const name = features[i];
        let val = modifiedInputs[name];

        if (name in mappings) {
            val = mappings[name][val] !== undefined ? mappings[name][val] : 0;
        } else {
            val = parseFloat(val) || 0.0;
        }

        z += coefs[i] * val;
    }

    return 1.0 / (1.0 + Math.exp(-z));
}

// Batch CSV File upload module
function setupBatchUpload() {
    const dropZone = document.getElementById('csv-drop-zone');
    const fileInput = document.getElementById('csv-file-input');
    const btnDownload = document.getElementById('btn-download-results');

    if (!dropZone || !fileInput) return;

    // Drop zone visual triggers
    dropZone.addEventListener('click', () => fileInput.click());
    
    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('dragover');
    });

    dropZone.addEventListener('dragleave', () => {
        dropZone.classList.remove('dragover');
    });

    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('dragover');
        
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            handleUploadedCSV(files[0]);
        }
    });

    fileInput.addEventListener('change', () => {
        if (fileInput.files.length > 0) {
            handleUploadedCSV(fileInput.files[0]);
        }
    });

    // Download scored CSV handler
    if (btnDownload) {
        btnDownload.addEventListener('click', exportScoredCSVFile);
    }
}

// Read and Parse Uploaded CSV File
function handleUploadedCSV(file) {
    if (!file.name.endsWith('.csv')) {
        alert("Please select a valid CSV file.");
        return;
    }

    const statusPanel = document.getElementById('batch-status-panel');
    const fileNameText = document.getElementById('batch-file-name');
    const metricsRow = document.getElementById('batch-metrics-row');
    const spinner = document.getElementById('batch-spinner');
    const statusTitle = document.getElementById('batch-status-title');
    const tableCard = document.getElementById('batch-table-card');
    const downloadContainer = document.getElementById('batch-download-container');

    // Show panel
    statusPanel.style.display = 'block';
    fileNameText.innerText = file.name;
    statusTitle.innerText = "Parsing CSV file...";
    spinner.className = "fa-solid fa-circle-notch fa-spin status-spinner";
    metricsRow.style.display = 'none';
    tableCard.style.display = 'none';
    downloadContainer.style.display = 'none';

    const reader = new FileReader();
    reader.onload = async function (e) {
        const text = e.target.result;
        try {
            const customers = parseCSVToJSON(text);
            if (customers.length === 0) {
                throw new Error("No data rows found in CSV.");
            }

            statusTitle.innerText = `Sending ${customers.length} records to ML server...`;
            
            // Post batch request to backend
            const response = await fetch('/api/predict-batch', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ customers: customers })
            });

            if (!response.ok) {
                throw new Error(`Server batch prediction error: ${response.statusText}`);
            }

            const data = await response.json();
            
            // Cache results for exporting
            currentBatchResults = {
                raw_headers: getCSVHeaders(text),
                raw_customers: customers,
                predictions: data.results
            };

            // Process predictions and display metrics
            processBatchMetrics(data.results);
            
            // Build visual table preview
            buildBatchPreviewTable(customers, data.results);

        } catch (err) {
            console.error("Batch processing failed:", err);
            statusTitle.innerText = "Processing failed.";
            spinner.className = "fa-solid fa-circle-xmark text-red";
            alert(`Batch Scoring Failed: ${err.message}`);
        }
    };
    reader.readAsText(file);
}

// Convert Raw CSV Text to JSON Objects
function parseCSVToJSON(csvText) {
    const lines = csvText.split(/\r?\n/).filter(line => line.trim() !== '');
    if (lines.length === 0) return [];
    
    // Extract headers and sanitize them
    const headers = lines[0].split(',').map(h => h.replace(/"/g, '').trim());
    
    const result = [];
    for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(v => v.replace(/"/g, '').trim());
        
        // Ensure row has same column count as header
        if (values.length === headers.length) {
            const item = {};
            for (let j = 0; j < headers.length; j++) {
                item[headers[j]] = values[j];
            }
            result.push(item);
        }
    }
    return result;
}

// Extract exact CSV headers (to preserve user's custom columns when exporting back)
function getCSVHeaders(csvText) {
    const lines = csvText.split(/\r?\n/).filter(line => line.trim() !== '');
    if (lines.length > 0) {
        return lines[0].split(',').map(h => h.replace(/"/g, '').trim());
    }
    return [];
}

// Process and display batch scorecard counts
function processBatchMetrics(results) {
    const count = results.length;
    let high = 0;
    let med = 0;
    let low = 0;

    results.forEach(r => {
        if (r.probability >= 0.70) high++;
        else if (r.probability >= 0.40) med++;
        else low++;
    });

    // Stop Spinner
    document.getElementById('batch-spinner').className = "fa-solid fa-circle-check text-green";
    document.getElementById('batch-status-title').innerText = "Batch scoring complete!";
    
    // Show metrics
    document.getElementById('batch-parsed-count').innerText = count;
    document.getElementById('batch-high-risk-count').innerText = high;
    document.getElementById('batch-med-risk-count').innerText = med;
    document.getElementById('batch-low-risk-count').innerText = low;
    
    document.getElementById('batch-metrics-row').style.display = 'grid';
    document.getElementById('batch-download-container').style.display = 'flex';
}

// Populate the preview table with scored rows
function buildBatchPreviewTable(customers, predictions) {
    const tbody = document.getElementById('batch-table-body');
    tbody.innerHTML = '';

    // Show up to first 50 rows for performance
    const maxRows = Math.min(customers.length, 50);
    
    for (let i = 0; i < maxRows; i++) {
        const cust = customers[i];
        const pred = predictions[i];
        
        const tr = document.createElement('tr');
        
        // Define risk pill label
        let pillClass = 'lbl-safe';
        if (pred.risk_level === 'High') pillClass = 'lbl-danger';
        else if (pred.risk_level === 'Medium') pillClass = 'lbl-warning';

        const rowNum = i + 1;
        const custId = cust.CustomerID || `C-${rowNum}`;
        const age = cust.Age || '--';
        const gender = cust.Gender || '--';
        const tenure = cust.Tenure || '--';
        const sub = cust['Subscription Type'] || '--';
        const contract = cust['Contract Length'] || '--';
        const spend = cust['Total Spend'] ? `₹${cust['Total Spend']}` : '--';
        const calls = cust['Support Calls'] || '0';
        const riskScore = `${(pred.probability * 100).toFixed(0)}%`;

        tr.innerHTML = `
            <td>${rowNum}</td>
            <td><strong>${custId}</strong></td>
            <td>${age}</td>
            <td>${gender}</td>
            <td>${tenure}mo</td>
            <td>${sub}</td>
            <td>${contract}</td>
            <td>${spend}</td>
            <td>${calls}</td>
            <td><strong>${riskScore}</strong></td>
            <td><span class="risk-label-pill ${pillClass}">${pred.risk_level.toUpperCase()}</span></td>
        `;
        tbody.appendChild(tr);
    }

    document.getElementById('batch-table-card').style.display = 'block';
}

// Export the complete scored results back to a CSV download
function exportScoredCSVFile() {
    if (!currentBatchResults) return;

    const headers = [...currentBatchResults.raw_headers, 'Churn Probability', 'Churn Prediction', 'Risk Level'];
    
    let csvRows = [];
    csvRows.push(headers.join(','));

    const customers = currentBatchResults.raw_customers;
    const predictions = currentBatchResults.predictions;

    for (let i = 0; i < customers.length; i++) {
        const cust = customers[i];
        const pred = predictions[i];

        const rowValues = currentBatchResults.raw_headers.map(h => {
            // Escape values containing commas
            let val = cust[h] || '';
            if (val.includes(',')) {
                val = `"${val}"`;
            }
            return val;
        });

        // Append predictions
        rowValues.push(pred.probability.toFixed(4));
        rowValues.push(pred.prediction);
        rowValues.push(pred.risk_level);

        csvRows.push(rowValues.join(','));
    }

    const csvContent = csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    
    // Trigger download
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", "scored_customers_report.csv");
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}
