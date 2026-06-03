import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Estado de la aplicación
let supabase = null;
let activities = [];
const TOTAL_DAYS = 20;

// Elementos del DOM
const authSection = document.getElementById('auth-section');
const itinerarySection = document.getElementById('itinerary-section');
const btnConnect = document.getElementById('btn-connect');
const sbUrlInput = document.getElementById('sb-url');
const sbKeyInput = document.getElementById('sb-key');
const daysContainer = document.getElementById('days-container');

// Modal
const modal = document.getElementById('activity-modal');
const modalTitle = document.getElementById('modal-title');
const btnAddActivity = document.getElementById('btn-add-activity');
const btnCancelModal = document.getElementById('btn-cancel-modal');
const activityForm = document.getElementById('activity-form');

// Inputs del formulario
const inputId = document.getElementById('activity-id');
const inputDay = document.getElementById('activity-day');
const inputTitle = document.getElementById('activity-title');
const inputTime = document.getElementById('activity-time');
const inputNotes = document.getElementById('activity-notes');

// --- INICIALIZACIÓN ---
document.addEventListener('DOMContentLoaded', () => {
    // Intentar recuperar credenciales guardadas
    const savedUrl = localStorage.getItem('sb-url');
    const savedKey = localStorage.getItem('sb-key');
    
    if (savedUrl && savedKey) {
        sbUrlInput.value = savedUrl;
        sbKeyInput.value = savedKey;
        initSupabase(savedUrl, savedKey);
    }
});

// --- SUPABASE CONEXIÓN ---
btnConnect.addEventListener('click', () => {
    const url = sbUrlInput.value.trim();
    const key = sbKeyInput.value.trim();
    
    if (!url || !key) {
        alert('Por favor introduce la URL y la Clave de Supabase.');
        return;
    }
    
    localStorage.setItem('sb-url', url);
    localStorage.setItem('sb-key', key);
    initSupabase(url, key);
});

async function initSupabase(url, key) {
    try {
        btnConnect.textContent = 'Conectando...';
        btnConnect.disabled = true;
        
        supabase = createClient(url, key);
        
        // Comprobar la conexión intentando leer la tabla
        await loadActivities();
        
        // Si tiene éxito, cambiar a la vista de itinerario
        authSection.classList.add('hidden');
        itinerarySection.classList.remove('hidden');
        
    } catch (error) {
        alert('Error al conectar con Supabase. Revisa las credenciales e intenta de nuevo.');
        console.error(error);
        localStorage.removeItem('sb-url');
        localStorage.removeItem('sb-key');
        btnConnect.textContent = 'Conectar';
        btnConnect.disabled = false;
    }
}

// --- LÓGICA DE ACTIVIDADES ---

async function loadActivities() {
    // Asumimos que tienes una tabla llamada 'activities'
    // Columnas necesarias: id, day (number), title (text), time (text), notes (text)
    const { data, error } = await supabase
        .from('activities')
        .select('*')
        .order('time', { ascending: true });
        
    if (error) {
        // Si la tabla no existe, mostraremos los días vacíos, pero alertaremos
        if (error.code === '42P01') {
             alert('Aviso: La tabla "activities" no existe en tu Supabase. Por favor créala con columnas: id, day, title, time, notes.');
        } else {
             throw error;
        }
        activities = [];
    } else {
        activities = data || [];
    }
    
    renderItinerary();
}

function renderItinerary() {
    daysContainer.innerHTML = '';
    
    for (let day = 1; day <= TOTAL_DAYS; day++) {
        const dayActivities = activities.filter(a => parseInt(a.day) === day);
        
        const dayCard = document.createElement('div');
        dayCard.className = 'day-card';
        
        dayCard.innerHTML = `
            <div class="day-header">Día ${day}</div>
            <div class="activities-list">
                ${dayActivities.length === 0 ? '<div class="empty-day">Sin actividades planeadas</div>' : ''}
            </div>
        `;
        
        const listContainer = dayCard.querySelector('.activities-list');
        
        dayActivities.forEach(activity => {
            const item = document.createElement('div');
            item.className = 'activity-item';
            
            // Reemplazar saltos de línea para HTML
            const notesHtml = activity.notes ? activity.notes.replace(/\n/g, '<br>') : '';
            
            item.innerHTML = `
                <div class="activity-header">
                    <span class="activity-title">${escapeHTML(activity.title)}</span>
                    ${activity.time ? `<span class="activity-time">${escapeHTML(activity.time)}</span>` : ''}
                </div>
                ${activity.notes ? `<div class="activity-notes">${notesHtml}</div>` : ''}
                <div class="activity-actions">
                    <button class="icon-btn edit" data-id="${activity.id}" title="Editar">✏️</button>
                    <button class="icon-btn delete" data-id="${activity.id}" title="Borrar">🗑️</button>
                </div>
            `;
            
            listContainer.appendChild(item);
        });
        
        daysContainer.appendChild(dayCard);
    }
    
    // Asignar eventos a los botones generados
    document.querySelectorAll('.icon-btn.edit').forEach(btn => {
        btn.addEventListener('click', (e) => openModal(e.target.dataset.id));
    });
    
    document.querySelectorAll('.icon-btn.delete').forEach(btn => {
        btn.addEventListener('click', (e) => deleteActivity(e.target.dataset.id));
    });
}

// --- GESTIÓN DEL MODAL ---

btnAddActivity.addEventListener('click', () => openModal());
btnCancelModal.addEventListener('click', closeModal);

function openModal(id = null) {
    if (id) {
        // Editar
        modalTitle.textContent = 'Editar Actividad';
        const activity = activities.find(a => a.id == id);
        inputId.value = activity.id;
        inputDay.value = activity.day;
        inputTitle.value = activity.title;
        inputTime.value = activity.time || '';
        inputNotes.value = activity.notes || '';
    } else {
        // Nuevo
        modalTitle.textContent = 'Añadir Actividad';
        activityForm.reset();
        inputId.value = '';
    }
    modal.classList.remove('hidden');
}

function closeModal() {
    modal.classList.add('hidden');
    activityForm.reset();
}

activityForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const activityData = {
        day: parseInt(inputDay.value),
        title: inputTitle.value.trim(),
        time: inputTime.value,
        notes: inputNotes.value.trim()
    };
    
    const id = inputId.value;
    const isEdit = !!id;
    
    const submitBtn = activityForm.querySelector('button[type="submit"]');
    submitBtn.textContent = 'Guardando...';
    submitBtn.disabled = true;
    
    try {
        if (isEdit) {
            const { error } = await supabase
                .from('activities')
                .update(activityData)
                .eq('id', id);
            if (error) throw error;
        } else {
            const { error } = await supabase
                .from('activities')
                .insert([activityData]);
            if (error) throw error;
        }
        
        await loadActivities();
        closeModal();
    } catch (error) {
        alert('Error al guardar la actividad. Consulta la consola.');
        console.error(error);
    } finally {
        submitBtn.textContent = 'Guardar';
        submitBtn.disabled = false;
    }
});

async function deleteActivity(id) {
    if (!confirm('¿Estás seguro de que quieres borrar esta actividad?')) return;
    
    try {
        const { error } = await supabase
            .from('activities')
            .delete()
            .eq('id', id);
            
        if (error) throw error;
        await loadActivities();
    } catch (error) {
        alert('Error al borrar la actividad.');
        console.error(error);
    }
}

// Utilidad para prevenir XSS básico
function escapeHTML(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}
