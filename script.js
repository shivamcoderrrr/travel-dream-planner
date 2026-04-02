/* Travel Dream Planner - Application Logic */

// State Management
const STORAGE_KEY = 'travel_dream_planner_data';
const BUDGET_LIMIT = 15000;
let destinations = [];
let filteredStatus = 'all'; 

// Map State
let map = null;
let markers = [];

// DOM Elements Cache
const DOM = {
    grid: document.getElementById('destinationsGrid'),
    emptyState: document.getElementById('emptyState'),
    budgetTotal: document.getElementById('budgetTotal'),
    budgetProgressBar: document.getElementById('budgetProgressBar'),
    budgetPercentage: document.getElementById('budgetPercentage'),
    budgetHealth: document.getElementById('budgetHealth'),
    searchInput: document.getElementById('searchInput'),
    statusFilters: document.getElementById('statusFilters'),
    mapPinCount: document.getElementById('mapPinCount'),
    
    // Tools
    darkModeToggle: document.getElementById('darkModeToggle'),
    exportBtn: document.getElementById('exportJson'),
    importInput: document.getElementById('importJson'),
    
    // Modal
    modal: document.getElementById('destinationModal'),
    modalBackdrop: document.getElementById('modalBackdrop'),
    modalContent: document.getElementById('modalContent'),
    modalTitle: document.getElementById('modalTitle'),
    form: document.getElementById('destinationForm'),
    cancelBtn: document.getElementById('cancelModalBtn'),
    
    // Form Inputs
    editId: document.getElementById('editId'),
    name: document.getElementById('destName'),
    location: document.getElementById('destLocation'),
    image: document.getElementById('destImage'),
    date: document.getElementById('destDate'),
    status: document.getElementById('destStatus'),
    desc: document.getElementById('destDesc'),
    
    // Expense Inputs
    expFlight: document.getElementById('expFlight'),
    expHotel: document.getElementById('expHotel'),
    expFood: document.getElementById('expFood'),
    expAct: document.getElementById('expAct'),
    destBudgetTotal: document.getElementById('destBudgetTotal')
};

// Initialize App
function init() {
    initDarkMode();
    loadData();
    setupEventListeners();
    initMap();
    renderDestinations();
}

// ----------------------------------------
// THEMES & DATA SYNC
// ----------------------------------------
function initDarkMode() {
    if (localStorage.theme === 'dark' || (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
        document.documentElement.classList.add('dark');
    } else {
        document.documentElement.classList.remove('dark');
    }
}

function toggleDarkMode() {
    document.documentElement.classList.toggle('dark');
    localStorage.theme = document.documentElement.classList.contains('dark') ? 'dark' : 'light';
}

function loadData() {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
        try {
            destinations = JSON.parse(saved);
        } catch (e) {
            console.error('Error parsing local storage data:', e);
            destinations = [];
        }
    }
}

function saveData() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(destinations));
    updateBudget();
    updateMapPins();
}

function exportData() {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(destinations, null, 2));
    const dlAnchorElem = document.createElement('a');
    dlAnchorElem.setAttribute("href", dataStr);
    dlAnchorElem.setAttribute("download", `travel_dreams_export_${new Date().getTime()}.json`);
    document.body.appendChild(dlAnchorElem);
    dlAnchorElem.click();
    dlAnchorElem.remove();
}

function importData(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const data = JSON.parse(e.target.result);
            if (Array.isArray(data)) {
                destinations = data;
                saveData();
                renderDestinations();
            } else {
                throw new Error("Invalid format");
            }
        } catch (err) {
            alert('Invalid JSON file. Cannot import.');
        }
    };
    reader.readAsText(file);
    e.target.value = ''; // Reset file input
}

// ----------------------------------------
// LEAFLET MAP
// ----------------------------------------
function initMap() {
    if (typeof L === 'undefined') return;
    
    // Initialize map focused globally
    map = L.map('tripMap').setView([20, 0], 2);
    
    // Add carto voyager tiles (looks great with the design)
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; OpenStreetMap &copy; CARTO',
        subdomains: 'abcd',
        maxZoom: 20
    }).addTo(map);

    updateMapPins();
}

async function updateMapPins() {
    if (!map) return;
    
    // Clear existing markers
    markers.forEach(m => map.removeLayer(m));
    markers = [];
    
    let needsSave = false;
    
    for (let dest of destinations) {
        if (!dest.location) continue;
        
        // Cache coords to save API calls strictly
        if (dest.lat && dest.lng) {
            addMarkerToMap(dest);
        } else {
            // Free geocoding using Nominatim (Respect limits: 1 call / sec)
            try {
                const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(dest.location)}&limit=1`);
                const data = await res.json();
                if (data && data.length > 0) {
                    dest.lat = parseFloat(data[0].lat);
                    dest.lng = parseFloat(data[0].lon);
                    needsSave = true;
                    addMarkerToMap(dest);
                }
            } catch (e) {
                console.warn('Geocoding failed for', dest.location);
            }
        }
    }
    
    if (needsSave) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(destinations));
    }
    
    DOM.mapPinCount.textContent = markers.length;
}

function addMarkerToMap(dest) {
    const statusColors = {
        'Planning': '#4f46e5',
        'Booked': '#10b981',
        'Completed': '#64748b'
    };
    
    // Create custom icon
    const iconHtml = `
      <div style="background-color: ${statusColors[dest.status] || '#4f46e5'}; width: 14px; height: 14px; border-radius: 50%; border: 2px solid white; box-shadow: 0 2px 5px rgba(0,0,0,0.3);"></div>
    `;
    
    const icon = L.divIcon({
        html: iconHtml,
        className: 'custom-map-icon',
        iconSize: [14, 14],
        iconAnchor: [7, 7]
    });

    const marker = L.marker([dest.lat, dest.lng], {icon}).addTo(map);
    
    const popupContent = `
        <div class="px-2 py-1">
            <h4 class="font-bold text-sm" style="color: #39391a">${escapeHTML(dest.name)}</h4>
            <span style="font-size: 10px; text-transform: uppercase;">${dest.status}</span>
        </div>
    `;
    marker.bindPopup(popupContent);
    markers.push(marker);
}

// ----------------------------------------
// EVENT LISTENERS
// ----------------------------------------
function setupEventListeners() {
    // Header Tools
    DOM.darkModeToggle.addEventListener('click', toggleDarkMode);
    DOM.exportBtn.addEventListener('click', exportData);
    DOM.importInput.addEventListener('change', importData);

    // Navigation Interactions
    document.querySelectorAll('.nav-search-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            DOM.searchInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
            setTimeout(() => DOM.searchInput.focus(), 500);
        });
    });

    document.querySelectorAll('.nav-budget-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            const bw = document.getElementById('budgetWidget');
            if(bw) {
                bw.scrollIntoView({ behavior: 'smooth', block: 'center' });
                // Briefly flash the widget to draw attention
                bw.classList.add('ring-4', 'ring-primary', 'shadow-2xl', 'scale-[1.02]');
                setTimeout(() => bw.classList.remove('ring-4', 'ring-primary', 'shadow-2xl', 'scale-[1.02]'), 800);
            }
        });
    });

    // Modal Buttons
    document.body.addEventListener('click', (e) => {
        const startDreamingBtn = e.target.closest('.start-dreaming-btn');
        if (startDreamingBtn) {
            e.preventDefault();
            openModal();
        }
    });
    DOM.cancelBtn.addEventListener('click', closeModal);
    DOM.modalBackdrop.addEventListener('click', closeModal);
    DOM.form.addEventListener('submit', handleFormSubmit);

    // Live Budget Math
    document.querySelectorAll('.exp-input').forEach(input => {
        input.addEventListener('input', updateLiveBudgetCalc);
    });

    // Search and Filters
    DOM.searchInput.addEventListener('input', () => renderDestinations());
    
    DOM.statusFilters.addEventListener('click', (e) => {
        const tab = e.target.closest('.filter-tab');
        if (!tab) return;
        
        // Remove active class
        document.querySelectorAll('.filter-tab').forEach(t => {
            t.classList.remove('bg-primary', 'text-on-primary', 'active');
            t.classList.add('bg-surface-container-highest', 'text-on-surface-variant');
        });
        
        // Set active class
        tab.classList.remove('bg-surface-container-highest', 'text-on-surface-variant');
        tab.classList.add('bg-primary', 'text-on-primary', 'active');
        
        filteredStatus = tab.dataset.filter;
        renderDestinations();
    });

    // Grid Delegated Events (Edit/Delete)
    DOM.grid.addEventListener('click', (e) => {
        const editBtn = e.target.closest('.edit-btn');
        const deleteBtn = e.target.closest('.delete-btn');
        
        if (editBtn) {
            e.preventDefault();
            editDestination(editBtn.dataset.id);
        }
        if (deleteBtn) {
            e.preventDefault();
            deleteDestination(deleteBtn.dataset.id);
        }
    });
}

// ----------------------------------------
// MODAL LOGIC & MATH
// ----------------------------------------
function updateLiveBudgetCalc() {
    const f = parseFloat(DOM.expFlight.value) || 0;
    const h = parseFloat(DOM.expHotel.value) || 0;
    const food = parseFloat(DOM.expFood.value) || 0;
    const act = parseFloat(DOM.expAct.value) || 0;
    const total = f + h + food + act;
    DOM.destBudgetTotal.textContent = `$${total.toLocaleString()}`;
    return total;
}

function openModal(isEdit = false) {
    if (!isEdit) {
        DOM.form.reset();
        DOM.editId.value = '';
        DOM.modalTitle.textContent = 'New Adventure';
        updateLiveBudgetCalc();
    }
    
    DOM.modal.classList.remove('hidden');
    DOM.modal.classList.add('flex');
    setTimeout(() => {
        DOM.modalBackdrop.classList.remove('opacity-0');
        DOM.modalContent.classList.remove('opacity-0', 'scale-95');
    }, 10);
}

function closeModal() {
    DOM.modalBackdrop.classList.add('opacity-0');
    DOM.modalContent.classList.add('opacity-0', 'scale-95');
    setTimeout(() => {
        DOM.modal.classList.add('hidden');
        DOM.modal.classList.remove('flex');
        DOM.form.reset();
    }, 300);
}

function handleFormSubmit(e) {
    e.preventDefault();
    
    // Auto-fetch Unsplash if Image URL is literally left completely empty
    let imageUrl = DOM.image.value.trim();
    if (!imageUrl) {
        // Fallback random generation using their location text
        imageUrl = `https://loremflickr.com/600/800/${encodeURIComponent(DOM.location.value.trim() || 'travel')}`;
    }

    const totalBudget = updateLiveBudgetCalc();

    const destData = {
        name: DOM.name.value.trim(),
        location: DOM.location.value.trim(),
        image: imageUrl,
        date: DOM.date.value,
        status: DOM.status.value,
        expenses: {
            flight: parseFloat(DOM.expFlight.value) || 0,
            hotel: parseFloat(DOM.expHotel.value) || 0,
            food: parseFloat(DOM.expFood.value) || 0,
            activities: parseFloat(DOM.expAct.value) || 0
        },
        budget: totalBudget,
        desc: DOM.desc.value.trim(),
        updatedAt: Date.now()
    };
    
    const editId = DOM.editId.value;
    
    if (editId) {
        const index = destinations.findIndex(d => d.id === editId);
        if (index !== -1) {
            // Keep existing lat/lng so we don't re-geocode if location didn't change
            if (destinations[index].location !== destData.location) {
                destData.lat = null;
                destData.lng = null;
            } else {
                destData.lat = destinations[index].lat;
                destData.lng = destinations[index].lng;
            }
            destinations[index] = { ...destinations[index], ...destData };
        }
    } else {
        destData.id = crypto.randomUUID ? crypto.randomUUID() : Date.now().toString();
        destData.createdAt = Date.now();
        destinations.push(destData);
    }
    
    saveData();
    renderDestinations();
    closeModal();
    
    // Confetti micro-animation if booked!
    if (destData.status === 'Booked' && typeof confetti !== 'undefined') {
        confetti({
            particleCount: 100,
            spread: 70,
            origin: { y: 0.6 },
            colors: ['#4f46e5', '#34d399', '#f43f5e']
        });
    }
}

function editDestination(id) {
    const dest = destinations.find(d => d.id === id);
    if (!dest) return;
    
    DOM.editId.value = dest.id;
    DOM.name.value = dest.name;
    DOM.location.value = dest.location;
    DOM.image.value = dest.image;
    DOM.date.value = dest.date || '';
    DOM.status.value = dest.status || 'Planning';
    
    if (dest.expenses) {
        DOM.expFlight.value = dest.expenses.flight || 0;
        DOM.expHotel.value = dest.expenses.hotel || 0;
        DOM.expFood.value = dest.expenses.food || 0;
        DOM.expAct.value = dest.expenses.activities || 0;
    } else {
        // Fallbacks for older data
        DOM.expFlight.value = dest.budget || 0;
        DOM.expHotel.value = 0;
        DOM.expFood.value = 0;
        DOM.expAct.value = 0;
    }
    
    DOM.desc.value = dest.desc;
    
    updateLiveBudgetCalc();
    DOM.modalTitle.textContent = 'Edit Adventure';
    openModal(true);
}

function deleteDestination(id) {
    if (confirm('Are you sure you want to remove this destination from your dreams?')) {
        destinations = destinations.filter(d => d.id !== id);
        saveData();
        renderDestinations();
    }
}

// ----------------------------------------
// RENDERING & UI
// ----------------------------------------

// Days remaining calculation
function getDaysRemaining(dateString) {
    if (!dateString) return null;
    const target = new Date(dateString);
    const now = new Date();
    // Reset to midnight for fair comparison
    target.setHours(0,0,0,0);
    now.setHours(0,0,0,0);
    
    const diffTime = target - now;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Today!';
    if (diffDays === 1) return 'Tomorrow!';
    if (diffDays < 0) return 'Past';
    return `${diffDays} days left`;
}

function renderDestinations() {
    const searchQuery = DOM.searchInput.value.trim().toLowerCase();
    
    // Filter array by Status AND Search
    let filtered = destinations;
    
    if (filteredStatus !== 'all') {
        filtered = filtered.filter(d => d.status === filteredStatus);
    }
    
    if (searchQuery) {
        filtered = filtered.filter(d => 
            d.name.toLowerCase().includes(searchQuery) || 
            d.location.toLowerCase().includes(searchQuery)
        );
    }

    // Empty States
    if (filtered.length === 0) {
        DOM.grid.innerHTML = '';
        if (destinations.length === 0) {
            DOM.grid.classList.add('hidden');
            DOM.emptyState.classList.remove('hidden');
        } else {
            DOM.emptyState.classList.add('hidden');
            DOM.grid.classList.remove('hidden');
            DOM.grid.innerHTML = '<div class="col-span-full py-12 text-center text-on-surface-variant font-label text-sm font-bold tracking-widest uppercase">No escapes found for this filter.</div>';
        }
    } else {
        DOM.emptyState.classList.add('hidden');
        DOM.grid.classList.remove('hidden');
        
        DOM.grid.innerHTML = filtered.map(dest => {
            // Status calculations
            let statusColor = "bg-primary/20 text-primary dark:text-[#88c7ff]";
            if (dest.status === 'Booked') statusColor = "bg-secondary-container text-on-secondary-container";
            if (dest.status === 'Completed') statusColor = "bg-surface-container-highest text-on-surface-variant";
            
            // Countdown badging
            let countdownHtml = '';
            if (dest.status === 'Booked' && dest.date) {
                const days = getDaysRemaining(dest.date);
                if (days && days !== 'Past') {
                    countdownHtml = `
                    <div class="absolute top-4 left-4 bg-surface/90 backdrop-blur-md px-3 py-1.5 rounded-full shadow-lg flex items-center gap-1 animate-pulse">
                        <span class="material-symbols-outlined text-[14px] text-tertiary" data-icon="timer">timer</span>
                        <span class="text-on-surface text-[10px] font-bold uppercase tracking-widest">${days}</span>
                    </div>
                    `;
                }
            }

            // CSS driven mini-chart for expenses
            let expHtml = '';
            if (dest.budget > 0 && dest.expenses) {
                const pf = (dest.expenses.flight / dest.budget) * 100 || 0;
                const ph = (dest.expenses.hotel / dest.budget) * 100 || 0;
                const pf_f = (dest.expenses.food / dest.budget) * 100 || 0;
                const pa = (dest.expenses.activities / dest.budget) * 100 || 0;
                
                expHtml = `
                <div class="mt-2 w-full h-1.5 bg-surface-container-highest rounded-full overflow-hidden flex" title="Budget Breakdown">
                    <div class="h-full bg-[#4f46e5]" style="width: ${pf}%" title="Flights"></div>
                    <div class="h-full bg-[#10b981]" style="width: ${ph}%" title="Hotel"></div>
                    <div class="h-full bg-[#f43f5e]" style="width: ${pf_f}%" title="Food"></div>
                    <div class="h-full bg-[#f59e0b]" style="width: ${pa}%" title="Activities"></div>
                </div>
                `;
            }

            return `
            <div class="card-hover group cursor-pointer flex flex-col gap-4 animate-fade-in relative transition-all">
                <div class="relative overflow-hidden rounded-xl bg-surface-container-highest aspect-[4/5] editorial-shadow">
                    <img src="${escapeHTML(dest.image)}" alt="${escapeHTML(dest.name)}" class="card-image w-full h-full object-cover transition-transform duration-500" onerror="this.src='https://loremflickr.com/600/800/travel'">
                    
                    ${countdownHtml}
                    
                    <div class="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button data-id="${dest.id}" class="edit-btn w-10 h-10 rounded-full bg-surface/90 backdrop-blur-md flex items-center justify-center text-on-surface hover:text-primary transition-colors active:scale-90">
                            <span class="material-symbols-outlined text-sm" data-icon="edit">edit</span>
                        </button>
                        <button data-id="${dest.id}" class="delete-btn w-10 h-10 rounded-full bg-surface/90 backdrop-blur-md flex items-center justify-center text-error hover:bg-error-container/20 transition-colors active:scale-90">
                            <span class="material-symbols-outlined text-sm" data-icon="delete">delete</span>
                        </button>
                    </div>
                    
                    <div class="absolute bottom-4 left-4">
                        <span class="px-3 py-1 rounded-full backdrop-blur-xl text-[10px] font-bold uppercase tracking-widest ${statusColor}">${escapeHTML(dest.status || 'Planning')}</span>
                    </div>
                </div>
                <div class="px-1">
                    <div class="flex justify-between items-start mb-1">
                        <h4 class="font-headline font-bold text-lg text-on-surface line-clamp-1" title="${escapeHTML(dest.name)}">${escapeHTML(dest.name)}</h4>
                        <span class="font-headline font-bold text-tertiary ml-2 whitespace-nowrap">$${dest.budget.toLocaleString()}</span>
                    </div>
                    <p class="text-on-surface-variant text-xs font-label uppercase tracking-widest font-bold mb-2 line-clamp-1" title="${escapeHTML(dest.location)}">${escapeHTML(dest.location)}</p>
                    <p class="text-on-surface-variant text-sm line-clamp-2 leading-relaxed italic" title="${escapeHTML(dest.desc)}">"${escapeHTML(dest.desc)}"</p>
                    
                    ${expHtml}
                </div>
            </div>
            `;
        }).join('');
        
        // Append Start Dreaming Button at end if no search block and filter is All/Planning
        if (!searchQuery && (filteredStatus === 'all' || filteredStatus === 'Planning')) {
            DOM.grid.innerHTML += `
            <div class="start-dreaming-btn cursor-pointer rounded-xl border-2 border-dashed border-outline-variant/30 flex flex-col items-center justify-center p-8 aspect-[4/6] group hover:bg-surface-container-low transition-colors min-h-[250px]">
                <div class="w-12 h-12 rounded-full bg-surface-container-highest flex items-center justify-center text-on-surface-variant/40 mb-4 group-hover:scale-110 transition-transform">
                    <span class="material-symbols-outlined" data-icon="auto_awesome">auto_awesome</span>
                </div>
                <p class="text-on-surface-variant text-sm font-label uppercase font-bold tracking-widest mb-4">Dream next</p>
                <div class="material-symbols-outlined text-primary text-4xl" data-icon="add_circle">add_circle</div>
            </div>
            `;
        }
    }
    
    updateBudget();
}

function updateBudget() {
    const total = destinations.reduce((sum, dest) => sum + dest.budget, 0);
    DOM.budgetTotal.textContent = `$${total.toLocaleString()}`;
    
    let percentage = (total / BUDGET_LIMIT) * 100;
    
    let barColorClass = 'from-primary to-primary-container';
    let healthText = 'Healthy';
    let healthColor = 'text-secondary';
    
    if (percentage > 100) {
        percentage = 100;
        barColorClass = 'from-error to-error-container';
        healthText = 'Overbudget';
        healthColor = 'text-error';
    } else if (percentage > 80) {
        barColorClass = 'from-tertiary to-tertiary-container';
        healthText = 'Warning';
        healthColor = 'text-tertiary';
    } else if (percentage === 0) {
        barColorClass = '';
    }

    DOM.budgetProgressBar.className = `h-full bg-gradient-to-r ${barColorClass} transition-all duration-500 rounded-full`;
    DOM.budgetProgressBar.style.width = `${Math.max(percentage, percentage === 0 ? 0 : 2)}%`;
    
    DOM.budgetPercentage.textContent = `${Math.round((total / BUDGET_LIMIT) * 100)}% Allocated`;
    DOM.budgetHealth.textContent = healthText;
    DOM.budgetHealth.className = `text-xs font-bold ${healthColor} font-label uppercase tracking-tighter`;
}

// ----------------------------------------
// UTILITY 
// ----------------------------------------
function escapeHTML(str) {
    if (!str) return '';
    return str.toString().replace(/[&<>'"]/g, 
        tag => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            "'": '&#39;',
            '"': '&quot;'
        }[tag] || tag)
    );
}

// Inline styles for icons and map
document.head.insertAdjacentHTML('beforeend', `
<style>
@keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
.animate-fade-in { animation: fadeIn 0.4s ease-out forwards; }
.hide-scrollbar::-webkit-scrollbar { display: none; }
.hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
.custom-map-icon { background: none; border: none; }
</style>
`);

document.addEventListener('DOMContentLoaded', init);
if (document.readyState === 'interactive' || document.readyState === 'complete') {
    setTimeout(init, 1);
}
