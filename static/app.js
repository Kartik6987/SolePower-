/**
 * SOLEPOWER - Premium Telemetry Application Logic
 * Subject Code: Mini Project - BCC 351
 * Developed By: Gargi Arora & Kartik (CSE 2nd Year)
 * Institution: Dronacharya Group of Institutions (AKTU)
 */

// --- 1. SESSION VERIFICATION & AUTH STATE ---
let currentUser = null;
try {
    const rawUser = localStorage.getItem('solepower_user');
    if (rawUser) {
        currentUser = JSON.parse(rawUser);
        if (currentUser) {
            // Auto-heal / sanitize gender state
            const userIdentity = `${currentUser.email || ''} ${currentUser.name || ''}`.toLowerCase();
            if (userIdentity.includes('gargi') || userIdentity.includes('ananya')) {
                currentUser.gender = 'Female';
            } else if (currentUser.gender && currentUser.gender.toLowerCase() === 'female') {
                currentUser.gender = 'Female';
            } else if (!currentUser.gender) {
                currentUser.gender = 'Male';
            }

            // Guarantee multi-user telemetry isolation
            const isKartik = userIdentity.includes('kartik');
            if (isKartik) {
                currentUser.device_uid = 'SOLEPOWER-01';
            } else if (!currentUser.device_uid || currentUser.device_uid === 'SOLEPOWER-01') {
                if (userIdentity.includes('gargi')) {
                    currentUser.device_uid = 'SOLEPOWER-GARGI';
                } else if (userIdentity.includes('evaluator')) {
                    currentUser.device_uid = 'SOLEPOWER-EVALUATOR';
                } else {
                    const cleanSlug = (currentUser.email || 'USER').split('@')[0].replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 10);
                    currentUser.device_uid = `SOLEPOWER-${cleanSlug}-${currentUser.id || 'U'}`;
                }
            }
            try { localStorage.setItem('solepower_user', JSON.stringify(currentUser)); } catch (e) {}
        }
    }
} catch (e) {
    console.warn("Session parse error:", e);
}

// Helper to reliably compute expected avatar gender from user profile
function getExpectedGender() {
    if (!currentUser) return 'Male';
    const userIdent = `${currentUser.email || ''} ${currentUser.name || ''}`.toLowerCase();
    if (userIdent.includes('gargi') || userIdent.includes('ananya')) {
        return 'Female';
    }
    if (currentUser.gender && currentUser.gender.toLowerCase() === 'female') {
        return 'Female';
    }
    return 'Male';
}

// Route Guard: Redirect to /login if unauthenticated
if (!currentUser) {
    window.location.href = '/login';
}

const API_BASE = window.location.protocol.startsWith("http") ? "" : "http://127.0.0.1:8000";
let DEVICE_UID = (currentUser && currentUser.device_uid) ? currentUser.device_uid : "SOLEPOWER-01";

// Populate User Profile Pill in Navbar
document.addEventListener('DOMContentLoaded', () => {
    if (currentUser) {
        const navAvatar = document.getElementById('nav-user-avatar');
        const navName = document.getElementById('nav-user-name');
        const navRole = document.getElementById('nav-user-role');
        const btnLogout = document.getElementById('btn-logout');

        if (navAvatar && currentUser.avatar_url) navAvatar.src = currentUser.avatar_url;
        if (navName && currentUser.name) {
            const genderBadge = currentUser.gender === 'Female' 
                ? ' <i class="fa-solid fa-venus" style="color: #f43f5e; margin-left: 4px; font-size: 0.82em;" title="Female"></i>' 
                : ' <i class="fa-solid fa-mars" style="color: #06b6d4; margin-left: 4px; font-size: 0.82em;" title="Male"></i>';
            navName.innerHTML = `${currentUser.name}${genderBadge}`;
        }
        if (navRole && currentUser.role) {
            const genderTag = currentUser.gender ? ` â€¢ ${currentUser.gender}` : '';
            navRole.textContent = `${currentUser.role}${genderTag}`;
        }

        if (btnLogout) {
            btnLogout.addEventListener('click', () => {
                localStorage.removeItem('solepower_user');
                localStorage.removeItem('solepower_token');
                window.location.href = '/login?relogin=1';
            });
        }
    }
});

let lastReadingId = 0;
let currentSteps = 0;
let currentJoules = 0.0;
let currentBatteryV = 2.40;
let autoWalkTimer = null;
let chipDecayTimer = null;

// --- 2. DOM ELEMENT SELECTORS ---
const stepCountEl     = document.getElementById('step-count');
const energyYieldEl   = document.getElementById('energy-yield');
const batteryStatusEl = document.getElementById('battery-status');
const chipV           = document.getElementById('chip-v');
const chipI           = document.getElementById('chip-i');
const chipP           = document.getElementById('chip-p');
const simulateBtn     = document.getElementById('simulate-btn');
const autoBtn         = document.getElementById('auto-btn');
const resetBtn        = document.getElementById('reset-btn');
const statusLabel     = document.getElementById('status-label');
const pageTitle       = document.getElementById('page-title');
const pageSubtitle    = document.getElementById('page-subtitle');
const cfgApiUrl       = document.getElementById('cfg-api-url');

// --- 3. CHART.JS REAL-TIME STEPS VS DATE INITIALIZATION ---
const ctx = document.getElementById('generationChart').getContext('2d');

function getInitialDateLabels() {
    const labels = [];
    const now = new Date();
    for (let i = 6; i >= 1; i--) {
        const d = new Date();
        d.setDate(now.getDate() - i);
        labels.push(d.toLocaleDateString('en-US', { month: 'short', day: '2-digit' }));
    }
    const todayStr = now.toLocaleDateString('en-US', { month: 'short', day: '2-digit' });
    labels.push(`${todayStr} (Today)`);
    return labels;
}

const generationChart = new Chart(ctx, {
    type: 'bar',
    data: {
        labels: getInitialDateLabels(),
        datasets: [{
            label: 'Daily Footsteps',
            data: [4280, 5620, 3950, 6140, 5380, 7290, 0],
            backgroundColor: [
                'rgba(6, 182, 212, 0.45)',
                'rgba(6, 182, 212, 0.45)',
                'rgba(6, 182, 212, 0.45)',
                'rgba(6, 182, 212, 0.45)',
                'rgba(6, 182, 212, 0.45)',
                'rgba(6, 182, 212, 0.45)',
                'rgba(16, 185, 129, 0.85)'
            ],
            borderColor: [
                'rgba(6, 182, 212, 0.9)',
                'rgba(6, 182, 212, 0.9)',
                'rgba(6, 182, 212, 0.9)',
                'rgba(6, 182, 212, 0.9)',
                'rgba(6, 182, 212, 0.9)',
                'rgba(6, 182, 212, 0.9)',
                '#10b981'
            ],
            borderWidth: 1.5,
            borderRadius: 8,
            borderSkipped: false,
            maxBarThickness: 42
        }]
    },
    options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 350 },
        plugins: {
            legend: { display: false },
            tooltip: {
                backgroundColor: 'rgba(15, 23, 42, 0.95)',
                titleFont: { family: 'Space Grotesk', size: 13, weight: 'bold' },
                bodyFont: { family: 'Plus Jakarta Sans', size: 12 },
                borderColor: 'rgba(6, 182, 212, 0.4)',
                borderWidth: 1,
                padding: 12,
                displayColors: false,
                callbacks: {
                    title: (items) => {
                        const item = items[0];
                        return `Date: ${item.label}`;
                    },
                    label: (context) => {
                        const steps = context.parsed.y;
                        const energyJoules = ((steps * 5.5) / 1000).toFixed(2);
                        return [
                            `Daily Cadence: ${steps.toLocaleString()} steps`,
                            `Harvested Energy: ~${energyJoules} J`,
                            `Gait Status: ${steps >= 5000 ? 'Target Reached (Active)' : 'Goal In Progress'}`
                        ];
                    }
                }
            }
        },
        scales: {
            y: {
                beginAtZero: true,
                grid: { color: 'rgba(255, 255, 255, 0.05)' },
                ticks: {
                    color: '#94a3b8',
                    font: { family: 'Space Grotesk', size: 11, weight: '600' },
                    callback: (val) => val >= 1000 ? (val / 1000).toFixed(1) + 'k' : val
                }
            },
            x: {
                grid: { display: false },
                ticks: {
                    color: '#cbd5e1',
                    font: { family: 'Plus Jakarta Sans', size: 11, weight: '700' }
                }
            }
        }
    }
});

// Helper: Calculate supercapacitor percentage from steps and storage voltage
// Starts at 35.0% baseline: 10 steps = +0.1% battery increase (0.01% per step)
function calcBatteryPct(voltage, stepsCount) {
    if (stepsCount !== undefined && stepsCount !== null && stepsCount >= 0) {
        const pct = Math.min(100.0, 35.0 + (stepsCount * 0.01));
        return pct.toFixed(1);
    }
    if (!voltage || voltage <= 2.40) return "35.0";
    const pct = Math.min(100.0, Math.max(35.0, 35.0 + ((voltage - 2.40) * 50.0)));
    return pct.toFixed(1);
}

// Helper: Format timestamp to readable time string
function formatTimestamp(isoString) {
    if (!isoString) return '';
    const d = new Date(isoString);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

// Helper: Dynamically update Today's step bar on the Steps vs Date chart
function updateTodayStepsChart(todaySteps) {
    if (!generationChart || !generationChart.data.datasets.length) return;
    const dataArr = generationChart.data.datasets[0].data;
    if (dataArr.length > 0) {
        const todayIndex = dataArr.length - 1;
        dataArr[todayIndex] = todaySteps;
        generationChart.update('none');
    }
}

// --- 4. LOAD RECENT TELEMETRY HISTORY INTO CHART (STEPS VS DATE) ---
async function loadChartHistory() {
    try {
        const res = await fetch(`${API_BASE}/api/analytics/daily_steps?device_uid=${DEVICE_UID}`);
        if (!res.ok) return;

        const data = await res.json();
        if (data && data.days && data.days.length > 0) {
            generationChart.data.labels = data.days.map(d => d.is_today ? `${d.date} (Today)` : d.date);
            generationChart.data.datasets[0].data = data.days.map(d => d.steps);
            generationChart.data.datasets[0].backgroundColor = data.days.map(d => d.is_today ? 'rgba(16, 185, 129, 0.85)' : 'rgba(6, 182, 212, 0.45)');
            generationChart.data.datasets[0].borderColor = data.days.map(d => d.is_today ? '#10b981' : 'rgba(6, 182, 212, 0.9)');
            generationChart.update();
        }
    } catch (err) {
        console.warn("Could not load daily steps chart:", err);
    }
}

// --- 5. VISUAL PULSE & TELEMETRY DISPLAY ---
function renderSensorImpulse(voltage, current, power) {
    chipV.textContent = voltage.toFixed(2);
    chipI.textContent = current.toFixed(1);
    chipP.textContent = power.toFixed(1);

    // Add visual impulse highlight to hardware chips
    document.querySelectorAll('.chip').forEach(c => {
        c.style.borderColor = 'rgba(6, 182, 212, 0.7)';
        c.style.boxShadow = '0 0 15px rgba(6, 182, 212, 0.25)';
    });

    // Animate Foot Insole SVG Discs & Transducer Cards in rolling heel-to-toe gait strike
    const discWave = [
        ['disc-live-heel', 'disc-heel', 'card-p1', 0],
        ['disc-live-arch', 'disc-arch', 'card-p2', 80],
        ['disc-live-ball', 'disc-ball', 'card-p3', 160],
        ['disc-live-toe', 'disc-toe', 'card-p4', 240]
    ];
    discWave.forEach(([liveId, stimId, cardId, delay]) => {
        setTimeout(() => {
            const elLive = document.getElementById(liveId);
            const elStim = document.getElementById(stimId);
            const card = document.getElementById(cardId);
            if (elLive) { elLive.classList.add('active-pulse'); setTimeout(() => elLive.classList.remove('active-pulse'), 500); }
            if (elStim) { elStim.classList.add('active-pulse'); setTimeout(() => elStim.classList.remove('active-pulse'), 500); }
            if (card) { card.classList.add('pulse-highlight'); setTimeout(() => card.classList.remove('pulse-highlight'), 600); }
        }, delay);
    });

    // Update Live Transducer Distribution Cards (P1 60%, P2 15%, P3 20%, P4 5%)
    const p1Volt = document.getElementById('card-p1-volt');
    const p1Curr = document.getElementById('card-p1-curr');
    const p2Volt = document.getElementById('card-p2-volt');
    const p2Curr = document.getElementById('card-p2-curr');
    const p3Volt = document.getElementById('card-p3-volt');
    const p3Curr = document.getElementById('card-p3-curr');
    const p4Volt = document.getElementById('card-p4-volt');
    const p4Curr = document.getElementById('card-p4-curr');

    if (p1Volt) p1Volt.textContent = `${(voltage * 0.95).toFixed(2)} V`;
    if (p1Curr) p1Curr.textContent = `${(current * 0.60).toFixed(1)} mA`;
    if (p2Volt) p2Volt.textContent = `${(voltage * 0.35).toFixed(2)} V`;
    if (p2Curr) p2Curr.textContent = `${(current * 0.15).toFixed(1)} mA`;
    if (p3Volt) p3Volt.textContent = `${(voltage * 0.50).toFixed(2)} V`;
    if (p3Curr) p3Curr.textContent = `${(current * 0.20).toFixed(1)} mA`;
    if (p4Volt) p4Volt.textContent = `${(voltage * 0.20).toFixed(2)} V`;
    if (p4Curr) p4Curr.textContent = `${(current * 0.05).toFixed(1)} mA`;

    if (chipDecayTimer) clearTimeout(chipDecayTimer);
    chipDecayTimer = setTimeout(() => {
        chipV.textContent = "0.00";
        chipI.textContent = "0.0";
        chipP.textContent = "0.0";
        document.querySelectorAll('.chip').forEach(c => {
            c.style.borderColor = '';
            c.style.boxShadow = '';
        });
    }, 700);
}

// --- 6. FETCH ANALYTICS SUMMARY (DATABASE SOURCE OF TRUTH) ---
async function fetchAnalyticsSummary() {
    try {
        const res = await fetch(`${API_BASE}/api/analytics/summary?device_uid=${DEVICE_UID}`);
        if (!res.ok) return;

        const s = await res.json();
        currentSteps = s.total_steps;
        currentJoules = s.total_energy_joules;
        currentBatteryV = s.current_battery_voltage || 2.40;

        // Update main dashboard metrics
        stepCountEl.textContent = s.total_steps.toLocaleString();
        energyYieldEl.innerHTML = `${s.total_energy_joules.toFixed(2)} <span class="unit-text">J</span>`;
        batteryStatusEl.innerHTML = `${calcBatteryPct(currentBatteryV, s.total_steps)}<span class="unit-text">%</span>`;

        // Update Analytics Tab elements if visible
        const elPeakP = document.getElementById('analytics-peak-p');
        const elAvgP  = document.getElementById('analytics-avg-p');
        const elGaugeP = document.getElementById('analytics-gauge-p');
        const elReadings = document.getElementById('analytics-total-readings');
        const elJoules = document.getElementById('analytics-joules');
        const elMwh    = document.getElementById('analytics-mwh');
        const elStorageEff = document.getElementById('analytics-storage-eff');
        const elPerStep = document.getElementById('analytics-per-step');

        if (elPeakP) elPeakP.textContent = s.total_readings > 0 ? s.peak_power_mw.toFixed(1) : "0.0";
        if (elAvgP)  elAvgP.textContent = s.total_readings > 0 ? s.avg_power_mw.toFixed(1) : "0.0";
        if (elGaugeP) elGaugeP.textContent = s.total_readings > 0 ? s.avg_power_mw.toFixed(1) : "0.0";
        if (elReadings) elReadings.textContent = s.total_readings.toLocaleString();
        if (elJoules) elJoules.textContent = s.total_readings > 0 ? `${s.total_energy_joules.toFixed(4)} J` : "0.0000 J";
        if (elMwh) elMwh.textContent = s.total_readings > 0 ? `${(s.total_energy_joules * 0.2778).toFixed(4)} mWh` : "0.0000 mWh";
        
        const perStepMj = s.total_steps > 0 ? ((s.total_energy_joules * 1000) / s.total_steps) : 0.0;
        if (elPerStep) elPerStep.textContent = `${perStepMj.toFixed(2)} mJ`;
        if (elStorageEff) elStorageEff.textContent = s.total_steps > 0 ? `87.4%` : `0.0%`;

        // Update Gauge Arc Path
        const gaugeArc = document.getElementById('gauge-arc-path');
        if (gaugeArc) {
            const ratio = Math.min(1.0, (s.avg_power_mw || 0) / 50.0);
            const offset = 220 - (ratio * 155);
            gaugeArc.style.strokeDashoffset = s.total_readings > 0 ? offset : 220;
        }

        // Update Breakdown Progress Bars
        const barToday = document.getElementById('bar-energy-today');
        const barTotal = document.getElementById('bar-energy-total');
        const barEff   = document.getElementById('bar-storage-eff');
        const barStep  = document.getElementById('bar-energy-step');
        if (barToday) barToday.style.width = s.total_steps > 0 ? `${Math.min(100, (s.total_steps / 500) * 100)}%` : '0%';
        if (barTotal) barTotal.style.width = s.total_energy_joules > 0 ? `${Math.min(100, (s.total_energy_joules / 0.1) * 100)}%` : '0%';
        if (barEff) barEff.style.width = s.total_steps > 0 ? '87.4%' : '0%';
        if (barStep) barStep.style.width = s.total_steps > 0 ? '32%' : '0%';

        if (statusLabel) statusLabel.textContent = "FastAPI & DB Synced";
    } catch (err) {
        console.warn("Analytics fetch error:", err);
    }
}

// Global Chart instance for Energy Conversion Trend
let analyticsTrendChartInstance = null;

function initAnalyticsTrendChart() {
    const canvas = document.getElementById('analyticsTrendChart');
    if (!canvas) return;
    if (analyticsTrendChartInstance) {
        analyticsTrendChartInstance.destroy();
    }

    const ctx = canvas.getContext('2d');
    const gradient = ctx.createLinearGradient(0, 0, 0, 220);
    gradient.addColorStop(0, 'rgba(6, 182, 212, 0.45)');
    gradient.addColorStop(0.6, 'rgba(6, 182, 212, 0.15)');
    gradient.addColorStop(1, 'rgba(6, 182, 212, 0.0)');

    analyticsTrendChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: ['12AM', '4AM', '8AM', '12PM', '4PM', '8PM', '12AM'],
            datasets: [{
                label: 'Power Yield (mW)',
                data: [18, 24, 21, 28, 40.5, 31, 23],
                borderColor: '#06b6d4',
                borderWidth: 2.5,
                backgroundColor: gradient,
                fill: true,
                tension: 0.4,
                pointBackgroundColor: '#06b6d4',
                pointBorderColor: '#ffffff',
                pointBorderWidth: 2,
                pointRadius: [4, 4, 4, 4, 7, 4, 4],
                pointHoverRadius: 8
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: (c) => ` ${c.parsed.y} mW`
                    }
                }
            },
            scales: {
                x: {
                    grid: { color: 'rgba(255, 255, 255, 0.05)' },
                    ticks: { color: '#94a3b8', font: { size: 11, weight: '600' } }
                },
                y: {
                    min: 0,
                    max: 50,
                    grid: { color: 'rgba(255, 255, 255, 0.05)' },
                    ticks: { color: '#94a3b8', stepSize: 10, font: { size: 11, weight: '600' } }
                }
            }
        }
    });
}

// --- 7. REAL-TIME POLLING FOR EXTERNAL PACKETS (ESP32 / SIMULATOR) ---
async function pollLatestTelemetry() {
    try {
        const res = await fetch(`${API_BASE}/api/readings/latest?device_uid=${DEVICE_UID}`);
        if (!res.ok) return;

        const reading = await res.json();
        
        if (lastReadingId === 0) {
            // Initial sync on page load
            lastReadingId = reading.id;
        } else if (reading.id > lastReadingId) {
            // New telemetry packet arrived from ESP32 or Simulator!
            lastReadingId = reading.id;
            renderSensorImpulse(reading.voltage, reading.current_ma, reading.power_mw);
            updateTodayStepsChart(reading.steps);
            pulseInsoleDisc('all');
            stepCountEl.textContent = reading.steps.toLocaleString();
            batteryStatusEl.innerHTML = `${calcBatteryPct(reading.battery_voltage, reading.steps)}<span class="unit-text">%</span>`;
            fetchAnalyticsSummary();
        }
    } catch (err) {
        // Silent catch during periodic polling
    }
}

// --- 8. STEP SIMULATION ENGINE (WEB INTERFACE TRIGGER) ---
async function registerStepImpact() {
    currentSteps += 1;
    
    // Simulate kinetic heel strike physics (calibrated to real PZT piezo output under load):
    const voltageSpike = parseFloat((Math.random() * 1.3 + 2.6).toFixed(2));   // 2.6V - 3.9V rectified pulse
    const currentSpike = parseFloat((Math.random() * 7.0 + 4.0).toFixed(1));   // 4.0mA - 11.0mA harvested
    
    // Supercapacitor accumulation: 10 steps = +0.1% battery increase (+0.0002V storage increase)
    currentBatteryV = Math.min(3.70, 2.40 + (currentSteps * 0.0002));
    const batteryPct = calcBatteryPct(currentBatteryV, currentSteps);

    // Immediately update UI metrics for snappy response
    stepCountEl.textContent = currentSteps.toLocaleString();
    batteryStatusEl.innerHTML = `${batteryPct}<span class="unit-text">%</span>`;
    renderSensorImpulse(voltageSpike, currentSpike, voltageSpike * currentSpike);
    updateTodayStepsChart(currentSteps);
    pulseInsoleDisc('all');

    // Push packet to FastAPI backend
    try {
        const payload = {
            device_uid: DEVICE_UID,
            voltage: voltageSpike,
            current_ma: currentSpike,
            battery_voltage: parseFloat(currentBatteryV.toFixed(4)),
            steps: currentSteps
        };

        const res = await fetch(`${API_BASE}/api/readings`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });

        if (res.ok) {
            const saved = await res.json();
            lastReadingId = saved.id;
            updateTodayStepsChart(saved.steps);
            fetchAnalyticsSummary();
        }
    } catch (err) {
        console.warn("Backend step push notice:", err.message);
    }
}

// Auto Walk Simulation Toggle
function toggleAutoWalk() {
    if (autoWalkTimer) {
        clearInterval(autoWalkTimer);
        autoWalkTimer = null;
        autoBtn.innerHTML = `<i class="fa-solid fa-person-walking"></i> Auto Walk Simulation`;
        autoBtn.style.background = "linear-gradient(135deg, #0ea5e9, #6366f1)";
        autoBtn.style.boxShadow = "0 4px 20px rgba(99, 102, 241, 0.2)";
    } else {
        registerStepImpact();
        autoWalkTimer = setInterval(registerStepImpact, 1400);
        autoBtn.innerHTML = `<i class="fa-solid fa-circle-stop"></i> Stop Walk Simulation`;
        autoBtn.style.background = "linear-gradient(135deg, #f43f5e, #e11d48)";
        autoBtn.style.boxShadow = "0 4px 20px rgba(244, 63, 94, 0.35)";
    }
}

// --- 9. EVENT LISTENERS ---
if (simulateBtn) simulateBtn.addEventListener('click', registerStepImpact);
if (autoBtn) autoBtn.addEventListener('click', toggleAutoWalk);

if (resetBtn) {
    resetBtn.addEventListener('click', async () => {
        if (autoWalkTimer) toggleAutoWalk();

        try {
            await fetch(`${API_BASE}/api/reset?device_uid=${DEVICE_UID}`, { method: "POST" });
            lastReadingId = 0;
            currentSteps = 0;
            currentJoules = 0.0;
            currentBatteryV = 2.40;

            stepCountEl.textContent = '0';
            energyYieldEl.innerHTML = `0.00 <span class="unit-text">J</span>`;
            batteryStatusEl.innerHTML = `35.0<span class="unit-text">%</span>`;
            chipV.textContent = "0.00";
            chipI.textContent = "0.0";
            chipP.textContent = "0.0";

            updateTodayStepsChart(0);

            if (statusLabel) statusLabel.textContent = "Session Reset (PostgreSQL Ready)";
            loadHistoryTable();
            fetchAnalyticsSummary();
        } catch (e) {
            console.warn("Backend reset error:", e);
        }
    });
}

// --- 10. TAB NAVIGATION CONTROLLER ---
const tabTitles = {
    "view-monitor": {
        title: "System Dashboard",
        subtitle: "Dynamic energy harvesting tracking matrix."
    },
    "view-analytics": {
        title: "Energy Harvest Analytics",
        subtitle: "Comprehensive mathematical conversion and power yields."
    },
    "view-stimulation": {
        title: "Model Stimulation",
        subtitle: "Biomechanical gait simulation, insole pressure heatmap & kinetic stress matrix."
    },
    "view-history": {
        title: "PostgreSQL Telemetry Log",
        subtitle: "Permanent historical records saved in database solepower_db."
    },
    "view-config": {
        title: "Hardware & Matrix Config",
        subtitle: "Sole transducer calibration and endpoint parameters."
    }
};

document.querySelectorAll('.sidebar-menu a').forEach(link => {
    link.addEventListener('click', (e) => {
        e.preventDefault();

        // 1. Update active sidebar item
        document.querySelectorAll('.sidebar-menu a').forEach(el => el.classList.remove('active'));
        link.classList.add('active');

        // 2. Hide all tab views and show the selected one
        const targetTabId = link.getAttribute('data-tab');
        document.querySelectorAll('.tab-view').forEach(view => view.classList.remove('active'));
        
        const targetView = document.getElementById(targetTabId);
        if (targetView) {
            targetView.classList.add('active');
        }

        // 3. Update Title & Subtitle
        if (tabTitles[targetTabId]) {
            pageTitle.textContent = tabTitles[targetTabId].title;
            pageSubtitle.textContent = tabTitles[targetTabId].subtitle;
        }

        // 4. Trigger specific tab loaders
        if (targetTabId === 'view-history') {
            loadHistoryTable();
        } else if (targetTabId === 'view-analytics') {
            fetchAnalyticsSummary();
            setTimeout(initAnalyticsTrendChart, 80);
        } else if (targetTabId === 'view-stimulation') {
            updateStimulationMetrics();
            if (!isThreeInitialized) {
                setTimeout(init3DInsole, 80);
            } else {
                setTimeout(onWindowResize3D, 80);
            }
        }
    });
});

// --- 11. LOAD HISTORY LOG FROM POSTGRESQL ---
async function loadHistoryTable() {
    const tableBody = document.getElementById('history-table-body');
    if (!tableBody) return;

    tableBody.innerHTML = `<tr><td colspan="8" class="text-center"><i class="fa-solid fa-spinner fa-spin"></i> Loading records from PostgreSQL...</td></tr>`;

    try {
        const res = await fetch(`${API_BASE}/api/readings/history?device_uid=${DEVICE_UID}&limit=30`);
        if (!res.ok) throw new Error("Could not fetch history records");

        const records = await res.json();

        if (!records || records.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="8" class="text-center">No telemetry records found in PostgreSQL yet. Click "Simulate Single Step" or turn on "Auto Walk"!</td></tr>`;
            return;
        }

        // Reverse to show newest records on top
        const reversed = [...records].reverse();

        tableBody.innerHTML = reversed.map(r => {
            const date = new Date(r.timestamp);
            const timeStr = date.toLocaleTimeString() + ' (' + date.toLocaleDateString() + ')';
            return `
                <tr>
                    <td><strong>#${r.id}</strong></td>
                    <td>${timeStr}</td>
                    <td><span style="color: #06b6d4;">${r.device_uid}</span></td>
                    <td>${r.voltage.toFixed(2)} V</td>
                    <td>${r.current_ma.toFixed(1)} mA</td>
                    <td><strong style="color: #10b981;">${r.power_mw.toFixed(1)} mW</strong></td>
                    <td>${r.battery_voltage.toFixed(2)} V</td>
                    <td>${r.steps}</td>
                </tr>
            `;
        }).join('');

    } catch (err) {
        console.error("Error loading table:", err);
        tableBody.innerHTML = `<tr><td colspan="8" class="text-center" style="color: #f43f5e;">Error loading PostgreSQL data: ${err.message}</td></tr>`;
    }
}

// Set target endpoint & device UID display in hardware config tab
const cfgDevUidEl = document.getElementById('cfg-device-uid');
if (cfgDevUidEl) {
    cfgDevUidEl.value = DEVICE_UID;
}
if (cfgApiUrl) {
    const host = window.location.host || "127.0.0.1:8000";
    cfgApiUrl.value = `http://${host}/api/readings`;
}

// --- 12. BOOTSTRAP SYSTEM ---
loadChartHistory();
fetchAnalyticsSummary();
loadHistoryTable();

// Background Poller: Checks for new packets every 1.2 seconds
setInterval(pollLatestTelemetry, 1200);

// ============================================================
// --- 13. MODEL STIMULATION CONTROLLER ---
// ============================================================
let simWeight = 68;       // kg
let simGaitMult = 1.2;     // Casual walk multiplier
let simCadence = 90;       // SPM
let stimContinuousTimer = null;

// DOM Elements
const stimForceEl       = document.getElementById('stim-force');
const stimStressEl      = document.getElementById('stim-stress');
const stimPowerEl       = document.getElementById('stim-power');
const sliderWeight      = document.getElementById('slider-weight');
const valWeight         = document.getElementById('val-weight');
const sliderCadence     = document.getElementById('slider-cadence');
const valCadence        = document.getElementById('val-cadence');
const projDailyJoules   = document.getElementById('proj-daily-joules');
const projEfficiency    = document.getElementById('proj-efficiency');
const projChargeTime    = document.getElementById('proj-charge-time');
const btnStimulateOnce  = document.getElementById('btn-stimulate-once');
const btnStimulateLoop  = document.getElementById('btn-stimulate-loop');

function updateStimulationMetrics() {
    // Dynamic Ground Reaction Force: F = mass * g * gait_multiplier
    const forceN = simWeight * 9.81 * simGaitMult;
    // Mechanical Stress: sigma = F / Area (Approx 78 cm2 contact area) in kPa
    const stressKpa = forceN / 7.8;
    // Expected electrical power from transducer array: P = k * F
    const powerMw = Math.min(55.0, Math.max(18.0, 18.0 + ((forceN - 500) / 1500) * 32.0));

    if (stimForceEl) stimForceEl.innerHTML = `${Math.round(forceN)} <span class="unit-text">N</span>`;
    if (stimStressEl) stimStressEl.innerHTML = `${stressKpa.toFixed(1)} <span class="unit-text">kPa</span>`;
    if (stimPowerEl) stimPowerEl.innerHTML = `${powerMw.toFixed(1)} <span class="unit-text">mW</span>`;

    // Mathematical projections:
    const energyPerStepJ = (powerMw / 1000.0) * 0.15; // 150ms impulse
    const dailyJoules = 5000 * energyPerStepJ;
    const stepsToFull = Math.round(4.85 / energyPerStepJ); // 4.85 Joules full 1.0F capacitor

    if (projDailyJoules) projDailyJoules.textContent = `${dailyJoules.toFixed(1)} J`;
    if (projChargeTime) projChargeTime.textContent = `~${stepsToFull} steps`;
    if (projEfficiency) {
        const eff = Math.min(18.0, 12.0 + (simGaitMult * 1.5));
        projEfficiency.textContent = `${eff.toFixed(1)}%`;
    }

    // Dynamic Transducer Load Distributions on P1-P4 Cards
    const baseV = 2.4 + (forceN / 2000) * 1.2;
    // P1: Heel (60% load)
    const p1V = (baseV * 1.0).toFixed(2);
    const p1I = ((powerMw * 0.60) / parseFloat(p1V)).toFixed(1);
    const elP1V = document.getElementById('card-p1-volt');
    const elP1I = document.getElementById('card-p1-curr');
    if (elP1V) elP1V.textContent = `${p1V} V`;
    if (elP1I) elP1I.textContent = `${p1I} mA`;

    // P2: Arch (15% load)
    const p2V = (baseV * 0.45).toFixed(2);
    const p2I = ((powerMw * 0.15) / parseFloat(p2V)).toFixed(1);
    const elP2V = document.getElementById('card-p2-volt');
    const elP2I = document.getElementById('card-p2-curr');
    if (elP2V) elP2V.textContent = `${p2V} V`;
    if (elP2I) elP2I.textContent = `${p2I} mA`;

    // P3: Ball of Foot (20% load)
    const p3V = (baseV * 0.60).toFixed(2);
    const p3I = ((powerMw * 0.20) / parseFloat(p3V)).toFixed(1);
    const elP3V = document.getElementById('card-p3-volt');
    const elP3I = document.getElementById('card-p3-curr');
    if (elP3V) elP3V.textContent = `${p3V} V`;
    if (elP3I) elP3I.textContent = `${p3I} mA`;

    // P4: Toe (5% load)
    const p4V = (baseV * 0.25).toFixed(2);
    const p4I = ((powerMw * 0.05) / parseFloat(p4V)).toFixed(1);
    const elP4V = document.getElementById('card-p4-volt');
    const elP4I = document.getElementById('card-p4-curr');
    if (elP4V) elP4V.textContent = `${p4V} V`;
    if (elP4I) elP4I.textContent = `${p4I} mA`;
}

// Function to trigger animated pressure pulse on foot insole discs and cards
function pulseInsoleDisc(zone) {
    if (typeof pulse3DInsoleDisc === 'function') {
        pulse3DInsoleDisc(zone);
    }

    const discIds = {
        heel: 'disc-heel',
        arch: 'disc-arch',
        ball: 'disc-ball',
        toe: 'disc-toe'
    };

    if (zone === 'all') {
        // Natural heel-to-toe gait strike roll:
        const discSequence = ['disc-heel', 'disc-arch', 'disc-ball', 'disc-toe'];
        discSequence.forEach((id, idx) => {
            setTimeout(() => {
                const el = document.getElementById(id);
                if (el) {
                    el.classList.add('active-pulse');
                    setTimeout(() => el.classList.remove('active-pulse'), 500);
                }
                const cardEl = document.getElementById(`card-p${idx + 1}`);
                if (cardEl) {
                    cardEl.classList.add('pulse-highlight');
                    setTimeout(() => cardEl.classList.remove('pulse-highlight'), 500);
                }
            }, idx * 75);
        });
    } else if (discIds[zone]) {
        const el = document.getElementById(discIds[zone]);
        if (el) {
            el.classList.add('active-pulse');
            setTimeout(() => el.classList.remove('active-pulse'), 500);
        }
        const zoneIdx = zone === 'heel' ? 1 : zone === 'arch' ? 2 : zone === 'ball' ? 3 : 4;
        const cardEl = document.getElementById(`card-p${zoneIdx}`);
        if (cardEl) {
            cardEl.classList.add('pulse-highlight');
            setTimeout(() => cardEl.classList.remove('pulse-highlight'), 500);
        }
    }
}

// Core execution: Stimulate mechanical model & push live telemetry
async function executeModelStimulation(zone = 'all') {
    pulseInsoleDisc(zone);

    // Compute dynamic physics values based on active sliders & gait mode:
    const forceN = simWeight * 9.81 * simGaitMult;
    const powerMw = Math.min(55.0, Math.max(18.0, 18.0 + ((forceN - 500) / 1500) * 32.0));
    
    // Scale voltage and current realistically:
    const volt = parseFloat((2.6 + (forceN / 2000) * 1.2 + (Math.random() * 0.2)).toFixed(2));
    const curr = parseFloat((powerMw / volt).toFixed(1));

    currentSteps += 1;
    currentBatteryV = Math.min(3.70, 2.40 + (currentSteps * 0.0002));
    const batteryPct = calcBatteryPct(currentBatteryV, currentSteps);

    // Update Live UI immediately
    stepCountEl.textContent = currentSteps.toLocaleString();
    batteryStatusEl.innerHTML = `${batteryPct}<span class="unit-text">%</span>`;
    renderSensorImpulse(volt, curr, volt * curr);

    // Send to FastAPI & PostgreSQL
    try {
        const payload = {
            device_uid: DEVICE_UID,
            voltage: volt,
            current_ma: curr,
            battery_voltage: parseFloat(currentBatteryV.toFixed(4)),
            steps: currentSteps
        };

        const res = await fetch(`${API_BASE}/api/readings`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });

        if (res.ok) {
            const saved = await res.json();
            lastReadingId = saved.id;
            updateTodayStepsChart(saved.steps);
            fetchAnalyticsSummary();
        }
    } catch (err) {
        console.warn("Model stimulation push notice:", err.message);
    }
}

// Interactive Gait Mode Pills Binding
document.querySelectorAll('.gait-pill').forEach(pill => {
    pill.addEventListener('click', () => {
        document.querySelectorAll('.gait-pill').forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        simGaitMult = parseFloat(pill.getAttribute('data-mult')) || 1.2;
        updateStimulationMetrics();
    });
});

// Interactive Weight Slider Binding
if (sliderWeight && valWeight) {
    sliderWeight.addEventListener('input', (e) => {
        simWeight = parseInt(e.target.value);
        valWeight.textContent = `${simWeight} kg`;
        updateStimulationMetrics();
    });
}

// Interactive Cadence Slider Binding
if (sliderCadence && valCadence) {
    sliderCadence.addEventListener('input', (e) => {
        simCadence = parseInt(e.target.value);
        valCadence.textContent = `${simCadence} SPM`;
        if (stimContinuousTimer) {
            // Restart loop with new cadence
            clearInterval(stimContinuousTimer);
            stimContinuousTimer = setInterval(() => executeModelStimulation('all'), Math.round(60000 / simCadence));
        }
    });
}

// Interactive Clicking on Insole SVG Discs & Cards in Model Stimulation
['heel', 'arch', 'ball', 'toe'].forEach(zone => {
    const disc = document.getElementById(`disc-${zone}`);
    if (disc) {
        disc.addEventListener('click', () => executeModelStimulation(zone));
    }

    const zoneIdx = zone === 'heel' ? 1 : zone === 'arch' ? 2 : zone === 'ball' ? 3 : 4;
    const card = document.getElementById(`card-p${zoneIdx}`);
    if (card) {
        card.addEventListener('click', () => executeModelStimulation(zone));
    }
});

// Single Impulse Stimulation Button
if (btnStimulateOnce) {
    btnStimulateOnce.addEventListener('click', () => executeModelStimulation('all'));
}

// Continuous Gait Stimulation Loop Toggle
if (btnStimulateLoop) {
    btnStimulateLoop.addEventListener('click', () => {
        if (stimContinuousTimer) {
            clearInterval(stimContinuousTimer);
            stimContinuousTimer = null;
            btnStimulateLoop.innerHTML = `<i class="fa-solid fa-play"></i> Continuous Gait Stimulation`;
            btnStimulateLoop.style.background = "linear-gradient(135deg, #10b981, #06b6d4)";
            btnStimulateLoop.style.boxShadow = "0 4px 20px rgba(16, 185, 129, 0.25)";
        } else {
            executeModelStimulation('all');
            stimContinuousTimer = setInterval(() => executeModelStimulation('all'), Math.round(60000 / simCadence));
            btnStimulateLoop.innerHTML = `<i class="fa-solid fa-circle-stop"></i> Stop Gait Stimulation`;
            btnStimulateLoop.style.background = "linear-gradient(135deg, #f43f5e, #e11d48)";
            btnStimulateLoop.style.boxShadow = "0 4px 20px rgba(244, 63, 94, 0.35)";
        }
    });
}

// Initialize Model Stimulation Metrics
updateStimulationMetrics();

// ============================================================
// --- 14. THREE.JS 3D FOOT INSOLE PRESSURE VISUALIZER ENGINE ---
// ============================================================
let insoleScene = null;
let insoleCamera = null;
let insoleRenderer = null;
let insoleControls = null;
let insoleGroup = null;
let isThreeInitialized = false;
let autoRotateActive = false;
let currentViewMode = '3d'; // '3d' or '2d'

// 3D Objects map for real-time manipulation
const threeDiscs = {};        // { heel, arch, ball, toe }
const threeExtrusions = {};   // { heel, arch, ball, toe }
const threeRipples = {};      // { heel, arch, ball, toe }
const threeMaterials = {};    // { heel, arch, ball, toe }

// Transducer specs for physical 3D positioning on the sole
const PZT_3D_ZONES = {
    heel: {
        name: "Heel (P1)",
        loadPct: 60,
        pos: { x: 0.05, y: -2.35, z: 0.22 },
        radius: 0.65,
        baseColor: 0xf43f5e,
        hexStr: "#f43f5e",
        label: "P1 HEEL (60%)"
    },
    arch: {
        name: "Arch (P2)",
        loadPct: 15,
        pos: { x: 0.72, y: -0.55, z: 0.22 },
        radius: 0.42,
        baseColor: 0xf59e0b,
        hexStr: "#f59e0b",
        label: "P2 ARCH (15%)"
    },
    ball: {
        name: "Ball of Foot (P3)",
        loadPct: 20,
        pos: { x: -0.28, y: 1.45, z: 0.22 },
        radius: 0.54,
        baseColor: 0x06b6d4,
        hexStr: "#06b6d4",
        label: "P3 BALL (20%)"
    },
    toe: {
        name: "Toe (P4)",
        loadPct: 5,
        pos: { x: 0.38, y: 2.85, z: 0.22 },
        radius: 0.36,
        baseColor: 0x10b981,
        hexStr: "#10b981",
        label: "P4 TOE (5%)"
    }
};

function init3DInsole() {
    const container = document.getElementById('insole-3d-container');
    if (!container || isThreeInitialized || typeof THREE === 'undefined') return;

    const width = container.clientWidth || 320;
    const height = container.clientHeight || 380;

    // 1. Scene
    insoleScene = new THREE.Scene();

    // 2. Camera (Perspective Angle)
    insoleCamera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    insoleCamera.position.set(4.5, -6.5, 7.5);

    // 3. WebGL Renderer
    insoleRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
    insoleRenderer.setSize(width, height);
    insoleRenderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    insoleRenderer.shadowMap.enabled = true;
    insoleRenderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(insoleRenderer.domElement);

    // 4. OrbitControls
    if (typeof THREE.OrbitControls !== 'undefined') {
        insoleControls = new THREE.OrbitControls(insoleCamera, insoleRenderer.domElement);
        insoleControls.enableDamping = true;
        insoleControls.dampingFactor = 0.06;
        insoleControls.maxDistance = 22;
        insoleControls.minDistance = 3.5;
        insoleControls.target.set(0, 0, 0);
    }

    // 5. Lighting Setup (Cyberpunk Scientific Laboratory Rig)
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.75);
    insoleScene.add(ambientLight);

    const keyLight = new THREE.DirectionalLight(0x38bdf8, 1.2);
    keyLight.position.set(6, 8, 9);
    insoleScene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0xf43f5e, 0.8);
    rimLight.position.set(-6, -8, 5);
    insoleScene.add(rimLight);

    const centerPointLight = new THREE.PointLight(0x06b6d4, 1.2, 12);
    centerPointLight.position.set(0, 0, 3.5);
    insoleScene.add(centerPointLight);

    // Holographic Cyberpunk Test Grid
    const gridHelper = new THREE.GridHelper(14, 14, 0x06b6d4, 0x1e293b);
    gridHelper.rotation.x = Math.PI / 2;
    gridHelper.position.z = -1.2;
    insoleScene.add(gridHelper);

    // 6. Insole Group Assembly
    insoleGroup = new THREE.Group();
    insoleScene.add(insoleGroup);

    // Build anatomical insole sole
    build3DInsoleMesh();

    // Build 4 physical PZT Transducers with 3D heightmaps & ripples
    build3DTransducers();

    // Build 3D Copper Circuit traces
    build3DCopperTraces();

    // Setup interactive raycasting (hover & click)
    setup3DInteraction(container);

    // Setup Camera toolbar buttons & view mode toggles
    setup3DToolbar();

    isThreeInitialized = true;

    // Start render loop
    requestAnimationFrame(render3DLoop);
}

function build3DInsoleMesh() {
    const shape = new THREE.Shape();
    // Anatomical contour of human foot right insole
    shape.moveTo(0, -3.4);
    // Medial heel to arch (inward curvature)
    shape.bezierCurveTo(1.1, -3.4, 1.4, -2.4, 1.3, -1.2);
    // Arch to metatarsal ball (widening out)
    shape.bezierCurveTo(1.2, 0.0, 1.6, 1.4, 1.7, 2.3);
    // Ball to Hallux (big toe)
    shape.bezierCurveTo(1.7, 3.1, 1.1, 3.8, 0.3, 3.9);
    // Across toes to small toe
    shape.bezierCurveTo(-0.4, 3.9, -1.1, 3.5, -1.4, 2.7);
    // Down lateral edge (straighter outer edge)
    shape.bezierCurveTo(-1.6, 1.8, -1.5, 0.5, -1.4, -0.8);
    // Lateral edge to lateral heel
    shape.bezierCurveTo(-1.4, -2.0, -1.3, -3.0, -0.9, -3.3);
    shape.bezierCurveTo(-0.6, -3.4, -0.3, -3.4, 0, -3.4);

    const extrudeSettings = {
        steps: 2,
        depth: 0.38,
        bevelEnabled: true,
        bevelThickness: 0.12,
        bevelSize: 0.1,
        bevelOffset: 0,
        bevelSegments: 4
    };

    const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
    geometry.center();

    // Premium translucent carbon silicone material
    const soleMaterial = new THREE.MeshPhysicalMaterial({
        color: 0x0a1124,
        emissive: 0x061930,
        emissiveIntensity: 0.45,
        metalness: 0.3,
        roughness: 0.25,
        clearcoat: 0.8,
        clearcoatRoughness: 0.2,
        transparent: true,
        opacity: 0.88,
        reflectivity: 0.9
    });

    const soleMesh = new THREE.Mesh(geometry, soleMaterial);
    insoleGroup.add(soleMesh);

    // Glowing contour edge wireframe
    const edges = new THREE.EdgesGeometry(geometry, 28);
    const lineMat = new THREE.LineBasicMaterial({
        color: 0x06b6d4,
        transparent: true,
        opacity: 0.35
    });
    const wireframe = new THREE.LineSegments(edges, lineMat);
    insoleGroup.add(wireframe);
}

function build3DTransducers() {
    Object.keys(PZT_3D_ZONES).forEach(zoneKey => {
        const spec = PZT_3D_ZONES[zoneKey];
        const discGroup = new THREE.Group();
        discGroup.position.set(spec.pos.x, spec.pos.y, spec.pos.z);
        discGroup.userData = { zone: zoneKey, spec: spec };

        // 1. Brass Base Shim (Metallic Gold Disc)
        const brassGeo = new THREE.CylinderGeometry(spec.radius, spec.radius, 0.04, 32);
        brassGeo.rotateX(Math.PI / 2);
        const brassMat = new THREE.MeshStandardMaterial({
            color: 0xd97706,
            metalness: 0.85,
            roughness: 0.25
        });
        const brassMesh = new THREE.Mesh(brassGeo, brassMat);
        discGroup.add(brassMesh);

        // 2. PZT Piezo Ceramic Disc (Center Core)
        const ceramicGeo = new THREE.CylinderGeometry(spec.radius * 0.72, spec.radius * 0.72, 0.06, 32);
        ceramicGeo.rotateX(Math.PI / 2);
        const ceramicMat = new THREE.MeshStandardMaterial({
            color: 0xffffff,
            emissive: spec.baseColor,
            emissiveIntensity: 0.35,
            metalness: 0.2,
            roughness: 0.35
        });
        const ceramicMesh = new THREE.Mesh(ceramicGeo, ceramicMat);
        ceramicMesh.position.z = 0.03;
        discGroup.add(ceramicMesh);
        threeDiscs[zoneKey] = ceramicMesh;
        threeMaterials[zoneKey] = ceramicMat;

        // 3. 3D Kinetic Pressure Deformation Extrusion Column
        // Extrudes upwards along Z when pressure is applied!
        const colGeo = new THREE.CylinderGeometry(spec.radius * 0.8, spec.radius * 0.8, 1, 32);
        colGeo.rotateX(Math.PI / 2);
        colGeo.translate(0, 0, 0.5); // Pivot at bottom surface
        const colMat = new THREE.MeshPhysicalMaterial({
            color: spec.baseColor,
            emissive: spec.baseColor,
            emissiveIntensity: 0.5,
            transparent: true,
            opacity: 0.45,
            roughness: 0.2,
            metalness: 0.1
        });
        const colMesh = new THREE.Mesh(colGeo, colMat);
        colMesh.position.z = 0.05;
        colMesh.scale.set(1, 1, 0.08); // resting baseline height
        discGroup.add(colMesh);
        threeExtrusions[zoneKey] = colMesh;

        // 4. Kinetic Shockwave Ripple Ring (Expands on footstep impact)
        const ringGeo = new THREE.RingGeometry(spec.radius * 0.95, spec.radius * 1.15, 32);
        const ringMat = new THREE.MeshBasicMaterial({
            color: spec.baseColor,
            transparent: true,
            opacity: 0.0,
            side: THREE.DoubleSide
        });
        const ringMesh = new THREE.Mesh(ringGeo, ringMat);
        ringMesh.position.z = 0.06;
        discGroup.add(ringMesh);
        threeRipples[zoneKey] = ringMesh;

        // 5. Floating Text Badge / Canvas Sprite
        const sprite = createTextSprite(spec.label, spec.hexStr);
        sprite.position.set(0, 0, 0.55);
        discGroup.add(sprite);

        insoleGroup.add(discGroup);
    });
}

function drawRoundedRectCustom(ctx, x, y, width, height, radius) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
}

function createTextSprite(text, colorStr) {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
    ctx.strokeStyle = colorStr;
    ctx.lineWidth = 3;
    drawRoundedRectCustom(ctx, 4, 4, 248, 56, 12);
    ctx.fill();
    ctx.stroke();

    ctx.font = 'bold 24px "Space Grotesk", sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 128, 32);

    const texture = new THREE.CanvasTexture(canvas);
    const spriteMaterial = new THREE.SpriteMaterial({ map: texture, transparent: true });
    const sprite = new THREE.Sprite(spriteMaterial);
    sprite.scale.set(1.4, 0.35, 1);
    return sprite;
}

function build3DCopperTraces() {
    const points = [
        new THREE.Vector3(0.05, -2.35, 0.24), // Heel
        new THREE.Vector3(0, -1.0, 0.24),
        new THREE.Vector3(0.72, -0.55, 0.24), // Arch
        new THREE.Vector3(0, 0.5, 0.24),
        new THREE.Vector3(-0.28, 1.45, 0.24), // Ball
        new THREE.Vector3(0.1, 2.2, 0.24),
        new THREE.Vector3(0.38, 2.85, 0.24)   // Toe
    ];
    const traceGeo = new THREE.BufferGeometry().setFromPoints(points);
    const traceMat = new THREE.LineDashedMaterial({
        color: 0x06b6d4,
        dashSize: 0.15,
        gapSize: 0.08,
        linewidth: 2,
        transparent: true,
        opacity: 0.5
    });
    const traceLine = new THREE.Line(traceGeo, traceMat);
    traceLine.computeLineDistances();
    insoleGroup.add(traceLine);
}

// 3D Mouse Interaction (Hover tooltip + Click trigger)
function setup3DInteraction(container) {
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    const tooltipEl = document.getElementById('insole-3d-tooltip');

    container.addEventListener('mousemove', (e) => {
        const rect = container.getBoundingClientRect();
        mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        mouse.y = -(((e.clientY - rect.top) / rect.height) * 2 - 1);

        if (!insoleCamera || !insoleScene) return;
        raycaster.setFromCamera(mouse, insoleCamera);

        const targets = Object.values(threeDiscs);
        const intersects = raycaster.intersectObjects(targets, false);

        if (intersects.length > 0) {
            container.style.cursor = 'pointer';
            const hitMesh = intersects[0].object;
            const parentGroup = hitMesh.parent;
            if (parentGroup && parentGroup.userData && parentGroup.userData.spec) {
                const spec = parentGroup.userData.spec;
                if (tooltipEl) {
                    tooltipEl.style.display = 'block';
                    tooltipEl.style.left = `${e.clientX - rect.left}px`;
                    tooltipEl.style.top = `${e.clientY - rect.top}px`;
                    tooltipEl.innerHTML = `<strong>${spec.name}</strong> â€¢ ${spec.loadPct}% Load Zone<br><span style="color: #06b6d4;">Click to stimulate pressure impulse</span>`;
                }
            }
        } else {
            container.style.cursor = 'grab';
            if (tooltipEl) tooltipEl.style.display = 'none';
        }
    });

    container.addEventListener('click', (e) => {
        const rect = container.getBoundingClientRect();
        mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        mouse.y = -(((e.clientY - rect.top) / rect.height) * 2 - 1);

        if (!insoleCamera) return;
        raycaster.setFromCamera(mouse, insoleCamera);
        const targets = Object.values(threeDiscs);
        const intersects = raycaster.intersectObjects(targets, false);

        if (intersects.length > 0) {
            const hitMesh = intersects[0].object;
            const parentGroup = hitMesh.parent;
            if (parentGroup && parentGroup.userData && parentGroup.userData.zone) {
                const zone = parentGroup.userData.zone;
                executeModelStimulation(zone);
            }
        }
    });

    container.addEventListener('mouseleave', () => {
        if (tooltipEl) tooltipEl.style.display = 'none';
    });
}

// 3D Toolbar Buttons (Presets & Dual View Switcher)
function setup3DToolbar() {
    const btnIso = document.getElementById('btn-cam-iso');
    const btnTop = document.getElementById('btn-cam-top');
    const btnBottom = document.getElementById('btn-cam-bottom');
    const btnRotate = document.getElementById('btn-cam-rotate');
    const btnReset = document.getElementById('btn-cam-reset');
    const btnMode3D = document.getElementById('btn-mode-3d');
    const btnModeWalker = document.getElementById('btn-mode-walker');
    const btnMode2D = document.getElementById('btn-mode-2d');

    const pills = [btnIso, btnTop, btnBottom];
    function setActivePill(activeBtn) {
        pills.forEach(p => p && p.classList.remove('active'));
        if (activeBtn) activeBtn.classList.add('active');
    }

    if (btnIso) {
        btnIso.addEventListener('click', () => {
            setActivePill(btnIso);
            animateCameraPosition(4.5, -6.5, 7.5);
        });
    }

    if (btnTop) {
        btnTop.addEventListener('click', () => {
            setActivePill(btnTop);
            animateCameraPosition(0, 0.01, 10.5);
        });
    }

    if (btnBottom) {
        btnBottom.addEventListener('click', () => {
            setActivePill(btnBottom);
            animateCameraPosition(0, -0.01, -10.5);
        });
    }

    if (btnRotate) {
        btnRotate.addEventListener('click', () => {
            autoRotateActive = !autoRotateActive;
            btnRotate.classList.toggle('active', autoRotateActive);
        });
    }

    if (btnReset) {
        btnReset.addEventListener('click', () => {
            setActivePill(btnIso);
            autoRotateActive = false;
            if (btnRotate) btnRotate.classList.remove('active');
            if (insoleGroup) {
                insoleGroup.rotation.set(0, 0, 0);
            }
            animateCameraPosition(4.5, -6.5, 7.5);
        });
    }

    // 3-Way Mode Switcher: 3D Shoe Insole vs 3D Human Gait Walker vs 2D Schematic
    function switchVisualizerMode(mode) {
        currentViewMode = mode;
        const tbInsole = document.getElementById('insole-3d-toolbar');
        const c3d = document.getElementById('insole-3d-container');
        const cWalker = document.getElementById('insole-walker-container');
        const c2d = document.getElementById('insole-2d-container');

        if (btnMode3D) btnMode3D.classList.toggle('active', mode === '3d');
        if (btnModeWalker) btnModeWalker.classList.toggle('active', mode === 'walker');
        if (btnMode2D) btnMode2D.classList.toggle('active', mode === '2d');

        if (mode === '3d') {
            if (tbInsole) tbInsole.style.display = 'flex';
            if (c3d) c3d.style.display = 'block';
            if (cWalker) cWalker.style.display = 'none';
            if (c2d) c2d.style.display = 'none';
            setTimeout(onWindowResize3D, 50);
        } else if (mode === 'walker') {
            if (tbInsole) tbInsole.style.display = 'none';
            if (c3d) c3d.style.display = 'none';
            if (cWalker) cWalker.style.display = 'block';
            if (c2d) c2d.style.display = 'none';
            if (!isWalkerInitialized) {
                init3DWalker();
            } else {
                syncWalkerGender();
            }
            setTimeout(onWindowResizeWalker, 50);
        } else if (mode === '2d') {
            if (tbInsole) tbInsole.style.display = 'none';
            if (c3d) c3d.style.display = 'none';
            if (cWalker) cWalker.style.display = 'none';
            if (c2d) c2d.style.display = 'flex';
        }
    }

    if (btnMode3D) btnMode3D.addEventListener('click', () => switchVisualizerMode('3d'));
    if (btnModeWalker) btnModeWalker.addEventListener('click', () => switchVisualizerMode('walker'));
    if (btnMode2D) btnMode2D.addEventListener('click', () => switchVisualizerMode('2d'));
}

// Smooth Camera Transition Helper
function animateCameraPosition(targetX, targetY, targetZ, durationMs = 450) {
    if (!insoleCamera || !insoleControls) return;
    const startPos = insoleCamera.position.clone();
    const targetPos = new THREE.Vector3(targetX, targetY, targetZ);
    const startTime = performance.now();

    function step(now) {
        const elapsed = now - startTime;
        const progress = Math.min(elapsed / durationMs, 1.0);
        const ease = 1 - Math.pow(1 - progress, 3);
        insoleCamera.position.lerpVectors(startPos, targetPos, ease);
        insoleControls.target.set(0, 0, 0);
        insoleControls.update();

        if (progress < 1.0) {
            requestAnimationFrame(step);
        }
    }
    requestAnimationFrame(step);
}

// Dynamic 3D Pressure Pulse & Kinetic Deformation Animation
function pulse3DInsoleDisc(zone) {
    if (!isThreeInitialized) return;

    if (zone === 'all') {
        const seq = ['heel', 'arch', 'ball', 'toe'];
        seq.forEach((z, idx) => {
            setTimeout(() => triggerSingleZone3D(z), idx * 85);
        });
    } else if (PZT_3D_ZONES[zone]) {
        triggerSingleZone3D(zone);
    }
}

function triggerSingleZone3D(zone) {
    const col = threeExtrusions[zone];
    const mat = threeMaterials[zone];
    const rip = threeRipples[zone];
    const spec = PZT_3D_ZONES[zone];
    if (!col || !mat) return;

    // 1. Emissive glow flash
    mat.emissiveIntensity = 2.0;
    setTimeout(() => {
        mat.emissiveIntensity = 0.35;
    }, 380);

    // 2. 3D Vertical Pressure Displacement (Heightmap Extrusion)
    const targetHeight = 0.35 + (spec.loadPct / 60) * 1.6;
    col.scale.z = targetHeight;
    col.material.opacity = 0.85;

    // Smooth relaxation back to rest
    setTimeout(() => {
        let decStep = 0;
        const decTimer = setInterval(() => {
            decStep += 1;
            col.scale.z = THREE.MathUtils.lerp(col.scale.z, 0.08, 0.25);
            col.material.opacity = THREE.MathUtils.lerp(col.material.opacity, 0.45, 0.25);
            if (decStep >= 12) {
                clearInterval(decTimer);
                col.scale.z = 0.08;
                col.material.opacity = 0.45;
            }
        }, 30);
    }, 120);

    // 3. Shockwave Expanding Ripple
    if (rip) {
        rip.scale.set(1.0, 1.0, 1.0);
        rip.material.opacity = 0.9;
        let ripProgress = 0;
        const ripTimer = setInterval(() => {
            ripProgress += 0.08;
            const s = 1.0 + ripProgress * 2.2;
            rip.scale.set(s, s, 1.0);
            rip.material.opacity = Math.max(0, 0.9 - ripProgress * 1.1);
            if (ripProgress >= 1.0) {
                clearInterval(ripTimer);
                rip.material.opacity = 0;
                rip.scale.set(1, 1, 1);
            }
        }, 25);
    }
}

// 3D Render & Animation Loop
function render3DLoop() {
    requestAnimationFrame(render3DLoop);

    if (insoleControls) insoleControls.update();

    if (autoRotateActive && insoleGroup) {
        insoleGroup.rotation.z += 0.007;
    }

    if (insoleRenderer && insoleScene && insoleCamera && currentViewMode === '3d') {
        insoleRenderer.render(insoleScene, insoleCamera);
    }
}

// Resize handler
function onWindowResize3D() {
    const container = document.getElementById('insole-3d-container');
    if (!container || !insoleRenderer || !insoleCamera) return;

    const width = container.clientWidth;
    const height = container.clientHeight || 380;
    if (width === 0 || height === 0) return;

    insoleCamera.aspect = width / height;
    insoleCamera.updateProjectionMatrix();
    insoleRenderer.setSize(width, height);
}

window.addEventListener('resize', onWindowResize3D);

// Auto-initialize 3D Insole if element is present
if (document.getElementById('insole-3d-container')) {
    setTimeout(init3DInsole, 200);
}


// ====================================================================
// --- 15. THREE.JS 3D BIOMECHANICAL HUMAN GAIT WALKER VISUALIZER ENGINE ---
// ====================================================================

let walkerScene = null;
let walkerCamera = null;
let walkerRenderer = null;
let walkerControls = null;
let isWalkerInitialized = false;
let walkerAutoRotate = false;

let walkerGender = 'Male'; // 'Male' or 'Female'
let walkerPaceSpeed = 0.95;
let simulatedBodyMass = 68;
let simulatedCadence = 90;
let simulatedGaitPace = 'casual';
let simulatedGaitMultiplier = 1.0;
let isGaitSimulationPaused = false;
let transducerFrameCounter = 0;
let walkerGaitCycle = 0.0;
let walkerStridesTotal = 0;
let walkerClock = null;

let walkerCharacterGroup = null;
let walkerPelvis = null;
let walkerPelvisBaseY = 1.62;
let walkerChest = null;
let walkerHead = null;
let wPonytail = null;

// Joints
let wLeftHip = null;
let wLeftKnee = null;
let wLeftAnkle = null;
let wLeftPiezoMesh = null;
let wLeftPiezoLight = null;

let wRightHip = null;
let wRightKnee = null;
let wRightAnkle = null;
let wRightPiezoMesh = null;
let wRightPiezoLight = null;

let wLeftShoulder = null;
let wLeftElbow = null;
let wRightShoulder = null;
let wRightElbow = null;

let wTreadmillGrid = null;
let wArrowGroup = null;
let wStaircaseGroup = null;
let wStairSteps = [];
let walkerShockwaves = [];
let walkerLastLeftContact = false;
let walkerLastRightContact = false;

function init3DWalker() {
    const mount = document.getElementById('walker-three-canvas');
    if (!mount || isWalkerInitialized || typeof THREE === 'undefined') return;

    const width = mount.clientWidth || 600;
    const height = mount.clientHeight || 420;

    // 1. Scene & Clock
    walkerScene = new THREE.Scene();
    walkerScene.fog = new THREE.FogExp2(0x0a0f1d, 0.045);
    walkerClock = new THREE.Clock();

    // 2. Camera
    walkerCamera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    walkerCamera.position.set(3.6, 2.1, 4.4);

    // 3. WebGL Renderer
    walkerRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
    walkerRenderer.setSize(width, height);
    walkerRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    walkerRenderer.shadowMap.enabled = true;
    walkerRenderer.shadowMap.type = THREE.PCFSoftShadowMap;
    mount.appendChild(walkerRenderer.domElement);

    // 4. OrbitControls
    if (typeof THREE.OrbitControls !== 'undefined') {
        walkerControls = new THREE.OrbitControls(walkerCamera, walkerRenderer.domElement);
        walkerControls.enableDamping = true;
        walkerControls.dampingFactor = 0.08;
        walkerControls.minDistance = 1.6;
        walkerControls.maxDistance = 9.5;
        walkerControls.maxPolarAngle = Math.PI / 2 + 0.08; // Don't flip below ground
        walkerControls.target.set(0, 1.35, 0);
        walkerControls.update();
    }

    // 5. Lighting Setup
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.60);
    walkerScene.add(ambientLight);

    const keyLight = new THREE.DirectionalLight(0x38bdf8, 1.4);
    keyLight.position.set(4, 8, 5);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.width = 1024;
    keyLight.shadow.mapSize.height = 1024;
    keyLight.shadow.bias = -0.001;
    walkerScene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0xffedd5, 0.45);
    fillLight.position.set(-3, 4, 4);
    walkerScene.add(fillLight);

    const rimLight = new THREE.DirectionalLight(0xf43f5e, 1.1);
    rimLight.position.set(-5, 4, -4);
    walkerScene.add(rimLight);

    const bottomGlow = new THREE.PointLight(0x06b6d4, 0.8, 8);
    bottomGlow.position.set(0, 0.2, 0);
    walkerScene.add(bottomGlow);

    // 6. Holographic Treadmill Grid Floor & Contact Shadow
    wTreadmillGrid = new THREE.GridHelper(16, 32, 0x06b6d4, 0x1e293b);
    wTreadmillGrid.position.y = 0;
    walkerScene.add(wTreadmillGrid);

    // Ground Contact Shadow under runner
    const contactShadowGeo = new THREE.PlaneGeometry(1.5, 2.4);
    const contactShadowMat = new THREE.MeshBasicMaterial({ color: 0x020617, transparent: true, opacity: 0.55 });
    const contactShadow = new THREE.Mesh(contactShadowGeo, contactShadowMat);
    contactShadow.rotation.x = -Math.PI / 2;
    contactShadow.position.y = 0.005;
    walkerScene.add(contactShadow);

    // Ground circular platform / halo
    const haloGeo = new THREE.RingGeometry(0.2, 2.6, 48);
    const haloMat = new THREE.MeshBasicMaterial({ color: 0x06b6d4, transparent: true, opacity: 0.18, side: THREE.DoubleSide });
    const haloMesh = new THREE.Mesh(haloGeo, haloMat);
    haloMesh.rotation.x = -Math.PI / 2;
    haloMesh.position.y = 0.01;
    walkerScene.add(haloMesh);

    // Forward Runway Track Arrows (Points in direction of runner motion: +Z)
    const arrowGroup = new THREE.Group();
    for (let c = -2; c <= 2; c++) {
        const arrowGeo = new THREE.ConeGeometry(0.10, 0.24, 3);
        const arrowMat = new THREE.MeshBasicMaterial({ color: 0x06b6d4, transparent: true, opacity: 0.25 });
        const arrow = new THREE.Mesh(arrowGeo, arrowMat);
        arrow.rotation.x = -Math.PI / 2; // Cone points toward +Z (Forward)
        arrow.position.set(0, 0.012, c * 1.1);
        arrowGroup.add(arrow);
    }
    walkerScene.add(arrowGroup);
    wArrowGroup = arrowGroup;

    // 7. 3D Holographic Kinetic Staircase for Incline & Stair Climbing Mode
    create3DStaircase();

    // 8. Strict Gender selection locked from logged-in user profile
    walkerGender = getExpectedGender();

    // 9. Build Avatar Body strictly corresponding to user profile
    buildHumanoidAvatar(walkerGender);
    updateWalkerProfileBadge();

    // 10. Setup Walker Toolbar Event Listeners
    setupWalkerToolbarControls();

    isWalkerInitialized = true;

    // 11. Start Animation Loop
    animate3DWalker();
}

// Builds the 3D Holographic Kinetic Staircase for Incline & Stair Climbing Simulation
function create3DStaircase() {
    if (!walkerScene) return;

    // Clean up existing staircase if any
    if (wStaircaseGroup) {
        walkerScene.remove(wStaircaseGroup);
        wStaircaseGroup = null;
        wStairSteps = [];
    }

    wStaircaseGroup = new THREE.Group();
    wStaircaseGroup.visible = (simulatedGaitPace === 'stairs');
    walkerScene.add(wStaircaseGroup);

    wStairSteps = [];
    const numSteps = 14;
    const stepWidth = 1.60;
    const stepDepth = 0.38;
    const stepHeight = 0.14;

    const accentColor = (walkerGender === 'Female') ? 0xf43f5e : 0x06b6d4;
    const neonMat = new THREE.MeshBasicMaterial({ color: accentColor });
    const stepMat = new THREE.MeshStandardMaterial({
        color: 0x090e1a,
        roughness: 0.32,
        metalness: 0.88,
        transparent: true,
        opacity: 0.94
    });
    const grooveMat = new THREE.MeshBasicMaterial({ color: accentColor, transparent: true, opacity: 0.55 });

    for (let i = 0; i < numSteps; i++) {
        const stepGroup = new THREE.Group();

        // 1. Solid High-Tech Tread Platform
        const stepGeo = new THREE.BoxGeometry(stepWidth, stepHeight, stepDepth);
        const stepMesh = new THREE.Mesh(stepGeo, stepMat);
        stepMesh.position.set(0, -stepHeight / 2, 0);
        stepMesh.castShadow = true;
        stepMesh.receiveShadow = true;
        stepGroup.add(stepMesh);

        // 2. Glowing Neon Riser Front Nose Light
        const noseGeo = new THREE.BoxGeometry(stepWidth * 0.98, 0.018, 0.018);
        const noseMesh = new THREE.Mesh(noseGeo, neonMat);
        noseMesh.position.set(0, 0.001, stepDepth / 2);
        stepGroup.add(noseMesh);

        // 3. Holographic Anti-Slip Grip Grooves (Laser strips on tread)
        for (let g = -1; g <= 1; g++) {
            const grooveGeo = new THREE.BoxGeometry(stepWidth * 0.85, 0.004, 0.015);
            const grooveMesh = new THREE.Mesh(grooveGeo, grooveMat);
            grooveMesh.position.set(0, 0.002, g * 0.09);
            stepGroup.add(grooveMesh);
        }

        wStaircaseGroup.add(stepGroup);
        wStairSteps.push(stepGroup);
    }

    // 4. Futuristic Neon Side Guide Rails & Floating Balustrades
    const railMat = new THREE.MeshBasicMaterial({ color: accentColor, transparent: true, opacity: 0.75 });
    const glassMat = new THREE.MeshStandardMaterial({
        color: accentColor,
        roughness: 0.1,
        metalness: 0.9,
        transparent: true,
        opacity: 0.22
    });

    for (let side of [-1, 1]) {
        const xPos = side * (stepWidth / 2 + 0.05);

        // Sloped Balustrade Handrail Beam
        const beamGeo = new THREE.BoxGeometry(0.035, 0.045, stepDepth * numSteps * 0.85);
        const beamMesh = new THREE.Mesh(beamGeo, railMat);
        beamMesh.rotation.x = -Math.atan2(stepHeight, stepDepth);
        beamMesh.position.set(xPos, 0.55, 0);
        wStaircaseGroup.add(beamMesh);

        // Glass Balustrade Panel
        const glassGeo = new THREE.BoxGeometry(0.01, 0.45, stepDepth * numSteps * 0.80);
        const glassMesh = new THREE.Mesh(glassGeo, glassMat);
        glassMesh.rotation.x = -Math.atan2(stepHeight, stepDepth);
        glassMesh.position.set(xPos, 0.30, 0);
        wStaircaseGroup.add(glassMesh);

        // Vertical Stanchions
        for (let s = -2; s <= 2; s++) {
            const stanchionGeo = new THREE.CylinderGeometry(0.012, 0.012, 0.60, 8);
            const stanchion = new THREE.Mesh(stanchionGeo, railMat);
            stanchion.position.set(xPos, 0.30 + s * 0.14, s * 0.76);
            wStaircaseGroup.add(stanchion);
        }
    }
}

// Synchronizes walker avatar to match the logged-in user profile
function syncWalkerGender() {
    const expected = getExpectedGender();
    if (walkerGender !== expected || !walkerCharacterGroup) {
        buildHumanoidAvatar(expected);
        updateWalkerProfileBadge();
        create3DStaircase();
    }
}

// Renders the locked profile badge in the walker toolbar
function updateWalkerProfileBadge() {
    const badgeContainer = document.getElementById('walker-user-badge');
    if (!badgeContainer) return;

    const isFemale = (walkerGender === 'Female');
    const userName = (currentUser && currentUser.name) ? currentUser.name : (isFemale ? 'Female Athlete' : 'Male Athlete');
    
    if (isFemale) {
        badgeContainer.innerHTML = `
            <div class="walker-badge-pill female" title="Strictly personalized to ${userName}'s profile">
                <i class="fa-solid fa-venus"></i>
                <span>Female Body â€¢ ${userName}</span>
            </div>
        `;
    } else {
        badgeContainer.innerHTML = `
            <div class="walker-badge-pill male" title="Strictly personalized to ${userName}'s profile">
                <i class="fa-solid fa-mars"></i>
                <span>Male Body â€¢ ${userName}</span>
            </div>
        `;
    }
}

// Sculpted Anatomical Runner Fist & Articulated Hand Gesture
function createRunnerHand(skinMat, isLeft) {
    const handGroup = new THREE.Group();

    // 1. Wrist Transition Collar (seamless anatomical connection from forearm)
    const wristGeo = new THREE.CylinderGeometry(0.044, 0.038, 0.035, 12);
    const wristMesh = new THREE.Mesh(wristGeo, skinMat);
    wristMesh.position.set(0, 0.012, 0);
    handGroup.add(wristMesh);

    // 2. Metacarpal Palm (Tapered athletic fist base)
    const palmGeo = new THREE.BoxGeometry(0.056, 0.065, 0.040);
    const palmMesh = new THREE.Mesh(palmGeo, skinMat);
    palmMesh.position.set(0, -0.024, 0.004);
    handGroup.add(palmMesh);

    // 3. 4 Articulated Curled Finger Knuckles & Phalanges (Index, Middle, Ring, Pinky)
    const fingerRadii = [0.012, 0.013, 0.012, 0.010];
    const fingerLengths = [0.044, 0.048, 0.044, 0.036];
    const fingerSpacing = 0.0135;

    const knuckleRow = new THREE.Group();
    knuckleRow.position.set(0, -0.052, 0.010);
    handGroup.add(knuckleRow);

    for (let f = 0; f < 4; f++) {
        // Finger placement: left hand thumb is at +X (medial), so fingers index -> pinky run from +X toward -X
        // For right hand thumb is at -X (medial), so fingers index -> pinky run from -X toward +X
        const xPos = isLeft ? (0.020 - f * fingerSpacing) : (-0.020 + f * fingerSpacing);

        // Knuckle dome
        const kSphere = new THREE.Mesh(new THREE.SphereGeometry(fingerRadii[f] * 1.05, 8, 8), skinMat);
        kSphere.position.set(xPos, 0.004, 0.008);
        knuckleRow.add(kSphere);

        // Curled finger body tucked against the palm
        const fCyl = new THREE.Mesh(new THREE.CylinderGeometry(fingerRadii[f], fingerRadii[f] * 0.88, fingerLengths[f], 8), skinMat);
        fCyl.position.set(xPos, -fingerLengths[f] * 0.36, 0.002);
        fCyl.rotation.x = -0.42; // Curled inward towards anterior palmar surface
        knuckleRow.add(fCyl);
    }

    // 4. Opposable Thumb with Muscular Thenar Pad
    const thumbSide = isLeft ? 1 : -1; // Medial (+X for Left Hand, -X for Right Hand)

    // Thenar eminence pad
    const thenarMesh = new THREE.Mesh(new THREE.SphereGeometry(0.020, 10, 10), skinMat);
    thenarMesh.scale.set(1.1, 1.3, 0.9);
    thenarMesh.position.set(thumbSide * 0.026, -0.016, 0.012);
    handGroup.add(thenarMesh);

    // Thumb phalanx angled naturally over the index finger knuckle
    const thumbDigit = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.010, 0.042, 8), skinMat);
    thumbDigit.position.set(thumbSide * 0.026, -0.032, 0.022);
    thumbDigit.rotation.x = -0.22;
    thumbDigit.rotation.z = thumbSide * 0.32;
    handGroup.add(thumbDigit);

    // Smooth rounded thumb tip
    const thumbTip = new THREE.Mesh(new THREE.SphereGeometry(0.010, 8, 8), skinMat);
    thumbTip.position.set(thumbSide * 0.018, -0.046, 0.026);
    handGroup.add(thumbTip);

    // 5. Natural Wrist Extension & Inward Midline Angle
    handGroup.rotation.y = isLeft ? 0.22 : -0.22;
    handGroup.rotation.x = -0.08;

    return handGroup;
}

// Builds or Rebuilds the Realistic Biomechanical Humanoid Avatar (Male or Female)
function buildHumanoidAvatar(gender) {
    if (!walkerScene) return;

    // Remove existing character if present
    if (walkerCharacterGroup) {
        walkerScene.remove(walkerCharacterGroup);
        walkerCharacterGroup = null;
    }

    walkerGender = gender;
    const isFemale = (gender === 'Female');

    // Root Group
    walkerCharacterGroup = new THREE.Group();
    walkerScene.add(walkerCharacterGroup);

    // Dynamic Morphology Variables
    const accentColor = isFemale ? 0xf43f5e : 0x0ea5e9;
    const accentHex = isFemale ? '#f43f5e' : '#0ea5e9';
    const topColor = isFemale ? 0xbe185d : 0x0f172a; // Rose athletic runner top vs Midnight navy
    const bottomColor = isFemale ? 0x4c0519 : 0x1e293b; // Deep athletic compression vs Charcoal navy shorts
    const skinColor = isFemale ? 0xfcd5be : 0xd4a373;
    const shoeColor = isFemale ? 0xffffff : 0x18181b;

    const shoulderWidth = isFemale ? 0.88 : 1.15;
    const hipWidth = isFemale ? 0.74 : 0.62;
    const thighLength = 0.78;
    const calfLength = 0.74;
    const thighRadius = isFemale ? 0.145 : 0.155;
    const calfRadius = isFemale ? 0.108 : 0.128;

    // Advanced Physically-Based Materials
    const skinMat = new THREE.MeshStandardMaterial({
        color: skinColor,
        roughness: 0.55,
        metalness: 0.05
    });
    const topMat = new THREE.MeshStandardMaterial({
        color: topColor,
        roughness: 0.42,
        metalness: 0.18,
        emissive: accentColor,
        emissiveIntensity: 0.08
    });
    const topAccentMat = new THREE.MeshStandardMaterial({
        color: isFemale ? 0xf43f5e : 0x0284c7,
        roughness: 0.38,
        metalness: 0.25
    });
    const bottomMat = new THREE.MeshStandardMaterial({
        color: bottomColor,
        roughness: 0.48,
        metalness: 0.12
    });
    const shoeUpperMat = new THREE.MeshStandardMaterial({
        color: shoeColor,
        roughness: 0.35,
        metalness: 0.15
    });
    const shoeMidsoleMat = new THREE.MeshStandardMaterial({
        color: 0xf8fafc,
        roughness: 0.60,
        metalness: 0.05
    });
    const shoeTreadMat = new THREE.MeshStandardMaterial({
        color: 0x09090b,
        roughness: 0.90,
        metalness: 0.05
    });
    const solePiezoMat = new THREE.MeshStandardMaterial({
        color: accentColor,
        emissive: accentColor,
        emissiveIntensity: 0.95,
        roughness: 0.15
    });
    const hairMat = new THREE.MeshStandardMaterial({
        color: isFemale ? 0x271e1d : 0x171717,
        roughness: 0.48,
        metalness: 0.1
    });
    const eyeWhiteMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const eyeIrisMat = new THREE.MeshBasicMaterial({ color: isFemale ? 0x5c3317 : 0x0369a1 });
    const eyePupilMat = new THREE.MeshBasicMaterial({ color: 0x09090b });
    const eyeGlintMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const browMat = new THREE.MeshBasicMaterial({ color: isFemale ? 0x1c1917 : 0x0f172a });
    const lipMat = new THREE.MeshStandardMaterial({
        color: isFemale ? 0xc2410c : 0xa16207,
        roughness: 0.6,
        metalness: 0.02
    });

    // --- 1. PELVIS / HIPS (Main Core) ---
    walkerPelvis = new THREE.Group();
    walkerPelvisBaseY = 1.58;
    walkerPelvis.position.set(0, walkerPelvisBaseY, 0);
    walkerCharacterGroup.add(walkerPelvis);

    // Hips Mesh
    const hipsGeo = new THREE.CylinderGeometry(hipWidth * 0.45, hipWidth * 0.49, 0.28, 16);
    const hipsMesh = new THREE.Mesh(hipsGeo, bottomMat);
    hipsMesh.castShadow = true;
    walkerPelvis.add(hipsMesh);

    // Neon Accent Belt / Waistband
    const beltGeo = new THREE.TorusGeometry(hipWidth * 0.48, 0.02, 8, 24);
    const beltMat = new THREE.MeshBasicMaterial({ color: accentColor });
    const beltMesh = new THREE.Mesh(beltGeo, beltMat);
    beltMesh.rotation.x = Math.PI / 2;
    beltMesh.position.y = 0.12;
    walkerPelvis.add(beltMesh);

    // --- 2. LEGS HIERARCHY ---
    const halfHip = hipWidth * 0.38;

    // === LEFT LEG ===
    wLeftHip = new THREE.Group();
    wLeftHip.position.set(-halfHip, -0.05, 0);
    walkerPelvis.add(wLeftHip);

    // Thigh with athletic taper & side speed stripe
    const lThighMesh = new THREE.Mesh(new THREE.CylinderGeometry(thighRadius * 0.95, thighRadius * 0.8, thighLength, 16), bottomMat);
    lThighMesh.position.set(0, -thighLength / 2, 0);
    lThighMesh.castShadow = true;
    wLeftHip.add(lThighMesh);

    const lThighStripe = new THREE.Mesh(new THREE.BoxGeometry(0.015, thighLength * 0.85, 0.04), beltMat);
    lThighStripe.position.set(-thighRadius * 0.92, -thighLength / 2, 0);
    wLeftHip.add(lThighStripe);

    wLeftKnee = new THREE.Group();
    wLeftKnee.position.set(0, -thighLength, 0);
    wLeftHip.add(wLeftKnee);

    // Knee joint ball
    const lKneeBall = new THREE.Mesh(new THREE.SphereGeometry(thighRadius * 0.78, 12, 12), isFemale ? bottomMat : skinMat);
    wLeftKnee.add(lKneeBall);

    // Patella (Kneecap) plate
    const lPatella = new THREE.Mesh(new THREE.BoxGeometry(thighRadius * 0.85, 0.10, 0.05), isFemale ? bottomMat : skinMat);
    lPatella.position.set(0, 0, thighRadius * 0.72);
    wLeftKnee.add(lPatella);

    // Calf
    const lCalfMesh = new THREE.Mesh(new THREE.CylinderGeometry(calfRadius * 1.10, calfRadius * 0.72, calfLength, 16), isFemale ? bottomMat : skinMat);
    lCalfMesh.position.set(0, -calfLength / 2, 0);
    lCalfMesh.castShadow = true;
    wLeftKnee.add(lCalfMesh);

    wLeftAnkle = new THREE.Group();
    wLeftAnkle.position.set(0, -calfLength, 0);
    wLeftKnee.add(wLeftAnkle);

    // Padded Ankle Collar
    const lCollar = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.022, 8, 16), shoeUpperMat);
    lCollar.rotation.x = Math.PI / 2;
    lCollar.position.set(0, -0.01, 0.02);
    wLeftAnkle.add(lCollar);

    // Left Running Shoe
    const lShoeGroup = new THREE.Group();
    wLeftAnkle.add(lShoeGroup);

    // Shoe Upper
    const lShoeUpper = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.11, 0.34), shoeUpperMat);
    lShoeUpper.position.set(0, -0.05, 0.06);
    lShoeUpper.castShadow = true;
    lShoeGroup.add(lShoeUpper);

    // Curved Toe Rocker
    const lToeRocker = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.095, 0.19, 12, 1, false, 0, Math.PI), shoeUpperMat);
    lToeRocker.rotation.z = Math.PI / 2;
    lToeRocker.rotation.y = -Math.PI / 2;
    lToeRocker.position.set(0, -0.04, 0.23);
    lShoeGroup.add(lToeRocker);

    // Dual-density EVA Midsole
    const lMidsole = new THREE.Mesh(new THREE.BoxGeometry(0.20, 0.038, 0.38), shoeMidsoleMat);
    lMidsole.position.set(0, -0.105, 0.07);
    lShoeGroup.add(lMidsole);

    // Carbon Energy Plate stripe in midsole
    const lPlate = new THREE.Mesh(new THREE.BoxGeometry(0.205, 0.008, 0.32), beltMat);
    lPlate.position.set(0, -0.105, 0.07);
    lShoeGroup.add(lPlate);

    // Outsole Tread
    const lTread = new THREE.Mesh(new THREE.BoxGeometry(0.20, 0.016, 0.38), shoeTreadMat);
    lTread.position.set(0, -0.13, 0.07);
    lShoeGroup.add(lTread);

    // Shoe Laces (3 sporty stripes across tongue)
    for (let l = 0; l < 3; l++) {
        const lace = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.012, 0.02), beltMat);
        lace.position.set(0, 0.01, 0.05 + l * 0.05);
        lShoeGroup.add(lace);
    }

    // Left PZT Piezo Transducer Sole Disc
    const piezoGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.02, 16);
    wLeftPiezoMesh = new THREE.Mesh(piezoGeo, solePiezoMat);
    wLeftPiezoMesh.position.set(0, -0.135, 0.02);
    wLeftAnkle.add(wLeftPiezoMesh);

    wLeftPiezoLight = new THREE.PointLight(accentColor, 0, 1.4);
    wLeftPiezoLight.position.set(0, -0.10, 0.02);
    wLeftAnkle.add(wLeftPiezoLight);

    // === RIGHT LEG ===
    wRightHip = new THREE.Group();
    wRightHip.position.set(halfHip, -0.05, 0);
    walkerPelvis.add(wRightHip);

    // Thigh with athletic taper & side speed stripe
    const rThighMesh = new THREE.Mesh(new THREE.CylinderGeometry(thighRadius * 0.95, thighRadius * 0.8, thighLength, 16), bottomMat);
    rThighMesh.position.set(0, -thighLength / 2, 0);
    rThighMesh.castShadow = true;
    wRightHip.add(rThighMesh);

    const rThighStripe = new THREE.Mesh(new THREE.BoxGeometry(0.015, thighLength * 0.85, 0.04), beltMat);
    rThighStripe.position.set(thighRadius * 0.92, -thighLength / 2, 0);
    wRightHip.add(rThighStripe);

    wRightKnee = new THREE.Group();
    wRightKnee.position.set(0, -thighLength, 0);
    wRightHip.add(wRightKnee);

    // Knee joint ball
    const rKneeBall = new THREE.Mesh(new THREE.SphereGeometry(thighRadius * 0.78, 12, 12), isFemale ? bottomMat : skinMat);
    wRightKnee.add(rKneeBall);

    // Patella (Kneecap) plate
    const rPatella = new THREE.Mesh(new THREE.BoxGeometry(thighRadius * 0.85, 0.10, 0.05), isFemale ? bottomMat : skinMat);
    rPatella.position.set(0, 0, thighRadius * 0.72);
    wRightKnee.add(rPatella);

    // Calf
    const rCalfMesh = new THREE.Mesh(new THREE.CylinderGeometry(calfRadius * 1.10, calfRadius * 0.72, calfLength, 16), isFemale ? bottomMat : skinMat);
    rCalfMesh.position.set(0, -calfLength / 2, 0);
    rCalfMesh.castShadow = true;
    wRightKnee.add(rCalfMesh);

    wRightAnkle = new THREE.Group();
    wRightAnkle.position.set(0, -calfLength, 0);
    wRightKnee.add(wRightAnkle);

    // Padded Ankle Collar
    const rCollar = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.022, 8, 16), shoeUpperMat);
    rCollar.rotation.x = Math.PI / 2;
    rCollar.position.set(0, -0.01, 0.02);
    wRightAnkle.add(rCollar);

    // Right Running Shoe
    const rShoeGroup = new THREE.Group();
    wRightAnkle.add(rShoeGroup);

    // Shoe Upper
    const rShoeUpper = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.11, 0.34), shoeUpperMat);
    rShoeUpper.position.set(0, -0.05, 0.06);
    rShoeUpper.castShadow = true;
    rShoeGroup.add(rShoeUpper);

    // Curved Toe Rocker
    const rToeRocker = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.095, 0.19, 12, 1, false, 0, Math.PI), shoeUpperMat);
    rToeRocker.rotation.z = Math.PI / 2;
    rToeRocker.rotation.y = -Math.PI / 2;
    rToeRocker.position.set(0, -0.04, 0.23);
    rShoeGroup.add(rToeRocker);

    // Dual-density EVA Midsole
    const rMidsole = new THREE.Mesh(new THREE.BoxGeometry(0.20, 0.038, 0.38), shoeMidsoleMat);
    rMidsole.position.set(0, -0.105, 0.07);
    rShoeGroup.add(rMidsole);

    // Carbon Energy Plate stripe
    const rPlate = new THREE.Mesh(new THREE.BoxGeometry(0.205, 0.008, 0.32), beltMat);
    rPlate.position.set(0, -0.105, 0.07);
    rShoeGroup.add(rPlate);

    // Outsole Tread
    const rTread = new THREE.Mesh(new THREE.BoxGeometry(0.20, 0.016, 0.38), shoeTreadMat);
    rTread.position.set(0, -0.13, 0.07);
    rShoeGroup.add(rTread);

    // Shoe Laces
    for (let l = 0; l < 3; l++) {
        const lace = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.012, 0.02), beltMat);
        lace.position.set(0, 0.01, 0.05 + l * 0.05);
        rShoeGroup.add(lace);
    }

    // Right PZT Piezo Transducer Sole Disc
    wRightPiezoMesh = new THREE.Mesh(piezoGeo, solePiezoMat);
    wRightPiezoMesh.position.set(0, -0.135, 0.02);
    wRightAnkle.add(wRightPiezoMesh);

    wRightPiezoLight = new THREE.PointLight(accentColor, 0, 1.4);
    wRightPiezoLight.position.set(0, -0.10, 0.02);
    wRightAnkle.add(wRightPiezoLight);


    // --- 3. SPINE & UPPER BODY ---
    const spineGroup = new THREE.Group();
    spineGroup.position.set(0, 0.15, 0);
    walkerPelvis.add(spineGroup);

    // Waist / Lower torso
    const waistGeo = new THREE.CylinderGeometry(isFemale ? 0.22 : 0.28, isFemale ? 0.25 : 0.30, 0.25, 16);
    const waistMesh = new THREE.Mesh(waistGeo, isFemale ? skinMat : topMat);
    waistMesh.position.set(0, 0.12, 0);
    spineGroup.add(waistMesh);

    walkerChest = new THREE.Group();
    walkerChest.position.set(0, 0.25, 0);
    spineGroup.add(walkerChest);

    // Upper Chest / Athletic Top
    const chestGeo = new THREE.CylinderGeometry(shoulderWidth * 0.42, isFemale ? 0.23 : 0.28, 0.42, 16);
    const chestMesh = new THREE.Mesh(chestGeo, topMat);
    chestMesh.position.set(0, 0.21, 0);
    chestMesh.castShadow = true;
    walkerChest.add(chestMesh);

    // Side ventilation contrast panels
    const sidePanelGeo = new THREE.BoxGeometry(shoulderWidth * 0.88, 0.22, 0.20);
    const sidePanelMesh = new THREE.Mesh(sidePanelGeo, topAccentMat);
    sidePanelMesh.position.set(0, 0.21, 0);
    walkerChest.add(sidePanelMesh);

    // Chest Reflective Crest
    const chestStripGeo = new THREE.BoxGeometry(shoulderWidth * 0.45, 0.025, 0.26);
    const chestStripMesh = new THREE.Mesh(chestStripGeo, beltMat);
    chestStripMesh.position.set(0, 0.29, 0.08);
    walkerChest.add(chestStripMesh);

    // Neck
    const neckMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.088, 0.108, 0.15, 14), skinMat);
    neckMesh.position.set(0, 0.48, 0);
    walkerChest.add(neckMesh);

    // --- 4. REALISTIC SCULPTED HEAD & FACE ---
    const headGroup = new THREE.Group();
    headGroup.position.set(0, 0.66, 0);
    walkerChest.add(headGroup);
    walkerHead = headGroup;

    // Cranium
    const craniumMesh = new THREE.Mesh(new THREE.SphereGeometry(0.182, 22, 22), skinMat);
    craniumMesh.position.set(0, 0.02, 0);
    headGroup.add(craniumMesh);

    // Jaw & Chin
    const jawMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.178, isFemale ? 0.095 : 0.115, 0.16, 16), skinMat);
    jawMesh.position.set(0, -0.05, 0.015);
    headGroup.add(jawMesh);

    // Sculpted Nose
    const noseGeo = new THREE.ConeGeometry(0.024, 0.07, 8);
    const noseMesh = new THREE.Mesh(noseGeo, skinMat);
    noseMesh.rotation.x = Math.PI / 2 + 0.15;
    noseMesh.position.set(0, 0.01, 0.185);
    headGroup.add(noseMesh);

    // Expressive Left Eye
    const eyeWhiteGeo = new THREE.SphereGeometry(0.038, 10, 10);
    eyeWhiteGeo.scale(1, 0.75, 0.3);

    const lEyeWhite = new THREE.Mesh(eyeWhiteGeo, eyeWhiteMat);
    lEyeWhite.position.set(-0.065, 0.028, 0.162);
    headGroup.add(lEyeWhite);

    const lIris = new THREE.Mesh(new THREE.SphereGeometry(0.022, 10, 10), eyeIrisMat);
    lIris.scale.set(1, 1, 0.2);
    lIris.position.set(-0.065, 0.028, 0.172);
    headGroup.add(lIris);

    const lPupil = new THREE.Mesh(new THREE.SphereGeometry(0.012, 8, 8), eyePupilMat);
    lPupil.scale.set(1, 1, 0.2);
    lPupil.position.set(-0.065, 0.028, 0.176);
    headGroup.add(lPupil);

    const lGlint = new THREE.Mesh(new THREE.SphereGeometry(0.006, 6, 6), eyeGlintMat);
    lGlint.position.set(-0.058, 0.034, 0.178);
    headGroup.add(lGlint);

    // Expressive Right Eye
    const rEyeWhite = new THREE.Mesh(eyeWhiteGeo, eyeWhiteMat);
    rEyeWhite.position.set(0.065, 0.028, 0.162);
    headGroup.add(rEyeWhite);

    const rIris = new THREE.Mesh(new THREE.SphereGeometry(0.022, 10, 10), eyeIrisMat);
    rIris.scale.set(1, 1, 0.2);
    rIris.position.set(0.065, 0.028, 0.172);
    headGroup.add(rIris);

    const rPupil = new THREE.Mesh(new THREE.SphereGeometry(0.012, 8, 8), eyePupilMat);
    rPupil.scale.set(1, 1, 0.2);
    rPupil.position.set(0.065, 0.028, 0.176);
    headGroup.add(rPupil);

    const rGlint = new THREE.Mesh(new THREE.SphereGeometry(0.006, 6, 6), eyeGlintMat);
    rGlint.position.set(0.072, 0.034, 0.178);
    headGroup.add(rGlint);

    // Arched Athletic Eyebrows
    const lBrow = new THREE.Mesh(new THREE.BoxGeometry(0.058, 0.012, 0.02), browMat);
    lBrow.rotation.z = -0.10;
    lBrow.position.set(-0.065, 0.062, 0.165);
    headGroup.add(lBrow);

    const rBrow = new THREE.Mesh(new THREE.BoxGeometry(0.058, 0.012, 0.02), browMat);
    rBrow.rotation.z = 0.10;
    rBrow.position.set(0.065, 0.062, 0.165);
    headGroup.add(rBrow);

    // Athletic Lip Contour
    const lipsMesh = new THREE.Mesh(new THREE.BoxGeometry(isFemale ? 0.065 : 0.075, 0.014, 0.025), lipMat);
    lipsMesh.position.set(0, -0.052, 0.17);
    headGroup.add(lipsMesh);

    // Ears (Left & Right)
    const earGeo = new THREE.SphereGeometry(0.045, 8, 8);
    earGeo.scale(0.35, 1, 0.7);

    const lEar = new THREE.Mesh(earGeo, skinMat);
    lEar.position.set(-0.18, 0.015, -0.01);
    headGroup.add(lEar);

    const rEar = new THREE.Mesh(earGeo, skinMat);
    rEar.position.set(0.18, 0.015, -0.01);
    headGroup.add(rEar);

    // Aerodynamic Sports Glasses / Cyber Visor
    const visorGeo = new THREE.BoxGeometry(0.24, 0.065, 0.13);
    const visorMat = new THREE.MeshPhysicalMaterial({
        color: accentColor,
        transparent: true,
        opacity: 0.75,
        roughness: 0.1,
        metalness: 0.9,
        clearcoat: 1.0
    });
    const visorMesh = new THREE.Mesh(visorGeo, visorMat);
    visorMesh.position.set(0, 0.03, 0.145);
    headGroup.add(visorMesh);

    // Sunglasses Rim Frame
    const visorRim = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.012, 0.14), new THREE.MeshBasicMaterial({ color: 0x09090b }));
    visorRim.position.set(0, 0.065, 0.145);
    headGroup.add(visorRim);

    // Hair Sculpt
    if (isFemale) {
        // Female: Voluminous Hair Cap
        const hairBaseMesh = new THREE.Mesh(new THREE.SphereGeometry(0.196, 18, 18, 0, Math.PI * 2, 0, Math.PI * 0.68), hairMat);
        hairBaseMesh.position.set(0, 0.04, -0.02);
        headGroup.add(hairBaseMesh);

        // Face-framing side bangs
        const bangsL = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.012, 0.22, 8), hairMat);
        bangsL.rotation.z = 0.35;
        bangsL.rotation.x = -0.15;
        bangsL.position.set(-0.135, -0.02, 0.11);
        headGroup.add(bangsL);

        const bangsR = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.012, 0.22, 8), hairMat);
        bangsR.rotation.z = -0.35;
        bangsR.rotation.x = -0.15;
        bangsR.position.set(0.135, -0.02, 0.11);
        headGroup.add(bangsR);

        // High Ponytail Scrunchie Band
        const tieMesh = new THREE.Mesh(new THREE.TorusGeometry(0.055, 0.018, 8, 16), beltMat);
        tieMesh.position.set(0, 0.14, -0.18);
        headGroup.add(tieMesh);

        // Dynamic Ponytail Group (Inertial physics animated in loop)
        wPonytail = new THREE.Group();
        wPonytail.position.set(0, 0.14, -0.19);
        headGroup.add(wPonytail);

        // Upper ponytail flow
        const tail1 = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.03, 0.26, 12), hairMat);
        tail1.rotation.x = -Math.PI / 3.5;
        tail1.position.set(0, -0.08, -0.10);
        wPonytail.add(tail1);

        // Lower ponytail strand
        const tail2 = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.01, 0.26, 10), hairMat);
        tail2.rotation.x = -Math.PI / 4.5;
        tail2.position.set(0, -0.24, -0.18);
        wPonytail.add(tail2);
    } else {
        wPonytail = null;
        // Male: Modern Textured Taper Fade & Quiff
        const hairBaseMesh = new THREE.Mesh(new THREE.SphereGeometry(0.195, 18, 18, 0, Math.PI * 2, 0, Math.PI * 0.58), hairMat);
        hairBaseMesh.position.set(0, 0.05, -0.01);
        headGroup.add(hairBaseMesh);

        // Runner Quiff volume on top/front
        const quiff = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.045, 0.14), hairMat);
        quiff.rotation.x = -0.2;
        quiff.position.set(0, 0.175, 0.06);
        headGroup.add(quiff);
    }


    // --- 5. SHOULDERS, ARMS & ARTICULATED HANDS ---
    const armLen = 0.52;
    const armRadius = isFemale ? 0.082 : 0.105;
    const halfShoulder = shoulderWidth * 0.48;

    // === LEFT ARM ===
    wLeftShoulder = new THREE.Group();
    wLeftShoulder.position.set(-halfShoulder, 0.36, 0);
    walkerChest.add(wLeftShoulder);

    // Rounded Deltoid Cap (Smooth anatomical shoulder joint)
    const lDeltoid = new THREE.Mesh(new THREE.SphereGeometry(armRadius * 1.15, 12, 12), isFemale ? topMat : topMat);
    wLeftShoulder.add(lDeltoid);

    // Upper Arm (Biceps / Triceps contour)
    const lUpperArmMesh = new THREE.Mesh(new THREE.CylinderGeometry(armRadius, armRadius * 0.85, armLen, 12), isFemale ? skinMat : topMat);
    lUpperArmMesh.position.set(0, -armLen / 2, 0);
    lUpperArmMesh.castShadow = true;
    wLeftShoulder.add(lUpperArmMesh);

    wLeftElbow = new THREE.Group();
    wLeftElbow.position.set(0, -armLen, 0);
    wLeftShoulder.add(wLeftElbow);

    // Elbow Joint Sphere
    const lElbowBall = new THREE.Mesh(new THREE.SphereGeometry(armRadius * 0.82, 10, 10), skinMat);
    wLeftElbow.add(lElbowBall);

    // Forearm (Anatomical Brachioradialis taper toward wrist)
    const lForearmMesh = new THREE.Mesh(new THREE.CylinderGeometry(armRadius * 0.80, armRadius * 0.60, armLen * 0.86, 12), skinMat);
    lForearmMesh.position.set(0, -armLen * 0.43, 0);
    lForearmMesh.castShadow = true;
    wLeftElbow.add(lForearmMesh);

    // Smart Fitness Watch on Left Wrist
    const watchBand = new THREE.Mesh(new THREE.CylinderGeometry(armRadius * 0.66, armRadius * 0.66, 0.045, 14), new THREE.MeshBasicMaterial({ color: 0x09090b }));
    watchBand.position.set(0, -armLen * 0.80, 0);
    wLeftElbow.add(watchBand);

    const watchFace = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.05, 0.015), beltMat);
    watchFace.position.set(0, -armLen * 0.80, armRadius * 0.68);
    wLeftElbow.add(watchFace);

    // Sculpted Articulated Runner Fist (Left Hand)
    const lHandGroup = createRunnerHand(skinMat, true);
    lHandGroup.position.set(0, -armLen * 0.88, 0);
    wLeftElbow.add(lHandGroup);

    // === RIGHT ARM ===
    wRightShoulder = new THREE.Group();
    wRightShoulder.position.set(halfShoulder, 0.36, 0);
    walkerChest.add(wRightShoulder);

    // Rounded Deltoid Cap
    const rDeltoid = new THREE.Mesh(new THREE.SphereGeometry(armRadius * 1.15, 12, 12), isFemale ? topMat : topMat);
    wRightShoulder.add(rDeltoid);

    // Upper Arm
    const rUpperArmMesh = new THREE.Mesh(new THREE.CylinderGeometry(armRadius, armRadius * 0.85, armLen, 12), isFemale ? skinMat : topMat);
    rUpperArmMesh.position.set(0, -armLen / 2, 0);
    rUpperArmMesh.castShadow = true;
    wRightShoulder.add(rUpperArmMesh);

    wRightElbow = new THREE.Group();
    wRightElbow.position.set(0, -armLen, 0);
    wRightShoulder.add(wRightElbow);

    // Elbow Joint Sphere
    const rElbowBall = new THREE.Mesh(new THREE.SphereGeometry(armRadius * 0.82, 10, 10), skinMat);
    wRightElbow.add(rElbowBall);

    // Forearm
    const rForearmMesh = new THREE.Mesh(new THREE.CylinderGeometry(armRadius * 0.80, armRadius * 0.60, armLen * 0.86, 12), skinMat);
    rForearmMesh.position.set(0, -armLen * 0.43, 0);
    rForearmMesh.castShadow = true;
    wRightElbow.add(rForearmMesh);

    // Sculpted Articulated Runner Fist (Right Hand)
    const rHandGroup = createRunnerHand(skinMat, false);
    rHandGroup.position.set(0, -armLen * 0.88, 0);
    wRightElbow.add(rHandGroup);

    // Update Floating HUD with Avatar details
    updateWalkerHUD(gender, isFemale);
}

// Spawns a glowing kinetic shockwave ring on the treadmill when shoe impacts ground
function triggerHeelStrikeEffect(footName, positionX, isLeft) {
    if (!walkerScene) return;

    const accentColor = (walkerGender === 'Female') ? 0xf43f5e : 0x0ea5e9;

    // Shockwave Ring at forward heel contact point
    const ringGeo = new THREE.RingGeometry(0.08, 0.22, 28);
    const ringMat = new THREE.MeshBasicMaterial({
        color: accentColor,
        transparent: true,
        opacity: 0.85,
        side: THREE.DoubleSide
    });
    const ringMesh = new THREE.Mesh(ringGeo, ringMat);
    ringMesh.rotation.x = -Math.PI / 2;
    ringMesh.position.set(positionX, 0.02, 0.24); // Forward heel-strike impact point
    walkerScene.add(ringMesh);

    walkerShockwaves.push({
        mesh: ringMesh,
        scale: 1.0,
        opacity: 0.85
    });

    // Flash Shoe Sole Light
    const light = isLeft ? wLeftPiezoLight : wRightPiezoLight;
    if (light) {
        light.intensity = 2.4;
        setTimeout(() => { if (light) light.intensity = 0; }, 180);
    }

    // Update Live Telemetry Metrics
    walkerStridesTotal++;
    const isStairs = (simulatedGaitPace === 'stairs');
    const basePwr = isStairs ? (Math.random() * 12.0 + 52.0) : (Math.random() * 8.5 + 36.5);
    const harvestMw = (basePwr * (simulatedBodyMass / 68.0)).toFixed(1);

    const powerEl = document.getElementById('hud-power-text');
    const phaseEl = document.getElementById('hud-phase-val');
    const footEl = document.getElementById('hud-foot-val');
    const stepsEl = document.getElementById('hud-steps-val');

    if (powerEl) powerEl.textContent = `${harvestMw} mW`;
    if (phaseEl) phaseEl.textContent = isStairs ? "âš¡ Incline Step Impact" : "âš¡ PZT Strike Impact";
    if (footEl) {
        footEl.textContent = `${footName} Contact`;
        footEl.style.color = (walkerGender === 'Female') ? '#f43f5e' : '#06b6d4';
    }
    if (stepsEl) stepsEl.textContent = walkerStridesTotal;
}

// Updates floating HUD labels and icons
function updateWalkerHUD(gender, isFemale) {
    const iconEl = document.getElementById('hud-avatar-icon');
    const textEl = document.getElementById('hud-avatar-text');
    const badgeEl = document.getElementById('hud-avatar-badge');

    if (textEl) {
        textEl.textContent = isFemale 
            ? `Female Athlete Body â€¢ ${currentUser && currentUser.name ? currentUser.name : 'Gargi'}`
            : `Male Athlete Body â€¢ ${currentUser && currentUser.name ? currentUser.name : 'Kartik'}`;
    }
    if (iconEl) {
        iconEl.style.color = isFemale ? '#f43f5e' : '#0ea5e9';
    }
    if (badgeEl) {
        badgeEl.style.borderColor = isFemale ? 'rgba(244, 63, 94, 0.4)' : 'rgba(14, 165, 233, 0.4)';
    }
}

// Helper for realistic knee flexion: shock cushion during stance, deep flexion during forward swing
function calculateKneeFlexion(p) {
    const isStairs = (simulatedGaitPace === 'stairs');
    const baseKnee = isStairs ? 0.14 : 0.06;
    const maxKneeFlex = isStairs ? 1.25 : 0.90;
    if (p < Math.PI) {
        // Stance phase (0 to PI): heel strikes straight, absorbs loading shock at early stance
        const impact = (p > 0.12 && p < 1.6) ? Math.sin((p - 0.12) * Math.PI / 1.48) * (isStairs ? 0.28 : 0.18) : 0;
        return baseKnee + impact;
    } else {
        // Swing phase (PI to 2*PI): knee flexes deeply to lift foot forward cleanly over stair riser
        const swingNorm = (p - Math.PI) / Math.PI;
        return baseKnee + Math.sin(swingNorm * Math.PI) * maxKneeFlex;
    }
}

// Helper for realistic ankle 3-rocker pitch: heel strike dorsiflexion, flat midstance, push-off plantarflexion
function calculateAnklePitch(p) {
    if (p < 0.55) {
        // Heel strike dorsiflexion (toes angled up, heel lands first)
        return -(1.0 - p / 0.55) * 0.28;
    } else if (p < 2.1) {
        // Flat stance
        return 0.0;
    } else if (p < Math.PI) {
        // Terminal stance push-off plantarflexion (heel elevates, toes push off ground)
        const pushFrac = (p - 2.1) / (Math.PI - 2.1);
        return pushFrac * 0.38;
    } else {
        // Swing foot clearance (relaxed neutral ankle)
        const swingFrac = (p - Math.PI) / Math.PI;
        return -Math.sin(swingFrac * Math.PI) * 0.10;
    }
}

// 3D Walker Main Animation Loop
function animate3DWalker() {
    requestAnimationFrame(animate3DWalker);

    if (!walkerRenderer || !walkerScene || !walkerCamera || currentViewMode !== 'walker') {
        return;
    }

    const delta = walkerClock ? Math.min(walkerClock.getDelta(), 0.1) : 0.016;

    // 1. Advance Gait Cycle Phase Angle
    if (!isGaitSimulationPaused) {
        walkerGaitCycle += delta * walkerPaceSpeed * 3.4;
    }

    const phaseL = walkerGaitCycle % (Math.PI * 2);
    const phaseR = (walkerGaitCycle + Math.PI) % (Math.PI * 2);

    // Live Kinetic Transducer Synchronizer (P1 Heel, P2 Arch, P3 Ball, P4 Toe)
    updateTransducersFromGait(phaseL, phaseR);

    const isStairs = (simulatedGaitPace === 'stairs');

    // 2. Leg Kinematics (Authentic Forward Walking Motion)
    if (wLeftHip && wRightHip && wLeftKnee && wRightKnee) {
        // Hip Angle: Thigh moves from front (-0.44 rad) to back (+0.32 rad) during stance, swings forward during swing
        const hipAmp = isStairs ? 0.44 : 0.38;
        const hipBaseOffset = isStairs ? -0.14 : -0.06;
        wLeftHip.rotation.x = -Math.cos(phaseL) * hipAmp + hipBaseOffset;
        wRightHip.rotation.x = -Math.cos(phaseR) * hipAmp + hipBaseOffset;

        // Knee Flexion: Shock-absorption during stance, deep flexion during forward swing
        wLeftKnee.rotation.x = calculateKneeFlexion(phaseL);
        wRightKnee.rotation.x = calculateKneeFlexion(phaseR);

        // Ankle 3-Rocker Roll: Dorsiflexion at heel strike, flat in midstance, push-off plantarflexion
        if (wLeftAnkle && wRightAnkle) {
            wLeftAnkle.rotation.x = calculateAnklePitch(phaseL);
            wRightAnkle.rotation.x = calculateAnklePitch(phaseR);
        }
    }

    // 3. Heel Strike Contact Detection (Occurs at forward landing apex phase â‰ˆ 0)
    const isLeftContact = (phaseL < 0.22);
    if (isLeftContact && !walkerLastLeftContact) {
        triggerHeelStrikeEffect('Left Shoe', -0.22, true);
        walkerLastLeftContact = true;
    } else if (phaseL > 1.0 && phaseL < 5.0) {
        walkerLastLeftContact = false;
    }

    const isRightContact = (phaseR < 0.22);
    if (isRightContact && !walkerLastRightContact) {
        triggerHeelStrikeEffect('Right Shoe', 0.22, false);
        walkerLastRightContact = true;
    } else if (phaseR > 1.0 && phaseR < 5.0) {
        walkerLastRightContact = false;
    }

    // 4. Arms Counter-Swing (In natural opposition to legs)
    if (wLeftShoulder && wRightShoulder && wLeftElbow && wRightElbow) {
        // Contralateral Arm Swing: Opposite arm reaches forward with leading leg
        // When Left Leg is forward (phaseL=0), Left Arm is backward (+0.35 rad) and Right Arm is forward (-0.45 rad)
        wLeftShoulder.rotation.x = Math.cos(phaseL) * 0.40 - 0.05;
        wRightShoulder.rotation.x = Math.cos(phaseR) * 0.40 - 0.05;

        // Slight natural outward clearance from hips and inward chest angling
        wLeftShoulder.rotation.z = -0.06;
        wRightShoulder.rotation.z = 0.06;
        wLeftShoulder.rotation.y = 0.14;
        wRightShoulder.rotation.y = -0.14;

        // Elbow flexes forward towards chest (strictly negative X-rotation in Three.js coordinates)
        // Flexes tighter on forward swing (~76Â° flexion), relaxes on backward swing (~54Â° flexion)
        const fwdSwingL = Math.max(0, -Math.cos(phaseL));
        wLeftElbow.rotation.x = -(0.95 + fwdSwingL * 0.38);

        const fwdSwingR = Math.max(0, -Math.cos(phaseR));
        wRightElbow.rotation.x = -(0.95 + fwdSwingR * 0.38);
    }

    // 5. 3-Axis Pelvis & Torso Biomechanical Kinematics
    if (walkerPelvis) {
        // Vertical oscillation (dips at heel strikes, peaks at midstance)
        walkerPelvis.position.y = walkerPelvisBaseY - (1.0 - Math.sin(walkerGaitCycle * 2)) * (isStairs ? 0.045 : 0.032);
        // Lateral weight shift toward planted stance foot
        walkerPelvis.position.x = Math.sin(walkerGaitCycle) * 0.032;
        // Torso forward incline angle during stair climbing
        walkerPelvis.rotation.x = isStairs ? -0.16 : 0.0;
        // Trendelenburg pelvic tilt (drops toward unsupported swing leg)
        walkerPelvis.rotation.z = -Math.cos(phaseL) * 0.045;
        // Transverse pelvic rotation forward with advancing leg
        walkerPelvis.rotation.y = Math.cos(phaseL) * 0.08;
    }
    if (walkerChest) {
        // Upper spine forward incline pitch during stairs
        walkerChest.rotation.x = isStairs ? -0.10 : 0.0;
        // Upper spine and shoulder girdle counter-twist in natural opposition to pelvis
        walkerChest.rotation.y = -Math.cos(phaseL) * 0.12;
        walkerChest.rotation.z = Math.cos(phaseL) * 0.025;
    }
    if (walkerHead) {
        // Biological gaze stabilization (keeps eyes fixed forward along track)
        walkerHead.rotation.y = -walkerChest.rotation.y * 0.65;
        walkerHead.rotation.z = -walkerPelvis.rotation.z * 0.65;
    }
    if (wPonytail) {
        // Realistic dynamic ponytail inertial bounce and sway
        wPonytail.rotation.x = -Math.PI / 4 - Math.sin(walkerGaitCycle * 2 - 0.4) * 0.22;
        wPonytail.rotation.z = Math.sin(walkerGaitCycle - 0.4) * 0.18;
    }

    // 6. Track Visibility & Dynamic Stairmaster / Treadmill Movement
    if (isStairs) {
        // Show 3D Holographic Staircase, hide flat treadmill grid & arrow indicators
        if (wStaircaseGroup) wStaircaseGroup.visible = true;
        if (wTreadmillGrid) wTreadmillGrid.visible = false;
        if (wArrowGroup) wArrowGroup.visible = false;

        // Continuous Stair Glide: Steps descend down (-Y) and backward (-Z) like an infinite stairmaster
        // Tread depth = 0.38m, Riser height = 0.14m. Stride shift = 1 step per half-cycle (PI)
        const stepShift = (walkerGaitCycle / Math.PI) % 1.0;
        const treadDepth = 0.38;
        const riserHeight = 0.14;

        if (wStairSteps && wStairSteps.length > 0) {
            for (let i = 0; i < wStairSteps.length; i++) {
                const sMesh = wStairSteps[i];
                // Virtual index smoothly descending with stepShift
                const virtualIdx = (i - 5) - stepShift;
                sMesh.position.z = virtualIdx * treadDepth;
                sMesh.position.y = virtualIdx * riserHeight + 0.02;
            }
        }
    } else {
        // Show flat treadmill grid & arrow track, hide staircase
        if (wStaircaseGroup) wStaircaseGroup.visible = false;
        if (wTreadmillGrid) {
            wTreadmillGrid.visible = true;
            const treadmillOffset = (walkerGaitCycle * 0.85) % 2.0;
            wTreadmillGrid.position.z = 1.0 - treadmillOffset;
        }
        if (wArrowGroup) wArrowGroup.visible = true;
    }

    // 7. Shockwave Pulses Expansion & Backward Treadmill Drift
    for (let i = walkerShockwaves.length - 1; i >= 0; i--) {
        const sw = walkerShockwaves[i];
        sw.scale += delta * 4.2;
        sw.opacity -= delta * 1.8;
        sw.mesh.scale.set(sw.scale, sw.scale, 1);
        sw.mesh.material.opacity = Math.max(0, sw.opacity);
        // Slides backwards with the treadmill floor
        sw.mesh.position.z -= delta * walkerPaceSpeed * 0.95;

        if (sw.opacity <= 0.02) {
            walkerScene.remove(sw.mesh);
            walkerShockwaves.splice(i, 1);
        }
    }

    // 8. Auto-Rotate Character
    if (walkerAutoRotate && walkerCharacterGroup) {
        walkerCharacterGroup.rotation.y += 0.008;
    }

    // 9. Update OrbitControls & Render
    if (walkerControls) {
        walkerControls.update();
    }
    walkerRenderer.render(walkerScene, walkerCamera);
}

// Setup Event Handlers for 3D Walker Toolbar
function setupWalkerToolbarControls() {

    // Camera view buttons
    const btnCamIso = document.getElementById('btn-walker-cam-iso');
    const btnCamSide = document.getElementById('btn-walker-cam-side');
    const btnCamFeet = document.getElementById('btn-walker-cam-feet');
    const btnCamRotate = document.getElementById('btn-walker-cam-rotate');
    const btnCamReset = document.getElementById('btn-walker-cam-reset');

    const camPills = [btnCamIso, btnCamSide, btnCamFeet];
    function setCamPillActive(btn) {
        camPills.forEach(p => p && p.classList.remove('active'));
        if (btn) btn.classList.add('active');
    }

    if (btnCamIso) {
        btnCamIso.addEventListener('click', () => {
            setCamPillActive(btnCamIso);
            animateWalkerCamera(3.6, 2.1, 4.4, 0, 1.35, 0);
        });
    }

    if (btnCamSide) {
        btnCamSide.addEventListener('click', () => {
            setCamPillActive(btnCamSide);
            animateWalkerCamera(5.6, 1.55, 0.0, 0, 1.35, 0);
        });
    }

    if (btnCamFeet) {
        btnCamFeet.addEventListener('click', () => {
            setCamPillActive(btnCamFeet);
            animateWalkerCamera(1.9, 0.45, 2.2, 0, 0.25, 0);
        });
    }

    if (btnCamRotate) {
        btnCamRotate.addEventListener('click', () => {
            walkerAutoRotate = !walkerAutoRotate;
            btnCamRotate.classList.toggle('active', walkerAutoRotate);
        });
    }

    if (btnCamReset) {
        btnCamReset.addEventListener('click', () => {
            setCamPillActive(btnCamIso);
            walkerAutoRotate = false;
            if (btnCamRotate) btnCamRotate.classList.remove('active');
            if (walkerCharacterGroup) walkerCharacterGroup.rotation.set(0, 0, 0);
            animateWalkerCamera(3.6, 2.1, 4.4, 0, 1.35, 0);
        });
    }

    // Full Width / Expanded View Toggle Button
    const btnExpand = document.getElementById('btn-walker-expand');
    const heatmapGrid = document.querySelector('.heatmap-container-grid');
    if (btnExpand && heatmapGrid) {
        btnExpand.addEventListener('click', () => {
            const isExp = heatmapGrid.classList.toggle('expanded');
            btnExpand.classList.toggle('active', isExp);
            btnExpand.innerHTML = isExp 
                ? '<i class="fa-solid fa-compress"></i> Normal View' 
                : '<i class="fa-solid fa-expand"></i> Full Width';
            setTimeout(() => {
                onWindowResizeWalker();
                onWindowResize3D();
            }, 60);
        });
    }
}

// Smooth Camera Transition Helper for Walker
function animateWalkerCamera(tx, ty, tz, targetX = 0, targetY = 1.35, targetZ = 0, durationMs = 450) {
    if (!walkerCamera || !walkerControls) return;
    const startPos = walkerCamera.position.clone();
    const targetPos = new THREE.Vector3(tx, ty, tz);
    const startTarget = walkerControls.target.clone();
    const endTarget = new THREE.Vector3(targetX, targetY, targetZ);
    const startTime = performance.now();

    function step(now) {
        const elapsed = now - startTime;
        const progress = Math.min(elapsed / durationMs, 1.0);
        const ease = 1 - Math.pow(1 - progress, 3);
        walkerCamera.position.lerpVectors(startPos, targetPos, ease);
        walkerControls.target.lerpVectors(startTarget, endTarget, ease);
        walkerControls.update();

        if (progress < 1.0) {
            requestAnimationFrame(step);
        }
    }
    requestAnimationFrame(step);
}

// Resize handler for Walker
function onWindowResizeWalker() {
    const mount = document.getElementById('walker-three-canvas');
    if (!mount || !walkerRenderer || !walkerCamera) return;

    const width = mount.clientWidth;
    const height = mount.clientHeight || 420;
    if (width === 0 || height === 0) return;

    walkerCamera.aspect = width / height;
    walkerCamera.updateProjectionMatrix();
    walkerRenderer.setSize(width, height);
}

window.addEventListener('resize', onWindowResizeWalker);

// ====================================================================
// --- 16. LIVE KINETIC TRANSDUCER SYNCHRONIZATION & GAIT CONTROLLER ---
// ====================================================================

// Updates the 4 Transducer Cards (P1 Heel, P2 Arch, P3 Ball, P4 Toe) in real time
function updateTransducersFromGait(phaseL, phaseR) {
    transducerFrameCounter++;
    // Throttle DOM updates to alternate animation frames (~30 FPS) for buttery smooth performance
    if (transducerFrameCounter % 2 !== 0) return;

    // Determine the stance phase of the currently weight-bearing foot
    // In human bipedal gait, foot contact occurs during [0, Math.PI].
    let activeStanceP = -1;
    let isStance = false;

    if (phaseL < Math.PI) {
        activeStanceP = phaseL;
        isStance = true;
    } else if (phaseR < Math.PI) {
        activeStanceP = phaseR;
        isStance = true;
    }

    // Dynamic Physical Scaling: Force proportional to mass (kg), gait pace, and staircase incline
    const massFactor = simulatedBodyMass / 68.0;
    const paceFactor = walkerPaceSpeed / 1.0;
    const inclineFactor = (simulatedGaitPace === 'stairs') ? 1.45 : 1.0;
    const kForce = massFactor * paceFactor * inclineFactor;

    let cHeel = 0, cArch = 0, cBall = 0, cToe = 0;

    if (isStance && !isGaitSimulationPaused) {
        // Heel strike primary impact zone (apex at ~0.08 rad)
        if (activeStanceP < 0.42) {
            cHeel = Math.exp(-Math.pow((activeStanceP - 0.08) / 0.14, 2));
        }
        // Arch / Midfoot stabilizer zone (apex at ~0.40 rad)
        if (activeStanceP > 0.18 && activeStanceP < 0.65) {
            cArch = Math.exp(-Math.pow((activeStanceP - 0.40) / 0.15, 2));
        }
        // Metatarsal / Ball of Foot pushoff zone (apex at ~0.72 rad)
        if (activeStanceP > 0.45 && activeStanceP < 0.95) {
            cBall = Math.exp(-Math.pow((activeStanceP - 0.72) / 0.16, 2));
        }
        // Hallux / Toe-off impulse zone (apex at ~0.95 rad)
        if (activeStanceP > 0.78 && activeStanceP < 1.18) {
            cToe = Math.exp(-Math.pow((activeStanceP - 0.95) / 0.11, 2));
        }
    }

    // 1. P1: HEEL (60% rated max load)
    const v1 = (0.24 + cHeel * 3.65 * kForce);
    const i1 = (0.40 + cHeel * 6.80 * kForce);
    const p1 = (v1 * i1);
    const pct1 = Math.min(100, Math.round(cHeel * 60 * kForce + 4));
    const active1 = cHeel > 0.42;
    updateSingleCard('p1', v1, i1, p1, pct1, active1, active1 ? 'âš¡ IMPACT ACTIVE' : 'READY');

    // 2. P2: ARCH (15% rated max load)
    const v2 = (0.18 + cArch * 1.55 * kForce);
    const i2 = (0.28 + cArch * 2.60 * kForce);
    const p2 = (v2 * i2);
    const pct2 = Math.min(100, Math.round(cArch * 15 * kForce + 3));
    const active2 = cArch > 0.42;
    updateSingleCard('p2', v2, i2, p2, pct2, active2, active2 ? 'âš¡ MIDSTANCE' : 'READY');

    // 3. P3: BALL OF FOOT (20% rated max load)
    const v3 = (0.20 + cBall * 2.45 * kForce);
    const i3 = (0.32 + cBall * 4.20 * kForce);
    const p3 = (v3 * i3);
    const pct3 = Math.min(100, Math.round(cBall * 20 * kForce + 3));
    const active3 = cBall > 0.42;
    updateSingleCard('p3', v3, i3, p3, pct3, active3, active3 ? 'âš¡ PUSHOFF' : 'READY');

    // 4. P4: TOE (5% rated max load)
    const v4 = (0.12 + cToe * 0.95 * kForce);
    const i4 = (0.20 + cToe * 1.40 * kForce);
    const p4 = (v4 * i4);
    const pct4 = Math.min(100, Math.round(cToe * 5 * kForce + 2));
    const active4 = cToe > 0.42;
    updateSingleCard('p4', v4, i4, p4, pct4, active4, active4 ? 'âš¡ TOE-OFF' : 'READY');
}

// Helper to update a single transducer card's DOM metrics, status pill, and progress bar
function updateSingleCard(id, volt, curr, pwr, loadPct, isActive, statusText) {
    const card = document.getElementById(`card-${id}`);
    const elVolt = document.getElementById(`card-${id}-volt`);
    const elCurr = document.getElementById(`card-${id}-curr`);
    const elPwr = document.getElementById(`card-${id}-pwr`);
    const elPct = document.getElementById(`card-${id}-pct`);
    const elStatus = document.getElementById(`card-${id}-status`);
    const elBar = document.getElementById(`card-${id}-bar`);

    if (elVolt) elVolt.textContent = `${volt.toFixed(2)} V`;
    if (elCurr) elCurr.textContent = `${curr.toFixed(1)} mA`;
    if (elPwr) elPwr.textContent = `${pwr.toFixed(1)} mW`;
    if (elPct) elPct.textContent = `${loadPct}% Load`;
    if (elBar) elBar.style.width = `${Math.min(100, Math.max(loadPct * 1.4, 4))}%`;

    if (elStatus) {
        elStatus.textContent = statusText;
        elStatus.classList.toggle('active', isActive);
    }
    if (card) {
        card.classList.toggle('active-strike', isActive);
    }
}

// Connects "Gait Dynamics & Kinetic Stimulation" controller to 3D Walker and Transducers
function setupGaitStimulationController() {
    // 1. Gait Pace Selector Pills (Casual, Brisk, Jog, Stairs)
    const gaitPills = document.querySelectorAll('.gait-pill');
    gaitPills.forEach(pill => {
        pill.addEventListener('click', () => {
            gaitPills.forEach(p => p.classList.remove('active'));
            pill.classList.add('active');

            const gaitType = pill.getAttribute('data-gait') || 'casual';
            simulatedGaitPace = gaitType;

            if (gaitType === 'casual') {
                simulatedGaitMultiplier = 1.0;
                simulatedCadence = 75;
                walkerPaceSpeed = 0.85;
            } else if (gaitType === 'brisk') {
                simulatedGaitMultiplier = 1.35;
                simulatedCadence = 100;
                walkerPaceSpeed = 1.15;
            } else if (gaitType === 'jog') {
                simulatedGaitMultiplier = 1.85;
                simulatedCadence = 135;
                walkerPaceSpeed = 1.70;
            } else if (gaitType === 'stairs') {
                simulatedGaitMultiplier = 1.50;
                simulatedCadence = 95;
                walkerPaceSpeed = 1.25;
            }

            // Sync Track Badge UI
            const trackBadge = document.getElementById('walker-track-badge');
            if (trackBadge) {
                if (gaitType === 'stairs') {
                    trackBadge.innerHTML = '<i class="fa-solid fa-stairs"></i> <span>18Â° Incline Staircase</span>';
                    trackBadge.style.color = '#f59e0b';
                    trackBadge.style.borderColor = 'rgba(245, 158, 11, 0.4)';
                    trackBadge.style.background = 'rgba(245, 158, 11, 0.12)';
                } else {
                    trackBadge.innerHTML = '<i class="fa-solid fa-arrow-up-long"></i> <span>Forward Gait Track</span>';
                    trackBadge.style.color = '#06b6d4';
                    trackBadge.style.borderColor = 'rgba(6, 182, 212, 0.3)';
                    trackBadge.style.background = 'rgba(6, 182, 212, 0.1)';
                }
            }

            // Sync Cadence slider UI
            const sliderCadence = document.getElementById('slider-cadence');
            const valCadence = document.getElementById('val-cadence');
            if (sliderCadence) sliderCadence.value = simulatedCadence;
            if (valCadence) valCadence.textContent = `${simulatedCadence} SPM`;

            updateHarvesterProjections();
        });
    });

    // 2. Simulated Body Mass Slider
    const sliderWeight = document.getElementById('slider-weight');
    const valWeight = document.getElementById('val-weight');
    if (sliderWeight) {
        sliderWeight.addEventListener('input', (e) => {
            simulatedBodyMass = parseFloat(e.target.value) || 68;
            if (valWeight) valWeight.textContent = `${simulatedBodyMass} kg`;
            updateHarvesterProjections();
        });
    }

    // 3. Cadence Slider
    const sliderCadence = document.getElementById('slider-cadence');
    const valCadence = document.getElementById('val-cadence');
    if (sliderCadence) {
        sliderCadence.addEventListener('input', (e) => {
            simulatedCadence = parseInt(e.target.value, 10) || 90;
            if (valCadence) valCadence.textContent = `${simulatedCadence} SPM`;
            walkerPaceSpeed = (simulatedCadence / 90) * simulatedGaitMultiplier;
            updateHarvesterProjections();
        });
    }

    // 4. Apply Mechanical Impulse Button (Heavy Ground Stomp)
    const btnImpulse = document.getElementById('btn-stimulate-once');
    if (btnImpulse) {
        btnImpulse.addEventListener('click', () => {
            // Trigger shockwave impacts on treadmill
            triggerHeelStrikeEffect('Left Shoe', -0.22, true);
            triggerHeelStrikeEffect('Right Shoe', 0.22, false);

            // Surge all 4 cards with peak pulse
            ['p1', 'p2', 'p3', 'p4'].forEach(id => {
                const card = document.getElementById(`card-${id}`);
                if (card) {
                    card.classList.add('active-strike');
                    setTimeout(() => card.classList.remove('active-strike'), 500);
                }
            });

            // Update HUD power text
            const pwrEl = document.getElementById('hud-power-text');
            if (pwrEl) pwrEl.textContent = `${(52.4 * (simulatedBodyMass / 68.0)).toFixed(1)} mW`;
        });
    }

    // 5. Continuous Gait Stimulation Play/Pause Button
    const btnLoop = document.getElementById('btn-stimulate-loop');
    if (btnLoop) {
        btnLoop.addEventListener('click', () => {
            isGaitSimulationPaused = !isGaitSimulationPaused;
            if (isGaitSimulationPaused) {
                btnLoop.innerHTML = '<i class="fa-solid fa-play"></i> Resume Gait Stimulation';
                btnLoop.style.background = 'linear-gradient(135deg, #f59e0b, #ea580c)';
            } else {
                btnLoop.innerHTML = '<i class="fa-solid fa-pause"></i> Continuous Gait Stimulation';
                btnLoop.style.background = 'linear-gradient(135deg, #10b981, #06b6d4)';
            }
        });
    }

    // Initial calculation of mathematical projections
    updateHarvesterProjections();
}

// Updates Mathematical Theoretical Harvester Projections
function updateHarvesterProjections() {
    const kGait = simulatedGaitMultiplier;
    const mass = simulatedBodyMass;

    // Average harvested energy per stride: E_stride = (F_impact * stroke) * efficiency
    const avgEnergyPerStride = 0.0055 * (mass / 68.0) * kGait; // Joules
    const dailyJoules = (5000 * avgEnergyPerStride).toFixed(1);

    const efficiency = (13.5 + (kGait - 1.0) * 2.2 + (mass - 68) * 0.03).toFixed(1);

    // Supercapacitor 3.7V / 1.0F charge steps (E_cap = 0.5 * C * V^2 = 6.84 J)
    const capJoulesRequired = 6.84;
    const stepsRequired = Math.max(280, Math.round(capJoulesRequired / avgEnergyPerStride));

    const elJoules = document.getElementById('proj-daily-joules');
    const elEff = document.getElementById('proj-efficiency');
    const elTime = document.getElementById('proj-charge-time');

    if (elJoules) elJoules.textContent = `${dailyJoules} J`;
    if (elEff) elEff.textContent = `${efficiency}%`;
    if (elTime) elTime.textContent = `~${stepsRequired} steps`;
}

// Auto-initialize Gait Stimulation Controller
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupGaitStimulationController);
} else {
    setupGaitStimulationController();
}
